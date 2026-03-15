const SESSION_KEY = "dof_auth_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000;

const APP_BASE_PATH = '/permintaandof';
const APP_BASE_URL = 'https://infoadkor.com/permintaandof';

function getBasePath() {
    return APP_BASE_PATH;
}

function getBaseUrl() {
    return APP_BASE_URL;
}

function getAppUrl(path) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    if (cleanPath.startsWith(APP_BASE_PATH)) {
        return cleanPath;
    }
    return APP_BASE_PATH + cleanPath;
}

function getAppFullUrl(path) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    if (cleanPath.startsWith(APP_BASE_PATH)) {
        return APP_BASE_URL + cleanPath.substring(APP_BASE_PATH.length);
    }
    return APP_BASE_URL + cleanPath;
}

function setSession(sessionPayload) {
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
        
        if (now - session.timestamp > SESSION_DURATION) {
            clearSession();
            return null;
        }

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
    return getAppFullUrl('/login.html');
}

function getAdminPath() {
    return getAppFullUrl('/admin/admin.html');
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
    return getAppFullUrl('/index.html');
}

function logout() {
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
    window.location.href = getAppFullUrl('/login.html');
}

function getApiUrlSafe() {
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
