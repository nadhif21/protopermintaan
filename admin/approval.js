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
    if (!checkAuth()) return;
    const role = getUserRole();
    if (role !== 'super_admin' && role !== 'admin') {
        alert('Akses ditolak. Halaman ini hanya untuk Admin.');
        window.location.href = getIndexPathSafe();
        return;
    }

    if (role === 'super_admin') {
        document.getElementById('registrationsPanel')?.style.setProperty('display', 'block');
        document.getElementById('pageHint').textContent = 'Setujui atau tolak pendaftaran user baru';
    } else {
        document.getElementById('registrationsPanel')?.style.setProperty('display', 'none');
        document.getElementById('pageHint').textContent = 'Manajemen user';
    }

    bindLogout();
    renderCurrentUser();
    bindRegistrations();
    bindSuccessModal();
    bindEditUserModal();
    bindDetailUserModal();
    bindRefreshUsers();

    loadUsers();
    if (role === 'super_admin') {
        loadRegistrations();
    }
});

function bindLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin logout?')) logout();
    });
}

function renderCurrentUser() {
    const el = document.getElementById('currentUserInfo');
    const session = getSession();
    if (!el || !session?.user) return;
    el.innerHTML = `Login sebagai <strong>${escapeHtml(session.user.name || session.user.username)}</strong> (${escapeHtml(session.user.role)})`;
}

function bindRegistrations() {
    document.getElementById('refreshRegistrationsBtn')?.addEventListener('click', loadRegistrations);
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        loadRegistrations(e.target.value);
    });
    bindRejectModal();
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

// =========================
// REGISTRATIONS MANAGEMENT
// =========================

async function loadRegistrations(status = '') {
    const tbody = document.getElementById('registrationsTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" class="loading">Memuat...</td></tr>`;

    try {
        const params = status ? { status } : {};
        const registrations = await apiGet('listRegistrations', params);
        tbody.innerHTML = registrations.map(r => registrationRowHtml(r)).join('');
        bindRegistrationRowActions();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="10" class="loading"><strong style="color:#b71c1c;">${escapeHtml(e.message)}</strong></td></tr>`;
    }
}

function registrationRowHtml(r) {
    let statusBadge = '';
    if (r.status === 'pending') {
        statusBadge = `<span class="badge badge-pending">Pending</span>`;
    } else if (r.status === 'approved') {
        statusBadge = `<span class="badge badge-active">Approved</span>`;
    } else if (r.status === 'rejected') {
        statusBadge = `<span class="badge badge-inactive">Rejected</span>`;
    }

    let actions = '';
    if (r.status === 'pending') {
        actions = `
            <div class="row-actions">
                <button class="btn-small btn-primary" data-action="approve" title="Setujui dan kirim notifikasi WhatsApp">✓ Setujui</button>
                <button class="btn-small btn-danger" data-action="reject" title="Tolak pendaftaran">✕ Tolak</button>
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

    // Generate WhatsApp button only for approved registrations
    const whatsappButton = r.status === 'approved' ? `
        <button class="btn-small btn-whatsapp" data-action="whatsapp" data-registration-id="${r.id}" title="Kirim notifikasi WhatsApp">
            📱 WhatsApp
        </button>
    ` : '';

    return `
        <tr data-registration-id="${r.id}">
            <td>${r.id}</td>
            <td>${escapeHtml(r.nama)}</td>
            <td>${escapeHtml(r.npk)}</td>
            <td>${escapeHtml(r.nomorTelepon)}</td>
            <td>${escapeHtml(r.email)}</td>
            <td>${escapeHtml(r.unitKerja)}</td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(formatDateTime(r.createdAt))}</td>
            <td>${actions}</td>
            <td>${whatsappButton}</td>
        </tr>
    `;
}

function bindRegistrationRowActions() {
    const tbody = document.getElementById('registrationsTbody');
    tbody?.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = btn.getAttribute('data-action');
            const tr = e.target.closest('tr');
            const registrationId = parseInt(tr?.getAttribute('data-registration-id') || '0');
            if (!registrationId) return;

            if (action === 'approve') {
                await approveRegistration(registrationId);
            } else if (action === 'reject') {
                openRejectModal(registrationId);
            } else if (action === 'whatsapp') {
                await sendWhatsAppNotification(registrationId);
            }
        });
    });
}

let currentApprovedData = null;

