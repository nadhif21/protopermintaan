<?php
require_once 'config.php';

// Fungsi untuk convert format datetime dari ISO 8601 ke MySQL DATETIME
function convertToMySQLDateTime($dateString) {
    if (empty($dateString) || trim($dateString) === '') {
        return null;
    }
    
    $dateString = trim($dateString);
    
    // Handle format datetime-local: 2026-03-06T08:03 (tanpa seconds)
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/', $dateString, $matches)) {
        $year = $matches[1];
        $month = $matches[2];
        $day = $matches[3];
        $hour = $matches[4];
        $minute = $matches[5];
        return "$year-$month-$day $hour:$minute:00";
    }
    
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

// Get action from request (support both GET and POST)
$action = $_GET['action'] ?? $_POST['action'] ?? '';
// Merge GET and POST for parameter access
$_REQUEST = array_merge($_GET, $_POST);

try {
    $conn = getDBConnection();
    
    switch ($action) {
        case 'login':
            handleLogin($conn);
            break;
        case 'me':
            handleMe($conn);
            break;
        case 'logout':
            handleLogout($conn);
            break;
        case 'listUsers':
            handleListUsers($conn);
            break;
        case 'createUser':
            handleCreateUser($conn);
            break;
        case 'updateUser':
            handleUpdateUser($conn);
            break;
        case 'resetUserPassword':
            handleResetUserPassword($conn);
            break;
        case 'disableUser':
            handleDisableUser($conn);
            break;
        case 'getAuditLogs':
            handleGetAuditLogs($conn);
            break;

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
            
        case 'updatePermintaanFields':
            handleUpdatePermintaanFields($conn);
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

// =========================
// AUTH / SUPER ADMIN APIs
// =========================

function getRequestParam($key, $default = '') {
    return $_POST[$key] ?? $_GET[$key] ?? $default;
}

function getAuthTokenFromRequest() {
    $token = '';

    // 1) Header: X-Auth-Token
    if (isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        $token = trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }

    // 2) Fallback: token query param (untuk kemudahan dev)
    if ($token === '') {
        $token = trim(getRequestParam('token', ''));
    }

    return $token;
}

function generateToken() {
    return bin2hex(random_bytes(32)); // 64 chars
}

function getClientIp() {
    return $_SERVER['REMOTE_ADDR'] ?? null;
}

function auditLog($conn, $userId, $action, $target = null, $meta = null) {
    try {
        $ip = getClientIp();
        // Gabungkan target dan meta menjadi description
        $description = '';
        if ($target) {
            $description = $target;
        }
        if ($meta !== null) {
            $metaStr = is_array($meta) ? json_encode($meta, JSON_UNESCAPED_UNICODE) : (string)$meta;
            if ($description) {
                $description .= ' | ' . $metaStr;
            } else {
                $description = $metaStr;
            }
        }
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        $sql = "INSERT INTO `audit_logs` (`user_id`, `action`, `description`, `ip_address`, `user_agent`) VALUES (?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        if (!$stmt) return;
        $stmt->bind_param('issss', $userId, $action, $description, $ip, $userAgent);
        $stmt->execute();
        $stmt->close();
    } catch (Exception $e) {
        // Jangan ganggu flow utama kalau audit gagal
        error_log("Audit log error: " . $e->getMessage());
    }
}

function requireAuth($conn) {
    $token = getAuthTokenFromRequest();
    if ($token === '') {
        throw new Exception("Tidak terautentikasi. Token tidak ditemukan.");
    }

    // Hapus session expired (best effort)
    $conn->query("DELETE FROM `auth_sessions` WHERE `expires_at` < NOW()");

    $sql = "SELECT s.`user_id`, s.`token`, s.`expires_at`, u.`username`, u.`name`, u.`role`, u.`is_active`
            FROM `auth_sessions` s
            JOIN `users` u ON u.`id` = s.`user_id`
            WHERE s.`token` = ?
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        throw new Exception("Session tidak valid atau sudah logout.");
    }
    if (intval($row['is_active']) !== 1) {
        throw new Exception("Akun nonaktif.");
    }

    return [
        'user_id' => intval($row['user_id']),
        'token' => $row['token'],
        'expires_at' => $row['expires_at'],
        'username' => $row['username'],
        'name' => $row['name'],
        'role' => $row['role']
    ];
}

function requireSuperAdmin($conn) {
    $session = requireAuth($conn);
    if (($session['role'] ?? '') !== 'super_admin') {
        throw new Exception("Akses ditolak: butuh role super_admin.");
    }
    return $session;
}

function handleLogin($conn) {
    $username = trim(getRequestParam('username', ''));
    $password = getRequestParam('password', '');

    if ($username === '' || $password === '') {
        throw new Exception("Username dan password wajib diisi.");
    }

    $sql = "SELECT `id`, `username`, `name`, `role`, `password`, `password_hash`, `is_active` FROM `users` WHERE `username` = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$user) {
        auditLog($conn, 0, 'login_failed', 'user', ['username' => $username, 'reason' => 'not_found']);
        throw new Exception("Username atau password salah.");
    }
    if (intval($user['is_active']) !== 1) {
        auditLog($conn, intval($user['id']), 'login_failed', 'user', ['reason' => 'inactive']);
        throw new Exception("Akun nonaktif.");
    }
    
    // Check password (plain text comparison)
    $storedPassword = $user['password'] ?? $user['password_hash'] ?? '';
    if ($password !== $storedPassword) {
        auditLog($conn, intval($user['id']), 'login_failed', 'user', ['reason' => 'bad_password']);
        throw new Exception("Username atau password salah.");
    }

    $token = generateToken();
    $expiresAt = date('Y-m-d H:i:s', time() + (24 * 60 * 60)); // 24 jam

    $sql2 = "INSERT INTO `auth_sessions` (`user_id`, `token`, `expires_at`) VALUES (?, ?, ?)";
    $stmt2 = $conn->prepare($sql2);
    if (!$stmt2) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $userId = intval($user['id']);
    $stmt2->bind_param('iss', $userId, $token, $expiresAt);
    if (!$stmt2->execute()) {
        throw new Exception("Execute error: " . $stmt2->error);
    }
    $stmt2->close();

    auditLog($conn, $userId, 'login_success', 'user', ['username' => $user['username']]);

    sendJSONResponse(true, [
        'token' => $token,
        'expiresAt' => $expiresAt,
        'user' => [
            'id' => $userId,
            'username' => $user['username'],
            'name' => $user['name'],
            'role' => $user['role']
        ]
    ]);
}

