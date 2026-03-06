const API_URL = '../api.php';

document.addEventListener('DOMContentLoaded', () => {
    // Hanya super_admin yang bisa akses halaman ini
    if (!requireSuperAdmin()) return;

    bindLogout();
    renderCurrentUser();
    bindCreateUserModal();
    bindEditUserModal();
    bindRefreshButtons();
    bindRegistrations();

    loadUsers();
    loadRegistrations();
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

function bindRefreshButtons() {
    document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);
}

function bindRegistrations() {
    document.getElementById('refreshRegistrationsBtn')?.addEventListener('click', loadRegistrations);
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        loadRegistrations(e.target.value);
    });
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

            if (email) updateData.email = email;
            if (npk) updateData.npk = npk;
            if (nomorTelepon) updateData.nomor_telepon = nomorTelepon;
            if (unitKerja) updateData.unit_kerja = unitKerja;

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
                    <button class="btn-small" data-action="edit">Edit</button>
                    <button class="btn-small" data-action="reset">Reset Password</button>
                    <button class="btn-small btn-danger" data-action="delete" title="Hapus user">Hapus</button>
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
                await loadUsers();
            } else if (action === 'delete') {
                await deleteUserFlow(userId);
            }
        });
    });
}

async function editUserFlow(tr, userId) {
    // Get user details from API
    try {
        const users = await apiGet('listUsers');
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            alert('User tidak ditemukan.');
            return;
        }

        // Set current edit user ID
        currentEditUserId = userId;

        // Fill form with current user data
        document.getElementById('editName').value = user.name || '';
        document.getElementById('editRole').value = user.role || 'user';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editNpk').value = user.npk || '';
        document.getElementById('editNomorTelepon').value = user.nomorTelepon || '';
        document.getElementById('editUnitKerja').value = user.unitKerja || '';

        // Show modal
        const modal = document.getElementById('editUserModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            document.getElementById('editName')?.focus();
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function deleteUserFlow(userId) {
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
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function resetPasswordFlow(userId) {
    const newPassword = prompt('Masukkan password baru:');
    if (newPassword === null) return;
    if (!newPassword.trim()) {
        alert('Password baru wajib diisi.');
        return;
    }
    await apiPost('resetUserPassword', { id: userId, newPassword: newPassword.trim() });
    alert('Password berhasil direset. Semua session user tersebut dicabut.');
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

    const url = new URL(API_URL, window.location.origin);
    url.searchParams.append('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, String(v)));
    url.searchParams.append('_t', Date.now());

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

    const res = await fetch(API_URL, {
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
    const d = new Date(input);
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
    tbody.innerHTML = `<tr><td colspan="9" class="loading">Memuat...</td></tr>`;

    try {
        const params = status ? { status } : {};
        const registrations = await apiGet('listRegistrations', params);
        tbody.innerHTML = registrations.map(r => registrationRowHtml(r)).join('');
        bindRegistrationRowActions();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="loading"><strong style="color:#b71c1c;">${escapeHtml(e.message)}</strong></td></tr>`;
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
        actions = `<span style="color:#666; font-size:0.85rem;">${r.approvedByName ? `Oleh: ${escapeHtml(r.approvedByName)}` : '-'}</span>`;
    }

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
            }
        });
    });
}

async function approveRegistration(id) {
    if (!confirm('Setujui pendaftaran ini? Akun user akan dibuat dan notifikasi WhatsApp akan dikirim.')) {
        return;
    }

    try {
        const result = await apiPost('approveRegistration', { id });
        
        if (result.whatsappUrl) {
            const openWhatsApp = confirm('Pendaftaran berhasil disetujui! Buka WhatsApp untuk mengirim notifikasi?');
            if (openWhatsApp) {
                window.open(result.whatsappUrl, '_blank');
            }
        } else {
            alert('Pendaftaran berhasil disetujui!');
        }
        
        await loadRegistrations();
    } catch (e) {
        alert('Error: ' + e.message);
    }
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