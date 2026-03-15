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

document.addEventListener('DOMContentLoaded', function() {
    if (typeof isAuthenticated === 'function' && isAuthenticated()) {
        window.location.href = getAppFullUrl('/index.html');
        return;
    }

    loadUnitKerja();
    setupPasswordToggle();

    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitBtn');

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        errorMessage.classList.remove('show');
        successMessage.classList.remove('show');
        errorMessage.textContent = '';
        successMessage.textContent = '';

        const nama = document.getElementById('nama').value.trim();
        const npk = document.getElementById('npk').value.trim();
        const nomor_telepon = document.getElementById('nomor_telepon').value.trim();
        const email = document.getElementById('email').value.trim();
        const unitKerjaSelect = document.getElementById('unit_kerja');
        const unitKerjaId = unitKerjaSelect.value;
        const unitKerjaText = unitKerjaSelect.options[unitKerjaSelect.selectedIndex]?.text || '';
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password_confirm').value;

        if (!nama) {
            showError('Nama lengkap wajib diisi.');
            document.getElementById('nama').focus();
            return;
        }

        if (!npk) {
            showError('NPK wajib diisi.');
            document.getElementById('npk').focus();
            return;
        }

        if (!nomor_telepon) {
            showError('Nomor telepon wajib diisi.');
            document.getElementById('nomor_telepon').focus();
            return;
        }

        const phoneRegex = /^08\d{8,11}$/;
        if (!phoneRegex.test(nomor_telepon)) {
            showError('Format nomor telepon tidak valid. Gunakan format: 08xxxxxxxxxx (10-13 digit)');
            document.getElementById('nomor_telepon').focus();
            return;
        }

        if (!email) {
            showError('Email wajib diisi.');
            document.getElementById('email').focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError('Format email tidak valid.');
            document.getElementById('email').focus();
            return;
        }

        if (!unitKerjaId || unitKerjaId === '') {
            showError('Unit kerja wajib dipilih.');
            unitKerjaSelect.focus();
            return;
        }

        if (!password) {
            showError('Password wajib diisi.');
            document.getElementById('password').focus();
            return;
        }

        if (password.length < 6) {
            showError('Password minimal 6 karakter.');
            document.getElementById('password').focus();
            return;
        }

        if (password !== passwordConfirm) {
            showError('Konfirmasi password tidak sesuai.');
            document.getElementById('password_confirm').focus();
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.8';
            submitBtn.querySelector('span').textContent = 'Mendaftar...';

            const formData = new URLSearchParams({
                action: 'register',
                nama: nama,
                npk: npk,
                nomor_telepon: nomor_telepon,
                email: email,
                unit_kerja: unitKerjaText,
                password: password
            });

            const apiUrl = getApiUrl();
            const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
            const fullUrl = window.location.origin + path;
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            const result = await response.json().catch(() => null);
            
            if (!response.ok || !result) {
                throw new Error('Gagal terhubung ke server.');
            }

            if (!result.success) {
            throw new Error(result.error || 'Pendaftaran gagal.');
        }

        showSuccess('Pendaftaran berhasil! Permintaan Anda sedang menunggu persetujuan admin. Anda akan menerima notifikasi via WhatsApp setelah disetujui.');
        
        registerForm.reset();
        
            setTimeout(() => {
                window.location.href = getAppFullUrl('/login.html');
            }, 3000);

        } catch (error) {
            showError(error.message || 'Terjadi kesalahan saat mendaftar.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.querySelector('span').textContent = 'Daftar';
        }
    });
});

function setupPasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    const togglePasswordConfirm = document.getElementById('togglePasswordConfirm');
    const passwordInput = document.getElementById('password');
    const passwordConfirmInput = document.getElementById('password_confirm');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('active');
            
            // Update icon
            const eyeIcon = togglePassword.querySelector('.eye-icon');
            if (type === 'text') {
                eyeIcon.textContent = '🙈';
            } else {
                eyeIcon.textContent = '👁️';
            }
        });
    }

    if (togglePasswordConfirm && passwordConfirmInput) {
        togglePasswordConfirm.addEventListener('click', function() {
            const type = passwordConfirmInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordConfirmInput.setAttribute('type', type);
            togglePasswordConfirm.classList.toggle('active');
            
            // Update icon
            const eyeIcon = togglePasswordConfirm.querySelector('.eye-icon');
            if (type === 'text') {
                eyeIcon.textContent = '🙈';
            } else {
                eyeIcon.textContent = '👁️';
            }
        });
    }
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = message;
    successMessage.classList.add('show');
}

async function loadUnitKerja() {
    try {
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getUnitKerja`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.success && result.data) {
            const dataArray = Array.isArray(result.data) ? result.data : (result.data.data || []);
            
            if (Array.isArray(dataArray) && dataArray.length > 0) {
                const select = document.getElementById('unit_kerja');
                dataArray.forEach(unit => {
                    const option = document.createElement('option');
                    option.value = unit.id;
                    option.textContent = unit.nama_unit;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading unit kerja:', error);
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Gagal memuat daftar unit kerja. Silakan refresh halaman.';
            errorMessage.classList.add('show');
        }
    }
}