function handleMe($conn) {
    $session = requireAuth($conn);
    sendJSONResponse(true, [
        'user' => [
            'id' => $session['user_id'],
            'username' => $session['username'],
            'name' => $session['name'],
            'role' => $session['role']
        ],
        'expiresAt' => $session['expires_at']
    ]);
}

function handleLogout($conn) {
    $token = getAuthTokenFromRequest();
    if ($token !== '') {
        $sql = "DELETE FROM `auth_sessions` WHERE `token` = ?";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param('s', $token);
            $stmt->execute();
            $stmt->close();
        }
    }
    sendJSONResponse(true, ['message' => 'Logout berhasil']);
}

function handleListUsers($conn) {
    $session = requireSuperAdmin($conn);

    $result = $conn->query("SELECT `id`,`username`,`name`,`role`,`is_active`,`created_at`,`updated_at` FROM `users` ORDER BY `role` ASC, `username` ASC");
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'name' => $row['name'],
            'role' => $row['role'],
            'isActive' => intval($row['is_active']) === 1,
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at']
        ];
    }

    auditLog($conn, $session['user_id'], 'list_users', 'user');
    sendJSONResponse(true, $users);
}

function handleCreateUser($conn) {
    $session = requireSuperAdmin($conn);

    $username = trim(getRequestParam('username', ''));
    $name = trim(getRequestParam('name', ''));
    $role = trim(getRequestParam('role', 'user'));
    $password = getRequestParam('password', '');

    if ($username === '' || $name === '' || $password === '') {
        throw new Exception("username, name, dan password wajib diisi.");
    }
    if (!preg_match('/^[a-zA-Z0-9._-]{3,50}$/', $username)) {
        throw new Exception("Username tidak valid. Gunakan 3-50 karakter: huruf/angka/._-");
    }
    $allowedRoles = ['super_admin', 'admin', 'user'];
    if (!in_array($role, $allowedRoles, true)) {
        throw new Exception("Role tidak valid.");
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $sql = "INSERT INTO `users` (`username`,`name`,`role`,`password_hash`,`is_active`) VALUES (?,?,?,?,1)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('ssss', $username, $name, $role, $passwordHash);
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception("Gagal membuat user: " . $err);
    }
    $newId = $stmt->insert_id;
    $stmt->close();

    auditLog($conn, $session['user_id'], 'create_user', 'user', ['createdUserId' => $newId, 'username' => $username, 'role' => $role]);
    sendJSONResponse(true, ['message' => 'User berhasil dibuat', 'id' => $newId]);
}

