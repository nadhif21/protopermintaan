const API_URL = 'api.php';

document.addEventListener('DOMContentLoaded', function() {
    // Jika sudah login, redirect ke halaman utama
    if (typeof isAuthenticated === 'function' && isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    // Load unit kerja options
    loadUnitKerja();

    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitBtn');

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset messages
        errorMessage.classList.remove('show');
        successMessage.classList.remove('show');
        errorMessage.textContent = '';
        successMessage.textContent = '';

        // Get form values
        const nama = document.getElementById('nama').value.trim();
        const npk = document.getElementById('npk').value.trim();
        const nomor_telepon = document.getElementById('nomor_telepon').value.trim();
        const email = document.getElementById('email').value.trim();
        const unitKerjaSelect = document.getElementById('unit_kerja');
        const unitKerjaId = unitKerjaSelect.value;
        const unitKerjaText = unitKerjaSelect.options[unitKerjaSelect.selectedIndex]?.text || '';

        // Validation
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

        // Validate phone number format (should start with 08 and be 10-13 digits)
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

        // Basic email validation
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

        // Submit form
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
                unit_kerja: unitKerjaText
            });

            const response = await fetch(API_URL, {
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

            // Success
            showSuccess('Pendaftaran berhasil! Permintaan Anda sedang menunggu persetujuan admin. Anda akan menerima notifikasi via WhatsApp setelah disetujui.');
            
            // Reset form
            registerForm.reset();
            
            // Optional: redirect after 3 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
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
        const response = await fetch(`${API_URL}?action=getUnitKerja`);
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
        // Show error to user
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Gagal memuat daftar unit kerja. Silakan refresh halaman.';
            errorMessage.classList.add('show');
        }
    }
}
