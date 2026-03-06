<?php
require_once 'config.php';

// Fungsi untuk convert format datetime dari ISO 8601 ke MySQL DATETIME
function convertToMySQLDateTime($dateString) {
    if (empty($dateString) || trim($dateString) === '') {
        return null;
    }
    
    $dateString = trim($dateString);
    
    // Handle format ISO 8601: 2026-03-06T08:03:48.328Z atau 2026-03-06T08:03:48Z
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/', $dateString, $matches)) {
        $year = $matches[1];
        $month = $matches[2];
        $day = $matches[3];
        $hour = $matches[4];
        $minute = $matches[5];
        $second = $matches[6];
        return "$year-$month-$day $hour:$minute:$second";
    }
    
    // Coba parse dengan strtotime untuk format lain
    $timestamp = strtotime($dateString);
    if ($timestamp !== false) {
        return date('Y-m-d H:i:s', $timestamp);
    }
    
    // Jika tidak bisa di-parse, return null
    return null;
}

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(200);
    exit;
}

// Get action from request
$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    $conn = getDBConnection();
    
    switch ($action) {
        case 'getData':
            handleGetData($conn);
            break;
            
        case 'batchUpdate':
            handleBatchUpdate($conn);
            break;
            
        case 'getAllPerjanjian':
            handleGetAllPerjanjian($conn);
            break;
            
        case 'getPerjanjian':
            handleGetPerjanjian($conn);
            break;
            
        case 'savePerjanjian':
            handleSavePerjanjian($conn);
            break;
            
        case 'deletePerjanjian':
            handleDeletePerjanjian($conn);
            break;
            
        case 'insertBackdate':
            handleInsertBackdate($conn);
            break;
            
        default:
            sendJSONResponse(false, null, 'Action tidak valid');
    }
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    sendJSONResponse(false, null, $e->getMessage());
}

