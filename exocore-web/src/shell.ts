// @ts-check

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';

let shellProcess: ChildProcess | null = null;
let currentCwd: string | null = null;
let projectRootPath: string | null = null;

const PROMPT_DELIMITER = '__EXOCORE_SHELL_PROMPT_BOUNDARY__\n';

const FORBIDDEN_COMMAND_PATTERNS: RegExp[] = [
    /^cd\s+\.\.(?:\/\s*)?$/,
    /^cd\s+\.\.\/exocore-web\s*$/,
    /^cd\s+\.\.\/src\s*$/
];

interface WsMessage {
    type: 'log' | 'prompt' | 'system';
    data: string;
}

function isCommandForbidden(command: string): boolean {
    const trimmedCommand = command.trim();
    return FORBIDDEN_COMMAND_PATTERNS.some((pattern) => pattern.test(trimmedCommand));
}

function getFormattedCwdPrompt(cwd: string, root: string): string {
    const rootName = path.basename(root);
    if (cwd.startsWith(root)) {
        const relativePath = path.relative(root, cwd);
        return `/@${rootName}${relativePath ? `/${relativePath}` : ''}$ `;
    }
    return `${cwd}$ `;
}

function broadcastToShellWss(wssInstance: WebSocketServer, message: WsMessage): void {
    if (wssInstance && wssInstance.clients) {
        const messageString = JSON.stringify(message);
        wssInstance.clients.forEach((client: WebSocket) => {
            if (client.readyState === 1) {
                client.send(messageString);
            }
        });
    }
}

