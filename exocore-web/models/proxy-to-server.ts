import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');
const checkInterval = 1000;

let activeRoutesRouter = Router();

const errorHtmlContent = `<!DOCTYPE html>
<html>
<head><title>Service Unavailable</title></head>
<body>
  <h1>Service Temporarily Unavailable</h1>
  <p>The service you're trying to reach is currently unavailable.</p>
</body>
</html>`;

function sendErrorHtmlPage(res: Response, statusCode: number = 502) {
  if (!res.headersSent) {
    res.status(statusCode).type('text/html').send(errorHtmlContent);
  }
}

interface RouteConfig {
  method: string;
  path: string;
  port: number;
}

interface RoutesFile {
  routes: RouteConfig[];
}

// 🧠 Check if a port is available by trying to connect
function isPortOnline(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

let currentRoutes: RouteConfig[] = [];

function refreshActiveRouter() {
  const newRouter = Router();

  currentRoutes.forEach(route => {
    const method = route.method.toLowerCase();
    const port = route.port;
    const routePath = route.path;

    (newRouter as any)[method](routePath, (req: Request, res: Response) => {
      const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, 'host': `localhost:${port}` },
      };

      const headersAsRecord = options.headers as Record<string, unknown>;
      delete headersAsRecord['connection'];

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
    });
  });

  activeRoutesRouter = newRouter;
}

async function scanRoutes() {
  try {
    if (!fs.existsSync(routesJsonPath)) return;

    const data = fs.readFileSync(routesJsonPath, 'utf8');
    const { routes = [] }: RoutesFile = JSON.parse(data);

    const validRoutes: RouteConfig[] = [];

    for (const route of routes) {
      if (
        typeof route.method !== 'string' ||
        typeof route.path !== 'string' ||
        typeof route.port !== 'number'
      ) continue;

      const isOnline = await isPortOnline(route.port);
      if (isOnline) validRoutes.push(route); // Add only if port is online
    }

    // If new route list differs, update
    const newKey = JSON.stringify(validRoutes);
    const oldKey = JSON.stringify(currentRoutes);
    if (newKey !== oldKey) {
      currentRoutes = validRoutes;
      refreshActiveRouter();
    }
  } catch {
    // Silent fail
  }
}

// ⏱️ Every second, check for new ports online
setInterval(scanRoutes, checkInterval);

// ⛓ Middleware to proxy to currently active routes
const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
