const API_URL = 'api.php';

let allData = [];
let filteredData = [];
let searchTerm = '';
let spreadsheetHeaders = [];
let currentFilters = {
    jenis: '',
    bulan: '',
    tahun: '',
    status: ''
};

// Pagination state
let currentPage = 1;
let itemsPerPage = 25;
let paginatedData = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) {
        return;
    }
    
    // Check if user is regular user - hide edit sections
    const userRole = getUserRole();
    const isUser = userRole === 'user';
    
    if (isUser) {
        // Show info message for user
        const userInfoMessage = document.getElementById('userInfoMessage');
        if (userInfoMessage) {
            userInfoMessage.style.display = 'block';
        }
        
        // Hide edit sections for regular users
        const flagSection = document.getElementById('flagSection');
        const statusSection = document.getElementById('statusSection');
        const petugasSection = document.getElementById('petugasSection');
        const keteranganSection = document.getElementById('keteranganSection');
        const whatsappSection = document.getElementById('whatsappSection');
        const editModeBtn = document.getElementById('editModeBtn');
        
        if (flagSection) flagSection.style.display = 'none';
        if (statusSection) statusSection.style.display = 'none';
        if (petugasSection) petugasSection.style.display = 'none';
        if (keteranganSection) keteranganSection.style.display = 'none';
        if (whatsappSection) whatsappSection.style.display = 'none';
        if (editModeBtn) editModeBtn.style.display = 'none';
    }
    
    loadData();
    setupEventListeners();
    setupLogout();
    
    // Cek apakah ada parameter id di URL untuk membuka detail
    const urlParams = new URLSearchParams(window.location.search);
    const detailId = urlParams.get('id');
    if (detailId) {
        // Tunggu data selesai dimuat, lalu buka detail
        setTimeout(() => {
            const rowId = parseInt(detailId, 10);
            if (!isNaN(rowId)) {
                showDetail(rowId);
            }
        }, 1000);
    }
});

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
                    window.location.href = '../login.html';
                }
            }
        });
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        filterAndDisplayData();
    });
    }

    const jenisFilter = document.getElementById('jenisFilter');
    if (jenisFilter) {
        jenisFilter.addEventListener('change', (e) => {
        currentFilters.jenis = e.target.value;
        filterAndDisplayData();
    });
    }

    const bulanFilter = document.getElementById('bulanFilter');
    if (bulanFilter) {
        bulanFilter.addEventListener('change', (e) => {
        currentFilters.bulan = e.target.value;
        filterAndDisplayData();
    });
    }

    const tahunFilter = document.getElementById('tahunFilter');
    if (tahunFilter) {
        tahunFilter.addEventListener('change', (e) => {
        currentFilters.tahun = e.target.value;
        filterAndDisplayData();
    });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
        loadData();
        });
    }

    // Status filter buttons
    const statusFilterBtns = document.querySelectorAll('.status-filter-btn');
    statusFilterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            statusFilterBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Set filter
            currentFilters.status = this.getAttribute('data-status') || '';
            filterAndDisplayData();
        });
    });

    // Pagination event listeners
    const paginationFirst = document.getElementById('paginationFirst');
    if (paginationFirst) {
        paginationFirst.addEventListener('click', () => goToPage(1));
    }

    const paginationPrev = document.getElementById('paginationPrev');
    if (paginationPrev) {
        paginationPrev.addEventListener('click', () => goToPage(currentPage - 1));
    }

    const paginationNext = document.getElementById('paginationNext');
    if (paginationNext) {
        paginationNext.addEventListener('click', () => goToPage(currentPage + 1));
    }

    const paginationLast = document.getElementById('paginationLast');
    if (paginationLast) {
        paginationLast.addEventListener('click', () => goToPage(getTotalPages()));
    }

    const paginationSizeSelect = document.getElementById('paginationSizeSelect');
    if (paginationSizeSelect) {
        paginationSizeSelect.addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1;
        applyPagination();
        displayData();
    });
    }

    const closeBtn = document.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePopup);
    }

    const detailPopup = document.getElementById('detailPopup');
    if (detailPopup) {
        detailPopup.addEventListener('click', (e) => {
        if (e.target.id === 'detailPopup') {
            closePopup();
        }
    });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePopup();
        }
    });
}

function sortDataByTimestamp(data) {
    return data.sort((a, b) => {
        const dateA = parseTimestamp(a.timestamp);
        const dateB = parseTimestamp(b.timestamp);
        return dateB - dateA;
    });
}

function parseTimestamp(timestamp) {
    if (!timestamp) return 0;
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

async function loadData() {
    try {
        allData = [];
        filteredData = [];
        
        const url = new URL(API_URL, window.location.origin);
        url.searchParams.append('action', 'getData');
        url.searchParams.append('table', 'permintaan');
        url.searchParams.append('_t', Date.now());
        
        // Get auth token for filtering by user
        const token = getAuthToken();
        const fetchHeaders = {};
        if (token) {
            fetchHeaders['X-Auth-Token'] = token;
        }
        
        let response;
        try {
            response = await fetch(url.toString(), {
                method: 'GET',
                headers: fetchHeaders,
                mode: 'cors',
                cache: 'no-cache'
            });
        } catch (fetchError) {
            console.error('Fetch error details:', fetchError);
            throw new Error('Tidak dapat terhubung ke server: ' + fetchError.message);
        }

        if (!response) {
            throw new Error('Tidak dapat terhubung ke server.');
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP Error ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result) {
            throw new Error('Response kosong dari Apps Script');
        }
        
        if (!result.success) {
            throw new Error(result.error || 'Error dari server');
        }

        // Debug: Log response untuk troubleshooting
        console.log('Data loaded from API:', {
            success: result.success,
            dataCount: result.data ? result.data.length : 0,
            headers: result.headers ? result.headers.length : 0,
            firstRow: result.data && result.data.length > 0 ? result.data[0] : null
        });

        const headers = result.headers || (result.data.length > 0 ? Object.keys(result.data[0]) : []);
        spreadsheetHeaders = headers;
        updateTableHeaders();
        
        allData = [];
        filteredData = [];
        
        // Check if data is empty
        if (!result.data || result.data.length === 0) {
            console.warn('No data returned from API. This might be because:');
            console.warn('1. No data exists in database');
            console.warn('2. User does not have any data (user_id mismatch)');
            console.warn('3. Filter is too restrictive');
        }
        
        allData = result.data.map((row, index) => {
            const getColumnValue = (position) => {
                if (position < headers.length) {
                    const headerName = headers[position];
                    return row[headerName] || '';
                }
                return '';
            };

            // Ensure rowNumber is an integer
            const originalRowNumber = row.rowNumber ? parseInt(row.rowNumber, 10) : (index + 2);
            
            // Get Status Surat (col_g) - try multiple sources
            // Note: In API headers, index 6 is 'Pilih Permintaan', index 7 is 'Status Surat'
            // But in database, col_g is Status Surat
            const statusSurat = row['Status Surat'] || row['col_g'] || getColumnValue(7) || '';
            const pilihPermintaan = row['Pilih Permintaan'] || row['pilih_permintaan'] || getColumnValue(6) || '';
            
            // Direct mapping from API response (more reliable)
            return {
                id: index,
                rowNumber: originalRowNumber,
                originalRowNumber: originalRowNumber,
                // Map directly from API response keys
                A: row['Timestamp'] || getColumnValue(0) || '',
                B: row['NPK'] || getColumnValue(1) || '',
                C: row['Nama Lengkap'] || getColumnValue(2) || '',
                D: row['Unit Kerja :'] || row['Unit Kerja'] || getColumnValue(3) || '',
                E: row['No Telepon (HP)'] || row['No Telepon'] || getColumnValue(4) || '',
                F: row['No Surat'] || getColumnValue(5) || '',
                G: statusSurat, // Status Surat (col_g) - NOT Pilih Permintaan!
                H: row['Email Address'] || getColumnValue(8) || '',
                I: row['Jenis Surat'] || getColumnValue(9) || '',
                J: row['Isi Penjelasan Singkat Permintaanya'] || getColumnValue(10) || '',
                K: getColumnValue(11) || '',
                L: getColumnValue(12) || '',
                pilihPermintaan: pilihPermintaan || findColumnValue(row, 'Pilih Permintaan'),
                timestamp: row['Timestamp'] || findColumnValue(row, 'Timestamp') || '',
                status: (row['Status'] || findColumnValue(row, 'Status') || '').trim(),
                flag: (row['Flag'] || findColumnValue(row, 'Flag') || '').trim(),
                petugas: (row['Petugas'] || findColumnValue(row, 'Petugas') || '').trim(),
                waktuSelesai: (row['Waktu Selesai'] || findColumnValue(row, 'Waktu Selesai') || '').trim(),
                keterangan: (row['Keterangan'] || findColumnValue(row, 'Keterangan') || '').trim(),
                persetujuan: (row['Persetujuan'] || findColumnValue(row, 'Persetujuan') || '').trim(),
                alasanPermintaan: row['Alasan Permintaan/Permintaan'] || 
                                 findColumnValue(row, 'Alasan Permintaan/Permintaan') || 
                                 findColumnValue(row, 'ALASAN PERMINTAAN/PERMINTAAN') ||
                                 findColumnValue(row, 'Alasan Permintaan') ||
                                 findColumnValue(row, 'ALASAN PERMINTAAN') ||
                                 '',
                dbId: row.id || null, // ID dari database (unik)
                _originalRow: row // Simpan original row untuk akses langsung
            };
        });

        const sortedData = sortDataByTimestamp([...allData]);
        allData = sortedData;
        filteredData = [];
        
        setupFilterOptions();
        filterAndDisplayData();
    } catch (error) {
        console.error('Error loading data:', error);
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.innerHTML = 
                '<tr><td colspan="8" class="loading">' +
            '<strong style="color: #dc3545;">Error: ' + escapeHtml(error.message) + '</strong>' +
            '</td></tr>';
        }
        const cardsContainer = document.getElementById('cardsContainer');
        if (cardsContainer) {
            cardsContainer.innerHTML = 
            '<div class="loading"><strong style="color: #dc3545;">Error: ' + escapeHtml(error.message) + '</strong></div>';
        }
    }
}

function findColumnValue(row, columnName) {
    const keys = Object.keys(row);
    const searchName = columnName.toLowerCase().trim();
    
    if (searchName === 'status') {
        let key = keys.find(k => {
            const kLower = k.toLowerCase().trim();
            return kLower === 'status' && kLower !== 'status surat';
        });
        if (key) {
            return row[key] || '';
        }
        key = keys.find(k => {
            const kLower = k.toLowerCase().trim();
            return kLower === 'status' && !kLower.includes('surat');
        });
        if (key) {
            return row[key] || '';
        }
    }
    
    let key = keys.find(k => k.toLowerCase().trim() === searchName);
    if (key) {
        return row[key] || '';
    }
    
    key = keys.find(k => {
        const kLower = k.toLowerCase();
        return kLower.includes(searchName) && !(searchName === 'status' && kLower.includes('surat'));
    });
    if (key) {
        return row[key] || '';
    }
    
    console.warn(`Column "${columnName}" not found. Available keys:`, keys);
    return '';
}

