// console.ts
import fs from "fs";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { WebSocketServer, WebSocket, RawData } from 'ws';
import http from 'http';
import express from 'express';

const LOG_DIR: string = path.resolve(__dirname, "../models/data");
const LOG_FILE: string = path.join(LOG_DIR, "logs.txt");

let processInstance: ChildProcess | null = null;
let isRunning: boolean = false;
let isAwaitingInput: boolean = false;

// This string is a marker for the frontend to request user input.
const INPUT_PROMPT_STRING = "__NEEDS_INPUT__";

interface ApiType {
  clearLogFile: () => void;
  broadcast: (msg: string | Buffer, wss?: WebSocketServer, isError?: boolean, silent?: boolean) => void;
  parseExocoreRun: (filePath: string) => { exportCommands: string[]; runCommand: string | null };
  executeCommand: (
    command: string,
    cwd: string,
    onCloseCallback: (outcome: number | string | Error) => void,
    wss?: WebSocketServer
  ) => ChildProcess | null;
  runCommandsSequentially: (
    commands: string[],
    cwd: string,
    onSequenceDone: (success: boolean) => void,
    wss?: WebSocketServer,
    index?: number
  ) => void;
  start: (wss?: WebSocketServer, args?: string) => void;
  stop: (wss?: WebSocketServer) => void;
  restart: (wss?: WebSocketServer, args?: string) => void;
  status: () => "running" | "stopped";
}

