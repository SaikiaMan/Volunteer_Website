// Global variables and functions - Define early so onclick handlers can find them
function normalizeApiBaseUrl(value) {
    const host = (window.location && window.location.hostname) ? window.location.hostname : '';
    const isLocal = (host === 'localhost' || host === '127.0.0.1' || host === '' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.'));
    
    if (isLocal) {
        return 'http://localhost:3001/api';
    }

    const trimmedValue = String(value || '').trim();

    if (!trimmedValue) {
        return 'https://api.eventease.in/api';
    }

    if (/^https?:\/\//i.test(trimmedValue)) {
        return trimmedValue.replace(/\/$/, '');
    }

    return `https://${trimmedValue.replace(/^\/+/, '').replace(/\/$/, '')}`;
}

const API_BASE_URL = normalizeApiBaseUrl(
    window.API_BASE_URL ||
    document.documentElement.dataset.apiBaseUrl ||
    ''
);
window.API_BASE_URL = API_BASE_URL;

function getStoredRole() {
    return localStorage.getItem('eventeaseRole') || 'volunteer';
}

function setStoredRole(role) {
    localStorage.setItem('eventeaseRole', role || 'volunteer');
}

async function trackPageView(page) {
    try {
        await fetch(`${API_BASE_URL}/${page}`);
    } catch (error) {
        console.warn(`Page tracking failed for ${page}:`, error);
    }
}

function openVolunteerForm() {
    console.log('Opening form');
    const modal = document.getElementById('volunteerModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeVolunteerForm() {
    console.log('Closing form');
    const modal = document.getElementById('volunteerModal');
    if (modal) {
        modal.classList.remove('active');
        const form = document.getElementById('volunteerForm');
        if (form) form.reset();
        const successMsg = document.getElementById('successMessage');
        const errorMsg = document.getElementById('errorMessage');
        if (successMsg) successMsg.classList.add('d-none');
        if (errorMsg) errorMsg.classList.add('d-none');
    }
    document.body.style.overflow = 'auto';
}

function updateSignupButton() {
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');
    if (signupBtn && loginBtn) {
        // User is logged in - hide signup, show profile button
        signupBtn.style.display = 'none';
        loginBtn.textContent = 'View Profile';
        loginBtn.className = 'btn btn-primary btn-lg ms-3';
        loginBtn.onclick = function() {
            window.location.href = 'app.html';
        };
    }
}

function resetSignupButton() {
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');
    if (signupBtn && loginBtn) {
        // User logged out - show signup and login buttons
        signupBtn.style.display = 'inline-block';
        loginBtn.textContent = 'Login';
        loginBtn.className = 'btn btn-secondary btn-lg ms-3';
        loginBtn.onclick = function() {
            openLoginForm();
        };
    }
}

function openLoginForm() {
    console.log('Opening login form');
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Show a single logout button across pages when user is logged in
function showLogoutIfLogged() {
    try {
        const logged = !!localStorage.getItem('volunteerProfile') || !!localStorage.getItem('eventeaseRole');
        if (!logged) return;

        // Only show a site-wide logout on the app shell (/app). Don't alter the landing page.
        const path = (window.location.pathname || '').toLowerCase();
        const isAppShell = path.endsWith('/app') || path.endsWith('/app.html') || path.endsWith('app.html');
        if (!isAppShell) return;

        const hideIds = ['signupTopBtn','loginTopBtn','signupBtn','loginBtn','navSignupBtn','navLoginBtn'];
        hideIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

        // Prefer existing signout button ids
        let logoutBtn = document.getElementById('signoutTopBtn') || document.getElementById('navLogoutBtn') || document.getElementById('globalLogoutBtn');
        if (!logoutBtn) {
            // Insert a simple logout button into the top nav if available
            const topbar = document.querySelector('#mainNav .container') || document.querySelector('.topbar-right') || document.body;
            if (topbar) {
                const btn = document.createElement('button');
                btn.id = 'globalLogoutBtn';
                btn.className = 'topbar-btn';
                btn.type = 'button';
                btn.textContent = 'Sign Out';
                btn.onclick = function() { localStorage.removeItem('volunteerProfile'); localStorage.removeItem('eventeaseRole'); localStorage.removeItem('stafflyApplications'); window.location.href = 'index.html'; };
                topbar.appendChild(btn);
                logoutBtn = btn;
            }
        }

        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } catch (e) {
        console.warn('showLogoutIfLogged error', e);
    }
}

function closeLoginForm() {
    console.log('Closing login form');
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('active');
        const form = document.getElementById('loginForm');
        if (form) form.reset();
        const successMsg = document.getElementById('loginSuccessMessage');
        const errorMsg = document.getElementById('loginErrorMessage');
        if (successMsg) successMsg.classList.add('d-none');
        if (errorMsg) errorMsg.classList.add('d-none');
    }
    document.body.style.overflow = 'auto';
}

function normalizeVolunteerProfile(profile, fallbackEmail = '') {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const fullName = safeProfile.fullName
        || safeProfile.full_name
        || safeProfile.name
        || [safeProfile.firstName, safeProfile.lastName, safeProfile.first_name, safeProfile.last_name].filter(Boolean).join(' ').trim();

    const [firstName, ...restName] = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    const lastName = restName.join(' ');

    let expVal = safeProfile.experience || safeProfile['past experience'];
    if (typeof expVal === 'string') {
        try {
            const parsed = JSON.parse(expVal);
            if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
                expVal = parsed;
            }
        } catch (e) {
            // Keep as string
        }
    }

    let skillsVal = safeProfile.skills || safeProfile.Skills;
    if (typeof skillsVal === 'string') {
        try {
            const parsed = JSON.parse(skillsVal);
            if (Array.isArray(parsed)) {
                skillsVal = parsed;
            } else if (skillsVal.includes(',')) {
                skillsVal = skillsVal.split(',').map(s => s.trim()).filter(Boolean);
            }
        } catch (e) {
            if (skillsVal.includes(',')) {
                skillsVal = skillsVal.split(',').map(s => s.trim()).filter(Boolean);
            } else if (skillsVal.trim() === '') {
                skillsVal = [];
            } else {
                skillsVal = [skillsVal.trim()];
            }
        }
    }

    const availVal = safeProfile.availability || safeProfile.Availability || 'Flexible';
    const locVal = safeProfile.loc || safeProfile.location || safeProfile.Location || '';
    const createdAtVal = safeProfile.created_at || safeProfile['Created at'] || safeProfile.createdAt || '';
    const earningsVal = safeProfile.Earnings !== undefined ? Number(safeProfile.Earnings) : (safeProfile.earnings !== undefined ? Number(safeProfile.earnings) : 0);
    const eventsCompletedVal = safeProfile['Events completed'] !== undefined ? Number(safeProfile['Events completed']) : (safeProfile.eventsCompleted !== undefined ? Number(safeProfile.eventsCompleted) : 0);
    const hoursLoggedVal = safeProfile['Hours logged'] !== undefined ? Number(safeProfile['Hours logged']) : (safeProfile.hoursLogged !== undefined ? Number(safeProfile.hoursLogged) : 0);

    return {
        ...safeProfile,
        fullName: fullName || '',
        full_name: fullName || '',
        fn: safeProfile.fn || safeProfile.firstName || safeProfile.first_name || firstName || '',
        ln: safeProfile.ln || safeProfile.lastName || safeProfile.last_name || lastName || '',
        firstName: safeProfile.firstName || safeProfile.fn || firstName || '',
        lastName: safeProfile.lastName || safeProfile.ln || lastName || '',
        email: safeProfile.email || fallbackEmail || '',
        photoDataUrl: safeProfile.photoDataUrl || safeProfile.photo_url || safeProfile.photoUrl || safeProfile.avatarUrl || safeProfile.avatar || safeProfile.profilePic || safeProfile.profilePicUrl || '',
        experience: expVal,
        'past experience': expVal,
        loc: locVal,
        location: locVal,
        Location: locVal,
        skills: skillsVal,
        Skills: skillsVal,
        availability: availVal,
        Availability: availVal,
        created_at: createdAtVal,
        'Created at': createdAtVal,
        createdAt: createdAtVal,
        Earnings: earningsVal,
        earnings: earningsVal,
        'Events completed': eventsCompletedVal,
        eventsCompleted: eventsCompletedVal,
        'Hours logged': hoursLoggedVal,
        hoursLogged: hoursLoggedVal
    };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Frontend initialized. Backend API base URL:', API_BASE_URL);

    const authAction = new URLSearchParams(window.location.search).get('auth');

    trackPageView('landing');
    
    // Check for access_token in URL hash (Supabase email verification redirect)
    // IMPORTANT: This must run BEFORE the logged-in redirect check below
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('type='))) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const accessToken = params.get('access_token');
        if (accessToken) {
            // Create a visible status indicator
            const statusDiv = document.createElement('div');
            statusDiv.style = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 15px 25px; border-radius: 50px; z-index: 9999; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.3);';
            statusDiv.innerHTML = '<span style="color: #64a19d">●</span> Verifying Email & Creating Profile...';
            document.body.appendChild(statusDiv);

            console.log('Verification token detected, processing profile...');
            try {
                // First attempt to fetch existing profile
                const meRes = await fetch(`${API_BASE_URL}/volunteers/me`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                let data;
                if (meRes.status === 404) {
                    statusDiv.innerHTML = '<span style="color: #64a19d">●</span> Registering Profile in Database...';
                    // Profile not found - create it now that we are verified!
                    const createRes = await fetch(`${API_BASE_URL}/volunteers/create-profile`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    data = await createRes.json();
                } else {
                    data = await meRes.json();
                }

                if (data.success && data.user) {
                    statusDiv.style.background = '#28a745';
                    statusDiv.innerHTML = '✔ Success! Profile Created.';
                    const profile = normalizeVolunteerProfile(data.user, data.user.email);
                    localStorage.setItem('volunteerProfile', JSON.stringify(profile));
                    localStorage.setItem('volunteerToken', accessToken);
                    
                    setTimeout(() => {
                        window.location.hash = ''; // Clear hash
                        window.location.href = 'app.html';
                    }, 1000);
                    return; // Stop further execution
                } else {
                    statusDiv.style.background = '#dc3545';
                    statusDiv.innerHTML = '✖ Error: ' + (data.error || 'Profile creation failed');
                    console.error('Profile creation failed:', data);
                }
            } catch (err) {
                statusDiv.style.background = '#dc3545';
                statusDiv.innerHTML = '✖ Connection Error. Is your backend running?';
                console.error('Verification flow failed:', err);
            }
        }
    }
    
    // Check if user already has a profile. If so, redirect directly to events page (app.html).
    if (localStorage.getItem('volunteerProfile') || localStorage.getItem('eventeaseRole')) {
        window.location.href = 'app.html';
        return;
    }

    if (authAction === 'login') {
        openLoginForm();
    } else if (authAction === 'signup') {
        openVolunteerForm();
    }
    
    // Set up modal click outside handler for volunteer form
    const modal = document.getElementById('volunteerModal');
    if (modal) {
        // Prevent clicks inside modal content from closing the modal
        const modalContent = modal.querySelector('.modal-content-volunteer');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Only close modal when clicking the background
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeVolunteerForm();
            }
        });
    }
    
    // Set up modal click outside handler for login form
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        // Prevent clicks inside modal content from closing the modal
        const modalContent = loginModal.querySelector('.modal-content-volunteer');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Only close modal when clicking the background
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                closeLoginForm();
            }
        });
    }
    
    // Set up form submission
    const form = document.getElementById('volunteerForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const successMessage = document.getElementById('successMessage');
            const errorMessage = document.getElementById('errorMessage');
            const submitBtn = document.querySelector('.form-actions button[type="submit"]');
            
            // Hide messages
            if (successMessage) successMessage.classList.add('d-none');
            if (errorMessage) errorMessage.classList.add('d-none');
            
            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Submitting...';
                }
                
                // Check if email is already registered
                const emailVal = document.getElementById('email').value.trim();
                try {
                    const checkResp = await fetch(`${API_BASE_URL}/volunteers/check-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailVal })
                    });
                    const checkResult = await checkResp.json();
                    if (checkResp.ok) {
                        // If a full volunteer profile exists, prompt login
                        if (checkResult.profileExists) {
                            if (errorMessage) {
                                const errorText = document.getElementById('errorText');
                                if (errorText) errorText.textContent = 'An account already exists with this email. Please login.';
                                errorMessage.classList.remove('d-none');
                            }
                            setTimeout(() => {
                                closeVolunteerForm();
                                openLoginForm();
                                const loginEmail = document.getElementById('loginEmail');
                                if (loginEmail) loginEmail.value = emailVal;
                            }, 700);
                            return false;
                        }

                        // If an Auth user exists but no profile row, ask user to login
                        if (checkResult.authExists && !checkResult.profileExists) {
                            if (errorMessage) {
                                const errorText = document.getElementById('errorText');
                                if (errorText) errorText.textContent = 'An account exists but profile setup is incomplete. Please verify your email and login to continue.';
                                errorMessage.classList.remove('d-none');
                            }
                            setTimeout(() => {
                                closeVolunteerForm();
                                openLoginForm();
                                const loginEmail = document.getElementById('loginEmail');
                                if (loginEmail) loginEmail.value = emailVal;
                            }, 1500);
                            return false;
                        }
                    }
                } catch (err) {
                    console.warn('Email check failed, continuing signup:', err);
                }

                // Prepare FormData for multipart/form-data submission
                const formDataToSend = new FormData(form);
                formDataToSend.set('fullName', document.getElementById('fullName').value);
                formDataToSend.set('age', document.getElementById('age').value);
                formDataToSend.set('email', document.getElementById('email').value);
                formDataToSend.set('password', document.getElementById('password').value);
                formDataToSend.set('phone', document.getElementById('phone').value);
                formDataToSend.set('experience', document.getElementById('experience').value);
                formDataToSend.set('description', document.getElementById('description').value);
                
                // Send to backend API
                const response = await fetch(`${API_BASE_URL}/volunteers/signup`, {
                    method: 'POST',
                    body: formDataToSend
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to submit form');
                }

                // Show success message
                if (successMessage) {
                    successMessage.classList.remove('d-none');
                    successMessage.textContent = result.message || 'Signup successful! Please check your email to verify your account.';
                }

                // If the backend says verification is needed, do NOT log in or redirect yet
                if (result.needsVerification) {
                    form.reset();
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Check your email';
                    }
                    setTimeout(() => {
                        closeVolunteerForm();
                        openLoginForm();
                        const loginEmail = document.getElementById('loginEmail');
                        if (loginEmail) loginEmail.value = document.getElementById('email').value;
                    }, 5000);
                    return;
                }

                // Store profile data in localStorage (Fallback for immediate login if enabled)
                const storedProfile = normalizeVolunteerProfile(result.user || result.data || {}, document.getElementById('email').value);
                localStorage.setItem('volunteerProfile', JSON.stringify(storedProfile));
                // Update button to Profile
                updateSignupButton();
                showLogoutIfLogged();
                
                form.reset();
                
                // Show success message and redirect to app.html
                if (successMessage) {
                    successMessage.classList.remove('d-none');
                    successMessage.textContent = 'Signup successful! Redirecting to events...';
                }
                
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 1500);
                
            } catch (error) {
                console.error('Error:', error);
                if (errorMessage) {
                    const errorText = document.getElementById('errorText');
                    if (errorText) {
                        if (error.message === 'EMAIL NOT VERIFIED') {
                            errorText.style.color = '#ff4d4d';
                            errorText.style.fontWeight = 'bold';
                            errorText.textContent = 'EMAIL NOT VERIFIED. Please check your inbox and click the verification link.';
                        } else {
                            errorText.textContent = error.message;
                        }
                    }
                    errorMessage.classList.remove('d-none');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit & Sign Up';
                }
            }
            
            return false;
        });
    }
    
    // Set up login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const loginSuccessMessage = document.getElementById('loginSuccessMessage');
            const loginErrorMessage = document.getElementById('loginErrorMessage');
            const loginErrorText = document.getElementById('loginErrorText');
            const loginSubmitBtn = document.querySelector('#loginForm button[type="submit"]');
            
            // Hide messages
            if (loginSuccessMessage) loginSuccessMessage.classList.add('d-none');
            if (loginErrorMessage) loginErrorMessage.classList.add('d-none');

            if (!email || !password) {
                if (loginErrorText) {
                    loginErrorText.textContent = 'Email and password are required.';
                }
                if (loginErrorMessage) {
                    loginErrorMessage.classList.remove('d-none');
                }
                return false;
            }
            
            try {
                if (loginSubmitBtn) {
                    loginSubmitBtn.disabled = true;
                    loginSubmitBtn.textContent = 'Logging in...';
                }
                
                // Always fetch from backend so we get the latest profile and ID
                const response = await fetch(`${API_BASE_URL}/volunteers/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const result = await response.json();

                if (!response.ok) {
                    // Handle specific backend cases to avoid confusing messages
                    if (response.status === 404 && result.error && result.error.toString().toLowerCase().includes('volunteer profile not found')) {
                        const loginErrorMessage = document.getElementById('loginErrorMessage');
                        const loginErrorText = document.getElementById('loginErrorText');
                        if (loginErrorText) loginErrorText.textContent = 'Account found but volunteer profile is missing. If you just signed up, wait a few seconds and try logging in again, or complete signup.';
                        if (loginErrorMessage) loginErrorMessage.classList.remove('d-none');
                        return false;
                    }

                    if (response.status === 401 && result.error && result.error.toString().toLowerCase().includes('already')) {
                        // If backend says already signed in, redirect to app
                        setStoredRole('volunteer');
                        setTimeout(() => { window.location.href = 'app.html'; }, 800);
                        return;
                    }

                    throw new Error(result.error || 'Email not registered. Please sign up first.');
                }
                
                // Store the profile data in localStorage
                const profile = normalizeVolunteerProfile(result.user || result.data || {}, email);
                localStorage.setItem('volunteerProfile', JSON.stringify(profile));
                if (result.session && result.session.access_token) {
                    localStorage.setItem('volunteerToken', result.session.access_token);
                }
                try { showLogoutIfLogged(); } catch (e) { /* ignore */ }

                // If backend marks this profile as Head, redirect to head dashboard
                if ((profile.role || '').toString().toLowerCase() === 'head') {
                    setStoredRole('head');
                    if (loginSuccessMessage) {
                        loginSuccessMessage.classList.remove('d-none');
                        loginSuccessMessage.textContent = 'Head login detected! Redirecting to Dashboard...';
                    }
                    // Redirect to the app page; the app will render the Head dashboard in-place
                    setTimeout(() => {
                        window.location.href = 'app.html';
                    }, 900);
                    return;
                }

                // Default volunteer flow
                setStoredRole('volunteer');
                if (loginSuccessMessage) {
                    loginSuccessMessage.classList.remove('d-none');
                    loginSuccessMessage.textContent = 'Login successful! Redirecting...';
                }

                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 1500);
                return;
            } catch (error) {
                console.error('Login error:', error);
                if (loginErrorMessage) {
                    if (loginErrorText) {
                        if (error.message.toLowerCase() === 'wrong password') {
                            loginErrorText.textContent = 'wrong password';
                        } else {
                            loginErrorText.innerHTML = error.message + ' <a href="javascript:void(0);" onclick="closeLoginForm(); openVolunteerForm();" style="color: #64a19d; text-decoration: underline;">Sign up here</a>';
                        }
                    }
                    loginErrorMessage.classList.remove('d-none');
                }
            } finally {
                if (loginSubmitBtn) {
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.textContent = 'Login';
                }
            }
            
            return false;
        });
    }
});
