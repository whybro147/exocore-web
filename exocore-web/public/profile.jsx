import { render } from 'solid-js/web';
import { createSignal, onMount, Show, For } from 'solid-js';

const IconPencil = () => <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>;
const IconAdd = () => <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" style="vertical-align: middle; margin-right: 4px;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>;
const IconCode = () => <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>;

const getBasename = (filePath) => {
    if (!filePath) return '';
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] || '';
};

const getSkillIcon = (extension, displayName) => {
    const iconPath = `/private/server/exocore/web/public/icons/${extension.toLowerCase()}.svg`;
    return (
        <img
            src={iconPath}
            alt={`${displayName} icon`}
            class="skill-icon"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentNode.querySelector('.fallback-icon').style.display = 'block';
            }}
        />
    );
};

const planStylesConfig = {
    "Core Access": {
        textGrad1: '#D0A9F5', textGrad2: '#E8D4F7', cardGrad1: '#6A0DAD', cardGrad2: '#A74AC7',
        cardBorder: 'rgba(75, 0, 130, 0.8)', textColor: '#FFFFFF', iconFill: '#E8D4F7', glowColor: 'rgba(224, 187, 228, 0.3)'
    },
    "Prime Core": {
        textGrad1: '#FFEB3B', textGrad2: '#FFF59D', cardGrad1: '#FBC02D', cardGrad2: '#FFD700',
        cardBorder: 'rgba(185, 139, 0, 0.8)', textColor: '#1A1A1A', iconFill: '#424242', glowColor: 'rgba(255, 250, 205, 0.4)'
    },
    "Alpha Core": {
        textGrad1: '#00BCD4', textGrad2: '#80DEEA', cardGrad1: '#03A9F4', cardGrad2: '#4FC3F7',
        cardBorder: 'rgba(2, 119, 189, 0.8)', textColor: '#FFFFFF', iconFill: '#B2EBF2', glowColor: 'rgba(128, 222, 234, 0.3)'
    },
    "EXO Elite": {
        textGrad1: '#F44336', textGrad2: '#FF8A80', cardGrad1: '#D32F2F', cardGrad2: '#E57373',
        cardBorder: 'rgba(154, 0, 7, 0.8)', textColor: '#FFFFFF', iconFill: '#FFCDD2', glowColor: 'rgba(255, 138, 128, 0.3)'
    },
    "Hacker Core": {
        textGrad1: '#4CAF50', textGrad2: '#A5D6A7', cardGrad1: '#000000', cardGrad2: '#388E3C',
        cardBorder: 'rgba(27, 94, 32, 0.8)', textColor: '#00FF00', iconFill: '#C8E6C9', glowColor: 'rgba(165, 214, 167, 0.3)'
    }
};

const defaultPlanStyle = {
    textGrad1: '#B0BEC5', textGrad2: '#ECEFF1', cardGrad1: '#455A64', cardGrad2: '#607D8B',
    cardBorder: 'rgba(38, 50, 56, 0.8)', textColor: '#FFFFFF', iconFill: '#ECEFF1', glowColor: 'rgba(144, 164, 174, 0.2)'
};

