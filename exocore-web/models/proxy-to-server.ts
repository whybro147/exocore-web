import http from 'http';
import fs from 'fs'; 
import path from 'path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');

let activeRoutesRouter = Router();

const errorHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Unavailable</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 40px; background-color: #f4f4f4; color: #333; margin: 0; }
        .container { background-color: #fff; border-radius: 8px; box-shadow: 0 0 15px rgba(0,0,0,0.1); padding: 30px; display: inline-block; max-width: 600px; }
        h1 { color: #e74c3c; font-size: 2.5em; margin-bottom: 0.5em; }
        p { font-size: 1.1em; line-height: 1.6; }
        .footer-text { font-size: 0.9em; color: #777; margin-top: 25px; }
        .emoji { font-size: 3em; display: block; margin-bottom: 0.3em; }
    </style>
</head>
<body>
    <div class="container">
        <span class="emoji">🚧</span>
        <h1>Service Is Not Online</h1>
        <p>We apologize for the inconvenience, but the backend service (server) is currently unavailable or experiencing issues.</p>
        <p>Our team is working to resolve this. Please try refreshing the page in a few moments.</p>
        <p class="footer-text">If you are the site administrator, please check the status of the service running on port 3000.</p>
    </div>
</body>
</html>`;

function sendErrorHtmlPage(res: Response, statusCode: number = 502) {
  if (res.headersSent) {
    return;
  }
  res.status(statusCode).type('text/html').send(errorHtmlContent);
}

interface RouteConfig {
  method: string;
  path: string;
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

          if (!routePath || typeof routePath !== 'string') {
            console.warn(`[ProxyToServerTS] Invalid or missing path for method ${route.method} in routes.json. Skipping.`);
            return;
          }

          if (typeof (newRouter as any)[method] === 'function') {
            (newRouter as any)[method](routePath, (req: Request, res: Response) => {
              const backendRequestPath = req.originalUrl;
              const options: http.RequestOptions = {
                hostname: 'localhost',
                port: 3000,
                path: backendRequestPath,
                method: req.method,
                headers: { ...req.headers, 'host': 'localhost:3000' },
              };

              if (options.headers) {
                const headersAsRecord = options.headers as Record<string, unknown>;
                if (headersAsRecord['connection']) {
                  delete headersAsRecord['connection'];
                }
              }

              const backendRequest = http.request(options, (backendResponse) => {
                if (backendResponse.statusCode && backendResponse.statusCode >= 400) {
                  sendErrorHtmlPage(res, backendResponse.statusCode);
                  backendResponse.resume();
                  return;
                }
                Object.keys(backendResponse.headers).forEach(key => {
                  const headerValue = backendResponse.headers[key];
                  if (headerValue) {
                    if (key.toLowerCase() !== 'transfer-encoding' || headerValue?.toString().toLowerCase() !== 'chunked') {
                        res.setHeader(key, headerValue);
                    }
                  }
                });
                res.status(backendResponse.statusCode || 200);
                backendResponse.pipe(res);
              });

              backendRequest.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                  sendErrorHtmlPage(res, 503);
                } else {
                  sendErrorHtmlPage(res);
                }
              });
              req.pipe(backendRequest);
            });
            routesLoaded = true;
          } else {
            console.warn(`[ProxyToServerTS] Unsupported HTTP method "${method}" for path "${routePath}" found in routes.json. Skipping.`);
          }
        });
        if (routesLoaded) {
            console.log(`[ProxyToServerTS] ${routesData.routes.length} proxy routes reloaded from routes.json at ${new Date().toLocaleTimeString()}`);
        } else if (routesData.routes.length === 0) {
             console.log(`[ProxyToServerTS] routes.json is empty. No proxy routes loaded at ${new Date().toLocaleTimeString()}`);
        } else {
            console.warn(`[ProxyToServerTS] No valid routes found to load from routes.json at ${new Date().toLocaleTimeString()}`);
        }
      } else {
        console.warn(`[ProxyToServerTS] Malformed routes.json: 'routes' array not found or not an array. No dynamic proxy routes loaded.`);
      }
    } else {
      console.warn(`[ProxyToServerTS] routes.json not found at ${routesJsonPath} during reload attempt. Waiting for file...`);
    }
  } catch (err) {
    const error = err as Error;
    console.error(`[ProxyToServerTS] CRITICAL ERROR processing routes.json: ${error.message}. No dynamic proxy routes loaded.`);
  }
  activeRoutesRouter = newRouter;
}

loadAndRegisterRoutes();

if (fs.existsSync(routesJsonPath)) {
    fs.watchFile(routesJsonPath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
            console.log(`[ProxyToServerTS] Detected change in routes.json. Reloading routes...`);
            loadAndRegisterRoutes();
        }
    });
} else {
    const checkInterval = setInterval(() => {
        if (fs.existsSync(routesJsonPath)) {
            console.log(`[ProxyToServerTS] routes.json has appeared. Initializing watch and loading routes.`);
            clearInterval(checkInterval);
            loadAndRegisterRoutes();
            fs.watchFile(routesJsonPath, { interval: 1000 }, (curr, prev) => {
                if (curr.mtime !== prev.mtime) {
                    console.log(`[ProxyToServerTS] Detected change in routes.json. Reloading routes...`);
                    loadAndRegisterRoutes();
                }
            });
        }
    }, 5000);
}

const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
