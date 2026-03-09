// Sidebar Navigation Script
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!checkAuth()) {
        return;
    }

    const session = getSession();
    if (!session || !session.user) {
        window.location.href = getAppFullUrl('/login.html');
        return;
    }

    // Update user info in sidebar
    const userNameEl = document.getElementById('sidebarUserName');
    const userRoleEl = document.getElementById('sidebarUserRole');
    const userAvatarEl = document.getElementById('sidebarUserAvatar');

    if (userNameEl) {
        // Use name if available, otherwise use username
        const displayName = session.user.name || session.user.username || 'User';
        userNameEl.textContent = displayName;
    }

    if (userRoleEl) {
        const roleText = {
            'super_admin': 'Super Administrator',
            'admin': 'Administrator',
            'approver': 'Approver',
            'petugas': 'Petugas',
            'user': 'User'
        };
        const role = session.user.role || 'user';
        userRoleEl.textContent = roleText[role] || 'User';
    }

    if (userAvatarEl) {
        // Get initials from name or username
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

    // Show/hide menu items based on role
    const adminMenu = document.getElementById('adminMenuLink');
    const formPermintaanMenu = document.getElementById('formPermintaanMenuLink');
    const dashboardUserBackdateMenu = document.getElementById('dashboardUserBackdateMenuLink');
    const dashboardApproverBackdateMenu = document.getElementById('dashboardApproverBackdateMenuLink');
    const dashboardPetugasBackdateMenu = document.getElementById('dashboardPetugasBackdateMenuLink');
    
    // Get backdate menu elements early (before they're used)
    const backdateMenu = document.getElementById('backdateMenu');
    const backdateSubmenu = document.getElementById('backdateSubmenu');

    if (adminMenu) {
        adminMenu.style.display = (session.user.role === 'super_admin') ? 'block' : 'none';
    }

    if (formPermintaanMenu) {
        formPermintaanMenu.style.display = (session.user.role === 'user') ? 'block' : 'none';
    }

    // Show/hide backdate workflow menu based on role
    const userRole = session.user.role || 'user';
    
    // Control visibility of Backdate main menu - selalu tampilkan untuk semua role yang memiliki akses
    if (backdateMenu) {
        const userHasBackdateAccess = ['user', 'approver', 'petugas', 'admin', 'super_admin'].includes(userRole);
        backdateMenu.style.display = userHasBackdateAccess ? 'block' : 'none';
        
        // Pastikan submenu juga terlihat jika menu terlihat
        if (backdateSubmenu && userHasBackdateAccess) {
            backdateSubmenu.style.display = 'block';
        }
    }
    
    // Form Permintaan Backdate (form-permintaan.html) - untuk semua user
    const formBackdateMenu = document.getElementById('formBackdateMenuLink');
    if (formBackdateMenu) {
        formBackdateMenu.style.display = 'block';
    }
    
    // Dashboard User Backdate - untuk user biasa
    if (dashboardUserBackdateMenu) {
        dashboardUserBackdateMenu.style.display = (userRole === 'user') ? 'block' : 'none';
    }
    
    // Dashboard Approver Backdate - untuk approver, admin, super_admin
    if (dashboardApproverBackdateMenu) {
        dashboardApproverBackdateMenu.style.display = 
            (userRole === 'approver' || userRole === 'admin' || userRole === 'super_admin') ? 'block' : 'none';
    }
    
    // Dashboard Petugas Backdate - hanya untuk admin dan super_admin
    if (dashboardPetugasBackdateMenu) {
        dashboardPetugasBackdateMenu.style.display = 
            (userRole === 'admin' || userRole === 'super_admin') ? 'block' : 'none';
    }

    // Mobile menu toggle
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

    // Set active menu item based on current page
    const currentPath = window.location.pathname;
    const menuItems = document.querySelectorAll('.sidebar-nav-item:not(.sidebar-nav-parent)');
    
    menuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            // Normalize paths for comparison
            let normalizedHref = href.replace(/^\.\//, '').replace(/\.html$/, '');
            let normalizedPath = currentPath.replace(/^\//, '').replace(/\.html$/, '');
            
            // Remove leading/trailing slashes
            normalizedHref = normalizedHref.replace(/^\/+|\/+$/g, '');
            normalizedPath = normalizedPath.replace(/^\/+|\/+$/g, '');
            
            // Exact match to avoid conflicts (e.g., form-permintaan.html should not match backdate/form-permintaan.html)
            if (normalizedPath === normalizedHref || normalizedPath.endsWith('/' + normalizedHref)) {
                item.classList.add('active');
            }
        }
    });

    // Backdate menu click handler - toggle submenu
    // backdateMenu and backdateSubmenu are already declared above
    if (backdateMenu && backdateSubmenu) {
        // Check if there's an active submenu item - if yes, expand by default
        const hasActiveItem = backdateSubmenu.querySelector('.sidebar-submenu-item.active');
        if (hasActiveItem) {
            backdateMenu.classList.add('active');
            backdateSubmenu.classList.add('active');
        }
        
        // Make sure menu is clickable
        backdateMenu.style.cursor = 'pointer';
        backdateMenu.style.userSelect = 'none';
        
        // Add click event listener
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
        
        // Also handle click on the entire menu item area
        const menuItems = backdateMenu.querySelectorAll('span');
        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                backdateMenu.click();
            });
        });
    }

    // Set active submenu item based on current page
    const submenuItems = document.querySelectorAll('.sidebar-submenu-item');
    
    // First, remove all active classes from submenu items
    submenuItems.forEach(subItem => subItem.classList.remove('active'));
    
    submenuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            // Resolve href to absolute path
            let resolvedHref = href;
            
            // Handle relative paths by resolving them relative to current page
            if (resolvedHref.startsWith('../')) {
                // Get current directory and resolve ../ path
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
                resolvedHref = currentDir + '/' + resolvedHref.replace(/^\.\.\//, '');
            } else if (resolvedHref.startsWith('./') || (!resolvedHref.startsWith('/') && !resolvedHref.startsWith('http'))) {
                // Relative path (./ or no prefix), resolve relative to current directory
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
                resolvedHref = currentDir + '/' + resolvedHref.replace(/^\.\//, '');
            }
            
            // Normalize: remove leading slash and .html extension
            resolvedHref = resolvedHref.replace(/^\//, '').replace(/\.html$/, '');
            let normalizedPath = currentPath.replace(/^\//, '').replace(/\.html$/, '');
            
            // Remove leading/trailing slashes for comparison
            resolvedHref = resolvedHref.replace(/^\/+|\/+$/g, '');
            normalizedPath = normalizedPath.replace(/^\/+|\/+$/g, '');
            
            // Check if current path matches the resolved href path
            // This prevents conflicts like form-permintaan.html matching backdate/form-permintaan.html
            if (normalizedPath === resolvedHref) {
                // Add active to current item
                item.classList.add('active');
                // Auto expand parent menu if submenu item is active
                if (backdateMenu && backdateSubmenu) {
                    backdateMenu.classList.add('active');
                    backdateSubmenu.classList.add('active');
                }
            }
        }
    });

    // Header Logout button (in content-header)
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
                    window.location.href = getAppFullUrl('/login.html');
                }
            }
        });
    }
});