function App() {
    const [loading, setLoading] = createSignal(true);
    const [status, setStatus] = createSignal({ type: '', message: '' });
    const [userData, setUserData] = createSignal(null);
    const [editingBio, setEditingBio] = createSignal(false);
    const [editingNickname, setEditingNickname] = createSignal(false);
    const [nickname, setNickname] = createSignal('');
    const [bio, setBio] = createSignal('');
    const [modalOpen, setModalOpen] = createSignal(false);
    const [modalAction, setModalAction] = createSignal(() => {});
    const [projectSkills, setProjectSkills] = createSignal(null);

    const avatarDimensions = {
        mobile: { headerH: 170, avatarH: 110, overlap: 55 },
        tablet: { headerH: 240, avatarH: 140, overlap: 70 },
        desktop: { headerH: 280, avatarH: 160, overlap: 80 },
    };

    const getToken = () => localStorage.getItem('exocore-token') || '';
    const getCookies = () => localStorage.getItem('exocore-cookies') || '';

    async function fetchUserInfo() {
        // Don't set loading to true here if it's a re-fetch,
        // it will be handled by the calling function.
        // setLoading(true); 
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
                // fetch skills only if user data is successfully fetched
                fetchSkills();
            } else {
                setUserData(null);
                setStatus({ type: 'error', message: data.message || 'User verification failed. Redirecting...' });
                setTimeout(() => { window.location.href = '/private/server/exocore/web/public/login'; }, 2500);
            }
        } catch (err) {
            setUserData(null);
            setStatus({ type: 'error', message: 'Failed to fetch user info: ' + err.message + '. Redirecting...' });
            setTimeout(() => { window.location.href = '/private/server/exocore/web/public/login'; }, 2500);
        } finally {
            setLoading(false);
        }
    }

    async function fetchSkills() {
        try {
            const skillsRes = await fetch('/private/server/exocore/web/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (skillsRes.ok) {
                const skillsData = await skillsRes.json();
                setProjectSkills(skillsData && skillsData.length > 0 ? skillsData[0] : null);
            } else {
                console.error("Failed to fetch skills:", skillsRes.status);
                setProjectSkills(null);
            }
        } catch (skillsErr) {
            console.error("Error fetching skills:", skillsErr);
            setProjectSkills(null);
        }
    }

    async function handleUpdate(field, value, endEditStateFn) {
        setLoading(true);
        setModalOpen(false); // Close modal if open

        const token = getToken();
        const cookies = getCookies();

        try {
            const res = await fetch('/private/server/exocore/web/userinfoEdit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, cookies, field, edit: value }),
            });

            const data = await res.json();

            // Check if the response is NOT OK or if there's an explicit error message
            if (!res.ok || data.success === false) {
                throw new Error(data.message || 'An unknown error occurred.');
            }

            // SUCCESS!
            setStatus({ type: 'success', message: data.message || 'Update successful!' });
            setTimeout(() => setStatus({ type: '', message: '' }), 3000);

            // Re-fetch the single source of truth to ensure UI is in sync.
            await fetchUserInfo();

            if (endEditStateFn) {
                endEditStateFn(false);
            }

        } catch (err) {
            setStatus({ type: 'error', message: 'Update failed: ' + err.message });
            setTimeout(() => setStatus({ type: '', message: '' }), 3000);
        } finally {
            // Loading is set to false inside fetchUserInfo's finally block
            // setLoading(false);
        }
    }

    function openImageModal(field) {
        setModalAction(() => () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.heic,.heif';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) { // 10MB limit
                        setStatus({ type: 'error', message: 'Max file size: 10MB.' });
                        setTimeout(() => setStatus({ type: '', message: '' }), 3000);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => handleUpdate(field, reader.result);
                    reader.onerror = () => {
                        setStatus({ type: 'error', message: 'Error reading file.' });
                        setTimeout(() => setStatus({ type: '', message: '' }), 3000);
                    }
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        });
        setModalOpen(true);
    }

    onMount(() => {
        setLoading(true);
        fetchUserInfo();
    });

    const Spinner = () => <div class="spinner"></div>;

    const activePlanStyles = () => {
        const planName = userData()?.activePlan?.plan;
        return planStylesConfig[planName] || defaultPlanStyle;
    };

    return (
        <>
            <style>{`
                /* ... (Yung CSS mo dito, walang pagbabago) ... */
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

                :root {
                    --bg-primary: #111217; --bg-secondary: #1a1b23; --bg-tertiary: #2a2c3b;
                    --text-primary: #e0e0e0; --text-secondary: #8a8f98; --accent-primary: #00aaff;
                    --accent-secondary: #0088cc; --success-color: #2ecc71; --error-color: #e74c3c;
                    --border-color: rgba(255, 255, 255, 0.1); --shadow-color: rgba(0, 0, 0, 0.5);
                    --radius-main: 16px; --radius-inner: 12px;
                    --font-body: 'Roboto', sans-serif;

                    --avatar-mobile-top: ${avatarDimensions.mobile.headerH - avatarDimensions.mobile.overlap}px;
                    --avatar-tablet-top: ${avatarDimensions.tablet.headerH - avatarDimensions.tablet.overlap}px;
                    --avatar-desktop-top: ${avatarDimensions.desktop.headerH - avatarDimensions.desktop.overlap}px;
                }

                body { background-color: var(--bg-primary); font-family: var(--font-body); color: var(--text-primary); margin: 0; }
                .profile-container { display: flex; justify-content: center; align-items: flex-start; padding: 2rem 1rem; min-height: 100vh; box-sizing: border-box; }
                .profile-card { background: var(--bg-secondary); border-radius: var(--radius-main); box-shadow: 0 15px 40px var(--shadow-color); width: 100%; max-width: 600px; position: relative; border: 1px solid var(--border-color); }
                .profile-header { position: relative; height: ${avatarDimensions.mobile.headerH}px; border-top-left-radius: var(--radius-main); border-top-right-radius: var(--radius-main); overflow: hidden; }
                .cover-photo { width: 100%; height: 100%; object-fit: cover; cursor: pointer; transition: transform 0.4s ease; }
                .cover-photo:hover { transform: scale(1.05); }
                .avatar { width: ${avatarDimensions.mobile.avatarH}px; height: ${avatarDimensions.mobile.avatarH}px; border-radius: 50%; object-fit: cover; background-color: var(--bg-tertiary); border: 5px solid var(--bg-secondary); box-shadow: 0 8px 25px rgba(0,0,0,0.3); position: absolute; top: var(--avatar-mobile-top); left: 50%; transform: translateX(-50%); cursor: pointer; transition: transform 0.3s ease; z-index: 3; }
                .avatar:hover { transform: translateX(-50%) scale(1.1); }
                .profile-body { padding: ${avatarDimensions.mobile.overlap + 15}px 1.5rem 1.5rem; text-align: center; }

                .nickname-container { display: flex; align-items: center; justify-content: center; gap: .75rem; min-height: 42px; }
                .nickname-text { font-size: 2rem; font-weight: 700; color: var(--text-primary); }
                .user-details { color: var(--text-secondary); margin: 0.25rem 0 1.5rem 0; }
                
                .active-plan-container {
                    display: inline-flex;
                    align-items: center;
                    color: #fff;
                    padding: 0.3rem 0.8rem;
                    border-radius: 15px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    margin-top: -0.5rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                .active-plan-container span {
                    margin-left: 0.3rem;
                }

                .bio-section, .skills-section { margin-top: 1.5rem; padding: 1.5rem; background-color: var(--bg-tertiary); border-radius: var(--radius-inner); text-align: left; }
                .bio-section h3, .skills-section h3 { margin: 0 0 1rem 0; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center; font-size: 1.2rem; }
                .bio-text { color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; font-size: 1rem; }

                .edit-icon-btn { background: none; border: none; padding: .3rem; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; gap: .4rem; font-size: .9rem; font-family: var(--font-body); }
                .edit-icon-btn:hover { color: var(--accent-primary); }

                .edit-controls { display: flex; flex-direction: column; gap: .8rem; animation: fadeIn .3s ease; }
                .edit-controls input, .edit-controls textarea { width: 100%; padding: .8rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-inner); font-family: var(--font-body); font-size: 1rem; background-color: var(--bg-primary); color: var(--text-primary); box-sizing: border-box; }
                .edit-controls input:focus, .edit-controls textarea:focus { outline:0; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.2); }
                .edit-controls textarea { min-height: 90px; resize: vertical; }

                .edit-controls-buttons { display: flex; justify-content: flex-end; gap: .6rem; }
                .btn { display: inline-flex; align-items: center; justify-content: center; padding: .6rem 1.2rem; border: none; border-radius: var(--radius-inner); cursor: pointer; font-family: var(--font-body); font-size: 1rem; font-weight: 500; transition: all .2s ease; }
                .btn-primary { background: var(--accent-primary); color: #fff; }
                .btn-primary:hover { background: var(--accent-secondary); }
                .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
                .btn-secondary:hover { background: var(--border-color); }

                .status-message-container { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:1001; }
                .status-message { padding: .8rem 1.5rem; border-radius: var(--radius-inner); color: #fff; box-shadow: 0 5px 20px rgba(0,0,0,0.3); animation: slideInUp .5s ease, fadeOut .5s ease 2.5s forwards; }
                .status-message.success { background-color: var(--success-color); }
                .status-message.error { background-color: var(--error-color); }

                .modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.7); display:flex; justify-content:center; align-items:center; z-index:1000; backdrop-filter:blur(5px); animation:fadeIn .3s ease; }
                .modal-content { background: var(--bg-secondary); padding: 2rem; border-radius: var(--radius-main); text-align:center; max-width: 450px; width: 90%; border: 1px solid var(--border-color); }
                .modal-buttons { display:flex; flex-direction:column; gap: .8rem; margin-top: 1.5rem; }
                .loading-overlay { position:absolute; inset:0; background:rgba(26,27,35,.85); display:flex; justify-content:center; align-items:center; z-index:100; border-radius: var(--radius-main); }
                .spinner { border: 4px solid rgba(255,255,255,.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: var(--accent-primary); animation:spin .8s linear infinite; }
                .initial-load-container { display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:80vh; text-align:center; font-size:1.2rem; color: var(--text-secondary); }

                .skills-section h3 { margin-bottom: 1.2rem; }
                .skills-section .project-name { font-size: 1.1rem; color: var(--text-primary); margin-bottom: 1rem; text-align: center; font-weight: 500;}
                .skills-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 1rem;
                    justify-content: center;
                }
                .skill-item {
                    background-color: var(--bg-primary);
                    padding: 0.8rem;
                    padding-bottom: 1.5rem;
                    border-radius: var(--radius-inner);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    border: 1px solid var(--border-color);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }
                .skill-item:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.4);
                }
                .skill-icon-container {
                    font-size: 2.5em;
                    line-height: 1;
                    color: var(--accent-primary);
                    margin-bottom: 0.5rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    height: 50px;
                    position: relative;
                }
                .skill-icon {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .fallback-icon {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: none;
                }
                .skill-name {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    margin-bottom: 0.3rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                }
                .skill-percentage {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }
                .skill-percentage-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 8px;
                    background-color: var(--accent-primary);
                    border-bottom-left-radius: var(--radius-inner);
                    border-bottom-right-radius: var(--radius-inner);
                    transition: width 0.3s ease-out;
                }

                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes slideInUp{ from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
                @keyframes fadeOut{ from { opacity:1 } to { opacity:0 } }
                @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }

                @media (min-width: 768px) {
                    .profile-card { max-width: 740px; }
                    .profile-header { height: ${avatarDimensions.tablet.headerH}px; }
                    .avatar { width: ${avatarDimensions.tablet.avatarH}px; height: ${avatarDimensions.tablet.avatarH}px; top: var(--avatar-tablet-top); border-width: 6px; }
                    .profile-body { padding: ${avatarDimensions.tablet.overlap + 20}px 2.5rem 2.5rem; }
                    .nickname-text { font-size: 2.2rem; }
                    .skills-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
                }

                @media (min-width: 1024px) {
                    .profile-card { max-width: 840px; }
                    .profile-header { height: ${avatarDimensions.desktop.headerH}px; }
                    .avatar { width: ${avatarDimensions.desktop.avatarH}px; height: ${avatarDimensions.desktop.avatarH}px; top: var(--avatar-desktop-top); border-width: 7px; }
                    .profile-body { padding: ${avatarDimensions.desktop.overlap + 25}px 3rem 3rem; }
                    .nickname-text { font-size: 2.5rem; }
                    .skills-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
                }
            `}</style>

            <Show when={status().message && !loading()}>
                <div class="status-message-container">
                    <div class={`status-message ${status().type}`}>{status().message}</div>
                </div>
            </Show>

            <div class="profile-container">
                <Show when={!loading() && userData()}
                    fallback={
                        <div class="initial-load-container">
                            <Show when={loading()} fallback={<p>{status().message || 'Could not load profile.'}</p>}>
                                <Spinner />
                                <p>Loading Profile...</p>
                            </Show>
                        </div>
                    }
                >
                    <div class="profile-card">
                        <Show when={loading()}><div class="loading-overlay"><Spinner/></div></Show>

                        <div class="profile-header">
                            <img class="cover-photo" src={userData()?.cover_photo || `https://source.unsplash.com/random/1600x600/?abstract,dark`} alt="Cover photo" onClick={() => openImageModal('cover_photo')} />
                        </div>

                        <img class="avatar" src={userData()?.avatar || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userData()?.user || 'U')}`} alt="User avatar" onClick={() => openImageModal('avatar')} />

                        <div class="profile-body">
                            <div class="nickname-container">
                                <Show when={editingNickname()} fallback={
                                    <>
                                        <h1 class="nickname-text">{userData()?.nickname || userData()?.user}</h1>
                                        <button class="edit-icon-btn" title="Edit Nickname" onClick={() => { setNickname(userData()?.nickname || userData()?.user || ''); setEditingNickname(true); }}>
                                            <IconPencil />
                                        </button>
                                    </>
                                }>
                                    <div class="edit-controls">
                                        <input type="text" value={nickname()} onInput={(e) => setNickname(e.currentTarget.value)} />
                                        <div class="edit-controls-buttons">
                                            <button class="btn btn-secondary" onClick={() => setEditingNickname(false)}>Cancel</button>
                                            <button class="btn btn-primary" onClick={() => handleUpdate('nickname', nickname(), setEditingNickname)}>Save</button>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                            <p class="user-details">@{userData()?.user} &bull; ID: {userData()?.id}</p>

                            <Show when={userData()?.activePlan?.plan}>
                                <div class="active-plan-container" style={{
                                    backgroundColor: activePlanStyles().cardGrad1,
                                    color: activePlanStyles().textColor,
                                    border: `1px solid ${activePlanStyles().cardBorder}`,
                                    boxShadow: `0 2px 8px ${activePlanStyles().glowColor}`
                                }}>
                                    {userData()?.activePlan?.plan} 
                                </div>
                            </Show>

                            <div class="bio-section">
                                <h3>About Me
                                    <Show when={!editingBio()}>
                                        <button class="edit-icon-btn" title="Edit Bio" onClick={() => { setBio(userData()?.bio || ''); setEditingBio(true); }}>
                                            <IconPencil /> Edit
                                        </button>
                                    </Show>
                                </h3>
                                <Show when={editingBio()} fallback={
                                    <p class="bio-text">{userData()?.bio || 'No bio yet. Click edit to add one!'}</p>
                                }>
                                    <div class="edit-controls">
                                        <textarea rows="4" value={bio()} onInput={(e) => setBio(e.currentTarget.value)}></textarea>
                                        <div class="edit-controls-buttons">
                                            <button class="btn btn-secondary" onClick={() => setEditingBio(false)}>Cancel</button>
                                            <button class="btn btn-primary" onClick={() => handleUpdate('bio', bio(), setEditingBio)}>Save Bio</button>
                                        </div>
                                    </div>
                                </Show>
                            </div>

                            <Show when={projectSkills() && projectSkills().skills && projectSkills().skills.length > 0}>
                                <div class="skills-section">
                                    <h3>Project Skills</h3>
                                    <p class="project-name">Analyzing: {getBasename(projectSkills().project)}</p>
                                    <div class="skills-grid">
                                        <For each={projectSkills().skills}>
                                            {(skill) => (
                                                <div class="skill-item">
                                                    <div class="skill-icon-container">
                                                        {getSkillIcon(skill.extension, skill.name)}
                                                        <span class="fallback-icon">
                                                            <IconCode />
                                                        </span>
                                                    </div>
                                                    <div class="skill-name" title={skill.name}>{skill.name}</div>
                                                    <div class="skill-percentage">{skill.skill}</div>
                                                    <div class="skill-percentage-bar" style={{ width: skill.skill }}></div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                        </div>
                    </div>
                </Show>

                <Show when={modalOpen()}>
                    <div class="modal-overlay" onClick={() => setModalOpen(false)}>
                        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h2 style={{margin: "0 0 1.5rem 0"}}>Update Image</h2>
                            <div class="modal-buttons">
                                <button class="btn btn-primary" onClick={modalAction()}><IconAdd /> Upload New</button>
                                <button class="btn btn-secondary" style={{'margin-top': '1rem'}} onClick={() => setModalOpen(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </Show>
            </div>
        </>
    );
}

render(() => <App />, document.getElementById('app'));
