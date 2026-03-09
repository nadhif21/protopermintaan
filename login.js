function getIndexPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/permintaan/') || currentPath.includes('/backdate/')) {
        return '../index.html';
    }
    return 'index.html';
}

document.addEventListener('DOMContentLoaded', function() {
    if (isAuthenticated()) {
        window.location.href = getIndexPath();
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const togglePassword = document.getElementById('togglePassword');

    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.classList.toggle('active');
        
        const eyeIcon = togglePassword.querySelector('.eye-icon');
        if (type === 'text') {
            eyeIcon.textContent = '🙈';
            togglePassword.setAttribute('title', 'Sembunyikan password');
        } else {
            eyeIcon.textContent = '👁️';
            togglePassword.setAttribute('title', 'Tampilkan password');
        }
    });

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = (usernameInput?.value || '').trim();
        const password = passwordInput.value.trim();
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';

        if (!username) {
            errorMessage.textContent = 'Username atau email wajib diisi.';
            errorMessage.classList.add('show');
            usernameInput?.focus();
            return;
        }

        // If it looks like an email, validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (username.includes('@') && !emailRegex.test(username)) {
            errorMessage.textContent = 'Format email tidak valid.';
            errorMessage.classList.add('show');
            usernameInput?.focus();
            return;
        }

        if (!password) {
            errorMessage.textContent = 'Password wajib diisi.';
            errorMessage.classList.add('show');
            passwordInput.focus();
            return;
        }

        doLogin(username, password);
    });

    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
});

async function doLogin(username, password) {
    const errorMessage = document.getElementById('errorMessage');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');
        const submitBtn = document.querySelector('.auth-btn');

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.8';
        }

        const apiUrl = getApiUrlSafe();

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'login',
                username,
                password
            }).toString()
        });

        const result = await res.json().catch(() => null);
        if (!res.ok || !result) {
            throw new Error('Gagal terhubung ke server.');
        }

        if (!result.success) {
            throw new Error(result.error || 'Login gagal.');
        }

        setSession({
            token: result.data.token,
            expiresAt: result.data.expiresAt,
            user: result.data.user
        });

        window.location.href = getIndexPath();
    } catch (err) {
        const msg = err?.message || 'Login gagal.';
        errorMessage.textContent = msg;
        errorMessage.classList.add('show');
        passwordInput.value = '';
        passwordInput.focus();
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
        // keep username filled
        if (usernameInput && !usernameInput.value) usernameInput.value = username;
    }
}
