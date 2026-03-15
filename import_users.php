<?php
/**
 * Script Import Users dari CSV
 * 
 * Cara penggunaan:
 * 1. Pastikan file CSV ada di folder yang sama atau sesuaikan path
 * 2. Akses script ini melalui browser atau jalankan via CLI: php import_users.php
 * 3. Script akan mengimport data dengan validasi:
 *    - Unit kerja harus sesuai dengan yang ada di tabel unit_kerja
 *    - Tidak ada duplikasi NPK (1 NPK = 1 User)
 *    - Role otomatis diset sebagai 'user'
 */

require_once 'config.php';

// Path file CSV - file harus ada di folder import/
// Letakkan file CSV di folder: permintaandof/import/
$csvFile = __DIR__ . '/import/user - Sheet1 (1).csv';

// Jika nama file berbeda, sesuaikan di bawah ini:
// $csvFile = __DIR__ . '/import/nama-file-anda.csv';

// Validasi file
if (!file_exists($csvFile)) {
    $importDir = __DIR__ . '/import';
    die("Error: File CSV tidak ditemukan!\n\n" .
        "Lokasi yang dicari: $csvFile\n\n" .
        "Instruksi:\n" .
        "1. Letakkan file CSV di folder: $importDir/\n" .
        "2. Pastikan nama file: user - Sheet1 (1).csv\n" .
        "3. Atau sesuaikan nama file di script ini\n\n" .
        "Folder import saat ini: " . (is_dir($importDir) ? "ADA" : "TIDAK ADA") . "\n");
}

