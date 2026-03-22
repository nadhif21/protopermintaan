function getApiUrl() {
    const currentPath = window.location.pathname;
    let basePath = '';
    
    // Deteksi base path aplikasi (misalnya /permintaandof/)
    if (currentPath.includes('/permintaan/')) {
        basePath = currentPath.substring(0, currentPath.indexOf('/permintaan/'));
    } else if (currentPath.includes('/backdate/')) {
        basePath = currentPath.substring(0, currentPath.indexOf('/backdate/'));
    } else if (currentPath.includes('/admin/')) {
        basePath = currentPath.substring(0, currentPath.indexOf('/admin/'));
    } else {
        // Jika di root folder aplikasi, ambil path sampai sebelum nama file
        const lastSlash = currentPath.lastIndexOf('/');
        basePath = currentPath.substring(0, lastSlash + 1);
    }
    
    // Pastikan basePath selalu diakhiri dengan /
    if (basePath && !basePath.endsWith('/')) {
        basePath += '/';
    }
    
    // Jika basePath kosong atau hanya '/', berarti di root domain
    if (!basePath || basePath === '/') {
        return '/api.php';
    }
    
    // Return path absolut dengan leading slash
    return basePath + 'api.php';
}

function openWhatsAppUrl(url) {
    if (!url) return;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        if (isMobile) {
            window.location.href = url;
        } else {
            console.warn('Popup WhatsApp diblokir browser desktop.');
        }
        return;
    }
    popup.opener = null;
}

// Fungsi helper untuk membuat URL API dengan query parameters
function getApiUrlWithParams(action, params = {}) {
    const apiUrl = getApiUrl();
    const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
    const fullUrl = window.location.origin + path;
    
    const url = new URL(fullUrl);
    url.searchParams.append('action', action);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
    });
    url.searchParams.append('_t', Date.now());
    return url;
}

document.addEventListener('DOMContentLoaded', () => {
    // Hanya super_admin yang bisa akses halaman ini
    if (!requireSuperAdmin()) return;

    bindLogout();
    renderCurrentUser();
    bindCreateUserModal();
    bindEditUserModal();
    bindResetPasswordModal();
    bindPasswordToggles();
    bindRefreshButtons();
    bindConfirmToggleUserStatusModal();
    bindUnitKerjaWarningModal();
    bindGenericConfirmModal();
    bindRegistrations();
    bindPinApproval();
    bindApprovers();
    bindPetugas();
    bindUnitKerja();
    bindJenisPermintaan();

    loadUsers();
    loadRegistrations();
    loadApprovalPin();
    loadApprovers();
    loadPetugas();
    loadUnitKerja();
    loadUnitKerjaForApprover();
    loadJenisPermintaan();
});

function bindLogout() {
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (!sidebarLogoutBtn) return;
    sidebarLogoutBtn.addEventListener('click', () => {
        if (typeof logout === 'function') {
            logout();
        } else {
            showConfirm('Apakah Anda yakin ingin logout?', 'Konfirmasi Logout', 'Anda akan keluar dari sistem dan harus login kembali untuk mengakses.').then(confirmed => {
                if (confirmed) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userData');
                    window.location.href = getAppFullUrl('/login.html');
                }
            });
        }
    });
}

function renderCurrentUser() {
    const el = document.getElementById('currentUserInfo');
    const session = getSession();
    if (!el || !session?.user) return;
    el.innerHTML = `Login sebagai <strong>${escapeHtml(session.user.name || session.user.username)}</strong> (${escapeHtml(session.user.role)})`;
}

function bindRefreshButtons() {
    document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);
    document.getElementById('refreshPinBtn')?.addEventListener('click', loadApprovalPin);
    
    // Bind search input untuk User Management
    const usersSearchInput = document.getElementById('usersSearchInput');
    if (usersSearchInput) {
        // Pencarian saat mengetik (dengan debounce)
        let searchTimeout;
        usersSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterUsers(e.target.value);
            }, 300); // Debounce 300ms
        });
        
        // Pencarian saat Enter ditekan
        usersSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                filterUsers(e.target.value);
            }
        });
    }
}

function bindRegistrations() {
    document.getElementById('refreshRegistrationsBtn')?.addEventListener('click', loadRegistrations);
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        loadRegistrations(e.target.value);
    });
    bindDetailModal();
    bindConfirmApproveModal();
    bindSuccessApproveModal();
    bindRejectModal();
}

function bindCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    const openBtn = document.getElementById('openCreateUserBtn');
    const closeBtn = document.getElementById('closeCreateUserModal');
    const cancelBtn = document.getElementById('cancelCreateUserBtn');
    const form = document.getElementById('createUserForm');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        clearCreateUserError();
        form?.reset();
    };

    openBtn?.addEventListener('click', () => {
        modal?.classList.add('show');
        document.body.style.overflow = 'hidden';
        document.getElementById('newUsername')?.focus();
    });
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createUser();
        close();
        await loadUsers();
    });
}

function bindEditUserModal() {
    const modal = document.getElementById('editUserModal');
    const closeBtn = document.getElementById('closeEditUserModal');
    const cancelBtn = document.getElementById('cancelEditUserBtn');
    const form = document.getElementById('editUserForm');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        clearEditUserError();
        form?.reset();
        currentEditUserId = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditUserId) return;
        
        const name = document.getElementById('editName')?.value?.trim() || '';
        const username = document.getElementById('editUsername')?.value?.trim() || '';
        const role = document.getElementById('editRole')?.value || '';
        const email = document.getElementById('editEmail')?.value?.trim() || '';
        const npk = document.getElementById('editNpk')?.value?.trim() || '';
        const nomorTelepon = document.getElementById('editNomorTelepon')?.value?.trim() || '';
        const unitKerjaIdRaw = document.getElementById('editUnitKerja')?.value?.trim() || '';
        const unitKerjaId = unitKerjaIdRaw !== '' ? parseInt(unitKerjaIdRaw, 10) : null;
        const status = document.getElementById('editUserStatus')?.value || '1';

        if (!name) {
            showEditUserError('Nama wajib diisi.');
            return;
        }

        if (!role) {
            showEditUserError('Role wajib dipilih.');
            return;
        }

        clearEditUserError();

        try {
            const updateData = { 
                id: currentEditUserId, 
                name: name, 
                role: role,
                isActive: status === '1' ? 1 : 0
            };

            if (username) updateData.username = username;
            if (email) updateData.email = email;
            if (npk) updateData.npk = npk;
            if (nomorTelepon) updateData.nomor_telepon = nomorTelepon;
            // Simpan menggunakan foreign key
            if (unitKerjaIdRaw !== '' && !Number.isNaN(unitKerjaId)) {
                updateData.unit_kerja_id = unitKerjaId;
            }

            await apiPost('updateUser', updateData);
            close();
            await loadUsers();
        } catch (e) {
            showEditUserError(e.message);
        }
    });
}

let currentEditUserId = null;

function showEditUserError(msg) {
    const el = document.getElementById('editUserError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
}

function clearEditUserError() {
    const el = document.getElementById('editUserError');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
}

// Simpan data users untuk realtime update
let usersData = [];
let usersOriginalData = []; // Simpan data asli sebelum difilter

async function loadUsers() {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Memuat...</td></tr>`;

    try {
        const users = await apiGet('listUsers');
        usersData = users; // Simpan data users untuk realtime update
        usersOriginalData = users; // Simpan data asli untuk pencarian
        
        // Reset search input
        const searchInput = document.getElementById('usersSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Store all data and reset to page 1
        paginationState.users.allData = users;
        paginationState.users.totalItems = users.length;
        paginationState.users.currentPage = 1;
        
        renderUsersTable();
        setupPagination('users');
        
        // Mulai realtime update untuk last login
        startRealtimeLastLoginUpdate();
    } catch (e) {
        const tbody = document.getElementById('usersTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading"><strong style="color:#b71c1c;">${escapeHtml(e.message)}</strong></td></tr>`;
        }
        const cardsContainer = document.getElementById('usersCards');
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div class="loading" style="padding: 20px; text-align: center; color: #f44336;">Error: ${escapeHtml(e.message)}</div>`;
        }
    }
}

function filterUsers(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        // Jika pencarian kosong, kembalikan semua data
        paginationState.users.allData = usersOriginalData;
        paginationState.users.totalItems = usersOriginalData.length;
        paginationState.users.currentPage = 1;
        renderUsersTable();
        setupPagination('users');
        return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const filtered = usersOriginalData.filter(user => {
        const name = (user.name || '').toLowerCase();
        const username = (user.username || '').toLowerCase();
        const email = (user.email || `${user.username}@company.com`).toLowerCase();
        const unitKerja = (user.unitKerja || user.unit_kerja || '').toLowerCase();
        const role = (user.role || '').toLowerCase();
        
        // Map role untuk pencarian
        let roleDisplay = role;
        if (role === 'super_admin') roleDisplay = 'admin';
        else if (role === 'admin') roleDisplay = 'petugas';
        else if (role === 'approver') roleDisplay = 'approver';
        else if (role === 'manager') roleDisplay = 'manager';
        
        return name.includes(term) ||
               username.includes(term) ||
               email.includes(term) ||
               unitKerja.includes(term) ||
               roleDisplay.includes(term);
    });
    
    // Update pagination state dengan data yang sudah difilter
    paginationState.users.allData = filtered;
    paginationState.users.totalItems = filtered.length;
    paginationState.users.currentPage = 1;
    
    renderUsersTable();
    setupPagination('users');
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTbody');
    const users = getPaginatedData('users');
    const state = paginationState.users;
    
    if (state.totalItems === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="loading">Tidak ada user</td></tr>';
        const cardsContainer = document.getElementById('usersCards');
        if (cardsContainer) cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada user</div>';
        return;
    }
    
    if (tbody) {
        tbody.innerHTML = users.map(u => userRowHtml(u)).join('');
        bindUserRowActions();
    }
    
    // Update cards for mobile
    const cardsContainer = document.getElementById('usersCards');
    if (cardsContainer) {
        if (users.length === 0) {
            cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada user</div>';
        } else {
            cardsContainer.innerHTML = users.map(u => {
                const statusBadge = u.isActive
                    ? `<span class="badge badge-active">Active</span>`
                    : `<span class="badge badge-inactive">Inactive</span>`;
                const roleBadge = `<span class="badge badge-role">${escapeHtml(u.role.toUpperCase())}</span>`;
                const initials = getInitials(u.name || u.username);
                const email = u.email || `${u.username}@company.com`;
                const lastLogin = formatLastLogin(u.lastLogin || u.updatedAt);
                const lastLoginTime = u.lastLogin || u.updatedAt || '';

                return `
                    <div class="admin-card" data-user-id="${u.id}">
                        <div class="admin-card-row">
                            <div class="admin-card-label">User</div>
                            <div class="admin-card-value">
                                <div class="user-cell">
                                    <div class="user-avatar">${initials}</div>
                                    <div class="user-info">
                                        <div class="user-name">${escapeHtml(u.name || u.username)}</div>
                                        <div class="user-email">${escapeHtml(email)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Role</div>
                            <div class="admin-card-value">${roleBadge}</div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Status</div>
                            <div class="admin-card-value">${statusBadge}</div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Last Login</div>
                            <div class="admin-card-value last-login-card-value" data-last-login="${lastLoginTime}">${lastLogin}</div>
                        </div>
                        <div class="admin-card-actions">
                            <button class="btn-icon-action" data-action="edit" data-user-id="${u.id}" title="Edit">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Edit
                            </button>
                            <button class="btn-icon-action" data-action="reset" data-user-id="${u.id}" title="Reset Password">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
                                </svg>
                                Reset
                            </button>
                    <button class="btn-icon-action" data-action="${u.isActive ? 'deactivate' : 'activate'}" data-user-id="${u.id}" title="${u.isActive ? 'Non Aktifkan' : 'Aktifkan'}">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            ${u.isActive ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                        </svg>
                    </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Bind actions for cards
            cardsContainer.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const action = btn.getAttribute('data-action');
                    const userId = parseInt(btn.getAttribute('data-user-id') || '0');
                    if (!userId) return;

                    if (action === 'reset') {
                        await resetPasswordFlow(userId);
                    } else if (action === 'edit') {
                        await openEditUserModal(userId);
                    } else if (action === 'activate' || action === 'deactivate') {
                        await toggleUserStatus(userId, action === 'activate');
                    }
                });
            });
        }
    }
}

// Realtime update untuk last login (update setiap 30 detik)
let lastLoginUpdateInterval = null;

function startRealtimeLastLoginUpdate() {
    // Hapus interval sebelumnya jika ada
    if (lastLoginUpdateInterval) {
        clearInterval(lastLoginUpdateInterval);
    }
    
    // Update setiap 30 detik
    lastLoginUpdateInterval = setInterval(() => {
        updateLastLoginDisplay();
    }, 30000);
    
    // Update sekali saat pertama kali load
    setTimeout(() => {
        updateLastLoginDisplay();
    }, 1000);
}

function updateLastLoginDisplay() {
    // Update last login di tabel
    const tableRows = document.querySelectorAll('#usersTbody tr[data-user-id]');
    tableRows.forEach(row => {
        const lastLoginTime = row.getAttribute('data-last-login');
        if (lastLoginTime) {
            const lastLoginCell = row.querySelector('.last-login-cell');
            if (lastLoginCell) {
                lastLoginCell.textContent = formatLastLogin(lastLoginTime);
            }
        }
    });
    
    // Update last login di cards (mobile view)
    const cardLastLoginCells = document.querySelectorAll('#usersCards .last-login-card-value');
    cardLastLoginCells.forEach(cell => {
        const lastLoginTime = cell.getAttribute('data-last-login');
        if (lastLoginTime) {
            cell.textContent = formatLastLogin(lastLoginTime);
        }
    });
}

