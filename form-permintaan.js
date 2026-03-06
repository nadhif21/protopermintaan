const API_URL = 'api.php';
let currentSection = 1;
let selectedPilihPermintaan = '';
let customOptions = [];
let submittedRequestId = null;
let selectedPetugas = null;

// Load data saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Wait for DOM to be fully ready
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Load user data first and wait for it to complete
    try {
        await loadUserData();
    } catch (error) {
        console.error('Failed to load user data:', error);
        // Don't retry if there's an error, just continue
    }
    
    // Wait a bit to ensure fields are filled
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Load unit kerja (this will auto-select user's unit kerja)
    await loadUnitKerja();
    
    // Wait and retry unit kerja selection if needed
    await new Promise(resolve => setTimeout(resolve, 200));
    const unitKerjaSelect = document.getElementById('unit_kerja');
    if (unitKerjaSelect && window.currentUserUnitKerja && !unitKerjaSelect.value) {
        console.log('Retrying unit kerja selection...');
        // Try to match again
        for (let i = 0; i < unitKerjaSelect.options.length; i++) {
            const opt = unitKerjaSelect.options[i];
            const optText = opt.text.toLowerCase().trim();
            const userUnitKerjaLower = (window.currentUserUnitKerja || '').toLowerCase().trim();
            if (optText === userUnitKerjaLower || opt.value === window.currentUserUnitKerja) {
                unitKerjaSelect.value = opt.value;
                // Make it disabled
                const existingHidden = document.getElementById('unit_kerja_hidden');
                if (existingHidden) existingHidden.remove();
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = 'unit_kerja';
                hiddenInput.id = 'unit_kerja_hidden';
                hiddenInput.value = opt.value;
                unitKerjaSelect.parentNode.insertBefore(hiddenInput, unitKerjaSelect.nextSibling);
                unitKerjaSelect.disabled = true;
                unitKerjaSelect.style.backgroundColor = '#e9ecef';
                unitKerjaSelect.style.cursor = 'not-allowed';
                unitKerjaSelect.style.color = '#6c757d';
                unitKerjaSelect.removeAttribute('name');
                console.log('Unit kerja matched on retry:', opt.value);
                break;
            }
        }
    }
    
    await loadPilihPermintaanOptions();
    await loadPetugas();
    setupEventListeners();
    
    // Set default visibility bagian 2
    updateBagian2Visibility();
    
    console.log('Form initialization complete');
    console.log('Final field values:', {
        npk: document.getElementById('npk')?.value,
        nama: document.getElementById('nama_lengkap')?.value,
        noTelepon: document.getElementById('no_telepon')?.value,
        unitKerja: document.getElementById('unit_kerja')?.value
    });
});

