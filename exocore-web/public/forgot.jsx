import { render } from 'solid-js/web';
import { createSignal, Show, onMount } from 'solid-js';

const IconEye = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const IconEyeOff = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;

function App() {
    const [step, setStep] = createSignal(1);
    const [loading, setLoading] = createSignal(false);
    const [status, setStatus] = createSignal('');
    const [identifier, setIdentifier] = createSignal('');
    const [otpCode, setOtpCode] = createSignal('');
    const [newPass, setNewPass] = createSignal('');
    const [showPass, setShowPass] = createSignal(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setStatus('');
        let body = {};
        let action = '';
        let nextStep = 0;
        if (step() === 1) {
            if (!identifier()) {
                setStatus('Please enter your username or email.');
                setLoading(false);
                return;
            }
            action = 'SendOtp';
            body = { identifier: identifier(), action };
            nextStep = 2;
        } else if (step() === 2) {
            if (!otpCode() || !newPass()) {
                setStatus('Please fill in both the OTP and your new password.');
                setLoading(false);
                return;
            }
            action = 'ResetPassword';
            body = { identifier: identifier(), action, otpCode: otpCode(), newPass: newPass() };
        }
        try {
            const res = await fetch('/private/server/exocore/web/forgotpass', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed.');
            setStatus(data.data.message || 'Success.');
            if (nextStep) {
                setStep(nextStep);
            } else {
                setTimeout(() => {
                    window.location.href = '/private/server/exocore/web/public/login';
                }, 2000);
            }
        } catch (err) {
            setStatus(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div class="otp-page-wrapper">
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
                .otp-page-wrapper { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1rem; box-sizing: border-box; }
                .otp-card { background: var(--bg-secondary); width: 100%; max-width: 420px; padding: 2.5rem; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); animation: fadeIn 0.5s ease-out; text-align: center; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .otp-header { margin-bottom: 0.75rem; color: var(--text-primary); font-size: 1.75rem; font-weight: 700; }
                .otp-subtext { color: var(--text-secondary); margin-bottom: 2rem; line-height: 1.5; font-size: 0.95rem; }
                .form-group { margin-bottom: 1.25rem; text-align: left; }
                .form-label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary); font-weight: 500; }
                .form-input { width: 100%; padding: 0.8rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-inner); font-family: var(--font-body); font-size: 1rem; background-color: var(--bg-primary); color: var(--text-primary); box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
                .form-input:focus { outline:0; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.2); }
                .otp-input { text-align: center; letter-spacing: 0.5em; font-size: 1.5rem !important; }
                .otp-input::placeholder { letter-spacing: normal; }
                .input-wrapper { position: relative; display: flex; align-items: center; }
                .password-toggle { position: absolute; right: 0.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; padding: 0.5rem; border-radius: 50%; }
                .password-toggle:hover { color: var(--accent-primary); }
                .btn { width: 100%; padding: 0.9rem 1.5rem; border: none; border-radius: var(--radius-inner); background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary)); color: #fff; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .status-message { text-align: center; margin-top: 1.5rem; padding: 0.8rem; border-radius: var(--radius-inner); font-weight: 500; }
                .status-success { background-color: rgba(46, 204, 113, 0.15); color: var(--success-color); border: 1px solid var(--success-color); }
                .status-error { background-color: rgba(231, 76, 60, 0.15); color: var(--error-color); border: 1px solid var(--error-color); }
                .login-link-wrapper { text-align: center; margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; }
                .login-link { color: var(--accent-primary); text-decoration: none; font-weight: 500; }
            `}</style>
            <div class="otp-card">
                <form onSubmit={handleSubmit}>
                    <h1 class="otp-header">Forgot Password</h1>
                    <Show when={step() === 1}
                        fallback={
                            <>
                                <p class="otp-subtext">A code was sent. Enter it below with your new password.</p>
                                <div class="form-group">
                                    <label class="form-label" for="otpCode">Verification Code</label>
                                    <input id="otpCode" class="form-input otp-input" type="text" value={otpCode()} onInput={e => setOtpCode(e.currentTarget.value.replace(/\s/g, ''))} placeholder="------" maxlength="6"/>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="newPass">New Password</label>
                                    <div class="input-wrapper">
                                        <input id="newPass" class="form-input" type={showPass() ? 'text' : 'password'} value={newPass()} onInput={e => setNewPass(e.currentTarget.value.replace(/\s/g, ''))} />
                                        <button type="button" class="password-toggle" onClick={() => setShowPass(!showPass())}>
                                            <Show when={showPass()} fallback={<IconEye />}><IconEyeOff /></Show>
                                        </button>
                                    </div>
                                </div>
                                <button class="btn btn-primary" type="submit" disabled={loading() || !otpCode() || !newPass()}>{loading() ? 'Resetting...' : 'Reset Password'}</button>
                            </>
                        }
                    >
                        <p class="otp-subtext">Enter your username or email to receive a verification code.</p>
                        <div class="form-group">
                            <label class="form-label" for="identifier">Username or Email</label>
                            <input id="identifier" class="form-input" type="text" value={identifier()} onInput={e => setIdentifier(e.currentTarget.value.replace(/\s/g, ''))} />
                        </div>
                        <button class="btn btn-primary" type="submit" disabled={loading()}>{loading() ? 'Sending...' : 'Send Code'}</button>
                    </Show>
                </form>
                <Show when={status()}>
                    <div class={`status-message ${status().toLowerCase().includes('success') ? 'status-success' : 'status-error'}`}>{status()}</div>
                </Show>
                <div class="login-link-wrapper">
                    Remembered your password? <a href="/private/server/exocore/web/public/login" class="login-link">Login here</a>
                </div>
            </div>
        </div>
    );
}

render(() => <App />, document.getElementById('app'));