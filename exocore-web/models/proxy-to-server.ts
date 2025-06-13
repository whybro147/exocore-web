import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');
const checkInterval = 1000;

let activeRoutesRouter = Router();
let routeStates: Record<string, boolean> = {}; // status ng bawat route by key
let allRoutes: RouteConfig[] = [];

interface RouteConfig {
  method: string;
  path: string;
  port: number;
}

const errorHtmlContent = `<!DOCTYPE html>
<html><head><title>Service Unavailable</title></head><body>
<h1>Service Temporarily Unavailable</h1>
<p>The service you're trying to reach is currently unavailable.</p>
</body></html>`;

function sendErrorHtmlPage(res: Response, statusCode = 502) {
  if (!res.headersSent) {
    res.status(statusCode).type('text/html').send(errorHtmlContent);
  }
}

function isPortOnline(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// ✅ Setup proxy handler per route
function createHandler(port: number) {
  return (req: Request, res: Response) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: req.originalUrl,
      method: req.method,
      headers: { ...req.headers },
    };

    const proxy = http.request(options, backendResponse => {
      if (backendResponse.statusCode && backendResponse.statusCode >= 400) {
        sendErrorHtmlPage(res, backendResponse.statusCode);
        backendResponse.resume();
        return;
      }

      Object.entries(backendResponse.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, value as string);
        }
      });

      res.status(backendResponse.statusCode || 200);
      backendResponse.pipe(res);
    });

    proxy.on('error', () => sendErrorHtmlPage(res, 503));
    req.pipe(proxy);
  };
}

function loadRoutesFile(): RouteConfig[] {
  try {
    const data = fs.readFileSync(routesJsonPath, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.routes || [];
  } catch {
    return [];
  }
}

// 🔁 Rebuild router from online routes
function rebuildActiveRouter() {
  const router = Router();
  for (const route of allRoutes) {
    const key = `${route.method}:${route.path}:${route.port}`;
    if (routeStates[key]) {
      (router as any)[route.method.toLowerCase()](route.path, createHandler(route.port));
    }
  }
  activeRoutesRouter = router;
}

// 🔎 Check ports and update activeRoutes
async function checkAllPorts() {
  const updates: Record<string, boolean> = {};
  for (const route of allRoutes) {
    const key = `${route.method}:${route.path}:${route.port}`;
    const isOnline = await isPortOnline(route.port);
    updates[key] = isOnline;
  }

  const changed = JSON.stringify(updates) !== JSON.stringify(routeStates);
  routeStates = updates;

  if (changed) rebuildActiveRouter();
}

// 👂 Watch routes.json changes (live!)
fs.watch(routesJsonPath, () => {
  allRoutes = loadRoutesFile();
  checkAllPorts(); // check on change din
});

// ⏱ Start interval checker
setInterval(checkAllPorts, checkInterval);

// 🔁 Main middleware
const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