export const modules = [
    {
        method: 'post',
        path: '/shell/sent',
        install: async ({ req, res, Shellwss }: { req: Request, res: Response, Shellwss: WebSocketServer }): Promise<void> => {
            const commandFromBody: string | null = req.body && typeof req.body.command === 'string' ? req.body.command : null;
            if (!commandFromBody) {
                res.status(400).send('No command provided.');
                return;
            }
            const trimmedCommand = commandFromBody.trim();

            if (isCommandForbidden(trimmedCommand)) {
                broadcastToShellWss(Shellwss, { type: 'log', data: '\x1b[31m Access Denied \x1b[0m\n' });
                res.status(403).send('Command execution is restricted.');
                return;
            }

            if (trimmedCommand.startsWith('exocore git clone ')) {
                const repoUrl: string = trimmedCommand.substring('exocore git clone '.length).trim();
                if (!repoUrl) {
                    broadcastToShellWss(Shellwss, { type: 'log', data: '\x1b[31mError: No repository URL provided...\x1b[0m\n' });
                    res.status(400).send('No repository URL provided.');
                    return;
                }
                const baseDirForPkg = path.resolve(__dirname, '../../src/pkg');
                try {
                    await fs.promises.mkdir(baseDirForPkg, { recursive: true });
                    const repoName = path.basename(repoUrl, '.git');
                    const clonePath = path.join(baseDirForPkg, repoName);
                    broadcastToShellWss(Shellwss, { type: 'log', data: `\x1b[33mCloning ${repoUrl}...\x1b[0m\n` });
                    if (fs.existsSync(clonePath) && fs.readdirSync(clonePath).length > 0) {
                        broadcastToShellWss(Shellwss, { type: 'log', data: `\x1b[33mDirectory ${clonePath} already exists. Skipping.\x1b[0m\n` });
                        res.status(200).send('Clone destination already exists.');
                        return;
                    }
                    const git = simpleGit();
                    await git.clone(repoUrl, clonePath);
                    broadcastToShellWss(Shellwss, { type: 'log', data: `\x1b[32mSuccessfully cloned ${repoUrl}\x1b[0m\n` });
                    res.send('Clone command executed successfully.');
                } catch (error: any) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    broadcastToShellWss(Shellwss, { type: 'log', data: `\x1b[31mFailed to clone: ${errMsg}\x1b[0m\n` });
                    res.status(500).send('Clone command failed.');
                }
                return;
            }

            if (!shellProcess) {
                let projectPath: string;
                let customPkgPathForShellEnv: string | undefined;

                try {
                    const configJsonPath = path.resolve(__dirname, '../config.json');
                    const configData = JSON.parse(fs.readFileSync(configJsonPath, 'utf-8'));
                    projectPath = path.resolve(path.dirname(configJsonPath), configData.project);
                } catch (e) {
                    projectPath = path.resolve(__dirname, '..');
                }

                customPkgPathForShellEnv = path.resolve(__dirname, '../../src/pkg');
                if (!fs.existsSync(customPkgPathForShellEnv) || !fs.statSync(customPkgPathForShellEnv).isDirectory()) {
                    customPkgPathForShellEnv = undefined;
                }

                projectRootPath = projectPath;
                currentCwd = projectPath;

                const currentEnv: NodeJS.ProcessEnv = { ...process.env };
                let effectivePath: string | undefined = currentEnv.PATH;

                if (customPkgPathForShellEnv) {
                    effectivePath = `${customPkgPathForShellEnv}:${effectivePath || ''}`;
                }

                const shellEnv: NodeJS.ProcessEnv = {
                    ...currentEnv,
                    FORCE_COLOR: '1',
                    NPM_CONFIG_COLOR: 'always',
                    TERM: 'xterm-256color',
                    LANG: 'en_US.UTF-8',
                    PATH: effectivePath,
                };

                shellProcess = spawn('bash', { cwd: projectPath, shell: true, env: shellEnv });

                let stdoutBuffer = '';
                const handleShellOutput = (data: Buffer | string) => {
                    stdoutBuffer += data.toString();
                    while (stdoutBuffer.includes(PROMPT_DELIMITER)) {
                        const boundaryIndex = stdoutBuffer.indexOf(PROMPT_DELIMITER);
                        const chunk = stdoutBuffer.substring(0, boundaryIndex);
                        stdoutBuffer = stdoutBuffer.substring(boundaryIndex + PROMPT_DELIMITER.length);

                        const lines = chunk.trim().split('\n');
                        const newCwd = lines.pop()?.trim();
                        const commandOutput = lines.join('\n');

                        if (commandOutput) {
                            broadcastToShellWss(Shellwss, { type: 'log', data: commandOutput + '\n' });
                        }
                        if (newCwd && projectRootPath && fs.existsSync(newCwd)) {
                            currentCwd = newCwd;
                            const newPrompt = getFormattedCwdPrompt(currentCwd, projectRootPath);
                            broadcastToShellWss(Shellwss, { type: 'prompt', data: newPrompt });
                        }
                    }
                };

                shellProcess.stdout?.on('data', handleShellOutput);
                shellProcess.stderr?.on('data', (data) => broadcastToShellWss(Shellwss, { type: 'log', data: `\x1b[31m${data.toString()}\x1b[0m` }));
                shellProcess.on('close', (code) => {
                    broadcastToShellWss(Shellwss, { type: 'system', data: `\x1b[33mShell exited (code: ${code}).\x1b[0m\n` });
                    shellProcess = null;
                    currentCwd = null;
                    projectRootPath = null;
                });
                shellProcess.on('error', (err) => {
                    broadcastToShellWss(Shellwss, { type: 'log', data: `\x1b[31mFailed to start shell: ${err.message}\x1b[0m\n` });
                    shellProcess = null;
                });

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (shellProcess && shellProcess.stdin?.writable) {
                shellProcess.stdin.write(trimmedCommand + '\n');
                shellProcess.stdin.write(`pwd && echo "${PROMPT_DELIMITER.trim()}"\n`);
                res.send('Command sent to shell.');
            } else {
                broadcastToShellWss(Shellwss, { type: 'log', data: '\x1b[31mCannot send command: Shell is not ready.\x1b[0m\n' });
                res.status(503).send('Shell process not available.');
            }
        },
    },
    {
        method: 'post',
        path: '/shell/kill',
        install: ({ res, Shellwss }: { res: Response, Shellwss: WebSocketServer }) => {
            if (shellProcess) {
                shellProcess.kill();
                broadcastToShellWss(Shellwss, { type: 'system', data: '\x1b[33mKill signal sent.\x1b[0m\n' });
                res.send('Kill signal sent.');
            } else {
                broadcastToShellWss(Shellwss, { type: 'system', data: '\x1b[33mNo active shell to kill.\x1b[0m\n' });
                res.status(404).send('No active shell process.');
            }
        },
    },
];

export function setupShellWS(Shellwss: WebSocketServer): void {
    Shellwss.on('connection', (ws: WebSocket) => {
        ws.send(JSON.stringify({ type: 'system', data: '\x1b[32mWelcome to the interactive shell!\x1b[0m\n' }));
        if (shellProcess && currentCwd && projectRootPath) {
            const prompt = getFormattedCwdPrompt(currentCwd, projectRootPath);
            ws.send(JSON.stringify({ type: 'prompt', data: prompt }));
        } else {
            ws.send(JSON.stringify({ type: 'system', data: '\x1b[33mShell not running. Send command to start.\x1b[0m\n' }));
        }
        ws.on('message', (message: Buffer | string) => {
             ws.send(JSON.stringify({ type: 'system', data: '\x1b[33mPlease send commands through the terminal input, not directly via WebSocket message.\x1b[0m\n' }));
        });
    });
}

export function stopShellProcessOnExit(): void {
    if (shellProcess) {
        shellProcess.kill('SIGTERM');
    }
}