function handleUpdateUser($conn) {
    $session = requireSuperAdmin($conn);

    $id = intval(getRequestParam('id', 0));
    $name = trim(getRequestParam('name', ''));
    $role = trim(getRequestParam('role', ''));
    $isActive = getRequestParam('isActive', null);

    if ($id <= 0) {
        throw new Exception("ID user tidak valid.");
    }

    $updates = [];
    $params = [];
    $types = '';

    if ($name !== '') {
        $updates[] = "`name` = ?";
        $params[] = $name;
        $types .= 's';
    }

    if ($role !== '') {
        $allowedRoles = ['super_admin', 'admin', 'user'];
        if (!in_array($role, $allowedRoles, true)) {
            throw new Exception("Role tidak valid.");
        }
        $updates[] = "`role` = ?";
        $params[] = $role;
        $types .= 's';
    }

    if ($isActive !== null) {
        $isActiveVal = ($isActive === '1' || $isActive === 1 || $isActive === true || $isActive === 'true') ? 1 : 0;
        $updates[] = "`is_active` = ?";
        $params[] = $isActiveVal;
        $types .= 'i';
    }

    if (empty($updates)) {
        throw new Exception("Tidak ada field untuk diupdate.");
    }

    $params[] = $id;
    $types .= 'i';

    // Prevent locking yourself out: jangan boleh menonaktifkan diri sendiri
    if ($id === intval($session['user_id'])) {
        if ($isActive !== null) {
            $isActiveVal = ($isActive === '1' || $isActive === 1 || $isActive === true || $isActive === 'true') ? 1 : 0;
            if ($isActiveVal === 0) {
                throw new Exception("Tidak boleh menonaktifkan akun sendiri.");
            }
        }
        if ($role !== '' && $role !== 'super_admin') {
            throw new Exception("Tidak boleh menurunkan role akun sendiri.");
        }
    }

    $sql = "UPDATE `users` SET " . implode(', ', $updates) . " WHERE `id` = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    $stmt->close();

    auditLog($conn, $session['user_id'], 'update_user', 'user', ['targetUserId' => $id]);
    sendJSONResponse(true, ['message' => 'User berhasil diupdate']);
}

