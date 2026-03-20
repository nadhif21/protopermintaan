function getApiUrl() {
    const currentPath = window.location.pathname;
    let basePath = '';
    
    if (currentPath.includes('/permintaan/')) {
        basePath = currentPath.substring(0, currentPath.indexOf('/permintaan/'));
    } else if (currentPath.includes('/backdate/')) {
        basePath = currentPath.substring(0, currentPath.indexOf('/backdate/'));
    } else if (currentPath.includes('/admin/')) {
        basePath = currentPath.substring(0, currentPath.indexOf('/admin/'));
    } else {
        const lastSlash = currentPath.lastIndexOf('/');
        basePath = currentPath.substring(0, lastSlash + 1);
    }
    
    if (basePath && !basePath.endsWith('/')) {
        basePath += '/';
    }
    
    if (!basePath || basePath === '/') {
        return '/api.php';
    }
    
    return basePath + 'api.php';
}

let currentUser = null;
let currentPinType = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) {
        window.location.href = getAppFullUrl('/login.html');
        return;
    }

    loadUserProfile();
    setupEventListeners();
    setupLogout();
});

function setupLogout() {
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') {
                logout();
            } else {
                if (confirm('Apakah Anda yakin ingin logout?')) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userData');
                    window.location.href = getAppFullUrl('/login.html');
                }
            }
        });
    }
}

