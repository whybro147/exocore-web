import { render } from 'solid-js/web';
import { createSignal, onMount, Show } from 'solid-js';

function App() {
    const [loading, setLoading] = createSignal(false);
    const [status, setStatus] = createSignal('');
    const [otp, setOtp] = createSignal('');
    const [sendDisabled, setSendDisabled] = createSignal(false);
    const [countdown, setCountdown] = createSignal(30);

    const getToken = () => localStorage.getItem('exocore-token') || '';
    const getCookies = () => localStorage.getItem('exocore-cookies') || '';

    function AlreadyOtp() {
        const token = getToken();
        const cookies = getCookies();
        if (token && cookies) {
            fetch('/private/server/exocore/web/userinfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, cookies }),
            })
            .then((res) => res.json())
            .then((res) => {
                const user = res.data?.user;
                if (user && user.verified === 'success') {
                    window.location.href = '/private/server/exocore/web/public/dashboard';
                }
            })
            .catch((err) => {
                console.warn('Auto-check failed:', err.message);
            });
        } else {
            window.location.href = '/private/server/exocore/web/public/login';
        }
    }

    onMount(() => {
        const otpCheckInterval = setInterval(AlreadyOtp, 3000);
    });

    async function sendOTP() {
        setLoading(true);
        setStatus('');
        setSendDisabled(true);
        setCountdown(30);
        const token = getToken();
        const cookies = getCookies();
        if (!token || !cookies) {
            setStatus('Authentication details not found. Please log in again.');
            setLoading(false);
            setSendDisabled(false);
            return;
        }
        try {
            const res = await fetch('/private/server/exocore/web/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, cookies, action: 'sent' }),
            });
            const data = await res.json();
            if (data.status === 'success') {
                setStatus(data.data?.message || 'OTP sent successfully!');
                startCountdown();
            } else {
                setStatus(data.data?.message || data.message || 'Could not send OTP.');
                setSendDisabled(false);
            }
        } catch (err) {
            setStatus(err.message);
            setSendDisabled(false);
        }
        setLoading(false);
    }

    async function submitOTP() {
        setLoading(true);
        setStatus('');
        const token = getToken();
        const cookies = getCookies();
        if (!token || !cookies) {
            setStatus('Authentication details not found. Please log in again.');
            setLoading(false);
            return;
        }
        if (!otp()) {
            setStatus('Please enter the OTP.');
            setLoading(false);
            return;
        }
        try {
            const res = await fetch('/private/server/exocore/web/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, cookies, otp: otp(), action: 'submit' }),
            });
            const data = await res.json();
            if (data.status === 'success') {
                setStatus(data.data?.message || 'OTP verified successfully! Redirecting...');
                setTimeout(AlreadyOtp, 1000);
            } else {
                setStatus(data.data?.message || data.message || 'Invalid OTP.');
            }
        } catch (err) {
            setStatus(err.message);
        }
        setLoading(false);
    }

    function startCountdown() {
        let timeLeft = 30;
        setCountdown(timeLeft);
        const interval = setInterval(() => {
            timeLeft--;
            setCountdown(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(interval);
                setSendDisabled(false);
                setCountdown(30);
            }
        }, 1000);
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            submitOTP();
        }
    };

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
                .otp-page-wrapper { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 2rem; box-sizing: border-box; }
                .otp-card { background: var(--bg-secondary); width: 100%; max-width: 450px; padding: 3rem; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); animation: fadeIn 0.5s ease-out; text-align: center; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .otp-header { margin-bottom: 1rem; color: var(--text-primary); font-size: 2rem; font-weight: 700; }
                .otp-subtext { color: var(--text-secondary); margin-bottom: 2.5rem; line-height: 1.6; }

                .form-group { margin-bottom: 1.5rem; text-align: left; }
                .form-label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary); font-weight: 500; }
                .otp-input { width: 100%; padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-inner); font-family: var(--font-body); font-size: 1.5rem; background-color: var(--bg-primary); color: var(--text-primary); box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; text-align: center; letter-spacing: 0.5em; }
                .otp-input:focus { outline:0; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.2); }
                .otp-input::placeholder { letter-spacing: normal; }

                .btn { width: 100%; padding: 0.9rem 1.5rem; border: none; border-radius: var(--radius-inner); color: #fff; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .btn-primary { background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary)); }
                .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 170, 255, 0.2); }
                .btn-secondary { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); }
                .btn-secondary:hover:not(:disabled) { background-color: var(--border-color); color: var(--text-primary); }

                .status-message { text-align: center; margin-top: 1.5rem; padding: 0.8rem; border-radius: var(--radius-inner); font-weight: 500; }
                .status-success { background-color: rgba(46, 204, 113, 0.15); color: var(--success-color); border: 1px solid var(--success-color); }
                .status-error { background-color: rgba(231, 76, 60, 0.15); color: var(--error-color); border: 1px solid var(--error-color); }
            `}</style>
            <div class="otp-card">
                <h1 class="otp-header">Account Verification</h1>
                <p class="otp-subtext">A verification code may be sent to your email. Please enter it below.</p>

                <div class="form-group">
                    <label class="form-label" for="otpInput">Verification Code</label>
                    <input id="otpInput" class="otp-input" type="text" value={otp()} onInput={(e) => setOtp(e.currentTarget.value)} onKeyPress={handleKeyPress} placeholder="------" maxlength="6"/>
                </div>

                <button class="btn btn-primary" style={{"margin-bottom": "1rem"}} onClick={submitOTP} disabled={loading() || !otp() || otp().length < 6}>
                    {loading() ? 'Verifying...' : 'Verify Account'}
                </button>

                <button class="btn btn-secondary" onClick={sendOTP} disabled={loading() || sendDisabled()}>
                    {sendDisabled() ? `Resend in ${countdown()}s` : 'Send New Code'}
                </button>

                <Show when={status()}>
                    <div class={`status-message ${status().includes('Success') ? 'status-success' : 'status-error'}`}>
                        {status()}
                    </div>
                </Show>
            </div>
        </div>
    );
}

render(() => <App />, document.getElementById('app'));