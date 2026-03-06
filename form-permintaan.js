const API_URL = 'api.php';
let currentSection = 1;
let selectedPilihPermintaan = '';
let customOptions = [];
let submittedRequestId = null;
let selectedPetugas = null;

// Load data saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    await loadUnitKerja();
    await loadPilihPermintaanOptions();
    await loadPetugas();
    setupEventListeners();
    
    // Set default visibility bagian 2
    updateBagian2Visibility();
});

async function loadUnitKerja() {
    try {
        const response = await fetch(`${API_URL}?action=getUnitKerja`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Unit Kerja API response:', result);
        
        if (result.success && result.data) {
            // Handle nested data structure (backward compatibility)
            const dataArray = Array.isArray(result.data) ? result.data : (result.data.data || []);
            
            if (Array.isArray(dataArray) && dataArray.length > 0) {
                const select = document.getElementById('unit_kerja');
                dataArray.forEach(unit => {
                    const option = document.createElement('option');
                    option.value = unit.id;
                    option.textContent = unit.nama_unit;
                    select.appendChild(option);
                });
            } else {
                console.error('No valid data array found:', typeof result.data, result.data);
            }
        } else {
            console.error('API returned error or no data:', result);
        }
    } catch (error) {
        console.error('Error loading unit kerja:', error);
    }
}

async function loadPilihPermintaanOptions() {
    try {
        const response = await fetch(`${API_URL}?action=getPilihPermintaanOptions`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Pilih Permintaan Options API response:', result);
        
        if (result.success && result.data) {
            // Handle nested data structure (backward compatibility)
            const dataArray = Array.isArray(result.data) ? result.data : (result.data.data || []);
            
            if (Array.isArray(dataArray)) {
                customOptions = dataArray;
                renderPilihPermintaanOptions();
            } else {
                console.error('No valid data array found:', typeof result.data, result.data);
                customOptions = [];
            }
        } else {
            console.error('API returned error or no data:', result);
            customOptions = [];
        }
    } catch (error) {
        console.error('Error loading pilih permintaan options:', error);
        customOptions = [];
    }
}

function renderPilihPermintaanOptions() {
    const container = document.getElementById('pilihPermintaanContainer');
    container.innerHTML = '';
    
    if (!Array.isArray(customOptions)) {
        console.error('customOptions is not an array:', customOptions);
        return;
    }
    
    customOptions.forEach(option => {
        const label = document.createElement('label');
        label.className = 'radio-option';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'pilih_permintaan';
        radio.value = option.nama_opsi;
        radio.required = true;
        radio.onchange = () => {
            selectedPilihPermintaan = option.nama_opsi;
            // Update visibility bagian 2 berdasarkan pilihan
            updateBagian2Visibility();
        };
        
        const span = document.createElement('span');
        span.textContent = option.nama_opsi;
        
        label.appendChild(radio);
        label.appendChild(span);
        container.appendChild(label);
    });
}

async function updatePilihPermintaanOption(id, data) {
    try {
        const formData = new FormData();
        formData.append('action', 'updatePilihPermintaanOption');
        formData.append('id', id);
        Object.entries(data).forEach(([key, value]) => {
            formData.append(key, value);
        });
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            await loadPilihPermintaanOptions();
        }
    } catch (error) {
        console.error('Error updating option:', error);
    }
}

async function deletePilihPermintaanOption(id) {
    try {
        const formData = new FormData();
        formData.append('action', 'deletePilihPermintaanOption');
        formData.append('id', id);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            await loadPilihPermintaanOptions();
        }
    } catch (error) {
        console.error('Error deleting option:', error);
    }
}

async function loadPetugas() {
    try {
        const response = await fetch(`${API_URL}?action=getPetugas`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Petugas API response:', result);
        
        if (result.success && result.data) {
            // Handle nested data structure (backward compatibility)
            const dataArray = Array.isArray(result.data) ? result.data : (result.data.data || []);
            
            if (Array.isArray(dataArray) && dataArray.length > 0) {
                const select = document.getElementById('petugas');
                dataArray.forEach(petugas => {
                    const option = document.createElement('option');
                    option.value = petugas.id;
                    option.textContent = petugas.nama;
                    option.setAttribute('data-wa', petugas.no_wa);
                    select.appendChild(option);
                });
            } else {
                console.error('No valid data array found:', typeof result.data, result.data);
            }
        } else {
            console.error('API returned error or no data:', result);
        }
    } catch (error) {
        console.error('Error loading petugas:', error);
    }
}

function setupEventListeners() {
    // Form submit
    document.getElementById('permintaanForm').onsubmit = handleSubmit;
    
    // WhatsApp button
    document.getElementById('whatsappBtn').onclick = openWhatsApp;
}

async function addPilihPermintaanOption(nama) {
    try {
        const formData = new FormData();
        formData.append('action', 'addPilihPermintaanOption');
        formData.append('nama_opsi', nama);
        formData.append('bagian_target', 'bagian_2');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            await loadPilihPermintaanOptions();
        }
    } catch (error) {
        console.error('Error adding option:', error);
    }
}