const api: ApiType = {
  clearLogFile(): void {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.writeFileSync(LOG_FILE, "");
  },

  broadcast(msg: string | Buffer, wss?: WebSocketServer, isError: boolean = false, silent: boolean = false): void {
    const data = msg.toString();
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    // Don't write the input prompt marker to the log file
    if(!data.includes(INPUT_PROMPT_STRING)) {
        fs.appendFileSync(LOG_FILE, `${data}`);
    }

    if (!silent && wss && wss.clients) {
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          // Check for the input prompt marker
          if (data.includes(INPUT_PROMPT_STRING)) {
            const cleanData = data.replace(INPUT_PROMPT_STRING, "").trim();
            isAwaitingInput = true;
            // Send a structured message to the client
            client.send(JSON.stringify({ type: 'INPUT_REQUIRED', payload: cleanData }));
          } else {
            client.send(data);
          }
        }
      });
    }
    if (isError) {
      console.error(`BROADCAST_ERROR_LOG: ${data.trim()}`);
    }
  },

  // ... (rest of the functions: parseExocoreRun, executeCommand, runCommandsSequentially are unchanged)
  parseExocoreRun(filePath: string): { exportCommands: string[]; runCommand: string | null } {
const raw: string = fs.readFileSync(filePath, "utf8");
const exportMatch: RegExpMatchArray | null = raw.match(/export\s*=\s*{([\s\S]*?)}/);
const functionMatch: RegExpMatchArray | null = raw.match(/function\s*=\s*{([\s\S]*?)}/);
const exportCommands: string[] = [];

if (exportMatch && exportMatch[1]) {
const lines: string[] = exportMatch[1].split(";");
for (let line of lines) {
const matchResult: RegExpMatchArray | null = line.match(/["'](.+?)["']/);
if (matchResult && typeof matchResult[1] === 'string' && matchResult[1].trim() !== '') {
exportCommands.push(matchResult[1]);
}
}
}

let runCommand: string | null = null;
if (functionMatch && functionMatch[1]) {
const runMatch: RegExpMatchArray | null = functionMatch[1].match(/run\s*=\s*["'](.+?)["']/);
if (runMatch && typeof runMatch[1] === 'string' && runMatch[1].trim() !== '') {
runCommand = runMatch[1];
}
}
return { exportCommands, runCommand };
},

executeCommand(
command: string,
cwd: string,
onCloseCallback: (outcome: number | string | Error) => void,
wss?: WebSocketServer
): ChildProcess | null {
let proc: ChildProcess | null = null;
try {
proc = spawn(command, {
cwd,
shell: true,
env: { ...process.env, FORCE_COLOR: "1", LANG: "en_US.UTF-8" },
});
} catch (rawErr: unknown) {
let errMsg = "Unknown spawn error";
if (rawErr instanceof Error) errMsg = rawErr.message;
else if (typeof rawErr === 'string') errMsg = rawErr;
api.broadcast(`\x1b[31m❌ Spawn error for command "${command}": ${errMsg}\x1b[0m`, wss, true);
if (typeof onCloseCallback === 'function') {
if (rawErr instanceof Error) onCloseCallback(rawErr);
else onCloseCallback(new Error(String(rawErr)));
}
return null;
}

if (proc.stdout) {
proc.stdout.on("data", (data: Buffer | string) => api.broadcast(data, wss, false, false));
}
if (proc.stderr) {
proc.stderr.on("data", (data: Buffer | string) => api.broadcast(`\x1b[31m${data.toString()}\x1b[0m`, wss, true, false));
}

proc.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
if (typeof onCloseCallback === 'function') {
if (code === null) onCloseCallback(signal || 'signaled');
else onCloseCallback(code);
}
});

proc.on("error", (err: Error) => {
api.broadcast(`\x1b[31m❌ Command execution error for "${command}": ${err.message}\x1b[0m`, wss, true, false);
if (typeof onCloseCallback === 'function') onCloseCallback(err);
});
return proc;
},

runCommandsSequentially(
commands: string[],
cwd: string,
onSequenceDone: (success: boolean) => void,
wss?: WebSocketServer,
index: number = 0
): void {
if (index >= commands.length) {
if (typeof onSequenceDone === 'function') onSequenceDone(true);
return;
}
const cmd = commands[index];

if (typeof cmd !== 'string' || cmd.trim() === "") {
api.broadcast(`\x1b[31m❌ Invalid or empty setup command at index ${index}.\x1b[0m`, wss, true, false);
if (typeof onSequenceDone === 'function') onSequenceDone(false);
return;
}

const proc = api.executeCommand(cmd, cwd, (outcome: number | string | Error) => {
const benignSignal = (typeof outcome === 'string' && (outcome.toUpperCase() === 'SIGTERM' || outcome.toUpperCase() === 'SIGKILL'));
if (outcome !== 0 && (typeof outcome === 'number' || outcome instanceof Error || (typeof outcome === 'string' && !benignSignal))) {
const errorMessage = outcome instanceof Error ? outcome.message : String(outcome);
api.broadcast(`\x1b[31m❌ Setup command "${cmd}" failed: ${errorMessage}\x1b[0m`, wss, true, false);
if (typeof onSequenceDone === 'function') onSequenceDone(false);
return;
}
api.runCommandsSequentially(commands, cwd, onSequenceDone, wss, index + 1);
}, wss
);

if (!proc) {
api.broadcast(`\x1b[31m❌ Failed to initiate setup command "${cmd}".\x1b[0m`, wss, true, false);
if (typeof onSequenceDone === 'function') onSequenceDone(false);
}
},

  start(wss?: WebSocketServer, args?: string): void {
    if (isRunning) {
      api.broadcast("\x1b[33m⚠️ Process is already running.\x1b[0m", wss, true, false);
      return;
    }
    api.clearLogFile();
    api.broadcast(`\x1b[36m[SYSTEM] Starting process... (Args: ${args || 'none'})\x1b[0m`, wss, false, true);
    isAwaitingInput = false;

    let projectPath: string | undefined;

    try {
        const configJsonPath: string = path.resolve(process.cwd(), 'config.json');
        if (fs.existsSync(configJsonPath)) {
            const configRaw: string = fs.readFileSync(configJsonPath, 'utf-8');
            if(configRaw.trim() !== ""){
                const configData: any = JSON.parse(configRaw);
                if(configData && typeof configData.project === 'string' && configData.project.trim() !== ""){
                    const configJsonDir: string = path.dirname(configJsonPath);
                    const resolvedPath: string = path.resolve(configJsonDir, configData.project);
                    if(fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()){
                        projectPath = resolvedPath;
                    } else {
                        api.broadcast(`\x1b[31m❌ Error: Project path from config.json is invalid.\x1b[0m`, wss, true, false);
                        return;
                    }
                } else {
                    api.broadcast(`\x1b[31m❌ Error: 'project' key in config.json is missing or invalid.\x1b[0m`, wss, true, false);
                    return;
                }
            } else {
                api.broadcast(`\x1b[31m❌ Error: config.json is empty.\x1b[0m`, wss, true, false);
                return;
            }
        } else {
            api.broadcast(`\x1b[31m❌ Error: Configuration file not found.\x1b[0m`, wss, true, false);
            return;
        }
    } catch (rawErr: unknown) {
        api.broadcast(`\x1b[31m❌ Error reading project configuration.\x1b[0m`, wss, true, false);
        return;
    }

    if (typeof projectPath !== 'string') {
      api.broadcast(`\x1b[31m❌ Project path could not be determined.\x1b[0m`, wss, true, false);
      return;
    }

    const currentProjectPath: string = projectPath;
    const exocoreRunPath: string = path.join(currentProjectPath, "exocore.run");

    if (!fs.existsSync(exocoreRunPath)) {
      api.broadcast(`\x1b[31m❌ Missing exocore.run file.\x1b[0m`, wss, true, false);
      return;
    }

    const { exportCommands, runCommand } = api.parseExocoreRun(exocoreRunPath);

    if (!runCommand) {
      api.broadcast("\x1b[31m❌ Missing run command in exocore.run.\x1b[0m", wss, true, false);
      return;
    }

    const currentRunCommand: string = args ? `${runCommand} ${args}` : runCommand;

    api.runCommandsSequentially([...exportCommands], currentProjectPath, (setupSuccess: boolean) => {
      if (!setupSuccess) {
        api.broadcast(`\x1b[31m❌ Setup commands failed.\x1b[0m`, wss, true, false);
        return;
      }

      api.broadcast(`\x1b[36m[SYSTEM] Executing: ${currentRunCommand}\x1b[0m`, wss, false, true);

      let spawnedProc: ChildProcess | null = null;
      try {
        spawnedProc = spawn(currentRunCommand, {
          cwd: currentProjectPath,
          shell: true,
          detached: true,
          env: { ...process.env, FORCE_COLOR: "1", LANG: "en_US.UTF-8" },
        });
      } catch (rawErr: unknown) {
        api.broadcast(`\x1b[31m❌ Failed to spawn main process.\x1b[0m`, wss, true, false);
        return;
      }

      if (!spawnedProc || typeof spawnedProc.pid !== 'number') {
        api.broadcast(`\x1b[31m❌ Failed to get process handle.\x1b[0m`, wss, true, false);
        return;
      }

      processInstance = spawnedProc;
      isRunning = true;
      api.broadcast(`\x1b[32m[SYSTEM] Process started with PID: ${processInstance.pid}\x1b[0m`, wss, false, true);

      if (processInstance.stdout) {
        processInstance.stdout.on("data", (data: Buffer | string) => api.broadcast(data, wss, false, false));
      }
      if (processInstance.stderr) {
        processInstance.stderr.on("data", (data: Buffer | string) =>
          api.broadcast(`\x1b[31m${data.toString()}\x1b[0m`, wss, true, false)
        );
      }

      processInstance.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
        const pid = processInstance ? processInstance.pid : 'unknown';
        const signalMsg = signal ? ` with signal ${signal}` : '';
        const codeMsg = code !== null ? ` with code ${code}` : '';
        const exitMessage = `\x1b[36m[SYSTEM] Main process (PID: ${pid}) closed${codeMsg}${signalMsg}.\x1b[0m`;
        api.broadcast(exitMessage, wss, false, true);
        isRunning = false;
        processInstance = null;
        isAwaitingInput = false;
      });

      processInstance.on("error", (err: Error) => {
        const pid = processInstance ? processInstance.pid : 'unknown';
        api.broadcast(`\x1b[31m❌ Error with main process (PID: ${pid}): ${err.message}\x1b[0m`, wss, true, false);
        isRunning = false;
        processInstance = null;
        isAwaitingInput = false;
      });
    }, wss);
  },

  stop(wss?: WebSocketServer): void {
    if (!processInstance || typeof processInstance.pid !== 'number') {
      api.broadcast("\x1b[33m⚠️ No active process to stop.\x1b[0m", wss, true, false);
      if (isRunning) {
        isRunning = false;
        processInstance = null;
      }
      return;
    }

    if (!isRunning) {
        api.broadcast("\x1b[33m⚠️ Process is already stopped.\x1b[0m", wss, true, false);
        return;
    }

    const pidToStop: number = processInstance.pid;
    api.broadcast(`\x1b[36m[SYSTEM] Stopping process group PID: ${pidToStop}...\x1b[0m`, wss, false, true);

    try {
      process.kill(-pidToStop, "SIGTERM");

      setTimeout(() => {
        if (processInstance && processInstance.pid === pidToStop && !processInstance.killed) {
          api.broadcast(`\x1b[33m[SYSTEM] ⚠️ Process ${pidToStop} unresponsive, sending SIGKILL.\x1b[0m`, wss, true, true);
          try {
            process.kill(-pidToStop, "SIGKILL");
          } catch (rawKillErr: unknown) {
            const err = rawKillErr as NodeJS.ErrnoException;
            if (err.code === 'ESRCH') {
              api.broadcast(`\x1b[32m[SYSTEM] ✅ Process group ${pidToStop} terminated.\x1b[0m`, wss, false, true);
            } else {
              api.broadcast(`\x1b[31m[SYSTEM] ❌ Error sending SIGKILL to PID ${pidToStop}: ${err.message}\x1b[0m`, wss, true, true);
            }
          } finally {
           if (processInstance && processInstance.pid === pidToStop) {
               isRunning = false;
               processInstance = null;
           }
          }
        } else {
            api.broadcast(`\x1b[32m[SYSTEM] ✅ Process ${pidToStop} stopped.\x1b[0m`, wss, false, true);
            isRunning = false;
            processInstance = null;
        }
      }, 3000);
    } catch (rawTermErr: unknown) {
      const err = rawTermErr as NodeJS.ErrnoException;
      if (err.code === 'ESRCH') {
        api.broadcast(`\x1b[33m[SYSTEM] ⚠️ Process group PID ${pidToStop} not found.\x1b[0m`, wss, true, true);
      } else {
        api.broadcast(`\x1b[31m❌ Error sending SIGTERM: ${err.message}\x1b[0m`, wss, true, false);
      }
      isRunning = false;
      processInstance = null;
    }
  },

  restart(wss?: WebSocketServer, args?: string): void {
    api.broadcast(`\x1b[36m[SYSTEM] Restarting process...\x1b[0m`, wss, false, true);
    if (isRunning && processInstance) {
      const currentPid = processInstance.pid;
      api.broadcast(`\x1b[36m[SYSTEM] Stopping running process (PID: ${currentPid || 'unknown'}).\x1b[0m`, wss, false, true);

      const onStoppedForRestart = (): void => {
        if (processInstance) {
            processInstance.removeListener('error', onErrorDuringRestartStop);
        }
        api.broadcast('[SYSTEM] ✅ Old process stopped, starting new one.', wss, false, true);
        setTimeout(() => api.start(wss, args), 500);
      };

      const onErrorDuringRestartStop = (err: Error): void => {
        if (processInstance) {
            processInstance.removeListener('close', onStoppedForRestart);
        }
        api.broadcast(`\x1b[31m[SYSTEM] ❌ Error stopping old process: ${err.message}. Starting anyway.\x1b[0m`, wss, true, true);
        isRunning = false;
        processInstance = null;
        setTimeout(() => api.start(wss, args), 500);
      };

      processInstance.once('close', onStoppedForRestart);
      processInstance.once('error', onErrorDuringRestartStop);

      api.stop(wss);
    } else {
      api.broadcast('[SYSTEM] ℹ️ No process running. Starting new process.', wss, false, true);
      api.stop(wss); // Ensure any zombie process state is cleared
      setTimeout(() => api.start(wss, args), 100);
    }
  },

  status(): "running" | "stopped" {
    if (isRunning && processInstance && !processInstance.killed) {
        try {
            process.kill(processInstance.pid!, 0);
            return "running";
        } catch (e) {
            isRunning = false;
            processInstance = null;
            return "stopped";
        }
    }
    return "stopped";
  },
};