function setupEventListeners() {
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', openEditProfileModal);
    }

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', openPasswordModal);
    }

    const changePinBtn = document.getElementById('changePinBtn');
    if (changePinBtn) {
        changePinBtn.addEventListener('click', openPinModal);
    }

    // Close modals
    const closeButtons = document.querySelectorAll('.modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            if (modalId === 'editProfileModal') {
                closeEditProfileModal();
            } else if (modalId === 'passwordModal') {
                closePasswordModal();
            } else if (modalId === 'pinModal') {
                closePinModal();
            }
        });
    });

    const cancelEditBtn = document.getElementById('cancelEditProfileBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditProfileModal);
    }

    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', closePasswordModal);
    }

    const cancelPinBtn = document.getElementById('cancelPinBtn');
    if (cancelPinBtn) {
        cancelPinBtn.addEventListener('click', closePinModal);
    }

    const editProfileModal = document.getElementById('editProfileModal');
    if (editProfileModal) {
        editProfileModal.addEventListener('click', (e) => {
            if (e.target === editProfileModal) {
                closeEditProfileModal();
            }
        });
    }

    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => {
            if (e.target === passwordModal) {
                closePasswordModal();
            }
        });
    }

    const pinModal = document.getElementById('pinModal');
    if (pinModal) {
        pinModal.addEventListener('click', (e) => {
            if (e.target === pinModal) {
                closePinModal();
            }
        });
    }

    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleProfileUpdate);
    }

    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }

    const pinForm = document.getElementById('pinForm');
    if (pinForm) {
        pinForm.addEventListener('submit', handlePinChange);
    }

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

        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=me&_t=${Date.now()}`, {
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
    const displayName = user.name || user.username || '-';
    document.getElementById('profileName').textContent = displayName;
    const approverType = String(user.approverType || '').toLowerCase();
    const effectiveRole = (user.role === 'approver' && approverType === 'manager') ? 'manager' : (user.role || 'user');
    
    const roleText = {
        'super_admin': 'Admin',
        'admin': 'Petugas',
        'approver': 'Approver',
        'manager': 'Manager',
        'user': 'User'
    };
    document.getElementById('profileRole').textContent = roleText[effectiveRole] || effectiveRole || '-';
    
    document.getElementById('profileUsername').textContent = user.username || '-';
    document.getElementById('profileNPK').textContent = user.npk || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('profilePhone').textContent = user.nomorTelepon || '-';
    document.getElementById('profileUnitKerja').textContent = user.unitKerja || '-';

    const avatarEl = document.getElementById('profileSummaryAvatar');
    if (avatarEl) {
        const parts = displayName.trim().split(/\s+/).filter(Boolean);
        let initials = 'U';
        if (parts.length >= 2) {
            initials = (parts[0][0] || '') + (parts[1][0] || '');
        } else if (parts.length === 1) {
            initials = parts[0].substring(0, 2);
        }
        avatarEl.textContent = initials.toUpperCase();
    }
    
    // Hide Edit Profile button for users with role 'user'
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        if (user.role === 'user') {
            editProfileBtn.style.display = 'none';
        } else {
            editProfileBtn.style.display = 'block';
        }
    }

    const changePinBtn = document.getElementById('changePinBtn');
    const pinRole = String(effectiveRole).toLowerCase();
    if (changePinBtn) {
        if (pinRole === 'approver' || pinRole === 'manager') {
            changePinBtn.style.display = 'block';
            currentPinType = pinRole;
        } else {
            changePinBtn.style.display = 'none';
            currentPinType = null;
        }
    }
}

function openPinModal() {
    if (!currentPinType) {
        alert('Konfigurasi PIN hanya tersedia untuk role approver/manager.');
        return;
    }
    const modal = document.getElementById('pinModal');
    const title = document.getElementById('pinModalTitle');
    const form = document.getElementById('pinForm');
    if (!modal || !form) return;
    if (title) {
        title.textContent = currentPinType === 'manager' ? 'Konfigurasi PIN Manager' : 'Konfigurasi PIN Approver';
    }
    form.reset();
    hidePinMessages();
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closePinModal() {
    const modal = document.getElementById('pinModal');
    const form = document.getElementById('pinForm');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
    if (form) form.reset();
    hidePinMessages();
}

function hidePinMessages() {
    const err = document.getElementById('pinError');
    const ok = document.getElementById('pinSuccess');
    if (err) err.style.display = 'none';
    if (ok) ok.style.display = 'none';
}

function showPinError(message) {
    const err = document.getElementById('pinError');
    const ok = document.getElementById('pinSuccess');
    if (err) {
        err.textContent = message;
        err.style.display = 'block';
    }
    if (ok) ok.style.display = 'none';
}

function showPinSuccess(message) {
    const err = document.getElementById('pinError');
    const ok = document.getElementById('pinSuccess');
    if (ok) {
        ok.textContent = message;
        ok.style.display = 'block';
    }
    if (err) err.style.display = 'none';
}

async function handlePinChange(e) {
    e.preventDefault();
    hidePinMessages();
    if (!currentPinType) {
        showPinError('Role Anda tidak memiliki akses konfigurasi PIN.');
        return;
    }
    const newPin = (document.getElementById('newPin')?.value || '').trim();
    const confirmPin = (document.getElementById('confirmPin')?.value || '').trim();
    const submitBtn = document.getElementById('submitPinBtn');

    if (!/^\d{4}$/.test(newPin)) {
        showPinError('PIN harus 4 digit angka.');
        return;
    }
    if (newPin !== confirmPin) {
        showPinError('Konfirmasi PIN tidak sama.');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Menyimpan...';
        }
        const token = getAuthToken();
        if (!token) throw new Error('Token tidak ditemukan');

        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Auth-Token': token
            },
            body: new URLSearchParams({
                action: 'setApprovalPin',
                pin_type: currentPinType,
                pin: newPin
            }).toString()
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Gagal menyimpan PIN');
        }
        showPinSuccess('PIN berhasil diperbarui.');
        setTimeout(() => closePinModal(), 1200);
    } catch (error) {
        showPinError(error.message || 'Terjadi kesalahan saat menyimpan PIN');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').textContent = 'Simpan PIN';
        }
    }
}

async function openEditProfileModal() {
    if (!currentUser) {
        alert('Data user belum dimuat. Silakan refresh halaman.');
        return;
    }

    const modal = document.getElementById('editProfileModal');
    if (modal) {
        // Populate form with current user data
        document.getElementById('editName').value = currentUser.name || '';
        document.getElementById('editEmail').value = currentUser.email || '';
        document.getElementById('editPhone').value = currentUser.nomorTelepon || '';

        // Load unit kerja options
        await loadUnitKerjaOptions();

        // Set current unit kerja value
        const unitKerjaSelect = document.getElementById('editUnitKerja');
        if (unitKerjaSelect && currentUser.unitKerja) {
            // Try to find matching option by value (which is nama_unit)
            const currentUnitKerja = currentUser.unitKerja.trim();
            let found = false;
            
            // First, try to match by value
            if (unitKerjaSelect.value !== '' && unitKerjaSelect.value === currentUnitKerja) {
                found = true;
            } else {
                // Try to find by text content
                const options = unitKerjaSelect.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === currentUnitKerja || options[i].textContent === currentUnitKerja) {
                        unitKerjaSelect.value = options[i].value;
                        found = true;
                        break;
                    }
                }
            }
            
            // If not found in active list, add it as an option (might be inactive or deleted)
            if (!found && currentUnitKerja) {
                const option = document.createElement('option');
                option.value = currentUnitKerja;
                option.textContent = currentUnitKerja + ' (Tidak aktif)';
                option.selected = true;
                unitKerjaSelect.appendChild(option);
            }
        }

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        hideEditProfileMessages();
        
        setTimeout(() => {
            const nameInput = document.getElementById('editName');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    }
}

async function loadUnitKerjaOptions() {
    try {
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getUnitKerja`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        const unitKerjaSelect = document.getElementById('editUnitKerja');
        
        if (!unitKerjaSelect) {
            return;
        }
        
        // Clear existing options except the first one (placeholder)
        while (unitKerjaSelect.options.length > 1) {
            unitKerjaSelect.remove(1);
        }
        
        if (result.success && result.data) {
            // Handle nested data structure (backward compatibility)
            const dataArray = Array.isArray(result.data) ? result.data : (result.data.data || []);
            
            if (Array.isArray(dataArray) && dataArray.length > 0) {
                dataArray.forEach(unit => {
                    const option = document.createElement('option');
                    option.value = unit.nama_unit; // Store nama_unit as value
                    option.textContent = unit.nama_unit;
                    unitKerjaSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading unit kerja options:', error);
        // Don't show error to user, just log it
        // The dropdown will just have the placeholder option
    }
}

function closeEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        const form = document.getElementById('editProfileForm');
        if (form) {
            form.reset();
        }

        hideEditProfileMessages();
    }
}

