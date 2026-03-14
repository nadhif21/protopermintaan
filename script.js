document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) {
        return;
    }

    // Tampilkan menu Super Admin hanya untuk role super_admin
    const adminCardLink = document.getElementById('adminCardLink');
    if (adminCardLink) {
        adminCardLink.style.display = isSuperAdmin() ? 'block' : 'none';
    }
    
    // Tampilkan menu Form Permintaan untuk user
    const formPermintaanCardLink = document.getElementById('formPermintaanCardLink');
    const quickAccessForm = document.getElementById('quickAccessForm');
    if (formPermintaanCardLink) {
        const role = getUserRole();
        formPermintaanCardLink.style.display = (role === 'user') ? 'block' : 'none';
    }
    if (quickAccessForm) {
        const role = getUserRole();
        quickAccessForm.style.display = (role === 'user') ? 'flex' : 'none';
    }
    
    // Tampilkan menu Quick Access berdasarkan role
    const role = getUserRole();
    const isAdmin = role === 'admin' || role === 'super_admin';
    const isApprover = role === 'approver';
    const isPetugas = role === 'petugas';
    const isUser = role === 'user';
    
    // Form Permintaan Backdate - untuk user
    const quickAccessFormBackdate = document.getElementById('quickAccessFormBackdate');
    if (quickAccessFormBackdate) {
        quickAccessFormBackdate.style.display = isUser ? 'flex' : 'none';
    }
    
    // Status Permintaan Saya - untuk user
    const quickAccessStatusBackdate = document.getElementById('quickAccessStatusBackdate');
    if (quickAccessStatusBackdate) {
        quickAccessStatusBackdate.style.display = isUser ? 'flex' : 'none';
    }
    
    // Approval Backdate - untuk approver dan admin
    const quickAccessApprovalBackdate = document.getElementById('quickAccessApprovalBackdate');
    if (quickAccessApprovalBackdate) {
        quickAccessApprovalBackdate.style.display = (isApprover || isAdmin) ? 'flex' : 'none';
    }
    
    // Tugas Backdate - untuk petugas
    const quickAccessTugasBackdate = document.getElementById('quickAccessTugasBackdate');
    if (quickAccessTugasBackdate) {
        quickAccessTugasBackdate.style.display = isPetugas ? 'flex' : 'none';
    }
    
    // User Management - untuk admin
    const quickAccessAdmin = document.getElementById('quickAccessAdmin');
    if (quickAccessAdmin) {
        quickAccessAdmin.style.display = isAdmin ? 'flex' : 'none';
    }


    // Sidebar Logout Button
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') {
                logout();
            } else {
                // Fallback if logout function is not available
                if (confirm('Apakah Anda yakin ingin logout?')) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userData');
                    window.location.href = 'login.html';
                }
            }
        });
    }
});
