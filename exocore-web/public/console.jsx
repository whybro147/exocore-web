import { render } from 'solid-js/web';
import { createSignal, onMount, Show, For } from 'solid-js';

const FullscreenIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>;
const ExitFullscreenIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>;
const StartIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14l11-7z"></path></svg>;
const RestartIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>;
const StopIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><rect x="6" y="6" width="12" height="12"></rect></svg>;

function App() {
    const [loading, setLoading] = createSignal(true);
    const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);
    const [status, setStatus] = createSignal('');
    const [userData, setUserData] = createSignal(null);
    const [logs, setLogs] = createSignal([]);
    const [wsStatus, setWsStatus] = createSignal('Disconnected');
    const [isFullScreen, setIsFullScreen] = createSignal(false);
    const [siteLinkVisible, setSiteLinkVisible] = createSignal(false);
    const [isAwaitingInput, setIsAwaitingInput] = createSignal(false);
    const [inputValue, setInputValue] = createSignal('');

    let ws, inputRef, consoleContainerRef, ansiUpInstance;
    let logIdCounter = 0;

    const getToken = () => localStorage.getItem('exocore-token') || '';
    const getCookies = () => localStorage.getItem('exocore-cookies') || '';

    async function fetchUserInfo() {
        setLoading(true);
        const token = getToken();
        const cookies = getCookies();

        if (!token || !cookies) {
            setLoading(false);
            setInitialLoadComplete(true);
            window.location.href = '/private/server/exocore/web/public/login';
            return;
        }

        try {
            const res = await fetch('/private/server/exocore/web/userinfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, cookies }),
            });

            if (!res.ok) {
                let errorMsg = `Server error: ${res.status}`;
                try {
                    const errorData = await res.json();
                    errorMsg = errorData.message || errorMsg;
                } catch (parseError) {}
                throw new Error(errorMsg);
            }

            const data = await res.json();

            if (data.data?.user && data.data.user.verified === 'success') {
                setUserData(data.data.user);
                setStatus('');
            } else {
                setUserData(null);
                setStatus(data.message || 'User verification failed. Redirecting...');
                localStorage.removeItem('exocore-token');
                localStorage.removeItem('exocore-cookies');
                setTimeout(() => {
                    window.location.href = '/private/server/exocore/web/public/login';
                }, 2500);
            }
        } catch (err) {
            setUserData(null);
            setStatus('Failed to fetch user info: ' + err.message + '. Redirecting...');
            localStorage.removeItem('exocore-token');
            localStorage.removeItem('exocore-cookies');
            setTimeout(() => {
                window.location.href = '/private/server/exocore/web/public/login';
            }, 2500);
        } finally {
            setLoading(false);
            setInitialLoadComplete(true);
        }
    }

    const scrollToBottom = () => {
        if (consoleContainerRef) {
            requestAnimationFrame(() => {
                consoleContainerRef.scrollTop = consoleContainerRef.scrollHeight;
            });
        }
    };

    function addLog(line, isSystemMessage = false) {
        let htmlContent;
        if (ansiUpInstance) {
            htmlContent = ansiUpInstance.ansi_to_html(line);
        } else {
            const escapeHtml = (unsafe) => unsafe.replace(/[&<"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;', "'": '&#039;' })[match] || match);
            htmlContent = isSystemMessage ? `<span style="color: var(--system-message-color);">${escapeHtml(line)}</span>` : escapeHtml(line);
        }

        if (typeof line === 'string' && line.includes(window.origin)) {
            setSiteLinkVisible(true);
        }
        const newLogEntry = { id: logIdCounter++, html: htmlContent, isSystem: isSystemMessage };
        setLogs((prev) => [...prev, newLogEntry].slice(-250));
        scrollToBottom();
    }

    function handleInputSubmit(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                addLog('\x1b[31mError: WebSocket is not connected.\x1b[0m', true);
                return;
            }
            const commandToSend = inputValue();
            ws.send(JSON.stringify({ type: 'STDIN_INPUT', payload: commandToSend }));
            addLog(`\x1b[38;5;39m> ${commandToSend}\x1b[0m`, true);
            setIsAwaitingInput(false);
            setInputValue('');
        }
    }

    function sendCommand(endpoint) {
        const commandName = endpoint.split('/').pop();
        fetch(endpoint, { method: 'POST' })
            .then((res) => {
                if (!res.ok) {
                    addLog(`\x1b[31mERROR: Command '${commandName}' failed - HTTP ${res.status}\x1b[0m`, true);
                } else {
                    addLog(`\x1b[32mSUCCESS: Command '${commandName}' sent.\x1b[0m`, true);
                }
            })
            .catch((err) => {
                addLog(`\x1b[31mERROR: Failed to send command '${commandName}': ${err.message}\x1b[0m`, true);
            });
    }

    const handleStartCommand = () => {
        setSiteLinkVisible(false);
        setLogs([]);
        addLog('INFO: Starting server...', true);
        sendCommand('/private/server/exocore/web/start');
    };
    const handleRestartCommand = () => {
        setSiteLinkVisible(false);
        setLogs([]);
        addLog('INFO: Restarting server...', true);
        sendCommand('/private/server/exocore/web/restart');
    };
    const handleStopCommand = () => {
        setSiteLinkVisible(false);
        addLog('INFO: Stop command sent.', true);
        sendCommand('/private/server/exocore/web/stop');
    };

    function toggleFullScreen() {
        const el = document.querySelector('.console-wrapper');
        if (!el) return;
        if (!document.fullscreenElement) {
            el.requestFullscreen().catch((err) => addLog('Error entering fullscreen: ' + err.message, true));
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
                addLog('\x1b[32mINFO: ANSI color processing enabled.\x1b[0m', true);
            }
        };
        document.head.appendChild(ansiScript);

        fetchUserInfo();

        const wsUrl = (window.location.protocol === 'https:' ? 'wss' : 'ws') + '://' + window.location.host + '/private/server/exocore/web/console';

        function connectWebSocket() {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => setWsStatus('Connected');
            ws.onclose = () => {
                setWsStatus('Disconnected');
                setTimeout(connectWebSocket, 2000);
            };
            ws.onerror = () => setWsStatus('Error');
            ws.onmessage = (e) => {
                try {
                    const message = JSON.parse(e.data);
                    if (message?.type === 'INPUT_REQUIRED') {
                        addLog(message.payload || 'Input required:');
                        setIsAwaitingInput(true);
                        setTimeout(() => inputRef?.focus(), 50);
                        scrollToBottom();
                    }
                } catch (error) {
                    addLog(e.data);
                }
            };
        }
        connectWebSocket();

        document.addEventListener('fullscreenchange', () => setIsFullScreen(!!document.fullscreenElement));
    });

    return (
        <div class="main-wrapper">
            <style>{`
              :root {
                --bg-primary: #111217; --bg-secondary: #1a1b23; --bg-tertiary: #0D0E12;
                --text-primary: #e0e0e0; --text-secondary: #8a8f98;
                --border-color: rgba(255, 255, 255, 0.1); --shadow-color: rgba(0, 0, 0, 0.5);
                --font-body: 'Roboto', sans-serif; --font-console: 'Fira Code', monospace;
                --radius-main: 16px; --radius-inner: 10px;
                --btn-start-bg: #28a745; --btn-start-hover: #218838;
                --btn-restart-bg: #007bff; --btn-restart-hover: #0069d9;
                --btn-stop-bg: #dc3545; --btn-stop-hover: #c82333;
                --success-color: #2ecc71; --warning-color: #f39c12; --error-color: #e74c3c;
                --system-message-color: #3498db;
              }
              body { background-color: var(--bg-primary); color: var(--text-primary); font-family: var(--font-body); margin: 0; }
              .main-wrapper { display: flex; justify-content: center; align-items: center; padding: 4vh 2vw; min-height: 100vh; }
              .app-container { background: var(--bg-secondary); padding: 2rem; width: 100%; max-width: 800px; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); display: flex; flex-direction: column; gap: 1.5rem; }
              .greeting-header { text-align: center; }
              .greeting { font-size: 2.25rem; font-weight: 700; color: #fff; letter-spacing: -1px; }
              .user-welcome { font-size: 1rem; color: var(--text-secondary); margin-top: 0.25rem; }
              .console-wrapper { border-radius: var(--radius-inner); background: var(--bg-tertiary); box-shadow: inset 0 4px 15px rgba(0,0,0,0.4); overflow: hidden; display: flex; flex-direction: column; height: 450px; border: 1px solid var(--border-color); position: relative; }
              .console-wrapper:fullscreen { width: 100vw; height: 100vh; border-radius: 0; border: none; }
              .console-header { background: var(--bg-secondary); padding: 0.6rem 1rem; display: flex; align-items: center; border-bottom: 1px solid var(--border-color); position: relative; }
              .console-header-dots { display: flex; gap: 8px; }
              .console-header-dots span { width: 12px; height: 12px; border-radius: 50%; }
              .console-header-dots .red-dot { background-color: #ff5f57; }
              .console-header-dots .yellow-dot { background-color: #ffbd2e; }
              .console-header-dots .green-dot { background-color: #28c940; }
              .fullscreen-btn { position: absolute; top: 50%; right: 1rem; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
              .fullscreen-btn:hover { color: var(--text-primary); background-color: rgba(255,255,255,0.1); }
              .console-container { flex-grow: 1; color: var(--text-primary); font-family: var(--font-console); font-size: 14px; line-height: 1.6; padding: 1rem; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
              .input-prompt-line { display: flex; }
              .input-prompt-line span:first-child { color: var(--accent-primary); margin-right: 0.5ch; }
              .input-prompt-line input { flex-grow: 1; background: transparent; border: none; color: var(--text-primary); font-family: var(--font-console); font-size: 14px; outline: none; padding: 0; }
              .controls { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
              .btn { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.5rem; font-size: 0.95rem; color: #fff; border: none; border-radius: var(--radius-inner); cursor: pointer; transition: all 0.2s ease; font-weight: 500; }
              .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
              .btn:active { transform: translateY(0); box-shadow: none; }
              .btn.start-btn { background-color: var(--btn-start-bg); }
              .btn.start-btn:hover { background-color: var(--btn-start-hover); }
              .btn.restart-btn { background-color: var(--btn-restart-bg); }
              .btn.restart-btn:hover { background-color: var(--btn-restart-hover); }
              .btn.stop-btn { background-color: var(--btn-stop-bg); }
              .btn.stop-btn:hover { background-color: var(--btn-stop-hover); }
            `}</style>
            <Show when={initialLoadComplete()} fallback={<div>Initializing...</div>}>
                <Show when={userData()} fallback={<div>Redirecting to login...</div>}>
                    <div class="app-container">
                        <div class="greeting-header">
                            <h2 class="greeting">Exocore Console</h2>
                            <span class="user-welcome">Welcome, {userData()?.user || 'User'}</span>
                        </div>
                        <div class="console-wrapper">
                            <div class="console-header">
                                <div class="console-header-dots">
                                    <span class="red-dot"></span><span class="yellow-dot"></span><span class="green-dot"></span>
                                </div>
                                <button class="fullscreen-btn" onClick={toggleFullScreen} title="Toggle Fullscreen">
                                    <Show when={isFullScreen()} fallback={<FullscreenIcon />}>
                                        <ExitFullscreenIcon />
                                    </Show>
                                </button>
                            </div>
                            <div class="console-container" ref={consoleContainerRef} onClick={() => inputRef?.focus()}>
                                <For each={logs()}>{(log) => <div innerHTML={log.html}></div>}</For>
                                <Show when={isAwaitingInput()}>
                                    <div class="input-prompt-line">
                                        <span>&gt;</span>
                                        <input ref={inputRef} type="text" value={inputValue()} onInput={(e) => setInputValue(e.currentTarget.value)} onKeyDown={handleInputSubmit} autofocus />
                                    </div>
                                </Show>
                            </div>
                        </div>
                        <div class="controls">
                            <button class="btn start-btn" onClick={handleStartCommand}><StartIcon /> Start Server</button>
                            <button class="btn restart-btn" onClick={handleRestartCommand}><RestartIcon /> Restart Server</button>
                            <button class="btn stop-btn" onClick={handleStopCommand}><StopIcon /> Stop Server</button>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}

render(() => <App />, document.getElementById('app'));