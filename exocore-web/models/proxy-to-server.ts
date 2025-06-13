import http from 'http';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');

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
  port?: number;
}

interface RoutesFile {
  routes: RouteConfig[];
}

function loadAndRegisterRoutes() {
  const newRouter = Router();

  try {
    if (fs.existsSync(routesJsonPath)) {
      const routesFileContent = fs.readFileSync(routesJsonPath, 'utf8');
      const routesData = JSON.parse(routesFileContent) as RoutesFile;

      if (routesData && Array.isArray(routesData.routes)) {
        routesData.routes.forEach(route => {
          const method = route.method?.trim().toLowerCase();
          const routePath = route.path;
          const port = route.port;

          if (
            typeof routePath !== 'string' ||
            typeof port !== 'number' ||
            port <= 0 || port >= 65536 ||
            typeof (newRouter as any)[method] !== 'function'
          ) {
            return; // silently skip invalid
          }

          (newRouter as any)[method](routePath, (req: Request, res: Response) => {
            const options: http.RequestOptions = {
              hostname: 'localhost',
              port,
              path: req.originalUrl,
              method: req.method,
              headers: { ...req.headers, 'host': `localhost:${port}` },
            };

            const headersAsRecord = options.headers as Record<string, unknown>;
            delete headersAsRecord['connection'];

            const backendRequest = http.request(options, backendResponse => {
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

            backendRequest.on('error', (error: NodeJS.ErrnoException) => {
              const known = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'];
              sendErrorHtmlPage(res, known.includes(error.code || '') ? 503 : 502);
            });

            req.pipe(backendRequest);
          });
        });
      }
    }
  } catch {
    // silently fail
  }

  activeRoutesRouter = newRouter;
}

loadAndRegisterRoutes();

// Silent watch every 1s
fs.watchFile(routesJsonPath, { interval: 1000 }, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    loadAndRegisterRoutes();
  }
});

// Middleware export
const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
