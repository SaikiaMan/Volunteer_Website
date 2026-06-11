// Load profile data when page loads
window.addEventListener('DOMContentLoaded', function() {
    const profileData = localStorage.getItem('volunteerProfile');
    
    if (!profileData) {
        document.getElementById('profileContent').style.display = 'none';
        document.getElementById('noProfileContent').style.display = 'block';
        return;
    }

    try {
        const data = JSON.parse(profileData);
        
        console.log('Loaded profile data:', data);
        
        // Fill in the profile information
        document.getElementById('profileName').textContent = data.full_name || '-';
        document.getElementById('profileAge').textContent = data.age || '-';
        document.getElementById('profileEmail').textContent = data.email || '-';
        document.getElementById('profileContact').textContent = data.contact || '-';
        document.getElementById('profileExperience').textContent = data['past experience'] || '-';
        document.getElementById('profileDescription').textContent = data.description || '-';
        
        // Load photo if available
        if (data.photo_url) {
            console.log('Photo URL found:', data.photo_url);
            const photoImg = document.getElementById('profilePhoto');
            const placeholder = document.getElementById('noPhotoPlaceholder');
            
            // Set the image source
            photoImg.src = data.photo_url;
            
            // Handle image load success
            photoImg.onload = function() {
                console.log('Image loaded successfully');
                photoImg.style.display = 'block';
                placeholder.style.display = 'none';
            };
            
            // Handle image load error
            photoImg.onerror = function() {
                console.error('Failed to load image from:', data.photo_url);
                photoImg.style.display = 'none';
                placeholder.style.display = 'flex';
            };
        } else {
            console.log('No photo URL in profile data');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        document.getElementById('profileContent').style.display = 'none';
        document.getElementById('noProfileContent').style.display = 'block';
    }
});

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('volunteerProfile');
        window.location.href = 'index.html';
    }
}
