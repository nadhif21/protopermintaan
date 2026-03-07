// Sidebar Navigation Script
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!checkAuth()) {
        return;
    }

    const session = getSession();
    if (!session || !session.user) {
        window.location.href = 'login.html';
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

    if (adminMenu) {
        adminMenu.style.display = (session.user.role === 'super_admin') ? 'block' : 'none';
    }

    if (formPermintaanMenu) {
        formPermintaanMenu.style.display = (session.user.role === 'user') ? 'block' : 'none';
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
    const menuItems = document.querySelectorAll('.sidebar-nav-item');
    
    menuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && currentPath.includes(href.replace(/^\.\//, '').replace(/\.html$/, ''))) {
            item.classList.add('active');
        }
    });

    // Backdate menu click handler - toggle submenu
    const backdateMenu = document.getElementById('backdateMenu');
    const backdateSubmenu = document.getElementById('backdateSubmenu');

    if (backdateMenu && backdateSubmenu) {
        // Use a flag to prevent multiple event listeners
        if (!backdateMenu.dataset.listenerAttached) {
            backdateMenu.dataset.listenerAttached = 'true';
            
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
            });
        }
    }

    // Set active submenu item based on current page
    const submenuItems = document.querySelectorAll('.sidebar-submenu-item');
    
    // First, remove all active classes from submenu items
    submenuItems.forEach(subItem => subItem.classList.remove('active'));
    
    submenuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            // Normalize path for comparison
            let normalizedHref = href;
            // Remove leading ../ or ./
            normalizedHref = normalizedHref.replace(/^\.\.\//, '').replace(/^\.\//, '');
            // Remove .html extension
            normalizedHref = normalizedHref.replace(/\.html$/, '');
            
            // Normalize current path - get the full path segments
            let normalizedPath = currentPath;
            // Remove leading slash
            normalizedPath = normalizedPath.replace(/^\//, '');
            // Remove .html extension
            normalizedPath = normalizedPath.replace(/\.html$/, '');
            
            // Get just the filename from href (e.g., "backdate/backdate.html" -> "backdate")
            const hrefFilename = normalizedHref.split('/').pop();
            // Get just the filename from current path
            const pathFilename = normalizedPath.split('/').pop();
            
            // Check if current page matches submenu item
            // Match by filename (most reliable)
            if (pathFilename === hrefFilename) {
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
                    window.location.href = 'login.html';
                }
            }
        });
    }
});
