// Fungsi untuk mendapatkan API URL yang benar berdasarkan path saat ini
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
let currentSection = 1;
let selectedPilihPermintaan = '';
let customOptions = [];
let submittedRequestId = null;
let selectedPetugas = null;

// Opsi yang hanya perlu Bagian 2 + Petugas (Revisi, Pembatalan, Perubahan Plt)
const SKIP_BAGIAN3_OPTIONS = ['Revisi', 'Pembatalan', 'Perubahan Plt'];

// Load data saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = getAppFullUrl('/login.html');
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
    
    try {
        await loadPilihPermintaanOptions();
        console.log('Pilih Permintaan options loaded:', customOptions.length);
    } catch (error) {
        console.error('Error loading pilih permintaan options:', error);
    }
    
    try {
        await loadPetugas();
        console.log('Petugas loaded');
    } catch (error) {
        console.error('Error loading petugas:', error);
    }
    
    try {
        setupEventListeners();
        setupLogout();
        
        // Set default visibility bagian 2
        updateBagian2Visibility();
        
        // Set default visibility bagian 3
        updateBagian3Visibility();
        
        // Copy petugas options to bagian2 petugas select
        copyPetugasOptions();
        
        // Set initial No Surat visibility
        updateNoSuratVisibility();
        
        console.log('Form initialization complete');
        console.log('Final field values:', {
            npk: document.getElementById('npk')?.value,
            nama: document.getElementById('nama_lengkap')?.value,
            noTelepon: document.getElementById('no_telepon')?.value,
            unitKerja: document.getElementById('unit_kerja')?.value,
            pilihPermintaan: document.getElementById('pilih_permintaan')?.options.length
        });
    } catch (error) {
        console.error('Error in form initialization:', error);
    }
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
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=me&_t=${Date.now()}`, {
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
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getUnitKerja`);
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
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(`${fullUrl}?action=getPilihPermintaanOptions`);
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
        // Update visibility bagian 3 berdasarkan pilihan
        updateBagian3Visibility();
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
        
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(fullUrl, {
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
        
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(fullUrl, {
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
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        
        const fetchHeaders = {};
        if (token) {
            fetchHeaders['X-Auth-Token'] = token;
        }
        
        const response = await fetch(`${fullUrl}?action=getPetugas`, {
            method: 'GET',
            headers: fetchHeaders,
            mode: 'cors',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Petugas API response:', result);
        
        if (!result) {
            console.error('API returned null or undefined response');
            return;
        }
        
        if (result.success && result.data) {
            // Handle nested data structure (backward compatibility)
            const dataArray = Array.isArray(result.data) ? result.data : (result.data.data || []);
            
            if (Array.isArray(dataArray) && dataArray.length > 0) {
                const select = document.getElementById('petugas');
                if (select) {
                    // Clear existing options except the first one (placeholder)
                    while (select.options.length > 1) {
                        select.remove(1);
                    }
                    
                    dataArray.forEach(petugas => {
                        const option = document.createElement('option');
                        option.value = petugas.id;
                        option.textContent = petugas.nama || 'Tanpa Nama';
                        option.setAttribute('data-wa', petugas.no_wa || '');
                        select.appendChild(option);
                    });
                    
                    console.log(`Petugas loaded: ${dataArray.length} petugas`);
                    
                    // Copy options to bagian2 petugas select
                    copyPetugasOptions();
                } else {
                    console.error('Petugas select element not found');
                }
            } else {
                console.warn('No valid data array found. Data type:', typeof result.data, 'Data:', result.data);
                // Jika tidak ada data, set placeholder
                const select = document.getElementById('petugas');
                if (select && select.options.length === 1) {
                    console.warn('No petugas available in database');
                }
            }
        } else {
            const errorMsg = result.error || 'Unknown error';
            console.error('API returned error or no data:', errorMsg, result);
            
            // Tampilkan pesan error ke user jika diperlukan
            const select = document.getElementById('petugas');
            if (select && select.options.length === 1) {
                // Hanya tampilkan error jika belum ada option selain placeholder
                console.warn('Failed to load petugas:', errorMsg);
            }
        }
    } catch (error) {
        console.error('Error loading petugas:', error);
    }
}

function copyPetugasOptions() {
    const petugasSelect = document.getElementById('petugas');
    const petugasBagian2Select = document.getElementById('petugas_bagian2_select');
    
    if (!petugasSelect || !petugasBagian2Select) {
        console.warn('Petugas select elements not found for copying');
        return;
    }
    
    // Clear existing options except first
    while (petugasBagian2Select.options.length > 1) {
        petugasBagian2Select.remove(1);
    }
    
    // Copy options from petugas select
    for (let i = 1; i < petugasSelect.options.length; i++) {
        const option = petugasSelect.options[i].cloneNode(true);
        petugasBagian2Select.appendChild(option);
    }
    
    console.log('Petugas options copied to bagian2 select');
}

function setupEventListeners() {
    // Form submit
    document.getElementById('permintaanForm').onsubmit = handleSubmit;
    
    // WhatsApp button
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (whatsappBtn) {
        whatsappBtn.onclick = openWhatsApp;
    }
    
    // Event listener untuk Posisi Surat (untuk show/hide No Surat)
    const posisiSurat = document.getElementById('posisi_surat');
    if (posisiSurat) {
        posisiSurat.addEventListener('change', updateNoSuratVisibility);
    }
}

async function addPilihPermintaanOption(nama) {
    try {
        const formData = new FormData();
        formData.append('action', 'addPilihPermintaanOption');
        formData.append('nama_opsi', nama);
        formData.append('bagian_target', 'bagian_2');
        
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(fullUrl, {
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
            const bagian1 = document.getElementById('bagian1');
            if (bagian1) {
                const firstErrorField = bagian1.querySelector('[style*="border-color: rgb(211, 47, 47)"]') || 
                                       bagian1.querySelector('input[style*="border-color: #d32f2f"]') ||
                                       bagian1.querySelector('select[style*="border-color: #d32f2f"]');
                if (firstErrorField) {
                    firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstErrorField.focus();
                }
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
        
        // Opsi yang hanya perlu Bagian 2 + Petugas
        const shouldSkipBagian3 = SKIP_BAGIAN3_OPTIONS.includes(selectedPilihPermintaan);
        
        // Navigasi berdasarkan bagian_target
        if (shouldSkipBagian3) {
            // Revisi, Pembatalan, Perubahan Plt: ke Bagian 2
            console.log('Navigating to bagian 2 (Revisi/Pembatalan/Perubahan Plt)');
            currentSection = 2;
            showSection(2);
        } else {
            // Opsi lain: langsung ke Bagian 3 (hanya Isi Penjelasan dan Petugas)
            console.log('Navigating to bagian 3 (skip bagian 2)');
            console.log('Selected option for bagian 3:', selectedOption);
            currentSection = 3;
            
            // Pastikan bagian 2 disembunyikan dan hapus required dari field bagian 2
            const bagian2 = document.getElementById('bagian2');
            if (bagian2) {
                bagian2.style.display = 'none';
                // Hapus required dari semua field bagian 2 yang tersembunyi
                const posisiSurat = document.getElementById('posisi_surat');
                const jenisSurat = document.getElementById('jenis_surat');
                const alasanPermintaan = document.getElementById('alasan_permintaan');
                const noSurat = document.getElementById('no_surat');
                const petugasBagian2 = document.getElementById('petugas_bagian2_select');
                
                if (posisiSurat) {
                    posisiSurat.removeAttribute('required');
                }
                if (jenisSurat) {
                    jenisSurat.removeAttribute('required');
                }
                if (alasanPermintaan) {
                    alasanPermintaan.removeAttribute('required');
                }
                if (noSurat) {
                    noSurat.removeAttribute('required');
                }
                if (petugasBagian2) {
                    petugasBagian2.removeAttribute('required');
                }
            }
            showSection(3);
        }
    }
    
    if (currentSection === 2) {
        // Bagian 2 langsung submit, tidak ada next section
        // Validasi akan dilakukan di handleSubmit
        const form = document.getElementById('permintaanForm');
        if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    }
}

function prevSection() {
    if (currentSection === 3) {
        // Kembali dari bagian 3 - selalu ke bagian 1 (karena bagian 2 dilewati untuk opsi selain 3 tadi)
        currentSection = 1;
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
    const petugasBagian2Group = document.getElementById('petugas_bagian2_group');
    
    if (!bagian2) return;
    
    const skipBagian3Options = ['Revisi', 'Pembatalan', 'Perubahan Plt'];
    const shouldSkipBagian3 = skipBagian3Options.includes(selectedPilihPermintaan);
    
    // Field-field bagian 2
    const posisiSurat = document.getElementById('posisi_surat');
    const jenisSurat = document.getElementById('jenis_surat');
    const alasanPermintaan = document.getElementById('alasan_permintaan');
    const noSurat = document.getElementById('no_surat');
    const petugasBagian2 = document.getElementById('petugas_bagian2_select');
    
    if (selectedOption && selectedOption.bagian_target === 'bagian_3') {
        // Sembunyikan bagian 2 jika tidak diperlukan
        bagian2.style.display = 'none';
        // Hapus required dari semua field bagian 2 yang tersembunyi
        if (posisiSurat) posisiSurat.removeAttribute('required');
        if (jenisSurat) jenisSurat.removeAttribute('required');
        if (alasanPermintaan) alasanPermintaan.removeAttribute('required');
        if (noSurat) noSurat.removeAttribute('required');
        if (petugasBagian2) petugasBagian2.removeAttribute('required');
    } else {
        // Tampilkan bagian 2 jika diperlukan
        bagian2.style.display = 'block';
        
        // Tampilkan petugas field untuk Revisi, Pembatalan, Perubahan Plt
        if (shouldSkipBagian3 && petugasBagian2Group) {
            petugasBagian2Group.style.display = 'block';
            if (petugasBagian2) petugasBagian2.setAttribute('required', 'required');
        } else if (petugasBagian2Group) {
            petugasBagian2Group.style.display = 'none';
            if (petugasBagian2) petugasBagian2.removeAttribute('required');
        }
        
        // Set required untuk field bagian 2 jika diperlukan
        if (posisiSurat) posisiSurat.setAttribute('required', 'required');
        if (jenisSurat) jenisSurat.setAttribute('required', 'required');
        if (alasanPermintaan) alasanPermintaan.setAttribute('required', 'required');
    }
}

// Fungsi untuk update visibility No Surat berdasarkan Posisi Surat
function updateNoSuratVisibility() {
    const posisiSurat = document.getElementById('posisi_surat');
    const noSuratGroup = document.getElementById('no_surat_group');
    const noSuratInput = document.getElementById('no_surat');
    
    if (!posisiSurat || !noSuratGroup || !noSuratInput) return;
    
    if (posisiSurat.value === 'Approver') {
        noSuratGroup.style.display = 'block';
        noSuratInput.setAttribute('required', 'required');
    } else {
        noSuratGroup.style.display = 'none';
        noSuratInput.removeAttribute('required');
        noSuratInput.value = ''; // Clear value when hidden
    }
}

function showSection(section) {
    // Update visibility bagian 2 dan 3 berdasarkan pilihan SEBELUM menyembunyikan
    updateBagian2Visibility();
    updateBagian3Visibility();
    
    // Sembunyikan semua section terlebih dahulu
    document.querySelectorAll('.form-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    
    // Jika menampilkan bagian 3, pastikan hapus required dari field bagian 2 yang tersembunyi
    if (section === 3) {
        const bagian2 = document.getElementById('bagian2');
        if (bagian2 && bagian2.style.display === 'none') {
            const posisiSurat = document.getElementById('posisi_surat');
            const jenisSurat = document.getElementById('jenis_surat');
            const alasanPermintaan = document.getElementById('alasan_permintaan');
            const noSurat = document.getElementById('no_surat');
            const petugasBagian2 = document.getElementById('petugas_bagian2_select');
            
            if (posisiSurat) posisiSurat.removeAttribute('required');
            if (jenisSurat) jenisSurat.removeAttribute('required');
            if (alasanPermintaan) alasanPermintaan.removeAttribute('required');
            if (noSurat) noSurat.removeAttribute('required');
            if (petugasBagian2) petugasBagian2.removeAttribute('required');
        }
    }
    
    // Tampilkan section yang dipilih
    const targetSection = document.getElementById(`bagian${section}`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
        console.log('Showing section', section, 'targetSection:', targetSection);
    } else {
        console.error('Target section not found:', `bagian${section}`);
    }
}

function updateBagian3Visibility() {
    // Opsi yang hanya perlu Bagian 2 + Petugas
    const shouldSkipBagian3 = SKIP_BAGIAN3_OPTIONS.includes(selectedPilihPermintaan);
    
    const keteranganGroup = document.getElementById('keterangan_permintaan_group');
    
    // Sembunyikan Keterangan Permintaan untuk semua opsi (hanya tampilkan Isi Penjelasan dan Petugas)
    if (keteranganGroup) {
        keteranganGroup.style.display = 'none';
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    // Tentukan apakah kita submit dari bagian 2 atau bagian 3
    const bagian2 = document.getElementById('bagian2');
    const bagian3 = document.getElementById('bagian3');
    const isBagian2Visible = bagian2 && (bagian2.style.display !== 'none' && window.getComputedStyle(bagian2).display !== 'none');
    const isBagian3Visible = bagian3 && (bagian3.style.display !== 'none' && window.getComputedStyle(bagian3).display !== 'none');
    
    // Hapus required dari semua field yang tidak terlihat untuk menghindari error "invalid form control"
    // Jika bagian 2 terlihat, hapus required dari field bagian 3
    if (isBagian2Visible && !isBagian3Visible) {
        const isiPenjelasan = document.getElementById('isi_penjelasan');
        const petugas = document.getElementById('petugas');
        const keteranganPermintaan = document.getElementById('keterangan_permintaan');
        if (isiPenjelasan) {
            isiPenjelasan.removeAttribute('required');
            isiPenjelasan.style.display = 'none'; // Sembunyikan juga untuk memastikan
        }
        if (petugas) {
            petugas.removeAttribute('required');
            petugas.style.display = 'none'; // Sembunyikan juga untuk memastikan
        }
        if (keteranganPermintaan) {
            keteranganPermintaan.removeAttribute('required');
        }
    }
    
    // Jika bagian 3 terlihat, hapus required dari field bagian 2 yang tidak terlihat
    if (isBagian3Visible && !isBagian2Visible) {
        const posisiSurat = document.getElementById('posisi_surat');
        const jenisSurat = document.getElementById('jenis_surat');
        const alasanPermintaan = document.getElementById('alasan_permintaan');
        const petugasBagian2 = document.getElementById('petugas_bagian2_select');
        const noSurat = document.getElementById('no_surat');
        if (posisiSurat) {
            posisiSurat.removeAttribute('required');
        }
        if (jenisSurat) {
            jenisSurat.removeAttribute('required');
        }
        if (alasanPermintaan) {
            alasanPermintaan.removeAttribute('required');
        }
        if (petugasBagian2) {
            petugasBagian2.removeAttribute('required');
        }
        if (noSurat) {
            noSurat.removeAttribute('required');
        }
    }
    
    // Juga hapus required dari no_surat jika tidak terlihat (kondisi: Posisi Surat bukan Approver)
    const posisiSurat = document.getElementById('posisi_surat');
    const noSurat = document.getElementById('no_surat');
    const noSuratGroup = document.getElementById('no_surat_group');
    if (noSurat && noSuratGroup) {
        const isNoSuratVisible = noSuratGroup.style.display !== 'none' && window.getComputedStyle(noSuratGroup).display !== 'none';
        if (!isNoSuratVisible || (posisiSurat && posisiSurat.value !== 'Approver')) {
            noSurat.removeAttribute('required');
        }
    }
    
    // Validasi bagian 3 (hanya jika bagian 3 terlihat)
    let isValid = true;
    if (isBagian3Visible) {
        const requiredFields = bagian3.querySelectorAll('[required]');
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
    }
    
    // Validasi bagian 2 jika diperlukan (berdasarkan pilihan atau jika bagian 2 aktif)
    const selectedOption = customOptions.find(opt => opt.nama_opsi === selectedPilihPermintaan);
    
    // Opsi yang hanya perlu Bagian 2 + Petugas
    const shouldSkipBagian3 = SKIP_BAGIAN3_OPTIONS.includes(selectedPilihPermintaan);
    
    // Validasi bagian 2 jika bagian 2 terlihat atau jika opsi memerlukan bagian 2
    if (isBagian2Visible || (selectedOption && selectedOption.bagian_target === 'bagian_2') || shouldSkipBagian3) {
        const bagian2 = document.getElementById('bagian2');
        const posisiSurat = document.getElementById('posisi_surat');
        const jenisSurat = document.getElementById('jenis_surat');
        const alasanPermintaan = document.getElementById('alasan_permintaan');
        const noSurat = document.getElementById('no_surat');
        const petugasBagian2Select = document.getElementById('petugas_bagian2_select');
        
        // Reset border color
        if (posisiSurat) posisiSurat.style.borderColor = '#ddd';
        if (jenisSurat) jenisSurat.style.borderColor = '#ddd';
        if (alasanPermintaan) alasanPermintaan.style.borderColor = '#ddd';
        if (noSurat) noSurat.style.borderColor = '#ddd';
        if (petugasBagian2Select) petugasBagian2Select.style.borderColor = '#ddd';
        
        // Validasi Posisi Surat
        if (!posisiSurat || !posisiSurat.value || posisiSurat.value === '') {
            isValid = false;
            if (posisiSurat) posisiSurat.style.borderColor = '#d32f2f';
        }
        
        // Validasi Jenis Surat
        if (!jenisSurat || !jenisSurat.value || jenisSurat.value === '') {
            isValid = false;
            if (jenisSurat) jenisSurat.style.borderColor = '#d32f2f';
        }
        
        // Validasi No Surat (mandatory jika Posisi Surat = Approver)
        if (posisiSurat && posisiSurat.value === 'Approver') {
            if (!noSurat || !noSurat.value || !noSurat.value.trim()) {
                isValid = false;
                if (noSurat) {
                    noSurat.style.borderColor = '#d32f2f';
                    noSurat.setAttribute('required', 'required');
                }
            } else {
                if (noSurat) {
                    noSurat.style.borderColor = '#ddd';
                    noSurat.setAttribute('required', 'required');
                }
            }
        } else {
            // Jika bukan Approver, hapus required dari no_surat
            if (noSurat) {
                noSurat.removeAttribute('required');
            }
        }
        
        // Validasi Alasan Permintaan
        if (!alasanPermintaan || !alasanPermintaan.value.trim()) {
            isValid = false;
            if (alasanPermintaan) alasanPermintaan.style.borderColor = '#d32f2f';
        }
        
        // Validasi Petugas jika Revisi, Pembatalan, atau Perubahan Plt
        if (shouldSkipBagian3) {
            if (!petugasBagian2Select || !petugasBagian2Select.value || petugasBagian2Select.value === '') {
                isValid = false;
                if (petugasBagian2Select) petugasBagian2Select.style.borderColor = '#d32f2f';
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
    
    // shouldSkipBagian3 sudah dideklarasikan di atas (line 933), gunakan yang sudah ada
    // Tentukan petugas_id dari petugas_bagian2_select jika skipBagian3, atau dari petugas jika tidak
    let petugasId = '';
    let selectedPetugasOption = null;
    
    if (shouldSkipBagian3) {
        const petugasBagian2Select = document.getElementById('petugas_bagian2_select');
        if (petugasBagian2Select) {
            petugasId = petugasBagian2Select.value;
            selectedPetugasOption = petugasBagian2Select.options[petugasBagian2Select.selectedIndex];
        }
    } else {
        const petugasSelect = document.getElementById('petugas');
        if (petugasSelect) {
            petugasId = petugasSelect.value;
            selectedPetugasOption = petugasSelect.options[petugasSelect.selectedIndex];
        }
    }
    
    if (!selectedPetugasOption || !selectedPetugasOption.value) {
        const petugasField = shouldSkipBagian3 ? document.getElementById('petugas_bagian2_select') : document.getElementById('petugas');
        if (petugasField) {
            petugasField.style.borderColor = '#d32f2f';
            petugasField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            petugasField.focus();
        }
        return;
    }
    
    selectedPetugas = {
        id: selectedPetugasOption.value,
        nama: selectedPetugasOption.textContent,
        no_wa: selectedPetugasOption.getAttribute('data-wa')
    };
    
    const data = {
        npk: npkValue,
        nama_lengkap: namaValue,
        unit_kerja_id: unitKerjaValue,
        no_telepon: noTeleponValue,
        pilih_permintaan: formData.get('pilih_permintaan'),
        posisi_surat: (selectedOption && selectedOption.bagian_target === 'bagian_2') || shouldSkipBagian3 ? formData.get('posisi_surat') : '',
        jenis_surat: (selectedOption && selectedOption.bagian_target === 'bagian_2') || shouldSkipBagian3 ? formData.get('jenis_surat') : '',
        no_surat: (selectedOption && selectedOption.bagian_target === 'bagian_2') || shouldSkipBagian3 ? (formData.get('no_surat') || '') : '',
        alasan_permintaan: (selectedOption && selectedOption.bagian_target === 'bagian_2') || shouldSkipBagian3 ? formData.get('alasan_permintaan') : '',
        keterangan_permintaan: formData.get('keterangan_permintaan') || '',
        isi_penjelasan: formData.get('isi_penjelasan'),
        petugas_id: petugasId
    };
    
    // selectedPetugas sudah di-set di atas (line 1037-1041), tidak perlu di-set lagi
    
    try {
        const submitData = new FormData();
        submitData.append('action', 'submitPermintaan');
        Object.entries(data).forEach(([key, value]) => {
            submitData.append(key, value);
        });
        
        // Get auth token for user_id
        const token = getAuthToken();
        const fetchHeaders = {};
        if (token) {
            fetchHeaders['X-Auth-Token'] = token;
        }
        
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: fetchHeaders,
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
    const detailUrl = `${baseUrl}/permintaandof/permintaan/permintaan.html?detail=${submittedRequestId}`;
    
    const message = encodeURIComponent(
        `Halo ${selectedPetugas.nama},\n\n` +
        `Saya telah mengajukan permintaan dengan nomor: #${submittedRequestId}\n\n` +
        `Silakan review permintaan saya melalui link berikut:\n${detailUrl}\n\n` +
        `Terima kasih.`
    );
    
    const waUrl = `https://wa.me/${selectedPetugas.no_wa}?text=${message}`;
    window.open(waUrl, '_blank');
}

function setupLogout() {
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') {
                logout();
            } else {
                if (confirm('Apakah Anda yakin ingin logout?')) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userData');
                    window.location.href = getAppFullUrl('/login.html');
                }
            }
        });
    }
}
