// App Page JavaScript - Tab Management & Events Loading

function normalizeApiBaseUrl(value) {
    const host = (window.location && window.location.hostname) ? window.location.hostname : '';
    const isLocal = (host === 'localhost' || host === '127.0.0.1' || host === '' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.'));
    
    if (isLocal) {
        return 'http://localhost:3001/api';
    }

    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) {
        return 'https://volunteerwebsite-production-8fcc.up.railway.app/api';
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

// Initialize app on page load
document.addEventListener('DOMContentLoaded', async function() {
    const currentRole = getStoredRole();
    
    // Check for access_token in URL hash (Supabase email verification redirect)
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('type='))) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const accessToken = params.get('access_token');
        if (accessToken) {
            // Create a visible status indicator
            const statusDiv = document.createElement('div');
            statusDiv.style = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 15px 25px; border-radius: 50px; z-index: 9999; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.3);';
            statusDiv.innerHTML = '<span style="color: #64a19d">●</span> Finalizing your profile...';
            document.body.appendChild(statusDiv);

            console.log('Verification token detected in app, syncing profile...');
            try {
                let res = await fetch(`${API_BASE_URL}/volunteers/me`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (res.status === 404) {
                    statusDiv.innerHTML = '<span style="color: #64a19d">●</span> Registering Profile in Database...';
                    console.log('Profile missing in app, creating it now...');
                    // Profile missing - create it since we have a valid token
                    const createRes = await fetch(`${API_BASE_URL}/volunteers/create-profile`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    res = createRes;
                }
                
                const data = await res.json();
                if (data.success && data.user) {
                    statusDiv.style.background = '#28a745';
                    statusDiv.innerHTML = '✔ Profile Ready!';
                    localStorage.setItem('volunteerProfile', JSON.stringify(data.user));
                    localStorage.setItem('volunteerToken', accessToken);
                    console.log('Profile created/synced in app successfully.');
                    
                    setTimeout(() => {
                        statusDiv.remove();
                        // Clean the URL
                        window.history.replaceState(null, null, window.location.pathname);
                        window.location.reload(); // Refresh to show the dashboard
                    }, 1000);
                } else {
                    statusDiv.style.background = '#dc3545';
                    statusDiv.innerHTML = '✖ Error: ' + (data.error || 'Failed to create profile');
                }
            } catch (err) {
                statusDiv.style.background = '#dc3545';
                statusDiv.innerHTML = '✖ Connection Error to Backend';
                console.error('Session sync failed in app:', err);
            }
        }
    }

    // Check if user is logged in
    const userProfile = localStorage.getItem('volunteerProfile');
    if (!userProfile) {
        // Show signup modal for new users
        setTimeout(() => {
            openVolunteerForm();
        }, 500);
    }
    
    // Get initial tab from URL parameter or default to 'events'
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'events';
    
    // Load initial data
    switchTab(initialTab, false); // false = don't push state on initial load
    loadProfile();

    trackPageView('events');
    trackPageView('volunteer-dashboard');
});

// Handle browser back/forward buttons
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.tab) {
        switchTab(event.state.tab, false); // false = don't push state again
    }
});

// Switch between tabs
function switchTab(tabName, pushState = true) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Update button states
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Update button state
    const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    // Update URL with History API
    if (pushState) {
        const newUrl = `${window.location.pathname}?tab=${tabName}`;
        window.history.pushState({ tab: tabName }, '', newUrl);
    }
    
    // Load content based on tab
    if (tabName === 'events') {
        trackPageView('events');
        loadEvents();
    } else if (tabName === 'dashboard') {
        trackPageView('volunteer-dashboard');
        loadDashboard();
    }
}

let appEvents = [];
let currentEventFilter = 'all';
let userApplications = [];

