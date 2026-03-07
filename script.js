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

    // Backdate card and quick access - open submenu in sidebar
    // Note: The actual toggle is handled by sidebar.js
    const backdateCard = document.getElementById('backdateCard');
    const quickAccessBackdate = document.getElementById('quickAccessBackdate');

    function openBackdateSubmenu() {
        const backdateMenu = document.getElementById('backdateMenu');
        const backdateSubmenu = document.getElementById('backdateSubmenu');
        if (backdateMenu && backdateSubmenu) {
            backdateMenu.classList.add('active');
            backdateSubmenu.classList.add('active');
        }
    }

    if (backdateCard) {
        backdateCard.addEventListener('click', function(e) {
            e.preventDefault();
            openBackdateSubmenu();
        });
    }

    if (quickAccessBackdate) {
        quickAccessBackdate.addEventListener('click', function(e) {
            e.preventDefault();
            openBackdateSubmenu();
        });
    }

    // Header Logout Button
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', function() {
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
