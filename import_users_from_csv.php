<?php
/**
 * Script Import Users dari CSV (Format dengan semicolon)
 * 
 * Format CSV yang didukung:
 * - Delimiter: ; (semicolon)
 * - Kolom: id, username, name, npk, nomor_telepon, email, unit_kerja, role, password_hash, password, is_active, created_at, updated_at
 * 
 * Cara penggunaan:
 * 1. Letakkan file CSV di folder import/
 * 2. Akses script ini melalui browser atau jalankan via CLI: php import_users_from_csv.php
 * 3. Script akan mengimport data dengan validasi:
 *    - Unit kerja harus sesuai dengan yang ada di tabel unit_kerja
 *    - Tidak ada duplikasi NPK (1 NPK = 1 User)
 *    - Tidak ada duplikasi Username
 */

require_once 'config.php';

// Path file CSV - file harus ada di folder import/
$csvFile = __DIR__ . '/import/users.csv';

// Validasi file
if (!file_exists($csvFile)) {
    $importDir = __DIR__ . '/import';
    die("Error: File CSV tidak ditemukan!\n\n" .
        "Lokasi yang dicari: $csvFile\n\n" .
        "Instruksi:\n" .
        "1. Letakkan file CSV di folder: $importDir/\n" .
        "2. Pastikan nama file: users.csv\n" .
        "3. Atau sesuaikan nama file di script ini\n\n" .
        "Folder import saat ini: " . (is_dir($importDir) ? "ADA" : "TIDAK ADA") . "\n");
}

// Fungsi untuk convert NULL string ke null
function convertNull($value) {
    $value = trim($value);
    if (strtoupper($value) === 'NULL' || $value === '') {
        return null;
    }
    return $value;
}

// Fungsi untuk convert tanggal dari format DD/MM/YYYY HH:MM ke MySQL format
function convertDate($dateStr) {
    if (empty($dateStr) || strtoupper(trim($dateStr)) === 'NULL') {
        return null;
    }
    
    // Format: DD/MM/YYYY HH:MM atau DD/MM/YYYY
    $dateStr = trim($dateStr);
    
    // Coba parse dengan format DD/MM/YYYY HH:MM
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/', $dateStr, $matches)) {
        $day = $matches[1];
        $month = $matches[2];
        $year = $matches[3];
        $hour = isset($matches[4]) ? $matches[4] : '00';
        $minute = isset($matches[5]) ? $matches[5] : '00';
        
        // Validasi tanggal
        if (checkdate($month, $day, $year)) {
            return "$year-$month-$day $hour:$minute:00";
        }
    }
    
    return null;
}