function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatLastLogin(lastLoginTime) {
    if (!lastLoginTime) return '-';
    
    // Parse waktu dari database (asumsikan UTC jika format ISO 8601 dengan Z)
    let date;
    if (typeof lastLoginTime === 'string' && lastLoginTime.includes('Z')) {
        // Format ISO 8601 dengan Z (UTC)
        date = new Date(lastLoginTime);
    } else if (typeof lastLoginTime === 'string' && !lastLoginTime.includes('T')) {
        // Format MySQL DATETIME (YYYY-MM-DD HH:mm:ss) - tambahkan Z untuk UTC
        date = new Date(lastLoginTime.replace(' ', 'T') + 'Z');
    } else {
        date = new Date(lastLoginTime);
    }
    
    if (isNaN(date.getTime())) return '-';
    
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    // Format lebih akurat dan realtime
    if (diffSecs < 60) {
        return `${diffSecs} ${diffSecs === 1 ? 'detik' : 'detik'} yang lalu`;
    } else if (diffMins < 60) {
        return `${diffMins} ${diffMins === 1 ? 'menit' : 'menit'} yang lalu`;
    } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'jam' : 'jam'} yang lalu`;
    } else if (diffDays < 7) {
        return `${diffDays} ${diffDays === 1 ? 'hari' : 'hari'} yang lalu`;
    } else if (diffWeeks < 4) {
        return `${diffWeeks} ${diffWeeks === 1 ? 'minggu' : 'minggu'} yang lalu`;
    } else if (diffMonths < 12) {
        return `${diffMonths} ${diffMonths === 1 ? 'bulan' : 'bulan'} yang lalu`;
    } else {
        return `${diffYears} ${diffYears === 1 ? 'tahun' : 'tahun'} yang lalu`;
    }
}

function userRowHtml(u) {
    const statusBadge = u.isActive
        ? `<span class="badge badge-active">Aktif</span>`
        : `<span class="badge badge-inactive">Non Aktif</span>`;
    
    // Map role to display name
    let roleDisplay = u.role || 'user';
    if (roleDisplay === 'super_admin') roleDisplay = 'Admin';
    else if (roleDisplay === 'admin') roleDisplay = 'Petugas';
    else if (roleDisplay === 'approver') roleDisplay = 'Approver';
    else if (roleDisplay === 'manager') roleDisplay = 'Manager';
    else if (roleDisplay === 'user') roleDisplay = 'User';
    
    const roleBadge = `<span class="badge badge-role">${escapeHtml(roleDisplay)}</span>`;
    const initials = getInitials(u.name || u.username);
    const email = u.email || `${u.username}@company.com`;
    const lastLogin = formatLastLogin(u.lastLogin || u.updatedAt);
    const unitKerja = u.unitKerja || u.unit_kerja || '-';

    return `
        <tr data-user-id="${u.id}">
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${initials}</div>
                    <div class="user-info">
                        <div class="user-name">${escapeHtml(u.name || u.username)}</div>
                        <div class="user-email">${escapeHtml(email)}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(unitKerja)}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td class="last-login-cell" data-last-login="${u.lastLogin || u.updatedAt || ''}">${lastLogin}</td>
            <td>
                <div class="row-actions">
                    <button class="btn-icon-action" data-action="edit" title="Edit">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon-action" data-action="reset" title="Reset Password">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
                        </svg>
                    </button>
                    <button class="btn-icon-action" data-action="${u.isActive ? 'deactivate' : 'activate'}" title="${u.isActive ? 'Non Aktifkan' : 'Aktifkan'}">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            ${u.isActive ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
}


function bindUserRowActions() {
    const tbody = document.getElementById('usersTbody');
    tbody?.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = btn.getAttribute('data-action');
            const tr = e.target.closest('tr');
            const userId = parseInt(tr?.getAttribute('data-user-id') || '0');
            if (!userId) return;

            if (action === 'reset') {
                await resetPasswordFlow(userId);
            } else if (action === 'edit') {
                await editUserFlow(tr, userId);
            } else if (action === 'activate' || action === 'deactivate') {
                await toggleUserStatus(userId, action === 'activate');
            }
        });
    });
}

async function editUserFlow(tr, userId) {
    try {
        const users = await apiGet('listUsers');
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            await showAlert('User tidak ditemukan.', 'Error', 'error');
            return;
        }

        // Set current edit user ID
        currentEditUserId = userId;

        // Load unit kerja options
        await loadUnitKerjaForUserEdit();
        
        // Fill form with current user data
        document.getElementById('editName').value = user.name || '';
        document.getElementById('editUsername').value = user.username || '';
        document.getElementById('editRole').value = user.role || 'user';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editNpk').value = user.npk || '';
        document.getElementById('editNomorTelepon').value = user.nomorTelepon || '';
        // Prefer FK if available; otherwise try match by name
        const unitKerjaSelect = document.getElementById('editUnitKerja');
        if (unitKerjaSelect) {
            const unitKerjaId = user.unitKerjaId ?? user.unit_kerja_id ?? null;
            if (unitKerjaId !== null && unitKerjaId !== undefined && unitKerjaId !== '') {
                unitKerjaSelect.value = String(unitKerjaId);
            } else {
                const unitKerjaName = (user.unitKerja || user.unit_kerja || '').toString().trim();
                if (unitKerjaName) {
                    for (let i = 0; i < unitKerjaSelect.options.length; i++) {
                        const opt = unitKerjaSelect.options[i];
                        const optNama = (opt.getAttribute('data-nama') || opt.textContent || '').toString().trim();
                        if (optNama === unitKerjaName) {
                            unitKerjaSelect.value = opt.value;
                            break;
                        }
                    }
                } else {
                    unitKerjaSelect.value = '';
                }
            }
        }
        document.getElementById('editUserStatus').value = user.isActive !== false ? '1' : '0';

        // Show modal
        const modal = document.getElementById('editUserModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            document.getElementById('editName')?.focus();
        }
    } catch (e) {
        showAlert('Error: ' + e.message, 'Error', 'error');
    }
}

let currentToggleUserStatusId = null;
let currentToggleUserStatusAction = null;
let currentUnitKerjaWarningUserId = null;
let currentUnitKerjaWarningData = null;

function bindConfirmToggleUserStatusModal() {
    const modal = document.getElementById('confirmToggleUserStatusModal');
    const closeBtn = document.getElementById('closeConfirmToggleUserStatusModal');
    const cancelBtn = document.getElementById('cancelConfirmToggleUserStatusBtn');
    const confirmBtn = document.getElementById('confirmToggleUserStatusBtn');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        currentToggleUserStatusId = null;
        currentToggleUserStatusAction = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    confirmBtn?.addEventListener('click', async () => {
        if (!currentToggleUserStatusId || currentToggleUserStatusAction === null) return;
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Memproses...';
        
        try {
            await apiPost('updateUser', { 
                id: currentToggleUserStatusId, 
                isActive: currentToggleUserStatusAction ? 1 : 0 
            });
            
            close();
            
            // Show success message
            showSuccessMessage(
                `User berhasil ${currentToggleUserStatusAction ? 'diaktifkan' : 'dinonaktifkan'}.`
            );
            
            await loadUsers();
        } catch (e) {
            showAlert('Error: ' + e.message, 'Error', 'error');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Ya, Lanjutkan';
        }
    });
}

