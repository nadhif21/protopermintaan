<?php
/**
 * Script untuk update version di semua file HTML
 * Jalankan script ini setiap kali akan deploy ke Hostinger
 * 
 * Usage: php update-version.php
 */

$version = '202412011200'; // Update ini setiap kali deploy

function updateVersionInFile($filePath, $version) {
    if (!file_exists($filePath)) {
        return false;
    }
    
    $content = file_get_contents($filePath);
    $updated = false;
    
    // Update CSS links
    $content = preg_replace_callback(
        '/(<link[^>]+href=["\'])([^"\']+\.css)(["\'][^>]*>)/i',
        function($matches) use ($version, &$updated) {
            $url = $matches[2];
            if (strpos($url, 'v=') === false) {
                $separator = strpos($url, '?') !== false ? '&' : '?';
                $newUrl = $url . $separator . 'v=' . $version;
                $updated = true;
                return $matches[1] . $newUrl . $matches[3];
            }
            return $matches[0];
        },
        $content
    );
    
    // Update JS scripts (kecuali version.js)
    $content = preg_replace_callback(
        '/(<script[^>]+src=["\'])([^"\']+\.js)(["\'][^>]*>)/i',
        function($matches) use ($version, &$updated) {
            $url = $matches[2];
            if (strpos($url, 'v=') === false && strpos($url, 'version.js') === false) {
                $separator = strpos($url, '?') !== false ? '&' : '?';
                $newUrl = $url . $separator . 'v=' . $version;
                $updated = true;
                return $matches[1] . $newUrl . $matches[3];
            }
            return $matches[0];
        },
        $content
    );
    
    if ($updated) {
        file_put_contents($filePath, $content);
        return true;
    }
    
    return false;
}

// Daftar semua file HTML
$htmlFiles = [
    'index.html',
    'login.html',
    'register.html',
    'form-permintaan.html',
    'profile.html',
    'permintaan/permintaan.html',
    'permintaan/approval.html',
    'admin/admin.html',
    'admin/approval.html',
    'backdate/form-permintaan.html',
    'backdate/dashboard-user-backdate.html',
    'backdate/dashboard-approver-backdate.html',
    'backdate/dashboard-petugas-backdate.html',
    'backdate/detail.html',
];

$baseDir = __DIR__;
$updatedCount = 0;

echo "Updating version to: $version\n";
echo "==============================\n\n";

foreach ($htmlFiles as $file) {
    $filePath = $baseDir . '/' . $file;
    if (updateVersionInFile($filePath, $version)) {
        echo "✓ Updated: $file\n";
        $updatedCount++;
    } else {
        echo "✗ Skipped: $file (no changes or file not found)\n";
    }
}

echo "\n==============================\n";
echo "Total files updated: $updatedCount\n";
echo "Don't forget to update APP_VERSION in version.js to: $version\n";
