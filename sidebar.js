document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) {
        return;
    }

    const session = getSession();
    if (!session || !session.user) {
        window.location.href = getAppFullUrl('/login.html');
        return;
    }

    const userNameEl = document.getElementById('sidebarUserName');
    const userRoleEl = document.getElementById('sidebarUserRole');
    const userAvatarEl = document.getElementById('sidebarUserAvatar');

    if (userNameEl) {
        const displayName = session.user.name || session.user.username || 'User';
        userNameEl.textContent = displayName;
    }

    if (userRoleEl) {
        const roleText = {
            'super_admin': 'Admin',
            'admin': 'Petugas',
            'approver': 'Approver',
            'manager': 'Manager',
            'petugas': 'Petugas',
            'user': 'User'
        };
        const role = getUserRole();
        userRoleEl.textContent = roleText[role] || 'User';
    }

    if (userAvatarEl) {
        const nameSource = session.user.name || session.user.username || 'U';
        const names = nameSource.split(' ');
        let initials = '';
        if (names.length >= 2) {
            initials = (names[0][0] || '') + (names[1][0] || '');
        } else if (names.length === 1 && names[0].length >= 2) {
            initials = names[0][0] + names[0][1];
        } else if (names.length === 1) {
            initials = names[0][0] || 'U';
        }
        userAvatarEl.textContent = initials.toUpperCase();
    }

    const adminMenu = document.getElementById('adminMenuLink');
    const formPermintaanMenu = document.getElementById('formPermintaanMenuLink');
    const dashboardUserBackdateMenu = document.getElementById('dashboardUserBackdateMenuLink');
    const dashboardApproverBackdateMenu = document.getElementById('dashboardApproverBackdateMenuLink');
    const dashboardPetugasBackdateMenu = document.getElementById('dashboardPetugasBackdateMenuLink');
    
    const backdateMenu = document.getElementById('backdateMenu');
    const backdateSubmenu = document.getElementById('backdateSubmenu');

    if (adminMenu) {
        adminMenu.style.display = (session.user.role === 'super_admin') ? 'block' : 'none';
    }

    if (formPermintaanMenu) {
        formPermintaanMenu.style.display = (session.user.role === 'user') ? 'block' : 'none';
    }

    const userRole = getUserRole();
    
    if (backdateMenu) {
        const userHasBackdateAccess = ['user', 'petugas', 'admin', 'super_admin'].includes(userRole);
        backdateMenu.style.display = userHasBackdateAccess ? 'block' : 'none';
        
        if (backdateSubmenu && userHasBackdateAccess) {
            backdateSubmenu.style.display = 'block';
        }
    }
    
    const formBackdateMenu = document.getElementById('formBackdateMenuLink');
    if (formBackdateMenu) {
        formBackdateMenu.style.display = 'block';
    }
    
    if (dashboardUserBackdateMenu) {
        dashboardUserBackdateMenu.style.display = (userRole === 'user') ? 'block' : 'none';
    }
    
    if (dashboardApproverBackdateMenu) {
        dashboardApproverBackdateMenu.style.display = 
            (userRole === 'admin' || userRole === 'super_admin') ? 'block' : 'none';
    }
    
    if (dashboardPetugasBackdateMenu) {
        dashboardPetugasBackdateMenu.style.display = 
            (userRole === 'admin' || userRole === 'super_admin') ? 'block' : 'none';
    }

    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    const currentPath = window.location.pathname;
    const menuItems = document.querySelectorAll('.sidebar-nav-item:not(.sidebar-nav-parent)');
    
    menuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            let isActive = false;
            
            // Extract path dari href (hilangkan domain jika ada)
            let hrefPath = href;
            try {
                const hrefUrl = new URL(href);
                hrefPath = hrefUrl.pathname;
            } catch (e) {
                // Jika bukan full URL, gunakan href langsung
                hrefPath = href;
            }
            
            // Normalize paths untuk comparison
            let normalizedHref = hrefPath.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
            let normalizedPath = currentPath.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
            
            if (normalizedPath === normalizedHref) {
                isActive = true;
            } else {
                const hrefParts = normalizedHref.split('/');
                const pathParts = normalizedPath.split('/');
                
                // Match jika semua bagian path cocok
                if (pathParts.length >= hrefParts.length) {
                    let allMatch = true;
                    for (let i = 0; i < hrefParts.length; i++) {
                        if (pathParts[pathParts.length - hrefParts.length + i] !== hrefParts[i]) {
                            allMatch = false;
                            break;
                        }
                    }
                    if (allMatch && pathParts.length === hrefParts.length) {
                        isActive = true;
                    }
                }
            }
            
            if (isActive) {
                item.classList.add('active');
            }
        }
    });

    if (backdateMenu && backdateSubmenu) {
        const hasActiveItem = backdateSubmenu.querySelector('.sidebar-submenu-item.active');
        if (hasActiveItem) {
            backdateMenu.classList.add('active');
            backdateSubmenu.classList.add('active');
        }
        
        backdateMenu.style.cursor = 'pointer';
        backdateMenu.style.userSelect = 'none';
        
        backdateMenu.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const isActive = backdateMenu.classList.contains('active');
            
            if (isActive) {
                backdateMenu.classList.remove('active');
                backdateSubmenu.classList.remove('active');
            } else {
                backdateMenu.classList.add('active');
                backdateSubmenu.classList.add('active');
            }
        }, false);
        
        const menuItems = backdateMenu.querySelectorAll('span');
        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                backdateMenu.click();
            });
        });
    }

    const submenuItems = document.querySelectorAll('.sidebar-submenu-item');
    
    submenuItems.forEach(subItem => subItem.classList.remove('active'));
    
    const currentUrl = window.location.href;
    const currentPathname = window.location.pathname;
    
    submenuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            let isActive = false;
            
            // Extract path dari href (hilangkan domain jika ada)
            let hrefPath = href;
            try {
                const hrefUrl = new URL(href);
                hrefPath = hrefUrl.pathname;
            } catch (e) {
                // Jika bukan full URL, gunakan href langsung
                hrefPath = href;
            }
            
            // Normalize paths untuk comparison
            let normalizedHref = hrefPath.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
            let normalizedPath = currentPathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
            
            if (normalizedPath === normalizedHref) {
                isActive = true;
            } else {
                const hrefParts = normalizedHref.split('/');
                const pathParts = normalizedPath.split('/');
                
                if (pathParts.length === hrefParts.length) {
                    let allMatch = true;
                    for (let i = 0; i < hrefParts.length; i++) {
                        if (pathParts[i] !== hrefParts[i]) {
                            allMatch = false;
                            break;
                        }
                    }
                    if (allMatch) {
                        isActive = true;
                    }
                }
            }
            
            if (isActive) {
                item.classList.add('active');
                if (backdateMenu && backdateSubmenu) {
                    backdateMenu.classList.add('active');
                    backdateSubmenu.style.display = 'block';
                    backdateSubmenu.classList.add('active');
                }
            }
        }
    });

    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', function() {
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
    
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn && sidebarLogoutBtn) {
        headerLogoutBtn.addEventListener('click', function() {
            sidebarLogoutBtn.click();
        });
    } else if (headerLogoutBtn) {
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
});