function setupFilterOptions() {
    // Setup jenis filter jika elemen ada
    const jenisSet = new Set();
    allData.forEach(row => {
        if (row.pilihPermintaan) {
            jenisSet.add(row.pilihPermintaan);
        }
    });
    
    const jenisFilter = document.getElementById('jenisFilter');
    if (jenisFilter) {
        // Clear existing options except the first one
        while (jenisFilter.options.length > 1) {
            jenisFilter.remove(1);
        }
    Array.from(jenisSet).sort().forEach(jenis => {
        const option = document.createElement('option');
        option.value = jenis;
        option.textContent = jenis;
        jenisFilter.appendChild(option);
    });
    }

    // Setup tahun filter jika elemen ada
    const tahunSet = new Set();
    allData.forEach(row => {
        if (row.timestamp) {
            const tahun = extractYear(row.timestamp);
            if (tahun) {
                tahunSet.add(tahun);
            }
        }
    });
    
    const tahunFilter = document.getElementById('tahunFilter');
    if (tahunFilter) {
        // Clear existing options except the first one
        while (tahunFilter.options.length > 1) {
            tahunFilter.remove(1);
        }
    Array.from(tahunSet).sort((a, b) => b - a).forEach(tahun => {
        const option = document.createElement('option');
        option.value = tahun;
        option.textContent = tahun;
        tahunFilter.appendChild(option);
    });
    }
}

function extractYear(timestamp) {
    if (!timestamp) return null;
    
    const dateStr = timestamp.toString().trim();
    const dateMatch = dateStr.match(/\d{4}/);
    if (dateMatch) {
        return dateMatch[0];
    }
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date.getFullYear().toString();
    }
    
    return null;
}

function extractMonth(timestamp) {
    if (!timestamp) return null;
    
    const dateStr = timestamp.toString().trim();
    const date = new Date(dateStr);
    
    if (!isNaN(date.getTime())) {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return month;
    }
    
    const match = dateStr.match(/(\d{1,2})\/\d{1,2}\/\d{4}/);
    if (match) {
        return match[1].padStart(2, '0');
    }
    
    return null;
}

function filterAndDisplayData() {
    filteredData = allData.filter(row => {
        if (currentFilters.jenis && row.pilihPermintaan !== currentFilters.jenis) {
            return false;
        }

        if (currentFilters.bulan) {
            const month = extractMonth(row.timestamp);
            if (month !== currentFilters.bulan) {
                return false;
            }
        }

        if (currentFilters.tahun) {
            const year = extractYear(row.timestamp);
            if (year !== currentFilters.tahun) {
                return false;
            }
        }

        if (currentFilters.status) {
            const rowStatus = (row.status || '').trim();
            if (rowStatus !== currentFilters.status) {
                return false;
            }
        }

        if (searchTerm) {
            const searchable = [
                row.A, row.B, row.C, row.D, row.F, row.G
            ].join(' ').toLowerCase();
            
            if (!searchable.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    currentPage = 1;
    applyPagination();
    displayData();
    updateResultCount();
    updatePagination();
}

function displayData() {
    const tbody = document.getElementById('tableBody');
    const cardsContainer = document.getElementById('cardsContainer');
    const paginationContainer = document.getElementById('paginationContainer');
    const isMobile = window.innerWidth <= 768;
    
    if (filteredData.length === 0) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">Tidak ada data yang ditemukan</td></tr>';
        }
        if (cardsContainer) {
        cardsContainer.innerHTML = '<div class="loading">Tidak ada data yang ditemukan</div>';
        }
        if (paginationContainer) {
        paginationContainer.style.display = 'none';
        }
        return;
    }

    if (paginationContainer) {
    paginationContainer.style.display = 'flex';
    }
    
    if (isMobile) {
        displayCards();
    } else {
        displayTable();
    }
}

function getStatusColumnIndex() {
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        if (spreadsheetHeaders[i] && spreadsheetHeaders[i].toLowerCase().includes('status')) {
            return i;
        }
    }
    return -1;
}

function getFlagColumnIndex() {
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        if (spreadsheetHeaders[i] && spreadsheetHeaders[i].toLowerCase().includes('flag')) {
            return i;
        }
    }
    return -1;
}

function getPetugasColumnIndex() {
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        if (spreadsheetHeaders[i] && spreadsheetHeaders[i].toLowerCase().includes('petugas')) {
            return i;
        }
    }
    return -1;
}

function getWaktuSelesaiColumnIndex() {
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        if (spreadsheetHeaders[i] && (spreadsheetHeaders[i].toLowerCase().includes('waktu selesai') || spreadsheetHeaders[i].toLowerCase().includes('waktuselesai'))) {
            return i;
        }
    }
    return -1;
}

function getKeteranganColumnIndex() {
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        if (spreadsheetHeaders[i] && spreadsheetHeaders[i].toLowerCase().includes('keterangan')) {
            return i;
        }
    }
    return -1;
}

function getPersetujuanColumnIndex() {
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        if (spreadsheetHeaders[i] && spreadsheetHeaders[i].toLowerCase().includes('persetujuan')) {
            return i;
        }
    }
    return -1;
}

function formatStatus(status) {
    if (!status) return '<span class="status-badge status-empty">-</span>';
    const statusLower = status.toLowerCase();
    if (statusLower === 'open' || statusLower === 'pending') {
        return '<span class="status-badge status-open">Open</span>';
    } else if (statusLower === 'closed' || statusLower === 'approved') {
        return '<span class="status-badge status-closed">Closed</span>';
    } else if (statusLower === 'cancelled' || statusLower === 'rejected') {
        return '<span class="status-badge status-cancelled">Cancelled</span>';
    }
    return `<span class="status-badge">${escapeHtml(status)}</span>`;
}

function formatFlag(flag) {
    if (!flag || flag.trim() === '') return '<span class="flag-badge flag-empty">-</span>';
    const flagLower = flag.toLowerCase().trim();
    if (flagLower === 'hijau') {
        return '<span class="flag-badge flag-hijau">Hijau</span>';
    } else if (flagLower === 'kuning') {
        return '<span class="flag-badge flag-kuning">Kuning</span>';
    } else if (flagLower === 'merah') {
        return '<span class="flag-badge flag-merah">Merah</span>';
    }
    return `<span class="flag-badge flag-empty">-</span>`;
}

function formatTanggalMinta(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            // Coba parse format lain
            const parts = timestamp.toString().split(/[\s-:]/);
            if (parts.length >= 3) {
                // Format: DD-MM-YYYY HH:mm:ss
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                const time = parts.length >= 6 ? `${parts[3]}:${parts[4]}:${parts[5]}` : '';
                
                if (time) {
                    return `<div>${day}-${month}-${year}</div><div>${time}</div>`;
                }
                return `<div>${day}-${month}-${year}</div>`;
            }
            return escapeHtml(timestamp);
        }
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `<div>${day}-${month}-${year}</div><div>${hours}:${minutes}:${seconds}</div>`;
    } catch (e) {
        return escapeHtml(timestamp);
    }
}

function findColumnValueFromRow(row, columnName) {
    if (!row || !columnName) return '';
    
    // Cek di _originalRow terlebih dahulu
    if (row._originalRow) {
        const value = findColumnValue(row._originalRow, columnName);
        if (value && value.trim() !== '') return value.trim();
    }
    
    // Cek di spreadsheetHeaders
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        const header = spreadsheetHeaders[i];
        if (header && header.toLowerCase().includes(columnName.toLowerCase())) {
            const colLetter = String.fromCharCode(65 + i);
            const value = row[colLetter];
            if (value && value.toString().trim() !== '') return value.toString().trim();
        }
    }
    
    return '';
}

function formatPersetujuan(persetujuan, flag) {
    if (!persetujuan || persetujuan.trim() === '') {
        // Cek apakah perlu persetujuan (kuning/merah)
        if (flag && (flag.toLowerCase() === 'kuning' || flag.toLowerCase() === 'merah')) {
            return '<span class="persetujuan-badge persetujuan-pending" title="Menunggu Persetujuan">⏳ Menunggu</span>';
        }
        return '<span class="persetujuan-badge persetujuan-none">-</span>';
    }
    
    const persetujuanLower = persetujuan.toLowerCase();
    if (persetujuanLower.includes('disetujui') || persetujuanLower.includes('approved') || persetujuanLower.includes('setuju')) {
        return '<span class="persetujuan-badge persetujuan-approved" title="' + escapeHtml(persetujuan) + '">✅ Disetujui</span>';
    } else if (persetujuanLower.includes('ditolak') || persetujuanLower.includes('rejected') || persetujuanLower.includes('tidak setuju')) {
        return '<span class="persetujuan-badge persetujuan-rejected" title="' + escapeHtml(persetujuan) + '">❌ Ditolak</span>';
    }
    return '<span class="persetujuan-badge">' + escapeHtml(persetujuan) + '</span>';
}

function displayTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    // Kolom sesuai gambar: Tanggal Minta, Jenis Permintaan, NPK, Nama Lengkap, Unit Kerja, No Surat
    // Mapping: Timestamp (0), Pilih Permintaan (6), NPK (1), Nama Lengkap (2), Unit Kerja (3), No Surat (cari)
    
    tbody.innerHTML = paginatedData.map((row) => {
        // 1. Tanggal Minta - format dengan tanggal dan waktu di 2 baris
        const timestamp = row.timestamp || row.A || '';
        const tanggalMinta = formatTanggalMinta(timestamp);
        
        // 2. Jenis Permintaan (Pilih Permintaan)
        const jenisPermintaan = row.pilihPermintaan || row.G || '';
        
        // 3. NPK
        const npk = findColumnValueFromRow(row, 'NPK') || row.B || '';
        
        // 4. Nama Lengkap
        const namaLengkap = findColumnValueFromRow(row, 'Nama Lengkap') || row.C || '';
        
        // 5. Unit Kerja
        const unitKerja = findColumnValueFromRow(row, 'Unit Kerja') || row.D || '';
        
        // 6. No Surat
        const noSurat = findColumnValueFromRow(row, 'No Surat') || findColumnValueFromRow(row, 'Nomor Surat') || '';
        
        const statusCell = formatStatus(row.status);
        const flagCell = formatFlag(row.flag);

        return `
            <tr data-row-id="${row.id}" class="data-row">
                <td>${tanggalMinta}</td>
                <td>${highlightText(escapeHtml(jenisPermintaan))}</td>
                <td>${highlightText(escapeHtml(npk))}</td>
                <td>${highlightText(escapeHtml(namaLengkap))}</td>
                <td>${highlightText(escapeHtml(unitKerja))}</td>
                <td>${highlightText(escapeHtml(noSurat))}</td>
                <td onclick="event.stopPropagation()" style="text-align: center;">${statusCell}</td>
                <td onclick="event.stopPropagation()" style="text-align: center;">${flagCell}</td>
            </tr>
        `;
    }).join('');
    
    tbody.querySelectorAll('.data-row').forEach(row => {
        row.style.cursor = 'pointer';
        const rowId = parseInt(row.getAttribute('data-row-id'));
        if (rowId !== null && !isNaN(rowId)) {
            row.addEventListener('click', function(e) {
                const clickedTd = e.target.closest('td');
                if (clickedTd && clickedTd.hasAttribute('onclick')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                showDetail(rowId);
            });
        }
    });
}

