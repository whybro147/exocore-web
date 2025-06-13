import http from 'http';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');

let activeRoutesRouter = Router();

const errorHtmlContent = `<!DOCTYPE html>...`; // unchanged for brevity

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

function loadAndRegisterRoutes() {
  const newRouter = Router();
  let routesLoaded = false;

  try {
    if (fs.existsSync(routesJsonPath)) {
      const routesFileContent = fs.readFileSync(routesJsonPath, 'utf8');
      const routesData = JSON.parse(routesFileContent) as RoutesFile;

      if (routesData && Array.isArray(routesData.routes)) {
        routesData.routes.forEach(route => {
          const method = route.method.trim().toLowerCase();
          const routePath = route.path;
          const port = route.port || 3000; // ✅ fallback to 3000 if not specified

          if (!routePath || typeof routePath !== 'string') {
            console.warn(`[ProxyToServerTS] Invalid path for method ${route.method}. Skipping.`);
            return;
          }

          if (typeof (newRouter as any)[method] === 'function') {
            (newRouter as any)[method](routePath, (req: Request, res: Response) => {
              const backendRequestPath = req.originalUrl;
              const options: http.RequestOptions = {
                hostname: 'localhost',
                port, // ✅ use dynamic port
                path: backendRequestPath,
                method: req.method,
                headers: { ...req.headers, 'host': `localhost:${port}` },
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

              backendRequest.on('error', (error: NodeJS.ErrnoException) => {
                if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code || '')) {
                  sendErrorHtmlPage(res, 503);
                } else {
                  sendErrorHtmlPage(res);
                }
              });

              req.pipe(backendRequest);
            });

            routesLoaded = true;
          } else {
            console.warn(`[ProxyToServerTS] Unsupported HTTP method "${method}" for path "${routePath}".`);
          }
        });

        if (routesLoaded) {
          console.log(`[ProxyToServerTS] ${routesData.routes.length} routes loaded at ${new Date().toLocaleTimeString()}`);
        } else {
          console.warn(`[ProxyToServerTS] No valid routes loaded.`);
        }
      } else {
        console.warn(`[ProxyToServerTS] Malformed routes.json.`);
      }
    } else {
      console.warn(`[ProxyToServerTS] routes.json not found at ${routesJsonPath}`);
    }
  } catch (err) {
    console.error(`[ProxyToServerTS] Error loading routes: ${(err as Error).message}`);
  }

  activeRoutesRouter = newRouter;
}

loadAndRegisterRoutes();

// ✅ File watch for changes
if (fs.existsSync(routesJsonPath)) {
  fs.watchFile(routesJsonPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log(`[ProxyToServerTS] routes.json changed. Reloading...`);
      loadAndRegisterRoutes();
    }
  });
} else {
  const checkInterval = setInterval(() => {
    if (fs.existsSync(routesJsonPath)) {
      clearInterval(checkInterval);
      console.log(`[ProxyToServerTS] routes.json appeared. Watching and loading...`);
      loadAndRegisterRoutes();
      fs.watchFile(routesJsonPath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`[ProxyToServerTS] Detected change. Reloading routes...`);
          loadAndRegisterRoutes();
        }
      });
    }
  }, 5000);
}

// ✅ Middleware export
const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
