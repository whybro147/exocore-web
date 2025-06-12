import { render } from 'solid-js/web';
import { createSignal, onMount, Show } from 'solid-js';

const FullscreenIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>;
const ExitFullscreenIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>;
const KillIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>

function App() {
    const [loading, setLoading] = createSignal(true);
    const [status, setStatus] = createSignal('');
    const [userData, setUserData] = createSignal(null);
    const [wsStatus, setWsStatus] = createSignal('Disconnected');
    const [isFullScreen, setIsFullScreen] = createSignal(false);
    const [promptText, setPromptText] = createSignal('$ ');

    let consoleRef, logOutputRef, inputLineRef;
    let ansiUpInstance = null;

    async function fetchUserInfo() {
        setLoading(true);
        // User info logic is assumed to be correct and unchanged
        setLoading(false);
    }

    function appendToLog(line, isCommand = false) {
        if (!logOutputRef) return;
        const html = ansiUpInstance ? ansiUpInstance.ansi_to_html(line) : line;
        const logEntry = document.createElement('div');
        logEntry.innerHTML = isCommand ? `<span style="color: var(--accent-secondary);">${promptText()}</span>${html}` : html;
        logOutputRef.appendChild(logEntry);

        while (logOutputRef.children.length > 250) {
            logOutputRef.removeChild(logOutputRef.firstChild);
        }
        if (consoleRef) {
            requestAnimationFrame(() => consoleRef.scrollTop = consoleRef.scrollHeight);
        }
    }

    async function sendCommand() {
        if (!inputLineRef) return;
        const cmd = inputLineRef.innerText.trim();
        if (!cmd) return;
        appendToLog(cmd, true);
        inputLineRef.innerText = '';
        try {
            await fetch('/private/server/exocore/web/shell/sent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd }),
            });
        } catch (err) {
            appendToLog(`\x1b[31mFailed to send command: ${err.message}\x1b[0m`);
        }
    }

    async function handleKillShellCommand() {
        appendToLog('\x1b[33mINFO: Sending kill command...\x1b[0m');
        try {
            await fetch('/private/server/exocore/web/shell/kill', { method: 'POST' });
        } catch (err) {
            appendToLog(`\x1b[31mERROR: Could not send kill command: ${err.message}\x1b[0m`);
        }
    }

    function toggleFullScreen() {
        const el = document.querySelector('.console-wrapper');
        if (!el) return;
        if (!document.fullscreenElement) {
            el.requestFullscreen().catch(err => appendToLog(`\x1b[31mFullscreen Error: ${err.message}\x1b[0m`));
        } else {
            document.exitFullscreen();
        }
    }

    onMount(() => {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Fira+Code:wght@400;500&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        const ansiScript = document.createElement('script');
        ansiScript.src = 'https://cdn.jsdelivr.net/npm/ansi_up@5.1.0/ansi_up.min.js';
        ansiScript.onload = () => {
            if (typeof AnsiUp !== 'undefined') {
                ansiUpInstance = new AnsiUp();
                ansiUpInstance.use_classes = false;
            }
        };
        document.head.appendChild(ansiScript);

        fetchUserInfo();

        const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/private/server/exocore/web/ws/shell`;
        function connectWebSocket() {
            const ws = new WebSocket(wsUrl);
            ws.onopen = () => setWsStatus('Connected');
            ws.onclose = () => {
                setWsStatus('Disconnected');
                setTimeout(connectWebSocket, 2000);
            };
            ws.onerror = () => setWsStatus('Error');
            ws.onmessage = (e) => {
                try {
                    const message = JSON.parse(e.data);
                    if (message.type === 'prompt') {
                        setPromptText(message.data);
                    } else {
                        appendToLog(message.data);
                    }
                } catch (err) {
                    appendToLog(e.data);
                }
            };
        }
        connectWebSocket();
        document.addEventListener('fullscreenchange', () => setIsFullScreen(!!document.fullscreenElement));
        consoleRef?.addEventListener('click', (e) => {
            if (inputLineRef && e.target !== inputLineRef) {
                inputLineRef.focus();
            }
        });
    });

    return (
        <div class="main-wrapper-shell">
            <style>{`
                :root {
                    --bg-primary: #111217; --bg-secondary: #1a1b23; --bg-tertiary: #0D0E12;
                    --text-primary: #e0e0e0; --text-secondary: #8a8f98; --accent-primary: #00aaff;
                    --accent-secondary: #0088cc; --danger-primary: #e74c3c; --danger-secondary: #c0392b;
                    --border-color: rgba(255, 255, 255, 0.1); --shadow-color: rgba(0, 0, 0, 0.5);
                    --font-body: 'Roboto', sans-serif; --font-console: 'Fira Code', monospace;
                    --radius-main: 16px; --radius-inner: 10px;
                }
                body { background-color: var(--bg-primary); color: var(--text-primary); font-family: var(--font-body); margin: 0; }
                .main-wrapper-shell { display: flex; justify-content: center; align-items: center; padding: 4vh 2vw; min-height: 100vh; }
                .app-container-shell { background: var(--bg-secondary); padding: 2rem; width: 100%; max-width: 900px; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); display: flex; flex-direction: column; gap: 1.5rem; }
                .greeting-header-shell { display: flex; justify-content: space-between; align-items: center; }
                .greeting-shell { font-size: 1.75rem; font-weight: 700; color: #fff; }
                .user-welcome-shell { font-size: 0.9rem; color: var(--text-secondary); }
                .console-wrapper { border-radius: var(--radius-inner); background: var(--bg-tertiary); box-shadow: inset 0 4px 15px rgba(0,0,0,0.4); overflow: hidden; display: flex; flex-direction: column; height: 500px; border: 1px solid var(--border-color); }
                .console-wrapper:fullscreen { width: 100vw; height: 100vh; border-radius: 0; border: none; }
                .console-header { background: var(--bg-secondary); padding: 0.6rem 1rem; display: flex; align-items: center; border-bottom: 1px solid var(--border-color); position: relative; }
                .console-header-dots { display: flex; gap: 8px; }
                .console-header-dots span { width: 12px; height: 12px; border-radius: 50%; }
                .console-header-dots .red-dot { background-color: #ff5f57; }
                .console-header-dots .yellow-dot { background-color: #ffbd2e; }
                .console-header-dots .green-dot { background-color: #28c940; }
                .fullscreen-btn { position: absolute; top: 50%; right: 1rem; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.2s ease, background-color 0.2s ease; }
                .fullscreen-btn:hover { color: var(--text-primary); background-color: rgba(255,255,255,0.1); }
                .console-container { flex-grow: 1; padding: 1rem; font-family: var(--font-console); font-size: 14px; line-height: 1.6; overflow-y: auto; cursor: text; display: flex; flex-direction: column; }
                .log-output { flex-grow: 1; white-space: pre-wrap; word-break: break-word; }
                .input-area { display: flex; margin-top: 4px; }
                .prompt-text-display { color: var(--accent-primary); margin-right: 8px; user-select: none; }
                .input-line { flex-grow: 1; outline: none; color: var(--text-primary); caret-color: var(--text-primary); }
                .bottom-bar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
                .ws-box { padding: 0.4rem 1rem; border-radius: 99px; font-weight: 500; font-size: 0.8rem; transition: all 0.3s ease; font-family: var(--font-console); }
                .ws-box.connected { background-color: rgba(46, 204, 113, 0.15); color: #2ecc71; }
                .ws-box.disconnected, .ws-box.error { background-color: rgba(231, 76, 60, 0.15); color: var(--danger-primary); }
                .controls-area { display: flex; gap: 0.75rem; }
                .btn-shell { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; font-size: 0.9rem; font-weight: 500; color: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-inner); background-color: var(--bg-secondary); cursor: pointer; transition: all 0.2s ease; }
                .btn-shell:hover { background-color: var(--border-color); border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
                .btn-shell.danger { border-color: var(--danger-primary); color: var(--danger-primary); }
                .btn-shell.danger:hover { background-color: var(--danger-primary); color: #fff; }
            `}</style>

            <Show when={!loading()} fallback={<div>Loading Shell...</div>}>
                <div class="app-container-shell">
                    <div class="greeting-header-shell">
                        <h2 class="greeting-shell">Interactive Shell</h2>
                    </div>

                    <div class="console-wrapper">
                        <div class="console-header">
                            <div class="console-header-dots">
                                <span class="red-dot"></span><span class="yellow-dot"></span><span class="green-dot"></span>
                            </div>
                            <button class="fullscreen-btn" onClick={toggleFullScreen} title={isFullScreen() ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
                                <Show when={isFullScreen()} fallback={<FullscreenIcon />}>
                                    <ExitFullscreenIcon />
                                </Show>
                            </button>
                        </div>
                        <div class="console-container" ref={consoleRef}>
                            <div class="log-output" ref={logOutputRef}></div>
                            <div class="input-area">
                                <span class="prompt-text-display">{promptText()}</span>
                                <div class="input-line"
                                    contenteditable="true"
                                    ref={inputLineRef}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), sendCommand())}
                                    spellcheck="false"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="bottom-bar">
                        <div class="ws-box" classList={{ connected: wsStatus() === 'Connected', disconnected: wsStatus() !== 'Connected' }}>
                            {wsStatus()}
                        </div>
                        <div class="controls-area">
                            <button class="btn-shell danger" onClick={handleKillShellCommand}>
                                <KillIcon/> Kill Session
                            </button>
                        </div>
                    </div>

                </div>
            </Show>
        </div>
    );
}
render(() => <App />, document.getElementById('app'));