// @ts-check

import fsPromises from 'fs/promises';
import path from 'path';
import { Request, Response } from 'express';

interface LoginClientRequestBody {
  user: string;
  pass: string;
}

function isLoginClientRequestBody(body: any): body is LoginClientRequestBody {
  return (body && typeof body === 'object' &&
            typeof body.user === 'string' && body.user.length > 0 &&
            typeof body.pass === 'string' && body.pass.length > 0);
}

interface LoginRouteParams {
  req: Request<any, any, unknown>;
  res: Response;
}

interface ConfigData {
  user: string;
  pass: string;
  [key: string]: any;
}

interface PanelExpressRouteModule {
  method: 'post';
  path: string;
  install: (params: LoginRouteParams) => Promise<void>;
}

export const modules: PanelExpressRouteModule[] = [
  {
    method: 'post',
    path: '/panel',
    install: async ({ req, res }: LoginRouteParams): Promise<void> => {
      const requestBody: unknown = req.body;

      // DEBUG: Log the raw request body
      console.log('[Panel Login] Raw request body:', JSON.stringify(requestBody));

      if (!isLoginClientRequestBody(requestBody)) {
        res.status(400).json({
          message: 'Invalid request payload. "user" and "pass" are required and must be non-empty strings.',
          status: 'error',
        });
        return;
      }

      const { user: clientUser, pass: clientPass } = requestBody;

      // DEBUG: Log received client credentials (use quotes to see whitespace)
      console.log(`[Panel Login] Received from client - User: "${clientUser}", Pass: "${clientPass}"`);

      const relativeConfigPath = '../../config.json';
      let configPath: string;

      if (typeof __dirname !== 'undefined') {
        configPath = path.resolve(__dirname, relativeConfigPath);
      } else {
        console.warn(
          `[Panel Login] Warning: __dirname is not defined (standard in ES Modules). ` +
          `Resolving config path "${relativeConfigPath}" relative to current working directory: ${process.cwd()}. ` +
          `For robust file-relative paths in ES modules, the standard approach uses import.meta.url.`
        );
        configPath = path.resolve(process.cwd(), relativeConfigPath);
      }

      // DEBUG: Log the resolved config path
      console.log(`[Panel Login] Attempting to load config from: "${configPath}"`);

      try {
        const configFileContent: string = await fsPromises.readFile(configPath, 'utf-8');
        const config: ConfigData = JSON.parse(configFileContent);

        // DEBUG: Log credentials loaded from config.json (use quotes to see whitespace)
        if (config.user && config.pass) {
            console.log(`[Panel Login] Loaded from config.json - User: "${config.user}", Pass: "${config.pass}"`);
        } else {
            console.log('[Panel Login] Loaded from config.json - "user" or "pass" field is missing or not a string.');
        }


        if (typeof config.user !== 'string' || typeof config.pass !== 'string') {
          console.error(`[Panel Login] Invalid config.json structure at "${configPath}". "user" and "pass" must be strings.`);
          res.status(500).json({
            message: 'Server configuration error: Invalid config file structure.',
            status: 'error',
          });
          return;
        }

        if (clientUser === config.user && clientPass === config.pass) {
          console.log('[Panel Login] Credentials MATCHED!'); // DEBUG
          res.status(200).json({
            message: 'Login successful!',
            status: 'success',
          });
          return;
        } else {
          console.log('[Panel Login] Credentials DID NOT MATCH.'); // DEBUG
          console.log(`Comparison details: Client User ("${clientUser}") === Config User ("${config.user}") -> ${clientUser === config.user}`);
          console.log(`Comparison details: Client Pass ("${clientPass}") === Config Pass ("${config.pass}") -> ${clientPass === config.pass}`);
          res.status(401).json({
            message: 'Invalid username or password.',
            status: 'failed',
          });
          return;
        }
      } catch (error: unknown) {
        console.error(`[Panel Login] Error during login process for config path "${configPath}":`, error instanceof Error ? error.message : String(error));
        // ... (rest of your error handling) ...
        if (error instanceof SyntaxError) {
          res.status(500).json({
            message: `Server configuration error: Malformed config file at "${configPath}". Please ensure it is valid JSON.`,
            status: 'error',
          });
          return;
        }

        if (error instanceof Error && 'code' in error) {
          const errnoError = error as NodeJS.ErrnoException;
          if (errnoError.code === 'ENOENT') {
            res.status(500).json({
              message: `Server configuration error: Config file not found at "${configPath}". Please ensure the path is correct.`,
              status: 'error',
            });
            return;
          }
        }

        res.status(500).json({
          message: 'An internal server error occurred during login.',
          status: 'error',
        });
        return;
      }
    },
  },
];
