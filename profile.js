const API_URL = 'api.php';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) {
        window.location.href = 'login.html';
        return;
    }

    loadUserProfile();
    setupEventListeners();
    setupLogout();
});

function setupLogout() {
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') {
                logout();
            } else {
                if (confirm('Apakah Anda yakin ingin logout?')) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userData');
                    window.location.href = 'login.html';
                }
            }
        });
    }
}

function setupEventListeners() {
    // Open password modal
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', openPasswordModal);
    }

    // Close modal
    const modal = document.getElementById('passwordModal');
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancelPasswordBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', closePasswordModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePasswordModal);
    }

    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closePasswordModal();
            }
        });
    }

    // Password form submit
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }

    // Toggle password visibility
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    this.querySelector('.eye-icon').textContent = '🙈';
                } else {
                    input.type = 'password';
                    this.querySelector('.eye-icon').textContent = '👁️';
                }
            }
        });
    });
}

async function loadUserProfile() {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        const response = await fetch(`${API_URL}?action=me&_t=${Date.now()}`, {
            method: 'GET',
            headers: {
                'X-Auth-Token': token,
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error('Gagal memuat data profile');
        }

        const result = await response.json();
        
        if (result.success && result.user) {
            currentUser = result.user;
            displayProfile(result.user);
        } else {
            throw new Error(result.error || 'Gagal memuat data profile');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Gagal memuat data profile: ' + error.message);
    }
}

function displayProfile(user) {
    document.getElementById('profileName').textContent = user.name || '-';
    
    const roleText = {
        'super_admin': 'Super Admin',
        'admin': 'Admin',
        'user': 'User'
    };
    document.getElementById('profileRole').textContent = roleText[user.role] || user.role || '-';
    
    document.getElementById('profileUsername').textContent = user.username || '-';
    document.getElementById('profileNPK').textContent = user.npk || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('profilePhone').textContent = user.nomorTelepon || '-';
    document.getElementById('profileUnitKerja').textContent = user.unitKerja || '-';
}

function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Reset form
        const form = document.getElementById('passwordForm');
        if (form) {
            form.reset();
        }
        
        // Clear messages
        hideMessages();
        
        // Focus on old password
        setTimeout(() => {
            const oldPasswordInput = document.getElementById('oldPassword');
            if (oldPasswordInput) {
                oldPasswordInput.focus();
            }
        }, 100);
    }
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Reset form
        const form = document.getElementById('passwordForm');
        if (form) {
            form.reset();
        }
        
        // Clear messages
        hideMessages();
    }
}

function hideMessages() {
    const errorMsg = document.getElementById('passwordError');
    const successMsg = document.getElementById('passwordSuccess');
    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
}

function showError(message) {
    const errorMsg = document.getElementById('passwordError');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
    }
    
    const successMsg = document.getElementById('passwordSuccess');
    if (successMsg) successMsg.style.display = 'none';
}

function showSuccess(message) {
    const successMsg = document.getElementById('passwordSuccess');
    if (successMsg) {
        successMsg.textContent = message;
        successMsg.style.display = 'block';
    }
    
    const errorMsg = document.getElementById('passwordError');
    if (errorMsg) errorMsg.style.display = 'none';
}

async function handlePasswordChange(e) {
    e.preventDefault();
    
    hideMessages();
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = document.getElementById('submitPasswordBtn');
    
    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
        showError('Semua field wajib diisi.');
        return;
    }
    
    if (newPassword.length < 6) {
        showError('Password baru minimal 6 karakter.');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('Password baru dan konfirmasi password tidak sama.');
        return;
    }
    
    if (oldPassword === newPassword) {
        showError('Password baru harus berbeda dengan password lama.');
        return;
    }
    
    try {
        // Disable button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Mengubah...';
        }
        
        const token = getAuthToken();
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Auth-Token': token
            },
            body: new URLSearchParams({
                action: 'changePassword',
                oldPassword: oldPassword,
                newPassword: newPassword
            }).toString()
        });
        
        if (!response.ok) {
            throw new Error('Gagal mengubah password');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('Password berhasil diubah!');
            
            // Reset form
            document.getElementById('passwordForm').reset();
            
            // Close modal after 2 seconds
            setTimeout(() => {
                closePasswordModal();
            }, 2000);
        } else {
            throw new Error(result.error || 'Gagal mengubah password');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showError(error.message || 'Terjadi kesalahan saat mengubah password');
    } finally {
        // Enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').textContent = 'Ubah Password';
        }
    }
}