function nextSection() {
    // Validasi bagian saat ini
    if (currentSection === 1) {
        // Validasi field input (bukan radio)
        const npk = document.getElementById('npk');
        const namaLengkap = document.getElementById('nama_lengkap');
        const unitKerja = document.getElementById('unit_kerja');
        const noTelepon = document.getElementById('no_telepon');
        const pilihPermintaan = document.querySelector('input[name="pilih_permintaan"]:checked');
        
        // Reset border color
        if (npk) npk.style.borderColor = '#ddd';
        if (namaLengkap) namaLengkap.style.borderColor = '#ddd';
        if (unitKerja) unitKerja.style.borderColor = '#ddd';
        if (noTelepon) noTelepon.style.borderColor = '#ddd';
        
        let isValid = true;
        let errorMessage = '';
        
        // Validasi NPK
        if (!npk || !npk.value || !npk.value.trim()) {
            isValid = false;
            if (npk) npk.style.borderColor = '#d32f2f';
            if (!errorMessage) errorMessage = 'NPK wajib diisi!';
        }
        
        // Validasi Nama Lengkap
        if (!namaLengkap || !namaLengkap.value || !namaLengkap.value.trim()) {
            isValid = false;
            if (namaLengkap) namaLengkap.style.borderColor = '#d32f2f';
            if (!errorMessage) errorMessage = 'Nama Lengkap wajib diisi!';
        }
        
        // Validasi Unit Kerja
        if (!unitKerja || !unitKerja.value || unitKerja.value === '' || unitKerja.value === '0') {
            isValid = false;
            if (unitKerja) unitKerja.style.borderColor = '#d32f2f';
            if (!errorMessage) errorMessage = 'Unit Kerja wajib dipilih!';
        }
        
        // Validasi No Telepon
        if (!noTelepon || !noTelepon.value || !noTelepon.value.trim()) {
            isValid = false;
            if (noTelepon) noTelepon.style.borderColor = '#d32f2f';
            if (!errorMessage) errorMessage = 'No Telepon wajib diisi!';
        }
        
        // Validasi Pilih Permintaan
        if (!pilihPermintaan) {
            isValid = false;
            if (!errorMessage) errorMessage = 'Pilih Permintaan wajib dipilih!';
            // Highlight semua radio option
            document.querySelectorAll('input[name="pilih_permintaan"]').forEach(radio => {
                const label = radio.closest('label');
                if (label) label.style.borderColor = '#d32f2f';
            });
        } else {
            // Reset border color untuk radio options
            document.querySelectorAll('input[name="pilih_permintaan"]').forEach(radio => {
                const label = radio.closest('label');
                if (label) label.style.borderColor = '#ddd';
            });
        }
        
        // Debug log
        console.log('Validation check:', {
            npk: npk?.value,
            namaLengkap: namaLengkap?.value,
            unitKerja: unitKerja?.value,
            noTelepon: noTelepon?.value,
            pilihPermintaan: pilihPermintaan?.value,
            isValid
        });
        
        if (!isValid) {
            // Scroll ke field pertama yang error
            const firstErrorField = bagian1.querySelector('[style*="border-color: rgb(211, 47, 47)"]') || 
                                   bagian1.querySelector('input[style*="border-color: #d32f2f"]') ||
                                   bagian1.querySelector('select[style*="border-color: #d32f2f"]');
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
            return;
        }
        
        selectedPilihPermintaan = pilihPermintaan.value;
        
        console.log('Selected pilih permintaan:', selectedPilihPermintaan);
        console.log('customOptions:', customOptions);
        
        const selectedOption = customOptions.find(opt => opt.nama_opsi === selectedPilihPermintaan);
        
        if (!selectedOption) {
            console.error('Opsi tidak ditemukan untuk:', selectedPilihPermintaan);
            return;
        }
        
        console.log('Selected option:', selectedOption);
        console.log('bagian_target:', selectedOption.bagian_target);
        
        // Navigasi berdasarkan bagian_target
        if (selectedOption.bagian_target === 'bagian_3') {
            // Skip bagian 2, langsung ke bagian 3
            console.log('Navigating to bagian 3 (skipping bagian 2)');
            currentSection = 3;
            showSection(3);
        } else if (selectedOption.bagian_target === 'bagian_2') {
            // Lanjut ke bagian 2
            console.log('Navigating to bagian 2');
            currentSection = 2;
            showSection(2);
        } else {
            // Default: ke bagian 2
            console.log('Default: Navigating to bagian 2');
            currentSection = 2;
            showSection(2);
        }
    }
    
    if (currentSection === 2) {
        // Validasi form bagian 2
        const statusSurat = document.querySelector('input[name="status_surat"]:checked');
        const jenisSurat = document.querySelector('input[name="jenis_surat"]:checked');
        const alasanPermintaan = document.getElementById('alasan_permintaan');
        
        let isValid = true;
        
        if (!statusSurat) {
            isValid = false;
            document.querySelectorAll('input[name="status_surat"]').forEach(r => {
                r.closest('.radio-option').style.borderColor = '#d32f2f';
            });
        } else {
            document.querySelectorAll('input[name="status_surat"]').forEach(r => {
                r.closest('.radio-option').style.borderColor = '#ddd';
            });
        }
        
        if (!jenisSurat) {
            isValid = false;
            document.querySelectorAll('input[name="jenis_surat"]').forEach(r => {
                r.closest('.radio-option').style.borderColor = '#d32f2f';
            });
        } else {
            document.querySelectorAll('input[name="jenis_surat"]').forEach(r => {
                r.closest('.radio-option').style.borderColor = '#ddd';
            });
        }
        
        if (!alasanPermintaan.value.trim()) {
            isValid = false;
            alasanPermintaan.style.borderColor = '#d32f2f';
        } else {
            alasanPermintaan.style.borderColor = '#ddd';
        }
        
        if (!isValid) {
            // Scroll ke field pertama yang error
            const bagian2 = document.getElementById('bagian2');
            const firstErrorField = bagian2.querySelector('[style*="border-color: rgb(211, 47, 47)"]') || 
                                   bagian2.querySelector('input[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('textarea[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('.radio-option[style*="border-color: #d32f2f"]');
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstErrorField.tagName === 'INPUT' || firstErrorField.tagName === 'TEXTAREA') {
                    firstErrorField.focus();
                }
            }
            return;
        }
        
        // Lanjut ke bagian 3
        currentSection = 3;
        showSection(3);
    }
}

