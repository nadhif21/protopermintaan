// Dashboard Statistics Script
let dashboardData = {
    total: 0,
    open: 0,
    closed: 0,
    cancelled: 0,
    recentActivity: []
};

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) {
        return;
    }

    loadDashboardData();
});

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

async function loadDashboardData() {
    try {
        const apiUrl = getApiUrl();
        const path = apiUrl.startsWith('/') ? apiUrl : '/' + apiUrl;
        const fullUrl = window.location.origin + path;
        const token = getAuthToken();
        const fetchHeaders = {};
        if (token) {
            fetchHeaders['X-Auth-Token'] = token;
        }
        
        // Load data from both permintaan and backdate
        const [permintaanResult, backdateResult] = await Promise.all([
            // Load permintaan data
            fetch(`${fullUrl}?action=getData&table=permintaan&_t=${Date.now()}`, {
                method: 'GET',
                headers: fetchHeaders,
                mode: 'cors',
                cache: 'no-cache'
            }).then(res => res.ok ? res.json() : { success: false, data: [] }),
            
            // Load backdate data
            fetch(`${fullUrl}?action=getListPermintaanBackdate&_t=${Date.now()}`, {
                method: 'GET',
                headers: fetchHeaders,
                mode: 'cors',
                cache: 'no-cache'
            }).then(res => res.ok ? res.json() : { success: false, data: [] })
        ]);
        
        // Helper function to find column value
        function findColumnValue(row, columnName) {
            const keys = Object.keys(row);
            const searchName = columnName.toLowerCase().trim();
            
            if (searchName === 'status') {
                let key = keys.find(k => {
                    const kLower = k.toLowerCase().trim();
                    return kLower === 'status' && kLower !== 'status surat';
                });
                if (key) return row[key] || '';
                key = keys.find(k => {
                    const kLower = k.toLowerCase().trim();
                    return kLower.includes(searchName) && !kLower.includes('surat');
                });
                if (key) return row[key] || '';
            }
            
            let key = keys.find(k => k.toLowerCase().trim() === searchName);
            if (key) return row[key] || '';
            
            key = keys.find(k => {
                const kLower = k.toLowerCase();
                return kLower.includes(searchName) && !(searchName === 'status' && kLower.includes('surat'));
            });
            return key ? (row[key] || '') : '';
        }
        
        // Process permintaan data
        let permintaanData = [];
        if (permintaanResult.success && permintaanResult.data) {
            permintaanData = permintaanResult.data || [];
        }
        
        // Process backdate data
        let backdateData = [];
        if (backdateResult.success && backdateResult.data) {
            backdateData = (backdateResult.data || []).map(item => {
                // Transform backdate data to match permintaan format
                return {
                    'ID Permintaan': item.row_number || item.id || '',
                    'Nama Lengkap': item.nama_pegawai_backdate || item.nama_pegawai || item.user_name || '',
                    'Status': item.status || 'Open',
                    'Timestamp': item.created_at || '',
                    'Type': 'backdate'
                };
            });
        }
        
        // Combine both datasets
        const allData = [...permintaanData, ...backdateData];
        const headers = permintaanResult.headers || (permintaanData.length > 0 ? Object.keys(permintaanData[0]) : []);
        
        // Calculate statistics from combined data
        dashboardData.total = allData.length;
        dashboardData.open = allData.filter(row => {
            const status = (findColumnValue(row, 'Status') || row.Status || '').trim().toLowerCase();
            return status === 'open';
        }).length;
        dashboardData.closed = allData.filter(row => {
            const status = (findColumnValue(row, 'Status') || row.Status || '').trim().toLowerCase();
            return status === 'closed' || status === 'approved';
        }).length;
        dashboardData.cancelled = allData.filter(row => {
            const status = (findColumnValue(row, 'Status') || row.Status || '').trim().toLowerCase();
            return status === 'cancelled' || status === 'rejected';
        }).length;

        // Get recent activity (last 5) - sorted by timestamp from both sources
        const sortedData = [...allData].sort((a, b) => {
            const timestampA = findColumnValue(a, 'Timestamp') || a.Timestamp || a.created_at || '';
            const timestampB = findColumnValue(b, 'Timestamp') || b.Timestamp || b.created_at || '';
            const dateA = timestampA ? new Date(timestampA) : new Date(0);
            const dateB = timestampB ? new Date(timestampB) : new Date(0);
            return dateB - dateA;
        });

        const recentData = sortedData.slice(0, 5).map((row, index) => {
            const status = (findColumnValue(row, 'Status') || row.Status || '').trim();
            const nama = findColumnValue(row, 'Nama Lengkap') || 
                        findColumnValue(row, 'NAMA LENGKAP') || 
                        findColumnValue(row, 'Nama') ||
                        row['Nama Lengkap'] ||
                        (headers.length > 1 ? (row[headers[1]] || '') : '') ||
                        'Unknown';
            const idPermintaan = findColumnValue(row, 'ID Permintaan') || 
                                findColumnValue(row, 'ID PERMINTAAN') ||
                                row['ID Permintaan'] ||
                                row.row_number ||
                                (headers.length > 0 ? (row[headers[0]] || '') : '') ||
                                `#${index + 1}`;
            const timestamp = findColumnValue(row, 'Timestamp') || 
                             row.Timestamp || 
                             row.created_at ||
                             findColumnValue(row, 'timestamp') || 
                             '';
            const type = row.Type || (row.row_number ? 'backdate' : 'permintaan');
            
            return {
                id: idPermintaan,
                nama: nama,
                status: status,
                timestamp: timestamp,
                type: type
            };
        });
        
        dashboardData.recentActivity = recentData;
        
        updateDashboard();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Show error in UI
        const activityContainer = document.getElementById('recentActivityList');
        if (activityContainer) {
            activityContainer.innerHTML = '<div class="activity-empty">Gagal memuat data</div>';
        }
    }
}

