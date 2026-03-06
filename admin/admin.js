const API_URL = '../api.php';

document.addEventListener('DOMContentLoaded', () => {
    if (!requireSuperAdmin()) return;

    bindLogout();
    renderCurrentUser();
    bindCreateUserModal();
    bindRefreshButtons();

    loadUsers();
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
                    ${u.isActive ? `<button class="btn-small btn-danger" data-action="disable">Nonaktifkan</button>` : `<button class="btn-small" data-action="enable">Aktifkan</button>`}
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
            } else if (action === 'disable') {
                if (!confirm('Nonaktifkan user ini?')) return;
                await apiPost('updateUser', { id: userId, isActive: 0 });
                await loadUsers();
            } else if (action === 'enable') {
                await apiPost('updateUser', { id: userId, isActive: 1 });
                await loadUsers();
            } else if (action === 'edit') {
                await editUserFlow(tr, userId);
                await loadUsers();
            }
        });
    });
}

async function editUserFlow(tr, userId) {
    const currentName = tr.children[2]?.textContent?.trim() || '';
    const currentRole = tr.children[3]?.textContent?.trim() || '';

    const name = prompt('Ubah Nama:', currentName);
    if (name === null) return;

    const role = prompt("Ubah Role (super_admin/admin/user):", currentRole);
    if (role === null) return;

    await apiPost('updateUser', { id: userId, name: name.trim(), role: role.trim() });
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

