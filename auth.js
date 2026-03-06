const PASSWORD = "Adkor*2027!";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@2027!";
const SESSION_KEY = "dof_auth_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000;

function setSession(isSuperAdmin = false) {
    const sessionData = {
        authenticated: true,
        isSuperAdmin: isSuperAdmin,
        role: isSuperAdmin ? 'super_admin' : 'user',
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

function getLoginPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/permintaan/') || currentPath.includes('/backdate/')) {
        return '../login.html';
    }
    return 'login.html';
}

function checkAuth() {
    if (!isAuthenticated()) {
        window.location.href = getLoginPath();
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

function logout() {
    clearSession();
    window.location.href = getLoginPath();
}
