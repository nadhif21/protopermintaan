const API_URL = '../api.php';

document.addEventListener('DOMContentLoaded', () => {
    // Hanya super_admin yang bisa akses halaman ini
    if (!requireSuperAdmin()) return;

    bindLogout();
    renderCurrentUser();
    bindCreateUserModal();
    bindEditUserModal();
    bindResetPasswordModal();
    bindRefreshButtons();
    bindRegistrations();
    bindPinApproval();

    loadUsers();
    loadRegistrations();
    loadApprovalPin();
});

function bindLogout() {
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (!headerLogoutBtn) return;
    headerLogoutBtn.addEventListener('click', () => {
        if (typeof logout === 'function') {
            logout();
        } else {
            if (confirm('Apakah Anda yakin ingin logout?')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
                window.location.href = '../login.html';
            }
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
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Memuat...</td></tr>`;

    try {
        const users = await apiGet('listUsers');
        tbody.innerHTML = users.map(u => userRowHtml(u)).join('');
        bindUserRowActions();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading"><strong style="color:#b71c1c;">${escapeHtml(e.message)}</strong></td></tr>`;
    }
}

function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatLastLogin(updatedAt) {
    if (!updatedAt) return '-';
    const date = new Date(updatedAt);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
        return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
}

function userRowHtml(u) {
    const statusBadge = u.isActive
        ? `<span class="badge badge-active">Active</span>`
        : `<span class="badge badge-inactive">Inactive</span>`;
    const roleBadge = `<span class="badge badge-role">${escapeHtml(u.role.toUpperCase())}</span>`;
    const initials = getInitials(u.name || u.username);
    const email = u.email || `${u.username}@company.com`;
    const lastLogin = formatLastLogin(u.updatedAt);

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
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${lastLogin}</td>
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
                    <button class="btn-icon-action btn-icon-danger" data-action="delete" title="Delete">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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
            alert('Password berhasil direset. Semua session user tersebut dicabut.');
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
    tbody.innerHTML = `<tr><td colspan="4" class="loading">Memuat...</td></tr>`;

    try {
        const params = status ? { status } : {};
        const registrations = await apiGet('listRegistrations', params);
        tbody.innerHTML = registrations.map(r => registrationRowHtml(r)).join('');
        bindRegistrationRowActions();
        
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
        tbody.innerHTML = `<tr><td colspan="4" class="loading"><strong style="color:#b71c1c;">${escapeHtml(e.message)}</strong></td></tr>`;
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
        actions = `<span style="color:#666; font-size:0.85rem;">${r.approvedByName ? `Oleh: ${escapeHtml(r.approvedByName)}` : '-'}</span>`;
    }

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
    whatsappBtn?.addEventListener('click', () => {
        if (!currentDetailRegistration || !currentDetailRegistration.nomorTelepon || currentDetailRegistration.nomorTelepon === '-') {
            alert('Nomor telepon tidak tersedia.');
            return;
        }
        
        // Generate WhatsApp message
        const message = generateWhatsAppMessage(currentDetailRegistration);
        const whatsappUrl = `https://wa.me/${currentDetailRegistration.nomorTelepon.replace(/^0/, '62')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    });
}

function generateWhatsAppMessage(registration) {
    const baseUrl = window.location.origin;
    const detailUrl = `${baseUrl}/admin/admin.html`;
    
    let message = `Halo ${registration.nama || 'Applicant'},\n\n`;
    message += `Terima kasih telah mendaftar. Data pendaftaran Anda:\n\n`;
    message += `Nama: ${registration.nama || '-'}\n`;
    message += `NPK: ${registration.npk || '-'}\n`;
    message += `Email: ${registration.email || '-'}\n`;
    message += `Unit Kerja: ${registration.unitKerja || '-'}\n\n`;
    message += `Silakan tunggu proses approval dari admin.\n\n`;
    message += `Terima kasih.`;
    
    return message;
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
            alert('Data registrasi tidak ditemukan.');
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
        alert('Error: ' + e.message);
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
            window.open(currentWhatsAppUrl, '_blank');
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
    const pinInput = document.getElementById('approvalPinInput');
    const editPinBtn = document.getElementById('editPinBtn');
    const savePinBtn = document.getElementById('savePinBtn');
    const cancelEditPinBtn = document.getElementById('cancelEditPinBtn');
    const pinError = document.getElementById('pinError');
    
    if (!pinInput || !editPinBtn || !savePinBtn) return;
    
    let originalPin = ''; // Store original PIN value
    
    // Only allow numbers
    pinInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
    
    // Edit PIN button - enable edit mode
    editPinBtn.addEventListener('click', () => {
        // Get actual PIN value from data attribute or use masked value
        originalPin = pinInput.getAttribute('data-pin-value') || pinInput.value.replace(/•/g, '') || '';
        pinInput.value = originalPin; // Show actual value when editing
        pinInput.readOnly = false;
        pinInput.style.backgroundColor = '#ffffff';
        pinInput.style.cursor = 'text';
        pinInput.focus();
        
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
            // Restore masked display
            pinInput.value = '••••';
            pinInput.readOnly = true;
            pinInput.style.backgroundColor = '#f5f5f5';
            pinInput.style.cursor = 'not-allowed';
            
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
        const pin = pinInput.value.trim();
        
        if (pin.length !== 4) {
            if (pinError) {
                pinError.textContent = 'PIN harus 4 digit angka';
                pinError.style.display = 'block';
            }
            return;
        }
        
        if (!/^\d{4}$/.test(pin)) {
            if (pinError) {
                pinError.textContent = 'PIN harus berupa 4 digit angka';
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
            const url = new URL(API_URL, window.location.origin);
            url.searchParams.append('action', 'setApprovalPin');
            url.searchParams.append('pin', pin);
            
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
            
            alert('PIN berhasil disimpan!');
            
            // Exit edit mode and mask PIN
            const savedPin = result.pin ? String(result.pin).trim().replace(/\s/g, '') : pin;
            pinInput.value = '••••';
            pinInput.setAttribute('data-pin-value', savedPin);
            pinInput.readOnly = true;
            pinInput.style.backgroundColor = '#f5f5f5';
            pinInput.style.cursor = 'not-allowed';
            
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
    const pinInput = document.getElementById('approvalPinInput');
    if (!pinInput) {
        console.warn('PIN input element not found');
        return;
    }
    
    try {
        const url = new URL(API_URL, window.location.origin);
        url.searchParams.append('action', 'getApprovalPin');
        url.searchParams.append('_t', Date.now()); // Cache busting
        
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
            // Handle both result.pin and result.data.pin formats
            let pinValue = null;
            if (result.pin) {
                pinValue = String(result.pin).trim().replace(/\s/g, '');
            } else if (result.data && result.data.pin) {
                pinValue = String(result.data.pin).trim().replace(/\s/g, '');
            }
            
            if (pinValue && pinValue.length === 4) {
                console.log('Setting PIN value to:', pinValue);
                // Mask PIN for display
                pinInput.value = '••••';
                pinInput.setAttribute('data-pin-value', pinValue);
                
                // Ensure input is readonly after loading
                pinInput.readOnly = true;
                pinInput.style.backgroundColor = '#f5f5f5';
                pinInput.style.cursor = 'not-allowed';
                
                // Ensure buttons are in correct state
                const editPinBtn = document.getElementById('editPinBtn');
                if (editPinBtn) editPinBtn.style.display = 'inline-block';
                const pinEditActions = document.getElementById('pinEditActions');
                if (pinEditActions) pinEditActions.style.display = 'none';
            } else {
                console.warn('PIN value is invalid:', pinValue);
                console.warn('Full result:', result);
            }
        } else {
            console.warn('PIN not found in response or request failed:', result);
        }
        
    } catch (error) {
        console.error('Error loading PIN:', error);
        alert('Gagal memuat PIN: ' + error.message);
    }
}