try {
    // Koneksi database menggunakan fungsi dari config.php
    $conn = getDBConnection();
    
    // Mulai transaction
    $conn->begin_transaction();
    
    // Baca CSV
    $file = fopen($csvFile, 'r');
    if (!$file) {
        throw new Exception("Tidak bisa membuka file CSV");
    }
    
    // Skip header
    $header = fgetcsv($file);
    
    // Array untuk menyimpan data dan tracking NPK/Username
    $usersData = [];
    $npkSeen = []; // Track NPK yang sudah dilihat di CSV
    $usernameSeen = []; // Track username yang sudah akan di-insert
    $stats = [
        'total_rows' => 0,
        'duplicate_npk' => 0,
        'duplicate_username_csv' => 0,
        'imported' => 0,
        'skipped_username_exists' => 0,
        'skipped_npk_exists' => 0,
        'skipped_invalid_unit' => 0,
        'skipped_invalid_data' => 0,
        'errors' => []
    ];
    
    // Baca semua baris
    while (($row = fgetcsv($file)) !== FALSE) {
        $stats['total_rows']++;
        
        // Parse data dan normalisasi (trim + lowercase untuk username)
        $npk = trim($row[0] ?? '');
        $name = trim($row[1] ?? '');
        $unit_kerja = trim($row[2] ?? '');
        $nomor_telepon = trim($row[3] ?? '');
        $email = trim($row[4] ?? '');
        $username = trim($row[5] ?? '');
        $password_hash = trim($row[6] ?? '');
        
        // Validasi data wajib
        if (empty($username) || empty($name) || empty($password_hash)) {
            $stats['skipped_invalid_data']++;
            continue;
        }
        
        // Normalisasi username untuk pengecekan (case-insensitive)
        $usernameLower = strtolower($username);
        
        // Skip jika username sudah pernah dilihat di CSV (duplikasi dalam CSV)
        if (isset($usernameSeen[$usernameLower])) {
            $stats['duplicate_username_csv']++;
            continue;
        }
        
        // Skip jika NPK sudah pernah dilihat (duplikasi dalam CSV)
        if (!empty($npk) && isset($npkSeen[$npk])) {
            $stats['duplicate_npk']++;
            continue;
        }
        
        // Tandai username dan NPK sebagai sudah dilihat
        $usernameSeen[$usernameLower] = true;
        if (!empty($npk)) {
            $npkSeen[$npk] = true;
        }
        
        // Validasi unit kerja dengan tabel unit_kerja
        $validated_unit_kerja = null;
        if (!empty($unit_kerja)) {
            $checkUnit = $conn->prepare("SELECT nama_unit FROM unit_kerja WHERE nama_unit = ? AND is_active = 1 LIMIT 1");
            if ($checkUnit) {
                $checkUnit->bind_param('s', $unit_kerja);
                $checkUnit->execute();
                $result = $checkUnit->get_result();
                if ($result && $result->num_rows > 0) {
                    $validated_unit_kerja = $unit_kerja;
                } else {
                    // Unit kerja tidak ditemukan, akan dikosongkan
                    $stats['skipped_invalid_unit']++;
                }
                $checkUnit->close();
            }
        }
        
        // Check jika username sudah ada di database (case-insensitive)
        $checkUsername = $conn->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1");
        $checkUsername->bind_param('s', $username);
        $checkUsername->execute();
        $result = $checkUsername->get_result();
        if ($result && $result->num_rows > 0) {
            $stats['skipped_username_exists']++;
            $checkUsername->close();
            continue;
        }
        $checkUsername->close();
        
        // Check jika NPK sudah ada (jika NPK tidak kosong)
        if (!empty($npk)) {
            $checkNPK = $conn->prepare("SELECT id FROM users WHERE npk = ? LIMIT 1");
            $checkNPK->bind_param('s', $npk);
            $checkNPK->execute();
            $result = $checkNPK->get_result();
            if ($result && $result->num_rows > 0) {
                $stats['skipped_npk_exists']++;
                $checkNPK->close();
                continue;
            }
            $checkNPK->close();
        }
        
        // Simpan data untuk insert
        $usersData[] = [
            'username' => $username,
            'name' => $name,
            'npk' => $npk ?: null,
            'nomor_telepon' => $nomor_telepon ?: null,
            'email' => $email ?: null,
            'unit_kerja' => $validated_unit_kerja,
            'password_hash' => $password_hash
        ];
    }
    
    fclose($file);
    
    // Insert data ke database
    $stmt = $conn->prepare("
        INSERT INTO users (
            username, name, npk, nomor_telepon, email, unit_kerja, 
            role, password_hash, password, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'user', ?, NULL, 1, NOW(), NOW())
    ");
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    
    foreach ($usersData as $user) {
        // Double check sebelum insert (untuk memastikan tidak ada duplikasi)
        $doubleCheck = $conn->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1");
        $doubleCheck->bind_param('s', $user['username']);
        $doubleCheck->execute();
        $result = $doubleCheck->get_result();
        if ($result && $result->num_rows > 0) {
            $stats['skipped_username_exists']++;
            $doubleCheck->close();
            continue;
        }
        $doubleCheck->close();
        
        // Check NPK juga
        if (!empty($user['npk'])) {
            $doubleCheckNPK = $conn->prepare("SELECT id FROM users WHERE npk = ? LIMIT 1");
            $doubleCheckNPK->bind_param('s', $user['npk']);
            $doubleCheckNPK->execute();
            $result = $doubleCheckNPK->get_result();
            if ($result && $result->num_rows > 0) {
                $stats['skipped_npk_exists']++;
                $doubleCheckNPK->close();
                continue;
            }
            $doubleCheckNPK->close();
        }
        
        $stmt->bind_param(
            'sssssss',
            $user['username'],
            $user['name'],
            $user['npk'],
            $user['nomor_telepon'],
            $user['email'],
            $user['unit_kerja'],
            $user['password_hash']
        );
        
        if ($stmt->execute()) {
            $stats['imported']++;
        } else {
            // Handle duplicate key error secara khusus
            if (strpos($stmt->error, 'Duplicate entry') !== false) {
                if (strpos($stmt->error, 'username') !== false) {
                    $stats['skipped_username_exists']++;
                } else if (strpos($stmt->error, 'npk') !== false) {
                    $stats['skipped_npk_exists']++;
                }
                $stats['errors'][] = "Skip: {$user['username']} - " . $stmt->error;
            } else {
                $stats['errors'][] = "Error: {$user['username']} - " . $stmt->error;
            }
        }
    }
    
    $stmt->close();
    
    // Commit transaction
    $conn->commit();
    
    // Tampilkan hasil
    echo "=== HASIL IMPORT ===\n";
    echo "Total baris di CSV: {$stats['total_rows']}\n";
    echo "Berhasil diimport: {$stats['imported']}\n";
    echo "Duplikasi NPK di CSV: {$stats['duplicate_npk']}\n";
    echo "Duplikasi Username di CSV: {$stats['duplicate_username_csv']}\n";
    echo "Skip - Username sudah ada di DB: {$stats['skipped_username_exists']}\n";
    echo "Skip - NPK sudah ada di DB: {$stats['skipped_npk_exists']}\n";
    echo "Skip - Unit kerja tidak valid: {$stats['skipped_invalid_unit']}\n";
    echo "Skip - Data tidak valid: {$stats['skipped_invalid_data']}\n";
    
    if (!empty($stats['errors'])) {
        echo "\n=== ERRORS ===\n";
        foreach ($stats['errors'] as $error) {
            echo $error . "\n";
        }
    }
    
    echo "\nImport selesai!\n";
    
} catch (Exception $e) {
    // Rollback on error
    if (isset($conn)) {
        $conn->rollback();
    }
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