// Handler untuk getData (permintaan atau backdate)
function handleGetData($conn) {
    $table = $_GET['table'] ?? 'permintaan'; // default permintaan
    
    if ($table === 'backdate') {
        $sql = "SELECT * FROM `backdate` ORDER BY `timestamp` DESC, `id` DESC";
    } else {
        $sql = "SELECT * FROM `permintaan` ORDER BY `timestamp` DESC, `id` DESC";
    }
    
    $result = $conn->query($sql);
    
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    
    $data = [];
    $headers = [];
    
    while ($row = $result->fetch_assoc()) {
        $rowData = [];
        $rowData['rowNumber'] = $row['row_number'];
        
        // Map kolom dinamis berdasarkan tabel
        if ($table === 'backdate') {
            // Headers untuk backdate (sesuai struktur spreadsheet sebenarnya)
            if (empty($headers)) {
                $headers = [
                    'Timestamp', 'Nama Admin', 'NPK', 'Jabatan', 
                    'Tanggal Pembukaan Backdate', 'Alasan Pembukaan Backdate (diisi alasan dan siapa yang memberikan perintah pembukaan backdate)', 
                    'Nama yang Dibuka Backdate', 'Departemen yang dibukakan Backdate', 
                    'Nomor Surat Backdate DOF', 'Email Address', 'Status', 'Flag', 'Waktu Selesai'
                ];
            }
            
            // Mapping sesuai struktur spreadsheet sebenarnya
            $rowData['Timestamp'] = $row['timestamp'] ?? $row['col_a'] ?? '';
            $rowData['Nama Admin'] = $row['col_b'] ?? '';
            $rowData['NPK'] = $row['col_c'] ?? '';
            $rowData['Jabatan'] = $row['col_d'] ?? '';
            $rowData['Tanggal Pembukaan Backdate'] = $row['col_e'] ?? '';
            $rowData['Alasan Pembukaan Backdate (diisi alasan dan siapa yang memberikan perintah pembukaan backdate)'] = $row['col_f'] ?? '';
            $rowData['Nama yang Dibuka Backdate'] = $row['col_g'] ?? '';
            $rowData['Departemen yang dibukakan Backdate'] = $row['col_h'] ?? '';
            $rowData['Nomor Surat Backdate DOF'] = $row['nomor_surat_key'] ?? $row['col_i'] ?? '';
            $rowData['Email Address'] = $row['col_j'] ?? '';
            $rowData['Status'] = $row['status'] ?? '';
            $rowData['Flag'] = $row['flag'] ?? '';
            $rowData['Waktu Selesai'] = $row['timestamp_selesai'] ?? '';
        } else {
            // Headers untuk permintaan (sesuai struktur spreadsheet sebenarnya)
            if (empty($headers)) {
                $headers = [
                    'Timestamp', 'NPK', 'Nama Lengkap', 'Unit Kerja :', 
                    'No Telepon (HP)', 'No Surat', 'Pilih Permintaan', 
                    'Status Surat', 'Alasan Permintaan/Permintaan', 
                    'Email Address', 'Jenis Surat', 'Isi Penjelasan Singkat Permintaanya',
                    'Status', 'Flag', 'Petugas', 'Waktu Selesai', 
                    'Keterangan', 'Persetujuan'
                ];
            }
            
            // Mapping sesuai struktur spreadsheet sebenarnya
            $rowData['Timestamp'] = $row['timestamp'] ?? $row['col_a'] ?? '';
            $rowData['NPK'] = $row['col_b'] ?? '';
            $rowData['Nama Lengkap'] = $row['col_c'] ?? '';
            $rowData['Unit Kerja :'] = $row['col_d'] ?? '';
            $rowData['No Telepon (HP)'] = $row['col_e'] ?? '';
            $rowData['No Surat'] = $row['col_f'] ?? '';
            $rowData['Pilih Permintaan'] = $row['pilih_permintaan'] ?? '';
            $rowData['Status Surat'] = $row['col_g'] ?? '';
            $rowData['Alasan Permintaan/Permintaan'] = $row['alasan_permintaan'] ?? '';
            $rowData['Email Address'] = $row['col_h'] ?? '';
            $rowData['Jenis Surat'] = $row['col_i'] ?? '';
            $rowData['Isi Penjelasan Singkat Permintaanya'] = $row['col_j'] ?? '';
            $rowData['Status'] = $row['status'] ?? '';
            $rowData['Flag'] = $row['flag'] ?? '';
            $rowData['Petugas'] = $row['petugas'] ?? '';
            $rowData['Waktu Selesai'] = $row['waktu_selesai'] ?? '';
            $rowData['Keterangan'] = $row['keterangan'] ?? '';
            $rowData['Persetujuan'] = $row['persetujuan'] ?? '';
        }
        
        $data[] = $rowData;
    }
    
    sendJSONResponse(true, $data, null, $headers);
}

// Handler untuk batchUpdate
function handleBatchUpdate($conn) {
    $rowNumber = intval($_GET['rowNumber'] ?? 0);
    $table = $_GET['table'] ?? 'permintaan';
    
    if ($rowNumber <= 0) {
        throw new Exception("Row number tidak valid");
    }
    
    $tableName = $table === 'backdate' ? 'backdate' : 'permintaan';
    
    // Build update query
    $updates = [];
    $params = [];
    $types = '';
    
    if (isset($_GET['status'])) {
        $updates[] = "`status` = ?";
        $params[] = $_GET['status'];
        $types .= 's';
    }
    
    if (isset($_GET['flag'])) {
        $updates[] = "`flag` = ?";
        $params[] = $_GET['flag'];
        $types .= 's';
    }
    
    if (isset($_GET['petugas'])) {
        $updates[] = "`petugas` = ?";
        $params[] = $_GET['petugas'];
        $types .= 's';
    }
    
    if (isset($_GET['waktuSelesai'])) {
        $updates[] = "`waktu_selesai` = ?";
        // Convert ISO 8601 format ke MySQL DATETIME format
        $waktuSelesai = convertToMySQLDateTime($_GET['waktuSelesai']);
        $params[] = $waktuSelesai;
        $types .= 's';
    }
    
    if (isset($_GET['keterangan'])) {
        $updates[] = "`keterangan` = ?";
        $params[] = $_GET['keterangan'];
        $types .= 's';
    }
    
    if (isset($_GET['persetujuan'])) {
        $updates[] = "`persetujuan` = ?";
        $params[] = $_GET['persetujuan'];
        $types .= 's';
    }
    
    if (isset($_GET['timestamp']) && $table === 'backdate') {
        $updates[] = "`timestamp_selesai` = ?";
        // Convert ISO 8601 format ke MySQL DATETIME format
        $timestamp = convertToMySQLDateTime($_GET['timestamp']);
        $params[] = $timestamp;
        $types .= 's';
    }
    
    if (empty($updates)) {
        throw new Exception("Tidak ada data untuk diupdate");
    }
    
    $params[] = $rowNumber;
    $types .= 'i';
    
    $sql = "UPDATE `{$tableName}` SET " . implode(', ', $updates) . " WHERE `row_number` = ?";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    $stmt->bind_param($types, ...$params);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Data berhasil diupdate']);
}