function prevSection() {
    if (currentSection === 3) {
        // Kembali dari bagian 3
        const selectedOption = customOptions.find(opt => opt.nama_opsi === selectedPilihPermintaan);
        
        if (selectedOption && selectedOption.bagian_target === 'bagian_3') {
            // Jika bagian 2 dilewati, langsung ke bagian 1
            currentSection = 1;
        } else {
            // Kembali ke bagian 2
            currentSection = 2;
        }
        showSection(currentSection);
    } else if (currentSection === 2) {
        // Kembali ke bagian 1
        currentSection = 1;
        showSection(currentSection);
    }
}

function updateBagian2Visibility() {
    const selectedOption = customOptions.find(opt => opt.nama_opsi === selectedPilihPermintaan);
    const bagian2 = document.getElementById('bagian2');
    
    if (!bagian2) return;
    
    if (selectedOption && selectedOption.bagian_target === 'bagian_3') {
        // Sembunyikan bagian 2 jika tidak diperlukan
        bagian2.style.display = 'none';
    } else {
        // Tampilkan bagian 2 jika diperlukan
        bagian2.style.display = 'block';
    }
}

function showSection(section) {
    // Sembunyikan semua section terlebih dahulu
    document.querySelectorAll('.form-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    
    // Update visibility bagian 2 berdasarkan pilihan
    updateBagian2Visibility();
    
    // Tampilkan section yang dipilih
    const targetSection = document.getElementById(`bagian${section}`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    // Validasi bagian 3
    const bagian3 = document.getElementById('bagian3');
    const requiredFields = bagian3.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (field.type === 'radio') {
            const radioGroup = document.querySelectorAll(`input[name="${field.name}"]`);
            const isChecked = Array.from(radioGroup).some(r => r.checked);
            if (!isChecked) {
                isValid = false;
            }
        } else if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#d32f2f';
        } else {
            field.style.borderColor = '#ddd';
        }
    });
    
    // Validasi bagian 2 jika diperlukan (berdasarkan pilihan)
    const selectedOption = customOptions.find(opt => opt.nama_opsi === selectedPilihPermintaan);
    if (selectedOption && selectedOption.bagian_target === 'bagian_2') {
        const bagian2 = document.getElementById('bagian2');
        const statusSurat = document.querySelector('input[name="status_surat"]:checked');
        const jenisSurat = document.querySelector('input[name="jenis_surat"]:checked');
        const alasanPermintaan = document.getElementById('alasan_permintaan');
        
        if (!statusSurat || !jenisSurat || !alasanPermintaan.value.trim()) {
            isValid = false;
            if (!statusSurat) {
                document.querySelectorAll('input[name="status_surat"]').forEach(r => {
                    r.closest('.radio-option').style.borderColor = '#d32f2f';
                });
            }
            if (!jenisSurat) {
                document.querySelectorAll('input[name="jenis_surat"]').forEach(r => {
                    r.closest('.radio-option').style.borderColor = '#d32f2f';
                });
            }
            if (!alasanPermintaan.value.trim()) {
                alasanPermintaan.style.borderColor = '#d32f2f';
            }
        }
    }
    
        if (!isValid) {
            // Scroll ke field pertama yang error
            const bagian2 = document.getElementById('bagian2');
            const firstErrorField = bagian2.querySelector('[style*="border-color: rgb(211, 47, 47)"]') || 
                                   bagian2.querySelector('input[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('textarea[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('.radio-option[style*="border-color: #d32f2f"]');
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstErrorField.tagName === 'INPUT' || firstErrorField.tagName === 'TEXTAREA') {
                    firstErrorField.focus();
                }
            }
            return;
        }
    
    // Collect form data
    const formData = new FormData(e.target);
    
    const data = {
        npk: formData.get('npk'),
        nama_lengkap: formData.get('nama_lengkap'),
        unit_kerja_id: formData.get('unit_kerja'),
        no_telepon: formData.get('no_telepon'),
        pilih_permintaan: formData.get('pilih_permintaan'),
        data_surat: formData.get('data_surat') || '',
        status_surat: selectedOption && selectedOption.bagian_target === 'bagian_2' ? formData.get('status_surat') : '',
        jenis_surat: selectedOption && selectedOption.bagian_target === 'bagian_2' ? formData.get('jenis_surat') : '',
        no_surat: selectedOption && selectedOption.bagian_target === 'bagian_2' ? (formData.get('no_surat') || '') : '',
        alasan_permintaan: selectedOption && selectedOption.bagian_target === 'bagian_2' ? formData.get('alasan_permintaan') : '',
        keterangan_permintaan: formData.get('keterangan_permintaan') || '',
        isi_penjelasan: formData.get('isi_penjelasan'),
        petugas_id: formData.get('petugas')
    };
    
    // Get petugas info
    const petugasSelect = document.getElementById('petugas');
    const selectedPetugasOption = petugasSelect.options[petugasSelect.selectedIndex];
    if (!selectedPetugasOption || !selectedPetugasOption.value) {
        petugasSelect.style.borderColor = '#d32f2f';
        petugasSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        petugasSelect.focus();
        return;
    }
    selectedPetugas = {
        id: selectedPetugasOption.value,
        nama: selectedPetugasOption.textContent,
        no_wa: selectedPetugasOption.getAttribute('data-wa')
    };
    
    try {
        const submitData = new FormData();
        submitData.append('action', 'submitPermintaan');
        Object.entries(data).forEach(([key, value]) => {
            submitData.append(key, value);
        });
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: submitData
        });
        
        const result = await response.json();
        
        console.log('Submit response:', result);
        
        if (result.success) {
            // Handle nested data structure (backward compatibility)
            const responseData = result.data?.data || result.data || {};
            submittedRequestId = responseData.rowNumber || responseData.id || null;
            console.log('Submitted request ID:', submittedRequestId);
            console.log('Full response data:', responseData);
            if (submittedRequestId) {
                showSuccessModal();
            } else {
                console.error('No request ID in response:', result);
            }
        } else {
            alert('Error: ' + (result.error || 'Gagal mengirim permintaan'));
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Error: ' + error.message);
    }
}