function displayCards() {
    const cardsContainer = document.getElementById('cardsContainer');
    const displayColumns = [0, 6, 1, 2, 3, 5];
    
    cardsContainer.innerHTML = paginatedData.map(row => {
        const headers = spreadsheetHeaders;
        const cardRows = displayColumns.map(index => {
            let headerName = headers[index] || `Kolom ${String.fromCharCode(65 + index)}`;
            if (headerName === 'Pilih Permintaan') {
                headerName = 'Jenis Permintaan';
            }
            if (headerName && headerName.toLowerCase().includes('timestamp')) {
                headerName = 'Tanggal Minta';
            }
            const colLetter = String.fromCharCode(65 + index);
            let value = row[colLetter] || '';
            value = formatValueForDisplay(value, headerName);
            return `
                <div class="card-row">
                    <div class="card-label">${escapeHtml(headerName)}</div>
                    <div class="card-value">${highlightText(value)}</div>
                </div>
            `;
        }).join('');

        const statusRow = `
            <div class="card-row">
                <div class="card-label">Status</div>
                <div class="card-value">${formatStatus(row.status)}</div>
            </div>
        `;

        const flagRow = `
            <div class="card-row">
                <div class="card-label">Flag</div>
                <div class="card-value">${formatFlag(row.flag)}</div>
            </div>
        `;

        return `
            <div class="card" data-row-id="${row.id}">
                ${cardRows}
                ${statusRow}
                ${flagRow}
            </div>
        `;
    }).join('');
    
    cardsContainer.querySelectorAll('.card').forEach(card => {
        card.style.cursor = 'pointer';
        const rowId = parseInt(card.getAttribute('data-row-id'));
        if (rowId !== null && !isNaN(rowId)) {
            card.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                showDetail(rowId);
            });
        }
    });
}

window.addEventListener('resize', () => {
    if (filteredData.length > 0) {
        displayData();
    }
});