// Handler untuk getAllPerjanjian
function handleGetAllPerjanjian($conn) {
    $sql = "SELECT * FROM `perjanjian` ORDER BY `id` DESC";
    $result = $conn->query($sql);
    
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = [
            'No' => $row['id'],
            'UNIT KERJA' => $row['unit_kerja'],
            'NO SURAT BACKDATE' => $row['no_sp'],  // NO SP = NO SURAT BACKDATE
            'NO SP' => $row['no_sp'],  // Kompatibilitas dengan kode lama
            'PERIHAL' => $row['perihal'],
            'NO SURAT PERMINTAAN BACKDATE' => $row['key_nomor_surat'],  // Key untuk menghubungkan dengan backdate
            'Key' => $row['key_nomor_surat'],  // Kompatibilitas dengan kode lama
            'rowNumber' => $row['row_number']
        ];
    }
    
    sendJSONResponse(true, $data);
}

// Handler untuk getPerjanjian
function handleGetPerjanjian($conn) {
    $key = $_GET['key'] ?? '';
    
    if (empty($key)) {
        throw new Exception("Key tidak boleh kosong");
    }
    
    $sql = "SELECT * FROM `perjanjian` WHERE `key_nomor_surat` = ? ORDER BY `id` DESC";
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = [
            'UNIT KERJA' => $row['unit_kerja'],
            'NO SURAT BACKDATE' => $row['no_sp'],  // NO SP = NO SURAT BACKDATE
            'NO SP' => $row['no_sp'],  // Kompatibilitas dengan kode lama
            'PERIHAL' => $row['perihal'],
            'NO SURAT PERMINTAAN BACKDATE' => $row['key_nomor_surat'],  // Key untuk menghubungkan dengan backdate
            'Key' => $row['key_nomor_surat'],  // Kompatibilitas dengan kode lama
            'rowNumber' => $row['row_number'],
            'createdAt' => $row['created_at']
        ];
    }
    
    $stmt->close();
    
    sendJSONResponse(true, $data);
}

// Handler untuk savePerjanjian
function handleSavePerjanjian($conn) {
    $unitKerja = $_GET['unitKerja'] ?? $_POST['unitKerja'] ?? '';
    $noSP = $_GET['noSP'] ?? $_POST['noSP'] ?? '';
    $perihal = $_GET['perihal'] ?? $_POST['perihal'] ?? '';
    $key = $_GET['key'] ?? $_POST['key'] ?? '';
    
    if (empty($unitKerja) || empty($noSP) || empty($perihal) || empty($key)) {
        throw new Exception("Semua field harus diisi");
    }
    
    // Get max row_number
    $maxRowQuery = "SELECT MAX(`row_number`) as max_row FROM `perjanjian`";
    $maxResult = $conn->query($maxRowQuery);
    $maxRow = 1;
    if ($maxResult && $row = $maxResult->fetch_assoc()) {
        $maxRow = ($row['max_row'] ?? 0) + 1;
    }
    
    $sql = "INSERT INTO `perjanjian` (`row_number`, `unit_kerja`, `no_sp`, `perihal`, `key_nomor_surat`) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    $stmt->bind_param('issss', $maxRow, $unitKerja, $noSP, $perihal, $key);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Data perjanjian berhasil disimpan']);
}

// Handler untuk deletePerjanjian
function handleDeletePerjanjian($conn) {
    $rowNumber = intval($_GET['rowNumber'] ?? 0);
    $key = $_GET['key'] ?? '';
    
    if ($rowNumber <= 0) {
        throw new Exception("Row number tidak valid");
    }
    
    $sql = "DELETE FROM `perjanjian` WHERE `row_number` = ? AND `key_nomor_surat` = ?";
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    $stmt->bind_param('is', $rowNumber, $key);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Data perjanjian berhasil dihapus']);
}