function showSuccessModal() {
    const modal = document.getElementById('successModal');
    const requestNumber = document.getElementById('requestNumber');
    
    if (submittedRequestId) {
        requestNumber.textContent = `#${submittedRequestId}`;
    } else {
        requestNumber.textContent = '#-';
        console.error('submittedRequestId is undefined or null');
    }
    
    modal.classList.add('show');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('show');
    // Reset form
    document.getElementById('permintaanForm').reset();
    currentSection = 1;
    showSection(1);
    selectedPilihPermintaan = '';
    submittedRequestId = null;
    selectedPetugas = null;
}

function openWhatsApp() {
    if (!selectedPetugas || !submittedRequestId) {
        alert('Data petugas atau nomor permintaan tidak ditemukan');
        return;
    }
    
    const baseUrl = window.location.origin;
    const detailUrl = `${baseUrl}/permintaan/permintaan.html?detail=${submittedRequestId}`;
    
    const message = encodeURIComponent(
        `Halo ${selectedPetugas.nama},\n\n` +
        `Saya telah mengajukan permintaan DOF dengan nomor: #${submittedRequestId}\n\n` +
        `Silakan review permintaan saya melalui link berikut:\n${detailUrl}\n\n` +
        `Terima kasih.`
    );
    
    const waUrl = `https://wa.me/${selectedPetugas.no_wa}?text=${message}`;
    window.open(waUrl, '_blank');
}
