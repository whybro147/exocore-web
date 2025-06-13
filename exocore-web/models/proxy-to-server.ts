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
  port: number;
}

interface RoutesFile {
  routes: RouteConfig[];
}

let allRoutes: RouteConfig[] = [];
let portOnlineStatus: Record<number, boolean> = {};
let isCheckingPorts = false;

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

  allRoutes.forEach(route => {
    if (!portOnlineStatus[route.port]) {
      return;
    }

    const method = route.method.trim().toLowerCase();

    if (typeof (newRouter as any)[method] === 'function') {
      (newRouter as any)[method](route.path, (req: Request, res: Response) => {
        const options: http.RequestOptions = {
          hostname: 'localhost',
          port: route.port,
          path: req.originalUrl,
          method: req.method,
          headers: { ...req.headers, host: `localhost:${route.port}` }
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
          console.error(`[ProxyToServerTS] Backend request error for port ${route.port}:`, err.message);
          sendErrorHtmlPage(res, 503)
        });
        req.pipe(backendRequest);
      });
    }
  });

  activeRoutesRouter = newRouter;
  console.log('[ProxyToServerTS] ✅ Router rebuilt successfully.');
}

function loadRoutesFromFile() {
  try {
    console.log(`[ProxyToServerTS] Attempting to load routes from ${routesJsonPath}`);
    if (!fs.existsSync(routesJsonPath)) {
      console.warn(`[ProxyToServerTS] 🟡 routes.json not found. Waiting for the file to be created...`);
      allRoutes = [];
      portOnlineStatus = {};
      rebuildActiveRouter();
      return;
    }

    const content = fs.readFileSync(routesJsonPath, 'utf8');
    const parsed = JSON.parse(content) as RoutesFile;

    if (!Array.isArray(parsed.routes)) {
        console.warn(`[ProxyToServerTS] Invalid format: 'routes' key is not an array.`);
        return;
    }

    allRoutes = parsed.routes.map(route => ({
        method: (route.method || '').toLowerCase(),
        path: route.path,
        port: route.port || 3000,
    })).filter(route => {
        if (!route.path || typeof route.path !== 'string' || !route.method) {
            console.warn(`[ProxyToServerTS] Invalid route found (missing path or method). Skipping.`, route);
            return false;
        }
        return true;
    });

    console.log(`[ProxyToServerTS] ✔️ Loaded ${allRoutes.length} routes from file.`);
    checkAllPorts();

  } catch (err) {
    console.error(`[ProxyToServerTS] ❌ Error loading or parsing routes.json: ${(err as Error).message}`);
    allRoutes = [];
    rebuildActiveRouter();
  }
}

async function checkAllPorts() {
  if (isCheckingPorts) return;
  isCheckingPorts = true;

  const uniquePorts = [...new Set(allRoutes.map(route => route.port))];
  let hasStateChanged = false;
  
  const newPortStatus: Record<number, boolean> = {};

  await Promise.all(uniquePorts.map(async (port) => {
    const isOnline = await isPortOnline(port);
    newPortStatus[port] = isOnline;

    if (portOnlineStatus[port] !== isOnline) {
      console.log(`[ProxyToServerTS] Port ${port} is now ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
      hasStateChanged = true;
    }
  }));

  if (Object.keys(portOnlineStatus).length !== Object.keys(newPortStatus).length) {
    hasStateChanged = true;
  }

  portOnlineStatus = newPortStatus;
  
  if (hasStateChanged) {
    console.log('[ProxyToServerTS] Port status changed. Rebuilding router...');
    rebuildActiveRouter();
  }

  isCheckingPorts = false;
}

function setupWatcherAndInterval() {
  fs.watch(routesJsonDir, { persistent: true }, (eventType, filename) => {
    if (filename === routesJsonFile) {
      console.log(`[ProxyToServerTS] 🔄 Change detected in ${routesJsonFile}. Reloading...`);
      loadRoutesFromFile();
    }
  });

  setInterval(checkAllPorts, 2000);
}

loadRoutesFromFile();
setupWatcherAndInterval();

const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