function showConfirmToggleUserStatus(userId, activate) {
    currentToggleUserStatusId = userId;
    currentToggleUserStatusAction = activate;
    
    const modal = document.getElementById('confirmToggleUserStatusModal');
    const title = document.getElementById('confirmToggleUserStatusTitle');
    const message = document.getElementById('confirmToggleUserStatusMessage');
    const description = document.getElementById('confirmToggleUserStatusDescription');
    const icon = document.getElementById('confirmToggleUserStatusIcon');
    const confirmBtn = document.getElementById('confirmToggleUserStatusBtn');
    
    if (!modal) return;
    
    if (activate) {
        title.textContent = 'Aktifkan User';
        message.textContent = 'Aktifkan user ini?';
        description.textContent = 'User akan dapat login dan mengakses sistem setelah diaktifkan.';
        confirmBtn.textContent = 'Ya, Aktifkan';
        confirmBtn.className = 'btn btn-success';
        
        // Icon centang
        icon.innerHTML = `
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        icon.style.color = '#28a745';
    } else {
        title.textContent = 'Nonaktifkan User';
        message.textContent = 'Nonaktifkan user ini?';
        description.textContent = 'User tidak akan dapat login dan mengakses sistem setelah dinonaktifkan.';
        confirmBtn.textContent = 'Ya, Nonaktifkan';
        confirmBtn.className = 'btn btn-warning';
        
        // Icon X
        icon.innerHTML = `
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        icon.style.color = '#dc3545';
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Helper function untuk membuka modal edit user
async function openEditUserModal(userId) {
    try {
        // Langsung panggil editUserFlow dengan userId, tidak perlu tr element
        // editUserFlow akan mencari user dari API
        const tr = document.querySelector(`tr[data-user-id="${userId}"]`) || 
                   document.querySelector(`.admin-card[data-user-id="${userId}"]`) ||
                   null; // Bisa null, editUserFlow akan handle
        await editUserFlow(tr, userId);
    } catch (error) {
        console.error('Error opening edit user modal:', error);
        await showAlert('Error: ' + error.message, 'Error', 'error');
    }
}

function bindUnitKerjaWarningModal() {
    const modal = document.getElementById('unitKerjaWarningModal');
    const closeBtn = document.getElementById('closeUnitKerjaWarningModal');
    const cancelBtn = document.getElementById('cancelUnitKerjaWarningBtn');
    const changeUnitKerjaBtn = document.getElementById('changeUnitKerjaBtn');
    const activateUnitKerjaBtn = document.getElementById('activateUnitKerjaBtn');

    if (!modal) return;

    const close = () => {
        if (modal) {
            modal.classList.remove('show');
        }
        document.body.style.overflow = 'auto';
        currentUnitKerjaWarningUserId = null;
        currentUnitKerjaWarningData = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) close();
    });

    changeUnitKerjaBtn?.addEventListener('click', async () => {
        if (!currentUnitKerjaWarningUserId) return;
        
        const userId = currentUnitKerjaWarningUserId;
        let user = currentUnitKerjaWarningData?.user;
        
        // Close warning modal first
        close();
        
        try {
            // Jika user data tidak ada, cari dari API
            if (!user) {
                const users = await apiGet('listUsers');
                user = users.find(u => u.id === userId);
            }
            
            if (!user) {
                await showAlert('User tidak ditemukan. Silakan refresh halaman dan coba lagi.', 'Error', 'error');
                return;
            }

            // Set current edit user ID
            currentEditUserId = userId;

            // Load unit kerja options
            await loadUnitKerjaForUserEdit();
            
            // Fill form with current user data
            const editName = document.getElementById('editName');
            const editUsername = document.getElementById('editUsername');
            const editRole = document.getElementById('editRole');
            const editEmail = document.getElementById('editEmail');
            const editNpk = document.getElementById('editNpk');
            const editNomorTelepon = document.getElementById('editNomorTelepon');
            const editUnitKerja = document.getElementById('editUnitKerja');
            const editUserStatus = document.getElementById('editUserStatus');
            
            if (editName) editName.value = user.name || '';
            if (editUsername) editUsername.value = user.username || '';
            if (editRole) editRole.value = user.role || 'user';
            if (editEmail) editEmail.value = user.email || '';
            if (editNpk) editNpk.value = user.npk || '';
            if (editNomorTelepon) editNomorTelepon.value = user.nomorTelepon || '';
            if (editUnitKerja) editUnitKerja.value = user.unitKerja || user.unit_kerja || '';
            if (editUserStatus) editUserStatus.value = user.isActive !== false ? '1' : '0';

            // Show modal
            const editUserModal = document.getElementById('editUserModal');
            if (editUserModal) {
                editUserModal.classList.add('show');
                document.body.style.overflow = 'hidden';
                if (editName) editName.focus();
            } else {
                throw new Error('Modal edit user tidak ditemukan');
            }
        } catch (error) {
            console.error('Error opening edit user modal:', error);
            await showAlert('Error: ' + error.message, 'Error', 'error');
        }
    });

    activateUnitKerjaBtn?.addEventListener('click', async () => {
        if (!currentUnitKerjaWarningUserId || !currentUnitKerjaWarningData) return;
        
        activateUnitKerjaBtn.disabled = true;
        activateUnitKerjaBtn.textContent = 'Memproses...';
        
        try {
            // Get unit kerja dari user data atau dari currentUnitKerjaWarningData
            const user = currentUnitKerjaWarningData.user;
            const unitKerja = user.unitKerja || user.unit_kerja || currentUnitKerjaWarningData.unitKerja?.nama_unit || currentUnitKerjaWarningData.unitKerja?.nama;
            
            if (!unitKerja) {
                throw new Error('Unit kerja tidak ditemukan pada data user');
            }
            
            const unitKerjaList = await apiGet('getAllUnitKerja');
            const unitKerjaData = unitKerjaList.find(uk => 
                uk.nama_unit === unitKerja || uk.nama === unitKerja
            );
            
            if (unitKerjaData) {
                const token = getAuthToken();
                const apiUrl = getApiUrl();
                const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
                const fullUrl = window.location.origin + path;
                const url = new URL(`${fullUrl}?action=updateUnitKerja`);
                url.searchParams.append('id', unitKerjaData.id);
                url.searchParams.append('nama', unitKerjaData.nama_unit || unitKerjaData.nama);
                url.searchParams.append('is_active', 1);
                url.searchParams.append('activate_users', 1);
                
                const response = await fetch(url.toString(), {
                    headers: { 'X-Auth-Token': token || '' }
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Gagal mengaktifkan unit kerja');
                }
                
                await apiPost('updateUser', { 
                    id: currentUnitKerjaWarningUserId, 
                    isActive: 1 
                });
                
                // Close modal
                if (modal) {
                    modal.classList.remove('show');
                }
                document.body.style.overflow = 'auto';
                currentUnitKerjaWarningUserId = null;
                currentUnitKerjaWarningData = null;
                
                showSuccessMessage('Unit kerja berhasil diaktifkan dan user telah diaktifkan.');
                await loadUsers();
                loadUnitKerja();
            } else {
                throw new Error('Unit kerja tidak ditemukan');
            }
        } catch (error) {
            await showAlert('Error: ' + error.message, 'Error', 'error');
        } finally {
            activateUnitKerjaBtn.disabled = false;
            activateUnitKerjaBtn.textContent = 'Aktifkan Unit Kerja';
        }
    });
}

async function showUnitKerjaWarningModal(userId, user, unitKerja) {
    currentUnitKerjaWarningUserId = userId;
    // Simpan user dan unitKerja dengan struktur yang benar
    currentUnitKerjaWarningData = { 
        user: user, 
        unitKerja: unitKerja 
    };
    
    const modal = document.getElementById('unitKerjaWarningModal');
    const message = document.getElementById('unitKerjaWarningMessage');
    const description = document.getElementById('unitKerjaWarningDescription');
    
    if (!modal) return;
    
    const unitKerjaName = user.unitKerja || user.unit_kerja || '';
    message.textContent = `Unit Kerja "${unitKerjaName}" Tidak Aktif`;
    description.textContent = `User "${user.name}" memiliki unit kerja "${unitKerjaName}" yang saat ini tidak aktif. Untuk mengaktifkan user ini, Anda perlu mengganti unit kerja atau mengaktifkan unit kerja tersebut terlebih dahulu.`;
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function showSuccessMessage(message) {
    // Create a temporary success notification
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

async function toggleUserStatus(userId, activate) {
    // Jika mengaktifkan user, cek dulu apakah unit_kerja user aktif
    if (activate) {
        try {
            // Get user data untuk cek unit_kerja
            const users = await apiGet('listUsers');
            const user = users.find(u => u.id === userId);
            
            if (user && user.unitKerja) {
                // Cek apakah unit_kerja aktif
                const unitKerjaList = await apiGet('getAllUnitKerja');
                const unitKerja = unitKerjaList.find(uk => 
                    uk.nama_unit === user.unitKerja || uk.nama === user.unitKerja
                );
                
                // Jika unit_kerja tidak aktif, tampilkan warning
                if (unitKerja && !unitKerja.is_active) {
                    await showUnitKerjaWarningModal(userId, user, unitKerja);
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking unit kerja:', error);
            // Jika error, lanjutkan dengan konfirmasi normal
        }
    }
    
    // Jika tidak ada masalah atau menonaktifkan, tampilkan konfirmasi normal
    showConfirmToggleUserStatus(userId, activate);
}

// ========== GENERIC CONFIRM MODAL ==========
let genericConfirmCallback = null;

function bindGenericConfirmModal() {
    const modal = document.getElementById('genericConfirmModal');
    const closeBtn = document.getElementById('closeGenericConfirmModal');
    const cancelBtn = document.getElementById('cancelGenericConfirmBtn');
    const confirmBtn = document.getElementById('confirmGenericConfirmBtn');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        genericConfirmCallback = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    confirmBtn?.addEventListener('click', async () => {
        if (genericConfirmCallback) {
            const callback = genericConfirmCallback;
            close();
            callback(true);
        }
    });
}

function showGenericConfirm(options) {
    return new Promise((resolve) => {
        const modal = document.getElementById('genericConfirmModal');
        const title = document.getElementById('genericConfirmTitle');
        const message = document.getElementById('genericConfirmMessage');
        const description = document.getElementById('genericConfirmDescription');
        const icon = document.getElementById('genericConfirmIcon');
        const confirmBtn = document.getElementById('confirmGenericConfirmBtn');
        const cancelBtn = document.getElementById('cancelGenericConfirmBtn');
        
        if (!modal) {
            resolve(false);
            return;
        }
        
        // Set title
        title.textContent = options.title || 'Konfirmasi';
        
        // Set message
        message.textContent = options.message || 'Apakah Anda yakin?';
        
        // Set description
        if (options.description) {
            description.textContent = options.description;
            description.style.display = 'block';
        } else {
            description.style.display = 'none';
        }
        
        // Set icon
        const iconType = options.iconType || 'warning'; // warning, success, error, info
        if (iconType === 'warning') {
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            icon.style.color = '#dc3545';
        } else if (iconType === 'success') {
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            icon.style.color = '#28a745';
        } else if (iconType === 'error') {
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
            icon.style.color = '#dc3545';
        } else {
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
            icon.style.color = '#ff9800';
        }
        
        // Set button text
        confirmBtn.textContent = options.confirmText || 'Ya, Lanjutkan';
        cancelBtn.textContent = options.cancelText || 'Batal';
        
        // Set button style
        if (options.confirmButtonClass) {
            confirmBtn.className = `btn ${options.confirmButtonClass}`;
        } else {
            confirmBtn.className = 'btn btn-primary';
        }
        
        // Set callback
        genericConfirmCallback = (confirmed) => {
            resolve(confirmed);
        };
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    });
}

// Helper function untuk replace confirm()
async function showConfirm(message, title = 'Konfirmasi', description = '') {
    return await showGenericConfirm({
        title: title,
        message: message,
        description: description,
        iconType: 'warning'
    });
}

// Helper function untuk replace alert() dengan info modal
async function showAlert(message, title = 'Informasi', type = 'info') {
    return new Promise((resolve) => {
        const modal = document.getElementById('genericConfirmModal');
        const titleEl = document.getElementById('genericConfirmTitle');
        const messageEl = document.getElementById('genericConfirmMessage');
        const descriptionEl = document.getElementById('genericConfirmDescription');
        const icon = document.getElementById('genericConfirmIcon');
        const confirmBtn = document.getElementById('confirmGenericConfirmBtn');
        const cancelBtn = document.getElementById('cancelGenericConfirmBtn');
        
        if (!modal) {
            resolve(true);
            return;
        }
        
        // Set title
        titleEl.textContent = title;
        
        // Set message
        messageEl.textContent = message;
        
        // Hide description
        descriptionEl.style.display = 'none';
        
        // Set icon
        if (type === 'error') {
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            icon.style.color = '#dc3545';
        } else if (type === 'success') {
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            icon.style.color = '#28a745';
        } else {
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
            icon.style.color = '#ff9800';
        }
        
        // Set button text and hide cancel
        confirmBtn.textContent = 'OK';
        confirmBtn.className = 'btn btn-primary';
        cancelBtn.style.display = 'none';
        
        // Set callback
        const close = () => {
            modal.classList.remove('show');
            document.body.style.overflow = 'auto';
            cancelBtn.style.display = '';
            resolve(true);
        };
        
        // Remove previous listeners and add new one
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.addEventListener('click', close);
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    });
}

let currentResetPasswordUserId = null;

function bindResetPasswordModal() {
    const modal = document.getElementById('resetPasswordModal');
    const closeBtn = document.getElementById('closeResetPasswordModal');
    const cancelBtn = document.getElementById('cancelResetPasswordBtn');
    const form = document.getElementById('resetPasswordForm');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        clearResetPasswordError();
        form?.reset();
        currentResetPasswordUserId = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentResetPasswordUserId) return;
        
        const newPassword = document.getElementById('resetPasswordInput')?.value?.trim() || '';
        if (!newPassword) {
            showResetPasswordError('Password baru wajib diisi.');
            return;
        }

        try {
            await apiPost('resetUserPassword', { id: currentResetPasswordUserId, newPassword: newPassword });
            close();
            showSuccessMessage('Password berhasil direset. Semua session user tersebut dicabut.');
            await loadUsers(); // Refresh user list after reset
        } catch (e) {
            showResetPasswordError(e.message);
        }
    });
}

function showResetPasswordError(msg) {
    const el = document.getElementById('resetPasswordError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
}

function clearResetPasswordError() {
    const el = document.getElementById('resetPasswordError');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
}

async function resetPasswordFlow(userId) {
    currentResetPasswordUserId = userId;
    const modal = document.getElementById('resetPasswordModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        const input = document.getElementById('resetPasswordInput');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
}

function bindPasswordToggles() {
    // Toggle untuk newPassword
    const toggleNewPassword = document.getElementById('toggleNewPassword');
    const newPasswordInput = document.getElementById('newPassword');
    
    if (toggleNewPassword && newPasswordInput) {
        toggleNewPassword.addEventListener('click', () => {
            const type = newPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            newPasswordInput.setAttribute('type', type);
            
            // Update icon
            const svg = toggleNewPassword.querySelector('svg');
            if (svg) {
                if (type === 'text') {
                    // Icon hide (mata tertutup)
                    svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
                    toggleNewPassword.setAttribute('title', 'Sembunyikan password');
                } else {
                    // Icon show (mata terbuka)
                    svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
                    toggleNewPassword.setAttribute('title', 'Lihat password');
                }
            }
        });
    }
    
    // Toggle untuk resetPasswordInput
    const toggleResetPassword = document.getElementById('toggleResetPassword');
    const resetPasswordInput = document.getElementById('resetPasswordInput');
    
    if (toggleResetPassword && resetPasswordInput) {
        toggleResetPassword.addEventListener('click', () => {
            const type = resetPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            resetPasswordInput.setAttribute('type', type);
            
            // Update icon
            const svg = toggleResetPassword.querySelector('svg');
            if (svg) {
                if (type === 'text') {
                    // Icon hide (mata tertutup)
                    svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
                    toggleResetPassword.setAttribute('title', 'Sembunyikan password');
                } else {
                    // Icon show (mata terbuka)
                    svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
                    toggleResetPassword.setAttribute('title', 'Lihat password');
                }
            }
        });
    }
}

async function createUser() {
    const username = document.getElementById('newUsername')?.value?.trim() || '';
    const name = document.getElementById('newName')?.value?.trim() || '';
    const role = document.getElementById('newRole')?.value || 'user';
    const password = document.getElementById('newPassword')?.value || '';

    clearCreateUserError();

    try {
        await apiPost('createUser', { username, name, role, password });
    } catch (e) {
        showCreateUserError(e.message);
        throw e;
    }
}

function showCreateUserError(msg) {
    const el = document.getElementById('createUserError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
}

function clearCreateUserError() {
    const el = document.getElementById('createUserError');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
}

async function apiGet(action, params = {}) {
    const token = getAuthToken();
    if (!token) throw new Error('Token tidak ditemukan. Silakan login ulang.');

    const url = getApiUrlWithParams(action, params);

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'X-Auth-Token': token },
        cache: 'no-cache'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) throw new Error('Gagal terhubung ke server.');
    if (!json.success) throw new Error(json.error || 'Request gagal.');
    return json.data;
}

async function apiPost(action, data = {}) {
    const token = getAuthToken();
    if (!token) throw new Error('Token tidak ditemukan. Silakan login ulang.');

    const apiUrl = getApiUrl();
    const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
    const fullUrl = window.location.origin + path;

    const res = await fetch(fullUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Auth-Token': token
        },
        body: new URLSearchParams({ action, ...normalizeToStringValues(data) }).toString()
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) throw new Error('Gagal terhubung ke server.');
    if (!json.success) throw new Error(json.error || 'Request gagal.');
    return json.data;
}

function normalizeToStringValues(obj) {
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        out[k] = String(v);
    });
    return out;
}

function formatDateTime(input) {
    if (!input) return '-';
    let normalized = String(input).trim().replace(' ', 'T');
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(normalized)) normalized += 'Z';
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return input;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function showError(errorBox, message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.style.display = 'block';
    errorBox.classList.add('show');
}

// =========================
// REGISTRATIONS MANAGEMENT
// =========================