export interface RouteHandlerParamsSuperset {
  app?: express.Application;
  req: express.Request;
  res: express.Response;
  wss?: WebSocketServer;
  wssConsole?: WebSocketServer;
  Shellwss?: WebSocketServer;
  server?: http.Server;
}

export interface ExpressRouteModule {
  method: "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all";
  path: string;
  install: (params: Partial<RouteHandlerParamsSuperset>) => void;
}

type StartStopRestartParams = Pick<RouteHandlerParamsSuperset, 'req' | 'res' | 'wssConsole'>;
type ConsoleStatusParams = Pick<RouteHandlerParamsSuperset, 'res'>;

export const modules: Array<{
  method: "get" | "post";
  path: string;
  install: (params: any) => void;
}> = [
  {
    method: "post",
    path: "/start",
    install: ({ req, res, wssConsole }: StartStopRestartParams) => {
      if (!wssConsole) return res.status(500).send("Console WebSocket server not available.");
      api.start(wssConsole, req.body?.args);
      res.send(`Process start initiated.`);
    },
  },
  {
    method: "post",
    path: "/stop",
    install: ({ res, wssConsole }: StartStopRestartParams) => {
      if (!wssConsole) return res.status(500).send("Console WebSocket server not available.");
      api.stop(wssConsole);
      res.send(`Process stop initiated.`);
    },
  },
  {
    method: "post",
    path: "/restart",
    install: ({ req, res, wssConsole }: StartStopRestartParams) => {
      if (!wssConsole) return res.status(500).send("Console WebSocket server not available.");
      api.restart(wssConsole, req.body?.args);
      res.send(`Process restart initiated.`);
    },
  },
  {
    method: "get",
    path: "/console/status",
    install: ({ res }: ConsoleStatusParams) => {
      res.send(api.status());
    },
  },
];

export function setupConsoleWS(wssConsole: WebSocketServer): void {
  wssConsole.on("connection", (ws: WebSocket) => {
    console.log("Console WebSocket client connected");
    try {
      const logContent: string = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, "utf8") : "\x1b[36mℹ️ No previous logs.\x1b[0m";
      ws.send(logContent);
    } catch (err) {
      ws.send("\x1b[31mError reading past logs.\x1b[0m");
    }

    ws.on("message", (rawMessage: RawData) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        if (message.type === 'STDIN_INPUT' && typeof message.payload === 'string') {
          if (processInstance && isRunning && isAwaitingInput && processInstance.stdin && processInstance.stdin.writable) {
            processInstance.stdin.write(message.payload + '\n');
            isAwaitingInput = false;
          } else {
            api.broadcast(`\x1b[33m[SYSTEM-WARN] Process not running or not awaiting input.\x1b[0m`, wssConsole, true, false);
          }
        }
      } catch (e) {
        console.log(`Received non-command message from client: ${rawMessage.toString()}`);
      }
    });

    ws.on("close", () => console.log("Console WebSocket client disconnected"));
    ws.on("error", (error: Error) => console.error("Console WebSocket client error:", error));
  });
}