function hideEditProfileMessages() {
    const errorMsg = document.getElementById('editProfileError');
    const successMsg = document.getElementById('editProfileSuccess');
    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
}

function showEditProfileError(message) {
    const errorMsg = document.getElementById('editProfileError');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
    }
    
    const successMsg = document.getElementById('editProfileSuccess');
    if (successMsg) successMsg.style.display = 'none';
}

function showEditProfileSuccess(message) {
    const successMsg = document.getElementById('editProfileSuccess');
    if (successMsg) {
        successMsg.textContent = message;
        successMsg.style.display = 'block';
    }
    
    const errorMsg = document.getElementById('editProfileError');
    if (errorMsg) errorMsg.style.display = 'none';
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    hideEditProfileMessages();
    
    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const nomorTelepon = document.getElementById('editPhone').value.trim();
    const unitKerja = document.getElementById('editUnitKerja').value.trim();
    const submitBtn = document.getElementById('submitEditProfileBtn');
    
    // Validate phone number format if provided
    if (nomorTelepon && !/^08\d{8,11}$/.test(nomorTelepon)) {
        showEditProfileError('Format nomor telepon tidak valid. Gunakan format: 08xxxxxxxxxx');
        return;
    }
    
    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showEditProfileError('Format email tidak valid.');
        return;
    }
    
    // At least one field must be filled
    if (!name && !email && !nomorTelepon && !unitKerja) {
        showEditProfileError('Minimal satu field harus diisi.');
        return;
    }
    
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Menyimpan...';
        }
        
        const token = getAuthToken();
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }
        
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        
        const formData = new URLSearchParams();
        formData.append('action', 'updateProfile');
        if (name) formData.append('name', name);
        if (email) formData.append('email', email);
        if (nomorTelepon) formData.append('nomor_telepon', nomorTelepon);
        if (unitKerja) formData.append('unit_kerja', unitKerja);
        
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Auth-Token': token
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            throw new Error('Gagal mengupdate profile');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showEditProfileSuccess('Profile berhasil diupdate!');
            
            // Reload profile data
            await loadUserProfile();
            
            setTimeout(() => {
                closeEditProfileModal();
            }, 1500);
        } else {
            throw new Error(result.error || 'Gagal mengupdate profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showEditProfileError(error.message || 'Terjadi kesalahan saat mengupdate profile');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').textContent = 'Simpan Perubahan';
        }
    }
}

function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        const form = document.getElementById('passwordForm');
        if (form) {
            form.reset();
        }

        hideMessages();
        
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
        
        const form = document.getElementById('passwordForm');
        if (form) {
            form.reset();
        }

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
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'Mengubah...';
        }
        
        const token = getAuthToken();
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }
        
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(fullUrl, {
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
            
            document.getElementById('passwordForm').reset();
            
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
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('span').textContent = 'Ubah Password';
        }
    }
}
