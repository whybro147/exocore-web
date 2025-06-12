// @ts-check

import fs from 'fs';
import path from 'path'; 
import { Request, Response, Application } from 'express';
import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';

interface LogoutRouteParams {
  req: Request;
  res: Response;
  app?: Application;
  wss?: WebSocketServer;
  wssConsole?: WebSocketServer;
  Shellwss?: WebSocketServer;
  server?: HttpServer;
}

interface LogoutExpressRouteModule {
  method: "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all";
  path: string;
  install: (params: Pick<LogoutRouteParams, 'req' | 'res'>) => Promise<void> | void;
}

const ACC_FILE_PATH: string = path.resolve(__dirname, '../models/data/acc.json');
const ACC_DIR_PATH: string = path.dirname(ACC_FILE_PATH);

export const modules: LogoutExpressRouteModule[] = [
  {
    method: 'post',
    path: '/logout',
    install: async ({ req, res }: Pick<LogoutRouteParams, 'req' | 'res'>): Promise<void> => {
      const html: string = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">  
  <title>Logout</title>
  <script>
    localStorage.removeItem("exocore-token");
    localStorage.removeItem("exocore-cookies");
    // Optional: Redirect after clearing localStorage
    // window.location.href = '/login'; // Or your desired redirect path
  </script>
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <p>You have been logged out. localStorage items 'exocore-token' and 'exocore-cookies' have been cleared.</p>
  <pre>{
  "status": "success"
}</pre>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html); 

      try {
        if (!fs.existsSync(ACC_DIR_PATH)) {
          await fs.promises.mkdir(ACC_DIR_PATH, { recursive: true });
        }
        await fs.promises.writeFile(ACC_FILE_PATH, JSON.stringify({}, null, 2));
      } catch (fileError: unknown) {
        const errMsg = fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`Failed to clear or write acc.json during logout: ${errMsg}`, fileError);
      }
    },
  },
];