async function sendWhatsAppNotification(registrationId) {
    try {
        // Get registration data
        const registrations = await apiGet('listRegistrations', {});
        const registration = registrations.find(r => r.id === registrationId);
        
        if (!registration) {
            alert('Data registrasi tidak ditemukan.');
            return;
        }

        // Only allow WhatsApp notification for approved registrations
        if (registration.status !== 'approved') {
            alert('Notifikasi WhatsApp hanya dapat dikirim untuk registrasi yang sudah disetujui.');
            return;
        }

        if (!registration.nomorTelepon) {
            alert('Nomor telepon tidak tersedia untuk registrasi ini.');
            return;
        }

        // Generate username from NPK (lowercase)
        const username = registration.npk ? registration.npk.toLowerCase() : '';

        // Generate message according to format
        let message = "Pendaftaran akun Anda telah DISETUJUI.\n\n";
        message += "Detail Akun:\n";
        message += "• Nama: " + registration.nama + "\n";
        message += "• Username: " + username + "\n";
        message += "• NPK: " + registration.npk + "\n";
        message += "• Unit Kerja: " + registration.unitKerja + "\n\n";
        message += "Silakan login menggunakan username di atas.\n\n";
        message += "Terima kasih.";

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
        window.open(whatsappUrl, '_blank');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function approveRegistration(id) {
    if (!confirm('Setujui pendaftaran ini? Akun user akan dibuat dan notifikasi WhatsApp akan dikirim.')) {
        return;
    }

    try {
        const result = await apiPost('approveRegistration', { id });
        
        const registrations = await apiGet('listRegistrations', {});
        const registration = registrations.find(r => r.id === id);
        
        if (result && registration) {
            // Use password from registration if available, otherwise use default
            const password = registration.password || 'User@25';
            
            currentApprovedData = {
                whatsappUrl: result.whatsappUrl,
                nama: registration.nama,
                username: registration.npk.toLowerCase(),
                password: password,
                npk: registration.npk,
                unitKerja: registration.unitKerja,
                nomorTelepon: registration.nomorTelepon
            };
            
            showSuccessApprovalModal(currentApprovedData);
        } else {
            alert('Pendaftaran berhasil disetujui!');
        }
        
        await loadRegistrations();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function showSuccessApprovalModal(data) {
    const modal = document.getElementById('successApprovalModal');
    if (!modal) return;
    
    document.getElementById('successNama').textContent = data.nama || '-';
    document.getElementById('successUsername').textContent = data.username || '-';
    document.getElementById('successPassword').textContent = data.password || '-';
    document.getElementById('successNpk').textContent = data.npk || '-';
    document.getElementById('successUnitKerja').textContent = data.unitKerja || '-';
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    const whatsappBtn = document.getElementById('sendWhatsAppBtn');
    if (whatsappBtn) {
        whatsappBtn.onclick = () => {
            if (data.whatsappUrl) {
                window.open(data.whatsappUrl, '_blank');
            }
        };
    }
}

function bindSuccessModal() {
    const modal = document.getElementById('successApprovalModal');
    const closeBtn = document.getElementById('closeSuccessModal');
    const closeSuccessBtn = document.getElementById('closeSuccessBtn');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        currentApprovedData = null;
    };

    closeBtn?.addEventListener('click', close);
    closeSuccessBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });
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

// =========================
// USER MANAGEMENT
// =========================

function bindRefreshUsers() {
    document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);
}

async function loadUsers() {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Memuat...</td></tr>`;

    try {
        const users = await apiGet('listUsers');
        tbody.innerHTML = users.map(u => userRowHtml(u)).join('');
        bindUserRowActions();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="loading"><strong style="color:#b71c1c;">${escapeHtml(e.message)}</strong></td></tr>`;
    }
}