function updateDashboard() {
    // Update statistics cards
    const totalEl = document.getElementById('statTotal');
    const openEl = document.getElementById('statOpen');
    const closedEl = document.getElementById('statClosed');
    const cancelledEl = document.getElementById('statCancelled');

    if (totalEl) totalEl.textContent = dashboardData.total.toLocaleString('id-ID');
    if (openEl) openEl.textContent = dashboardData.open.toLocaleString('id-ID');
    if (closedEl) closedEl.textContent = dashboardData.closed.toLocaleString('id-ID');
    if (cancelledEl) cancelledEl.textContent = dashboardData.cancelled.toLocaleString('id-ID');

    // Update recent activity
    const activityContainer = document.getElementById('recentActivityList');
    if (activityContainer && dashboardData.recentActivity.length > 0) {
        activityContainer.innerHTML = dashboardData.recentActivity.map(item => {
            const statusClass = getStatusClass(item.status);
            const statusText = getStatusText(item.status);
            const timeAgo = formatTimeAgo(item.timestamp);
            const typeLabel = item.type === 'backdate' ? 'Backdate' : 'Permintaan';
            
            return `
                <div class="activity-item">
                    <div class="activity-icon ${statusClass}">${getStatusIcon(item.status)}</div>
                    <div class="activity-content">
                        <div class="activity-title">${typeLabel} ${item.id}</div>
                        <div class="activity-subtitle">${item.nama}</div>
                        <div class="activity-time">${timeAgo} • <span class="activity-status ${statusClass}">${statusText}</span></div>
                    </div>
                </div>
            `;
        }).join('');
    } else if (activityContainer) {
        activityContainer.innerHTML = '<div class="activity-empty">Tidak ada aktivitas terbaru</div>';
    }
}

function getStatusClass(status) {
    const s = (status || '').trim().toLowerCase();
    if (s === 'open') return 'status-open';
    if (s === 'closed' || s === 'approved') return 'status-closed';
    if (s === 'cancelled' || s === 'rejected') return 'status-cancelled';
    if (s === 'in progress') return 'status-open';
    return 'status-default';
}

function getStatusText(status) {
    const s = (status || '').trim().toLowerCase();
    if (s === 'open') return 'PENDING';
    if (s === 'closed' || s === 'approved') return 'APPROVED';
    if (s === 'cancelled' || s === 'rejected') return 'REJECTED';
    if (s === 'in progress') return 'IN PROGRESS';
    return 'UNKNOWN';
}

function getStatusIcon(status) {
    const s = (status || '').trim().toLowerCase();
    if (s === 'open') {
        return '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="18" cy="18" r="1"/><path d="M18 15v3"/></svg>';
    }
    if (s === 'closed' || s === 'approved') {
        return '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    }
    if (s === 'cancelled' || s === 'rejected') {
        return '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    }
    if (s === 'in progress') {
        return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    }
    return '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Tidak diketahui';
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Tidak diketahui';
        
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Baru saja';
        if (minutes < 60) return `${minutes} menit yang lalu`;
        if (hours < 24) return `${hours} jam yang lalu`;
        if (days < 7) return `${days} hari yang lalu`;
        
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch (e) {
        return 'Tidak diketahui';
    }
}
