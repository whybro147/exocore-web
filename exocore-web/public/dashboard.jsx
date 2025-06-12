import { render } from 'solid-js/web';
import { createSignal, onMount, Show, For } from 'solid-js';

// --- Icons for new features ---
const BellIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;
const MegaphoneIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.61V14a2 2 0 0 0 2 2h3l8 5V4l-8 5H5a2 2 0 0 0-2 2.39zM19.13 6.87a8.55 8.55 0 0 1 0 10.26"/></svg>;

function App() {
    const [loading, setLoading] = createSignal(true);
    const [status, setStatus] = createSignal('');
    const [userData, setUserData] = createSignal(null);
    const [globalNotifications, setGlobalNotifications] = createSignal({});
    const [showUserNotifications, setShowUserNotifications] = createSignal(false);
    const [showGlobalNotifications, setShowGlobalNotifications] = createSignal(false);

    const getToken = () => localStorage.getItem('exocore-token') || '';
    const getCookies = () => localStorage.getItem('exocore-cookies') || '';

    async function fetchUserInfo() {
        const token = getToken();
        const cookies = getCookies();

        if (!token || !cookies) {
            window.location.href = '/private/server/exocore/web/public/login';
            return;
        }

        try {
            const res = await fetch('/private/server/exocore/web/userinfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, cookies }),
            });

            const data = await res.json();

            if (data.data?.user && data.data.user.verified === 'success') {
                setUserData(data.data.user);
                setGlobalNotifications(data.data.global?.notifications || {});
                setStatus('');
            } else {
                window.location.href = '/private/server/exocore/web/public/login';
            }
        } catch (err) {
            setStatus('Failed to fetch user info: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    function timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        let interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "Just now";
    }

    onMount(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        // Styles are now controlled by the <style> tag below
        fetchUserInfo();
    });

    return (
        <div class="page-wrapper-dark">
            <style>
                {`
                    /* --- Dark Theme Variables --- */
                    :root {
                        --bg-dark: #111217;
                        --card-bg-dark: #1a1b23;
                        --dropdown-bg-dark: #2a2c3b;
                        --text-primary-dark: #e0e0e0;
                        --text-secondary-dark: #8a8f98;
                        --accent-dark: #00aaff;
                        --border-dark: rgba(255, 255, 255, 0.1);
                    }

                    .page-wrapper-dark {
                        background-color: var(--bg-dark);
                        font-family: 'Patrick Hand', cursive;
                        padding: 3vh 2vw;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        box-sizing: border-box;
                        animation: fadeIn 1s ease forwards;
                        opacity: 0;
                    }
                    @keyframes fadeIn { to { opacity: 1; } }

                    .main-card-dark {
                        width: 100%;
                        max-width: 480px;
                        min-height: 320px;
                        background-color: var(--card-bg-dark);
                        border-radius: 16px;
                        border: 1px solid var(--border-dark);
                        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                        padding: 2rem;
                        text-align: center;
                        user-select: none;
                        color: var(--text-primary-dark);
                    }

                    .greeting-dark strong {
                        color: var(--accent-dark);
                    }

                    .info-text-dark {
                        color: var(--text-secondary-dark);
                        font-size: 1.2rem;
                    }

                    .info-text-dark strong {
                        color: var(--text-primary-dark);
                        font-weight: 700;
                    }

                    .status-box { font-family: inherit; margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 6px; color: #f8d7da; background-color: rgba(220, 53, 69, 0.2); border: 1px solid rgba(220, 53, 69, 0.5); font-weight: 700; }

                    .card-header { display: flex; justify-content: flex-end; gap: 0.5rem; margin-bottom: 1rem; position: relative; }
                    .notification-btn { position: relative; background: none; border: none; cursor: pointer; padding: 5px; color: var(--text-secondary-dark); }
                    .notification-btn:hover { color: var(--text-primary-dark); }
                    .notification-count { position: absolute; top: 0; right: 0; background: #dc3545; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 11px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--card-bg-dark); }
                    .notification-dropdown { position: absolute; top: 120%; right: 0; width: 300px; background: var(--dropdown-bg-dark); border-radius: 8px; border: 1px solid var(--border-dark); box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 100; text-align: left; }
                    .notification-item { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-dark); }
                    .notification-item:last-child { border-bottom: none; }
                    .notification-from { font-weight: 700; color: var(--text-primary-dark); }
                    .notification-message { margin: 0.25rem 0; color: var(--text-secondary-dark); }
                    .notification-date { font-size: 0.9rem; color: var(--text-secondary-dark); opacity: 0.7; }

                    .plans-link { display: inline-block; background-color: var(--accent-dark); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 1.5rem; font-weight: 700; transition: background-color 0.2s, transform 0.2s; }
                    .plans-link:hover { background-color: #0088cc; transform: translateY(-2px); }
                `}
            </style>

            <div class="main-card-dark">

                <Show when={!loading()}
                    fallback={<p style={{ fontSize: '1.2rem', color: 'var(--text-secondary-dark)' }}>Loading user info...</p>}
                >
                    <Show when={userData()}
                        fallback={<div class="status-box">{status() || 'Could not load user data.'}</div>}
                    >
                        <>
                            <div class="card-header">
                                <button class="notification-btn" title="Global Announcements" onClick={() => { setShowGlobalNotifications(p => !p); setShowUserNotifications(false); }}>
                                    <MegaphoneIcon />
                                    <Show when={Object.keys(globalNotifications()).length > 0}>
                                        <span class="notification-count">{Object.keys(globalNotifications()).length}</span>
                                    </Show>
                                </button>
                                <button class="notification-btn" title="Your Notifications" onClick={() => { setShowUserNotifications(p => !p); setShowGlobalNotifications(false); }}>
                                    <BellIcon />
                                    <Show when={userData().notification?.length > 0}>
                                        <span class="notification-count">{userData().notification.length}</span>
                                    </Show>
                                </button>

                                <Show when={showGlobalNotifications()}>
                                    <div class="notification-dropdown">
                                        <For each={Object.entries(globalNotifications())} fallback={<div class="notification-item">No announcements</div>}>
                                            {([from, message]) => (
                                                <div class="notification-item">
                                                    <p class="notification-from">From: {from}</p>
                                                    <p class="notification-message">{message}</p>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>

                                <Show when={showUserNotifications()}>
                                    <div class="notification-dropdown">
                                        <For each={userData().notification} fallback={<div class="notification-item">No notifications</div>}>
                                            {(notif) => (
                                                <div class="notification-item">
                                                    <p class="notification-from">From: {notif.from}</p>
                                                    <p class="notification-message">{notif.message}</p>
                                                    <p class="notification-date">{timeAgo(notif.date)}</p>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>

                            <p class="greeting-dark" style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>
                                Hello, <strong>{userData().user}</strong>!
                            </p>
                            <p class="info-text-dark" style={{ marginBottom: '1rem' }}>
                                Level: <strong>{userData().level}</strong>
                            </p>
                            <p class="info-text-dark">
                                Days since joined: <strong>{userData().count_days}</strong>
                            </p>
                            <a href="/private/server/exocore/web/public/plans" class="plans-link">Manage Plan</a>
                                
                        </>
                        
                    </Show>
                </Show>
<a href="https://www.facebook.com/share/15k6A3oWbR/" target="_blank" rel="noopener noreferrer" class="follow-link">
                                    Follow Exocore on Facebook
                                </a>
            </div>
        </div>
    );
}

render(() => <App />, document.getElementById('app'));

add
const planStylesConfig = {
    "Core Access": {
        textGrad1: '#D0A9F5', textGrad2: '#E8D4F7', cardGrad1: '#6A0DAD', cardGrad2: '#A74AC7',
        cardBorder: '#4B0082', textColor: '#FFFFFF', iconFill: '#E8D4F7', glowColor: '#E0BBE4'
    },
    "Prime Core": {
        textGrad1: '#FFEB3B', textGrad2: '#FFF59D', cardGrad1: '#FBC02D', cardGrad2: '#FFD700',
        cardBorder: '#B98B00', textColor: '#1A1A1A', iconFill: '#424242', glowColor: '#FFFACD'
    },
    "Alpha Core": {
        textGrad1: '#00BCD4', textGrad2: '#80DEEA', cardGrad1: '#03A9F4', cardGrad2: '#4FC3F7',
        cardBorder: '#0277BD', textColor: '#FFFFFF', iconFill: '#B2EBF2', glowColor: '#80DEEA'
    },
    "EXO Elite": {
        textGrad1: '#F44336', textGrad2: '#FF8A80', cardGrad1: '#D32F2F', cardGrad2: '#E57373',
        cardBorder: '#9A0007', textColor: '#FFFFFF', iconFill: '#FFCDD2', glowColor: '#FF8A80'
    },
    "Hacker Core": {
        textGrad1: '#4CAF50', textGrad2: '#A5D6A7', cardGrad1: '#388E3C', cardGrad2: '#66BB6A',
        cardBorder: '#1B5E20', textColor: '#FFFFFF', iconFill: '#C8E6C9', glowColor: '#A5D6A7'
    }
};
const defaultPlanStyle = {
    textGrad1: '#B0BEC5', textGrad2: '#ECEFF1', cardGrad1: '#455A64', cardGrad2: '#607D8B',
    cardBorder: '#263238', textColor: '#FFFFFF', iconFill: '#ECEFF1', glowColor: '#90A4AE'
};