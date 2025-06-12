import type { Request, Response, Application } from 'express';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

function safeReadFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string {
    if (existsSync(filePath)) {
        try {
            return readFileSync(filePath, encoding);
        } catch (e) {
            console.error(`Error reading file ${filePath} (safeReadFile):`, e);
            return '';
        }
    }
    console.warn(`Warning: File not found at ${filePath} (safeReadFile). Returning empty string.`);
    return '';
}

export function html(app: Application): void {
    const fileSystemPublicBasePath = path.resolve(__dirname, '..', 'public');
    const header = safeReadFile(path.join(fileSystemPublicBasePath, 'templates', 'header.html'));
    const chatheadai = safeReadFile(path.join(fileSystemPublicBasePath, 'templates', 'chatheadai.html'));
    const footer = safeReadFile(path.join(fileSystemPublicBasePath, 'templates', 'footer.html'));

    function renderPage(title: string, scriptPath: string): string {
        const hostScript = safeReadFile(path.join(fileSystemPublicBasePath, 'src', scriptPath));
        const basePublicPath = '/private/server/exocore/web/public';

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${title}</title>
    <script>
    (function() {
        const getToken = () => localStorage.getItem('exocore-token') || '';
        const getCookies = () => localStorage.getItem('exocore-cookies') || '';
        const baseRedirectPath = '/private/server/exocore/web/public';
        const panelLoginLandingUrl = baseRedirectPath;
        const accountLoginUrl = \`\${baseRedirectPath}/login\`;
        const registerUrl = \`\${baseRedirectPath}/register\`;
        const otpUrl = \`\${baseRedirectPath}/otp\`;
        const forgotPasswordUrl = \`\${baseRedirectPath}/forgot-password\`;
        const currentPathname = window.location.pathname;
        const isPanelLoginSuccess = localStorage.getItem('panelLogin') === 'success';
        const hasAccountAuthTokens = getToken() && getCookies();

        if (!isPanelLoginSuccess) {
            if (currentPathname !== panelLoginLandingUrl) {
                console.log("'panelLogin' is not 'success'. Redirecting to panel login landing page...");
                window.location.href = panelLoginLandingUrl;
                throw new Error("Redirecting to panel login landing to halt script execution.");
            }
            return;
        }

        const postPanelLogin_AccountAuthPages = [accountLoginUrl, registerUrl, otpUrl, forgotPasswordUrl];

        if (!hasAccountAuthTokens) {
            if (!postPanelLogin_AccountAuthPages.includes(currentPathname)) {
                console.log('User has panel access but no account session tokens. Redirecting to account login page...');
                window.location.href = accountLoginUrl;
                throw new Error("Redirecting to account login to halt script execution.");
            }
            return;
        }
    })();
    </script>
    <script src="https://cdn.jsdelivr.net/npm/ansi_up@5.1.0/ansi_up.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <style>
        html, body { height: 100%; margin: 0; }
        .page-wrapper { min-height: 100%; display: flex; flex-direction: column; }
        .page-content { flex: 1; }
        #app { min-height: 100vh; }
        h2, h3, h4 { color: #333; margin-top: 0.5rem; margin-bottom: 1rem; }
        ul { list-style-type: none; padding: 0; margin: 0; }
        li { padding: 0.2rem 0; }
        .status-box { padding: 0.5rem; margin: 0.5rem 0; border: 1px solid #ddd; background: #f9f9f9; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; }
        input[type="file"] { display: none; }
        @media (max-width: 767px) {
            .main-content-flex { flex-direction: column; gap: 15px !important; }
            .file-list-panel, .file-editor-panel { width: 100%; min-width: unset !important; }
        }
        pre { background: #1e1e1e; padding: 1em; overflow: auto; border-radius: 5px; color: #ccc; }
        code { font-family: 'monospace'; display: block; }
    </style>
</head>
<body>
    <div class="page-wrapper">
        ${header}
        <div id="app" class="page-content"></div>
        ${chatheadai}
        ${footer}
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof hljs !== 'undefined') {
                hljs.highlightAll();
            }
        });
    </script>
    <script>
    async function checkProjectStatusAndRedirect() {
        const projectStatusUrl = '/private/server/exocore/web/project/status';
        const redirectUrl = '${basePublicPath}/project';
        if (window.location.pathname === redirectUrl) {
            console.log('Currently on the project setup page. Status check will not redirect further from here.');
            return;
        }
        try {
            const response = await fetch(projectStatusUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                console.error(\`Failed to fetch project status. Server responded with \${response.status}: \${response.statusText}\`);
                return;
            }
            const statusData = await response.json();
            if (statusData && typeof statusData.exists === 'boolean' && !statusData.exists) {
                console.log('Project status indicates it does not exist or is not properly configured. Redirecting to project setup...');
                window.location.href = redirectUrl;
            } else if (statusData && statusData.exists === true) {
                console.log('Project exists. No redirection necessary from project status check.');
            } else {
                console.warn('Received an unexpected or malformed response from the project status API:', statusData);
            }
        } catch (error) {
            console.error('Error during project status check or processing:', error);
        }
    }
    const currentPathnameForProjectCheck = window.location.pathname;
    const baseRedirectPathForProjectCheck = '/private/server/exocore/web/public';
    const accountLoginUrlForProjectCheck = \`\${baseRedirectPathForProjectCheck}/login\`;
    const registerUrlForProjectCheck = \`\${baseRedirectPathForProjectCheck}/register\`;
    const otpUrlForProjectCheck = \`\${baseRedirectPathForProjectCheck}/otp\`;
    if ( localStorage.getItem('exocore-token') &&
         localStorage.getItem('exocore-cookies') &&
         localStorage.getItem('panelLogin') === 'success' &&
         currentPathnameForProjectCheck !== accountLoginUrlForProjectCheck &&
         currentPathnameForProjectCheck !== registerUrlForProjectCheck &&
         currentPathnameForProjectCheck !== otpUrlForProjectCheck
       ) {
        checkProjectStatusAndRedirect();
    }
    </script>
    <script type="module">${hostScript}</script>
</body>
</html>`;
    }

    const urlSegmentForPublicRoutes = '/private/server/exocore/web/public';

    app.get(`${urlSegmentForPublicRoutes}/register`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Signup', 'register.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/login`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Login', 'login.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/project`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Project', 'project.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/otp`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Otp', 'otp.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/profile`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Profile', 'profile.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/forgot-password`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('ForgotPass', 'forgot.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/dashboard`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Dashboard', 'dashboard.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/plans`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('plans', 'plans.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/console`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Console', 'console.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/shell`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('Shell', 'shell.js'));
    });

    app.get(`${urlSegmentForPublicRoutes}/manager`, (_req: Request, res: Response): void => {
        res.setHeader('Content-Type', 'text/html');
        res.send(renderPage('File Manager', 'FileManager.js'));
    });

    app.get(urlSegmentForPublicRoutes, (_req: Request, res: Response): void => {
        const panelHtmlFilePath = path.join(fileSystemPublicBasePath, 'panel.html');

        if (!existsSync(panelHtmlFilePath)) {
            console.warn(`Static file not found: ${panelHtmlFilePath} for URL ${urlSegmentForPublicRoutes}. Sending 404.`);
            res.status(404).send('Page not found.');
            return;
        }

        try {
            const fileContent = readFileSync(panelHtmlFilePath, 'utf-8');
            res.setHeader('Content-Type', 'text/html');
            res.send(fileContent);
        } catch (error) {
            console.error(`Error reading static file ${panelHtmlFilePath} for URL ${urlSegmentForPublicRoutes}:`, error);
            res.status(500).send('Error loading page.');
        }
    });
}