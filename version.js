// Version Configuration untuk Cache Busting
// Update nomor ini setiap kali melakukan deploy ke Hostinger
// Format: YYYYMMDDHHMM (tahun-bulan-tanggal-jam-menit)
// Contoh: 202412011200 = 1 Desember 2024, jam 12:00

// Cegah eksekusi ganda dengan IIFE dan check
(function() {
    // Jika sudah dijalankan sebelumnya, skip
    if (window.__VERSION_JS_LOADED__) {
        return;
    }
    window.__VERSION_JS_LOADED__ = true;
    
    const APP_VERSION = '202503141605';
    
    // Simpan version di localStorage untuk check di load berikutnya
    const STORAGE_KEY = '__APP_VERSION__';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    // Jika version berbeda, clear cache dan reload
    if (lastVersion && lastVersion !== APP_VERSION) {
        // Clear semua cache
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (let name of names) {
                    caches.delete(name);
                }
            });
        }
        // Clear localStorage cache
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('__CACHE_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch(e) {}
        
        // Simpan version baru
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
        
        // Force reload dengan cache bypass
        if (window.location.search.indexOf('nocache') === -1) {
            window.location.reload(true);
            return;
        }
    } else if (!lastVersion) {
        // First time, simpan version
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
    }

    // Function untuk mendapatkan URL dengan version parameter
    function getVersionedUrl(url) {
        if (!url || url.includes('v=')) return url;
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + 'v=' + APP_VERSION;
    }

    // Function untuk apply version ke semua CSS dan JS
    function applyVersionToAssets() {
        // Update semua CSS links
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        cssLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.includes('v=')) {
                const newHref = getVersionedUrl(href);
                if (newHref !== href) {
                    // Hapus link lama dan buat baru untuk force reload
                    const newLink = document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = newHref;
                    link.parentNode.replaceChild(newLink, link);
                }
            }
        });
        
        // Update semua JS scripts (kecuali version.js sendiri)
        const jsScripts = document.querySelectorAll('script[src]');
        jsScripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src && !src.includes('v=') && !src.includes('version.js')) {
                const newSrc = getVersionedUrl(src);
                if (newSrc !== src) {
                    // Hapus script lama dan buat baru untuk force reload
                    const newScript = document.createElement('script');
                    newScript.src = newSrc;
                    newScript.async = script.async;
                    newScript.defer = script.defer;
                    script.parentNode.replaceChild(newScript, script);
                }
            }
        });
    }

    // Jalankan segera untuk elemen yang sudah ada
    // Coba jalankan langsung (untuk elemen yang sudah ada di head)
    if (document.head) {
        applyVersionToAssets();
    }
    
    // Jalankan lagi saat DOM ready (untuk elemen yang ditambahkan kemudian)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyVersionToAssets);
    } else {
        // DOM sudah ready, jalankan langsung
        applyVersionToAssets();
    }
    
    // Gunakan MutationObserver untuk menangkap elemen yang ditambahkan secara dinamis
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            if (node.tagName === 'LINK' || node.tagName === 'SCRIPT') {
                                shouldUpdate = true;
                            }
                        }
                    });
                }
            });
            if (shouldUpdate) {
                applyVersionToAssets();
            }
        });
        
        observer.observe(document.head || document.documentElement, {
            childList: true,
            subtree: true
        });
    }
})();
