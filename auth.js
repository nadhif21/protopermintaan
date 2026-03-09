const SESSION_KEY = "dof_auth_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000;

function setSession(sessionPayload) {
    // sessionPayload: { token, expiresAt, user: { id, username, name, role } }
    const isSuperAdmin = (sessionPayload?.user?.role === 'super_admin');
    const sessionData = {
        authenticated: true,
        token: sessionPayload?.token || null,
        expiresAt: sessionPayload?.expiresAt || null,
        user: sessionPayload?.user || null,
        isSuperAdmin: isSuperAdmin,
        role: sessionPayload?.user?.role || (isSuperAdmin ? 'super_admin' : 'user'),
        timestamp: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

function getSession() {
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    
    try {
        const session = JSON.parse(sessionData);
        const now = Date.now();
        
        // Expired by client timer (fallback)
        if (now - session.timestamp > SESSION_DURATION) {
            clearSession();
            return null;
        }

        // Expired by server expiry (preferred)
        if (session.expiresAt) {
            const exp = new Date(session.expiresAt);
            if (!isNaN(exp.getTime()) && now > exp.getTime()) {
                clearSession();
                return null;
            }
        }

        if (!session.token) {
            clearSession();
            return null;
        }
        
        return session;
    } catch (e) {
        clearSession();
        return null;
    }
}

function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
}

function isAuthenticated() {
    const session = getSession();
    return session !== null && session.authenticated === true;
}

function getAuthToken() {
    const session = getSession();
    return session?.token || null;
}

function getLoginPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/permintaan/') || currentPath.includes('/backdate/') || currentPath.includes('/admin/')) {
        return '../login.html';
    }
    return 'login.html';
}

function getAdminPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/permintaan/') || currentPath.includes('/backdate/')) {
        return '../admin/admin.html';
    }
    if (currentPath.includes('/admin/')) {
        return 'admin.html';
    }
    return 'admin/admin.html';
}

function checkAuth() {
    if (!isAuthenticated()) {
        window.location.href = getLoginPath();
        return false;
    }
    return true;
}

function requireSuperAdmin() {
    if (!checkAuth()) return false;
    if (!isSuperAdmin()) {
        alert('Akses ditolak. Halaman ini hanya untuk Super Admin.');
        window.location.href = getIndexPathSafe();
        return false;
    }
    return true;
}

function isSuperAdmin() {
    const session = getSession();
    return session !== null && session.isSuperAdmin === true;
}

function getUserRole() {
    const session = getSession();
    return session ? (session.role || 'user') : 'user';
}

function getIndexPathSafe() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/permintaan/') || currentPath.includes('/backdate/') || currentPath.includes('/admin/')) {
        return '../index.html';
    }
    return 'index.html';
}

function logout() {
    // Best effort call logout API (non-blocking)
    const token = getAuthToken();
    if (token) {
        fetch(getApiUrlSafe(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Auth-Token': token
            },
            body: new URLSearchParams({ action: 'logout' }).toString()
        }).catch(() => {});
    }
    clearSession();
    window.location.href = getLoginPath();
}

function getApiUrlSafe() {
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
    // Jika tidak, berarti di subfolder
    if (!basePath || basePath === '/') {
        return '/api.php';
    }
    
    // Return path absolut dengan leading slash
    return basePath + 'api.php';
}
