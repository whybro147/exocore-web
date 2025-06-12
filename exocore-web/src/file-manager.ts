import fs from 'fs';
import path from 'path';
import archiver, { ArchiverError } from 'archiver';
import multer, { Multer } from 'multer';
import extract from 'extract-zip';
import yauzl, { Options as YauzlOptions, ZipFile as YauzlZipFile, Entry as YauzlEntry } from 'yauzl';
import { Request, Response, Application, RequestHandler } from 'express';

const configJsonPath: string = path.resolve(__dirname, '../config.json');
const UPLOAD_TEMP_DIR: string = path.resolve(__dirname, '../upload_temp');

let currentProjectPathFromConfig: string = '';
let currentBaseDir: string = '';

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirExists(dirPath: string): Promise<void> {
  if (dirPath && !(await pathExists(dirPath))) {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
}

ensureDirExists(UPLOAD_TEMP_DIR).catch(err => {
  console.error("FATAL: Failed to create UPLOAD_TEMP_DIR on startup:", err);
});

interface AppConfig {
  project?: string;
  [key: string]: any;
}

function updatePathsFromConfig(): boolean {
  const oldRawProjectPath = currentProjectPathFromConfig;
  const oldBaseDir = currentBaseDir;
  const wasPreviouslyValid = oldBaseDir !== '';

  let newRawProjectPathCandidate: string = '';
  let newResolvedBaseDirCandidate: string = '';
  let isNowValidConfig: boolean = false;

  try {
    if (!fs.existsSync(configJsonPath)) {
      newRawProjectPathCandidate = '';
      newResolvedBaseDirCandidate = '';
      isNowValidConfig = false;
    } else {
      const rawConfigData: string = fs.readFileSync(configJsonPath, 'utf-8');
      if (rawConfigData.trim() === '') {
        newRawProjectPathCandidate = '';
        newResolvedBaseDirCandidate = '';
        isNowValidConfig = false;
      } else {
        const parsedConfig: AppConfig = JSON.parse(rawConfigData);
        if (parsedConfig && typeof parsedConfig.project === 'string') {
          newRawProjectPathCandidate = parsedConfig.project;
          const trimmedProjectPath: string = parsedConfig.project.trim();
          if (trimmedProjectPath !== '') {
            const configJsonDir: string = path.dirname(configJsonPath);
            newResolvedBaseDirCandidate = path.resolve(configJsonDir, trimmedProjectPath);
            isNowValidConfig = true;
          } else {
            newResolvedBaseDirCandidate = '';
            isNowValidConfig = false;
          }
        } else {
          newRawProjectPathCandidate = '';
          newResolvedBaseDirCandidate = '';
          isNowValidConfig = false;
        }
      }
    }
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ConfigMonitor] ERROR reading/parsing ${configJsonPath}: ${errMsg}`);
    newRawProjectPathCandidate = '';
    newResolvedBaseDirCandidate = '';
    isNowValidConfig = false;
  }

  currentProjectPathFromConfig = newRawProjectPathCandidate;
  currentBaseDir = isNowValidConfig ? newResolvedBaseDirCandidate : '';

  if (isNowValidConfig) {
    if (!wasPreviouslyValid) {
      console.log(`[ConfigMonitor] PROJECT LOADED: Project path "${currentProjectPathFromConfig.trim()}" configured. Base directory: ${currentBaseDir}`);
    } else if (currentBaseDir !== oldBaseDir) {
      console.log(`[ConfigMonitor] PROJECT CHANGED: Project path updated to "${currentProjectPathFromConfig.trim()}". New base directory: ${currentBaseDir}`);
    }
  } else {
    if (wasPreviouslyValid) {
      console.warn(`[ConfigMonitor] PROJECT UNCONFIGURED: Project path "${oldRawProjectPath}" (was base: "${oldBaseDir}") is now invalid, removed, or config error. Waiting for configuration.`);
    }
  }
  return isNowValidConfig;
}

function startConfigMonitor(): void {
  console.log(`[ConfigMonitor] Initializing: Monitoring ${configJsonPath} for project configuration.`);
  const initiallyValid = updatePathsFromConfig();

  if (!initiallyValid) {
      console.warn(`[ConfigMonitor] Initial Status: No valid project path found in ${configJsonPath}. Waiting for configuration.`);
  }

  setInterval(() => {
    updatePathsFromConfig();
  }, 1000);
}

startConfigMonitor();

const upload: Multer = multer({ dest: UPLOAD_TEMP_DIR });

function runMulterMiddleware(req: Request, res: Response, multerMiddleware: RequestHandler): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    multerMiddleware(req, res, (err: any) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

async function safePathResolve(relativePathInput: string | undefined | null, checkExists: boolean = false): Promise<string> {
  if (!currentBaseDir) {
    console.error("[safePathResolve] Error: Attempted to operate while project base directory is not configured.");
    throw new Error('Project base directory is not configured. Please check config.json and ensure the "project" key is set to a valid path.');
  }

  const activeBaseDir: string = path.resolve(currentBaseDir);

  if (relativePathInput === '') {
      await ensureDirExists(activeBaseDir);
      if (checkExists && !(await pathExists(activeBaseDir))) {
           throw new Error(`Base project directory not found: ${activeBaseDir}`);
      }
      return activeBaseDir;
  }

  if (typeof relativePathInput !== 'string' || relativePathInput.trim() === '') {
    throw new Error('Invalid path provided: path is empty or not a string (and not an intentional empty string for base directory).');
  }

  const trimmedRelativePath: string = relativePathInput.trim();
  const resolvedPath: string = path.resolve(activeBaseDir, trimmedRelativePath);

  if (!resolvedPath.startsWith(activeBaseDir + path.sep) && resolvedPath !== activeBaseDir) {
    console.error(`[safePathResolve] Unsafe path attempt: Resolved "${resolvedPath}" is outside base "${activeBaseDir}" from relative "${trimmedRelativePath}"`);
    throw new Error('Unsafe path: Access denied due to path traversal attempt.');
  }

  if (checkExists && !(await pathExists(resolvedPath))) {
    const displayPath: string = path.relative(activeBaseDir, resolvedPath) || trimmedRelativePath;
    console.warn(`[safePathResolve] Path not found: "${displayPath}" (resolved from "${trimmedRelativePath}" within base "${activeBaseDir}")`);
    throw new Error(`Path not found: ${displayPath}`);
  }
  return resolvedPath;
}

interface FileManagerRouteParams {
  req: Request;
  res: Response;
  app?: Application;
}

type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all";

interface FileManagerExpressRouteModule {
  method: HttpMethod;
  path: string;
  install: (params: FileManagerRouteParams) => Promise<void> | void;
}

export const modules: FileManagerExpressRouteModule[] = [
  {
    method: 'post',
    path: '/file/list', // <--- Here it is
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const dirToList: string = await safePathResolve('');

        const itemNames: string[] = await fs.promises.readdir(dirToList);
        const items = await Promise.all(itemNames.map(async (name) => {
          const fullPath: string = path.join(dirToList, name);
          const stat: fs.Stats = await fs.promises.stat(fullPath);
          return { name, isDir: stat.isDirectory() };
        }));
        res.json(items);
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/list:', errMsg, e);
        if (errMsg.includes('Project base directory is not configured')) {
            res.status(503).send(errMsg);
        } else if (e instanceof Error && e.message.startsWith('Path not found')) {
            res.status(404).send("Root project directory not found or accessible.");
        } else {
            res.status(500).send(errMsg);
        }
      }
    },
  },

  {
    method: 'post',
    path: '/file/list',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const dirToList: string = await safePathResolve('');

        const itemNames: string[] = await fs.promises.readdir(dirToList);
        const items = await Promise.all(itemNames.map(async (name) => {
          const fullPath: string = path.join(dirToList, name);
          const stat: fs.Stats = await fs.promises.stat(fullPath);
          return { name, isDir: stat.isDirectory() };
        }));
        res.json(items);
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/list:', errMsg, e);
        if (errMsg.includes('Project base directory is not configured')) {
            res.status(503).send(errMsg);
        } else if (e instanceof Error && e.message.startsWith('Path not found')) {
            res.status(404).send("Root project directory not found or accessible.");
        } else {
            res.status(500).send(errMsg);
        }
      }
    },
  },
  {
    method: 'post',
    path: '/file/open',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const filePath: string = await safePathResolve(req.body.file, true);
        const content: string = await fs.promises.readFile(filePath, 'utf8');
        res.send(content);
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/open:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        else if (e instanceof Error && e.message.startsWith('Path not found')) statusCode = 404;
        res.status(statusCode).send(errMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/save',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const fileRelativePath: string = req.body.file;
        const content: string = req.body.content;

        if (typeof content !== 'string') {
            res.status(400).send('Invalid content for file save.');
            return;
        }
        const filePath: string = await safePathResolve(fileRelativePath, false);
        const dirForFile: string = path.dirname(filePath);
        await ensureDirExists(dirForFile);

        await fs.promises.writeFile(filePath, content, 'utf8');
        res.send('File saved');
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/save:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        res.status(statusCode).send(errMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/upload',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        if (!currentBaseDir) {
            throw new Error('Project base directory is not configured. Cannot accept uploads.');
        }
        await runMulterMiddleware(req, res, upload.single('file'));

        if (!req.file) {
          res.status(400).send('No file uploaded.');
          return;
        }
        const uploadedFile: Express.Multer.File = req.file as Express.Multer.File;

        const relativeTargetSubfolder: string = typeof req.body.path === 'string' && req.body.path.trim() !== ''
          ? req.body.path.trim()
          : '';

        const targetDirectory: string = await safePathResolve(relativeTargetSubfolder, false);

        try {
            const targetStat: fs.Stats = await fs.promises.stat(targetDirectory);
            if (!targetStat.isDirectory()) {
                await fs.promises.unlink(uploadedFile.path);
                res.status(400).send('Target path exists but is not a directory.');
                return;
            }
        } catch (statError: any) {
            if (statError && typeof statError === 'object' && 'code' in statError && statError.code === 'ENOENT') {
                 await ensureDirExists(targetDirectory);
            } else {
                await fs.promises.unlink(uploadedFile.path);
                throw statError;
            }
        }

        const finalDestination: string = path.join(targetDirectory, uploadedFile.originalname);
        if (!finalDestination.startsWith(targetDirectory + path.sep) && finalDestination !== targetDirectory) {
             await fs.promises.unlink(uploadedFile.path);
             throw new Error("Upload failed: constructed final path is outside target directory.");
        }

        await fs.promises.rename(uploadedFile.path, finalDestination);
        const displayPath: string = path.relative(path.resolve(currentBaseDir), finalDestination).split(path.sep).join('/') || uploadedFile.originalname;
        res.send('File uploaded to ' + displayPath);

      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/upload handler:', errMsg, e);
        const currentReqFile = req.file as Express.Multer.File | undefined;
        if (currentReqFile && currentReqFile.path && await pathExists(currentReqFile.path)) {
          await fs.promises.unlink(currentReqFile.path).catch(unlinkErr => console.error("Failed to cleanup temp upload file:", (unlinkErr as Error).message));
        }
        if (!res.headersSent) {
            let statusCode: number = 500;
            if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
            else if (e instanceof multer.MulterError) statusCode = 400;
            else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
            res.status(statusCode).send(errMsg);
        }
      }
    },
  },
  {
    method: 'post',
    path: '/file/download',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const filePath: string = await safePathResolve(req.body.file, true);
        const stat: fs.Stats = await fs.promises.stat(filePath);
        if (!stat.isFile()) {
          res.status(400).send('Specified path is not a file.');
          return;
        }
        res.download(filePath);
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/download:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        else if (e instanceof Error && e.message.startsWith('Path not found')) statusCode = 404;
        res.status(statusCode).send(errMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/download-zip',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const folderRelativePath: string = typeof req.body.folder === 'string' ? req.body.folder.trim() : '';
        const folderToZip: string = await safePathResolve(folderRelativePath, true);

        const stat: fs.Stats = await fs.promises.stat(folderToZip);
        if (!stat.isDirectory()) {
          res.status(400).send('Specified path is not a directory.');
          return;
        }

        const zipName: string = (path.basename(folderToZip) || 'archive') + '.zip';
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('warning', (err: ArchiverError) => {
            console.warn('[Archiver Warning]', err.code, err.message);
        });
        archive.on('error', (err: Error) => {
          console.error('[Archiver Error]', err.message, err);
          if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to create zip file: ' + err.message });
          } else if (res.writable && !res.writableEnded) {
            res.end();
          }
        });
        archive.pipe(res);
        archive.directory(folderToZip, false);
        await archive.finalize();

      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/download-zip setup:', errMsg, e);
        if (!res.headersSent) {
            let statusCode: number = 500;
            if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
            else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
            else if (e instanceof Error && e.message.startsWith('Path not found')) statusCode = 404;
            res.status(statusCode).send(errMsg);
        }
      }
    },
  },
  {
    method: 'post',
    path: '/file/unzip',
    install: async ({ req, res }: FileManagerRouteParams) => {
      const {
        zipFilePath: zipFileRelativePath,
        destinationPath: destinationRelativePathInput,
        overwrite
      }: { zipFilePath: string; destinationPath?: string; overwrite?: boolean } = req.body;

      try {
        if (typeof zipFileRelativePath !== 'string' || zipFileRelativePath.trim() === '') {
          res.status(400).send('zipFilePath is required.'); return;
        }
        const absoluteZipFilePath: string = await safePathResolve(zipFileRelativePath.trim(), true);
        if (!(await fs.promises.stat(absoluteZipFilePath)).isFile()) {
          res.status(400).send(`Specified zipFilePath '${zipFileRelativePath}' is not a file.`); return;
        }
        if (!absoluteZipFilePath.toLowerCase().endsWith('.zip')) {
            console.warn(`[Unzip] Warning: File '${zipFileRelativePath}' may not be a .zip file based on extension. Attempting unzip.`);
        }

        let absoluteDestinationDir: string;
        const resolvedCurrentBaseDir: string = path.resolve(currentBaseDir);

        if (typeof destinationRelativePathInput === 'string' && destinationRelativePathInput.trim() !== '') {
          absoluteDestinationDir = await safePathResolve(destinationRelativePathInput.trim(), false);
        } else {
          absoluteDestinationDir = path.dirname(absoluteZipFilePath);
          if (!absoluteDestinationDir.startsWith(resolvedCurrentBaseDir + path.sep) && absoluteDestinationDir !== resolvedCurrentBaseDir) {
            console.error(`[Unzip] Default destination dir "${absoluteDestinationDir}" is outside base "${resolvedCurrentBaseDir}"`);
            throw new Error('Default extraction path is outside the allowed project directory.');
          }
        }

        try {
            const destStat: fs.Stats = await fs.promises.stat(absoluteDestinationDir);
            if (!destStat.isDirectory()) {
                res.status(400).send(`Destination path '${path.relative(resolvedCurrentBaseDir, absoluteDestinationDir).split(path.sep).join('/') || '.'}' exists and is not a directory.`); return;
            }
        } catch (statError: any) {
            if (statError && typeof statError === 'object' && 'code' in statError && statError.code === 'ENOENT') {
            } else {
                throw statError;
            }
        }
        await ensureDirExists(absoluteDestinationDir);

        if (!overwrite) {
          const conflictingEntries: string[] = [];
          const openZipForRead = (filePath: string, options: YauzlOptions): Promise<YauzlZipFile> =>
            new Promise<YauzlZipFile>((resolveMain, rejectMain) => {
              yauzl.open(filePath, options, (err: Error | null, zipfile?: YauzlZipFile) => {
                if (err || !zipfile) rejectMain(err || new Error("Failed to open zipfile. Path: " + filePath));
                else resolveMain(zipfile);
              });
            });

          let zipfile: YauzlZipFile | null = null;
          try {
            zipfile = await openZipForRead(absoluteZipFilePath, { lazyEntries: true });
            const currentZipfile: YauzlZipFile = zipfile;
            await new Promise<void>((resolveLoop, rejectLoop) => {
              currentZipfile.on('error', rejectLoop);
              currentZipfile.on('end', resolveLoop);
              currentZipfile.on('entry', async (entry: YauzlEntry) => {
                const targetPath: string = path.resolve(absoluteDestinationDir, entry.fileName);
                if (!targetPath.startsWith(absoluteDestinationDir)) {
                    console.warn(`[Unzip] Skipped potentially unsafe entry during conflict check: ${entry.fileName} (resolves outside destination)`);
                    currentZipfile.readEntry();
                    return;
                }
                if (await pathExists(targetPath)) {
                  const existingStat: fs.Stats = await fs.promises.stat(targetPath);
                  const entryIsDirectory: boolean = entry.fileName.endsWith('/');
                  if (existingStat.isDirectory() !== entryIsDirectory) {
                    conflictingEntries.push(`${entry.fileName} (type mismatch: existing is ${existingStat.isDirectory() ? 'dir' : 'file'}, zip entry is ${entryIsDirectory ? 'dir' : 'file'})`);
                  } else if (!entryIsDirectory) {
                    conflictingEntries.push(entry.fileName);
                  }
                }
                currentZipfile.readEntry();
              });
              currentZipfile.readEntry();
            });
          } finally {
            zipfile?.close();
          }

          if (conflictingEntries.length > 0) {
            res.status(409).send({
              message: "Extraction would overwrite or conflict with existing files/directories. Please use 'overwrite: true' in your request to proceed.",
              conflicts: conflictingEntries
            });
            return;
          }
        }

        await extract(absoluteZipFilePath, { dir: absoluteDestinationDir });
        const displayDestPath: string = path.relative(resolvedCurrentBaseDir, absoluteDestinationDir).split(path.sep).join('/') || '.';
        res.send(`Successfully unzipped '${path.basename(zipFileRelativePath)}' to '${displayDestPath}'`);

      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        let statusCode: number = 500;
        let clientMsg: string = `Failed to unzip: ${errMsg}`;

        if (errMsg.includes('Project base directory is not configured')) { statusCode = 503; clientMsg = errMsg; }
        else if (e instanceof Error) {
            if (e.message.startsWith('Unsafe path')) { statusCode = 403; clientMsg = errMsg; }
            else if (e.message.startsWith('Path not found')) { statusCode = 404; clientMsg = errMsg; }
            else if (e.message.includes('is not a directory')) { statusCode = 400; clientMsg = errMsg; }
            else if (errMsg.toLowerCase().includes("invalid") && (errMsg.toLowerCase().includes("zip") || errMsg.toLowerCase().includes("archive"))) {
                statusCode = 400; clientMsg = `Failed to unzip '${zipFileRelativePath || 'file'}': May be corrupted or not a valid ZIP.`;
            } else if (errMsg.includes("yauzl") && (errMsg.includes("Не найден указанный файл") || errMsg.includes("end of central directory record signature not found") || errMsg.includes("Failed to open zipfile"))) {
                statusCode = 400; clientMsg = `Failed to read '${zipFileRelativePath || 'file'}': Invalid or corrupted ZIP file.`;
            } else if (e.message.includes('EEXIST') || e.message.includes('ENOTDIR') || (e.message.includes('entry') && e.message.includes('isDirectory') && e.message.includes('false but is a directory'))) {
                statusCode = 409;
                clientMsg = `Failed to unzip: A conflict occurred during extraction (e.g., a file exists where a directory was expected, or vice-versa). Original error: ${errMsg}`;
            }
        }
        console.error(`Error in /file/unzip (HTTP ${statusCode}):`, errMsg, e);
        if (!res.headersSent) res.status(statusCode).send(clientMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/create',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const fileRelativePath: string = req.body.file;
        if (typeof fileRelativePath !== 'string' || fileRelativePath.trim() === '') {
            res.status(400).send('File path is required.'); return;
        }
        const filePath: string = await safePathResolve(fileRelativePath.trim(), false);
        if (await pathExists(filePath)) {
          res.status(400).send('File or folder already exists at the target path.'); return;
        }
        await ensureDirExists(path.dirname(filePath));
        await fs.promises.writeFile(filePath, '');
        res.send('File created: ' + (path.relative(path.resolve(currentBaseDir), filePath).split(path.sep).join('/') || path.basename(filePath)));
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/create:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        res.status(statusCode).send(errMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/create-folder',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const folderRelativePath: string = req.body.folder;
        if (typeof folderRelativePath !== 'string' || folderRelativePath.trim() === '') {
            res.status(400).send('Folder path is required.'); return;
        }
        const folderPath: string = await safePathResolve(folderRelativePath.trim(), false);
        if (await pathExists(folderPath)) {
          res.status(400).send('File or folder already exists at the target path.'); return;
        }
        await fs.promises.mkdir(folderPath, { recursive: true });
        res.send('Folder created: ' + (path.relative(path.resolve(currentBaseDir), folderPath).split(path.sep).join('/') || path.basename(folderPath)));
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/create-folder:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        res.status(statusCode).send(errMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/open-folder',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const relativeFolderPath: string = typeof req.body.folder === 'string' ? req.body.folder.trim() : '';
        const folderPath: string = await safePathResolve(relativeFolderPath, true);

        if (!(await fs.promises.stat(folderPath)).isDirectory()) {
            res.status(400).send(`Specified path '${relativeFolderPath}' is not a directory.`); return;
        }
        const itemNames: string[] = await fs.promises.readdir(folderPath);
        const items = await Promise.all(itemNames.map(async (name) => {
          const fullPath: string = path.join(folderPath, name);
          const itemStat: fs.Stats = await fs.promises.stat(fullPath);
          return { name, isDir: itemStat.isDirectory(), size: itemStat.size, lastModified: itemStat.mtimeMs };
        }));

        const resolvedCurrentBaseDir: string = path.resolve(currentBaseDir);
        const currentDisplayPath: string = path.relative(resolvedCurrentBaseDir, folderPath).split(path.sep).join('/');

        res.json({
          currentPath: folderPath === resolvedCurrentBaseDir ? '' : currentDisplayPath,
          items,
        });
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/open-folder:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        else if (e instanceof Error && e.message.startsWith('Path not found')) statusCode = 404;
        res.status(statusCode).send(errMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/rename',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const { oldPath: oldRelativePath, newPath: newRelativePath }: { oldPath: string; newPath: string } = req.body;
        if (typeof oldRelativePath !== 'string' || !oldRelativePath.trim() ||
            typeof newRelativePath !== 'string' || !newRelativePath.trim()) {
          res.status(400).send('Old and new paths are required and cannot be empty.'); return;
        }

        const trimmedOldRelativePath: string = oldRelativePath.trim();
        const trimmedNewRelativePath: string = newRelativePath.trim();

        if (trimmedOldRelativePath === trimmedNewRelativePath) {
            res.status(400).send('Old and new paths cannot be the same.'); return;
        }

        const oldFullPath: string = await safePathResolve(trimmedOldRelativePath, true);

        const newName: string = path.basename(trimmedNewRelativePath);
        if (!newName || newName === '.' || newName === '..') {
            res.status(400).send('New name is invalid.'); return;
        }
        const newParentDirRelative: string = path.dirname(trimmedNewRelativePath);
        const newParentDirAbsolute: string = await safePathResolve(newParentDirRelative, false);
        await ensureDirExists(newParentDirAbsolute);

        const newFullPath: string = path.join(newParentDirAbsolute, newName);

        const resolvedCurrentBaseDir: string = path.resolve(currentBaseDir);
        if (!newFullPath.startsWith(resolvedCurrentBaseDir + path.sep) && newFullPath !== resolvedCurrentBaseDir) {
            throw new Error('Unsafe new path: Target is outside the allowed directory.');
        }

        if (oldFullPath === newFullPath) {
            res.status(400).send('Resolved old and new paths are identical.'); return;
        }
        if (await pathExists(newFullPath)) {
          res.status(400).send(`Item at new path '${trimmedNewRelativePath}' already exists.`); return;
        }

        await fs.promises.rename(oldFullPath, newFullPath);
        res.send('Renamed successfully to ' + (path.relative(resolvedCurrentBaseDir, newFullPath).split(path.sep).join('/') || newName));
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/rename:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        else if (e instanceof Error && e.message.startsWith('Path not found')) statusCode = 404;
        res.status(statusCode).send(errMsg);
      }
    },
  },
  {
    method: 'post',
    path: '/file/delete',
    install: async ({ req, res }: FileManagerRouteParams) => {
      try {
        const itemRelativePath: string = req.body.path;
        if (typeof itemRelativePath !== 'string' || !itemRelativePath.trim()) {
            res.status(400).send('Path for deletion is required.'); return;
        }
        const trimmedItemRelativePath: string = itemRelativePath.trim();
        if (trimmedItemRelativePath === '.' || trimmedItemRelativePath === '/') {
            res.status(400).send('Invalid path for deletion. Cannot delete root.'); return;
        }

        const itemFullPath: string = await safePathResolve(trimmedItemRelativePath, true);
        const resolvedCurrentBaseDir: string = path.resolve(currentBaseDir);

        if (itemFullPath === resolvedCurrentBaseDir) {
             res.status(400).send('Cannot delete the root project directory itself.'); return;
        }

        const stat: fs.Stats = await fs.promises.stat(itemFullPath);
        const displayPath: string = path.relative(resolvedCurrentBaseDir, itemFullPath).split(path.sep).join('/') || trimmedItemRelativePath;

        if (stat.isDirectory()) {
            await fs.promises.rm(itemFullPath, { recursive: true, force: true });
        } else {
            await fs.promises.unlink(itemFullPath);
        }
        res.send(`${stat.isDirectory() ? 'Folder' : 'File'} deleted: ${displayPath}`);
      } catch (e: any) {
        const errMsg: string = e instanceof Error ? e.message : String(e);
        console.error('Error in /file/delete:', errMsg, e);
        let statusCode: number = 500;
        if (errMsg.includes('Project base directory is not configured')) statusCode = 503;
        else if (e instanceof Error && e.message.startsWith('Unsafe path')) statusCode = 403;
        else if (e instanceof Error && e.message.startsWith('Path not found')) statusCode = 404;
        res.status(statusCode).send(errMsg);
      }
    },
  },
];
