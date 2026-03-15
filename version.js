(function() {
    if (window.__VERSION_JS_LOADED__) {
        return;
    }
    window.__VERSION_JS_LOADED__ = true;
    
    const APP_VERSION = '202503151300';
    
    const STORAGE_KEY = '__APP_VERSION__';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    if (lastVersion && lastVersion !== APP_VERSION) {
        console.log('Version changed from', lastVersion, 'to', APP_VERSION, '- Clearing cache and reloading...');
        
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (let name of names) {
                    caches.delete(name);
                }
            });
        }
        
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('__CACHE_') || key === STORAGE_KEY) {
                    localStorage.removeItem(key);
                }
            });
        } catch(e) {}
        
        try {
            sessionStorage.clear();
        } catch(e) {}
        
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
        
        const url = new URL(window.location.href);
        url.searchParams.set('_v', APP_VERSION);
        url.searchParams.set('_t', Date.now());
        
        if (window.location.search.indexOf('nocache') === -1) {
            window.location.href = url.toString();
            return;
        }
    } else if (!lastVersion) {
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } else {
        const allLinks = document.querySelectorAll('link[rel="stylesheet"], script[src]');
        let needsReload = false;
        allLinks.forEach(link => {
            const href = link.getAttribute('href') || link.getAttribute('src');
            if (href && !href.includes('version.js') && !href.includes('v=' + APP_VERSION)) {
                needsReload = true;
            }
        });
        
        if (needsReload && window.location.search.indexOf('_v=' + APP_VERSION) === -1) {
            const url = new URL(window.location.href);
            url.searchParams.set('_v', APP_VERSION);
            url.searchParams.set('_t', Date.now());
            window.location.href = url.toString();
            return;
        }
    }

    function getVersionedUrl(url) {
        if (!url || url.includes('v=')) return url;
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + 'v=' + APP_VERSION;
    }

    function applyVersionToAssets() {
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        cssLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.includes('v=')) {
                const newHref = getVersionedUrl(href);
                if (newHref !== href) {
                    const newLink = document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = newHref;
                    link.parentNode.replaceChild(newLink, link);
                }
            }
        });
        
        const jsScripts = document.querySelectorAll('script[src]');
        jsScripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src && !src.includes('v=') && !src.includes('version.js')) {
                const newSrc = getVersionedUrl(src);
                if (newSrc !== src) {
                    const newScript = document.createElement('script');
                    newScript.src = newSrc;
                    newScript.async = script.async;
                    newScript.defer = script.defer;
                    script.parentNode.replaceChild(newScript, script);
                }
            }
        });
    }

    if (document.head) {
        applyVersionToAssets();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyVersionToAssets);
    } else {
        applyVersionToAssets();
    }
    
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
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
