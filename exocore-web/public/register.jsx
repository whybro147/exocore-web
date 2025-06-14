import { render } from 'solid-js/web';
import { createSignal, onMount, Show } from 'solid-js';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/themes/dark.css';

// SVG Icon Components
const IconEye = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const IconEyeOff = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
const IconUpload = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>;

function App() {
    // State signals for form data and UI status
    const [loading, setLoading] = createSignal(false);
    const [status, setStatus] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [passwordWarning, setPasswordWarning] = createSignal('');
    const [form, setForm] = createSignal({ user: '', pass: '', email: '', avatar: '', bio: '', nickname: '', dob: '', cover_photo: '', country: '', timezone: '' });
    const [avatarFileName, setAvatarFileName] = createSignal('');
    const [coverPhotoFileName, setCoverPhotoFileName] = createSignal('');
    const [validationErrors, setValidationErrors] = createSignal({});

    // Refs for file input elements
    let avatarInputRef, coverPhotoInputRef;

    /**
     * Redirects the user to the dashboard if they are already logged in.
     * Checks for authentication tokens in localStorage.
     */
    function LoggedAlready() {
        if (localStorage.getItem('exocore-token') && localStorage.getItem('exocore-cookies')) {
            window.location.href = '/private/server/exocore/web/public/dashboard';
        }
    }

    // Lifecycle hook: runs once after the component mounts
    onMount(() => {
        fetchLocation();
        initDatePicker();
        LoggedAlready();
        setInterval(LoggedAlready, 5000); // Periodically check login status
    });

    /**
     * Initializes the flatpickr date picker on the date of birth input.
     */
    function initDatePicker() {
        setTimeout(() => {
            const dobInput = document.getElementById('dob');
            if (dobInput) {
                flatpickr(dobInput, {
                    dateFormat: 'Y-m-d',
                    maxDate: 'today',
                    altInput: true,
                    altFormat: 'F j, Y',
                    appendTo: window.document.body,
                    onChange: (_, dateStr) => updateField('dob', dateStr),
                });
            }
        }, 100);
    }

    /**
     * Fetches the user's country and timezone based on their IP address.
     */
    async function fetchLocation() {
        try {
            const res = await fetch('https://ipwho.is/');
            const data = await res.json();
            if (data.success) {
                setForm((prev) => ({ ...prev, country: data.country || '', timezone: data.timezone?.id || '' }));
            }
        } catch (err) {
            console.error('Error fetching location:', err);
        }
    }

    /**
     * Handles file selection for avatar and cover photo, updating the form state.
     * @param {string} field - The form field to update ('avatar' or 'cover_photo').
     * @param {Event} event - The file input change event.
     */
    function handleFileChange(field, event) {
        const file = event.currentTarget.files[0];
        const targetSignal = field === 'avatar' ? setAvatarFileName : setCoverPhotoFileName;
        if (!file) {
            targetSignal('');
            setForm((prev) => ({ ...prev, [field]: '' }));
            return;
        }
        targetSignal(file.name);
        const reader = new FileReader();
        reader.onload = () => updateField(field, reader.result);
        reader.readAsDataURL(file);
    }
    
    /**
     * Validates and submits the registration form data to the server.
     * @param {Event} e - The form submission event.
     */
    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setStatus('');
        setValidationErrors({});

        const currentForm = form();
        // All fields are now required
        const requiredFields = ['user', 'email', 'pass', 'nickname', 'dob', 'country', 'timezone', 'bio', 'avatar', 'cover_photo'];
        const errors = {};

        // Check for empty required fields
        requiredFields.forEach(field => {
            if (!currentForm[field]) {
                const fieldName = { 
                    user: 'Username', 
                    pass: 'Password', 
                    dob: 'Date of Birth',
                    bio: 'Short Bio',
                    avatar: 'Avatar',
                    cover_photo: 'Cover Photo'
                }[field] || field.charAt(0).toUpperCase() + field.slice(1);
                errors[field] = `${fieldName} is required.`;
            }
        });
        
        // If there are validation errors, update state and stop submission
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setStatus('Please complete all required fields.');
            setLoading(false);
            return;
        }

        // Check for password strength issues
        if (passwordWarning()) {
            setStatus('Please correct the password issues before submitting.');
            setLoading(false);
            return;
        }

        // Attempt to submit the form data
        try {
            const res = await fetch('/private/server/exocore/web/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentForm),
            });
            const responseData = await res.json();
            if (!res.ok) throw new Error(responseData?.message || `Server error: ${res.status}`);
            setStatus('Registration successful! Redirecting to login...');
            setTimeout(() => { window.location.href = '/private/server/exocore/web/public/login'; }, 2000);
        } catch (err) {
            setStatus(err.message);
        }
        setLoading(false);
    }

    /**
     * Updates a form field's value in the state and performs validation.
     * @param {string} field - The name of the field to update.
     * @param {string} value - The new value for the field.
     */
    function updateField(field, value) {
        let processedValue = (field === 'user' || field === 'email' || field === 'pass')
            ? value.replace(/\s/g, '')
            : value;
        
        // Password strength validation
        if (field === 'pass') {
            const warnings = [];
            if (processedValue.length > 0) {
                if (processedValue.length < 8) warnings.push('be at least 8 characters');
                if (!/\d/.test(processedValue)) warnings.push('include a number');
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(processedValue)) warnings.push('include a symbol');
            }
            setPasswordWarning(warnings.length > 0 ? 'Password must ' + warnings.join(', ') + '.' : '');
        }

        setForm((prev) => ({ ...prev, [field]: processedValue }));
        
        // Clear the validation error for the field being edited
        if (validationErrors()[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    }

    /**
     * Determines if the submit button should be disabled based on form completion and validity.
     * @returns {boolean} True if the button should be disabled.
     */
    const isSubmitDisabled = () => {
        const f = form();
        const requiredFields = ['user', 'email', 'pass', 'nickname', 'dob', 'country', 'timezone', 'bio', 'avatar', 'cover_photo'];
        const hasEmptyFields = requiredFields.some(field => !f[field]);
        return loading() || !!passwordWarning() || hasEmptyFields;
    };

    return (
        <div class="register-page-wrapper">
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
                .register-page-wrapper { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 2rem; box-sizing: border-box; }
                .register-card { background: var(--bg-secondary); width: 100%; max-width: 600px; padding: 2.5rem; border-radius: var(--radius-main); border: 1px solid var(--border-color); box-shadow: 0 15px 40px var(--shadow-color); animation: fadeIn 0.5s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .register-header { text-align: center; margin-bottom: 2.5rem; color: var(--text-primary); font-size: 2rem; font-weight: 700; }
                .form-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
                @media (min-width: 768px) { .form-grid { grid-template-columns: 1fr 1fr; } .full-width { grid-column: 1 / -1; } }
                .form-group { display: flex; flex-direction: column; }
                .form-label { margin-bottom: 0.5rem; color: var(--text-secondary); font-weight: 500; }
                .input-wrapper { position: relative; }
                .form-input, .form-textarea { width: 100%; padding: 0.9rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-inner); font-family: var(--font-body); font-size: 1rem; background-color: var(--bg-primary); color: var(--text-primary); box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
                .form-input:focus, .form-textarea:focus { outline:0; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.2); }
                .input-error { border-color: var(--error-color) !important; }
                .input-error:focus { box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.2) !important; }
                .form-textarea { min-height: 80px; resize: vertical; }
                .password-toggle { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; }
                .field-error-message, .password-warning { font-size: 0.875rem; color: var(--error-color); margin-top: 0.5rem; }
                .file-upload-btn { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-inner); cursor: pointer; transition: background-color 0.2s, border-color 0.2s; overflow: hidden; }
                .file-upload-btn:hover { background-color: #2a2c3b; }
                .file-name { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; text-align: left; }
                .register-btn { width: 100%; padding: 1rem 1.5rem; border: none; border-radius: var(--radius-inner); background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary)); color: #fff; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease; margin-top: 1.5rem; }
                .register-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 170, 255, 0.2); }
                .register-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .status-message { text-align: center; margin-top: 1.5rem; padding: 0.8rem; border-radius: var(--radius-inner); font-weight: 500; }
                .status-success { background-color: rgba(46, 204, 113, 0.15); color: var(--success-color); border: 1px solid var(--success-color); }
                .status-error { background-color: rgba(231, 76, 60, 0.15); color: var(--error-color); border: 1px solid var(--error-color); }
                .login-link-wrapper { text-align: center; margin-top: 2rem; color: var(--text-secondary); }
                .login-link { color: var(--accent-primary); text-decoration: none; font-weight: 500; }
            `}</style>
            <div class="register-card">
                <h1 class="register-header">Create Your Account</h1>
                <form onSubmit={handleSubmit} novalidate>
                    <div class="form-grid">
                        {/* Username */}
                        <div class="form-group">
                            <label class="form-label" for="user">Username</label>
                            <input id="user" class="form-input" classList={{ 'input-error': !!validationErrors().user }} type="text" value={form().user} onInput={(e) => updateField('user', e.currentTarget.value)} />
                            <Show when={validationErrors().user}><div class="field-error-message">{validationErrors().user}</div></Show>
                        </div>
                        {/* Email */}
                        <div class="form-group">
                            <label class="form-label" for="email">Email Address</label>
                            <input id="email" class="form-input" classList={{ 'input-error': !!validationErrors().email }} type="email" value={form().email} onInput={(e) => updateField('email', e.currentTarget.value)} />
                            <Show when={validationErrors().email}><div class="field-error-message">{validationErrors().email}</div></Show>
                        </div>
                        {/* Nickname */}
                         <div class="form-group">
                            <label class="form-label" for="nickname">Display Name (Nickname)</label>
                            <input id="nickname" class="form-input" classList={{ 'input-error': !!validationErrors().nickname }} type="text" value={form().nickname} onInput={(e) => updateField('nickname', e.currentTarget.value)} />
                            <Show when={validationErrors().nickname}><div class="field-error-message">{validationErrors().nickname}</div></Show>
                        </div>
                        {/* Password */}
                        <div class="form-group">
                            <label class="form-label" for="password">Password</label>
                            <div class="input-wrapper">
                                <input id="password" class="form-input" classList={{ 'input-error': !!validationErrors().pass || !!passwordWarning() }} type={showPassword() ? 'text' : 'password'} value={form().pass} onInput={(e) => updateField('pass', e.currentTarget.value)} />
                                <button type="button" class="password-toggle" onClick={() => setShowPassword(!showPassword())}>
                                    <Show when={showPassword()} fallback={<IconEye />}><IconEyeOff /></Show>
                                </button>
                            </div>
                            <Show when={validationErrors().pass}><div class="field-error-message">{validationErrors().pass}</div></Show>
                            <Show when={passwordWarning()}><div class="password-warning">{passwordWarning()}</div></Show>
                        </div>
                        {/* Date of Birth */}
                        <div class="form-group">
                            <label class="form-label" for="dob">Date of Birth</label>
                            <input id="dob" class="form-input" classList={{ 'input-error': !!validationErrors().dob }} type="text" placeholder="Select your birth date..." readOnly />
                             <Show when={validationErrors().dob}><div class="field-error-message">{validationErrors().dob}</div></Show>
                        </div>
                        {/* Country */}
                        <div class="form-group">
                            <label class="form-label" for="country">Country</label>
                            <input id="country" class="form-input" classList={{ 'input-error': !!validationErrors().country }} type="text" value={form().country} onInput={(e) => updateField('country', e.currentTarget.value)} />
                            <Show when={validationErrors().country}><div class="field-error-message">{validationErrors().country}</div></Show>
                        </div>
                        {/* Timezone */}
                        <div class="form-group">
                            <label class="form-label" for="timezone">Timezone</label>
                            <input id="timezone" class="form-input" classList={{ 'input-error': !!validationErrors().timezone }} type="text" value={form().timezone} onInput={(e) => updateField('timezone', e.currentTarget.value)} />
                            <Show when={validationErrors().timezone}><div class="field-error-message">{validationErrors().timezone}</div></Show>
                        </div>
                        {/* Bio */}
                        <div class="form-group full-width">
                            <label class="form-label" for="bio">Short Bio</label>
                            <textarea id="bio" class="form-textarea" classList={{ 'input-error': !!validationErrors().bio }} value={form().bio} onInput={(e) => updateField('bio', e.currentTarget.value)} />
                            <Show when={validationErrors().bio}><div class="field-error-message">{validationErrors().bio}</div></Show>
                        </div>
                        {/* File Uploads */}
                        <div class="form-group full-width">
                             <label class="form-label">Profile Images</label>
                             <div class="form-grid">
                                 <button type="button" class="file-upload-btn" classList={{ 'input-error': !!validationErrors().avatar }} onClick={() => avatarInputRef?.click()}>
                                     <IconUpload />
                                     <span class="file-name" title={avatarFileName()}>{avatarFileName() || 'Choose Avatar'}</span>
                                 </button>
                                 <button type="button" class="file-upload-btn" classList={{ 'input-error': !!validationErrors().cover_photo }} onClick={() => coverPhotoInputRef?.click()}>
                                     <IconUpload />
                                     <span class="file-name" title={coverPhotoFileName()}>{coverPhotoFileName() || 'Choose Cover Photo'}</span>
                                 </button>
                             </div>
                            <Show when={validationErrors().avatar}><div class="field-error-message">{validationErrors().avatar}</div></Show>
                            <Show when={validationErrors().cover_photo && !validationErrors().avatar}><div class="field-error-message">{validationErrors().cover_photo}</div></Show>
                            <input type="file" accept="image/*" ref={el => avatarInputRef = el} onInput={(e) => handleFileChange('avatar', e)} style={{ display: 'none' }} />
                            <input type="file" accept="image/*" ref={el => coverPhotoInputRef = el} onInput={(e) => handleFileChange('cover_photo', e)} style={{ display: 'none' }} />
                        </div>
                    </div>
                    {/* Submit Button */}
                    <button type="submit" class="register-btn" disabled={isSubmitDisabled()}>
                        {loading() ? 'Creating Account...' : 'Sign Up'}
                    </button>
                    {/* Status Message */}
                    <Show when={status()}>
                        <div class={`status-message ${status().includes('success') ? 'status-success' : 'status-error'}`}>{status()}</div>
                    </Show>
                    {/* Login Link */}
                    <div class="login-link-wrapper">
                        Already have an account? <a href="/private/server/exocore/web/public/login" class="login-link">Login here</a>
                    </div>
                </form>
            </div>
        </div>
    );
}

render(() => <App />, document.getElementById('app'));
