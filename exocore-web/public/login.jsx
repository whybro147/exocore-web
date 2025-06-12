import { render } from 'solid-js/web';
import { createSignal, onMount, Show } from 'solid-js';

const IconEye = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const IconEyeOff = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;

function App() {
    const [loading, setLoading] = createSignal(false);
    const [status, setStatus] = createSignal('');
    const [form, setForm] = createSignal({ user: '', pass: '' });
    const [showPass, setShowPass] = createSignal(false);
    const [ready, setReady] = createSignal(false);

    function LoggedAlready() {
        const token = localStorage.getItem('exocore-token');
        const cookies = localStorage.getItem('exocore-cookies');
        if (token && cookies) {
            fetch('/private/server/exocore/web/userinfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, cookies }),
            })
            .then((res) => {
                if (!res.ok) { return res.json().then((errData) => { throw new Error(errData.message || `HTTP error! status: ${res.status}`); }).catch(() => { throw new Error(`HTTP error! status: ${res.status}`); }); }
                return res.json();
            })
            .then((data) => {
                const user = data.data?.user;
                if (user) {
                    if (!user.verified) {
                        window.location.href = '/private/server/exocore/web/public/otp';
                    } else {
                        window.location.href = '/private/server/exocore/web/public/dashboard';
                    }
                }
            })
            .catch((err) => {
                console.warn('Auto-check failed:', err.message);
            });
        }
    }

    onMount(() => {
        setReady(true);
        LoggedAlready();
        setInterval(LoggedAlready, 2000);
    });

    async function handleLogin() {
        setLoading(true);
        setStatus('');
        const userValue = form().user;
        const passValue = form().pass;
        if (!userValue || !passValue) {
            setStatus('Username and password cannot be empty.');
            setLoading(false);
            return;
        }
        try {
            const res = await fetch('/private/server/exocore/web/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: userValue, pass: passValue }),
            });
            const data = await res.json();
            if (!res.ok) { throw new Error(data.message || `Login HTTP error! status: ${res.status}`); }
            if (data.success && data.data?.status === 'success') {
                const { token, cookies } = data.data;
                localStorage.setItem('exocore-token', token);
                localStorage.setItem('exocore-cookies', JSON.stringify(cookies));
                setStatus('Login successful! Redirecting...');
                LoggedAlready();
            } else {
                setStatus(data.message || 'Login failed.');
            }
        } catch (err) {
            setStatus(err.message);
        }
        setLoading(false);
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };

    return (
        <Show when={ready()}>
            <div class="login-page-wrapper">
                <style>{`
                    :root {
                        --bg-primary: #111217; --bg-secondary: #1a1b23; --text-primary: #e0e0e0;
                        --text-secondary: #8a8f98; --accent-primary: #00aaff; --accent-secondary: #0088cc;
                        --border-color: rgba(255, 255, 255, 0.1); --shadow-color: rgba(0, 0, 0, 0.5);
                        --radius-main: 16px; --radius-inner: 12px;
                        --font-body: 'Roboto', sans-serif;
                        --success-color: #2ecc71; --error-color: #e74c3c;
                    }
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
                    body { background-color: var(--bg-primary); font-family: var(--font-body); margin: 0; }
                    .login-page-wrapper { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 2rem; box-sizing: border-box; }
                    .login-card { background: var(--bg-secondary); width: 100%; max-width: 420px; padding: 3rem; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); animation: fadeIn 0.5s ease-out; }
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    .login-header { text-align: center; margin-bottom: 2.5rem; color: var(--text-primary); font-size: 2rem; font-weight: 700; }
                    .form-group { margin-bottom: 1.5rem; }
                    .form-label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary); font-weight: 500; }
                    .input-wrapper { position: relative; }
                    .form-input { width: 100%; padding: 0.9rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-inner); font-family: var(--font-body); font-size: 1rem; background-color: var(--bg-primary); color: var(--text-primary); box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
                    .form-input:focus { outline:0; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.2); }
                    .password-toggle { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0.25rem; display: flex; align-items: center; }
                    .password-toggle:hover { color: var(--accent-primary); }
                    .login-btn { width: 100%; padding: 0.9rem 1.5rem; border: none; border-radius: var(--radius-inner); background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary)); color: #fff; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
                    .login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 170, 255, 0.2); }
                    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                    .status-message { text-align: center; margin-top: 1.5rem; padding: 0.8rem; border-radius: var(--radius-inner); font-weight: 500; }
                    .status-success { background-color: rgba(46, 204, 113, 0.15); color: var(--success-color); border: 1px solid var(--success-color); }
                    .status-error { background-color: rgba(231, 76, 60, 0.15); color: var(--error-color); border: 1px solid var(--error-color); }
                    .links-wrapper { text-align: center; margin-top: 2rem; color: var(--text-secondary); }
                    .form-link { color: var(--accent-primary); text-decoration: none; font-weight: 500; }
                    .form-link:hover { text-decoration: underline; color: var(--accent-secondary); }
                    .links-separator { margin: 0 0.5rem; }
                `}</style>
                <div class="login-card">
                    <h1 class="login-header">Exocore Login</h1>
                    <div class="form-group">
                        <label class="form-label" for="username">Username or Email</label>
                        <input id="username" class="form-input" type="text" value={form().user} onInput={(e) => setForm(f => ({ ...f, user: e.currentTarget.value.replace(/\s/g, '') }))} onKeyPress={handleKeyPress} />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="password">Password</label>
                        <div class="input-wrapper">
                            <input id="password" class="form-input" type={showPass() ? 'text' : 'password'} value={form().pass} onInput={(e) => setForm(f => ({ ...f, pass: e.currentTarget.value.replace(/\s/g, '') }))} onKeyPress={handleKeyPress} />
                            <button type="button" class="password-toggle" onClick={() => setShowPass(!showPass())}>
                                <Show when={showPass()} fallback={<IconEye />}>
                                    <IconEyeOff />
                                </Show>
                            </button>
                        </div>
                    </div>
                    <button class="login-btn" onClick={handleLogin} disabled={loading() || !form().user || !form().pass}>
                        {loading() ? 'Logging in...' : 'Login'}
                    </button>
                    <Show when={status()}>
                        <div class={`status-message ${status().includes('successful') ? 'status-success' : 'status-error'}`}>
                            {status()}
                        </div>
                    </Show>
                    <div class="links-wrapper">
                        <a href="/private/server/exocore/web/public/forgot-password" class="form-link">Forgot Password?</a>
                        <span class="links-separator">&bull;</span>
                        <a href="/private/server/exocore/web/public/register" class="form-link">Register here</a>
                    </div>
                </div>
            </div>
        </Show>
    );
}

render(() => <App />, document.getElementById('app'));