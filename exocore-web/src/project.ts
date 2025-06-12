// @ts-check

import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { Request, Response, Application } from 'express';
import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';

const TEMPLATE_URL: string = 'https://raw.githubusercontent.com/ChoruTiktokers182/global-exocore/main/template.json';
const configPath: string = path.resolve(__dirname, '../config.json');
const git: SimpleGit = simpleGit();

interface Template {
  id: string;
  name: string;
  description: string;
  git: string;
}

interface ConfigData {
  project?: string;
  [key: string]: any;
}

interface CreateProjectOptions {
  templateId?: string;
  gitUrl?: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

const api = {
  async getTemplates(): Promise<Template[]> {
    try {
      const res: AxiosResponse<Template[]> = await axios.get(TEMPLATE_URL);
      if (Array.isArray(res.data)) {
        return res.data;
      }
      console.warn('Fetched templates data is not an array. Returning empty list.');
      return [];
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch templates:', errMsg);
      return [];
    }
  },

  async updateConfig(projectName: string): Promise<void> {
    console.warn('Updating config with project name:', projectName);
    let config: ConfigData = {};
    try {
      if (await pathExists(configPath)) {
        const configFileContent: string = await fs.promises.readFile(configPath, 'utf-8');
        if (configFileContent.trim() !== '') {
          config = JSON.parse(configFileContent) as ConfigData;
        } else {
          console.warn('config.json was empty. Initializing new config.');
        }
      } else {
        console.warn(`config.json not found at ${configPath}. Initializing new config.`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to read or parse existing config.json from ${configPath}:`, errMsg);
    }

    config.project = `../${projectName}`;

    try {
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      console.warn(`Config updated successfully. Project set to: "${config.project}" in ${configPath}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to write to config.json at ${configPath}:`, errMsg);
    }
  },

  async cloneTemplate(gitUrl: string, targetPath: string): Promise<void> {
    console.warn('Cloning from:', gitUrl, 'to:', targetPath);
    try {
      await git.clone(gitUrl, targetPath);
      console.warn('Clone completed.');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Git clone failed:', error.message, error);
      throw new Error(`Git clone failed: ${error.message}`, { cause: error });
    }
  },

  async checkProjectStatus(): Promise<{ exists: boolean }> {
    console.warn(`Checking project status using config file: ${configPath}`);
    if (!await pathExists(configPath)) {
      console.warn('Config file does not exist.');
      return { exists: false };
    }
    try {
      const configFileContent: string = await fs.promises.readFile(configPath, 'utf-8');
      if (configFileContent.trim() === '') {
        console.warn('Config file is empty.');
        return { exists: false };
      }
      const config: ConfigData = JSON.parse(configFileContent) as ConfigData;

      if (!config.project || typeof config.project !== 'string') {
        console.warn('No project specified in config or project path is invalid.');
        return { exists: false };
      }
      const projectRoot: string = path.dirname(configPath);
      const folder: string = path.resolve(projectRoot, config.project);

      const exists: boolean = await pathExists(folder);
      console.warn('Project status checked. Exists:', exists, 'at path:', folder);
      return { exists };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to read or parse config.json for project status:', errMsg);
      return { exists: false };
    }
  },

  async createProject(projectName: string, { templateId, gitUrl }: CreateProjectOptions): Promise<string> {
    console.warn('Starting project creation for:', projectName);
    if (!projectName || typeof projectName !== 'string' || projectName.trim() === '') {
      throw new Error('Project name is required and must be a non-empty string.');
    }
    if (projectName.includes('/') || projectName.includes('\\') || projectName.includes('..')) {
      throw new Error('Project name contains invalid characters.');
    }

    let cloneUrl: string;

    if (gitUrl && templateId) {
      throw new Error('Please provide either a template ID or a custom Git URL, not both.');
    }

    if (gitUrl) {
      if (typeof gitUrl !== 'string' || gitUrl.trim() === '') {
        throw new Error('Custom Git URL must be a non-empty string.');
      }
      cloneUrl = gitUrl;
    } else if (templateId) {
      if (typeof templateId !== 'string' || templateId.trim() === '') {
        throw new Error('Template ID must be a non-empty string.');
      }
      const templates: Template[] = await api.getTemplates();
      const chosenTemplate: Template | undefined = templates.find((t) => t.id === templateId);
      if (!chosenTemplate) {
        throw new Error(`Template with ID "${templateId}" not found.`);
      }
      cloneUrl = chosenTemplate.git;
    } else {
      throw new Error('Missing template ID or custom Git URL. Please provide one.');
    }

    const projectBasePath: string = path.resolve(__dirname, '../..');
    const projectPath: string = path.join(projectBasePath, projectName);

    if (await pathExists(projectPath)) {
      throw new Error(`Project folder "${projectName}" already exists at ${projectPath}`);
    }

    console.warn(`Cloning repository from ${cloneUrl} to ${projectPath}...`);
    await api.cloneTemplate(cloneUrl, projectPath);

    console.warn('Updating config after cloning...');
    await api.updateConfig(projectName);

    return `Project "${projectName}" created successfully at ${projectPath}`;
  },
};

interface ProjectRouteParams {
  req: Request;
  res: Response;
  app?: Application;
  wss?: WebSocketServer;
  wssConsole?: WebSocketServer;
  Shellwss?: WebSocketServer;
  server?: HttpServer;
}

interface ProjectExpressRouteModule {
  method: "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all";
  path: string;
  install: (params: any) => Promise<void> | void;
}

interface CreateProjectRequestBody {
    name: string;
    template?: string;
    gitUrl?: string;
}

export const modules: ProjectExpressRouteModule[] = [
  {
    method: 'post',
    path: '/templates',
    install: async ({ res }: Pick<ProjectRouteParams, 'res'>): Promise<void> => {
      try {
        const templates: Template[] = await api.getTemplates();
        res.json(templates);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error in /templates route:', error.message, error);
        res.status(500).json({ error: 'Failed to fetch templates.' });
      }
    },
  },
  {
    method: 'post',
    path: '/project',
    install: async ({ req, res }: Pick<ProjectRouteParams, 'req' | 'res'>): Promise<void> => {
      const { name, template, gitUrl } = req.body as CreateProjectRequestBody;
      try {
        if (typeof name !== 'string' || !name.trim()) {
          res.status(400).json({ error: 'Project name is required.' });
          return;
        }
        const message: string = await api.createProject(name, { templateId: template, gitUrl });
        res.status(201).json({ success: true, message, projectPath: name });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error in /project route:', error.message, error);
        res.status(400).json({ success: false, error: error.message || 'Unknown error during project creation.' });
      }
    },
  },
  {
    method: 'post',
    path: '/project/status',
    install: async ({ res }: Pick<ProjectRouteParams, 'res'>): Promise<void> => {
      try {
        const status: { exists: boolean } = await api.checkProjectStatus();
        res.json(status);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error in /project/status route:', error.message, error);
        res.status(500).json({ error: 'Failed to check project status.' });
      }
    },
  },
];