// Load user applications
async function loadUserApplications() {
    const rawProfile = localStorage.getItem('volunteerProfile');
    if (!rawProfile) {
        userApplications = [];
        return;
    }

    let profile = {};
    try {
        profile = JSON.parse(rawProfile);
    } catch (e) {
        userApplications = [];
        return;
    }

    const token = localStorage.getItem('volunteerToken') || '';
    const email = profile.email || '';
    const volId = profile.id || '';

    try {
        console.log('[DEBUG] loadUserApplications - Requesting applications. email:', email, 'volId:', volId);
        const response = await fetch(`${API_BASE_URL}/volunteers/applications?email=${encodeURIComponent(email)}&volunteer_id=${encodeURIComponent(volId)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            userApplications = await response.json();
            console.log('[DEBUG] loadUserApplications success. applications:', userApplications);
        } else {
            console.warn('[DEBUG] loadUserApplications error status:', response.status);
            userApplications = [];
        }
    } catch (error) {
        console.error('[DEBUG] Failed to load user applications:', error);
        userApplications = [];
    }
}

// Load and display events from the backend
async function loadEvents() {
    const eventsGrid = document.getElementById('eventsGrid');
    if (!eventsGrid) return;

    eventsGrid.innerHTML = '<div class="empty-state">Loading events...</div>';

    try {
        await loadUserApplications();
        const response = await fetch(`${API_BASE_URL}/events/list`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        appEvents = Array.isArray(data) ? data : (data.data || []);
        renderEventsGrid();
    } catch (error) {
        console.error('Failed to load events:', error);
        eventsGrid.innerHTML = '<div class="empty-state">Could not load events. Please try again later.</div>';
    }
}

function renderEventsGrid() {
    const eventsGrid = document.getElementById('eventsGrid');
    if (!eventsGrid) return;

    let eventsToRender = appEvents;
    if (currentEventFilter && currentEventFilter !== 'all') {
        eventsToRender = appEvents.filter(event => {
            const category = String(event.category || '').toLowerCase();
            return category === currentEventFilter ||
                   (currentEventFilter === 'tech' && category === 'technology');
        });
    }

    if (!eventsToRender.length) {
        eventsGrid.innerHTML = '<div class="empty-state">No events available yet.</div>';
        return;
    }

    eventsGrid.innerHTML = '';
    eventsToRender.forEach(event => {
        eventsGrid.appendChild(createEventCard(event));
    });
}

// Create event card element
function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card clickable-card';
    card.onclick = () => {
        if (typeof openEventDetailsModal === 'function') {
            openEventDetailsModal(event.id);
        }
    };

    const volunteerLimit = event.volunteer_limit != null ? Number(event.volunteer_limit) : (event.slots || 0);
    const acceptedCount = event.accepted_count != null ? Number(event.accepted_count) : (event.filledSlots || 0);
    const availableSlots = Math.max(volunteerLimit - acceptedCount, 0);
    const salary = event.salary != null ? Number(event.salary) : (event.hourlyRate || event.hourly_rate || 0);
    const imageUrl = event.image_url || event.image || '';

    card.innerHTML = `
        <img src="${imageUrl}" alt="${event.title || ''}" class="event-image" onerror="this.style.display='none'">
        <div class="event-card-body">
            <h3 class="event-title" style="margin-bottom: 12px; font-weight: 600; font-size: 17px; line-height: 1.35;">${event.title || 'Untitled Event'}</h3>
            <div class="event-details" style="display: flex; flex-direction: column; gap: 4px; margin-top: auto; border: none; padding: 0;">
                <div class="detail-item" style="border: none; padding: 0; margin: 0;">
                    <span style="color: var(--green); font-weight: 500; font-size: 13px;">Pay: ₹${salary}</span>
                </div>
                <div class="detail-item" style="border: none; padding: 0; margin: 0;">
                    <span style="color: var(--muted3); font-size: 13px;">Spots Left: ${availableSlots} out of ${volunteerLimit}</span>
                </div>
            </div>
        </div>
    `;

    return card;
}

// Filter events by category
function filterEvents(category) {
    currentEventFilter = category;

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = Array.from(document.querySelectorAll('.filter-btn')).find(btn => {
        return (category === 'all' && btn.textContent.includes('All')) ||
               (category === 'music' && btn.textContent.includes('Music')) ||
               (category === 'tech' && btn.textContent.includes('Technology')) ||
               (category === 'sports' && btn.textContent.includes('Sports'));
    });

    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.dataset.filter = category;
    }

    // Re-render events with filter
    renderEventsGrid();
}

// Apply for an event
async function applyForEvent(eventId, eventTitle) {
    const rawProfile = localStorage.getItem('volunteerProfile');
    if (!rawProfile) {
        alert('Please sign up first to apply for events.');
        switchTab('dashboard');
        return;
    }

    let profile;
    try {
        profile = JSON.parse(rawProfile);
    } catch (error) {
        alert('Invalid profile. Please log in again.');
        return;
    }

    const applicantEmail = profile.email;
    if (!applicantEmail) {
        alert('Email not found in profile. Please log in again.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/applications/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_id: eventId,
                applicant_email: applicantEmail
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to apply');
        }

        alert(`Successfully applied for "${eventTitle}"! You will receive confirmation soon.`);
        loadEvents();
    } catch (error) {
        console.error('Apply error:', error);
        alert(error.message || 'Failed to apply. Please try again.');
    }
}

// Load and display profile/dashboard
function loadDashboard() {
    const dashboardContent = document.getElementById('dashboardContent');
    const noDashboardContent = document.getElementById('noDashboardContent');
    const dashboardSidebar = document.getElementById('dashboardSidebar');
    
    if (!dashboardContent) return;
    
    try {
        const userProfile = localStorage.getItem('volunteerProfile');
        
        if (!userProfile) {
            dashboardContent.style.display = 'none';
            if (noDashboardContent) noDashboardContent.style.display = 'flex';
            if (dashboardSidebar) dashboardSidebar.style.display = 'none';
            return;
        }
        
        const profile = JSON.parse(userProfile);
        
        // Handle both camelCase and snake_case field names from different sources
        const fullName = profile.fullName || profile.full_name || 'Volunteer';
        const email = profile.email || 'No email';
        const phone = profile.phone || profile.contact || 'N/A';
        const age = profile.age || 'N/A';
        const experience = profile.experience || profile['past experience'] || 'No experience listed';
        const description = profile.description || 'No description provided.';
        
        // Update sidebar info
        const sidebarName = document.getElementById('sidebarName');
        const sidebarEmail = document.getElementById('sidebarEmail');
        if (sidebarName) sidebarName.textContent = fullName;
        if (sidebarEmail) sidebarEmail.textContent = email;
        
        // Update welcome message
        const welcomeMsg = document.getElementById('welcomeMessage');
        if (welcomeMsg) {
            welcomeMsg.textContent = `Hello ${fullName}, welcome back!`;
        }
        
        // Update profile section
        document.getElementById('profileName').textContent = fullName;
        document.getElementById('profileEmail').textContent = email;
        document.getElementById('profilePhone').textContent = phone;
        document.getElementById('profileEmailDetail').textContent = email;
        document.getElementById('profileAge').textContent = age;
        document.getElementById('profileExperience').textContent = experience;
        document.getElementById('profileDescription').textContent = description;
        
        // Update profile pictures if available
        const photoUrl = profile.photoDataUrl || profile.photo_url || profile.photoUrl;
        if (photoUrl) {
            // Update sidebar avatar
            const sidebarAvatar = document.getElementById('sidebarAvatar');
            if (sidebarAvatar) {
                sidebarAvatar.innerHTML = `<img src="${photoUrl}" alt="${fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
            
            // Update profile section avatar
            const profileAvatarLarge = document.getElementById('profileAvatarLarge');
            if (profileAvatarLarge) {
                profileAvatarLarge.innerHTML = `<img src="${photoUrl}" alt="${fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
        
        // Set statistics (mock data - in production, fetch from backend)
        document.getElementById('appliedCount').textContent = '0';
        document.getElementById('hoursCount').textContent = '0';
        document.getElementById('ratingCount').textContent = '4.5';
        document.getElementById('upcomingCount').textContent = '0';
        document.getElementById('profileStatus').textContent = '100% Complete';
        
        dashboardContent.style.display = 'block';
        if (noDashboardContent) noDashboardContent.style.display = 'none';
        if (dashboardSidebar) dashboardSidebar.style.display = 'block';
        
        // Show overview section by default
        showDashboardSection('overview');
        
    } catch (error) {
        dashboardContent.style.display = 'none';
        if (noDashboardContent) noDashboardContent.style.display = 'flex';
        if (dashboardSidebar) dashboardSidebar.style.display = 'none';
    }
}

// Show/hide dashboard sections
function showDashboardSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Remove active class from menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionName + '-section');
    if (section) {
        section.style.display = 'block';
        section.classList.add('active');
    }
    
    // Add active class to clicked menu item
    event?.currentTarget?.classList.add('active');
}

function getStoredProfile() {
    const userProfile = localStorage.getItem('volunteerProfile');
    if (!userProfile) return null;
    try {
        return JSON.parse(userProfile);
    } catch (error) {
        console.error('Error parsing stored profile:', error);
        return null;
    }
}

function compressImageFile(file, maxSize = 400, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = function() {
                reject(new Error('Could not load image'));
            };

            img.src = event.target.result;
        };

        reader.onerror = function() {
            reject(new Error('Could not read file'));
        };

        reader.readAsDataURL(file);
    });
}

function setEditAvatarPreview(photoUrl) {
    const editAvatarDisplay = document.getElementById('editAvatarDisplay');
    if (!editAvatarDisplay) return;

    if (photoUrl) {
        editAvatarDisplay.innerHTML = `<img src="${photoUrl}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
        editAvatarDisplay.innerHTML = '';
    }
}

function toggleEditProfile() {
    const viewMode = document.getElementById('profileViewMode');
    const editMode = document.getElementById('profileEditMode');
    const editBtn = document.getElementById('editProfileBtn');

    if (!viewMode || !editMode || !editBtn) return;

    const isEditing = editMode.style.display === 'block';

    if (isEditing) {
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        editBtn.innerHTML = 'Edit Profile';
        return;
    }

    const profile = getStoredProfile();
    if (!profile) {
        alert('Error: Profile not found');
        return;
    }

    viewMode.style.display = 'none';
    editMode.style.display = 'block';
    editBtn.innerHTML = 'Close';

    document.getElementById('editFullName').value = profile.fullName || profile.full_name || '';
    document.getElementById('editPhone').value = profile.phone || profile.contact || '';
    document.getElementById('editEmailEdit').value = profile.email || '';
    document.getElementById('editAge').value = profile.age || '';
    document.getElementById('editExperience').value = profile.experience || profile['past experience'] || '';
    document.getElementById('editDescription').value = profile.description || '';

    const photoUrl = profile.photoDataUrl || profile.photo_url || profile.photoUrl;
    setEditAvatarPreview(photoUrl);
}

function cancelEditProfile() {
    toggleEditProfile();
}

async function saveProfileChanges() {
    const profile = getStoredProfile();
    if (!profile) {
        alert('Error: Profile not found');
        return;
    }

    const fullName = document.getElementById('editFullName').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const newEmail = document.getElementById('editEmailEdit').value.trim();
    const age = document.getElementById('editAge').value.trim();
    const experience = document.getElementById('editExperience').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const profilePic = document.getElementById('editProfilePicEdit').files[0];

    if (!fullName || !newEmail) {
        alert('Please enter your full name and email');
        return;
    }

    try {
        // Create FormData for file upload if there's a new photo
        const formData = new FormData();
        // Use volunteer ID to find the record (most reliable)
        formData.append('volunteerId', profile.id);
        // New email (in case they're changing it)
        formData.append('email', newEmail);
        formData.append('fullName', fullName);
        formData.append('phone', phone);
        formData.append('age', age);
        formData.append('experience', experience);
        formData.append('description', description);

        console.log('Profile data being saved:', { 
            volunteerId: profile.id,
            fullName,
            email: newEmail,
            phone,
            age,
            experience,
            description
        });

        if (profilePic) {
            try {
                formData.append('photoUpload', profilePic);
            } catch (error) {
                console.error('Error adding photo to form:', error);
                alert('Error: Unable to process image.');
                return;
            }
        } else if (profile.photo_url) {
            formData.append('photoUrl', profile.photo_url);
        }

        // Send update to backend
        const response = await fetch(`${API_BASE_URL}/volunteers/update`, {
            method: 'PUT',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update profile');
        }

        const result = await response.json();

        // Update localStorage with the response data from backend
        const updatedProfile = {
            ...profile,
            id: result.data.id,
            full_name: result.data.full_name,
            fullName: result.data.full_name,
            age: result.data.age,
            email: result.data.email,
            contact: result.data.contact,
            phone: result.data.contact,
            'past experience': result.data['past experience'],
            experience: result.data['past experience'],
            description: result.data.description,
            photo_url: result.data.photo_url,
            photoUrl: result.data.photo_url
        };

        localStorage.setItem('volunteerProfile', JSON.stringify(updatedProfile));
        loadDashboard();
        toggleEditProfile();
        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error: ' + error.message);
    }
}

// Load profile data (for profile display)
function loadProfile() {
    try {
        const userProfile = localStorage.getItem('volunteerProfile');
        const navSignupBtn = document.getElementById('navSignupBtn');
        const navLogoutBtn = document.getElementById('navLogoutBtn');
        
        if (userProfile) {
            const profile = JSON.parse(userProfile);
            
            // Update navbar - hide signup, show logout
            if (navSignupBtn) navSignupBtn.classList.add('d-none');
            if (navLogoutBtn) navLogoutBtn.classList.remove('d-none');
        } else {
            // Update navbar - show signup, hide logout
            if (navSignupBtn) navSignupBtn.classList.remove('d-none');
            if (navLogoutBtn) navLogoutBtn.classList.add('d-none');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('volunteerProfile');
        localStorage.removeItem('volunteerToken');
        localStorage.removeItem('eventeaseRole');
        localStorage.removeItem('stafflyApplications');
        window.location.href = 'index.html';
    }
}

// Modal functions for signup/login
function openVolunteerForm() {
    const modal = document.getElementById('volunteerModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeVolunteerForm() {
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

function openLoginForm() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
window.openLoginForm = openLoginForm;

function closeLoginForm() {
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

// Modal background click handlers
document.addEventListener('DOMContentLoaded', function() {
    const volunteerModal = document.getElementById('volunteerModal');
    if (volunteerModal) {
        volunteerModal.addEventListener('click', (e) => {
            if (e.target === volunteerModal) {
                closeVolunteerForm();
            }
        });
    }
    
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                closeLoginForm();
            }
        });
    }
    
    // Set up volunteer form submission
    const volunteerForm = document.getElementById('volunteerForm');
    if (volunteerForm) {
        volunteerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // Collect form data
                const fullName = document.getElementById('fullName').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const phone = document.getElementById('phone').value;
                const age = document.getElementById('age').value;
                const experience = document.getElementById('experience').value;
                const description = document.getElementById('description').value;
                const profilePic = document.getElementById('profilePic').files[0];
                const errorMsg = document.getElementById('errorMessage');
                const successMsg = document.getElementById('successMessage');
                
                // Hide messages
                if (errorMsg) errorMsg.classList.add('d-none');
                if (successMsg) successMsg.classList.add('d-none');
                
                // Validate required fields
                if (!fullName || !email || !password) {
                    if (errorMsg) {
                        errorMsg.classList.remove('d-none');
                        errorMsg.textContent = 'Please fill in all required fields';
                    }
                    return;
                }
                
                // Prepare FormData for API
                const formData = new FormData();
                formData.append('fullName', fullName);
                formData.append('email', email);
                formData.append('password', password);
                formData.append('phone', phone);
                formData.append('age', age);
                formData.append('experience', experience);
                formData.append('description', description);
                if (profilePic) {
                    formData.append('photoUpload', profilePic);
                }
                
                // Send to backend API
                const response = await fetch(`${API_BASE_URL}/volunteers/signup`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    if (errorMsg) {
                        errorMsg.classList.remove('d-none');
                        errorMsg.textContent = result.error || 'Failed to submit form';
                    }
                    return;
                }
                
                // Success!
                if (successMsg) {
                    successMsg.classList.remove('d-none');
                    successMsg.textContent = 'Signup successful! You can now browse events.';
                }
                
                // Store profile data in localStorage
                localStorage.setItem('volunteerProfile', JSON.stringify(result.user));
                
                // Update navbar buttons
                loadProfile();
                
                // Reset form and close modal
                volunteerForm.reset();
                setTimeout(() => {
                    closeVolunteerForm();
                }, 1500);
                
            } catch (error) {
                console.error('Form submission error:', error);
                const errorMsg = document.getElementById('errorMessage');
                if (errorMsg) {
                    errorMsg.classList.remove('d-none');
                    errorMsg.textContent = 'Error: ' + error.message;
                }
            }
            
            return false;
        });
    }
    
    // Set up login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const loginSuccessMessage = document.getElementById('loginSuccessMessage');
            const loginErrorMessage = document.getElementById('loginErrorMessage');
            
            // Hide messages
            if (loginSuccessMessage) loginSuccessMessage.classList.add('d-none');
            if (loginErrorMessage) loginErrorMessage.classList.add('d-none');
            
            try {
                // Call backend API to verify email
                const response = await fetch(`${API_BASE_URL}/volunteers/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: password })
                });
                
                const result = await response.json();
                
                if (response.ok && result.user) {
                    // Email found - login successful
                    if (loginSuccessMessage) {
                        loginSuccessMessage.classList.remove('d-none');
                        loginSuccessMessage.textContent = 'Login successful! Redirecting...';
                    }
                    
                    // Store profile in localStorage for session
                    localStorage.setItem('volunteerProfile', JSON.stringify(result.user));
                    if (result.session && result.session.access_token) {
                        localStorage.setItem('volunteerToken', result.session.access_token);
                    }
                    
                    // Update navbar buttons
                    loadProfile();
                    
                    // Reload the dashboard
                    setTimeout(() => {
                        closeLoginForm();
                        loadDashboard();
                    }, 1000);
                } else {
                    // Email not found - ask to signup
                    if (loginErrorMessage) {
                        loginErrorMessage.classList.remove('d-none');
                        loginErrorMessage.textContent = result.error || 'Invalid email or password.';
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                if (loginErrorMessage) {
                    loginErrorMessage.classList.remove('d-none');
                    loginErrorMessage.textContent = 'An error occurred. Please try again.';
                }
            }
            
            loginForm.reset();
        });
    }

        // Set up edit profile form submission
        const editProfileForm = document.getElementById('editProfileForm');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                e.stopPropagation();

                try {
                    await saveProfileChanges();
                } catch (error) {
                    console.error('Error updating profile:', error);
                    alert('Error updating profile: ' + error.message);
                }

                return false;
            });
        }

        // Add file input preview listener
        const profilePicInput = document.getElementById('editProfilePicEdit');
        if (profilePicInput) {
            profilePicInput.addEventListener('change', async function(e) {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const compressedImage = await compressImageFile(file, 400, 0.7);
                    setEditAvatarPreview(compressedImage);
                } catch (error) {
                    console.error('Error compressing preview:', error);
                }
            });
        }
    
    // Set up "Go to Login" button listener
    const goToLoginBtn = document.getElementById('goToLoginBtn');
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', function() {
            closeVolunteerForm();
            openLoginForm();
        });
    }
});
