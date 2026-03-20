function getApiUrl() {
    if (typeof getApiUrlSafe === 'function') {
        return getApiUrlSafe();
    }
    const currentPath = window.location.pathname;
    const lastSlash = currentPath.lastIndexOf('/');
    const basePath = currentPath.substring(0, lastSlash + 1);
    return (basePath || '/') + 'api.php';
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof isAuthenticated === 'function' && isAuthenticated()) {
        window.location.href = getAppFullUrl('/index.html');
        return;
    }

    loadUnitKerja();
    setupPasswordToggle();

    const emailInput = document.getElementById('email');
    const unitKerjaSelect = document.getElementById('unit_kerja');
    const requestOtpBtn = document.getElementById('requestOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const backToFormBtn = document.getElementById('backToFormBtn');
    const contactAdminBtn = document.getElementById('contactAdminBtn');
    const backLoginBtn = document.getElementById('backLoginBtn');
    const toastContainer = document.getElementById('toastContainer');
    const otpInputs = Array.from(document.querySelectorAll('.otp-input'));
    const stepperItems = Array.from(document.querySelectorAll('.step-item'));
    const stepForm = document.getElementById('stepForm');
    const stepOtp = document.getElementById('stepOtp');
    const stepDone = document.getElementById('stepDone');

    let verificationId = 0;
    let cooldownTimer = null;
    let cooldownLeft = 0;

    function showToast(message, type = 'error') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
            setTimeout(() => toast.remove(), 220);
        }, 3000);
    }

    function setStep(stepNumber) {
        stepperItems.forEach((item) => {
            item.classList.toggle('active', Number(item.dataset.step) === stepNumber);
        });
        stepForm.classList.toggle('active', stepNumber === 1);
        stepOtp.classList.toggle('active', stepNumber === 2);
        stepDone.classList.toggle('active', stepNumber === 3);
    }

    function getOtpValue() {
        return otpInputs.map((el) => (el.value || '').trim()).join('');
    }

    function clearOtpInputs() {
        otpInputs.forEach((el) => {
            el.value = '';
            el.classList.remove('filled');
        });
    }

    function setupOtpInputs() {
        if (!otpInputs.length) return;
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', function() {
                const digit = (input.value || '').replace(/\D/g, '');
                input.value = digit ? digit.slice(-1) : '';
                input.classList.toggle('filled', Boolean(input.value));
                if (input.value && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            });
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && !input.value && index > 0) otpInputs[index - 1].focus();
            });
        });
        otpInputs[0].addEventListener('paste', function(e) {
            const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            if (!pasted) return;
            e.preventDefault();
            otpInputs.forEach((el, i) => {
                el.value = pasted[i] || '';
                el.classList.toggle('filled', Boolean(el.value));
            });
            otpInputs[Math.min(pasted.length, 6) - 1]?.focus();
        });
    }

    function setLoading(button, isLoading, loadingText = 'Memproses...') {
        if (!button) return;
        button.disabled = isLoading;
        const span = button.querySelector('span');
        if (span) {
            if (isLoading) {
                button.dataset.originalText = span.textContent;
                span.textContent = loadingText;
            } else {
                span.textContent = button.dataset.originalText || span.textContent;
            }
        } else if (!isLoading) {
            button.textContent = button.dataset.originalText || button.textContent;
        } else {
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
        }
    }

    function validateForm() {
        const nama = document.getElementById('nama').value.trim();
        const npk = document.getElementById('npk').value.trim();
        const nomorTelepon = document.getElementById('nomor_telepon').value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const unitKerjaId = unitKerjaSelect.value;
        const unitKerjaText = unitKerjaSelect.options[unitKerjaSelect.selectedIndex]?.text || '';
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password_confirm').value;

        if (!nama) return { ok: false, message: 'Nama lengkap wajib diisi.', focus: 'nama' };
        if (!npk) return { ok: false, message: 'NPK wajib diisi.', focus: 'npk' };
        if (!nomorTelepon) return { ok: false, message: 'Nomor telepon wajib diisi.', focus: 'nomor_telepon' };
        if (!/^08\d{8,11}$/.test(nomorTelepon)) return { ok: false, message: 'Format nomor telepon tidak valid. Gunakan 08xxxxxxxxxx.', focus: 'nomor_telepon' };
        if (!email) return { ok: false, message: 'Email wajib diisi.', focus: 'email' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Format email tidak valid.', focus: 'email' };
        if (!unitKerjaId) return { ok: false, message: 'Unit kerja wajib dipilih.', focus: 'unit_kerja' };
        if (!password) return { ok: false, message: 'Password wajib diisi.', focus: 'password' };
        if (password.length < 6) return { ok: false, message: 'Password minimal 6 karakter.', focus: 'password' };
        if (password !== passwordConfirm) return { ok: false, message: 'Konfirmasi password tidak sesuai.', focus: 'password_confirm' };

        return {
            ok: true,
            payload: {
                nama,
                npk,
                nomor_telepon: nomorTelepon,
                email,
                unit_kerja: unitKerjaText,
                password
            }
        };
    }

    async function callApi(action, payload) {
        const res = await fetch(getApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, ...payload }).toString()
        });
        const result = await res.json().catch(() => null);
        if (!res.ok || !result) throw new Error('Gagal terhubung ke server.');
        if (!result.success) throw new Error(result.error || 'Permintaan gagal.');
        return result.data || {};
    }

    function startCooldown(seconds) {
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownLeft = Math.max(0, parseInt(seconds, 10) || 60);
        resendOtpBtn.disabled = true;
        resendOtpBtn.textContent = `Kirim Ulang (${cooldownLeft}s)`;
        cooldownTimer = setInterval(() => {
            cooldownLeft -= 1;
            if (cooldownLeft <= 0) {
                clearInterval(cooldownTimer);
                cooldownTimer = null;
                resendOtpBtn.disabled = false;
                resendOtpBtn.textContent = 'Kirim Ulang OTP';
                return;
            }
            resendOtpBtn.textContent = `Kirim Ulang (${cooldownLeft}s)`;
        }, 1000);
    }

    async function sendRegisterOtp() {
        const check = validateForm();
        if (!check.ok) {
            showToast(check.message, 'error');
            document.getElementById(check.focus)?.focus();
            return;
        }
        setLoading(requestOtpBtn, true, 'Mengirim OTP...');
        verificationId = 0;
        try {
            const data = await callApi('requestRegisterOtp', { email: check.payload.email });
            showToast(data.message || 'OTP berhasil dikirim.', 'success');
            clearOtpInputs();
            setStep(2);
            otpInputs[0]?.focus();
            startCooldown(data.cooldownSeconds || 60);
        } catch (err) {
            showToast(err.message || 'Gagal mengirim OTP.', 'error');
        } finally {
            setLoading(requestOtpBtn, false);
        }
    }

    async function verifyAndSubmitRegister() {
        const check = validateForm();
        if (!check.ok) {
            showToast(check.message, 'error');
            setStep(1);
            document.getElementById(check.focus)?.focus();
            return;
        }
        const otp = getOtpValue();
        if (otp.length !== 6) {
            showToast('OTP harus 6 digit.', 'error');
            return;
        }

        setLoading(verifyOtpBtn, true, 'Memverifikasi...');
        try {
            const verifyData = await callApi('verifyRegisterOtp', { email: check.payload.email, otp });
            verificationId = Number(verifyData.verificationId || 0);
            if (!verificationId) throw new Error('Verifikasi gagal, coba ulangi OTP.');

            await callApi('register', { ...check.payload, register_otp_id: verificationId });
            showToast('Pendaftaran berhasil. Menunggu persetujuan admin.', 'success');
            setStep(3);
        } catch (err) {
            const msg = err?.message || 'Gagal memproses pendaftaran.';
            if (msg.toLowerCase().includes('otp tidak valid') || msg.toLowerCase().includes('maksimal percobaan')) {
                showToast('OTP salah / tidak valid. Jika kendala berlanjut, silakan hubungi admin.', 'error');
            } else {
                showToast(msg, 'error');
            }
        } finally {
            setLoading(verifyOtpBtn, false);
        }
    }

    requestOtpBtn?.addEventListener('click', sendRegisterOtp);
    resendOtpBtn?.addEventListener('click', sendRegisterOtp);
    verifyOtpBtn?.addEventListener('click', verifyAndSubmitRegister);
    backToFormBtn?.addEventListener('click', () => setStep(1));
    backLoginBtn?.addEventListener('click', () => {
        window.location.href = getAppFullUrl('/login.html');
    });
    contactAdminBtn?.addEventListener('click', async () => {
        // Buka window lebih awal agar tidak diblokir popup blocker pada browser mobile.
        const preOpenedWindow = window.open('', '_blank');
        const isMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
        try {
            const admin = await callApi('getPublicAdminForWhatsApp', {});
            const rawPhone = (admin.nomor_telepon || '').replace(/[^0-9]/g, '');
            if (!rawPhone) {
                if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
                showToast('Nomor admin belum tersedia. Silakan coba lagi nanti.', 'error');
                return;
            }
            const waPhone = rawPhone.startsWith('0') ? ('62' + rawPhone.slice(1)) : rawPhone;
            const name = document.getElementById('nama')?.value?.trim() || 'User';
            const npk = document.getElementById('npk')?.value?.trim() || '-';
            const email = document.getElementById('email')?.value?.trim() || '-';
            const msg = `Saya telah melakukan pendaftaran akun di Permintaan DOF.\n\nDetail akun:\nNama : ${name}\nNPK : ${npk}\nEmail : ${email}\n\nMohon dibantu approval akun saya. Terima Kasih.`;
            const whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;

            if (preOpenedWindow && !preOpenedWindow.closed) {
                preOpenedWindow.location.href = whatsappUrl;
            } else {
                if (isMobile) {
                    window.location.href = whatsappUrl;
                } else {
                    const fallbackPopup = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                    if (fallbackPopup) {
                        fallbackPopup.opener = null;
                    } else {
                        showToast('Popup WhatsApp diblokir browser. Izinkan pop-up untuk situs ini.', 'error');
                    }
                }
            }
        } catch (err) {
            if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
            showToast(err?.message || 'Gagal membuka kontak admin.', 'error');
        }
    });
    setupOtpInputs();
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
    }
}
