import http from 'http';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');
const routesJsonFile = path.basename(routesJsonPath);
const routesJsonDir = path.dirname(routesJsonPath);

let activeRoutesRouter = Router();

const errorHtmlContent = `<!DOCTYPE html>
<html><head><title>Server Error</title></head>
<body style="font-family: sans-serif; text-align: center; margin-top: 10%;">
  <h1>502 Bad Gateway</h1>
  <p>The backend service appears to be offline or misconfigured.</p>
</body></html>`;

function sendErrorHtmlPage(res: Response, statusCode: number = 502) {
  if (res.headersSent) return;
  res.status(statusCode).type('text/html').send(errorHtmlContent);
}

interface RouteConfig {
  method: string;
  path: string;
}

interface RoutesFile {
  port: number;
  routes: RouteConfig[];
}

let allRoutes: RouteConfig[] = [];
let currentProxyPort: number | null = null;
let portOnlineStatus: Record<number, boolean> = {};
let isCheckingPort = false;

async function isPortOnline(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.request({ hostname: 'localhost', port, method: 'HEAD', timeout: 500 }, () => {
        req.destroy();
        resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function rebuildActiveRouter() {
  const newRouter = Router();

  if (!currentProxyPort || !portOnlineStatus[currentProxyPort]) {
    activeRoutesRouter = newRouter;
    console.log('[ProxyToServerTS] ✅ Router is active but empty (backend port is offline or not configured).');
    return;
  }

  allRoutes.forEach(route => {
    const method = route.method.trim().toLowerCase();

    if (typeof (newRouter as any)[method] === 'function') {
      (newRouter as any)[method](route.path, (req: Request, res: Response) => {
        const targetPort = currentProxyPort as number;
        const options: http.RequestOptions = {
          hostname: 'localhost',
          port: targetPort,
          path: req.originalUrl,
          method: req.method,
          headers: { ...req.headers, host: `localhost:${targetPort}` }
        };
        
        if (options.headers) {
            const headers = options.headers as http.OutgoingHttpHeaders;
            if (headers.connection) {
                delete headers.connection;
            }
        }

        const backendRequest = http.request(options, backendResponse => {
          if (backendResponse.statusCode && backendResponse.statusCode >= 400) {
            sendErrorHtmlPage(res, backendResponse.statusCode);
            backendResponse.resume();
            return;
          }

          res.writeHead(backendResponse.statusCode || 200, backendResponse.headers);
          backendResponse.pipe(res);
        });

        backendRequest.on('error', (err) => {
          console.error(`[ProxyToServerTS] Backend request error for port ${targetPort}:`, err.message);
          sendErrorHtmlPage(res, 503)
        });
        req.pipe(backendRequest);
      });
    }
  });

  activeRoutesRouter = newRouter;
  console.log(`[ProxyToServerTS] ✅ Router rebuilt successfully for port ${currentProxyPort} with ${allRoutes.length} routes.`);
}

function loadRoutesFromFile() {
  try {
    console.log(`[ProxyToServerTS] Attempting to load routes from ${routesJsonPath}`);
    if (!fs.existsSync(routesJsonPath)) {
      console.warn(`[ProxyToServerTS] 🟡 routes.json not found. Waiting for the file to be created...`);
      if (currentProxyPort !== null) {
          allRoutes = [];
          currentProxyPort = null;
          portOnlineStatus = {};
          rebuildActiveRouter();
      }
      return;
    }

    const content = fs.readFileSync(routesJsonPath, 'utf8');
    const parsed = JSON.parse(content) as RoutesFile;

    if (typeof parsed.port !== 'number') {
        console.error(`[ProxyToServerTS] ❌ 'port' is missing or not a number in routes.json.`);
        currentProxyPort = null;
        allRoutes = [];
        rebuildActiveRouter();
        return;
    }

    if (currentProxyPort !== parsed.port) {
        console.log(`[ProxyToServerTS] Port configuration changed from ${currentProxyPort || 'none'} to ${parsed.port}.`);
        currentProxyPort = parsed.port;
        portOnlineStatus = {};
    }

    if (!Array.isArray(parsed.routes)) {
        console.warn(`[ProxyToServerTS] Invalid format: 'routes' key is not an array.`);
        return;
    }

    allRoutes = parsed.routes.filter(route => {
        if (!route.path || typeof route.path !== 'string' || !route.method) {
            console.warn(`[ProxyToServerTS] Invalid route found (missing path or method). Skipping.`, route);
            return false;
        }
        return true;
    });

    console.log(`[ProxyToServerTS] ✔️ Loaded ${allRoutes.length} routes for port ${currentProxyPort}.`);
    checkPortStatus();

  } catch (err) {
    console.error(`[ProxyToServerTS] ❌ Error loading or parsing routes.json: ${(err as Error).message}`);
    currentProxyPort = null;
    allRoutes = [];
    rebuildActiveRouter();
  }
}

async function checkPortStatus() {
  if (isCheckingPort || currentProxyPort === null) return;
  isCheckingPort = true;

  const portToCheck = currentProxyPort;
  const wasOnline = portOnlineStatus[portToCheck];
  const isOnline = await isPortOnline(portToCheck);
  
  if (wasOnline !== isOnline) {
    console.log(`[ProxyToServerTS] Port ${portToCheck} is now ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
    portOnlineStatus[portToCheck] = isOnline;
    rebuildActiveRouter();
  }

  isCheckingPort = false;
}

function setupWatcherAndInterval() {
  fs.watch(routesJsonDir, { persistent: true }, (eventType, filename) => {
    if (filename === routesJsonFile) {
      console.log(`[ProxyToServerTS] 🔄 Change detected in ${routesJsonFile}. Reloading...`);
      loadRoutesFromFile();
    }
  });

  setInterval(checkPortStatus, 2000);
}

loadRoutesFromFile();
setupWatcherAndInterval();

const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
