document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) {
        return;
    }

    const adminCardLink = document.getElementById('adminCardLink');
    if (adminCardLink) {
        adminCardLink.style.display = isSuperAdmin() ? 'block' : 'none';
    }
    
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
    
    const role = getUserRole();
    const isAdmin = role === 'admin' || role === 'super_admin';
    const isApprover = role === 'approver';
    const isPetugas = role === 'petugas';
    const isUser = role === 'user';
    
    const quickAccessFormBackdate = document.getElementById('quickAccessFormBackdate');
    if (quickAccessFormBackdate) {
        quickAccessFormBackdate.style.display = isUser ? 'flex' : 'none';
    }
    
    const quickAccessStatusBackdate = document.getElementById('quickAccessStatusBackdate');
    if (quickAccessStatusBackdate) {
        quickAccessStatusBackdate.style.display = isUser ? 'flex' : 'none';
    }
    
    const quickAccessApprovalBackdate = document.getElementById('quickAccessApprovalBackdate');
    if (quickAccessApprovalBackdate) {
        quickAccessApprovalBackdate.style.display = (isApprover || isAdmin) ? 'flex' : 'none';
    }
    
    const quickAccessTugasBackdate = document.getElementById('quickAccessTugasBackdate');
    if (quickAccessTugasBackdate) {
        quickAccessTugasBackdate.style.display = isPetugas ? 'flex' : 'none';
    }
    
    const quickAccessAdmin = document.getElementById('quickAccessAdmin');
    if (quickAccessAdmin) {
        quickAccessAdmin.style.display = isAdmin ? 'flex' : 'none';
    }


    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', function() {
            if (typeof logout === 'function') {
                logout();
            } else {
                if (confirm('Apakah Anda yakin ingin logout?')) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userData');
                    window.location.href = 'login.html';
                }
            }
        });
    }
});
