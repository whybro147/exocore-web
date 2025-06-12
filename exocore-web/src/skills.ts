// src/skill.ts
const fs = require("fs");
const path = require("path");
import { Request, Response } from 'express';

interface SkillResult {
  name: string;
  skill: string; // percentage string
  extension: string; // no leading dot
}

interface Config {
  project: string;
}

// Keys of languageMap no longer have a leading dot
const languageMap: { [key: string]: string } = {
  "js": "JavaScript",
  "ts": "TypeScript",
  "html": "HTML",
  "css": "CSS",
  "json": "JSON",
  "md": "Markdown",
  "py": "Python",
  "java": "Java",
  "c": "C",
  "cpp": "C++",
  "cs": "C#",
  "go": "Go",
  "rb": "Ruby",
  "php": "PHP",
  "swift": "Swift",
  "kt": "Kotlin",
  "sh": "Shell Script",
  "xml": "XML",
  "yaml": "YAML",
  "yml": "YAML",
  "sql": "SQL",
  "jsx": "React (JavaScript)",
  "tsx": "React (TypeScript)",
};

function walkDir(dirPath: string, counts: Map<string, number>): number {
  let totalFiles = 0;
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    console.warn(`[Skills Analyzer] Directory not found or not a directory: ${dirPath}`);
    return 0;
  }

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        totalFiles += walkDir(fullPath, counts);
      } else if (stats.isFile()) {
        let ext = path.extname(file); // Get extension with leading dot
        if (ext) {
          ext = ext.substring(1).toLowerCase(); // Remove dot and convert to lowercase
          counts.set(ext, (counts.get(ext) || 0) + 1);
          totalFiles++;
        }
      }
    } catch (error: any) {
      console.error(`[Skills Analyzer] Error processing file ${fullPath}:`, error.message);
    }
  }
  return totalFiles;
}

async function analyzeProjectSkills(): Promise<{ project: string; skills: SkillResult[] }> {
  const configPath = path.resolve(__dirname, '..', 'config.json');
  console.log(`[Skills Analyzer] Attempting to read config from: ${configPath}`);

  let projectRoot: string;
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config: Config = JSON.parse(configContent);
    if (!config.project) {
      throw new Error("Missing 'project' key in config.json. Please ensure it's defined.");
    }
    projectRoot = path.resolve(path.dirname(configPath), config.project);
    console.log(`[Skills Analyzer] Project path from config: ${projectRoot}`);
  } catch (error: any) {
    console.error(`[Skills Analyzer] Failed to read or parse config.json:`, error.message);
    return { project: "Unknown Project (config error)", skills: [] };
  }

  const languageCounts = new Map<string, number>();
  const totalFiles = walkDir(projectRoot, languageCounts);

  if (totalFiles === 0) {
    console.warn(`[Skills Analyzer] No files with recognized extensions found in project directory: ${projectRoot}`);
    return { project: projectRoot, skills: [] };
  }

  const skills: SkillResult[] = [];
  for (const [ext, count] of languageCounts.entries()) {
    const percentage = ((count / totalFiles) * 100).toFixed(2);
    const name = languageMap[ext] || ext.toUpperCase(); // Use dot-less ext for lookup, fallback to uppercase for name
    skills.push({
      name: name.toLowerCase(),
      skill: `${percentage}%`,
      extension: ext, // Store dot-less extension
    });
  }

  skills.sort((a, b) => parseFloat(b.skill) - parseFloat(a.skill));

  console.log(`[Skills Analyzer] Analysis complete for project: ${projectRoot}. Found ${totalFiles} files.`);
  return { project: projectRoot, skills: skills };
}

interface LoginRouteParams {
  req: Request<any, any, unknown>;
  res: Response;
}

interface LoginExpressRouteModule {
  method: "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all";
  path: string;
  install: (params: LoginRouteParams) => Promise<void> | void;
}

export const modules: LoginExpressRouteModule[] = [
  {
    method: "post",
    path: "/skills",
    install: async ({ req, res }: { req: Request; res: Response }) => {
      try {
        const { project, skills } = await analyzeProjectSkills();
        res.json([{ project: project, skills: skills }]);
      } catch (error: any) {
        console.error("[Skills Route] Error serving skills:", error.message);
        res.status(500).json({ error: "Failed to analyze project skills. Check server logs." });
      }
    },
  },
];