try {
    // Koneksi database menggunakan fungsi dari config.php
    $conn = getDBConnection();
    
    // Mulai transaction
    $conn->begin_transaction();
    
    // Baca CSV dengan delimiter semicolon
    $file = fopen($csvFile, 'r');
    if (!$file) {
        throw new Exception("Tidak bisa membuka file CSV");
    }
    
    // Skip header
    $header = fgetcsv($file, 0, ';');
    
    // Array untuk menyimpan data dan tracking NPK/Username
    $usersData = [];
    $npkSeen = []; // Track NPK yang sudah dilihat di CSV
    $usernameSeen = []; // Track username yang sudah akan di-insert
    $stats = [
        'total_rows' => 0,
        'duplicate_npk' => 0,
        'duplicate_username_csv' => 0,
        'imported' => 0,
        'updated' => 0,
        'skipped_username_exists' => 0,
        'skipped_npk_exists' => 0,
        'skipped_invalid_unit' => 0,
        'skipped_invalid_data' => 0,
        'errors' => []
    ];
    
    // Baca semua baris
    while (($row = fgetcsv($file, 0, ';')) !== FALSE) {
        $stats['total_rows']++;
        
        // Parse data sesuai urutan kolom
        // id;username;name;npk;nomor_telepon;email;unit_kerja;role;password_hash;password;is_active;created_at;updated_at
        $id = convertNull($row[0] ?? '');
        $username = convertNull($row[1] ?? '');
        $name = convertNull($row[2] ?? '');
        $npk = convertNull($row[3] ?? '');
        $nomor_telepon = convertNull($row[4] ?? '');
        $email = convertNull($row[5] ?? '');
        $unit_kerja = convertNull($row[6] ?? '');
        $role = convertNull($row[7] ?? 'user'); // Default 'user' jika kosong
        $password_hash = convertNull($row[8] ?? '');
        $password = convertNull($row[9] ?? '');
        $is_active = convertNull($row[10] ?? '1');
        $created_at = convertDate($row[11] ?? '');
        $updated_at = convertDate($row[12] ?? '');
        
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
        $existingUser = $result ? $result->fetch_assoc() : null;
        $checkUsername->close();
        
        if ($existingUser) {
            // User sudah ada, akan di-update
            $existingUserId = $existingUser['id'];
            
            // Check NPK juga untuk memastikan tidak konflik
            if (!empty($npk)) {
                $checkNPK = $conn->prepare("SELECT id FROM users WHERE npk = ? AND id != ? LIMIT 1");
                $checkNPK->bind_param('si', $npk, $existingUserId);
                $checkNPK->execute();
                $result = $checkNPK->get_result();
                if ($result && $result->num_rows > 0) {
                    $stats['skipped_npk_exists']++;
                    $checkNPK->close();
                    continue;
                }
                $checkNPK->close();
            }
            
            // Update existing user
            $updateStmt = $conn->prepare("
                UPDATE users SET
                    name = ?,
                    npk = ?,
                    nomor_telepon = ?,
                    email = ?,
                    unit_kerja = ?,
                    role = ?,
                    password_hash = ?,
                    password = ?,
                    is_active = ?,
                    updated_at = NOW()
                WHERE id = ?
            ");
            
            $isActiveInt = ($is_active === '1' || $is_active === 1) ? 1 : 0;
            
            $updateStmt->bind_param(
                'ssssssssii',
                $name,
                $npk,
                $nomor_telepon,
                $email,
                $validated_unit_kerja,
                $role,
                $password_hash,
                $password,
                $isActiveInt,
                $existingUserId
            );
            
            if ($updateStmt->execute()) {
                $stats['updated']++;
            } else {
                $stats['errors'][] = "Error updating user {$username}: " . $updateStmt->error;
            }
            $updateStmt->close();
            
            continue;
        }
        
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
            'npk' => $npk,
            'nomor_telepon' => $nomor_telepon,
            'email' => $email,
            'unit_kerja' => $validated_unit_kerja,
            'role' => $role,
            'password_hash' => $password_hash,
            'password' => $password,
            'is_active' => ($is_active === '1' || $is_active === 1) ? 1 : 0
        ];
    }
    
    fclose($file);
    
    // Insert data baru ke database
    $stmt = $conn->prepare("
        INSERT INTO users (
            username, name, npk, nomor_telepon, email, unit_kerja, 
            role, password_hash, password, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
            'sssssssssi',
            $user['username'],
            $user['name'],
            $user['npk'],
            $user['nomor_telepon'],
            $user['email'],
            $user['unit_kerja'],
            $user['role'],
            $user['password_hash'],
            $user['password'],
            $user['is_active']
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
    echo "<pre>";
    echo "=== HASIL IMPORT ===\n";
    echo "Total baris di CSV: {$stats['total_rows']}\n";
    echo "Berhasil diimport (baru): {$stats['imported']}\n";
    echo "Berhasil diupdate (sudah ada): {$stats['updated']}\n";
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
    echo "</pre>";
    
} catch (Exception $e) {
    // Rollback on error
    if (isset($conn)) {
        $conn->rollback();
    }
    echo "<pre>";
    echo "Error: " . $e->getMessage() . "\n";
    echo "</pre>";
    exit(1);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
