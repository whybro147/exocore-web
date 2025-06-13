import http from 'http';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const routesJsonPath = path.join(__dirname, 'routes.json');
const routesJsonFile = path.basename(routesJsonPath);
const routesJsonDir = path.dirname(routesJsonPath);

let activeRoutesRouter = Router();

// --- Error Page ---
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

// --- Type Definitions ---
interface RouteConfig {
  method: string;
  path: string;
  port: number; // port is now non-optional
}

interface RoutesFile {
  routes: RouteConfig[];
}

// --- State Management ---
let allRoutes: RouteConfig[] = [];
let portOnlineStatus: Record<number, boolean> = {};
let isCheckingPorts = false;

// --- Core Functions ---

/**
 * Checks if a given port on localhost is responsive.
 */
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

/**
 * Rebuilds the active Express router based on the current online status of ports.
 */
function rebuildActiveRouter() {
  const newRouter = Router();

  allRoutes.forEach(route => {
    // Only add route if its corresponding port is online
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
        
        // The 'connection' header is deprecated and can cause issues with proxies.
        if (options.headers?.connection) {
            delete options.headers.connection;
        }

        const backendRequest = http.request(options, backendResponse => {
          if (backendResponse.statusCode && backendResponse.statusCode >= 400) {
            sendErrorHtmlPage(res, backendResponse.statusCode);
            backendResponse.resume(); // Consume response data to free up memory
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

/**
 * Loads and validates routes from the routes.json file.
 * Triggers a port check and router rebuild upon successful load.
 */
function loadRoutesFromFile() {
  try {
    console.log(`[ProxyToServerTS] Attempting to load routes from ${routesJsonPath}`);
    if (!fs.existsSync(routesJsonPath)) {
      console.warn(`[ProxyToServerTS] 🟡 routes.json not found. Waiting for the file to be created...`);
      allRoutes = [];
      portOnlineStatus = {};
      rebuildActiveRouter(); // Rebuild with empty routes
      return;
    }

    const content = fs.readFileSync(routesJsonPath, 'utf8');
    const parsed = JSON.parse(content) as RoutesFile;

    if (!Array.isArray(parsed.routes)) {
        console.warn(`[ProxyToServerTS] Invalid format: 'routes' key is not an array.`);
        return;
    }

    // Filter and map routes, ensuring they are valid
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
    // Immediately check ports and rebuild the router with the new configuration
    checkAllPorts();

  } catch (err) {
    console.error(`[ProxyToServerTS] ❌ Error loading or parsing routes.json: ${(err as Error).message}`);
    // Clear routes if file is corrupt to prevent crashes
    allRoutes = [];
    rebuildActiveRouter();
  }
}

/**
 * Checks the status of all unique ports defined in the routes.
 * Rebuilds the router if any port's status has changed.
 */
async function checkAllPorts() {
  if (isCheckingPorts) return; // Prevent concurrent checks
  isCheckingPorts = true;

  const uniquePorts = [...new Set(allRoutes.map(route => route.port))];
  let hasStateChanged = false;
  
  const newPortStatus: Record<number, boolean> = {};

  // Check all unique ports concurrently for better performance
  await Promise.all(uniquePorts.map(async (port) => {
    const isOnline = await isPortOnline(port);
    newPortStatus[port] = isOnline;

    if (portOnlineStatus[port] !== isOnline) {
      console.log(`[ProxyToServerTS] Port ${port} is now ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
      hasStateChanged = true;
    }
  }));

  // Also detect if a port was removed from the config
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

/**
 * Sets up the file watcher and the periodic port check interval.
 */
function setupWatcherAndInterval() {
  // Watch the DIRECTORY for changes to handle file creation/deletion
  fs.watch(routesJsonDir, { persistent: true }, (eventType, filename) => {
    // Check if the change is related to our routes.json file
    if (filename === routesJsonFile) {
      console.log(`[ProxyToServerTS] 🔄 Change detected in ${routesJsonFile}. Reloading...`);
      loadRoutesFromFile();
    }
  });

  setInterval(checkAllPorts, 2000); // Check every 2 seconds to reduce load
}

// --- Initial Execution ---
loadRoutesFromFile();
setupWatcherAndInterval();

// --- Middleware Export ---
const mainProxyRouter = Router();
mainProxyRouter.use((req: Request, res: Response, next: NextFunction) => {
  activeRoutesRouter(req, res, next);
});

export { mainProxyRouter as serverProxy };