async function loadUserData() {
    try {
        const token = getAuthToken();
        if (!token) {
            console.warn('No auth token found');
            return;
        }
        
        console.log('Loading user data from API...');
        
        // Force fresh data - add timestamp to prevent cache
        const apiUrl = `${API_URL}?action=me&_t=${Date.now()}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'X-Auth-Token': token,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let result;
        try {
            const responseText = await response.text();
            console.log('Raw API response:', responseText);
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON:', parseError);
            throw new Error('Invalid JSON response from API');
        }
        
        console.log('User data result from API:', result);
        
        // Handle both formats: result.user or result.data.user
        let user = null;
        if (result.success) {
            if (result.user) {
                user = result.user;
            } else if (result.data && result.data.user) {
                user = result.data.user;
            }
        }
        
        if (user) {
            console.log('User data from API (full):', user);
            console.log('User data details:', {
                npk: user.npk,
                name: user.name,
                nomorTelepon: user.nomorTelepon,
                unitKerja: user.unitKerja,
                email: user.email
            });
            
            // Pastikan data tidak kosong
            if (!user.nomorTelepon && !user.unitKerja) {
                console.warn('⚠️ API mengembalikan data kosong untuk nomorTelepon dan unitKerja');
            }
            
            // SELALU gunakan data dari API, jangan fallback ke session
            fillUserFields(user);
            
            // Update session dengan data terbaru
            const session = getSession();
            if (session) {
                session.user = user;
                localStorage.setItem('session', JSON.stringify(session));
                console.log('Session updated with fresh data');
            }
        } else {
            console.error('API response not successful or no user data:', result);
            throw new Error('API tidak mengembalikan data user. Response: ' + JSON.stringify(result));
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        // Jangan tampilkan alert yang mengganggu, cukup log error
        console.warn('⚠️ Gagal memuat data user. Silakan logout dan login kembali jika field tidak terisi.');
        // Jangan throw error lagi, biarkan form tetap bisa digunakan
    }
}

function fillUserFields(user) {
    try {
            
        // Store user data globally for form submission
        window.currentUserData = {
            npk: user.npk || user.username || '',
            name: user.name || '',
            nomorTelepon: user.nomorTelepon || user.nomor_telepon || '',
            unitKerja: user.unitKerja || user.unit_kerja || ''
        };
        
        console.log('Filling fields with user data:', window.currentUserData);
        
        // Auto-fill NPK
        const npkInput = document.getElementById('npk');
        if (npkInput) {
            const npkValue = user.npk || user.username || '';
            // Always set value
            npkInput.value = npkValue;
            if (npkValue) {
                console.log('NPK filled:', npkValue);
            } else {
                console.warn('NPK is empty, but field will be readonly');
            }
            // Make it readonly (not disabled, so value is still submitted)
            npkInput.setAttribute('readonly', 'readonly');
            npkInput.style.backgroundColor = '#e9ecef';
            npkInput.style.cursor = 'not-allowed';
            npkInput.style.color = '#6c757d';
            // Prevent editing via JavaScript
            const savedNpkValue = npkValue;
            npkInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Tab' && e.key !== 'Enter') {
                    e.preventDefault();
                }
            });
            npkInput.addEventListener('paste', (e) => e.preventDefault());
            npkInput.addEventListener('input', (e) => {
                e.target.value = savedNpkValue;
            });
            npkInput.addEventListener('change', (e) => {
                e.target.value = savedNpkValue;
            });
            npkInput.addEventListener('focus', (e) => {
                e.target.blur();
            });
        } else {
            console.error('NPK input element not found!');
        }
        
        // Auto-fill Nama Lengkap
        const namaInput = document.getElementById('nama_lengkap');
        if (namaInput) {
            const namaValue = user.name || user.nama || '';
            // Always set value
            namaInput.value = namaValue;
            if (namaValue) {
                console.log('Nama filled:', namaValue);
            } else {
                console.warn('Nama is empty, but field will be readonly');
            }
            // Make it readonly (not disabled, so value is still submitted)
            namaInput.setAttribute('readonly', 'readonly');
            namaInput.style.backgroundColor = '#e9ecef';
            namaInput.style.cursor = 'not-allowed';
            namaInput.style.color = '#6c757d';
            // Prevent editing via JavaScript
            const savedNamaValue = namaValue;
            namaInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Tab' && e.key !== 'Enter') {
                    e.preventDefault();
                }
            });
            namaInput.addEventListener('paste', (e) => e.preventDefault());
            namaInput.addEventListener('input', (e) => {
                e.target.value = savedNamaValue;
            });
            namaInput.addEventListener('change', (e) => {
                e.target.value = savedNamaValue;
            });
            namaInput.addEventListener('focus', (e) => {
                e.target.blur();
            });
        } else {
            console.error('Nama input element not found!');
        }
        
        // Auto-fill No Telepon
        const noTeleponInput = document.getElementById('no_telepon');
        if (noTeleponInput) {
            // Try multiple property names
            const noTeleponValue = user.nomorTelepon || user.nomor_telepon || user.phone || user.telepon || '';
            console.log('No Telepon value from user:', noTeleponValue);
            console.log('Checking all possible properties:', {
                nomorTelepon: user.nomorTelepon,
                nomor_telepon: user.nomor_telepon,
                phone: user.phone,
                telepon: user.telepon,
                allKeys: Object.keys(user)
            });
            
            // Always set value, even if empty
            noTeleponInput.value = noTeleponValue;
            if (noTeleponValue) {
                console.log('No Telepon filled:', noTeleponValue);
            } else {
                console.warn('No Telepon is empty in user data, but field will be readonly');
            }
            
            // Make it readonly (not disabled, so value is still submitted) - ALWAYS
            noTeleponInput.setAttribute('readonly', 'readonly');
            noTeleponInput.style.backgroundColor = '#e9ecef';
            noTeleponInput.style.cursor = 'not-allowed';
            noTeleponInput.style.color = '#6c757d';
            
            // Prevent editing via JavaScript - use saved value
            const savedNoTeleponValue = noTeleponValue;
            // Remove existing listeners to avoid duplicates
            const newInput = noTeleponInput.cloneNode(true);
            noTeleponInput.parentNode.replaceChild(newInput, noTeleponInput);
            const freshInput = document.getElementById('no_telepon');
            
            freshInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Tab' && e.key !== 'Enter') {
                    e.preventDefault();
                }
            });
            freshInput.addEventListener('paste', (e) => e.preventDefault());
            freshInput.addEventListener('input', (e) => {
                e.target.value = savedNoTeleponValue;
            });
            freshInput.addEventListener('change', (e) => {
                e.target.value = savedNoTeleponValue;
            });
            freshInput.addEventListener('focus', (e) => {
                e.target.blur();
            });
            console.log('No Telepon field set to readonly with value:', savedNoTeleponValue || '(empty)');
        } else {
            console.error('No Telepon input element not found!');
        }
        
        // Store unit kerja for later matching
        window.currentUserUnitKerja = user.unitKerja || user.unit_kerja || '';
        console.log('User unit kerja stored:', window.currentUserUnitKerja, 'Full user object:', user);
    } catch (error) {
        console.error('Error in fillUserFields:', error);
    }
}

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
                let userUnitKerjaFound = false;
                
                dataArray.forEach(unit => {
                    const option = document.createElement('option');
                    option.value = unit.id;
                    option.textContent = unit.nama_unit;
                    select.appendChild(option);
                    
                    // Check if this matches user's unit kerja
                    if (window.currentUserUnitKerja && 
                        (unit.nama_unit === window.currentUserUnitKerja || 
                         unit.id.toString() === window.currentUserUnitKerja)) {
                        select.value = unit.id;
                        userUnitKerjaFound = true;
                    }
                });
                
                // If user's unit kerja found, make it disabled but add hidden input for form submission
                if (userUnitKerjaFound) {
                    // Add hidden input to preserve value for form submission (disabled fields don't submit)
                    const existingHidden = document.getElementById('unit_kerja_hidden');
                    if (existingHidden) {
                        existingHidden.remove();
                    }
                    const hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.name = 'unit_kerja';
                    hiddenInput.id = 'unit_kerja_hidden';
                    hiddenInput.value = select.value;
                    select.parentNode.insertBefore(hiddenInput, select.nextSibling);
                    
                    // Disable the select
                    select.disabled = true;
                    select.style.backgroundColor = '#e9ecef';
                    select.style.cursor = 'not-allowed';
                    select.style.color = '#6c757d';
                    // Remove name attribute so it doesn't submit (we use hidden input instead)
                    select.removeAttribute('name');
                    console.log('Unit kerja auto-selected and disabled:', select.value, 'Text:', select.options[select.selectedIndex]?.text);
                } else if (window.currentUserUnitKerja) {
                    console.warn('User unit kerja not found in options:', window.currentUserUnitKerja);
                    console.log('Available options:', Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text })));
                    // Try flexible matching (case-insensitive, partial match)
                    const userUnitKerjaLower = (window.currentUserUnitKerja || '').toLowerCase().trim();
                    let foundFlexible = false;
                    let matchedOption = null;
                    
                    for (let i = 0; i < select.options.length; i++) {
                        const opt = select.options[i];
                        const optText = opt.text.toLowerCase().trim();
                        // Try exact match, partial match, or contains
                        if (optText === userUnitKerjaLower || 
                            optText.includes(userUnitKerjaLower) || 
                            userUnitKerjaLower.includes(optText)) {
                            matchedOption = opt;
                            foundFlexible = true;
                            break;
                        }
                    }
                    
                    if (foundFlexible && matchedOption) {
                        select.value = matchedOption.value;
                        // Add hidden input
                        const existingHidden = document.getElementById('unit_kerja_hidden');
                        if (existingHidden) {
                            existingHidden.remove();
                        }
                        const hiddenInput = document.createElement('input');
                        hiddenInput.type = 'hidden';
                        hiddenInput.name = 'unit_kerja';
                        hiddenInput.id = 'unit_kerja_hidden';
                        hiddenInput.value = select.value;
                        select.parentNode.insertBefore(hiddenInput, select.nextSibling);
                        
                        // Disable the select
                        select.disabled = true;
                        select.style.backgroundColor = '#e9ecef';
                        select.style.cursor = 'not-allowed';
                        select.style.color = '#6c757d';
                        select.removeAttribute('name');
                        console.log('Unit kerja found with flexible matching:', select.value, 'Text:', matchedOption.text);
                    } else {
                        console.warn('Unit kerja not found even with flexible matching. User unit kerja:', window.currentUserUnitKerja);
                    }
                } else {
                    console.warn('No unit kerja data for user. User data:', window.currentUserData);
                }
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
    const select = document.getElementById('pilih_permintaan');
    if (!select) {
        console.error('Select element pilih_permintaan not found');
        return;
    }
    
    if (!Array.isArray(customOptions)) {
        console.error('customOptions is not an array:', customOptions);
        return;
    }
    
    // Clear existing options except the first one (placeholder)
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add options
    customOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.nama_opsi;
        optionElement.textContent = option.nama_opsi;
        select.appendChild(optionElement);
    });
    
    // Remove existing event listeners by cloning the select
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    
    // Add change event listener to the new select
    const finalSelect = document.getElementById('pilih_permintaan');
    finalSelect.addEventListener('change', () => {
        selectedPilihPermintaan = finalSelect.value;
        // Update visibility bagian 2 berdasarkan pilihan
        updateBagian2Visibility();
    });
    
    console.log('Pilih Permintaan options rendered:', customOptions.length);
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
        const pilihPermintaan = document.getElementById('pilih_permintaan');
        
        // Reset border color
        if (npk) npk.style.borderColor = '#ddd';
        if (namaLengkap) namaLengkap.style.borderColor = '#ddd';
        if (unitKerja) unitKerja.style.borderColor = '#ddd';
        if (noTelepon) noTelepon.style.borderColor = '#ddd';
        if (pilihPermintaan) pilihPermintaan.style.borderColor = '#ddd';
        
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
        if (!pilihPermintaan || !pilihPermintaan.value || pilihPermintaan.value === '') {
            isValid = false;
            if (pilihPermintaan) pilihPermintaan.style.borderColor = '#d32f2f';
            if (!errorMessage) errorMessage = 'Pilih Permintaan wajib dipilih!';
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
        const statusSurat = document.getElementById('status_surat');
        const jenisSurat = document.getElementById('jenis_surat');
        const alasanPermintaan = document.getElementById('alasan_permintaan');
        
        // Reset border color
        if (statusSurat) statusSurat.style.borderColor = '#ddd';
        if (jenisSurat) jenisSurat.style.borderColor = '#ddd';
        if (alasanPermintaan) alasanPermintaan.style.borderColor = '#ddd';
        
        let isValid = true;
        
        if (!statusSurat || !statusSurat.value || statusSurat.value === '') {
            isValid = false;
            if (statusSurat) statusSurat.style.borderColor = '#d32f2f';
        }
        
        if (!jenisSurat || !jenisSurat.value || jenisSurat.value === '') {
            isValid = false;
            if (jenisSurat) jenisSurat.style.borderColor = '#d32f2f';
        }
        
        if (!alasanPermintaan || !alasanPermintaan.value.trim()) {
            isValid = false;
            if (alasanPermintaan) alasanPermintaan.style.borderColor = '#d32f2f';
        }
        
        if (!isValid) {
            // Scroll ke field pertama yang error
            const bagian2 = document.getElementById('bagian2');
            const firstErrorField = bagian2.querySelector('[style*="border-color: rgb(211, 47, 47)"]') || 
                                   bagian2.querySelector('input[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('select[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('textarea[style*="border-color: #d32f2f"]');
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstErrorField.tagName === 'INPUT' || firstErrorField.tagName === 'SELECT' || firstErrorField.tagName === 'TEXTAREA') {
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
        const statusSurat = document.getElementById('status_surat');
        const jenisSurat = document.getElementById('jenis_surat');
        const alasanPermintaan = document.getElementById('alasan_permintaan');
        
        // Reset border color
        if (statusSurat) statusSurat.style.borderColor = '#ddd';
        if (jenisSurat) jenisSurat.style.borderColor = '#ddd';
        if (alasanPermintaan) alasanPermintaan.style.borderColor = '#ddd';
        
        if (!statusSurat || !statusSurat.value || statusSurat.value === '' ||
            !jenisSurat || !jenisSurat.value || jenisSurat.value === '' ||
            !alasanPermintaan || !alasanPermintaan.value.trim()) {
            isValid = false;
            if (!statusSurat || !statusSurat.value || statusSurat.value === '') {
                if (statusSurat) statusSurat.style.borderColor = '#d32f2f';
            }
            if (!jenisSurat || !jenisSurat.value || jenisSurat.value === '') {
                if (jenisSurat) jenisSurat.style.borderColor = '#d32f2f';
            }
            if (!alasanPermintaan || !alasanPermintaan.value.trim()) {
                if (alasanPermintaan) alasanPermintaan.style.borderColor = '#d32f2f';
            }
        }
    }
    
        if (!isValid) {
            // Scroll ke field pertama yang error
            const bagian2 = document.getElementById('bagian2');
            const firstErrorField = bagian2.querySelector('[style*="border-color: rgb(211, 47, 47)"]') || 
                                   bagian2.querySelector('input[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('select[style*="border-color: #d32f2f"]') ||
                                   bagian2.querySelector('textarea[style*="border-color: #d32f2f"]');
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstErrorField.tagName === 'INPUT' || firstErrorField.tagName === 'SELECT' || firstErrorField.tagName === 'TEXTAREA') {
                    firstErrorField.focus();
                }
            }
            return;
        }
    
    // Collect form data
    const formData = new FormData(e.target);
    
    // Get unit_kerja from hidden input if select is disabled, otherwise from select
    const unitKerjaSelect = document.getElementById('unit_kerja');
    const unitKerjaHidden = document.getElementById('unit_kerja_hidden');
    const unitKerjaValue = unitKerjaHidden ? unitKerjaHidden.value : (unitKerjaSelect ? unitKerjaSelect.value : formData.get('unit_kerja'));
    
    // Ensure readonly fields are included (they should be, but just in case)
    const npkValue = document.getElementById('npk')?.value || formData.get('npk') || '';
    const namaValue = document.getElementById('nama_lengkap')?.value || formData.get('nama_lengkap') || '';
    const noTeleponValue = document.getElementById('no_telepon')?.value || formData.get('no_telepon') || '';
    
    const data = {
        npk: npkValue,
        nama_lengkap: namaValue,
        unit_kerja_id: unitKerjaValue,
        no_telepon: noTeleponValue,
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
