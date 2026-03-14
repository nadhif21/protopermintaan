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
            'super_admin': 'Admin',
            'admin': 'Petugas',
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
    
    // Get current URL for more accurate matching
    const currentUrl = window.location.href;
    const currentPathname = window.location.pathname;
    
    submenuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            let isActive = false;
            
            // Extract filename from href
            const hrefFileName = href.split('/').pop();
            const currentFileName = currentPathname.split('/').pop();
            
            // Method 1: Exact filename match (most reliable)
            if (hrefFileName === currentFileName) {
                isActive = true;
            }
            // Method 2: Check if current URL includes the full href path
            else if (currentUrl.includes(href) || currentPathname.includes(href)) {
                isActive = true;
            }
            // Method 3: Check if current pathname ends with the href filename
            else if (currentPathname.endsWith(hrefFileName)) {
                isActive = true;
            }
            // Method 4: For backdate pages, check if both are in backdate folder
            else if (hrefFileName.includes('backdate') && currentPathname.includes('backdate')) {
                if (hrefFileName === currentFileName) {
                    isActive = true;
                }
            }
            
            if (isActive) {
                // Add active to current item
                item.classList.add('active');
                // Auto expand parent menu if submenu item is active
                if (backdateMenu && backdateSubmenu) {
                    backdateMenu.classList.add('active');
                    backdateSubmenu.style.display = 'block';
                    backdateSubmenu.classList.add('active');
                }
            }
        }
    });

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
                    window.location.href = getAppFullUrl('/login.html');
                }
            }
        });
    }
    
    // Header Logout button (for backward compatibility, redirect to sidebar)
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn && sidebarLogoutBtn) {
        headerLogoutBtn.addEventListener('click', function() {
            sidebarLogoutBtn.click();
        });
    } else if (headerLogoutBtn) {
        // If sidebar logout button doesn't exist, keep header logout functionality
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
