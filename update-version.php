<?php

$versionFile = __DIR__ . '/VERSION.txt';
if (!file_exists($versionFile)) {
    die("Error: VERSION.txt tidak ditemukan!\n");
}

$version = trim(file_get_contents($versionFile));
if (empty($version)) {
    die("Error: VERSION.txt kosong!\n");
}

function updateVersionInFile($filePath, $version) {
    if (!file_exists($filePath)) {
        return false;
    }
    
    $content = file_get_contents($filePath);
    $originalContent = $content;
    $updated = false;
    
    $patterns = [
        '/\?v=\d+/i' => '?v=' . $version,
        '/&v=\d+/i' => '&v=' . $version,
    ];
    
    foreach ($patterns as $pattern => $replacement) {
        $newContent = preg_replace($pattern, $replacement, $content);
        if ($newContent !== $content) {
            $content = $newContent;
            $updated = true;
        }
    }
    
    $content = preg_replace_callback(
        '/(href|src)=["\']([^"\']+\.(css|js))["\']/i',
        function($matches) use ($version, &$updated) {
            $attr = $matches[1];
            $url = $matches[2];
            
            if (strpos($url, 'v=') !== false) {
                return $matches[0];
            }
            
            $separator = strpos($url, '?') !== false ? '&' : '?';
            $newUrl = $url . $separator . 'v=' . $version;
            $updated = true;
            return $attr . '="' . $newUrl . '"';
        },
        $content
    );
    
    if ($updated && $content !== $originalContent) {
        file_put_contents($filePath, $content);
        return true;
    }
    
    return false;
}

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

$versionJsFile = __DIR__ . '/version.js';
if (file_exists($versionJsFile)) {
    $versionJsContent = file_get_contents($versionJsFile);
    $versionJsOriginal = $versionJsContent;
    
    $patterns = [
        "/const APP_VERSION = '[^']+';/",
        "/const APP_VERSION = \"[^\"]+\";/",
        "/APP_VERSION = '[^']+';/",
        "/APP_VERSION = \"[^\"]+\";/",
    ];
    
    $updatedJs = false;
    foreach ($patterns as $pattern) {
        $newContent = preg_replace($pattern, "const APP_VERSION = '$version';", $versionJsContent);
        if ($newContent !== $versionJsContent) {
            $versionJsContent = $newContent;
            $updatedJs = true;
            break;
        }
    }
    
    if ($updatedJs && $versionJsContent !== $versionJsOriginal) {
        file_put_contents($versionJsFile, $versionJsContent);
        echo "✓ Updated: version.js\n";
        $updatedCount++;
    } else {
        $versionPattern = '/const APP_VERSION = [\'"]?' . preg_quote($version, '/') . '[\'"]?;/';
        if (preg_match($versionPattern, $versionJsContent)) {
            echo "✓ version.js sudah menggunakan versi: $version\n";
        } else {
            echo "⚠ version.js mungkin perlu diupdate manual\n";
        }
    }
}

echo "\n==============================\n";
echo "Total files updated: $updatedCount\n";
echo "Version used: $version\n";
echo "\n✓ Semua file sudah diupdate dengan versi: $version\n";
echo "✓ Siap untuk di-upload ke Hostinger!\n";