function userRowHtml(u) {
    const statusBadge = u.isActive
        ? `<span class="badge badge-active">Aktif</span>`
        : `<span class="badge badge-inactive">Nonaktif</span>`;
    const roleBadge = `<span class="badge badge-role">${escapeHtml(u.role)}</span>`;

    return `
        <tr data-user-id="${u.id}">
            <td>${u.id}</td>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.name)}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(formatDateTime(u.createdAt))}</td>
            <td>${escapeHtml(formatDateTime(u.updatedAt))}</td>
            <td>
                <div class="row-actions">
                    <button class="btn-small btn-primary" data-action="detail">Detail</button>
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

            if (action === 'detail') {
                await showDetailUser(userId);
            }
        });
    });
}

let currentEditUserId = null;

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
        const unitKerja = document.getElementById('editUnitKerja')?.value?.trim() || '';

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
                role: role
            };

            if (username) updateData.username = username;
            if (email) updateData.email = email;
            if (npk) updateData.npk = npk;
            if (nomorTelepon) updateData.nomor_telepon = nomorTelepon;
            if (unitKerja) updateData.unit_kerja = unitKerja;

            await apiPost('updateUser', updateData);
            close();
            await loadUsers();
            const detailModal = document.getElementById('detailUserModal');
            if (detailModal?.classList.contains('show')) {
                detailModal.classList.remove('show');
                document.body.style.overflow = 'auto';
            }
        } catch (e) {
            showEditUserError(e.message);
        }
    });
}

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

async function editUserFlow(tr, userId) {
    try {
        if (!userId) {
            alert('User ID tidak valid.');
            return;
        }
        
        const users = await apiGet('listUsers');
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            alert('User tidak ditemukan.');
            return;
        }

        currentEditUserId = userId;

        const editNameEl = document.getElementById('editName');
        const editUsernameEl = document.getElementById('editUsername');
        const editRoleEl = document.getElementById('editRole');
        const editEmailEl = document.getElementById('editEmail');
        const editNpkEl = document.getElementById('editNpk');
        const editNomorTeleponEl = document.getElementById('editNomorTelepon');
        const editUnitKerjaEl = document.getElementById('editUnitKerja');

        if (editNameEl) editNameEl.value = user.name || '';
        if (editUsernameEl) editUsernameEl.value = user.username || '';
        if (editRoleEl) editRoleEl.value = user.role || 'user';
        if (editEmailEl) editEmailEl.value = user.email || '';
        if (editNpkEl) editNpkEl.value = user.npk || '';
        if (editNomorTeleponEl) editNomorTeleponEl.value = user.nomorTelepon || '';
        if (editUnitKerjaEl) editUnitKerjaEl.value = user.unitKerja || '';

        const modal = document.getElementById('editUserModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            if (editNameEl) editNameEl.focus();
        }
    } catch (e) {
        alert('Error: ' + e.message);
        console.error('editUserFlow error:', e);
    }
}

async function deleteUserFlow(userId) {
    if (!userId) {
        alert('User ID tidak valid.');
        return;
    }

    if (!confirm('Hapus user ini? Tindakan ini tidak dapat dibatalkan.')) {
        return;
    }

    if (!confirm('Apakah Anda yakin? User akan dihapus permanen dari sistem.')) {
        return;
    }

    try {
        await apiPost('deleteUser', { id: userId });
        alert('User berhasil dihapus.');
        await loadUsers();
        const detailModal = document.getElementById('detailUserModal');
        if (detailModal?.classList.contains('show')) {
            detailModal.classList.remove('show');
            document.body.style.overflow = 'auto';
            currentDetailUser = null;
        }
    } catch (e) {
        alert('Error: ' + e.message);
        console.error('deleteUserFlow error:', e);
    }
}

async function resetPasswordFlow(userId) {
    const newPassword = prompt('Masukkan password baru:');
    if (newPassword === null) return;
    if (!newPassword.trim()) {
        alert('Password baru wajib diisi.');
        return;
    }
    try {
        await apiPost('resetUserPassword', { id: userId, newPassword: newPassword.trim() });
        alert('Password berhasil direset. Semua session user tersebut dicabut.');
        await loadUsers();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

let currentDetailUser = null;

function bindDetailUserModal() {
    const modal = document.getElementById('detailUserModal');
    const closeBtn = document.getElementById('closeDetailUserModal');
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    const editBtn = document.getElementById('editUserBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const deleteBtn = document.getElementById('deleteUserBtn');
    const whatsappBtn = document.getElementById('whatsappUserBtn');

    const close = () => {
        modal?.classList.remove('show');
        document.body.style.overflow = 'auto';
        clearDetailUserError();
        currentDetailUser = null;
    };

    closeBtn?.addEventListener('click', close);
    closeDetailBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) close();
    });

    editBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentDetailUser) {
            console.error('currentDetailUser is null');
            return;
        }
        const userId = currentDetailUser.id;
        console.log('Edit button clicked for user:', userId);
        close();
        await editUserFlow(null, userId);
    });

    resetPasswordBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentDetailUser) {
            console.error('currentDetailUser is null');
            return;
        }
        console.log('Reset password button clicked for user:', currentDetailUser.id);
        const userId = currentDetailUser.id;
        await resetPasswordFlow(userId);
        // Refresh user list and reload detail to show updated password
        await loadUsers();
        // Reload detail without closing modal
        const users = await apiGet('listUsers');
        const updatedUser = users.find(u => u.id === userId);
        if (updatedUser) {
            currentDetailUser = updatedUser;
            // Update password in currentDetailUser for WhatsApp
        }
    });

    deleteBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentDetailUser) {
            console.error('currentDetailUser is null');
            return;
        }
        const userId = currentDetailUser.id;
        console.log('Delete button clicked for user:', userId);
        close();
        await deleteUserFlow(userId);
    });

    whatsappBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentDetailUser) {
            console.error('currentDetailUser is null');
            return;
        }
        console.log('WhatsApp button clicked for user:', currentDetailUser.id);
        openWhatsAppForUser(currentDetailUser);
    });
}

function clearDetailUserError() {
    const el = document.getElementById('detailUserError');
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
}

async function showDetailUser(userId) {
    try {
        const users = await apiGet('listUsers');
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            alert('User tidak ditemukan.');
            return;
        }

        currentDetailUser = user;

        const currentRole = getUserRole();
        const isSuperAdmin = currentRole === 'super_admin';

        const detailIdEl = document.getElementById('detailId');
        const detailUsernameEl = document.getElementById('detailUsername');
        const detailNameEl = document.getElementById('detailName');
        const detailRoleEl = document.getElementById('detailRole');
        const detailEmailEl = document.getElementById('detailEmail');
        const detailNpkEl = document.getElementById('detailNpk');
        const detailNomorTeleponEl = document.getElementById('detailNomorTelepon');
        const detailUnitKerjaEl = document.getElementById('detailUnitKerja');
        const detailStatusEl = document.getElementById('detailStatus');
        const detailCreatedEl = document.getElementById('detailCreated');
        const detailUpdatedEl = document.getElementById('detailUpdated');

        if (detailIdEl) detailIdEl.textContent = user.id || '-';
        if (detailUsernameEl) detailUsernameEl.textContent = user.username || '-';
        if (detailNameEl) detailNameEl.textContent = user.name || '-';
        if (detailRoleEl) detailRoleEl.textContent = user.role || '-';
        if (detailEmailEl) detailEmailEl.textContent = user.email || '-';
        if (detailNpkEl) detailNpkEl.textContent = user.npk || '-';
        if (detailNomorTeleponEl) detailNomorTeleponEl.textContent = user.nomorTelepon || '-';
        if (detailUnitKerjaEl) detailUnitKerjaEl.textContent = user.unitKerja || '-';
        if (detailStatusEl) detailStatusEl.textContent = user.isActive ? 'Aktif' : 'Nonaktif';
        if (detailCreatedEl) detailCreatedEl.textContent = formatDateTime(user.createdAt) || '-';
        if (detailUpdatedEl) detailUpdatedEl.textContent = formatDateTime(user.updatedAt) || '-';

        const editBtn = document.getElementById('editUserBtn');
        const resetPasswordBtn = document.getElementById('resetPasswordBtn');
        const deleteBtn = document.getElementById('deleteUserBtn');

        if (editBtn) {
            editBtn.style.display = isSuperAdmin ? 'inline-block' : 'none';
        }
        if (resetPasswordBtn) {
            resetPasswordBtn.style.display = isSuperAdmin ? 'inline-block' : 'none';
        }
        if (deleteBtn) {
            deleteBtn.style.display = isSuperAdmin ? 'inline-block' : 'none';
        }

        const modal = document.getElementById('detailUserModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function openWhatsAppForUser(user) {
    if (!user.nomorTelepon) {
        alert('Nomor telepon user tidak tersedia.');
        return;
    }

    let message = `*Informasi Akun*\n\n`;
    message += `Detail Akun:\n`;
    message += `• Nama: ${user.name || '-'}\n`;
    message += `• Username: ${user.username || '-'}\n`;
    message += `• Password: ${user.password || '-'}\n`;
    message += `• NPK: ${user.npk || '-'}\n`;
    message += `• Email: ${user.email || '-'}\n`;
    message += `• Unit Kerja: ${user.unitKerja || '-'}\n`;
    message += `• Role: ${user.role || '-'}\n\n`;
    message += `Silakan login menggunakan username dan password di atas.\n`;
    message += `Sangat disarankan untuk mengubah password setelah login pertama kali.\n\n`;
    message += `Terima kasih.`;

    // Format nomor telepon untuk WhatsApp (menangani 8, 08, +62)
    let cleanPhone = user.nomorTelepon.replace(/\D/g, ''); // Hapus semua non-digit
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
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    window.open(waUrl, '_blank');
}