async function loadRegistrations(status = '') {
    const tbody = document.getElementById('registrationsTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="loading">Memuat...</td></tr>`;

    try {
        const params = status ? { status } : {};
        const registrations = await apiGet('listRegistrations', params);
        
        // Store all data and reset to page 1
        paginationState.registrations.allData = registrations;
        paginationState.registrations.totalItems = registrations.length;
        paginationState.registrations.currentPage = 1;
        
        renderRegistrationsTable();
        setupPagination('registrations');
        
        // Update pending count badge
        const pendingCount = registrations.filter(r => r.status === 'pending').length;
        const pendingBadge = document.getElementById('pendingCountBadge');
        if (pendingBadge) {
            if (pendingCount > 0) {
                pendingBadge.textContent = `${pendingCount} PENDING`;
                pendingBadge.style.display = 'inline-flex';
            } else {
                pendingBadge.style.display = 'none';
            }
        }
    } catch (e) {
        const tbody = document.getElementById('registrationsTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="loading"><strong style="color:#b71c1c;">${escapeHtml(e.message)}</strong></td></tr>`;
        }
        const cardsContainer = document.getElementById('registrationsCards');
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div class="loading" style="padding: 20px; text-align: center; color: #f44336;">Error: ${escapeHtml(e.message)}</div>`;
        }
    }
}

function renderRegistrationsTable() {
    const tbody = document.getElementById('registrationsTbody');
    const registrations = getPaginatedData('registrations');
    const state = paginationState.registrations;
    
    if (state.totalItems === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="loading">Tidak ada registrasi</td></tr>';
        const cardsContainer = document.getElementById('registrationsCards');
        if (cardsContainer) cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada registrasi</div>';
        return;
    }
    
    if (tbody) {
        tbody.innerHTML = registrations.map(r => registrationRowHtml(r)).join('');
        bindRegistrationRowActions();
    }
    
    // Update cards for mobile
    const cardsContainer = document.getElementById('registrationsCards');
    if (cardsContainer) {
        if (registrations.length === 0) {
            cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada registrasi</div>';
        } else {
            cardsContainer.innerHTML = registrations.map(r => {
                const email = r.email || `${r.nama?.toLowerCase().replace(/\s+/g, '.')}@external.io`;
                const requestedRole = r.requestedRole || 'User';
                const date = formatDateShort(r.createdAt);

                let actions = '';
                if (r.status === 'pending') {
                    actions = `
                        <div class="admin-card-actions">
                            <button class="btn btn-approve" data-action="approve" data-registration-id="${r.id}">Approve</button>
                            <button class="btn btn-reject" data-action="reject" data-registration-id="${r.id}">Reject</button>
                        </div>
                    `;
                } else {
                    // Show status badge first, then "Oleh: [nama]"
                    let statusText = '';
                    if (r.status === 'approved') {
                        statusText = '<span class="badge badge-active">Approved</span>';
                    } else if (r.status === 'rejected') {
                        statusText = '<span class="badge badge-inactive">Rejected</span>';
                    }
                    
                    const olehText = r.approvedByName ? `Oleh: ${escapeHtml(r.approvedByName)}` : '';
                    
                    actions = `
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${statusText}
                            ${olehText ? `<div class="admin-card-value" style="color:#666; font-size:0.85rem;">${olehText}</div>` : ''}
                        </div>
                    `;
                }
                
                // Generate WhatsApp button for approved/rejected registrations
                const whatsappButton = (r.status === 'approved' || r.status === 'rejected') ? `
                    <button class="btn btn-whatsapp btn-small" data-action="whatsapp" data-registration-id="${r.id}" title="Kirim notifikasi WhatsApp">
                        📱 WhatsApp
                    </button>
                ` : '';

                return `
                    <div class="admin-card" data-registration-id="${r.id}" style="cursor: pointer;">
                        <div class="admin-card-row">
                            <div class="admin-card-label">Applicant</div>
                            <div class="admin-card-value">
                                <div class="applicant-cell">
                                    <div class="applicant-icon">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                    </div>
                                    <div class="applicant-info">
                                        <div class="applicant-name">${escapeHtml(r.nama)}</div>
                                        <div class="applicant-email">${escapeHtml(email)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Requested Role</div>
                            <div class="admin-card-value">${escapeHtml(requestedRole)}</div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Date</div>
                            <div class="admin-card-value">${date}</div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Approval Actions</div>
                            ${actions}
                        </div>
                        ${whatsappButton ? `
                        <div class="admin-card-row">
                            <div class="admin-card-label">Notifikasi</div>
                            <div class="admin-card-value">
                                ${whatsappButton}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            // Bind actions for cards
            cardsContainer.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = btn.getAttribute('data-action');
                    const registrationId = parseInt(btn.getAttribute('data-registration-id') || '0');
                    if (!registrationId) return;

                    if (action === 'approve') {
                        await approveRegistrationFlow(registrationId);
                    } else if (action === 'reject') {
                        await openRejectModal(registrationId);
                    } else if (action === 'whatsapp') {
                        await sendWhatsAppNotification(registrationId);
                    }
                });
            });

            // Click on card to show detail
            cardsContainer.querySelectorAll('.admin-card[data-registration-id]').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    const registrationId = parseInt(card.getAttribute('data-registration-id') || '0');
                    if (registrationId) {
                        showDetailModal(registrationId);
                    }
                });
            });
        }
    }
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function registrationRowHtml(r) {
    const email = r.email || `${r.nama?.toLowerCase().replace(/\s+/g, '.')}@external.io`;
    const requestedRole = r.requestedRole || 'User';
    const date = formatDateShort(r.createdAt);

    let actions = '';
    if (r.status === 'pending') {
        actions = `
            <div class="row-actions">
                <button class="btn btn-approve" data-action="approve">Approve</button>
                <button class="btn btn-reject" data-action="reject">Reject</button>
            </div>
        `;
    } else {
        // Show status badge first, then "Oleh: [nama]"
        let statusText = '';
        if (r.status === 'approved') {
            statusText = '<span class="badge badge-active">Approved</span>';
        } else if (r.status === 'rejected') {
            statusText = '<span class="badge badge-inactive">Rejected</span>';
        }
        
        const olehText = r.approvedByName ? `Oleh: ${escapeHtml(r.approvedByName)}` : '';
        
        actions = `
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${statusText}
                ${olehText ? `<span style="color:#666; font-size:0.85rem;">${olehText}</span>` : ''}
            </div>
        `;
    }

    // Generate WhatsApp button for approved/rejected registrations
    const whatsappButton = (r.status === 'approved' || r.status === 'rejected') ? `
        <button class="btn btn-whatsapp btn-small" data-action="whatsapp" data-registration-id="${r.id}" title="Kirim notifikasi WhatsApp">
            📱 WhatsApp
        </button>
    ` : '';

    return `
        <tr data-registration-id="${r.id}">
            <td>
                <div class="applicant-cell">
                    <div class="applicant-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <div class="applicant-info">
                        <div class="applicant-name">${escapeHtml(r.nama)}</div>
                        <div class="applicant-email">${escapeHtml(email)}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(requestedRole)}</td>
            <td>${date}</td>
            <td>${actions}</td>
            <td>${whatsappButton}</td>
        </tr>
    `;
}

function bindRegistrationRowActions() {
    const tbody = document.getElementById('registrationsTbody');
    
    // Click on row to show detail
    tbody?.querySelectorAll('tr[data-registration-id]').forEach(tr => {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
            if (e.target.closest('button')) return;
            
            const registrationId = parseInt(tr?.getAttribute('data-registration-id') || '0');
            if (registrationId) {
                openDetailModal(registrationId);
            }
        });
    });
    
    // Click on approve/reject buttons for confirmation
    tbody?.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent row click
            const action = btn.getAttribute('data-action');
            const tr = e.target.closest('tr');
            const registrationId = parseInt(tr?.getAttribute('data-registration-id') || '0');
            if (!registrationId) return;

            if (action === 'approve') {
                await confirmApprove(registrationId);
            } else if (action === 'reject') {
                openRejectModal(registrationId);
            } else if (action === 'whatsapp') {
                await sendWhatsAppNotification(registrationId);
            }
        });
    });
}

let currentDetailId = null;
let currentDetailRegistration = null;

function bindDetailModal() {
    const modal = document.getElementById('detailRegistrationModal');
    const closeBtn = document.getElementById('closeDetailModal');
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    const approveBtn = document.getElementById('approveFromDetailBtn');
    const rejectBtn = document.getElementById('rejectFromDetailBtn');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        currentDetailId = null;
        approveBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
    };

    closeBtn?.addEventListener('click', close);
    closeDetailBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    approveBtn?.addEventListener('click', async () => {
        if (!currentDetailId) return;
        close();
        await confirmApprove(currentDetailId);
    });

    rejectBtn?.addEventListener('click', () => {
        if (!currentDetailId) return;
        close();
        openRejectModal(currentDetailId);
    });

    // WhatsApp button in detail modal
    const whatsappBtn = document.getElementById('whatsappDetailBtn');
    whatsappBtn?.addEventListener('click', async () => {
        if (!currentDetailRegistration || !currentDetailRegistration.nomorTelepon || currentDetailRegistration.nomorTelepon === '-') {
            await showAlert('Nomor telepon tidak tersedia.', 'Informasi', 'info');
            return;
        }
        
        // Generate WhatsApp message
        const message = generateWhatsAppMessage(currentDetailRegistration);
        // Format nomor telepon untuk WhatsApp (menangani 8, 08, +62)
        let cleanPhone = currentDetailRegistration.nomorTelepon.replace(/\D/g, ''); // Hapus semua non-digit
        if (cleanPhone.startsWith('62')) {
            // Sudah dalam format internasional
        } else if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.substring(1);
        } else if (cleanPhone.startsWith('8')) {
            // Nomor Indonesia yang dimulai dengan 8 (tanpa 0)
            cleanPhone = '62' + cleanPhone;
        } else {
            // Jika tidak dimulai dengan 62, 0, atau 8, tambahkan 62
            cleanPhone = '62' + cleanPhone;
        }
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        openWhatsAppUrl(whatsappUrl);
    });
}

function generateWhatsAppMessage(registration) {
    const baseUrl = window.location.origin;
    const detailUrl = `${baseUrl}/admin/admin.html`;
    const nomorTiket = registration.id || registration.tiket || '-';
    
    let message = `Halo ${registration.nama || 'Applicant'},\n\n`;
    message += `Terima kasih telah mendaftar. Data pendaftaran Anda:\n\n`;
    message += `Nomor Tiket: ${nomorTiket}\n`;
    message += `Nama: ${registration.nama || '-'}\n`;
    message += `NPK: ${registration.npk || '-'}\n`;
    message += `Email: ${registration.email || '-'}\n`;
    message += `Unit Kerja: ${registration.unitKerja || '-'}\n\n`;
    message += `Silakan tunggu proses approval dari admin.\n\n`;
    message += `Terima kasih.`;
    
    return message;
}

async function sendWhatsAppNotification(registrationId) {
    try {
        // Get registration data
        const registrations = await apiGet('listRegistrations', {});
        const registration = registrations.find(r => r.id === registrationId);
        
        if (!registration) {
            await showAlert('Data registrasi tidak ditemukan.', 'Error', 'error');
            return;
        }

        // Allow WhatsApp notification for approved or rejected registrations
        if (registration.status !== 'approved' && registration.status !== 'rejected') {
            await showAlert('Notifikasi WhatsApp hanya dapat dikirim untuk registrasi yang sudah diproses (approved/rejected).', 'Informasi', 'info');
            return;
        }

        if (!registration.nomorTelepon || registration.nomorTelepon === '-') {
            await showAlert('Nomor telepon tidak tersedia untuk registrasi ini.', 'Error', 'error');
            return;
        }

        let message = '';
        if (registration.status === 'approved') {
            const username = registration.npk ? registration.npk.toLowerCase() : '';
            message += "Pendaftaran akun Anda telah DISETUJUI.\n\n";
            message += "Detail Akun:\n";
            message += "• Nama: " + registration.nama + "\n";
            message += "• Username: " + username + "\n";
            message += "• NPK: " + registration.npk + "\n";
            message += "• Unit Kerja: " + registration.unitKerja + "\n\n";
            message += "Silakan login menggunakan username di atas.\n\n";
            message += "Terima kasih.";
        } else {
            const alasan = (registration.rejectionReason || '').trim() || '-';
            message += "Pendaftaran akun Anda DITOLAK.\n\n";
            message += "Detail Pendaftaran:\n";
            message += "• Nama: " + (registration.nama || '-') + "\n";
            message += "• NPK: " + (registration.npk || '-') + "\n";
            message += "• Email: " + (registration.email || '-') + "\n";
            message += "• Alasan Penolakan: " + alasan + "\n\n";
            message += "Silakan perbaiki data dan lakukan pendaftaran ulang.\n\n";
            message += "Terima kasih.";
        }

        // Generate WhatsApp URL
        // Format nomor telepon untuk WhatsApp (menangani 8, 08, +62)
        let cleanPhone = registration.nomorTelepon.replace(/\D/g, ''); // Hapus semua non-digit
        if (cleanPhone.startsWith('62')) {
            // Sudah dalam format internasional
        } else if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.substring(1);
        } else if (cleanPhone.startsWith('8')) {
            // Nomor Indonesia yang dimulai dengan 8 (tanpa 0)
            cleanPhone = '62' + cleanPhone;
        } else {
            // Jika tidak dimulai dengan 62, 0, atau 8, tambahkan 62
            cleanPhone = '62' + cleanPhone;
        }
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

        // Open WhatsApp
        openWhatsAppUrl(whatsappUrl);
    } catch (error) {
        await showAlert('Error: ' + error.message, 'Error', 'error');
    }
}

async function openDetailModal(id) {
    currentDetailId = id;
    const modal = document.getElementById('detailRegistrationModal');
    if (!modal) return;

    // Fetch registration details
    try {
        const registrations = await apiGet('listRegistrations', {});
        const registration = registrations.find(r => r.id === id);
        
        if (!registration) {
            await showAlert('Data registrasi tidak ditemukan.', 'Error', 'error');
            return;
        }

        // Populate modal with registration details
        // Handle both camelCase and snake_case from API
        const nomorTelepon = registration.nomorTelepon || registration.nomor_telepon || '-';
        const unitKerja = registration.unitKerja || registration.unit_kerja || '-';
        
        document.getElementById('detailName').textContent = registration.nama || '-';
        document.getElementById('detailNpk').textContent = registration.npk || '-';
        document.getElementById('detailEmail').textContent = registration.email || '-';
        document.getElementById('detailPhone').textContent = nomorTelepon;
        document.getElementById('detailUnitKerja').textContent = unitKerja;
        document.getElementById('detailRole').textContent = registration.requestedRole || registration.requested_role || 'User';
        
        // Format date
        const date = registration.createdAt ? formatDateShort(registration.createdAt) : '-';
        document.getElementById('detailDate').textContent = date;

        // Store registration data for WhatsApp button
        currentDetailRegistration = {
            id: registration.id,
            nama: registration.nama,
            npk: registration.npk,
            email: registration.email,
            nomorTelepon: nomorTelepon,
            unitKerja: unitKerja
        };

        // Show approve/reject buttons only if status is pending
        const approveBtn = document.getElementById('approveFromDetailBtn');
        const rejectBtn = document.getElementById('rejectFromDetailBtn');
        const whatsappBtn = document.getElementById('whatsappDetailBtn');
        
        if (registration.status === 'pending') {
            approveBtn.style.display = 'inline-block';
            rejectBtn.style.display = 'inline-block';
        } else {
            approveBtn.style.display = 'none';
            rejectBtn.style.display = 'none';
        }
        
        // Show WhatsApp button if nomor telepon exists and is valid
        if (nomorTelepon && nomorTelepon !== '-') {
            whatsappBtn.style.display = 'inline-flex';
        } else {
            whatsappBtn.style.display = 'none';
        }

        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        showAlert('Error: ' + e.message, 'Error', 'error');
    }
}

let currentConfirmApproveId = null;
let currentWhatsAppUrl = null;

function bindConfirmApproveModal() {
    const modal = document.getElementById('confirmApproveModal');
    const closeBtn = document.getElementById('closeConfirmApproveModal');
    const cancelBtn = document.getElementById('cancelConfirmApproveBtn');
    const confirmBtn = document.getElementById('confirmApproveBtn');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        clearConfirmApproveError();
        currentConfirmApproveId = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    confirmBtn?.addEventListener('click', async () => {
        if (!currentConfirmApproveId) return;
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Memproses...';
        clearConfirmApproveError();

        try {
            const result = await apiPost('approveRegistration', { id: currentConfirmApproveId });
            
            close();
            
            // Show success modal
            showSuccessApproveModal(result.whatsappUrl);
            
            await loadRegistrations();
        } catch (e) {
            showConfirmApproveError(e.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Ya, Setujui';
        }
    });
}

function bindSuccessApproveModal() {
    const modal = document.getElementById('successApproveModal');
    const closeBtn = document.getElementById('closeSuccessApproveModal');
    const closeSuccessBtn = document.getElementById('closeSuccessApproveBtn');
    const whatsappBtn = document.getElementById('openWhatsAppBtn');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        currentWhatsAppUrl = null;
    };

    closeBtn?.addEventListener('click', close);
    closeSuccessBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    whatsappBtn?.addEventListener('click', () => {
        if (currentWhatsAppUrl) {
            openWhatsAppUrl(currentWhatsAppUrl);
        }
        close();
    });
}

function showConfirmApproveError(msg) {
    const el = document.getElementById('confirmApproveError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
}

function clearConfirmApproveError() {
    const el = document.getElementById('confirmApproveError');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
}

function showSuccessApproveModal(whatsappUrl) {
    const modal = document.getElementById('successApproveModal');
    const whatsappBtn = document.getElementById('openWhatsAppBtn');
    const successActions = document.getElementById('successApproveActions');
    
    if (!modal) return;
    
    currentWhatsAppUrl = whatsappUrl || null;
    
    // Show/hide WhatsApp button based on availability
    if (whatsappUrl) {
        whatsappBtn.style.display = 'inline-flex';
    } else {
        whatsappBtn.style.display = 'none';
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

async function confirmApprove(id) {
    currentConfirmApproveId = id;
    const modal = document.getElementById('confirmApproveModal');
    if (!modal) return;
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

let currentRejectId = null;

function bindRejectModal() {
    const modal = document.getElementById('rejectModal');
    const closeBtn = document.getElementById('closeRejectModal');
    const cancelBtn = document.getElementById('cancelRejectBtn');
    const form = document.getElementById('rejectForm');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        clearRejectError();
        form?.reset();
        currentRejectId = null;
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentRejectId) return;
        
        const reason = document.getElementById('rejectionReason')?.value?.trim() || '';
        if (!reason) {
            showRejectError('Alasan penolakan wajib diisi.');
            return;
        }

        try {
            await apiPost('rejectRegistration', { id: currentRejectId, rejectionReason: reason });
            close();
            await loadRegistrations();
        } catch (e) {
            showRejectError(e.message);
        }
    });
}

function openRejectModal(id) {
    currentRejectId = id;
    const modal = document.getElementById('rejectModal');
    modal?.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.getElementById('rejectionReason')?.focus();
}

function showRejectError(msg) {
    const el = document.getElementById('rejectError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
}

function clearRejectError() {
    const el = document.getElementById('rejectError');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
}

function bindPinApproval() {
    const approverPinInput = document.getElementById('approverPinInput');
    const managerPinInput = document.getElementById('managerPinInput');
    const editPinBtn = document.getElementById('editPinBtn');
    const savePinBtn = document.getElementById('savePinBtn');
    const cancelEditPinBtn = document.getElementById('cancelEditPinBtn');
    const pinError = document.getElementById('pinError');
    
    if (!approverPinInput || !managerPinInput || !editPinBtn || !savePinBtn) return;
    
    let originalApproverPin = '';
    let originalManagerPin = '';
    
    // Only allow numbers
    approverPinInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
    managerPinInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
    
    // Edit PIN button - enable edit mode
    editPinBtn.addEventListener('click', () => {
        originalApproverPin = approverPinInput.getAttribute('data-pin-value') || '';
        originalManagerPin = managerPinInput.getAttribute('data-pin-value') || '';
        approverPinInput.value = originalApproverPin;
        managerPinInput.value = originalManagerPin;
        approverPinInput.readOnly = false;
        managerPinInput.readOnly = false;
        approverPinInput.style.backgroundColor = '#ffffff';
        managerPinInput.style.backgroundColor = '#ffffff';
        approverPinInput.style.cursor = 'text';
        managerPinInput.style.cursor = 'text';
        approverPinInput.focus();
        
        editPinBtn.style.display = 'none';
        const pinEditActions = document.getElementById('pinEditActions');
        if (pinEditActions) pinEditActions.style.display = 'flex';
        
        if (pinError) {
            pinError.style.display = 'none';
        }
    });
    
    // Cancel edit button - restore original value
    if (cancelEditPinBtn) {
        cancelEditPinBtn.addEventListener('click', () => {
            approverPinInput.value = '••••';
            managerPinInput.value = '••••';
            approverPinInput.readOnly = true;
            managerPinInput.readOnly = true;
            approverPinInput.style.backgroundColor = '#f5f5f5';
            managerPinInput.style.backgroundColor = '#f5f5f5';
            approverPinInput.style.cursor = 'not-allowed';
            managerPinInput.style.cursor = 'not-allowed';
            
            editPinBtn.style.display = 'inline-block';
            const pinEditActions = document.getElementById('pinEditActions');
            if (pinEditActions) pinEditActions.style.display = 'none';
            
            if (pinError) {
                pinError.style.display = 'none';
            }
        });
    }
    
    // Save PIN
    savePinBtn.addEventListener('click', async () => {
        const approverPin = approverPinInput.value.trim();
        const managerPin = managerPinInput.value.trim();
        
        if (approverPin.length !== 4 || managerPin.length !== 4) {
            if (pinError) {
                pinError.textContent = 'PIN Approver dan PIN Manager harus 4 digit angka';
                pinError.style.display = 'block';
            }
            return;
        }
        
        if (!/^\d{4}$/.test(approverPin) || !/^\d{4}$/.test(managerPin)) {
            if (pinError) {
                pinError.textContent = 'PIN Approver dan PIN Manager harus berupa 4 digit angka';
                pinError.style.display = 'block';
            }
            return;
        }
        if (approverPin === managerPin) {
            if (pinError) {
                pinError.textContent = 'PIN Manager harus berbeda dari PIN Approver';
                pinError.style.display = 'block';
            }
            return;
        }
        
        savePinBtn.disabled = true;
        savePinBtn.textContent = 'Menyimpan...';
        if (pinError) {
            pinError.style.display = 'none';
        }
        
        try {
            const url = getApiUrlWithParams('setApprovalPin', { approver_pin: approverPin, manager_pin: managerPin });
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'X-Auth-Token': getAuthToken()
                },
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error('Gagal menyimpan PIN');
            }
            
            const result = await response.json();
            
            console.log('Save PIN Result:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'Gagal menyimpan PIN');
            }
            
            showSuccessMessage('PIN berhasil disimpan!');
            
            const savedApproverPin = result.approver_pin ? String(result.approver_pin).trim().replace(/\s/g, '') : approverPin;
            const savedManagerPin = result.manager_pin ? String(result.manager_pin).trim().replace(/\s/g, '') : managerPin;
            approverPinInput.value = '••••';
            managerPinInput.value = '••••';
            approverPinInput.setAttribute('data-pin-value', savedApproverPin);
            managerPinInput.setAttribute('data-pin-value', savedManagerPin);
            approverPinInput.readOnly = true;
            managerPinInput.readOnly = true;
            approverPinInput.style.backgroundColor = '#f5f5f5';
            managerPinInput.style.backgroundColor = '#f5f5f5';
            approverPinInput.style.cursor = 'not-allowed';
            managerPinInput.style.cursor = 'not-allowed';
            
            editPinBtn.style.display = 'inline-block';
            const pinEditActions = document.getElementById('pinEditActions');
            if (pinEditActions) pinEditActions.style.display = 'none';
            
            // Force reload PIN after a short delay to ensure DB is updated
            setTimeout(() => {
                console.log('Reloading PIN after save...');
                loadApprovalPin();
            }, 300);
            
        } catch (error) {
            console.error('Error:', error);
            if (pinError) {
                pinError.textContent = error.message || 'Gagal menyimpan PIN';
                pinError.style.display = 'block';
            }
        } finally {
            savePinBtn.disabled = false;
            savePinBtn.textContent = 'Simpan PIN';
        }
    });
}

async function loadApprovalPin() {
    const approverPinInput = document.getElementById('approverPinInput');
    const managerPinInput = document.getElementById('managerPinInput');
    if (!approverPinInput || !managerPinInput) {
        console.warn('PIN input element not found');
        return;
    }
    
    try {
        const url = getApiUrlWithParams('getApprovalPin', {});
        
        const headers = {
            'X-Auth-Token': getAuthToken(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: headers,
            mode: 'cors',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error('Gagal memuat PIN: HTTP ' + response.status);
        }
        
        const result = await response.json();
        
        console.log('PIN Load Result (raw):', result);
        console.log('PIN Load Result (JSON):', JSON.stringify(result));
        
        if (result.success) {
            let approverPinValue = null;
            let managerPinValue = null;
            if (result.approver_pin || result.manager_pin) {
                approverPinValue = String(result.approver_pin || '').trim().replace(/\s/g, '');
                managerPinValue = String(result.manager_pin || '').trim().replace(/\s/g, '');
            } else if (result.data) {
                approverPinValue = String(result.data.approver_pin || result.data.pin || '').trim().replace(/\s/g, '');
                managerPinValue = String(result.data.manager_pin || '').trim().replace(/\s/g, '');
            }
            
            if (approverPinValue && approverPinValue.length === 4) {
                approverPinInput.value = '••••';
                approverPinInput.setAttribute('data-pin-value', approverPinValue);
                approverPinInput.readOnly = true;
                approverPinInput.style.backgroundColor = '#f5f5f5';
                approverPinInput.style.cursor = 'not-allowed';
            }
            if (managerPinValue && managerPinValue.length === 4) {
                managerPinInput.value = '••••';
                managerPinInput.setAttribute('data-pin-value', managerPinValue);
                managerPinInput.readOnly = true;
                managerPinInput.style.backgroundColor = '#f5f5f5';
                managerPinInput.style.cursor = 'not-allowed';
            }
            if (approverPinValue && approverPinValue.length === 4 && managerPinValue && managerPinValue.length === 4) {
                
                // Ensure buttons are in correct state
                const editPinBtn = document.getElementById('editPinBtn');
                if (editPinBtn) editPinBtn.style.display = 'inline-block';
                const pinEditActions = document.getElementById('pinEditActions');
                if (pinEditActions) pinEditActions.style.display = 'none';
            } else {
                console.warn('PIN value is invalid:', { approverPinValue, managerPinValue });
                console.warn('Full result:', result);
            }
        } else {
            console.warn('PIN not found in response or request failed:', result);
        }
        
    } catch (error) {
        console.error('Error loading PIN:', error);
        showAlert('Gagal memuat PIN: ' + error.message, 'Error', 'error');
    }
}

// ========== APPROVER MANAGEMENT ==========
let currentApproverId = null;

function bindApprovers() {
    const addBtn = document.getElementById('addApproverBtn');
    const refreshBtn = document.getElementById('refreshApproversBtn');
    const modal = document.getElementById('approverModal');
    const form = document.getElementById('approverForm');
    const closeBtn = document.getElementById('closeApproverModal');
    const cancelBtn = document.getElementById('cancelApproverBtn');
    
    if (addBtn) addBtn.addEventListener('click', () => openApproverModal());
    if (refreshBtn) refreshBtn.addEventListener('click', loadApprovers);
    if (closeBtn) closeBtn.addEventListener('click', closeApproverModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeApproverModal);
    if (form) form.addEventListener('submit', saveApprover);
}

async function openApproverModal(id = null) {
    currentApproverId = id;
    const modal = document.getElementById('approverModal');
    const title = document.getElementById('approverModalTitle');
    const form = document.getElementById('approverForm');
    const errorBox = document.getElementById('approverError');
    
    if (!modal) {
        console.error('Modal approver tidak ditemukan. Pastikan modal sudah ditambahkan di HTML.');
        return;
    }
    
    if (!title) {
        console.error('Title element tidak ditemukan.');
        return;
    }
    
    if (!form) {
        console.error('Form element tidak ditemukan.');
        return;
    }
    
    // Load unit kerja dropdown
    loadUnitKerjaForApprover();
    
    if (id) {
        title.textContent = 'Edit Approver';
        loadApproverData(id);
    } else {
        title.textContent = 'Tambah Approver';
        if (form) form.reset();
    }
    
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
    }
    
    modal.classList.add('show');
}

async function loadUnitKerjaForApprover() {
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getUnitKerja`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        const select = document.getElementById('approverUnitKerja');
        
        if (!select) return;
        
        if (result.success && result.data && Array.isArray(result.data)) {
            // Keep the first option (Pilih Unit Kerja)
            const firstOption = select.querySelector('option[value=""]');
            select.innerHTML = '';
            if (firstOption) select.appendChild(firstOption);
            
            result.data.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.nama_unit || unit.nama || unit.id;
                option.textContent = unit.nama_unit || unit.nama || unit.id;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading unit kerja:', error);
    }
}

async function loadUnitKerjaForUserEdit() {
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getUnitKerja`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        const select = document.getElementById('editUnitKerja');
        
        if (!select) return;
        
        if (result.success && result.data && Array.isArray(result.data)) {
            // Keep the first option (Pilih Unit Kerja)
            const firstOption = select.querySelector('option[value=""]');
            select.innerHTML = '';
            if (firstOption) select.appendChild(firstOption);
            
            result.data.forEach(unit => {
                const option = document.createElement('option');
                // Gunakan FK: value = unit_kerja.id, text = nama_unit
                option.value = String(unit.id);
                option.textContent = unit.nama_unit || unit.nama || String(unit.id);
                option.setAttribute('data-nama', unit.nama_unit || unit.nama || '');
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading unit kerja:', error);
    }
}

function loadApproverData(id) {
    loadApprovers().then(() => {
        const tbody = document.getElementById('approversTbody');
        const rows = tbody.querySelectorAll('tr[data-id]');
        for (let row of rows) {
            if (parseInt(row.getAttribute('data-id')) === id) {
                const name = row.querySelector('[data-field="name"]')?.textContent || '';
                const username = row.querySelector('[data-field="username"]')?.textContent || '';
                const email = row.querySelector('[data-field="email"]')?.textContent || '';
                const nomorTelepon = row.querySelector('[data-field="nomor_telepon"]')?.textContent || '';
                const npk = row.querySelector('[data-field="npk"]')?.textContent || '';
                const unitKerja = row.querySelector('[data-field="unit_kerja"]')?.textContent || '';
                const approverType = row.querySelector('[data-field="approver_type"]')?.getAttribute('data-value') || 'approver';
                
                document.getElementById('approverName').value = name;
                document.getElementById('approverUsername').value = username;
                document.getElementById('approverNpk').value = npk === '-' ? '' : npk;
                document.getElementById('approverEmail').value = email;
                document.getElementById('approverNomorTelepon').value = nomorTelepon;
                document.getElementById('approverUnitKerja').value = unitKerja;
                document.getElementById('approverType').value = approverType;
                break;
            }
        }
    });
}

async function saveApprover(e) {
    e.preventDefault();
    const errorBox = document.getElementById('approverError');
    const name = document.getElementById('approverName').value.trim();
    const usernameInput = document.getElementById('approverUsername').value.trim();
    const npk = document.getElementById('approverNpk').value.trim();
    const email = document.getElementById('approverEmail').value.trim();
    const nomorTelepon = document.getElementById('approverNomorTelepon').value.trim();
    const unitKerja = document.getElementById('approverUnitKerja').value.trim();
    const approverType = (document.getElementById('approverType').value || 'approver').trim().toLowerCase();
    
    if (!name) {
        showError(errorBox, 'Nama wajib diisi');
        return;
    }
    
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const url = new URL(`${fullUrl}?action=${currentApproverId ? 'updateApprover' : 'createApprover'}`);
        if (currentApproverId) url.searchParams.append('id', currentApproverId);
        url.searchParams.append('name', name);
        
        let username = usernameInput;
        if (!username) {
            username = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        }
        url.searchParams.append('username', username);
        url.searchParams.append('approver_type', approverType);
        if (npk) url.searchParams.append('npk', npk);
        if (email) url.searchParams.append('email', email);
        if (nomorTelepon) url.searchParams.append('nomor_telepon', nomorTelepon);
        if (unitKerja) url.searchParams.append('unit_kerja', unitKerja);
        
        const response = await fetch(url.toString(), {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal menyimpan approver');
        }
        
        showSuccessMessage(result.data?.message || 'Approver berhasil disimpan');
        closeApproverModal();
        loadApprovers();
    } catch (error) {
        showError(errorBox, error.message);
    }
}

function closeApproverModal() {
    document.getElementById('approverModal').classList.remove('show');
    currentApproverId = null;
    document.getElementById('approverForm').reset();
}

async function loadApprovers() {
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getApprovers`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal memuat approvers');
        }
        
        const tbody = document.getElementById('approversTbody');
        const approvers = result.data || [];
        
        // Selalu tampilkan tombol tambah approver (bisa lebih dari 1 approver aktif)
        const addBtn = document.getElementById('addApproverBtn');
        if (addBtn) {
            addBtn.style.display = 'inline-block';
        }
        
        if (approvers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">Tidak ada approver</td></tr>';
            return;
        }
        
        tbody.innerHTML = approvers.map(approver => {
            const status = approver.is_active !== false ? 'Aktif' : 'Non Aktif';
            const statusClass = approver.is_active !== false ? 'badge-active' : 'badge-inactive';
            const approverType = (approver.approver_type || 'approver').toLowerCase();
            const approverTypeLabel = approverType === 'manager' ? 'Manager' : 'Approver';
            
            return `
                <tr data-id="${approver.id}">
                    <td data-field="name">${escapeHtml(approver.name || '')}</td>
                    <td data-field="username">${escapeHtml(approver.username || '')}</td>
                    <td data-field="npk">${escapeHtml(approver.npk || '-')}</td>
                    <td data-field="approver_type" data-value="${escapeHtml(approverType)}">${escapeHtml(approverTypeLabel)}</td>
                    <td data-field="nomor_telepon">${escapeHtml(approver.nomor_telepon || '-')}</td>
                    <td data-field="email">${escapeHtml(approver.email || '-')}</td>
                    <td data-field="unit_kerja">${escapeHtml(approver.unit_kerja || '-')}</td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                    <td>
                        <div class="row-actions">
                            <button class="btn-icon-action" onclick="openApproverModal(${approver.id})" title="Edit">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon-action" onclick="toggleApproverStatus(${approver.id}, ${approver.is_active !== false ? 'false' : 'true'})" title="${approver.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    ${approver.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                </svg>
                            </button>
                            <button class="btn-icon-action" onclick="resetPasswordFlow(${approver.id})" title="Reset Password">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 11V7a5 5 0 0 0-10 0v4"></path>
                                    <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                                    <line x1="12" y1="15" x2="12" y2="17"></line>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Update cards for mobile
        const cardsContainer = document.getElementById('approversCards');
        if (cardsContainer) {
            if (approvers.length === 0) {
                cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada approver</div>';
            } else {
                cardsContainer.innerHTML = approvers.map(approver => {
                    const status = approver.is_active !== false ? 'Active' : 'Inactive';
                    const statusClass = approver.is_active !== false ? 'badge-active' : 'badge-inactive';
                    const approverType = (approver.approver_type || 'approver').toLowerCase();
                    const approverTypeLabel = approverType === 'manager' ? 'Manager' : 'Approver';
                    
                    return `
                        <div class="admin-card" data-id="${approver.id}">
                            <div class="admin-card-row">
                                <div class="admin-card-label">Nama</div>
                                <div class="admin-card-value">${escapeHtml(approver.name || '')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Username</div>
                                <div class="admin-card-value">${escapeHtml(approver.username || '')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">NPK</div>
                                <div class="admin-card-value">${escapeHtml(approver.npk || '-')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Nomor Telepon</div>
                                <div class="admin-card-value">${escapeHtml(approver.nomor_telepon || '-')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Tipe</div>
                                <div class="admin-card-value">${escapeHtml(approverTypeLabel)}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Email</div>
                                <div class="admin-card-value">${escapeHtml(approver.email || '-')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Unit Kerja</div>
                                <div class="admin-card-value">${escapeHtml(approver.unit_kerja || '-')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Status</div>
                                <div class="admin-card-value"><span class="badge ${statusClass}">${status}</span></div>
                            </div>
                            <div class="admin-card-actions">
                                <button class="btn-icon-action" onclick="openApproverModal(${approver.id})" title="Edit">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                    Edit
                                </button>
                                <button class="btn-icon-action ${approver.is_active !== false ? 'btn-icon-warning' : 'btn-icon-success'}" onclick="toggleApproverStatus(${approver.id}, ${approver.is_active !== false ? 'false' : 'true'})" title="${approver.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                        ${approver.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                    </svg>
                                    ${approver.is_active !== false ? 'Non Aktif' : 'Aktif'}
                                </button>
                                <button class="btn-icon-action" onclick="resetPasswordFlow(${approver.id})" title="Reset Password">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M17 11V7a5 5 0 0 0-10 0v4"></path>
                                        <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                                        <line x1="12" y1="15" x2="12" y2="17"></line>
                                    </svg>
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Error loading approvers:', error);
        const tbody = document.getElementById('approversTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="loading" style="color: #f44336;">Error: ${error.message}</td></tr>`;
        }
        const cardsContainer = document.getElementById('approversCards');
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div class="loading" style="padding: 20px; text-align: center; color: #f44336;">Error: ${error.message}</div>`;
        }
    }
}

async function toggleApproverStatus(id, activate) {
    const action = activate ? 'mengaktifkan' : 'menonaktifkan';
    const title = activate ? 'Aktifkan Approver' : 'Nonaktifkan Approver';
    const description = activate 
        ? 'Approver akan dapat digunakan untuk approval setelah diaktifkan.'
        : 'Approver tidak akan dapat digunakan untuk approval setelah dinonaktifkan.';
    const confirmed = await showConfirm(
        `${activate ? 'Aktifkan' : 'Nonaktifkan'} approver ini?`,
        title,
        description
    );
    if (!confirmed) return;
    
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=updateApprover&id=${id}&is_active=${activate ? 1 : 0}`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || `Gagal ${action} approver`);
        }
        
        showSuccessMessage(`Approver berhasil ${activate ? 'diaktifkan' : 'dinonaktifkan'}`);
        loadApprovers();
    } catch (error) {
        await showAlert('Error: ' + error.message, 'Error', 'error');
    }
}

// ========== PETUGAS MANAGEMENT ==========
let currentPetugasId = null;

function bindPetugas() {
    const addBtn = document.getElementById('addPetugasBtn');
    const refreshBtn = document.getElementById('refreshPetugasBtn');
    const modal = document.getElementById('petugasModal');
    const form = document.getElementById('petugasForm');
    const closeBtn = document.getElementById('closePetugasModal');
    const cancelBtn = document.getElementById('cancelPetugasBtn');
    
    if (addBtn) addBtn.addEventListener('click', () => openPetugasModal());
    if (refreshBtn) refreshBtn.addEventListener('click', loadPetugas);
    if (closeBtn) closeBtn.addEventListener('click', closePetugasModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closePetugasModal);
    if (form) form.addEventListener('submit', savePetugas);
}

function openPetugasModal(id = null) {
    currentPetugasId = id;
    const modal = document.getElementById('petugasModal');
    const title = document.getElementById('petugasModalTitle');
    const form = document.getElementById('petugasForm');
    const errorBox = document.getElementById('petugasError');
    const statusRow = document.getElementById('petugasStatusRow');
    
    if (id) {
        title.textContent = 'Edit Petugas';
        if (statusRow) statusRow.style.display = 'block';
        loadPetugasData(id);
    } else {
        title.textContent = 'Tambah Petugas';
        if (statusRow) statusRow.style.display = 'none';
        form.reset();
    }
    
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
    }
    
    modal.classList.add('show');
}

function loadPetugasData(id) {
    loadPetugas().then(() => {
        const petugasList = paginationState.petugas.allData;
        const petugas = petugasList.find(p => p.id === id);
        
        if (petugas) {
            document.getElementById('petugasNama').value = petugas.nama || '';
            document.getElementById('petugasNpk').value = petugas.npk || '';
            document.getElementById('petugasJabatan').value = petugas.jabatan || '';
            document.getElementById('petugasNoWa').value = petugas.no_wa || '';
            document.getElementById('petugasStatus').value = petugas.is_active !== false ? '1' : '0';
            document.getElementById('petugasStatusRow').style.display = 'block';
        }
    });
}

async function savePetugas(e) {
    e.preventDefault();
    const errorBox = document.getElementById('petugasError');
    const nama = document.getElementById('petugasNama').value.trim();
    const npk = document.getElementById('petugasNpk').value.trim();
    const jabatan = document.getElementById('petugasJabatan').value.trim();
    const noWa = document.getElementById('petugasNoWa').value.trim();
    const status = document.getElementById('petugasStatus')?.value || '1';
    
    if (!nama) {
        showError(errorBox, 'Nama petugas wajib diisi');
        return;
    }
    
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const url = new URL(`${fullUrl}?action=${currentPetugasId ? 'updatePetugas' : 'createPetugas'}`);
        if (currentPetugasId) url.searchParams.append('id', currentPetugasId);
        url.searchParams.append('nama', nama);
        if (npk) url.searchParams.append('npk', npk);
        if (jabatan) url.searchParams.append('jabatan', jabatan);
        if (noWa) url.searchParams.append('no_wa', noWa);
        if (currentPetugasId) {
            url.searchParams.append('is_active', status);
        }
        
        const response = await fetch(url.toString(), {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal menyimpan petugas');
        }
        
        showSuccessMessage(result.data?.message || 'Petugas berhasil disimpan');
        closePetugasModal();
        loadPetugas();
    } catch (error) {
        showError(errorBox, error.message);
    }
}

function closePetugasModal() {
    document.getElementById('petugasModal').classList.remove('show');
    currentPetugasId = null;
    document.getElementById('petugasForm').reset();
}

async function loadPetugas() {
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getPetugas`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal memuat petugas');
        }
        
        const petugasList = Array.isArray(result.data) ? result.data : [];
        
        // Store all data and reset to page 1
        paginationState.petugas.allData = petugasList;
        paginationState.petugas.totalItems = petugasList.length;
        paginationState.petugas.currentPage = 1;
        
        renderPetugasTable();
        setupPagination('petugas');
    } catch (error) {
        console.error('Error loading petugas:', error);
        const tbody = document.getElementById('petugasTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="loading" style="color: #f44336;">Error: ${error.message}</td></tr>`;
        }
        const cardsContainer = document.getElementById('petugasCards');
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div class="loading" style="padding: 20px; text-align: center; color: #f44336;">Error: ${error.message}</div>`;
        }
    }
}

function renderPetugasTable() {
    const tbody = document.getElementById('petugasTbody');
    const petugasList = getPaginatedData('petugas');
    const state = paginationState.petugas;
    
    if (state.totalItems === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading">Tidak ada petugas</td></tr>';
        const cardsContainer = document.getElementById('petugasCards');
        if (cardsContainer) cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada petugas</div>';
        return;
    }
    
    if (tbody) {
        tbody.innerHTML = petugasList.map(petugas => {
            const status = petugas.is_active !== false ? 'Aktif' : 'Non Aktif';
            const statusClass = petugas.is_active !== false ? 'badge-active' : 'badge-inactive';
            
            return `
                <tr data-id="${petugas.id}">
                    <td data-field="nama">${escapeHtml(petugas.nama || '')}</td>
                    <td data-field="npk">${escapeHtml(petugas.npk || '-')}</td>
                    <td data-field="jabatan">${escapeHtml(petugas.jabatan || '-')}</td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                    <td>
                        <div class="row-actions">
                            <button class="btn-icon-action" onclick="openPetugasModal(${petugas.id})" title="Edit">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon-action" onclick="togglePetugasStatus(${petugas.id}, ${petugas.is_active !== false ? 'false' : 'true'})" title="${petugas.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    ${petugas.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Update cards for mobile
        const cardsContainer = document.getElementById('petugasCards');
        if (cardsContainer) {
            if (petugasList.length === 0) {
                cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada petugas</div>';
            } else {
                cardsContainer.innerHTML = petugasList.map(petugas => {
                    const status = petugas.is_active !== false ? 'Active' : 'Inactive';
                    const statusClass = petugas.is_active !== false ? 'badge-active' : 'badge-inactive';
                    
                    return `
                        <div class="admin-card" data-id="${petugas.id}">
                            <div class="admin-card-row">
                                <div class="admin-card-label">Nama</div>
                                <div class="admin-card-value">${escapeHtml(petugas.nama || '')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">NPK</div>
                                <div class="admin-card-value">${escapeHtml(petugas.npk || '-')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Jabatan</div>
                                <div class="admin-card-value">${escapeHtml(petugas.jabatan || '-')}</div>
                            </div>
                            <div class="admin-card-row">
                                <div class="admin-card-label">Status</div>
                                <div class="admin-card-value"><span class="badge ${statusClass}">${status}</span></div>
                            </div>
                            <div class="admin-card-actions">
                                <button class="btn-icon-action" onclick="openPetugasModal(${petugas.id})" title="Edit">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                    Edit
                                </button>
                                <button class="btn-icon-action" onclick="togglePetugasStatus(${petugas.id}, ${petugas.is_active !== false ? 'false' : 'true'})" title="${petugas.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                        ${petugas.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                    </svg>
                                    ${petugas.is_active !== false ? 'Non Aktif' : 'Aktif'}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }
}

async function togglePetugasStatus(id, activate) {
    const action = activate ? 'mengaktifkan' : 'menonaktifkan';
    const title = activate ? 'Aktifkan Petugas' : 'Nonaktifkan Petugas';
    const description = activate 
        ? 'Petugas akan dapat digunakan untuk notifikasi setelah diaktifkan.'
        : 'Petugas tidak akan dapat digunakan untuk notifikasi setelah dinonaktifkan.';
    const confirmed = await showConfirm(
        `${activate ? 'Aktifkan' : 'Nonaktifkan'} petugas ini?`,
        title,
        description
    );
    if (!confirmed) return;
    
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=updatePetugas&id=${id}&is_active=${activate ? 1 : 0}`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || `Gagal ${action} petugas`);
        }
        
        showSuccessMessage(`Petugas berhasil ${activate ? 'diaktifkan' : 'dinonaktifkan'}`);
        loadPetugas();
    } catch (error) {
        await showAlert('Error: ' + error.message, 'Error', 'error');
    }
}

// ========== PAGINATION FUNCTIONS ==========
// Pagination state for each table
const paginationState = {
    petugas: { currentPage: 1, itemsPerPage: 5, totalItems: 0, allData: [] },
    users: { currentPage: 1, itemsPerPage: 5, totalItems: 0, allData: [] },
    registrations: { currentPage: 1, itemsPerPage: 5, totalItems: 0, allData: [] },
    unitKerja: { currentPage: 1, itemsPerPage: 5, totalItems: 0, allData: [] },
    jenisPermintaan: { currentPage: 1, itemsPerPage: 5, totalItems: 0, allData: [] }
};

function setupPagination(tableName) {
    const state = paginationState[tableName];
    if (!state) return;
    
    const prefix = tableName;
    const firstBtn = document.getElementById(`${prefix}PaginationFirst`);
    const prevBtn = document.getElementById(`${prefix}PaginationPrev`);
    const nextBtn = document.getElementById(`${prefix}PaginationNext`);
    const lastBtn = document.getElementById(`${prefix}PaginationLast`);
    const paginationContainer = document.getElementById(`${prefix}Pagination`);
    
    if (!paginationContainer) return;
    
    // Show pagination if more than itemsPerPage items
    if (state.totalItems > state.itemsPerPage) {
        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.style.display = 'none';
        return;
    }
    
    const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = Math.min(startIndex + state.itemsPerPage, state.totalItems);
    
    // Update info
    document.getElementById(`${prefix}PaginationStart`).textContent = state.totalItems > 0 ? startIndex + 1 : 0;
    document.getElementById(`${prefix}PaginationEnd`).textContent = endIndex;
    document.getElementById(`${prefix}PaginationTotal`).textContent = state.totalItems;
    document.getElementById(`${prefix}PaginationPageInfo`).textContent = `Halaman ${state.currentPage} dari ${totalPages}`;
    
    // Update buttons
    if (firstBtn) {
        firstBtn.disabled = state.currentPage === 1;
        firstBtn.onclick = () => goToPage(tableName, 1);
    }
    if (prevBtn) {
        prevBtn.disabled = state.currentPage === 1;
        prevBtn.onclick = () => goToPage(tableName, state.currentPage - 1);
    }
    if (nextBtn) {
        nextBtn.disabled = state.currentPage >= totalPages;
        nextBtn.onclick = () => goToPage(tableName, state.currentPage + 1);
    }
    if (lastBtn) {
        lastBtn.disabled = state.currentPage >= totalPages;
        lastBtn.onclick = () => goToPage(tableName, totalPages);
    }
}

function goToPage(tableName, page) {
    const state = paginationState[tableName];
    if (!state) return;
    
    const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    
    state.currentPage = page;
    
    // Reload table data
    if (tableName === 'petugas') {
        renderPetugasTable();
    } else if (tableName === 'users') {
        renderUsersTable();
    } else if (tableName === 'registrations') {
        renderRegistrationsTable();
    } else if (tableName === 'unitKerja') {
        renderUnitKerjaTable();
    } else if (tableName === 'jenisPermintaan') {
        renderJenisPermintaanTable();
    }
    
    setupPagination(tableName);
}

function getPaginatedData(tableName) {
    const state = paginationState[tableName];
    if (!state) return [];
    
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    return state.allData.slice(startIndex, endIndex);
}

// ========== UNIT KERJA MANAGEMENT ==========
let currentUnitKerjaId = null;

function bindUnitKerja() {
    const addBtn = document.getElementById('addUnitKerjaBtn');
    const refreshBtn = document.getElementById('refreshUnitKerjaBtn');
    const modal = document.getElementById('unitKerjaModal');
    const form = document.getElementById('unitKerjaForm');
    const closeBtn = document.getElementById('closeUnitKerjaModal');
    const cancelBtn = document.getElementById('cancelUnitKerjaBtn');
    
    if (addBtn) addBtn.addEventListener('click', () => openUnitKerjaModal());
    if (refreshBtn) refreshBtn.addEventListener('click', loadUnitKerja);
    if (closeBtn) closeBtn.addEventListener('click', closeUnitKerjaModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeUnitKerjaModal);
    if (form) form.addEventListener('submit', saveUnitKerja);
}

function openUnitKerjaModal(id = null) {
    currentUnitKerjaId = id;
    const modal = document.getElementById('unitKerjaModal');
    const title = document.getElementById('unitKerjaModalTitle');
    const form = document.getElementById('unitKerjaForm');
    const errorBox = document.getElementById('unitKerjaError');
    const statusRow = document.getElementById('unitKerjaStatusRow');
    const namaInput = document.getElementById('unitKerjaNama');
    
    if (id) {
        title.textContent = 'Edit Unit Kerja';
        if (statusRow) statusRow.style.display = 'block';
        loadUnitKerjaData(id);
    } else {
        title.textContent = 'Tambah Unit Kerja';
        if (statusRow) statusRow.style.display = 'none';
        form.reset();
    }
    
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
        errorBox.classList.remove('show');
    }
    
    // Focus pada input nama saat modal dibuka
    if (namaInput) {
        setTimeout(() => namaInput.focus(), 100);
    }
    
    modal.classList.add('show');
}

function loadUnitKerjaData(id) {
    loadUnitKerja().then(() => {
        const unitKerjaList = paginationState.unitKerja.allData;
        const unit = unitKerjaList.find(u => u.id === id);
        
        if (unit) {
            const nama = unit.nama_unit || unit.nama || '';
            document.getElementById('unitKerjaNama').value = nama;
            const status = unit.is_active !== false ? '1' : '0';
            const statusSelect = document.getElementById('unitKerjaStatus');
            if (statusSelect) {
                statusSelect.value = status;
            }
        }
    });
}

async function saveUnitKerja(e) {
    e.preventDefault();
    e.stopPropagation();
    const errorBox = document.getElementById('unitKerjaError');
    const namaInput = document.getElementById('unitKerjaNama');
    const nama = namaInput ? namaInput.value.trim() : '';
    
    // Clear previous errors
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
        errorBox.classList.remove('show');
    }
    
    // Remove any validation styling
    if (namaInput) {
        namaInput.classList.remove('error');
        namaInput.style.borderColor = '';
    }
    
    // Validate nama
    if (!nama) {
        if (errorBox) {
            showError(errorBox, 'Nama unit kerja wajib diisi');
        }
        if (namaInput) {
            namaInput.focus();
            namaInput.classList.add('error');
            namaInput.style.borderColor = '#f44336';
        }
        return false;
    }
    
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const url = new URL(`${fullUrl}?action=${currentUnitKerjaId ? 'updateUnitKerja' : 'createUnitKerja'}`);
        if (currentUnitKerjaId) {
            url.searchParams.append('id', currentUnitKerjaId);
            const statusSelect = document.getElementById('unitKerjaStatus');
            if (statusSelect) {
                url.searchParams.append('is_active', statusSelect.value);
            }
        }
        url.searchParams.append('nama', nama);
        
        const response = await fetch(url.toString(), {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal menyimpan unit kerja');
        }
        
        // Show success message using the notification function
        showSuccessMessage(result.data?.message || 'Unit kerja berhasil disimpan');
        closeUnitKerjaModal();
        loadUnitKerja();
        // Reload unit kerja dropdowns
        loadUnitKerjaForApprover();
        loadUnitKerjaForUserEdit();
        return true;
    } catch (error) {
        if (errorBox) {
            showError(errorBox, error.message);
        }
        if (namaInput) {
            namaInput.focus();
        }
        return false;
    }
}

function closeUnitKerjaModal() {
    const modal = document.getElementById('unitKerjaModal');
    const form = document.getElementById('unitKerjaForm');
    const errorBox = document.getElementById('unitKerjaError');
    
    if (modal) modal.classList.remove('show');
    if (form) form.reset();
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
        errorBox.classList.remove('show');
    }
    currentUnitKerjaId = null;
}

async function loadUnitKerja() {
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getAllUnitKerja`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal memuat unit kerja');
        }
        
        const unitKerjaList = Array.isArray(result.data) ? result.data : [];
        
        // Store all data and reset to page 1
        paginationState.unitKerja.allData = unitKerjaList;
        paginationState.unitKerja.totalItems = unitKerjaList.length;
        paginationState.unitKerja.currentPage = 1;
        
        renderUnitKerjaTable();
        setupPagination('unitKerja');
    } catch (error) {
        console.error('Error loading unit kerja:', error);
        const tbody = document.getElementById('unitKerjaTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" class="loading" style="color: #f44336;">Error: ${error.message}</td></tr>`;
        }
        const cardsContainer = document.getElementById('unitKerjaCards');
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div class="loading" style="padding: 20px; text-align: center; color: #f44336;">Error: ${error.message}</div>`;
        }
    }
}

function renderUnitKerjaTable() {
    const tbody = document.getElementById('unitKerjaTbody');
    const unitKerjaList = getPaginatedData('unitKerja');
    const state = paginationState.unitKerja;
    
    if (state.totalItems === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="loading">Tidak ada unit kerja</td></tr>';
        const cardsContainer = document.getElementById('unitKerjaCards');
        if (cardsContainer) cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada unit kerja</div>';
        return;
    }
    
    if (tbody) {
        tbody.innerHTML = unitKerjaList.map(unit => {
            const status = unit.is_active !== false ? 'Aktif' : 'Non Aktif';
            const statusClass = unit.is_active !== false ? 'badge-active' : 'badge-inactive';
            
            return `
                <tr data-id="${unit.id}">
                    <td data-field="nama">${escapeHtml(unit.nama_unit || unit.nama || '')}</td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                    <td>
                        <div class="row-actions">
                            <button class="btn-icon-action" onclick="openUnitKerjaModal(${unit.id})" title="Edit">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon-action" onclick="toggleUnitKerjaStatus(${unit.id}, ${unit.is_active !== false ? false : true})" title="${unit.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    ${unit.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update cards for mobile
    const cardsContainer = document.getElementById('unitKerjaCards');
    if (cardsContainer) {
        if (unitKerjaList.length === 0) {
            cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada unit kerja</div>';
        } else {
            cardsContainer.innerHTML = unitKerjaList.map(unit => {
                const status = unit.is_active !== false ? 'Aktif' : 'Non Aktif';
                const statusClass = unit.is_active !== false ? 'badge-active' : 'badge-inactive';
                
                return `
                    <div class="admin-card" data-id="${unit.id}">
                        <div class="admin-card-row">
                            <div class="admin-card-label">Nama Unit Kerja</div>
                            <div class="admin-card-value">${escapeHtml(unit.nama_unit || unit.nama || '')}</div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Status</div>
                            <div class="admin-card-value"><span class="badge ${statusClass}">${status}</span></div>
                        </div>
                        <div class="admin-card-actions">
                            <button class="btn-icon-action" onclick="openUnitKerjaModal(${unit.id})" title="Edit">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Edit
                            </button>
                            <button class="btn-icon-action" onclick="toggleUnitKerjaStatus(${unit.id}, ${unit.is_active !== false ? false : true})" title="${unit.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    ${unit.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                </svg>
                                ${unit.is_active !== false ? 'Non Aktif' : 'Aktif'}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

async function toggleUnitKerjaStatus(id, activate) {
    // Ensure activate is a boolean
    activate = activate === true || activate === 'true' || activate === 1;
    
    // Get unit kerja data from current list to get the nama
    const unitKerjaList = paginationState.unitKerja.allData;
    const unit = unitKerjaList.find(u => u.id === id);
    
    if (!unit) {
        await showAlert('Error: Unit kerja tidak ditemukan', 'Error', 'error');
        return;
    }
    
    const nama = unit.nama_unit || unit.nama || '';
    if (!nama) {
        await showAlert('Error: Nama unit kerja tidak ditemukan', 'Error', 'error');
        return;
    }
    
    const action = activate ? 'mengaktifkan' : 'menonaktifkan';
    const title = activate ? 'Aktifkan Unit Kerja' : 'Nonaktifkan Unit Kerja';
    let description = activate 
        ? 'Unit kerja akan dapat digunakan dan muncul di dropdown setelah diaktifkan.'
        : 'Unit kerja tidak akan dapat digunakan dan tidak muncul di dropdown setelah dinonaktifkan. Semua akun dengan unit kerja ini akan dinonaktifkan.';
    
    // Jika mengaktifkan, tanyakan apakah ingin mengaktifkan users juga
    let activateUsers = false;
    if (activate) {
        description += '\n\nApakah Anda juga ingin mengaktifkan kembali semua akun yang memiliki unit kerja ini?';
        activateUsers = await showConfirm(
            'Aktifkan unit kerja ini?',
            title,
            description
        );
        if (!activateUsers) {
            // User membatalkan, tanyakan lagi apakah tetap ingin mengaktifkan unit kerja tanpa users
            const confirmActivate = await showConfirm(
                'Aktifkan unit kerja tanpa mengaktifkan akun?',
                'Konfirmasi',
                'Unit kerja akan diaktifkan, tetapi akun dengan unit kerja ini tetap tidak aktif. Anda dapat mengaktifkan akun secara manual nanti.'
            );
            if (!confirmActivate) {
                return; // User membatalkan semua
            }
        }
    } else {
        // Jika menonaktifkan, konfirmasi langsung
        const confirmed = await showConfirm(
            `Nonaktifkan unit kerja ini?`,
            title,
            description
        );
        if (!confirmed) return;
    }
    
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const url = new URL(`${fullUrl}?action=updateUnitKerja`);
        url.searchParams.append('id', id);
        url.searchParams.append('nama', nama);
        url.searchParams.append('is_active', activate ? 1 : 0);
        
        // Jika mengaktifkan dan user memilih untuk mengaktifkan users juga
        if (activate && activateUsers) {
            url.searchParams.append('activate_users', 1);
        }
        
        const response = await fetch(url.toString(), {
            headers: { 'X-Auth-Token': token || '' }
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || `Gagal ${action} unit kerja`);
        }
        
        let successMessage = `Unit kerja berhasil ${activate ? 'diaktifkan' : 'dinonaktifkan'}`;
        if (activate && activateUsers) {
            successMessage += '. Semua akun dengan unit kerja ini telah diaktifkan kembali.';
        } else if (activate && !activateUsers) {
            successMessage += '. Akun dengan unit kerja ini tetap tidak aktif.';
        } else {
            successMessage += '. Semua akun dengan unit kerja ini telah dinonaktifkan.';
        }
        
        showSuccessMessage(successMessage);
        loadUnitKerja();
        // Reload unit kerja dropdowns
        loadUnitKerjaForApprover();
        loadUnitKerjaForUserEdit();
    } catch (error) {
        await showAlert('Error: ' + error.message, 'Error', 'error');
    }
}

// ========== JENIS PERMINTAAN MANAGEMENT ==========
let currentJenisPermintaanId = null;

function bindJenisPermintaan() {
    const addBtn = document.getElementById('addJenisPermintaanBtn');
    const refreshBtn = document.getElementById('refreshJenisPermintaanBtn');
    const form = document.getElementById('jenisPermintaanForm');
    const closeBtn = document.getElementById('closeJenisPermintaanModal');
    const cancelBtn = document.getElementById('cancelJenisPermintaanBtn');

    if (addBtn) addBtn.addEventListener('click', () => openJenisPermintaanModal());
    if (refreshBtn) refreshBtn.addEventListener('click', loadJenisPermintaan);
    if (closeBtn) closeBtn.addEventListener('click', closeJenisPermintaanModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeJenisPermintaanModal);
    if (form) form.addEventListener('submit', saveJenisPermintaan);
}

function openJenisPermintaanModal(id = null) {
    currentJenisPermintaanId = id;
    const modal = document.getElementById('jenisPermintaanModal');
    const title = document.getElementById('jenisPermintaanModalTitle');
    const form = document.getElementById('jenisPermintaanForm');
    const errorBox = document.getElementById('jenisPermintaanError');
    const statusRow = document.getElementById('jenisPermintaanStatusRow');
    const namaInput = document.getElementById('jenisPermintaanNama');

    if (id) {
        title.textContent = 'Edit Jenis Permintaan';
        if (statusRow) statusRow.style.display = 'block';
        loadJenisPermintaanData(id);
    } else {
        title.textContent = 'Tambah Jenis Permintaan';
        if (statusRow) statusRow.style.display = 'none';
        form?.reset();
    }

    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
        errorBox.classList.remove('show');
    }

    if (namaInput) {
        setTimeout(() => namaInput.focus(), 100);
    }
    modal?.classList.add('show');
}

function loadJenisPermintaanData(id) {
    loadJenisPermintaan().then(() => {
        const list = paginationState.jenisPermintaan.allData;
        const item = list.find((x) => x.id === id);
        if (!item) return;
        const nama = item.nama_jenis || item.nama_opsi || '';
        document.getElementById('jenisPermintaanNama').value = nama;
        const status = item.is_active !== false ? '1' : '0';
        const statusSelect = document.getElementById('jenisPermintaanStatus');
        if (statusSelect) statusSelect.value = status;
    });
}

async function saveJenisPermintaan(e) {
    e.preventDefault();
    e.stopPropagation();
    const errorBox = document.getElementById('jenisPermintaanError');
    const namaInput = document.getElementById('jenisPermintaanNama');
    const nama = namaInput ? namaInput.value.trim() : '';

    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
        errorBox.classList.remove('show');
    }
    if (namaInput) {
        namaInput.classList.remove('error');
        namaInput.style.borderColor = '';
    }

    if (!nama) {
        if (errorBox) showError(errorBox, 'Nama jenis permintaan wajib diisi');
        if (namaInput) {
            namaInput.focus();
            namaInput.classList.add('error');
            namaInput.style.borderColor = '#f44336';
        }
        return false;
    }

    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const url = new URL(`${fullUrl}?action=${currentJenisPermintaanId ? 'updateJenisPermintaan' : 'createJenisPermintaan'}`);
        if (currentJenisPermintaanId) {
            url.searchParams.append('id', currentJenisPermintaanId);
            const statusSelect = document.getElementById('jenisPermintaanStatus');
            if (statusSelect) {
                url.searchParams.append('is_active', statusSelect.value);
            }
        }
        url.searchParams.append('nama', nama);

        const response = await fetch(url.toString(), {
            headers: { 'X-Auth-Token': token || '' }
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal menyimpan jenis permintaan');
        }

        showSuccessMessage(result.data?.message || 'Jenis permintaan berhasil disimpan');
        closeJenisPermintaanModal();
        loadJenisPermintaan();
        return true;
    } catch (error) {
        if (errorBox) showError(errorBox, error.message);
        if (namaInput) namaInput.focus();
        return false;
    }
}

function closeJenisPermintaanModal() {
    const modal = document.getElementById('jenisPermintaanModal');
    const form = document.getElementById('jenisPermintaanForm');
    const errorBox = document.getElementById('jenisPermintaanError');
    if (modal) modal.classList.remove('show');
    if (form) form.reset();
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
        errorBox.classList.remove('show');
    }
    currentJenisPermintaanId = null;
}

async function loadJenisPermintaan() {
    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getAllJenisPermintaan`, {
            headers: { 'X-Auth-Token': token || '' }
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal memuat jenis permintaan');
        }
        const list = Array.isArray(result.data) ? result.data : [];
        paginationState.jenisPermintaan.allData = list;
        paginationState.jenisPermintaan.totalItems = list.length;
        paginationState.jenisPermintaan.currentPage = 1;

        renderJenisPermintaanTable();
        setupPagination('jenisPermintaan');
    } catch (error) {
        console.error('Error loading jenis permintaan:', error);
        const tbody = document.getElementById('jenisPermintaanTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" class="loading" style="color: #f44336;">Error: ${error.message}</td></tr>`;
        }
        const cardsContainer = document.getElementById('jenisPermintaanCards');
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div class="loading" style="padding: 20px; text-align: center; color: #f44336;">Error: ${error.message}</div>`;
        }
    }
}

function renderJenisPermintaanTable() {
    const tbody = document.getElementById('jenisPermintaanTbody');
    const list = getPaginatedData('jenisPermintaan');
    const state = paginationState.jenisPermintaan;

    if (state.totalItems === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="loading">Tidak ada jenis permintaan</td></tr>';
        const cardsContainer = document.getElementById('jenisPermintaanCards');
        if (cardsContainer) cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada jenis permintaan</div>';
        return;
    }

    if (tbody) {
        tbody.innerHTML = list.map((item) => {
            const status = item.is_active !== false ? 'Aktif' : 'Non Aktif';
            const statusClass = item.is_active !== false ? 'badge-active' : 'badge-inactive';
            const nama = item.nama_jenis || item.nama_opsi || '';
            return `
                <tr data-id="${item.id}">
                    <td data-field="nama">${escapeHtml(nama)}</td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                    <td>
                        <div class="row-actions">
                            <button class="btn-icon-action" onclick="openJenisPermintaanModal(${item.id})" title="Edit">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon-action" onclick="toggleJenisPermintaanStatus(${item.id}, ${item.is_active !== false ? false : true})" title="${item.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    ${item.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    const cardsContainer = document.getElementById('jenisPermintaanCards');
    if (cardsContainer) {
        if (list.length === 0) {
            cardsContainer.innerHTML = '<div class="loading" style="padding: 20px; text-align: center; color: #666;">Tidak ada jenis permintaan</div>';
        } else {
            cardsContainer.innerHTML = list.map((item) => {
                const status = item.is_active !== false ? 'Aktif' : 'Non Aktif';
                const statusClass = item.is_active !== false ? 'badge-active' : 'badge-inactive';
                const nama = item.nama_jenis || item.nama_opsi || '';
                return `
                    <div class="admin-card" data-id="${item.id}">
                        <div class="admin-card-row">
                            <div class="admin-card-label">Nama Jenis Permintaan</div>
                            <div class="admin-card-value">${escapeHtml(nama)}</div>
                        </div>
                        <div class="admin-card-row">
                            <div class="admin-card-label">Status</div>
                            <div class="admin-card-value"><span class="badge ${statusClass}">${status}</span></div>
                        </div>
                        <div class="admin-card-actions">
                            <button class="btn-icon-action" onclick="openJenisPermintaanModal(${item.id})" title="Edit">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Edit
                            </button>
                            <button class="btn-icon-action" onclick="toggleJenisPermintaanStatus(${item.id}, ${item.is_active !== false ? false : true})" title="${item.is_active !== false ? 'Non Aktifkan' : 'Aktifkan'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    ${item.is_active !== false ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
                                </svg>
                                ${item.is_active !== false ? 'Non Aktif' : 'Aktif'}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

async function toggleJenisPermintaanStatus(id, activate) {
    activate = activate === true || activate === 'true' || activate === 1;
    const title = activate ? 'Aktifkan Jenis Permintaan' : 'Nonaktifkan Jenis Permintaan';
    const description = activate
        ? 'Jenis permintaan akan tampil di semua dropdown setelah diaktifkan.'
        : 'Jenis permintaan tidak akan tampil di semua dropdown setelah dinonaktifkan.';
    const confirmed = await showConfirm(
        `${activate ? 'Aktifkan' : 'Nonaktifkan'} jenis permintaan ini?`,
        title,
        description
    );
    if (!confirmed) return;

    const list = paginationState.jenisPermintaan.allData;
    const item = list.find((x) => x.id === id);
    const nama = item ? (item.nama_jenis || item.nama_opsi || '') : '';
    if (!nama) {
        await showAlert('Error: Jenis permintaan tidak ditemukan', 'Error', 'error');
        return;
    }

    try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const url = new URL(`${fullUrl}?action=updateJenisPermintaan`);
        url.searchParams.append('id', id);
        url.searchParams.append('nama', nama);
        url.searchParams.append('is_active', activate ? 1 : 0);

        const response = await fetch(url.toString(), {
            headers: { 'X-Auth-Token': token || '' }
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || `Gagal ${activate ? 'mengaktifkan' : 'menonaktifkan'} jenis permintaan`);
        }
        showSuccessMessage(`Jenis permintaan berhasil ${activate ? 'diaktifkan' : 'dinonaktifkan'}`);
        loadJenisPermintaan();
    } catch (error) {
        await showAlert('Error: ' + error.message, 'Error', 'error');
    }
}