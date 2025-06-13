import http from 'http';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');

let activeRoutesRouter = Router();

const errorHtmlContent = `<!DOCTYPE html>
<html><head><title>Server Error</title></head>
<body style="font-family: sans-serif; text-align: center; margin-top: 10%;">
  <h1>502 Bad Gateway</h1>
  <p>The backend service appears to be offline.</p>
</body></html>`;

function sendErrorHtmlPage(res: Response, statusCode: number = 502) {
  if (res.headersSent) return;
  res.status(statusCode).type('text/html').send(errorHtmlContent);
}

interface RouteConfig {
  method: string;
  path: string;
  port?: number;
}

interface RoutesFile {
  routes: RouteConfig[];
}

let allRoutes: RouteConfig[] = [];
let routeStates: Record<string, boolean> = {};

async function isPortOnline(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.request({ hostname: 'localhost', port, method: 'HEAD', timeout: 500 }, res => {
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
    const key = `${route.method}:${route.path}:${route.port}`;
    const isOnline = routeStates[key];
    if (!isOnline) return;

    const method = route.method.trim().toLowerCase();
    const routePath = route.path;
    const port = route.port || 3000;

    if (typeof (newRouter as any)[method] === 'function') {
      (newRouter as any)[method](routePath, (req: Request, res: Response) => {
        const options: http.RequestOptions = {
          hostname: 'localhost',
          port,
          path: req.originalUrl,
          method: req.method,
          headers: { ...req.headers, host: `localhost:${port}` }
        };

        if (options.headers) {
          const headersAsRecord = options.headers as Record<string, unknown>;
          if (headersAsRecord['connection']) {
            delete headersAsRecord['connection'];
          }
        }

        const backendRequest = http.request(options, backendResponse => {
          if (backendResponse.statusCode && backendResponse.statusCode >= 400) {
            sendErrorHtmlPage(res, backendResponse.statusCode);
            backendResponse.resume();
            return;
          }

          Object.entries(backendResponse.headers).forEach(([key, value]) => {
            if (key.toLowerCase() !== 'transfer-encoding' || value?.toString().toLowerCase() !== 'chunked') {
              res.setHeader(key, value as string);
            }
          });

          res.status(backendResponse.statusCode || 200);
          backendResponse.pipe(res);
        });

        backendRequest.on('error', () => sendErrorHtmlPage(res, 503));
        req.pipe(backendRequest);
      });
    }
  });

  activeRoutesRouter = newRouter;
}

function loadRoutesFromFile() {
  try {
    if (fs.existsSync(routesJsonPath)) {
      const content = fs.readFileSync(routesJsonPath, 'utf8');
      const parsed = JSON.parse(content) as RoutesFile;

      if (Array.isArray(parsed.routes)) {
        allRoutes = parsed.routes.map(route => {
          const port = route.port || 3000;
          const method = route.method?.toLowerCase();
          const path = route.path;
          if (!path || typeof path !== 'string' || !method) {
            console.warn(`[ProxyToServerTS] Invalid path or method. Skipping.`);
            return null;
          }
          return { method, path, port };
        }).filter(Boolean) as RouteConfig[];
      }
    }
  } catch (err) {
    console.error(`[ProxyToServerTS] Error loading routes.json: ${(err as Error).message}`);
  }
}

async function checkAllPorts() {
  let changed = false;

  for (const route of allRoutes) {
    const key = `${route.method}:${route.path}:${route.port}`;
    const wasOnline = routeStates[key];
    const isOnline = await isPortOnline(route.port!);

    if (wasOnline !== isOnline) {
      console.log(`[ProxyToServerTS] ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'} ${route.method.toUpperCase()} ${route.path} (port ${route.port})`);
      changed = true;
    }

    routeStates[key] = isOnline;
  }

  if (changed) rebuildActiveRouter();
}

function setupWatcherAndInterval() {
  if (fs.existsSync(routesJsonPath)) {
    fs.watch(routesJsonPath, { persistent: true }, () => {
      console.log('[ProxyToServerTS] Detected change in routes.json. Reloading...');
      loadRoutesFromFile();
    });
  }

  setInterval(() => {
    checkAllPorts();
  }, 1000); // check every 1s
}

// Initial load
loadRoutesFromFile();
checkAllPorts();
setupWatcherAndInterval();

// Middleware export
const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
