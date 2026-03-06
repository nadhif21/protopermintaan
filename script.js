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
    if (formPermintaanCardLink) {
        const role = getUserRole();
        formPermintaanCardLink.style.display = (role === 'user') ? 'block' : 'none';
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Apakah Anda yakin ingin logout?')) {
                logout();
            }
        });
    }

    const backdateCard = document.getElementById('backdateCard');
    const backdatePopup = document.getElementById('backdatePopup');
    const backdateCloseBtn = document.querySelector('.backdate-close-btn');

    if (backdateCard) {
        backdateCard.addEventListener('click', function(e) {
            e.preventDefault();
            if (backdatePopup) {
                backdatePopup.classList.add('show');
            }
        });
    }

    if (backdateCloseBtn) {
        backdateCloseBtn.addEventListener('click', function() {
            if (backdatePopup) {
                backdatePopup.classList.remove('show');
            }
        });
    }

    if (backdatePopup) {
        backdatePopup.addEventListener('click', function(e) {
            if (e.target === backdatePopup) {
                backdatePopup.classList.remove('show');
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && backdatePopup && backdatePopup.classList.contains('show')) {
            backdatePopup.classList.remove('show');
        }
    });
});