function handleResetUserPassword($conn) {
    $session = requireSuperAdmin($conn);

    $id = intval(getRequestParam('id', 0));
    $newPassword = getRequestParam('newPassword', '');

    if ($id <= 0) {
        throw new Exception("ID user tidak valid.");
    }
    if ($newPassword === '') {
        throw new Exception("Password baru wajib diisi.");
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $sql = "UPDATE `users` SET `password_hash` = ? WHERE `id` = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new Exception("Prepare error: " . $conn->error);
    $stmt->bind_param('si', $hash, $id);
    if (!$stmt->execute()) throw new Exception("Execute error: " . $stmt->error);
    $stmt->close();

    // Optional: revoke sessions user tsb
    $sql2 = "DELETE FROM `auth_sessions` WHERE `user_id` = ?";
    $stmt2 = $conn->prepare($sql2);
    if ($stmt2) {
        $stmt2->bind_param('i', $id);
        $stmt2->execute();
        $stmt2->close();
    }

    auditLog($conn, $session['user_id'], 'reset_password', 'user', ['targetUserId' => $id]);
    sendJSONResponse(true, ['message' => 'Password user berhasil direset (semua session dicabut)']);
}

function handleDisableUser($conn) {
    // alias convenience: disableUser?id=123&isActive=0/1
    handleUpdateUser($conn);
}

function handleGetAuditLogs($conn) {
    $session = requireSuperAdmin($conn);

    $limit = intval(getRequestParam('limit', 50));
    if ($limit <= 0) $limit = 50;
    if ($limit > 200) $limit = 200;

    $sql = "SELECT a.`id`, a.`user_id`, u.`username`, a.`action`, a.`description`, a.`ip_address`, a.`created_at`
            FROM `audit_logs` a
            LEFT JOIN `users` u ON u.`id` = a.`user_id`
            ORDER BY a.`id` DESC
            LIMIT ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new Exception("Prepare error: " . $conn->error);
    $stmt->bind_param('i', $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($r = $result->fetch_assoc()) {
        $rows[] = [
            'id' => intval($r['id']),
            'userId' => $r['user_id'] !== null ? intval($r['user_id']) : null,
            'username' => $r['username'] ?? null,
            'action' => $r['action'],
            'target' => $r['description'] ?? '',
            'meta' => null,
            'ipAddress' => $r['ip_address'],
            'createdAt' => $r['created_at']
        ];
    }
    $stmt->close();

    sendJSONResponse(true, $rows);
}

// Handler untuk getData (permintaan atau backdate)
function handleGetData($conn) {
    // Allow access without auth for backward compatibility
    // Super admin can also access via token
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
        $rowData['id'] = intval($row['id']);
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
            
            // Mapping menggunakan kolom yang jelas (dengan fallback ke col_a-col_j untuk backward compatibility)
            $rowData['Timestamp'] = $row['timestamp_data'] ?? $row['timestamp'] ?? $row['col_a'] ?? '';
            $rowData['Nama Admin'] = $row['nama_admin'] ?? $row['col_b'] ?? '';
            $rowData['NPK'] = $row['npk'] ?? $row['col_c'] ?? '';
            $rowData['Jabatan'] = $row['jabatan'] ?? $row['col_d'] ?? '';
            $rowData['Tanggal Pembukaan Backdate'] = $row['tanggal_pembukaan'] ?? $row['col_e'] ?? '';
            $rowData['Alasan Pembukaan Backdate (diisi alasan dan siapa yang memberikan perintah pembukaan backdate)'] = $row['alasan_pembukaan'] ?? $row['col_f'] ?? '';
            $rowData['Nama yang Dibuka Backdate'] = $row['nama_dibuka'] ?? $row['col_g'] ?? '';
            $rowData['Departemen yang dibukakan Backdate'] = $row['departemen'] ?? $row['col_h'] ?? '';
            $rowData['Nomor Surat Backdate DOF'] = $row['nomor_surat_dof'] ?? $row['nomor_surat_key'] ?? $row['col_i'] ?? '';
            $rowData['Email Address'] = $row['email_address'] ?? $row['col_j'] ?? '';
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
            
            // Mapping menggunakan kolom yang jelas (dengan fallback ke col_a-col_j untuk backward compatibility)
            $rowData['Timestamp'] = $row['timestamp_data'] ?? $row['timestamp'] ?? $row['col_a'] ?? '';
            $rowData['NPK'] = $row['npk'] ?? $row['col_b'] ?? '';
            $rowData['Nama Lengkap'] = $row['nama_lengkap'] ?? $row['col_c'] ?? '';
            $rowData['Unit Kerja :'] = $row['unit_kerja'] ?? $row['col_d'] ?? '';
            $rowData['No Telepon (HP)'] = $row['no_telepon'] ?? $row['col_e'] ?? '';
            $rowData['No Surat'] = $row['no_surat'] ?? $row['col_f'] ?? '';
            $rowData['Pilih Permintaan'] = $row['pilih_permintaan'] ?? '';
            $rowData['Status Surat'] = $row['status_surat'] ?? $row['col_g'] ?? '';
            $rowData['Alasan Permintaan/Permintaan'] = $row['alasan_permintaan'] ?? '';
            $rowData['Email Address'] = $row['email_address'] ?? $row['col_h'] ?? '';
            $rowData['Jenis Surat'] = $row['jenis_surat'] ?? $row['col_i'] ?? '';
            $rowData['Isi Penjelasan Singkat Permintaanya'] = $row['isi_penjelasan'] ?? $row['col_j'] ?? '';
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

// Handler untuk batchUpdate (tidak memerlukan auth untuk backward compatibility)
function handleBatchUpdate($conn) {
    // Allow access without auth for backward compatibility
    // Auth is optional but not required
    
    // Support both GET and POST
    $rowNumber = intval($_REQUEST['rowNumber'] ?? 0);
    $table = $_REQUEST['table'] ?? 'permintaan';
    
    if ($rowNumber <= 0) {
        throw new Exception("Row number tidak valid");
    }
    
    $tableName = $table === 'backdate' ? 'backdate' : 'permintaan';
    
    // Build update query
    $updates = [];
    $params = [];
    $types = '';
    
    if (isset($_REQUEST['status'])) {
        $updates[] = "`status` = ?";
        $params[] = $_REQUEST['status'];
        $types .= 's';
    }
    
    if (isset($_REQUEST['flag'])) {
        $updates[] = "`flag` = ?";
        $params[] = $_REQUEST['flag'];
        $types .= 's';
    }
    
    if (isset($_REQUEST['petugas'])) {
        $updates[] = "`petugas` = ?";
        $params[] = $_REQUEST['petugas'];
        $types .= 's';
    }
    
    if (isset($_REQUEST['waktuSelesai'])) {
        $updates[] = "`waktu_selesai` = ?";
        // Convert ISO 8601 format ke MySQL DATETIME format
        $waktuSelesai = convertToMySQLDateTime($_REQUEST['waktuSelesai']);
        $params[] = $waktuSelesai;
        $types .= 's';
    }
    
    if (isset($_REQUEST['keterangan'])) {
        $updates[] = "`keterangan` = ?";
        $params[] = $_REQUEST['keterangan'];
        $types .= 's';
    }
    
    if (isset($_REQUEST['persetujuan'])) {
        $updates[] = "`persetujuan` = ?";
        $params[] = $_REQUEST['persetujuan'];
        $types .= 's';
    }
    
    if (isset($_REQUEST['timestamp']) && $table === 'backdate') {
        $updates[] = "`timestamp_selesai` = ?";
        // Convert ISO 8601 format ke MySQL DATETIME format
        $timestamp = convertToMySQLDateTime($_REQUEST['timestamp']);
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

// Handler untuk updatePermintaanFields (update semua field permintaan)
function handleUpdatePermintaanFields($conn) {
    // Allow access without auth for backward compatibility
    // Auth is optional but recommended
    $rowNumber = intval($_REQUEST['rowNumber'] ?? 0);
    
    if ($rowNumber <= 0) {
        throw new Exception("Row number tidak valid");
    }
    
    // Build update query untuk semua kolom yang bisa diupdate
    $updates = [];
    $params = [];
    $types = '';
    
    // Mapping field ke kolom database (menggunakan kolom yang jelas)
    $fieldMap = [
        // Kolom baru yang jelas
        'timestamp_data' => 'timestamp_data',
        'npk' => 'npk',
        'nama_lengkap' => 'nama_lengkap',
        'unit_kerja' => 'unit_kerja',
        'no_telepon' => 'no_telepon',
        'no_surat' => 'no_surat',
        'status_surat' => 'status_surat',
        'email_address' => 'email_address',
        'jenis_surat' => 'jenis_surat',
        'isi_penjelasan' => 'isi_penjelasan',
        // Kolom yang sudah jelas
        'pilih_permintaan' => 'pilih_permintaan',
        'alasan_permintaan' => 'alasan_permintaan',
        'status' => 'status',
        'flag' => 'flag',
        'petugas' => 'petugas',
        'keterangan' => 'keterangan',
        'persetujuan' => 'persetujuan',
        'waktu_selesai' => 'waktu_selesai',
        // Backward compatibility dengan col_a-col_j
        'col_a' => 'timestamp_data',
        'col_b' => 'npk',
        'col_c' => 'nama_lengkap',
        'col_d' => 'unit_kerja',
        'col_e' => 'no_telepon',
        'col_f' => 'no_surat',
        'col_g' => 'status_surat',
        'col_h' => 'email_address',
        'col_i' => 'jenis_surat',
        'col_j' => 'isi_penjelasan'
    ];
    
    foreach ($fieldMap as $field => $colName) {
        if (isset($_REQUEST[$field])) {
            $value = $_REQUEST[$field];
            
            // Handle waktu_selesai dan timestamp_data: allow NULL or convert datetime
            if ($field === 'waktu_selesai' || $field === 'timestamp_data' || $colName === 'timestamp_data') {
                if ($value === '__NULL__' || empty($value) || trim($value) === '') {
                    // Set to NULL to clear the value
                    $updates[] = "`{$colName}` = NULL";
                    // Don't add to params for NULL values
                    continue;
                } else {
                    // Convert datetime-local format to MySQL DATETIME
                    $value = convertToMySQLDateTime($value);
                    if (!$value) {
                        continue; // Skip if conversion failed
                    }
                }
            }
            
            $updates[] = "`{$colName}` = ?";
            $params[] = $value;
            $types .= 's';
        }
    }
    
    if (empty($updates)) {
        throw new Exception("Tidak ada data untuk diupdate");
    }
    
    $params[] = $rowNumber;
    $types .= 'i';
    
    // Try to find the row first to verify row_number exists
    $checkSql = "SELECT `id`, `row_number` FROM `permintaan` WHERE `row_number` = ? LIMIT 1";
    $checkStmt = $conn->prepare($checkSql);
    if (!$checkStmt) {
        throw new Exception("Prepare error (check): " . $conn->error);
    }
    $checkStmt->bind_param('i', $rowNumber);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $checkRow = $checkResult->fetch_assoc();
    $checkStmt->close();
    
    if (!$checkRow) {
        throw new Exception("Row dengan row_number {$rowNumber} tidak ditemukan di database.");
    }
    
    $sql = "UPDATE `permintaan` SET " . implode(', ', $updates) . " WHERE `row_number` = ?";
    
    // Debug: log the SQL query
    error_log("Update SQL: " . $sql);
    error_log("Row number: " . $rowNumber);
    error_log("Params: " . json_encode($params));
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    $stmt->bind_param($types, ...$params);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    
    $affectedRows = $stmt->affected_rows;
    $stmt->close();
    
    // Note: affected_rows can be 0 if the new values are the same as existing values
    // This is not necessarily an error - MySQL doesn't update if values are identical
    // We'll still return success if the row was found and the query executed successfully
    if ($affectedRows === 0) {
        // Check if the values are actually different by comparing current DB values
        $verifySql = "SELECT " . implode(', ', array_map(function($col) {
            return "`{$col}`";
        }, array_values($fieldMap))) . " FROM `permintaan` WHERE `row_number` = ? LIMIT 1";
        $verifyStmt = $conn->prepare($verifySql);
        if ($verifyStmt) {
            $verifyStmt->bind_param('i', $rowNumber);
            $verifyStmt->execute();
            $verifyResult = $verifyStmt->get_result();
            $verifyRow = $verifyResult->fetch_assoc();
            $verifyStmt->close();
            
            // If row exists, consider it success even if no rows were affected
            // (this means the values were already set to what we're trying to set)
            if ($verifyRow) {
                sendJSONResponse(true, ['message' => 'Data sudah sesuai dengan nilai yang diinginkan', 'affected_rows' => 0]);
                return;
            }
        }
        throw new Exception("Tidak ada baris yang terupdate. Row ditemukan tapi tidak ada perubahan data.");
    }
    
    sendJSONResponse(true, ['message' => 'Data permintaan berhasil diupdate', 'affected_rows' => $affectedRows]);
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