function highlightText(text) {
    if (!text) return '';
    
    if (typeof text !== 'string') {
        text = String(text);
    }
    
    if (text.includes('<br>')) {
        const parts = text.split('<br>');
        return parts.map(part => {
            if (!searchTerm) return escapeHtml(part);
            const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
            return escapeHtml(part).replace(regex, '<span class="highlight">$1</span>');
        }).join('<br>');
    }
    
    if (!searchTerm) {
        return escapeHtml(text);
    }

    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${day}-${month}-${year}<br>${hours}:${minutes}:${seconds}`;
    } catch (e) {
        return timestamp;
    }
}

function formatValueForDisplay(value, headerName) {
    if (!value || value === '') return '';
    
    if (!headerName) return value;
    
    const headerLower = headerName.toLowerCase();
    const isTimestamp = headerLower.includes('timestamp') || 
                        (headerLower.includes('waktu') && !headerLower.includes('selesai')) ||
                        headerLower.includes('tanggal');
    
    const isWaktuSelesai = headerLower.includes('waktu selesai') || headerLower.includes('waktuselesai');
    
    if (isTimestamp || isWaktuSelesai) {
        return formatTimestamp(value);
    }
    
    return value;
}

function updateResultCount() {
    const resultCount = document.getElementById('resultCount');
    if (resultCount) {
        resultCount.textContent = filteredData.length;
    }
}

function updateTableHeaders() {
    const thead = document.querySelector('#dataTable thead tr');
    if (!thead || spreadsheetHeaders.length === 0) return;
    
    // Jangan update header jika sudah ada header di HTML (untuk layout baru)
    // Hanya update jika header masih menggunakan format lama
    const existingHeaders = thead.querySelectorAll('th');
    if (existingHeaders.length > 0 && existingHeaders[0].textContent.includes('ID PERMINTAAN')) {
        // Header sudah di-set di HTML, skip update
        return;
    }
    
    const displayColumns = [0, 6, 1, 2, 3, 5];
    
    thead.innerHTML = displayColumns.map(index => {
        let headerName = spreadsheetHeaders[index] || `Kolom ${String.fromCharCode(65 + index)}`;
        if (headerName === 'Pilih Permintaan') {
            headerName = 'Jenis Permintaan';
        }
        if (headerName && headerName.toLowerCase().includes('timestamp')) {
            headerName = 'Tanggal Minta';
        }
        return `<th>${escapeHtml(headerName)}</th>`;
    }).join('') + '<th>Status</th><th>Flag</th>';
    
    // Show action header if user is admin
    const actionHeader = document.getElementById('actionHeader');
    if (actionHeader) {
        const userRole = getUserRole();
        actionHeader.style.display = (userRole === 'admin' || userRole === 'super_admin') ? 'table-cell' : 'none';
    }
}

function showDetail(rowId) {
    console.log('showDetail called with rowId:', rowId);
    const row = allData.find(r => r.id === rowId);
    if (!row) {
        console.error('Row not found for id:', rowId, 'Total rows:', allData.length);
        return;
    }
    console.log('Row found:', row);

    let dataName = '';
    const nameHeaders = ['Nama Lengkap', 'Nama', 'Name', 'NAMA LENGKAP', 'NAMA'];
    
    for (let i = 0; i < spreadsheetHeaders.length; i++) {
        const header = spreadsheetHeaders[i];
        if (nameHeaders.some(nh => header && header.toLowerCase().includes(nh.toLowerCase()))) {
            const colLetter = String.fromCharCode(65 + i);
            dataName = row[colLetter] || '';
            if (dataName) break;
        }
    }
    
    if (!dataName && row.B) {
        dataName = row.B;
    }
    
    if (!dataName && row.C) {
        dataName = row.C;
    }

    const detailTitle = document.querySelector('#detailPopup h2');
    if (detailTitle) {
        detailTitle.textContent = dataName ? `Detail Data - ${dataName}` : 'Detail Data';
    }

    const detailContent = document.getElementById('detailContent');
    const statusColIndex = getStatusColumnIndex();
    const flagColIndex = getFlagColumnIndex();
    const petugasColIndex = getPetugasColumnIndex();
    const waktuSelesaiColIndex = getWaktuSelesaiColumnIndex();
    const keteranganColIndex = getKeteranganColumnIndex();
    const persetujuanColIndex = getPersetujuanColumnIndex();
    
    const currentStatus = (row.status || '').trim();
    let currentFlag = (row.flag || '').trim();
    const currentPetugas = (row.petugas || '').trim();
    const currentWaktuSelesai = (row.waktuSelesai || '').trim();
    const currentKeterangan = (row.keterangan || '').trim();
    const currentPersetujuan = (row.persetujuan || '').trim();
    
    // Cek apakah sudah disetujui (untuk kuning/merah)
    const isApproved = currentPersetujuan.toLowerCase().includes('disetujui') || 
                       currentPersetujuan.toLowerCase().includes('approved') ||
                       currentPersetujuan.toLowerCase().includes('setuju');
    const isRejected = currentPersetujuan.toLowerCase().includes('ditolak') || 
                       currentPersetujuan.toLowerCase().includes('rejected') ||
                       currentPersetujuan.toLowerCase().includes('tidak setuju');
    
    // Untuk kuning/merah, harus ada persetujuan dulu (kecuali sudah disetujui/ditolak)
    const needsApproval = (currentFlag.toLowerCase() === 'kuning' || currentFlag.toLowerCase() === 'merah') && 
                          !isApproved && !isRejected;
    
    const isCompleted = (currentStatus === 'Closed' || currentStatus === 'Cancelled') && 
                        currentFlag && currentPetugas;
    
    // Use original row data from API which has proper field names
    // This is more reliable than using column letters (A, B, C, etc.)
    const originalRow = row._originalRow || {};
    
    // Define the order of fields to display (excluding special fields)
    // Note: 'Status' and 'Status Surat' are different fields
    // - 'Status Surat' = status dokumen (Draft, Review, Approved, Rejected)
    // - 'Status' = status permintaan (Open, Closed, Cancelled)
    const fieldsToDisplay = [
        'Timestamp',
        'NPK',
        'Nama Lengkap',
        'Unit Kerja :',
        'No Telepon (HP)',
        'No Surat',
        'Pilih Permintaan',
        'Status Surat',  // Status dokumen (Draft, Review, Approved, Rejected)
        'Alasan Permintaan/Permintaan',
        'Email Address',
        'Jenis Surat',
        'Isi Penjelasan Singkat Permintaanya'
    ];
    
    // Build detail HTML from original row data
    let detailHtml = '';
    fieldsToDisplay.forEach(fieldName => {
        // Skip fields that will be shown separately
        if (fieldName === 'Status' || fieldName === 'Flag' || fieldName === 'Petugas' || 
            fieldName === 'Waktu Selesai' || fieldName === 'Keterangan' || fieldName === 'Persetujuan') {
            return;
        }
        
        let displayName = fieldName;
        if (fieldName === 'Pilih Permintaan') {
            displayName = 'Jenis Permintaan';
        }
        if (fieldName && fieldName.toLowerCase().includes('timestamp')) {
            displayName = 'Tanggal Minta';
        }
        
        // Get value from original row (which has proper field names from API)
        let value = originalRow[fieldName] || '';
        
        if (!value || value === '') {
            return; // Skip empty fields
        }
        
        // Format value based on field type
        const isTimestamp = fieldName && (
            fieldName.toLowerCase().includes('timestamp') || 
            (fieldName.toLowerCase().includes('waktu') && !fieldName.toLowerCase().includes('selesai')) ||
            fieldName.toLowerCase().includes('tanggal')
        );
        
        if (isTimestamp) {
            value = formatTimestamp(value);
        } else {
            value = escapeHtml(value);
        }
        
        detailHtml += `
            <div class="detail-item">
                <label>${escapeHtml(displayName)}</label>
                <div class="value">${value}</div>
            </div>
        `;
    });
    
    detailContent.innerHTML = detailHtml;
    
    // Selalu tampilkan semua field yang bisa diedit (Status, Flag, Petugas, Keterangan, Persetujuan, Waktu Selesai)
    // Pastikan label 'Status' (bukan 'Status Surat') untuk status permintaan (Open, Closed, Cancelled)
    const statusHeader = 'Status'; // Hardcode untuk memastikan label benar
    const flagHeader = spreadsheetHeaders[flagColIndex] || 'Flag';
    const petugasHeader = spreadsheetHeaders[petugasColIndex] || 'Petugas';
    const keteranganHeader = spreadsheetHeaders[keteranganColIndex] || 'Keterangan';
    const persetujuanHeader = spreadsheetHeaders[persetujuanColIndex] || 'Persetujuan';
    const waktuSelesaiHeader = spreadsheetHeaders[waktuSelesaiColIndex] || 'Waktu Selesai';
    
    detailContent.innerHTML += `
        <div class="detail-item">
            <label>${escapeHtml(statusHeader)}</label>
            <div class="value">${formatStatus(currentStatus)}</div>
        </div>
        <div class="detail-item">
            <label>${escapeHtml(flagHeader)}</label>
            <div class="value">${formatFlag(currentFlag)}</div>
        </div>
        <div class="detail-item">
            <label>${escapeHtml(petugasHeader)}</label>
            <div class="value">${escapeHtml(currentPetugas || '-')}</div>
        </div>
        <div class="detail-item">
            <label>${escapeHtml(keteranganHeader)}</label>
            <div class="value">${escapeHtml(currentKeterangan || '-')}</div>
        </div>
        <div class="detail-item">
            <label>${escapeHtml(persetujuanHeader)}</label>
            <div class="value">${currentPersetujuan ? formatPersetujuan(currentPersetujuan, currentFlag) : '-'}</div>
        </div>
    `;
    
    if (currentWaktuSelesai) {
        let waktuSelesaiValue = formatTimestamp(currentWaktuSelesai);
        if (!waktuSelesaiValue || waktuSelesaiValue === currentWaktuSelesai || !waktuSelesaiValue.includes(':')) {
            try {
                const date = new Date(currentWaktuSelesai);
                if (!isNaN(date.getTime())) {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    waktuSelesaiValue = `${day}-${month}-${year}<br>${hours}:${minutes}:${seconds}`;
                } else {
                    waktuSelesaiValue = escapeHtml(currentWaktuSelesai);
                }
            } catch (e) {
                waktuSelesaiValue = escapeHtml(currentWaktuSelesai);
            }
        }
        detailContent.innerHTML += `
            <div class="detail-item">
                <label>${escapeHtml(waktuSelesaiHeader)}</label>
                <div class="value">${waktuSelesaiValue}</div>
            </div>
        `;
    } else {
        detailContent.innerHTML += `
            <div class="detail-item">
                <label>${escapeHtml(waktuSelesaiHeader)}</label>
                <div class="value">-</div>
            </div>
        `;
    }

    const statusSelect = document.getElementById('statusSelect');
    const flagSelect = document.getElementById('flagSelect');
    const petugasSelect = document.getElementById('petugasSelect');
    const keteranganInput = document.getElementById('keteranganInput');
    const saveBtn = document.getElementById('saveBtn');
    const saveFlagBtn = document.getElementById('saveFlagBtn');
    const whatsappBtn = document.getElementById('whatsappBtn');
    const whatsappSection = document.getElementById('whatsappSection');
    const statusSection = document.getElementById('statusSection');
    const flagSection = document.getElementById('flagSection');
    const petugasSection = document.getElementById('petugasSection');
    const keteranganSection = document.getElementById('keteranganSection');
    const editModeBtn = document.getElementById('editModeBtn');
    const chatUlangBtn = document.getElementById('chatUlangBtn');
    const chatUlangSection = document.getElementById('chatUlangSection');
    
    // Check user role - user hanya bisa melihat, tidak bisa aksi apapun
    const userRole = getUserRole();
    const isUser = userRole === 'user';
    
    // Sembunyikan semua aksi/edit untuk user di awal
    // Tapi tetap tampilkan button hubungi petugas jika status belum selesai
    if (isUser) {
        if (flagSection) flagSection.style.display = 'none';
        if (statusSection) statusSection.style.display = 'none';
        if (petugasSection) petugasSection.style.display = 'none';
        if (keteranganSection) keteranganSection.style.display = 'none';
        if (whatsappSection) whatsappSection.style.display = 'none';
        if (editModeBtn) editModeBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (saveFlagBtn) saveFlagBtn.style.display = 'none';
        
        // Tampilkan button hubungi petugas hanya jika status belum selesai dan ada petugas
        const isNotCompleted = currentStatus !== 'Closed' && currentStatus !== 'Cancelled';
        if (isNotCompleted && currentPetugas && chatUlangBtn && chatUlangSection) {
            // Setup button hubungi petugas untuk user
            setupHubungiPetugasButton(row, currentPetugas, dataName, chatUlangBtn, chatUlangSection, originalRow, currentStatus, currentFlag, currentKeterangan);
        } else {
            if (chatUlangSection) chatUlangSection.style.display = 'none';
        }
    } else {
        // Untuk admin, sembunyikan chat ulang (jika diperlukan)
        if (chatUlangSection) chatUlangSection.style.display = 'none';
    }
    
    // Check if elements exist
    if (!saveBtn || !saveFlagBtn || !whatsappBtn || !whatsappSection || !statusSection || !flagSection || !petugasSection || !keteranganSection) {
        console.error('Missing required elements:', {
            saveBtn: !!saveBtn,
            saveFlagBtn: !!saveFlagBtn,
            whatsappBtn: !!whatsappBtn,
            whatsappSection: !!whatsappSection,
            statusSection: !!statusSection,
            flagSection: !!flagSection,
            petugasSection: !!petugasSection,
            keteranganSection: !!keteranganSection
        });
        showNotification('Error: Elemen modal tidak ditemukan. Silakan refresh halaman.', 'error');
        return;
    }
    
    saveBtn.textContent = 'Simpan';
    saveFlagBtn.textContent = 'Simpan Flag';
    
    // Set nilai flag terlebih dahulu
    if (currentFlag) {
        flagSelect.value = currentFlag;
    } else {
        flagSelect.value = '';
    }
    
    // Pastikan flagSelect tidak disabled agar bisa diubah
    flagSelect.disabled = false;
    
    // Set nilai status setelah flag
    if (currentStatus) {
        statusSelect.value = currentStatus;
    } else {
        statusSelect.value = 'Open';
    }
    
    // Jika sudah ditolak dan status adalah Cancelled, nonaktifkan status select
    // dan hanya izinkan nilai Cancelled
    if (isRejected && currentStatus === 'Cancelled') {
        statusSelect.disabled = true;
        statusSelect.value = 'Cancelled';
        // Hapus semua opsi kecuali Cancelled
        const options = statusSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value !== 'Cancelled') {
                option.style.display = 'none';
            }
        });
    } else {
        statusSelect.disabled = false;
        // Tampilkan semua opsi kembali
        const options = statusSelect.querySelectorAll('option');
        options.forEach(option => {
            option.style.display = '';
        });
    }
    
    if (currentPetugas) {
        petugasSelect.value = currentPetugas;
    } else {
        petugasSelect.value = '';
    }
    
    if (currentKeterangan) {
        keteranganInput.value = currentKeterangan;
    } else {
        keteranganInput.value = '';
    }
    
    currentDetailRow = row;
    
    function toggleDropdowns() {
        // User hanya bisa melihat, tidak bisa edit apapun
        if (isUser) {
            return; // Jangan tampilkan apapun untuk user
        }
        
        const selectedStatus = statusSelect.value;
        const selectedFlag = flagSelect.value;
        const isClosedOrCancelled = selectedStatus === 'Closed' || selectedStatus === 'Cancelled';
        
        // Cek apakah flag yang dipilih memerlukan persetujuan
        const selectedFlagNeedsApproval = selectedFlag && 
                                          (selectedFlag.toLowerCase() === 'kuning' || selectedFlag.toLowerCase() === 'merah') && 
                                          !isApproved && !isRejected;
        
        if (isCompleted) {
            statusSection.style.display = 'none';
            flagSection.style.display = 'none';
            petugasSection.style.display = 'none';
            keteranganSection.style.display = 'none';
            whatsappSection.style.display = 'none';
            saveBtn.style.display = 'none';
            saveFlagBtn.style.display = 'none';
        } else {
            // Selalu tampilkan flag section terlebih dahulu
            flagSection.style.display = 'flex';
            
            // Jika belum ada flag yang dipilih, sembunyikan semua field lainnya
            if (!selectedFlag || selectedFlag.trim() === '') {
                statusSection.style.display = 'none';
                petugasSection.style.display = 'none';
                keteranganSection.style.display = 'none';
                whatsappSection.style.display = 'none';
                saveBtn.style.display = 'none';
                saveFlagBtn.style.display = 'none';
            }
            // Jika flag sudah dipilih dan berbeda dengan currentFlag (belum disimpan atau diubah), tampilkan button simpan flag
            else if (selectedFlag !== currentFlag) {
                saveFlagBtn.style.display = 'block';
                saveFlagBtn.disabled = false;
                saveFlagBtn.textContent = 'Simpan Flag';
                statusSection.style.display = 'none';
                petugasSection.style.display = 'none';
                keteranganSection.style.display = 'none';
                whatsappSection.style.display = 'none';
                saveBtn.style.display = 'none';
            }
            // Jika flag hijau dan sudah disimpan, langsung bisa pilih status
            else if (selectedFlag.toLowerCase() === 'hijau') {
                saveFlagBtn.style.display = 'none';
                statusSection.style.display = 'flex';
                // Jika status sudah Closed/Cancelled, tampilkan petugas dan keterangan
                if (isClosedOrCancelled) {
                    petugasSection.style.display = 'flex';
                    keteranganSection.style.display = 'flex';
                    whatsappSection.style.display = 'none';
                    saveBtn.style.display = 'block';
                } else {
                    petugasSection.style.display = 'none';
                    keteranganSection.style.display = 'none';
                    whatsappSection.style.display = 'none';
                    saveBtn.style.display = 'none';
                }
            }
            // Jika flag kuning/merah dan sudah disetujui, bisa pilih status
            else if (isApproved || isRejected) {
                saveFlagBtn.style.display = 'none';
                statusSection.style.display = 'flex';
                // Jika status sudah Closed/Cancelled, tampilkan petugas dan keterangan
                if (isClosedOrCancelled) {
                    petugasSection.style.display = 'flex';
                    keteranganSection.style.display = 'flex';
                    whatsappSection.style.display = 'none';
                    saveBtn.style.display = 'block';
                } else {
                    petugasSection.style.display = 'none';
                    keteranganSection.style.display = 'none';
                    whatsappSection.style.display = 'none';
                    saveBtn.style.display = 'none';
                }
            }
            // Jika flag kuning/merah dan belum disetujui, tampilkan button WhatsApp (belum bisa pilih status)
            else if (selectedFlagNeedsApproval || needsApproval) {
                saveFlagBtn.style.display = 'none';
                statusSection.style.display = 'none';
                petugasSection.style.display = 'none';
                keteranganSection.style.display = 'none';
                whatsappSection.style.display = 'flex';
                saveBtn.style.display = 'none';
            }
            // Default: tampilkan status section
            else {
                saveFlagBtn.style.display = 'none';
                statusSection.style.display = 'flex';
                if (isClosedOrCancelled) {
                    petugasSection.style.display = 'flex';
                    keteranganSection.style.display = 'flex';
                    whatsappSection.style.display = 'none';
                    saveBtn.style.display = 'block';
                } else {
                    petugasSection.style.display = 'none';
                    keteranganSection.style.display = 'none';
                    whatsappSection.style.display = 'none';
                    saveBtn.style.display = 'none';
                }
            }
        }
    }
    
    function checkChanges() {
        if (isCompleted) {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
            return;
        }
        
        const selectedStatus = statusSelect.value;
        const selectedFlag = flagSelect.value;
        const selectedPetugas = petugasSelect.value;
        const selectedKeterangan = keteranganInput.value.trim();
        
        // Jika sudah ditolak dan status adalah Cancelled, status tidak bisa diubah
        // Tapi tetap bisa simpan field lain (petugas, keterangan, waktu selesai, flag)
        if (isRejected && currentStatus === 'Cancelled' && selectedStatus !== 'Cancelled') {
            statusSelect.value = 'Cancelled';
            // Jangan disable save button, tetap izinkan simpan field lain
            // Hanya reset status ke Cancelled
        }
        
        const statusChanged = selectedStatus !== currentStatus;
        const flagChanged = selectedFlag !== currentFlag;
        const petugasChanged = selectedPetugas !== currentPetugas;
        const keteranganChanged = selectedKeterangan !== currentKeterangan;
        
        const isClosedOrCancelled = selectedStatus === 'Closed' || selectedStatus === 'Cancelled';
        
        // Jika sudah ditolak (Cancelled), tetap izinkan simpan field lain tanpa validasi flag yang ketat
        if (isRejected && currentStatus === 'Cancelled') {
            // Cek apakah ada perubahan pada field yang bisa disimpan
            let hasChanges = false;
            if (petugasChanged || keteranganChanged || flagChanged) {
                hasChanges = true;
            }
            // Cek juga waktu selesai jika ada input
            const waktuSelesaiInput = detailContent.querySelector('input[data-field="Waktu Selesai"]');
            if (waktuSelesaiInput) {
                const selectedWaktuSelesai = waktuSelesaiInput.value;
                const currentWaktuSelesaiValue = currentWaktuSelesai || '';
                const waktuSelesaiChanged = selectedWaktuSelesai !== currentWaktuSelesaiValue;
                if (waktuSelesaiChanged) {
                    hasChanges = true;
                }
            }
            
            if (hasChanges) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('disabled');
            } else {
                saveBtn.disabled = true;
                saveBtn.classList.add('disabled');
            }
            return; // Early return untuk yang sudah ditolak
        }
        
        // Validasi normal untuk yang belum ditolak
        // Validasi: flag harus dipilih terlebih dahulu
        if (!selectedFlag || selectedFlag.trim() === '') {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
            return;
        }
        
        // Untuk kuning/merah, harus sudah disetujui dulu
        if ((selectedFlag.toLowerCase() === 'kuning' || selectedFlag.toLowerCase() === 'merah') && 
            !isApproved && !isRejected) {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
            return;
        }
        
        let hasChanges = false;
        
        if (flagChanged) {
            hasChanges = true;
        }
        
        if (isClosedOrCancelled) {
            if (statusChanged || petugasChanged || keteranganChanged) {
                hasChanges = true;
            }
            if (!currentWaktuSelesai) {
                hasChanges = true;
            }
            
            if (!selectedPetugas || selectedPetugas.trim() === '') {
                saveBtn.disabled = true;
                saveBtn.classList.add('disabled');
                return;
            }
        }
        
        if (hasChanges) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
        } else {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
        }
    }
    
    flagSelect.onchange = () => {
        const selectedFlag = flagSelect.value;
        
        // Jika flag berubah dari yang sudah disimpan, reset status ke Open (kecuali sudah completed)
        if (selectedFlag !== currentFlag && !isCompleted) {
            statusSelect.value = 'Open';
        }
        
        // Reset status jika flag berubah menjadi kuning/merah dan belum disetujui
        if (selectedFlag && (selectedFlag.toLowerCase() === 'kuning' || selectedFlag.toLowerCase() === 'merah')) {
            if (!isApproved && !isRejected) {
                // Jika belum disetujui, reset status ke Open
                statusSelect.value = 'Open';
            }
        }
        
        toggleDropdowns();
        checkChanges();
    };
    
    // Setup button simpan flag
    saveFlagBtn.onclick = async () => {
        if (saveFlagBtn.disabled) return;
        
        const selectedFlag = flagSelect.value;
        
        if (!selectedFlag || selectedFlag.trim() === '') {
            showNotification('Pilih flag terlebih dahulu', 'error');
            return;
        }
        
        try {
            saveFlagBtn.disabled = true;
            saveFlagBtn.textContent = 'Menyimpan...';
            
            const rowNumberToUpdate = row.originalRowNumber || row.rowNumber;
            const updateData = {
                flag: selectedFlag
            };
            
            await batchUpdate(rowNumberToUpdate, updateData);
            
            // Update currentFlag di row
            row.flag = selectedFlag;
            currentFlag = selectedFlag;
            
            // Update di allData
            const rowIndex = allData.findIndex(r => r.id === row.id);
            if (rowIndex !== -1) {
                allData[rowIndex].flag = selectedFlag;
            }
            
            // Refresh tampilan
            filterAndDisplayData();
            
            showNotification('Flag berhasil disimpan!', 'success');
            
            // Update currentFlag di scope showDetail agar button simpan flag bisa muncul lagi jika diubah
            // Jangan refresh popup, biarkan user bisa langsung mengubah flag lagi jika mau
            // Hanya update tampilan tanpa refresh popup
            currentFlag = selectedFlag;
            row.flag = selectedFlag;
            
            // Update toggleDropdowns untuk refresh tampilan
            toggleDropdowns();
            checkChanges();
            
            // Reset button simpan flag
            saveFlagBtn.disabled = false;
            saveFlagBtn.textContent = 'Simpan Flag';
            
        } catch (error) {
            console.error('Error saving flag:', error);
            saveFlagBtn.disabled = false;
            saveFlagBtn.textContent = 'Simpan Flag';
            showNotification('Error: ' + error.message, 'error');
        }
    };
    
    statusSelect.onchange = () => {
        // Jika sudah ditolak dan status adalah Cancelled, kembalikan ke Cancelled
        if (isRejected && currentStatus === 'Cancelled') {
            statusSelect.value = 'Cancelled';
            return;
        }
        
        const selectedStatus = statusSelect.value;
        const isClosedOrCancelled = selectedStatus === 'Closed' || selectedStatus === 'Cancelled';
        
        if (isClosedOrCancelled) {
            if (!currentFlag) {
                flagSelect.value = '';
            }
            if (!currentPetugas) {
                petugasSelect.value = '';
            }
            if (!currentKeterangan) {
                keteranganInput.value = '';
            }
        }
        
        toggleDropdowns();
        checkChanges();
    };
    
    petugasSelect.onchange = checkChanges;
    keteranganInput.oninput = checkChanges;
    
    // Setup WhatsApp button
    whatsappBtn.onclick = () => {
        const selectedFlag = flagSelect.value;
        if (!selectedFlag || (selectedFlag.toLowerCase() !== 'kuning' && selectedFlag.toLowerCase() !== 'merah')) {
            return;
        }
        
        // Generate approval link using rowNumber instead of id (hanya 1 link)
        // Deteksi domain untuk link approval
        let baseUrl;
        if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('protopermintaan.vercel.app')) {
            baseUrl = 'https://protopermintaan.vercel.app/permintaan/';
        } else {
            baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
        }
        const rowNumber = row.originalRowNumber || row.rowNumber;
        const approvalUrl = `${baseUrl}approval.html?rowId=${rowNumber}`;
        
        // Build message template
        let message = `*Permintaan Persetujuan*\n\n`;
        message += `Detail Permintaan:\n`;
        
        // Find alasan permintaan field - gunakan yang sudah disimpan atau cari dari original row
        let alasanPermintaan = '';
        
        // Prioritas 1: Gunakan yang sudah disimpan di row.alasanPermintaan
        if (row.alasanPermintaan && row.alasanPermintaan.trim() !== '') {
            alasanPermintaan = row.alasanPermintaan.trim();
        }
        
        // Prioritas 2: Jika tidak ada, cari dari original row menggunakan findColumnValue
        if (!alasanPermintaan && row._originalRow) {
            const originalRow = row._originalRow;
            const alasanKeys = [
                'Alasan Permintaan/Permintaan',
                'ALASAN PERMINTAAN/PERMINTAAN',
                'Alasan Permintaan',
                'ALASAN PERMINTAAN'
            ];
            
            for (const key of alasanKeys) {
                const value = findColumnValue(originalRow, key);
                if (value && value.trim() !== '') {
                    alasanPermintaan = value.trim();
                    break;
                }
            }
        }
        
        // Prioritas 3: Jika masih tidak ditemukan, cari di spreadsheetHeaders
        if (!alasanPermintaan || alasanPermintaan.trim() === '') {
            for (let i = 0; i < spreadsheetHeaders.length; i++) {
                const header = spreadsheetHeaders[i];
                if (header) {
                    const headerLower = header.toLowerCase().trim();
                    // Pastikan header mengandung BOTH "alasan" DAN "permintaan"
                    // Dan bukan field lain seperti "Unit Kerja" atau "Status Surat"
                    if (headerLower.includes('alasan') && 
                        headerLower.includes('permintaan') &&
                        !headerLower.includes('unit') &&
                        !headerLower.includes('kerja') &&
                        !headerLower.includes('status') &&
                        !headerLower.includes('surat')) {
                        const colLetter = String.fromCharCode(65 + i);
                        const value = row[colLetter] || '';
                        if (value && value.trim() !== '') {
                            alasanPermintaan = value.trim();
                            break;
                        }
                    }
                }
            }
        }
        
        // Find nomor surat - cari dari kolom yang benar
        let nomorSurat = '';
        
        // Prioritas 1: Cari dari original row menggunakan findColumnValue
        if (row._originalRow) {
            const originalRow = row._originalRow;
            const suratKeys = [
                'NO SURAT',
                'No. Surat',
                'Nomor Surat',
                'NO. SURAT',
                'NOMOR SURAT'
            ];
            
            for (const key of suratKeys) {
                const value = findColumnValue(originalRow, key);
                if (value && value.trim() !== '') {
                    nomorSurat = value.trim();
                    break;
                }
            }
        }
        
        // Prioritas 2: Cari dari spreadsheetHeaders
        if (!nomorSurat || nomorSurat.trim() === '') {
            for (let i = 0; i < spreadsheetHeaders.length; i++) {
                const header = spreadsheetHeaders[i];
                if (header) {
                    const headerLower = header.toLowerCase().trim();
                    // Cari header yang mengandung "surat" tapi bukan "status surat" atau "jenis surat"
                    if (headerLower.includes('surat') && 
                        (headerLower.includes('no') || headerLower.includes('nomor')) &&
                        !headerLower.includes('status') &&
                        !headerLower.includes('jenis') &&
                        !headerLower.includes('backdate')) {
                        const colLetter = String.fromCharCode(65 + i);
                        const value = row[colLetter] || '';
                        if (value && value.trim() !== '') {
                            // Pastikan bukan timestamp (format ISO date)
                            if (!value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                                nomorSurat = value.trim();
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        // Add key details
        if (nomorSurat) message += `No. Surat: ${nomorSurat}\n`;
        if (dataName) message += `Nama: ${dataName}\n`;
        if (row.pilihPermintaan) message += `Jenis Permintaan: ${row.pilihPermintaan}\n`;
        if (alasanPermintaan) message += `Alasan: ${alasanPermintaan}\n`;
        
        message += `\nFlag: ${selectedFlag}\n`;
        message += `Status: ${statusSelect.value}\n\n`;
        
        message += `*Link Persetujuan:*\n`;
        message += `${approvalUrl}\n\n`;
        message += `Klik link di atas untuk menyetujui atau menolak permintaan ini.`;
        
        // Encode message for WhatsApp
        const encodedMessage = encodeURIComponent(message);
        const whatsappNumber = '6282154549026';
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        
        // Open WhatsApp
        window.open(whatsappUrl, '_blank');
    };
    
    // Setup button hubungi petugas untuk user (hanya jika status belum selesai)
    if (isUser) {
        // Sembunyikan semua aksi/edit
        if (flagSection) flagSection.style.display = 'none';
        if (statusSection) statusSection.style.display = 'none';
        if (petugasSection) petugasSection.style.display = 'none';
        if (keteranganSection) keteranganSection.style.display = 'none';
        if (whatsappSection) whatsappSection.style.display = 'none';
        if (editModeBtn) editModeBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (saveFlagBtn) saveFlagBtn.style.display = 'none';
        
        // Tampilkan button hubungi petugas hanya jika status belum selesai
        const isNotCompleted = currentStatus !== 'Closed' && currentStatus !== 'Cancelled';
        if (isNotCompleted && currentPetugas && chatUlangBtn && chatUlangSection) {
            setupHubungiPetugasButton(row, currentPetugas, dataName, chatUlangBtn, chatUlangSection, originalRow, currentStatus, currentFlag, currentKeterangan);
        } else {
            if (chatUlangSection) chatUlangSection.style.display = 'none';
        }
    } else {
        // Untuk admin/super_admin, sembunyikan tombol chat ulang petugas
        if (chatUlangSection) chatUlangSection.style.display = 'none';
    }
    
    toggleDropdowns();
    checkChanges();
    
    saveBtn.onclick = async () => {
        if (saveBtn.disabled) return;
        
        // Jika sudah ditolak dan status adalah Cancelled, cek apakah user mencoba ubah status
        // Jika hanya mengubah field lain (petugas, keterangan, waktu selesai, flag), izinkan
        if (isRejected && currentStatus === 'Cancelled') {
            const selectedStatus = statusSelect.value;
            // Hanya blokir jika user mencoba ubah status dari Cancelled
            if (selectedStatus !== 'Cancelled') {
                statusSelect.value = 'Cancelled';
                showNotification('Status tidak dapat diubah karena permintaan sudah ditolak. Field lain tetap bisa disimpan.', 'error');
                // Jangan return, tetap izinkan simpan field lain
            }
            // Jika status tetap Cancelled, izinkan simpan field lain
        }
        
        const newStatus = statusSelect.value;
        const newFlag = flagSelect.value;
        const newPetugas = petugasSelect.value;
        const newKeterangan = keteranganInput.value.trim();
        
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Menyimpan...';
            
            const rowNumberToUpdate = row.originalRowNumber || row.rowNumber;
            const isClosedOrCancelled = newStatus === 'Closed' || newStatus === 'Cancelled';
            
            const updateData = {};
            
            // Jika sudah ditolak (Cancelled), tetap izinkan simpan field lain
            if (isRejected && currentStatus === 'Cancelled') {
                // Jangan ubah status, tetap Cancelled
                // Tapi izinkan simpan field lain
                if (newFlag !== currentFlag) {
                    updateData.flag = newFlag;
                }
                
                if (newPetugas !== currentPetugas) {
                    updateData.petugas = newPetugas;
                }
                
                if (newKeterangan !== currentKeterangan) {
                    updateData.keterangan = newKeterangan;
                }
                
                // Cek waktu selesai
                const waktuSelesaiInput = detailContent.querySelector('input[data-field="Waktu Selesai"]');
                if (waktuSelesaiInput) {
                    const newWaktuSelesai = waktuSelesaiInput.value;
                    if (newWaktuSelesai && newWaktuSelesai.trim() !== '') {
                        updateData.waktuSelesai = newWaktuSelesai;
                    } else if (currentWaktuSelesai && !newWaktuSelesai) {
                        // User ingin clear waktu selesai
                        updateData.waktuSelesai = '';
                    }
                } else if (!currentWaktuSelesai) {
                    // Auto set waktu selesai jika belum ada
                    updateData.waktuSelesai = new Date().toISOString();
                }
            } else {
                // Normal flow untuk yang belum ditolak
                if (newStatus !== currentStatus) {
                    updateData.status = newStatus;
                }
                
                if (isClosedOrCancelled) {
                    if (newFlag !== currentFlag) {
                        updateData.flag = newFlag;
                    }
                    
                    if (newPetugas !== currentPetugas) {
                        updateData.petugas = newPetugas;
                    }
                    
                    if (newKeterangan !== currentKeterangan) {
                        updateData.keterangan = newKeterangan;
                    }
                    
                    if (!currentWaktuSelesai) {
                        updateData.waktuSelesai = new Date().toISOString();
                    }
                }
                
                // Jika ditolak (rejected), set status menjadi Cancelled
                if (isRejected) {
                    updateData.status = 'Cancelled';
                }
            }
            
            if (Object.keys(updateData).length === 0) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Simpan';
                return;
            }
            
            await batchUpdate(rowNumberToUpdate, updateData);
            
            row.status = newStatus || row.status;
            row.flag = newFlag || row.flag;
            row.petugas = newPetugas || row.petugas;
            row.keterangan = newKeterangan || row.keterangan;
            if (updateData.waktuSelesai) {
                row.waktuSelesai = updateData.waktuSelesai;
            }
            
            const rowIndex = allData.findIndex(r => r.id === row.id);
            if (rowIndex !== -1) {
                allData[rowIndex] = { ...allData[rowIndex], ...row };
            }
            
            filterAndDisplayData();
            
            showNotification('Data berhasil diupdate!', 'success');
            setTimeout(() => {
                closePopup();
            }, 500);
        } catch (error) {
            console.error('Error saving:', error);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Simpan';
            showNotification('Error: ' + error.message, 'error');
        }
    };

    // Setup edit mode button - hanya untuk super admin
    // editModeBtn sudah dideklarasikan di atas
    let isEditMode = false;
    let originalData = null;
    let saveEditBtn = null;
    
    if (editModeBtn) {
        // Cek apakah user adalah super admin
        if (isSuperAdmin()) {
            editModeBtn.style.display = 'block';
            editModeBtn.textContent = 'Edit';
            editModeBtn.classList.remove('cancel-btn');
        } else {
            // Sembunyikan tombol Edit untuk non-super admin
            editModeBtn.style.display = 'none';
        }
    }
    
    function enterEditMode() {
        if (!editModeBtn) return;
        // Cek permission - hanya super admin yang bisa edit
        if (!isSuperAdmin()) {
            alert('Akses ditolak. Hanya Super Admin yang dapat mengedit data.');
            return;
        }
        isEditMode = true;
        editModeBtn.textContent = 'Batal';
        editModeBtn.classList.add('cancel-btn');
        originalData = { ...row };
        // Ensure Status Surat is stored in originalData
        if (row.G) {
            originalData.G = row.G;
        }
        
        // Hide status-flag-container and show save edit button
        const statusFlagContainer = document.querySelector('.status-flag-container');
        if (statusFlagContainer) {
            statusFlagContainer.style.display = 'none';
        }
        
        // Convert all detail items to input fields
        const detailItems = detailContent.querySelectorAll('.detail-item');
        detailItems.forEach(item => {
            const label = item.querySelector('label');
            const valueDiv = item.querySelector('.value');
            if (!label || !valueDiv) return;
            
            const fieldName = label.textContent.trim();
            let currentValue = '';
            
            // Get value based on field type
            if (fieldName === 'Status') {
                currentValue = (row.status || '').trim();
            } else if (fieldName === 'Flag') {
                currentValue = (row.flag || '').trim();
            } else if (fieldName === 'Petugas') {
                currentValue = (row.petugas || '').trim();
            } else if (fieldName === 'Keterangan') {
                currentValue = (row.keterangan || '').trim();
            } else if (fieldName === 'Persetujuan') {
                currentValue = (row.persetujuan || '').trim();
            } else if (fieldName === 'Waktu Selesai') {
                currentValue = (row.waktuSelesai || '').trim();
            } else if (fieldName === 'Status Surat') {
                // Get from originalRow first (which has proper field names from API)
                currentValue = (row._originalRow?.['Status Surat'] || 
                                row.G || 
                                '').trim();
                if (!currentValue || currentValue === '') {
                    // Try to get from valueDiv as fallback
                    currentValue = valueDiv.textContent.trim();
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = currentValue;
                    currentValue = (tempDiv.textContent || tempDiv.innerText || '').trim();
                }
            } else {
                // For other fields, try originalRow first, then valueDiv
                if (row._originalRow && row._originalRow[fieldName]) {
                    currentValue = (row._originalRow[fieldName] || '').trim();
                } else {
                    // Fallback to valueDiv
                    currentValue = valueDiv.textContent.trim();
                    // Remove HTML tags if any
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = currentValue;
                    currentValue = tempDiv.textContent || tempDiv.innerText || '';
                }
            }
            
            // Create appropriate input based on field type
            let input;
            
            if (fieldName === 'Status') {
                // Create select for Status
                input = document.createElement('select');
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
                
                const options = ['Open', 'Closed', 'Cancelled'];
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (opt === currentValue || currentValue.includes(opt)) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (fieldName === 'Flag') {
                // Create select for Flag
                input = document.createElement('select');
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
                
                const options = ['', 'Hijau', 'Kuning', 'Merah'];
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt || '-';
                    if (opt === currentValue || currentValue.includes(opt)) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (fieldName === 'Petugas') {
                // Create select for Petugas (with predefined options)
                input = document.createElement('select');
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
                
                const options = ['', 'Jalal', 'Bayu', 'Ilma'];
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt || '-';
                    if (opt === currentValue || currentValue.includes(opt)) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (fieldName === 'Persetujuan') {
                // Create select for Persetujuan
                input = document.createElement('select');
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
                
                const options = ['', 'Disetujui', 'Ditolak'];
                // Check if current value contains approval/rejection keywords
                const currentValueLower = currentValue.toLowerCase();
                const isApproved = currentValueLower.includes('disetujui') || 
                                  currentValueLower.includes('approved') ||
                                  currentValueLower.includes('setuju');
                const isRejected = currentValueLower.includes('ditolak') || 
                                  currentValueLower.includes('rejected') ||
                                  currentValueLower.includes('tidak setuju');
                
                let selectedValue = '';
                if (isApproved) {
                    selectedValue = 'Disetujui';
                } else if (isRejected) {
                    selectedValue = 'Ditolak';
                }
                
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt || '-';
                    if (opt === selectedValue) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (fieldName === 'Status Surat') {
                // Create select for Status Surat (opsi berbeda dari Status)
                input = document.createElement('select');
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
                
                // Status Surat options: Draft, Review, Approved, Rejected
                const options = ['Draft', 'Review', 'Approved', 'Rejected'];
                const currentValueLower = (currentValue || '').toLowerCase().trim();
                
                // Mapping untuk backward compatibility dengan nilai lama
                let mappedValue = currentValueLower;
                if (currentValueLower === 'open') {
                    mappedValue = 'draft';
                } else if (currentValueLower === 'closed') {
                    mappedValue = 'approved';
                } else if (currentValueLower === 'cancelled') {
                    mappedValue = 'rejected';
                }
                
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (opt.toLowerCase() === mappedValue || opt.toLowerCase() === currentValueLower) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
                
                // Set default to first option if no match found
                if (!options.some(opt => opt.toLowerCase() === mappedValue || opt.toLowerCase() === currentValueLower)) {
                    input.selectedIndex = 0; // Default to 'Draft'
                }
            } else if (fieldName === 'Keterangan') {
                // Create textarea for Keterangan
                input = document.createElement('textarea');
                input.value = currentValue;
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
            } else if (fieldName === 'Waktu Selesai') {
                // Create datetime-local input for timestamp
                input = document.createElement('input');
                input.type = 'datetime-local';
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
                
                // Convert current value to datetime-local format
                if (currentValue) {
                    try {
                        const date = new Date(currentValue);
                        if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                        } else {
                            input.value = currentValue;
                        }
                    } catch (e) {
                        input.value = currentValue;
                    }
                }
            } else {
                // Create regular text input for other fields
                input = document.createElement('input');
                input.type = 'text';
                input.value = currentValue;
                input.className = 'edit-input';
                input.setAttribute('data-field', fieldName);
                
                // Set specific input types based on field name
                if (fieldName && fieldName.toLowerCase().includes('email')) {
                    input.type = 'email';
                } else if (fieldName && (fieldName.toLowerCase().includes('telepon') || 
                          fieldName.toLowerCase().includes('hp') ||
                          fieldName.toLowerCase().includes('phone'))) {
                    input.type = 'tel';
                }
            }
            
            valueDiv.innerHTML = '';
            valueDiv.appendChild(input);
            
            // Add editing class to detail item for better styling
            item.classList.add('editing');
        });
        
        // Show save button at the bottom - make it sticky
        if (!saveEditBtn) {
            saveEditBtn = document.createElement('button');
            saveEditBtn.textContent = '💾 Simpan Perubahan';
            saveEditBtn.className = 'save-status-btn save-edit-sticky';
            saveEditBtn.id = 'saveEditStickyBtn';
            saveEditBtn.onclick = saveEditMode;
            detailContent.appendChild(saveEditBtn);
        } else {
            saveEditBtn.style.display = 'block';
        }
    }
    
    function exitEditMode() {
        if (!editModeBtn) return;
        isEditMode = false;
        editModeBtn.textContent = 'Edit';
        editModeBtn.classList.remove('cancel-btn');
        if (saveEditBtn) saveEditBtn.style.display = 'none';
        
        // Remove editing class from all detail items
        const detailItems = detailContent.querySelectorAll('.detail-item');
        detailItems.forEach(item => {
            item.classList.remove('editing');
        });
        
        // Show status-flag-container again
        const statusFlagContainer = document.querySelector('.status-flag-container');
        if (statusFlagContainer) {
            statusFlagContainer.style.display = '';
        }
        
        // Restore original display
        showDetail(rowId);
    }
    
    if (editModeBtn) {
        editModeBtn.onclick = () => {
            if (!isEditMode) {
                enterEditMode();
            } else {
                exitEditMode();
            }
        };
    }
    
    async function saveEditMode() {
        // Cek permission - hanya super admin yang bisa save edit
        if (!isSuperAdmin()) {
            alert('Akses ditolak. Hanya Super Admin yang dapat menyimpan perubahan.');
            return;
        }
        if (!isEditMode) return;
        
        const inputs = detailContent.querySelectorAll('.edit-input');
        const updates = {};
        
        inputs.forEach(input => {
            const fieldName = input.getAttribute('data-field');
            let inputValue;
            
            // Get value based on input type
            if (input.tagName === 'SELECT') {
                inputValue = input.value; // Don't trim select values, empty string is valid
            } else if (input.tagName === 'TEXTAREA') {
                inputValue = input.value.trim();
            } else if (input.type === 'datetime-local') {
                inputValue = input.value; // Don't trim datetime, empty is valid
                // Allow empty waktu_selesai to set it to NULL
                // We'll send a special marker to indicate we want to clear it
                if (!inputValue || inputValue.trim() === '') {
                    // Send empty string to clear the value
                    inputValue = '';
                }
            } else {
                inputValue = input.value.trim();
            }
            
            // Get old value for comparison
            let oldValue = '';
            if (fieldName === 'Status') {
                oldValue = (row.status || '').trim();
            } else if (fieldName === 'Flag') {
                oldValue = (row.flag || '').trim();
            } else if (fieldName === 'Petugas') {
                oldValue = (row.petugas || '').trim();
            } else if (fieldName === 'Keterangan') {
                oldValue = (row.keterangan || '').trim();
            } else if (fieldName === 'Status Surat') {
                // Get old value from row.G (column G) or from originalData
                // Also try to get from _originalRow if available
                oldValue = (row.G || originalData?.G || row._originalRow?.['Status Surat'] || row._originalRow?.G || '').trim();
            } else if (fieldName === 'Persetujuan') {
                // For Persetujuan, compare with normalized value
                const currentPersetujuan = (row.persetujuan || '').trim();
                const isApproved = currentPersetujuan.toLowerCase().includes('disetujui') || 
                                  currentPersetujuan.toLowerCase().includes('approved') ||
                                  currentPersetujuan.toLowerCase().includes('setuju');
                const isRejected = currentPersetujuan.toLowerCase().includes('ditolak') || 
                                  currentPersetujuan.toLowerCase().includes('rejected') ||
                                  currentPersetujuan.toLowerCase().includes('tidak setuju');
                
                if (inputValue === 'Disetujui' && isApproved) {
                    return; // No change
                } else if (inputValue === 'Ditolak' && isRejected) {
                    return; // No change
                } else if (inputValue === '' && !isApproved && !isRejected) {
                    return; // No change
                }
                oldValue = currentPersetujuan;
            } else if (fieldName === 'Waktu Selesai') {
                oldValue = (row.waktuSelesai || '').trim();
                // If user clears the datetime field, we want to update it to NULL
                // So we should always include it in updates if it's being edited
                if (!inputValue || inputValue.trim() === '') {
                    // User wants to clear the value
                    updates[fieldName] = '';
                    return; // Skip comparison, we want to update
                }
            } else {
                // Try to get from originalRow first (which has proper field names)
                if (row._originalRow && row._originalRow[fieldName]) {
                    oldValue = (row._originalRow[fieldName] || '').trim();
                } else {
                    // Fallback to column letter mapping
                    oldValue = originalData[getColumnLetterForField(fieldName)] || '';
                }
            }
            
            // For Persetujuan, always update if dropdown value changed
            if (fieldName === 'Persetujuan') {
                updates[fieldName] = inputValue;
            } else if (fieldName === 'Status Surat') {
                // Always update Status Surat if user selected a value
                // Even if it's the same, we want to ensure it's saved
                if (inputValue && inputValue.trim() !== '') {
                    updates['Status Surat'] = inputValue; // Explicitly use 'Status Surat' as key
                    console.log('Adding Status Surat to updates:', inputValue);
                }
            } else if (inputValue !== oldValue) {
                updates[fieldName] = inputValue;
            }
        });
        
        if (Object.keys(updates).length === 0) {
            alert('Tidak ada perubahan yang disimpan.');
            return;
        }
        
        if (!confirm(`Simpan ${Object.keys(updates).length} perubahan?`)) {
            return;
        }
        
        try {
            // Get row number before update
            const rowNumberToUpdate = row.originalRowNumber || row.rowNumber;
            console.log('Updating with rowNumber:', rowNumberToUpdate, 'rowId:', rowId);
            console.log('Updates to send:', updates);
            
            // Save updates via API
            await savePermintaanEdits(rowNumberToUpdate, updates);
            showNotification('Data berhasil diupdate!', 'success');
            
            // Close edit mode first
            isEditMode = false;
            if (editModeBtn) editModeBtn.textContent = '✏️ Edit';
            if (saveEditBtn) saveEditBtn.style.display = 'none';
            
            // Reload data to get fresh data from server
            await loadData();
            
            // Wait a bit for data to be fully loaded
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Find the updated row by rowNumber (not by id, because id might change after reload)
            const updatedRow = allData.find(r => {
                const rn = parseInt(r.originalRowNumber || r.rowNumber, 10);
                const targetRn = parseInt(rowNumberToUpdate, 10);
                return rn === targetRn;
            });
            
            if (updatedRow) {
                // Re-open detail view with updated data
                console.log('Reopening detail for updated row:', updatedRow);
                console.log('Updated row.G (Status Surat):', updatedRow.G);
                // Force close and reopen to ensure fresh data
                closePopup(); // Use proper close function to reset overflow
                // Small delay before reopening
                setTimeout(() => {
                    showDetail(updatedRow.id);
                }, 200);
            } else {
                // If row not found, try to find by original rowId
                const rowById = allData.find(r => r.id === rowId);
                if (rowById) {
                    closePopup(); // Use proper close function
                    setTimeout(() => {
                        showDetail(rowById.id);
                    }, 200);
                } else {
                    // If still not found, just close the popup
                    closePopup();
                }
            }
        } catch (error) {
            console.error('Error saving:', error);
            showNotification('Error: ' + error.message, 'error');
        }
    }
    
    function getColumnLetterForField(fieldName) {
        for (let i = 0; i < spreadsheetHeaders.length; i++) {
            if (spreadsheetHeaders[i] === fieldName) {
                return String.fromCharCode(65 + i);
            }
        }
        return null;
    }
    
    async function savePermintaanEdits(rowNumber, updates) {
        // Map field names to database columns (menggunakan kolom yang jelas)
        const fieldToColMap = {
            'Timestamp': 'timestamp_data',
            'NPK': 'npk',
            'Nama Lengkap': 'nama_lengkap',
            'Unit Kerja :': 'unit_kerja',
            'No Telepon (HP)': 'no_telepon',
            'No Surat': 'no_surat',
            'Pilih Permintaan': 'pilih_permintaan',
            'Status Surat': 'status_surat',
            'Alasan Permintaan/Permintaan': 'alasan_permintaan',
            'Email Address': 'email_address',
            'Jenis Surat': 'jenis_surat',
            'Isi Penjelasan Singkat Permintaanya': 'isi_penjelasan',
            'Status': 'status',
            'Flag': 'flag',
            'Petugas': 'petugas',
            'Keterangan': 'keterangan',
            'Persetujuan': 'persetujuan',
            'Waktu Selesai': 'waktu_selesai'
        };
        
        const updateParams = {};
        Object.entries(updates).forEach(([fieldName, fieldValue]) => {
            console.log('Processing update for field:', fieldName, 'value:', fieldValue);
            const colName = fieldToColMap[fieldName];
            if (colName) {
                console.log('Mapped to column:', colName);
                // Convert datetime-local to MySQL format if needed
                if (fieldName === 'Waktu Selesai') {
                    if (fieldValue && fieldValue.trim() !== '') {
                        // datetime-local format: YYYY-MM-DDTHH:mm
                        // Send as-is, PHP will convert it using convertToMySQLDateTime
                        updateParams[colName] = fieldValue;
                    } else {
                        // Send special marker to indicate we want to clear it (set to NULL)
                        updateParams[colName] = '__NULL__';
                    }
                } else {
                    updateParams[colName] = fieldValue;
                }
            }
        });
        
        if (Object.keys(updateParams).length === 0) {
            throw new Error('Tidak ada field yang valid untuk diupdate');
        }
        
        // Debug: log what we're sending
        console.log('Updating rowNumber:', rowNumber);
        console.log('Update params:', updateParams);
        
        // Use existing batchUpdate but with new endpoint for field updates
        const url = new URL(API_URL, window.location.origin);
        url.searchParams.append('action', 'updatePermintaanFields');
        // Ensure rowNumber is an integer
        url.searchParams.append('rowNumber', parseInt(rowNumber, 10));
        
        Object.entries(updateParams).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
        
        console.log('Request URL:', url.toString());
        
        // Get auth token for authentication
        const token = getAuthToken();
        const fetchHeaders = {};
        if (token) {
            fetchHeaders['X-Auth-Token'] = token;
        }
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: fetchHeaders,
            mode: 'cors',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error('HTTP Error: ' + response.status);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Gagal mengupdate data');
        }
        
        return result;
    }
    
    
    const popup = document.getElementById('detailPopup');
    popup.classList.add('show');
    document.body.style.overflow = 'hidden';
}

let currentDetailRow = null;

async function batchUpdate(rowNumber, updateData) {
    if (!rowNumber || isNaN(rowNumber)) {
        throw new Error('RowNumber tidak valid: ' + rowNumber);
    }
    
    const url = new URL(API_URL, window.location.origin);
    url.searchParams.append('action', 'batchUpdate');
    url.searchParams.append('table', 'permintaan');
    url.searchParams.append('rowNumber', rowNumber);
    
    if (updateData.status !== undefined) {
        url.searchParams.append('status', updateData.status);
    }
    if (updateData.flag !== undefined) {
        url.searchParams.append('flag', updateData.flag);
    }
    if (updateData.petugas !== undefined) {
        url.searchParams.append('petugas', updateData.petugas);
    }
    if (updateData.waktuSelesai !== undefined) {
        url.searchParams.append('waktuSelesai', updateData.waktuSelesai);
    }
    if (updateData.keterangan !== undefined) {
        url.searchParams.append('keterangan', updateData.keterangan);
    }
    if (updateData.persetujuan !== undefined) {
        url.searchParams.append('persetujuan', updateData.persetujuan);
    }
    
    const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
    });

    if (!response.ok) {
        throw new Error('HTTP Error: ' + response.status);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Gagal mengupdate data');
    }
    
    return result;
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('popupNotification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = 'popup-notification ' + type;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translate(-50%, -50%)';
    }, 10);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translate(-50%, -50%) translateY(-10px)';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

function closePopup() {
    const popup = document.getElementById('detailPopup');
    popup.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Pagination functions
function applyPagination() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    paginatedData = filteredData.slice(startIndex, endIndex);
}

function getTotalPages() {
    return Math.ceil(filteredData.length / itemsPerPage) || 1;
}

function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    
    currentPage = page;
    applyPagination();
    displayData();
    updatePagination();
    
    // Scroll to top of table
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updatePagination() {
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    
    document.getElementById('paginationStart').textContent = filteredData.length > 0 ? startIndex + 1 : 0;
    document.getElementById('paginationEnd').textContent = endIndex;
    document.getElementById('paginationTotal').textContent = filteredData.length;
    document.getElementById('paginationPageInfo').textContent = `Halaman ${currentPage} dari ${totalPages}`;
    
    const firstBtn = document.getElementById('paginationFirst');
    const prevBtn = document.getElementById('paginationPrev');
    const nextBtn = document.getElementById('paginationNext');
    const lastBtn = document.getElementById('paginationLast');
    
    firstBtn.disabled = currentPage === 1;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    lastBtn.disabled = currentPage === totalPages;
    
    firstBtn.classList.toggle('disabled', currentPage === 1);
    prevBtn.classList.toggle('disabled', currentPage === 1);
    nextBtn.classList.toggle('disabled', currentPage === totalPages);
    lastBtn.classList.toggle('disabled', currentPage === totalPages);
}

// Fungsi untuk setup button hubungi petugas untuk user
function setupHubungiPetugasButton(row, currentPetugas, dataName, chatUlangBtn, chatUlangSection, originalRow, currentStatus, currentFlag, currentKeterangan) {
    // Tampilkan section
    chatUlangSection.style.display = 'flex';
    
    // Update text button
    chatUlangBtn.textContent = '📱 Hubungi Petugas';
    
    // Setup onclick handler
    chatUlangBtn.onclick = async () => {
        // Get petugas no WA from original row
        let targetNoWa = originalRow['Petugas No WA'] || originalRow['petugas_no_wa'] || '';
        
        console.log('Debug - originalRow:', originalRow);
        console.log('Debug - Petugas No WA:', originalRow['Petugas No WA']);
        console.log('Debug - petugas_no_wa:', originalRow['petugas_no_wa']);
        console.log('Debug - currentPetugas:', currentPetugas);
        console.log('Debug - targetNoWa (before API):', targetNoWa);
        
        // If no_wa not available, try to get from petugas name via API
        if (!targetNoWa && currentPetugas) {
            try {
                console.log('Mencoba mengambil data petugas dari API...');
                const response = await fetch(`../api.php?action=getPetugas&nama=${encodeURIComponent(currentPetugas)}`);
                const result = await response.json();
                console.log('API Response:', result);
                if (result && result.success && result.data && result.data.no_wa) {
                    targetNoWa = result.data.no_wa;
                    console.log('Berhasil mendapatkan nomor dari API:', targetNoWa);
                }
            } catch (e) {
                console.error('Error fetching petugas:', e);
            }
        }
        
        console.log('Debug - targetNoWa (final):', targetNoWa);
        
        if (!targetNoWa) {
            alert('Nomor WhatsApp petugas tidak tersedia. Silakan hubungi admin.\n\nPetugas: ' + (currentPetugas || 'Tidak diketahui'));
            return;
        }
        
        // Build message untuk hubungi petugas
        let message = `Halo ${currentPetugas},\n\n`;
        message += `Saya ingin menanyakan progress permintaan saya:\n\n`;
        
        // Add request details
        if (dataName) message += `Nama: ${dataName}\n`;
        if (row.pilihPermintaan) message += `Jenis Permintaan: ${row.pilihPermintaan}\n`;
        
        // Find nomor surat
        let nomorSurat = '';
        const suratKeys = ['NO SURAT', 'No. Surat', 'Nomor Surat', 'NO. SURAT', 'NOMOR SURAT'];
        for (const key of suratKeys) {
            const value = findColumnValue(originalRow, key);
            if (value && value.trim() !== '') {
                nomorSurat = value.trim();
                break;
            }
        }
        if (nomorSurat) message += `No. Surat: ${nomorSurat}\n`;
        
        message += `Status: ${currentStatus || 'Open'}\n`;
        if (currentFlag) message += `Flag: ${currentFlag}\n`;
        if (currentKeterangan) message += `Keterangan: ${currentKeterangan}\n`;
        
        // Tambahkan link detail permintaan
        // Gunakan row.id (index array) untuk membuka detail modal
        const detailId = row.id !== undefined ? row.id : '';
        const detailUrl = `${window.location.origin}${window.location.pathname}?id=${detailId}`;
        message += `\n*Link Detail Permintaan:*\n${detailUrl}\n`;
        
        message += `\nMohon informasi progress terbaru. Terima kasih.`;
        
        // Clean phone number (remove leading 0, add country code 62)
        let cleanPhone = targetNoWa.replace(/^0/, '62');
        cleanPhone = cleanPhone.replace(/\D/g, ''); // Remove non-digits
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
    };
}
