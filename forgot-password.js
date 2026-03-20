document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('email');
    const otpInputs = Array.from(document.querySelectorAll('.otp-input'));
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const toastContainer = document.getElementById('toastContainer');
    const stepperItems = Array.from(document.querySelectorAll('.step-item'));
    const stepEmail = document.getElementById('stepEmail');
    const stepOtp = document.getElementById('stepOtp');
    const stepReset = document.getElementById('stepReset');

    const requestOtpBtn = document.getElementById('requestOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const backToEmailBtn = document.getElementById('backToEmailBtn');
    const backToOtpBtn = document.getElementById('backToOtpBtn');

    let otpVerified = false;
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
        stepEmail.classList.toggle('active', stepNumber === 1);
        stepOtp.classList.toggle('active', stepNumber === 2);
        stepReset.classList.toggle('active', stepNumber === 3);
    }

    function getEmail() {
        return (emailInput?.value || '').trim().toLowerCase();
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
                const digitsOnly = (input.value || '').replace(/\D/g, '');
                input.value = digitsOnly ? digitsOnly.slice(-1) : '';
                input.classList.toggle('filled', Boolean(input.value));
                if (input.value && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            });

            input.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    otpInputs[index - 1].focus();
                }
                if (e.key === 'ArrowLeft' && index > 0) {
                    e.preventDefault();
                    otpInputs[index - 1].focus();
                }
                if (e.key === 'ArrowRight' && index < otpInputs.length - 1) {
                    e.preventDefault();
                    otpInputs[index + 1].focus();
                }
            });
        });

        otpInputs[0].addEventListener('paste', function(e) {
            const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            if (!pasted) return;
            e.preventDefault();
            otpInputs.forEach((el, idx) => {
                el.value = pasted[idx] || '';
                el.classList.toggle('filled', Boolean(el.value));
            });
            const targetIndex = Math.min(pasted.length, otpInputs.length) - 1;
            if (targetIndex >= 0) {
                otpInputs[targetIndex].focus();
            }
        });
    }

    function setLoading(button, loading) {
        if (!button) return;
        button.disabled = loading;
        button.style.opacity = loading ? '0.8' : '1';
    }

    function startCooldown(seconds) {
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownLeft = Math.max(0, parseInt(seconds, 10) || 60);
        requestOtpBtn.disabled = true;
        requestOtpBtn.textContent = `Kirim OTP (${cooldownLeft}s)`;

        cooldownTimer = setInterval(() => {
            cooldownLeft -= 1;
            if (cooldownLeft <= 0) {
                clearInterval(cooldownTimer);
                cooldownTimer = null;
                requestOtpBtn.disabled = false;
                requestOtpBtn.textContent = 'Kirim OTP';
                return;
            }
            requestOtpBtn.textContent = `Kirim OTP (${cooldownLeft}s)`;
        }, 1000);
    }

    async function callApi(action, payload) {
        const apiUrl = getApiUrlSafe();
        const body = new URLSearchParams({ action, ...payload }).toString();

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });

        const result = await res.json().catch(() => null);
        if (!res.ok || !result) {
            throw new Error('Gagal terhubung ke server.');
        }
        if (!result.success) {
            throw new Error(result.error || 'Permintaan gagal.');
        }
        return result.data || {};
    }

    requestOtpBtn?.addEventListener('click', async function() {
        otpVerified = false;

        const email = getEmail();
        if (!email) {
            showToast('Email wajib diisi.', 'error');
            emailInput?.focus();
            return;
        }

        setLoading(requestOtpBtn, true);
        try {
            const data = await callApi('requestForgotPasswordOtp', { email });
            showToast(data.message || 'OTP berhasil dikirim.', 'success');
            startCooldown(data.cooldownSeconds || 60);
            clearOtpInputs();
            setStep(2);
            otpInputs[0]?.focus();
        } catch (err) {
            showToast(err.message || 'Gagal mengirim OTP.', 'error');
        } finally {
            setLoading(requestOtpBtn, false);
        }
    });

    verifyOtpBtn?.addEventListener('click', async function() {
        otpVerified = false;

        const email = getEmail();
        const otp = getOtpValue();
        if (!email || !otp) {
            showToast('Email dan OTP wajib diisi.', 'error');
            return;
        }
        if (otp.length !== 6) {
            showToast('OTP harus 6 digit.', 'error');
            return;
        }

        setLoading(verifyOtpBtn, true);
        try {
            await callApi('verifyForgotPasswordOtp', { email, otp });
            otpVerified = true;
            showToast('OTP valid. Silakan reset password.', 'success');
            setStep(3);
            newPasswordInput?.focus();
        } catch (err) {
            const msg = err?.message || 'Verifikasi OTP gagal.';
            if (msg.toLowerCase().includes('otp tidak valid') || msg.toLowerCase().includes('maksimal percobaan')) {
                showToast('OTP salah / tidak valid. Jika kendala berlanjut, silakan hubungi admin.', 'error');
            } else {
                showToast(msg, 'error');
            }
        } finally {
            setLoading(verifyOtpBtn, false);
        }
    });

    resetPasswordBtn?.addEventListener('click', async function() {
        const email = getEmail();
        const otp = getOtpValue();
        const newPassword = (newPasswordInput?.value || '').trim();
        const confirmPassword = (confirmPasswordInput?.value || '').trim();

        if (!otpVerified) {
            showToast('Verifikasi OTP terlebih dahulu.', 'error');
            return;
        }
        if (!email || !otp || !newPassword || !confirmPassword) {
            showToast('Semua field wajib diisi.', 'error');
            return;
        }
        if (newPassword.length < 8) {
            showToast('Password baru minimal 8 karakter.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('Konfirmasi password tidak sama.', 'error');
            return;
        }

        setLoading(resetPasswordBtn, true);
        try {
            await callApi('resetForgotPassword', { email, otp, newPassword, confirmPassword });
            showToast('Password berhasil diubah. Anda akan diarahkan ke login.', 'success');
            setTimeout(() => {
                window.location.href = getAppFullUrl('/login.html');
            }, 1200);
        } catch (err) {
            showToast(err.message || 'Reset password gagal.', 'error');
        } finally {
            setLoading(resetPasswordBtn, false);
        }
    });

    backToEmailBtn?.addEventListener('click', function() {
        setStep(1);
        emailInput?.focus();
    });

    backToOtpBtn?.addEventListener('click', function() {
        setStep(2);
        otpInputs[0]?.focus();
    });

    document.querySelectorAll('.toggle-password').forEach((btn) => {
        btn.addEventListener('click', function() {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.classList.toggle('active', isPassword);
            const eye = btn.querySelector('.eye-icon');
            if (eye) eye.textContent = isPassword ? '🙈' : '👁️';
            btn.title = isPassword ? 'Sembunyikan password' : 'Lihat password';
        });
    });

    setupOtpInputs();
});