// Handler untuk insertBackdate
function handleInsertBackdate($conn) {
    // Get data dari POST atau GET
    $namaAdmin = $_POST['namaAdmin'] ?? $_GET['namaAdmin'] ?? '';
    $npk = $_POST['npk'] ?? $_GET['npk'] ?? '';
    $jabatan = $_POST['jabatan'] ?? $_GET['jabatan'] ?? '';
    $tanggalBackdate = $_POST['tanggalBackdate'] ?? $_GET['tanggalBackdate'] ?? '';
    $alasanBackdate = $_POST['alasanBackdate'] ?? $_GET['alasanBackdate'] ?? '';
    $namaDibuka = $_POST['namaDibuka'] ?? $_GET['namaDibuka'] ?? '';
    $departemen = $_POST['departemen'] ?? $_GET['departemen'] ?? '';
    $nomorSurat = $_POST['nomorSurat'] ?? $_GET['nomorSurat'] ?? '';
    $email = $_POST['email'] ?? $_GET['email'] ?? '';
    
    // Validasi field wajib dengan pesan yang lebih spesifik
    $missingFields = [];
    if (empty($namaAdmin) || trim($namaAdmin) === '') $missingFields[] = 'Nama Admin';
    if (empty($npk) || trim($npk) === '') $missingFields[] = 'NPK';
    if (empty($jabatan) || trim($jabatan) === '') $missingFields[] = 'Jabatan';
    if (empty($tanggalBackdate) || trim($tanggalBackdate) === '') $missingFields[] = 'Tanggal Pembukaan Backdate';
    if (empty($alasanBackdate) || trim($alasanBackdate) === '') $missingFields[] = 'Alasan Pembukaan Backdate';
    if (empty($namaDibuka) || trim($namaDibuka) === '') $missingFields[] = 'Nama yang Dibuka Backdate';
    if (empty($departemen) || trim($departemen) === '') $missingFields[] = 'Departemen';
    if (empty($nomorSurat) || trim($nomorSurat) === '') $missingFields[] = 'Nomor Surat Backdate DOF';
    if (empty($email) || trim($email) === '') $missingFields[] = 'Email Address';
    
    if (!empty($missingFields)) {
        throw new Exception("Field wajib yang belum diisi: " . implode(', ', $missingFields));
    }
    
    // Get max row_number
    $maxRowQuery = "SELECT MAX(`row_number`) as max_row FROM `backdate`";
    $maxResult = $conn->query($maxRowQuery);
    $maxRow = 1;
    if ($maxResult && $row = $maxResult->fetch_assoc()) {
        $maxRow = ($row['max_row'] ?? 0) + 1;
    }
    
    // Timestamp sekarang
    $timestamp = date('Y-m-d H:i:s');
    
    // Convert tanggal backdate ke format yang benar jika perlu
    if ($tanggalBackdate) {
        $tanggalBackdateConverted = convertToMySQLDateTime($tanggalBackdate);
        if ($tanggalBackdateConverted) {
            $tanggalBackdate = $tanggalBackdateConverted;
        }
    }
    
    // Insert data
    $sql = "INSERT INTO `backdate` (
        `row_number`, `col_a`, `col_b`, `col_c`, `col_d`, `col_e`, `col_f`, `col_g`, `col_h`, `col_i`, `col_j`,
        `nomor_surat_key`, `timestamp`, `status`, `flag`, `timestamp_selesai`
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    // Mapping: col_a = timestamp, col_b = nama admin, col_c = npk, col_d = jabatan,
    // col_e = tanggal backdate, col_f = alasan, col_g = nama dibuka, col_h = departemen,
    // col_i = nomor surat, col_j = email
    $status = 'Open';
    $flag = '';
    $timestampSelesai = null;
    
    // Bind parameter
    $types = 'isssssssssssssss';
    $stmt->bind_param($types,
        $maxRow, $timestamp, $namaAdmin, $npk, $jabatan, $tanggalBackdate, $alasanBackdate,
        $namaDibuka, $departemen, $nomorSurat, $email,
        $nomorSurat, $timestamp, $status, $flag, $timestampSelesai
    );
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Data backdate berhasil disimpan', 'rowNumber' => $maxRow]);
}
