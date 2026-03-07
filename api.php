<?php
// Disable error display, but log errors
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

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
        case 'deleteUser':
            handleDeleteUser($conn);
            break;
        case 'disableUser':
            handleDisableUser($conn);
            break;
        case 'getAuditLogs':
            handleGetAuditLogs($conn);
            break;
        case 'register':
            handleRegister($conn);
            break;
        case 'listRegistrations':
            handleListRegistrations($conn);
            break;
        case 'approveRegistration':
            handleApproveRegistration($conn);
            break;
        case 'rejectRegistration':
            handleRejectRegistration($conn);
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
            
        case 'getUnitKerja':
            handleGetUnitKerja($conn);
            break;
            
        case 'getPilihPermintaanOptions':
            handleGetPilihPermintaanOptions($conn);
            break;
            
        case 'addPilihPermintaanOption':
            handleAddPilihPermintaanOption($conn);
            break;
            
        case 'updatePilihPermintaanOption':
            handleUpdatePilihPermintaanOption($conn);
            break;
            
        case 'deletePilihPermintaanOption':
            handleDeletePilihPermintaanOption($conn);
            break;
            
        case 'getPetugas':
            handleGetPetugas($conn);
            break;
            
        case 'changePassword':
            handleChangePassword($conn);
            break;
            
        case 'submitPermintaan':
            handleSubmitPermintaan($conn);
            break;
            
        case 'insertBackdate':
            handleInsertBackdate($conn);
            break;
            
        case 'getApprovalPin':
            handleGetApprovalPin($conn);
            break;
            
        case 'setApprovalPin':
            handleSetApprovalPin($conn);
            break;
            
        case 'validateApprovalPin':
            handleValidateApprovalPin($conn);
            break;
            
        default:
            sendJSONResponse(false, null, 'Action tidak valid');
    }
} catch (Exception $e) {
    // Clear any output buffer
    ob_clean();
    error_log("API Error: " . $e->getMessage());
    sendJSONResponse(false, null, $e->getMessage());
} catch (Error $e) {
    // Catch PHP 7+ errors
    ob_clean();
    error_log("API Fatal Error: " . $e->getMessage());
    sendJSONResponse(false, null, "Terjadi kesalahan sistem: " . $e->getMessage());
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

function requireAdminOrSuperAdmin($conn) {
    $session = requireAuth($conn);
    $role = $session['role'] ?? '';
    if ($role !== 'admin' && $role !== 'super_admin') {
        throw new Exception("Akses ditolak: butuh role admin atau super_admin.");
    }
    return $session;
}

function handleLogin($conn) {
    $username = trim(getRequestParam('username', ''));
    $password = getRequestParam('password', '');

    if ($username === '' || $password === '') {
        throw new Exception("Username/email dan password wajib diisi.");
    }

    // Check if email column exists
    $checkColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'email'");
    $hasEmailColumn = $checkColumn && $checkColumn->num_rows > 0;
    
    $user = null;
    
    // Check if password column exists (for backward compatibility)
    $checkPasswordColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'password'");
    $hasPasswordColumn = $checkPasswordColumn && $checkPasswordColumn->num_rows > 0;
    
    // Build SELECT columns
    $selectColumns = "`id`, `username`, `name`, `role`, `email`, `password_hash`";
    if ($hasPasswordColumn) {
        $selectColumns .= ", `password`";
    }
    $selectColumns .= ", `is_active`";
    
    // If input contains @, try to login with email (for regular users)
    if (strpos($username, '@') !== false && $hasEmailColumn) {
        $sql = "SELECT " . $selectColumns . " FROM `users` WHERE `email` = ? LIMIT 1";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param('s', $username);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result ? $result->fetch_assoc() : null;
            $stmt->close();
        }
    }
    
    // If not found or doesn't contain @, try username (for admin/super_admin)
    if (!$user) {
        $sql = "SELECT " . $selectColumns . " FROM `users` WHERE `username` = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    }

    if (!$user) {
        auditLog($conn, 0, 'login_failed', 'user', ['username' => $username, 'reason' => 'not_found']);
        throw new Exception("Username/email atau password salah.");
    }
    if (intval($user['is_active']) !== 1) {
        auditLog($conn, intval($user['id']), 'login_failed', 'user', ['reason' => 'inactive']);
        throw new Exception("Akun nonaktif.");
    }
    
    // Check password (plain text comparison)
    // Try both password_hash and password columns
    $storedPassword = $user['password_hash'] ?? $user['password'] ?? '';
    
    // Remove any whitespace from both passwords for comparison
    $password = trim($password);
    $storedPassword = trim($storedPassword);
    
    // Debug: Check if password matches
    if ($password !== $storedPassword) {
        // Also check if stored password might be hashed (old data)
        // If stored password looks like a hash (starts with $2y$ or $2a$), skip this check
        if (strpos($storedPassword, '$2y$') === 0 || strpos($storedPassword, '$2a$') === 0) {
            // Old hashed password, try to verify
            if (password_verify($password, $storedPassword)) {
                // Password matches with hash, update to plain text for future
                $updateSql = "UPDATE `users` SET `password_hash` = ? WHERE `id` = ?";
                $updateStmt = $conn->prepare($updateSql);
                if ($updateStmt) {
                    $userId = intval($user['id']);
                    $updateStmt->bind_param('si', $password, $userId);
                    $updateStmt->execute();
                    $updateStmt->close();
                }
            } else {
        auditLog($conn, intval($user['id']), 'login_failed', 'user', ['reason' => 'bad_password']);
                throw new Exception("Username/email atau password salah.");
            }
        } else {
            auditLog($conn, intval($user['id']), 'login_failed', 'user', ['reason' => 'bad_password']);
            throw new Exception("Username/email atau password salah.");
        }
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
    
    // Get full user data including npk, email, nomor_telepon, unit_kerja
    $userId = intval($session['user_id']);
    $sql = "SELECT `id`, `username`, `name`, `role`, `npk`, `email`, `nomor_telepon`, `unit_kerja` 
            FROM `users` WHERE `id` = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    
    if (!$user) {
        throw new Exception("User tidak ditemukan.");
    }
    
    // Ensure we return empty string instead of null for nullable fields
    $npk = isset($user['npk']) && $user['npk'] !== null ? trim($user['npk']) : '';
    $email = isset($user['email']) && $user['email'] !== null ? trim($user['email']) : '';
    $nomorTelepon = isset($user['nomor_telepon']) && $user['nomor_telepon'] !== null ? trim($user['nomor_telepon']) : '';
    $unitKerja = isset($user['unit_kerja']) && $user['unit_kerja'] !== null ? trim($user['unit_kerja']) : '';
    
    // Return response dengan format yang benar - user langsung di root, bukan di data
    // Karena sendJSONResponse akan wrap dalam 'data', kita perlu struktur khusus
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');
    
    $response = [
        'success' => true,
        'user' => [
            'id' => intval($user['id']),
            'username' => $user['username'],
            'name' => $user['name'],
            'role' => $user['role'],
            'npk' => $npk,
            'email' => $email,
            'nomorTelepon' => $nomorTelepon,
            'unitKerja' => $unitKerja
        ],
        'expiresAt' => $session['expires_at']
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
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

function handleChangePassword($conn) {
    $session = requireAuth($conn);
    
    $oldPassword = getRequestParam('oldPassword', '');
    $newPassword = getRequestParam('newPassword', '');
    
    if (empty($oldPassword) || empty($newPassword)) {
        throw new Exception("Password lama dan password baru wajib diisi.");
    }
    
    if (strlen($newPassword) < 6) {
        throw new Exception("Password baru minimal 6 karakter.");
    }
    
    $userId = intval($session['user_id']);
    
    // Get current user password
    $sql = "SELECT `password_hash`, `password` FROM `users` WHERE `id` = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    
    if (!$user) {
        throw new Exception("User tidak ditemukan.");
    }
    
    // Check old password (plain text comparison)
    $storedPassword = $user['password_hash'] ?? $user['password'] ?? '';
    $storedPassword = trim($storedPassword);
    $oldPassword = trim($oldPassword);
    
    // Verify old password
    $passwordValid = false;
    
    // Try plain text comparison first
    if ($storedPassword === $oldPassword) {
        $passwordValid = true;
    } else {
        // If stored password looks like a hash, try to verify
        if (strpos($storedPassword, '$2y$') === 0 || strpos($storedPassword, '$2a$') === 0) {
            if (password_verify($oldPassword, $storedPassword)) {
                $passwordValid = true;
            }
        }
    }
    
    if (!$passwordValid) {
        auditLog($conn, $userId, 'change_password_failed', 'user', ['reason' => 'wrong_old_password']);
        throw new Exception("Password lama salah.");
    }
    
    // Check if new password is same as old password
    if ($storedPassword === trim($newPassword)) {
        throw new Exception("Password baru harus berbeda dengan password lama.");
    }
    
    // Update password (store as plain text as per user requirement)
    $newPasswordTrimmed = trim($newPassword);
    $updateSql = "UPDATE `users` SET `password_hash` = ? WHERE `id` = ?";
    $updateStmt = $conn->prepare($updateSql);
    if (!$updateStmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $updateStmt->bind_param('si', $newPasswordTrimmed, $userId);
    
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        throw new Exception("Gagal mengubah password: " . $conn->error);
    }
    $updateStmt->close();
    
    // Log password change
    auditLog($conn, $userId, 'change_password', 'user', ['success' => true]);
    
    sendJSONResponse(true, ['message' => 'Password berhasil diubah']);
}

function handleListUsers($conn) {
    $session = requireAdminOrSuperAdmin($conn);

    // Build SELECT columns - include additional fields if they exist
    $selectColumns = "`id`,`username`,`name`,`role`,`is_active`,`created_at`,`updated_at`,`password_hash`";
    
    // Check if additional columns exist
    $checkNpk = $conn->query("SHOW COLUMNS FROM `users` LIKE 'npk'");
    $checkEmail = $conn->query("SHOW COLUMNS FROM `users` LIKE 'email'");
    $checkTel = $conn->query("SHOW COLUMNS FROM `users` LIKE 'nomor_telepon'");
    $checkUnit = $conn->query("SHOW COLUMNS FROM `users` LIKE 'unit_kerja'");
    
    if ($checkNpk && $checkNpk->num_rows > 0) {
        $selectColumns .= ",`npk`";
    }
    if ($checkEmail && $checkEmail->num_rows > 0) {
        $selectColumns .= ",`email`";
    }
    if ($checkTel && $checkTel->num_rows > 0) {
        $selectColumns .= ",`nomor_telepon`";
    }
    if ($checkUnit && $checkUnit->num_rows > 0) {
        $selectColumns .= ",`unit_kerja`";
    }
    
    $result = $conn->query("SELECT " . $selectColumns . " FROM `users` ORDER BY `role` ASC, `username` ASC");
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $userData = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'name' => $row['name'],
            'role' => $row['role'],
            'isActive' => intval($row['is_active']) === 1,
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at']
        ];
        
        // Add optional fields if they exist
        if (isset($row['npk'])) {
            $userData['npk'] = $row['npk'];
        }
        if (isset($row['email'])) {
            $userData['email'] = $row['email'];
        }
        if (isset($row['nomor_telepon'])) {
            $userData['nomorTelepon'] = $row['nomor_telepon'];
        }
        if (isset($row['unit_kerja'])) {
            $userData['unitKerja'] = $row['unit_kerja'];
        }
        // Add password (stored as plain text in password_hash column)
        if (isset($row['password_hash'])) {
            $userData['password'] = $row['password_hash'];
        }
        
        $users[] = $userData;
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

    // Store password as plain text
    $sql = "INSERT INTO `users` (`username`,`name`,`role`,`password_hash`,`is_active`) VALUES (?,?,?,?,1)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('ssss', $username, $name, $role, $password);
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
    $session = requireAdminOrSuperAdmin($conn);

    $id = intval(getRequestParam('id', 0));
    $name = trim(getRequestParam('name', ''));
    $role = trim(getRequestParam('role', ''));
    $isActive = getRequestParam('isActive', null);
    $email = trim(getRequestParam('email', ''));
    $npk = trim(getRequestParam('npk', ''));
    $nomorTelepon = trim(getRequestParam('nomor_telepon', ''));
    $unitKerja = trim(getRequestParam('unit_kerja', ''));

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

    // Check if email column exists and update if provided
    $checkEmailColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'email'");
    $hasEmailColumn = $checkEmailColumn && $checkEmailColumn->num_rows > 0;
    if ($hasEmailColumn && $email !== '') {
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Format email tidak valid.");
        }
        // Check if email already exists for another user
        $checkEmail = $conn->prepare("SELECT `id` FROM `users` WHERE `email` = ? AND `id` != ? LIMIT 1");
        if ($checkEmail) {
            $checkEmail->bind_param('si', $email, $id);
            $checkEmail->execute();
            $result = $checkEmail->get_result();
            if ($result && $result->num_rows > 0) {
                $checkEmail->close();
                throw new Exception("Email sudah digunakan oleh user lain.");
            }
            $checkEmail->close();
        }
        $updates[] = "`email` = ?";
        $params[] = $email;
        $types .= 's';
    }

    // Check if npk column exists and update if provided
    $checkNpkColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'npk'");
    $hasNpkColumn = $checkNpkColumn && $checkNpkColumn->num_rows > 0;
    if ($hasNpkColumn && $npk !== '') {
        // Check if NPK already exists for another user
        $checkNpk = $conn->prepare("SELECT `id` FROM `users` WHERE `npk` = ? AND `id` != ? LIMIT 1");
        if ($checkNpk) {
            $checkNpk->bind_param('si', $npk, $id);
            $checkNpk->execute();
            $result = $checkNpk->get_result();
            if ($result && $result->num_rows > 0) {
                $checkNpk->close();
                throw new Exception("NPK sudah digunakan oleh user lain.");
            }
            $checkNpk->close();
        }
        $updates[] = "`npk` = ?";
        $params[] = $npk;
        $types .= 's';
    }

    // Check if nomor_telepon column exists and update if provided
    $checkTelColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'nomor_telepon'");
    $hasTelColumn = $checkTelColumn && $checkTelColumn->num_rows > 0;
    if ($hasTelColumn && $nomorTelepon !== '') {
        // Validate phone number format
        if (!preg_match('/^08\d{8,11}$/', $nomorTelepon)) {
            throw new Exception("Format nomor telepon tidak valid. Gunakan format: 08xxxxxxxxxx");
        }
        $updates[] = "`nomor_telepon` = ?";
        $params[] = $nomorTelepon;
        $types .= 's';
    }

    // Check if unit_kerja column exists and update if provided
    $checkUnitColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'unit_kerja'");
    $hasUnitColumn = $checkUnitColumn && $checkUnitColumn->num_rows > 0;
    if ($hasUnitColumn && $unitKerja !== '') {
        $updates[] = "`unit_kerja` = ?";
        $params[] = $unitKerja;
        $types .= 's';
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
    $session = requireAdminOrSuperAdmin($conn);

    $id = intval(getRequestParam('id', 0));
    $newPassword = getRequestParam('newPassword', '');

    if ($id <= 0) {
        throw new Exception("ID user tidak valid.");
    }
    if ($newPassword === '') {
        throw new Exception("Password baru wajib diisi.");
    }

    // Store password as plain text
    $sql = "UPDATE `users` SET `password_hash` = ? WHERE `id` = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new Exception("Prepare error: " . $conn->error);
    $stmt->bind_param('si', $newPassword, $id);
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

function handleDeleteUser($conn) {
    $session = requireAdminOrSuperAdmin($conn);
    
    $id = intval(getRequestParam('id', 0));
    if ($id <= 0) {
        throw new Exception("ID user tidak valid.");
    }

    // Prevent deleting yourself
    if ($id === intval($session['user_id'])) {
        throw new Exception("Tidak dapat menghapus akun sendiri.");
    }

    // Check if user exists
    $check = $conn->prepare("SELECT `id`, `username`, `name` FROM `users` WHERE `id` = ? LIMIT 1");
    if (!$check) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $check->bind_param('i', $id);
    $check->execute();
    $result = $check->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $check->close();

    if (!$user) {
        throw new Exception("User tidak ditemukan.");
    }

    // Delete all sessions first
    $delSessions = $conn->prepare("DELETE FROM `auth_sessions` WHERE `user_id` = ?");
    if ($delSessions) {
        $delSessions->bind_param('i', $id);
        $delSessions->execute();
        $delSessions->close();
    }

    // Delete user
    $sql = "DELETE FROM `users` WHERE `id` = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception("Gagal menghapus user: " . $err);
    }
    $stmt->close();

    auditLog($conn, $session['user_id'], 'delete_user', 'user', ['deletedUserId' => $id, 'username' => $user['username']]);
    sendJSONResponse(true, ['message' => 'User berhasil dihapus']);
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

function handleRegister($conn) {
    // Tidak perlu auth untuk pendaftaran
    $nama = trim(getRequestParam('nama', ''));
    $npk = trim(getRequestParam('npk', ''));
    $nomor_telepon = trim(getRequestParam('nomor_telepon', ''));
    $email = trim(getRequestParam('email', ''));
    $unit_kerja = trim(getRequestParam('unit_kerja', ''));

    // Validation (password tidak diperlukan, akan di-generate saat approval)
    if ($nama === '' || $npk === '' || $nomor_telepon === '' || $email === '' || $unit_kerja === '') {
        throw new Exception("Semua field wajib diisi.");
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception("Format email tidak valid.");
    }

    // Validate phone number (should start with 08)
    if (!preg_match('/^08\d{8,11}$/', $nomor_telepon)) {
        throw new Exception("Format nomor telepon tidak valid. Gunakan format: 08xxxxxxxxxx");
    }

    // Check if NPK already exists in ACTIVE users table (only if column exists)
    // Only check active users - if user is deleted/inactive, NPK can be reused
    $checkColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'npk'");
    if ($checkColumn && $checkColumn->num_rows > 0) {
        $checkNpk = $conn->prepare("SELECT `id` FROM `users` WHERE `npk` = ? AND `is_active` = 1 LIMIT 1");
        if ($checkNpk) {
            $checkNpk->bind_param('s', $npk);
            $checkNpk->execute();
            $result = $checkNpk->get_result();
            if ($result && $result->num_rows > 0) {
                $checkNpk->close();
                throw new Exception("NPK sudah terdaftar pada akun aktif.");
            }
            $checkNpk->close();
        }
    }

    // Check if email already exists in ACTIVE users table (only if column exists)
    // Only check active users - if user is deleted/inactive, email can be reused
    $checkColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'email'");
    if ($checkColumn && $checkColumn->num_rows > 0) {
        $checkEmail = $conn->prepare("SELECT `id` FROM `users` WHERE `email` = ? AND `is_active` = 1 LIMIT 1");
        if ($checkEmail) {
            $checkEmail->bind_param('s', $email);
            $checkEmail->execute();
            $result = $checkEmail->get_result();
            if ($result && $result->num_rows > 0) {
                $checkEmail->close();
                throw new Exception("Email sudah terdaftar pada akun aktif.");
            }
            $checkEmail->close();
        }
    }

    // Note: nomor_telepon tidak perlu divalidasi untuk unik - boleh sama antar user

    // Check if NPK already exists in pending registrations
    $checkRegNpk = $conn->prepare("SELECT `id` FROM `user_registrations` WHERE `npk` = ? AND `status` = 'pending' LIMIT 1");
    if ($checkRegNpk) {
        $checkRegNpk->bind_param('s', $npk);
        $checkRegNpk->execute();
        $result = $checkRegNpk->get_result();
        if ($result && $result->num_rows > 0) {
            $checkRegNpk->close();
            throw new Exception("NPK sudah terdaftar dan sedang menunggu persetujuan.");
        }
        $checkRegNpk->close();
    }

    // Check if email already exists in pending registrations
    $checkRegEmail = $conn->prepare("SELECT `id` FROM `user_registrations` WHERE `email` = ? AND `status` = 'pending' LIMIT 1");
    if ($checkRegEmail) {
        $checkRegEmail->bind_param('s', $email);
        $checkRegEmail->execute();
        $result = $checkRegEmail->get_result();
        if ($result && $result->num_rows > 0) {
            $checkRegEmail->close();
            throw new Exception("Email sudah terdaftar dan sedang menunggu persetujuan.");
        }
        $checkRegEmail->close();
    }

    // Note: nomor_telepon tidak perlu divalidasi untuk unik di pending registrations - boleh sama

    // Hapus data lama di user_registrations dengan NPK/email yang sama jika status bukan 'pending'
    // Ini untuk mengatasi constraint UNIQUE di database yang mungkin masih ada
    // Jika user sudah dihapus, data registrasi lama juga bisa dihapus untuk memungkinkan registrasi baru
    $deleteOldReg = $conn->prepare("DELETE FROM `user_registrations` WHERE (`npk` = ? OR `email` = ?) AND `status` != 'pending'");
    if ($deleteOldReg) {
        $deleteOldReg->bind_param('ss', $npk, $email);
        $deleteOldReg->execute();
        $deleteOldReg->close();
    }

    // Insert registration (password tidak diperlukan, akan di-generate saat approval)
    $sql = "INSERT INTO `user_registrations` (`nama`, `npk`, `nomor_telepon`, `email`, `unit_kerja`, `status`) VALUES (?, ?, ?, ?, ?, 'pending')";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('sssss', $nama, $npk, $nomor_telepon, $email, $unit_kerja);
    
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception("Gagal mendaftar: " . $err);
    }
    $newId = $stmt->insert_id;
    $stmt->close();

    sendJSONResponse(true, ['message' => 'Pendaftaran berhasil. Menunggu persetujuan admin.', 'id' => $newId]);
}

function handleListRegistrations($conn) {
    $session = requireAuth($conn);
    
    // Hanya admin dan super_admin yang bisa melihat
    if ($session['role'] !== 'admin' && $session['role'] !== 'super_admin') {
        throw new Exception("Akses ditolak: butuh role admin atau super_admin.");
    }

    $status = getRequestParam('status', '');
    $whereClause = '';
    $params = [];
    $types = '';

    if ($status !== '' && in_array($status, ['pending', 'approved', 'rejected'], true)) {
        $whereClause = "WHERE `status` = ?";
        $params[] = $status;
        $types = 's';
    }

    $sql = "SELECT r.`id`, r.`nama`, r.`npk`, r.`nomor_telepon`, r.`email`, r.`unit_kerja`, r.`status`, 
                   r.`approved_by`, r.`approved_at`, r.`rejection_reason`, r.`created_at`, r.`updated_at`,
                   u.`name` as `approved_by_name`
            FROM `user_registrations` r
            LEFT JOIN `users` u ON u.`id` = r.`approved_by`
            " . $whereClause . "
            ORDER BY r.`created_at` DESC";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $registrations = [];
    
    while ($row = $result->fetch_assoc()) {
        $registrations[] = [
            'id' => intval($row['id']),
            'nama' => $row['nama'],
            'npk' => $row['npk'],
            'nomorTelepon' => $row['nomor_telepon'],
            'email' => $row['email'],
            'unitKerja' => $row['unit_kerja'],
            'status' => $row['status'],
            'approvedBy' => $row['approved_by'] ? intval($row['approved_by']) : null,
            'approvedByName' => $row['approved_by_name'] ?? null,
            'approvedAt' => $row['approved_at'],
            'rejectionReason' => $row['rejection_reason'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at']
        ];
    }
    
    $stmt->close();
    
    auditLog($conn, $session['user_id'], 'list_registrations', 'user_registration');
    sendJSONResponse(true, $registrations);
}

function handleApproveRegistration($conn) {
    $session = requireAuth($conn);
    
    // Hanya admin dan super_admin yang bisa approve
    if ($session['role'] !== 'admin' && $session['role'] !== 'super_admin') {
        throw new Exception("Akses ditolak: butuh role admin atau super_admin.");
    }

    $id = intval(getRequestParam('id', 0));
    if ($id <= 0) {
        throw new Exception("ID pendaftaran tidak valid.");
    }

    // Get registration data
    $sql = "SELECT * FROM `user_registrations` WHERE `id` = ? AND `status` = 'pending' LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $registration = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$registration) {
        throw new Exception("Pendaftaran tidak ditemukan atau sudah diproses.");
    }

    // Check if NPK or email already exists in users (only if columns exist)
    $checkNpkColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'npk'");
    $checkEmailColumn = $conn->query("SHOW COLUMNS FROM `users` LIKE 'email'");
    $hasNpkColumn = $checkNpkColumn && $checkNpkColumn->num_rows > 0;
    $hasEmailColumn = $checkEmailColumn && $checkEmailColumn->num_rows > 0;
    
    if ($hasNpkColumn || $hasEmailColumn) {
        $whereConditions = [];
        $params = [];
        $types = '';
        
        if ($hasNpkColumn) {
            $whereConditions[] = "`npk` = ?";
            $params[] = $registration['npk'];
            $types .= 's';
        }
        
        if ($hasEmailColumn) {
            $whereConditions[] = "`email` = ?";
            $params[] = $registration['email'];
            $types .= 's';
        }
        
        if (!empty($whereConditions)) {
            $sql = "SELECT `id` FROM `users` WHERE " . implode(' OR ', $whereConditions) . " LIMIT 1";
            $checkUser = $conn->prepare($sql);
            if ($checkUser) {
                $checkUser->bind_param($types, ...$params);
                $checkUser->execute();
                $userResult = $checkUser->get_result();
                if ($userResult && $userResult->num_rows > 0) {
                    $checkUser->close();
                    throw new Exception("NPK atau Email sudah terdaftar sebagai user aktif.");
                }
                $checkUser->close();
            }
        }
    }

    // Generate username from NPK (lowercase)
    $username = strtolower($registration['npk']);
    
    // Generate fixed password for all users: "User@25"
    $passwordHash = 'User@25';

    // Start transaction
    $conn->begin_transaction();

    try {
        // Create user account
        $sqlUser = "INSERT INTO `users` (`username`, `name`, `npk`, `nomor_telepon`, `email`, `unit_kerja`, `role`, `password_hash`, `is_active`) 
                    VALUES (?, ?, ?, ?, ?, ?, 'user', ?, 1)";
        $stmtUser = $conn->prepare($sqlUser);
        if (!$stmtUser) {
            throw new Exception("Prepare error: " . $conn->error);
        }
        $stmtUser->bind_param('sssssss', $username, $registration['nama'], $registration['npk'], 
                             $registration['nomor_telepon'], $registration['email'], 
                             $registration['unit_kerja'], $passwordHash);
        
        if (!$stmtUser->execute()) {
            throw new Exception("Gagal membuat user: " . $stmtUser->error);
        }
        $newUserId = $stmtUser->insert_id;
        $stmtUser->close();

        // Update registration status
        $approvedAt = date('Y-m-d H:i:s');
        $sqlUpdate = "UPDATE `user_registrations` SET `status` = 'approved', `approved_by` = ?, `approved_at` = ? WHERE `id` = ?";
        $stmtUpdate = $conn->prepare($sqlUpdate);
        if (!$stmtUpdate) {
            throw new Exception("Prepare error: " . $conn->error);
        }
        $stmtUpdate->bind_param('isi', $session['user_id'], $approvedAt, $id);
        if (!$stmtUpdate->execute()) {
            throw new Exception("Gagal update status: " . $stmtUpdate->error);
        }
        $stmtUpdate->close();

        // Commit transaction
        $conn->commit();

        // Send WhatsApp notification
        $whatsappMessage = generateApprovalMessage($registration, $username, $passwordHash);
        $whatsappUrl = generateWhatsAppUrl($registration['nomor_telepon'], $whatsappMessage);

        auditLog($conn, $session['user_id'], 'approve_registration', 'user_registration', [
            'registrationId' => $id,
            'newUserId' => $newUserId,
            'npk' => $registration['npk']
        ]);

        sendJSONResponse(true, [
            'message' => 'Pendaftaran berhasil disetujui dan akun user telah dibuat.',
            'userId' => $newUserId,
            'whatsappUrl' => $whatsappUrl
        ]);

    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}

function handleRejectRegistration($conn) {
    $session = requireAuth($conn);
    
    // Hanya admin dan super_admin yang bisa reject
    if ($session['role'] !== 'admin' && $session['role'] !== 'super_admin') {
        throw new Exception("Akses ditolak: butuh role admin atau super_admin.");
    }

    $id = intval(getRequestParam('id', 0));
    $rejectionReason = trim(getRequestParam('rejectionReason', ''));

    if ($id <= 0) {
        throw new Exception("ID pendaftaran tidak valid.");
    }

    // Get registration data
    $sql = "SELECT * FROM `user_registrations` WHERE `id` = ? AND `status` = 'pending' LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $registration = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$registration) {
        throw new Exception("Pendaftaran tidak ditemukan atau sudah diproses.");
    }

    // Update registration status
    $sqlUpdate = "UPDATE `user_registrations` SET `status` = 'rejected', `rejection_reason` = ? WHERE `id` = ?";
    $stmtUpdate = $conn->prepare($sqlUpdate);
    if (!$stmtUpdate) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmtUpdate->bind_param('si', $rejectionReason, $id);
    if (!$stmtUpdate->execute()) {
        throw new Exception("Gagal update status: " . $stmtUpdate->error);
    }
    $stmtUpdate->close();

    auditLog($conn, $session['user_id'], 'reject_registration', 'user_registration', [
        'registrationId' => $id,
        'npk' => $registration['npk'],
        'reason' => $rejectionReason
    ]);

    sendJSONResponse(true, ['message' => 'Pendaftaran ditolak.']);
}

function generateApprovalMessage($registration, $username, $password) {
    $message = "Selamat! Pendaftaran akun Anda telah *DISETUJUI*.\n\n";
    $message .= "Detail Akun:\n";
    $message .= "• Nama: " . $registration['nama'] . "\n";
    $message .= "• Username: " . $username . "\n";
    $message .= "• Password: " . $password . "\n";
    $message .= "• NPK: " . $registration['npk'] . "\n";
    $message .= "• Unit Kerja: " . $registration['unit_kerja'] . "\n\n";
    $message .= "Silakan login menggunakan username dan password di atas.\n";
    $message .= "Sangat disarankan untuk mengubah password setelah login pertama kali.\n\n";
    $message .= "Terima kasih.";
    
    return $message;
}

function generateWhatsAppUrl($phoneNumber, $message) {
    // Remove leading 0 and add country code 62
    $cleanPhone = preg_replace('/^0/', '62', $phoneNumber);
    $encodedMessage = urlencode($message);
    return "https://wa.me/{$cleanPhone}?text={$encodedMessage}";
}

// Handler untuk getData (permintaan atau backdate)
function handleGetData($conn) {
    // Try to get session for filtering by user
    $session = null;
    $userId = null;
    $userRole = null;
    
    try {
        $token = getAuthTokenFromRequest();
        if ($token !== '') {
            $sessionResult = $conn->query("SELECT s.`user_id`, s.`token`, s.`expires_at`, u.`username`, u.`name`, u.`role`, u.`is_active`
                FROM `auth_sessions` s
                JOIN `users` u ON u.`id` = s.`user_id`
                WHERE s.`token` = '" . $conn->real_escape_string($token) . "' 
                AND s.`expires_at` > NOW() 
                AND u.`is_active` = 1
                LIMIT 1");
            
            if ($sessionResult && $sessionResult->num_rows > 0) {
                $sessionRow = $sessionResult->fetch_assoc();
                $userId = intval($sessionRow['user_id']);
                $userRole = $sessionRow['role'];
            }
        }
    } catch (Exception $e) {
        // Ignore auth errors for backward compatibility
    }
    
    $table = $_GET['table'] ?? 'permintaan'; // default permintaan
    
    if ($table === 'backdate') {
        // Filter by user_id if role is 'user'
        if ($userRole === 'user' && $userId) {
            // Check if user_id column exists
            $checkColumn = $conn->query("SHOW COLUMNS FROM `backdate` LIKE 'user_id'");
            if ($checkColumn && $checkColumn->num_rows > 0) {
                // STRICT: Only show data where user_id matches exactly
                $sql = "SELECT * FROM `backdate` WHERE `user_id` = $userId AND `user_id` IS NOT NULL ORDER BY `timestamp` DESC, `id` DESC";
            } else {
                // If column doesn't exist, return empty for user (they can't see old data)
                $sql = "SELECT * FROM `backdate` WHERE 1=0";
            }
        } else {
            // For admin/super_admin or no auth (backward compatibility), show all data
            // This includes cases where:
            // - userRole is null (no auth token)
            // - userRole is 'admin' or 'super_admin'
            // - userRole is 'user' but userId is null (shouldn't happen, but fallback)
            $sql = "SELECT * FROM `backdate` ORDER BY `timestamp` DESC, `id` DESC";
        }
    } else {
        // Filter by user_id if role is 'user'
        if ($userRole === 'user' && $userId) {
            // Check if user_id column exists
            $checkColumn = $conn->query("SHOW COLUMNS FROM `permintaan` LIKE 'user_id'");
            if ($checkColumn && $checkColumn->num_rows > 0) {
                // STRICT: Only show data where user_id matches exactly
                // This ensures users only see their own data
                $sql = "SELECT * FROM `permintaan` WHERE `user_id` = $userId AND `user_id` IS NOT NULL ORDER BY `timestamp` DESC, `id` DESC";
            } else {
                // If column doesn't exist, return empty for user (they can't see old data)
                $sql = "SELECT * FROM `permintaan` WHERE 1=0";
            }
        } else if ($userRole === 'user' && !$userId) {
            // If user role but no userId found, return empty
            $sql = "SELECT * FROM `permintaan` WHERE 1=0";
        } else {
            // For admin/super_admin, show all data
        $sql = "SELECT * FROM `permintaan` ORDER BY `timestamp` DESC, `id` DESC";
        }
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
                    'Keterangan', 'Persetujuan', 'Petugas ID', 'Petugas No WA'
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
            // Tambahkan petugas_id dan petugas_no_wa untuk kebutuhan chat
            $rowData['Petugas ID'] = $row['petugas_id'] ?? '';
            $rowData['Petugas No WA'] = $row['petugas_no_wa'] ?? '';
        }
        
        $data[] = $rowData;
    }
    
    sendJSONResponse(true, $data, null, $headers);
}

// Handler untuk batchUpdate
function handleBatchUpdate($conn) {
    // Support both GET and POST
    $rowNumber = intval($_REQUEST['rowNumber'] ?? 0);
    $table = $_REQUEST['table'] ?? 'permintaan';
    
    // Jika ada persetujuan (approve/reject), validasi PIN
    $persetujuan = trim($_REQUEST['persetujuan'] ?? '');
    if (!empty($persetujuan)) {
        $pin = trim($_REQUEST['pin'] ?? '');
        
        // Normalize PIN - remove all non-digit characters first
        $normalizedInput = preg_replace('/[^0-9]/', '', $pin);
        
        if (empty($normalizedInput) || strlen($normalizedInput) !== 4 || !ctype_digit($normalizedInput)) {
            throw new Exception("PIN harus berupa 4 digit angka");
        }
        
        // Validasi PIN
        $sql = "SELECT `pin` FROM `approval_pin` ORDER BY `id` DESC LIMIT 1";
        $result = $conn->query($sql);
        
        if (!$result) {
            throw new Exception("Query error: " . $conn->error);
        }
        
        if ($result->num_rows > 0) {
            $row = $result->fetch_assoc();
            $storedPin = trim($row['pin']);
            
            // Normalize stored PIN - remove all non-digit characters
            $normalizedStored = preg_replace('/[^0-9]/', '', $storedPin);
            
            // Ensure both are exactly 4 digits (should already be, but just in case)
            $normalizedInput = str_pad($normalizedInput, 4, '0', STR_PAD_LEFT);
            $normalizedStored = str_pad($normalizedStored, 4, '0', STR_PAD_LEFT);
            
            // Debug logging
            error_log("BatchUpdate PIN validation - Input: '$pin' (normalized: '$normalizedInput'), Stored: '$storedPin' (normalized: '$normalizedStored'), Match: " . ($normalizedInput === $normalizedStored ? 'YES' : 'NO'));
            
            // Compare normalized strings with strict validation
            if ($normalizedInput !== $normalizedStored || strlen($normalizedInput) !== 4 || strlen($normalizedStored) !== 4 || !ctype_digit($normalizedInput) || !ctype_digit($normalizedStored)) {
                throw new Exception("PIN tidak valid");
            }
        } else {
            throw new Exception("PIN belum diatur oleh admin");
        }
    }
    
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
    // Hanya super admin yang bisa edit
    requireSuperAdmin($conn);
    
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
    $namaAdmin = trim($_POST['namaAdmin'] ?? $_GET['namaAdmin'] ?? '');
    $tanggalBackdate = trim($_POST['tanggalBackdate'] ?? $_GET['tanggalBackdate'] ?? '');
    $alasanBackdate = trim($_POST['alasanBackdate'] ?? $_GET['alasanBackdate'] ?? '');
    $namaDibuka = trim($_POST['namaDibuka'] ?? $_GET['namaDibuka'] ?? '');
    $departemen = trim($_POST['departemen'] ?? $_GET['departemen'] ?? '');
    $nomorSurat = trim($_POST['nomorSurat'] ?? $_GET['nomorSurat'] ?? '');
    
    // Validasi field wajib
    $missingFields = [];
    if (empty($namaAdmin)) $missingFields[] = 'Nama Admin';
    if (empty($tanggalBackdate)) $missingFields[] = 'Tanggal Pembukaan Backdate';
    if (empty($alasanBackdate)) $missingFields[] = 'Alasan Pembukaan Backdate';
    if (empty($namaDibuka)) $missingFields[] = 'Nama yang Dibuka Backdate';
    if (empty($departemen)) $missingFields[] = 'Departemen yang dibukakan Backdate';
    if (empty($nomorSurat)) $missingFields[] = 'Nomor Surat Backdate DOF';
    
    if (!empty($missingFields)) {
        throw new Exception("Field wajib yang belum diisi: " . implode(', ', $missingFields));
    }
    
    // Get user_id from session if available
    $userId = null;
    try {
        $token = getAuthTokenFromRequest();
        if ($token !== '' && $token !== null) {
            $sessionResult = $conn->query("SELECT s.`user_id` FROM `auth_sessions` s
                JOIN `users` u ON u.`id` = s.`user_id`
                WHERE s.`token` = '" . $conn->real_escape_string($token) . "' 
                AND s.`expires_at` > NOW() 
                AND u.`is_active` = 1
                LIMIT 1");
            
            if ($sessionResult && $sessionResult->num_rows > 0) {
                $sessionRow = $sessionResult->fetch_assoc();
                $userId = intval($sessionRow['user_id']);
            }
        }
    } catch (Exception $e) {
        // Log error for debugging but don't throw
        error_log("Error getting user_id in handleInsertBackdate: " . $e->getMessage());
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
    
    // Tabel backdate menggunakan nama kolom deskriptif
    // Gunakan nama kolom deskriptif langsung
    $npk = ''; // Kosong karena tidak diperlukan
    $jabatan = ''; // Kosong karena tidak diperlukan
    $email = ''; // Kosong karena tidak diperlukan
    $status = 'Open';
    $flag = '';
    $timestampSelesai = null;
    
    // Check if user_id column exists
    $checkColumn = $conn->query("SHOW COLUMNS FROM `backdate` LIKE 'user_id'");
    $hasUserIdColumn = $checkColumn && $checkColumn->num_rows > 0;
    
    // Insert data menggunakan nama kolom deskriptif
    if ($hasUserIdColumn && $userId) {
        $sql = "INSERT INTO `backdate` (
            `row_number`, `timestamp_data`, `nama_admin`, `npk`, `jabatan`, 
            `tanggal_pembukaan`, `alasan_pembukaan`, `nama_dibuka`, `departemen`, 
            `nomor_surat_dof`, `email_address`, `nomor_surat_key`, `timestamp`, `status`, `flag`, `timestamp_selesai`, `user_id`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $types = 'isssssssssssssssi';
    } else {
        $sql = "INSERT INTO `backdate` (
            `row_number`, `timestamp_data`, `nama_admin`, `npk`, `jabatan`, 
            `tanggal_pembukaan`, `alasan_pembukaan`, `nama_dibuka`, `departemen`, 
            `nomor_surat_dof`, `email_address`, `nomor_surat_key`, `timestamp`, `status`, `flag`, `timestamp_selesai`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $types = 'isssssssssssssss';
    }
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    // Bind parameter - i untuk int, s untuk string (termasuk datetime dan NULL)
    if ($hasUserIdColumn && $userId) {
        $stmt->bind_param($types,
            $maxRow, $timestamp, $namaAdmin, $npk, $jabatan, $tanggalBackdate, $alasanBackdate,
            $namaDibuka, $departemen, $nomorSurat, $email,
            $nomorSurat, $timestamp, $status, $flag, $timestampSelesai, $userId
        );
    } else {
        $stmt->bind_param($types,
            $maxRow, $timestamp, $namaAdmin, $npk, $jabatan, $tanggalBackdate, $alasanBackdate,
            $namaDibuka, $departemen, $nomorSurat, $email,
            $nomorSurat, $timestamp, $status, $flag, $timestampSelesai
        );
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Data backdate berhasil disimpan', 'rowNumber' => $maxRow]);
}

// Handler untuk getApprovalPin (hanya super_admin)
function handleGetApprovalPin($conn) {
    requireSuperAdmin($conn);
    
    $sql = "SELECT `pin` FROM `approval_pin` ORDER BY `id` DESC LIMIT 1";
    $result = $conn->query($sql);
    
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $pinValue = trim($row['pin']);
        // Remove any non-digit characters
        $pinValue = preg_replace('/[^0-9]/', '', $pinValue);
        // Ensure it's exactly 4 digits
        if (strlen($pinValue) === 4 && ctype_digit($pinValue)) {
            sendJSONResponse(true, ['pin' => $pinValue]);
        } else {
            // If PIN is corrupted, return default
            error_log("Warning: PIN in database is corrupted: '$pinValue' (length: " . strlen($pinValue) . ")");
            sendJSONResponse(true, ['pin' => '0000']);
        }
    } else {
        // Jika belum ada, buat default
        $defaultPin = '0000';
        $insertSql = "INSERT INTO `approval_pin` (`pin`) VALUES (?)";
        $stmt = $conn->prepare($insertSql);
        if ($stmt) {
            $stmt->bind_param('s', $defaultPin);
            $stmt->execute();
            $stmt->close();
        }
        sendJSONResponse(true, ['pin' => $defaultPin]);
    }
}

// Handler untuk setApprovalPin (hanya super_admin)
function handleSetApprovalPin($conn) {
    requireSuperAdmin($conn);
    
    $pin = trim(getRequestParam('pin', ''));
    
    // Normalize PIN - remove all non-digit characters
    $pin = preg_replace('/[^0-9]/', '', $pin);
    
    if (empty($pin) || strlen($pin) !== 4 || !ctype_digit($pin)) {
        throw new Exception("PIN harus berupa 4 digit angka");
    }
    
    // Cek apakah sudah ada PIN
    $checkSql = "SELECT `id` FROM `approval_pin` ORDER BY `id` DESC LIMIT 1";
    $checkResult = $conn->query($checkSql);
    
    if ($checkResult && $checkResult->num_rows > 0) {
        // Update existing PIN - use WHERE clause instead of ORDER BY LIMIT
        $row = $checkResult->fetch_assoc();
        $pinId = intval($row['id']);
        
        $updateSql = "UPDATE `approval_pin` SET `pin` = ? WHERE `id` = ?";
        $stmt = $conn->prepare($updateSql);
        if (!$stmt) {
            throw new Exception("Prepare error: " . $conn->error);
        }
        $stmt->bind_param('si', $pin, $pinId);
        if (!$stmt->execute()) {
            throw new Exception("Execute error: " . $stmt->error);
        }
        $stmt->close();
    } else {
        // Insert new PIN
        $insertSql = "INSERT INTO `approval_pin` (`pin`) VALUES (?)";
        $stmt = $conn->prepare($insertSql);
        if (!$stmt) {
            throw new Exception("Prepare error: " . $conn->error);
        }
        $stmt->bind_param('s', $pin);
        if (!$stmt->execute()) {
            throw new Exception("Execute error: " . $stmt->error);
        }
        $stmt->close();
    }
    
    $session = requireAuth($conn);
    auditLog($conn, intval($session['user_id']), 'set_approval_pin', 'system');
    
    // Return the updated PIN in response
    sendJSONResponse(true, ['message' => 'PIN approval berhasil diubah', 'pin' => $pin]);
}

// Handler untuk validateApprovalPin (public, tidak perlu auth)
function handleValidateApprovalPin($conn) {
    $pin = trim(getRequestParam('pin', ''));
    
    // Normalize input PIN - remove all non-digit characters first
    $normalizedInput = preg_replace('/[^0-9]/', '', $pin);
    
    if (empty($normalizedInput) || strlen($normalizedInput) !== 4 || !ctype_digit($normalizedInput)) {
        sendJSONResponse(false, ['valid' => false, 'message' => 'PIN harus berupa 4 digit angka']);
        return;
    }
    
    $sql = "SELECT `pin` FROM `approval_pin` ORDER BY `id` DESC LIMIT 1";
    $result = $conn->query($sql);
    
    if (!$result) {
        sendJSONResponse(false, ['valid' => false, 'message' => 'Query error: ' . $conn->error]);
        return;
    }
    
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $storedPin = trim($row['pin']);
        
        // Normalize stored PIN - remove all non-digit characters
        $normalizedStored = preg_replace('/[^0-9]/', '', $storedPin);
        
        // Ensure both are exactly 4 digits
        $normalizedInput = str_pad($normalizedInput, 4, '0', STR_PAD_LEFT);
        $normalizedStored = str_pad($normalizedStored, 4, '0', STR_PAD_LEFT);
        
        // Debug logging - more detailed
        $inputLen = strlen($normalizedInput);
        $storedLen = strlen($normalizedStored);
        $inputBytes = bin2hex($normalizedInput);
        $storedBytes = bin2hex($normalizedStored);
        $match = ($normalizedInput === $normalizedStored);
        
        error_log("PIN validation - Input: '$pin' (normalized: '$normalizedInput', len: $inputLen, bytes: $inputBytes), Stored: '$storedPin' (normalized: '$normalizedStored', len: $storedLen, bytes: $storedBytes), Match: " . ($match ? 'YES' : 'NO'));
        
        // Compare normalized strings with strict validation
        if ($match && $inputLen === 4 && $storedLen === 4 && ctype_digit($normalizedInput) && ctype_digit($normalizedStored)) {
            sendJSONResponse(true, ['valid' => true, 'message' => 'PIN valid', 'debug' => ['input' => $normalizedInput, 'stored' => $normalizedStored]]);
        } else {
            sendJSONResponse(false, ['valid' => false, 'message' => 'PIN tidak valid', 'debug' => ['input' => $normalizedInput, 'stored' => $normalizedStored, 'inputLen' => $inputLen, 'storedLen' => $storedLen, 'inputBytes' => $inputBytes, 'storedBytes' => $storedBytes]]);
        }
    } else {
        sendJSONResponse(false, ['valid' => false, 'message' => 'PIN belum diatur']);
    }
}

// Handler untuk getUnitKerja
function handleGetUnitKerja($conn) {
    $sql = "SELECT `id`, `nama_unit` FROM `unit_kerja` WHERE `is_active` = 1 ORDER BY `nama_unit` ASC";
    $result = $conn->query($sql);
    
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = [
            'id' => intval($row['id']),
            'nama_unit' => $row['nama_unit']
        ];
    }
    
    sendJSONResponse(true, $data);
}

// Handler untuk getPilihPermintaanOptions
function handleGetPilihPermintaanOptions($conn) {
    $sql = "SELECT `id`, `nama_opsi`, `bagian_target`, `urutan` FROM `pilih_permintaan_options` WHERE `is_active` = 1 ORDER BY `urutan` ASC, `id` ASC";
    $result = $conn->query($sql);
    
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = [
            'id' => intval($row['id']),
            'nama_opsi' => $row['nama_opsi'],
            'bagian_target' => $row['bagian_target'],
            'urutan' => intval($row['urutan'])
        ];
    }
    
    sendJSONResponse(true, $data);
}

// Handler untuk addPilihPermintaanOption
function handleAddPilihPermintaanOption($conn) {
    $namaOpsi = trim(getRequestParam('nama_opsi', ''));
    $bagianTarget = getRequestParam('bagian_target', 'bagian_2');
    
    if ($namaOpsi === '') {
        throw new Exception("Nama opsi wajib diisi.");
    }
    
    // Get max urutan
    $maxResult = $conn->query("SELECT MAX(`urutan`) as max_urutan FROM `pilih_permintaan_options`");
    $maxRow = $maxResult->fetch_assoc();
    $urutan = ($maxRow['max_urutan'] ?? 0) + 1;
    
    $sql = "INSERT INTO `pilih_permintaan_options` (`nama_opsi`, `bagian_target`, `urutan`, `is_active`) VALUES (?, ?, ?, 1)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('ssi', $namaOpsi, $bagianTarget, $urutan);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Opsi berhasil ditambahkan']);
}

// Handler untuk updatePilihPermintaanOption
function handleUpdatePilihPermintaanOption($conn) {
    $id = intval(getRequestParam('id', 0));
    $bagianTarget = getRequestParam('bagian_target', '');
    
    if ($id <= 0) {
        throw new Exception("ID tidak valid.");
    }
    
    if ($bagianTarget === '') {
        throw new Exception("Bagian target wajib diisi.");
    }
    
    $sql = "UPDATE `pilih_permintaan_options` SET `bagian_target` = ? WHERE `id` = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('si', $bagianTarget, $id);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Opsi berhasil diupdate']);
}

// Handler untuk deletePilihPermintaanOption
function handleDeletePilihPermintaanOption($conn) {
    $id = intval(getRequestParam('id', 0));
    
    if ($id <= 0) {
        throw new Exception("ID tidak valid.");
    }
    
    // Soft delete (set is_active = 0)
    $sql = "UPDATE `pilih_permintaan_options` SET `is_active` = 0 WHERE `id` = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    $stmt->bind_param('i', $id);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    $stmt->close();
    
    sendJSONResponse(true, ['message' => 'Opsi berhasil dihapus']);
}

// Handler untuk getPetugas
function handleGetPetugas($conn) {
    // Jika ada parameter nama, cari petugas berdasarkan nama
    $nama = trim(getRequestParam('nama', ''));
    
    if ($nama !== '') {
        // Cari petugas berdasarkan nama
        $sql = "SELECT `id`, `nama`, `npk`, `jabatan`, `no_wa` FROM `petugas` WHERE `nama` = ? AND `is_active` = 1 LIMIT 1";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare error: " . $conn->error);
        }
        $stmt->bind_param('s', $nama);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result && $result->num_rows > 0) {
            $row = $result->fetch_assoc();
            $data = [
                'id' => intval($row['id']),
                'nama' => $row['nama'],
                'npk' => $row['npk'] ?? '',
                'jabatan' => $row['jabatan'] ?? '',
                'no_wa' => $row['no_wa'] ?? ''
            ];
            $stmt->close();
            sendJSONResponse(true, $data);
            return;
        }
        $stmt->close();
        
        // Jika tidak ditemukan, kembalikan error
        throw new Exception("Petugas dengan nama '$nama' tidak ditemukan.");
    }
    
    // Jika tidak ada parameter nama, kembalikan semua petugas
    $sql = "SELECT `id`, `nama`, `npk`, `jabatan`, `no_wa` FROM `petugas` WHERE `is_active` = 1 ORDER BY `nama` ASC";
    $result = $conn->query($sql);
    
    if (!$result) {
        throw new Exception("Query error: " . $conn->error);
    }
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = [
            'id' => intval($row['id']),
            'nama' => $row['nama'],
            'npk' => $row['npk'] ?? '',
            'jabatan' => $row['jabatan'] ?? '',
            'no_wa' => $row['no_wa'] ?? ''
        ];
    }
    
    sendJSONResponse(true, $data);
}

// Handler untuk submitPermintaan
function handleSubmitPermintaan($conn) {
    // Get form data
    $npk = trim(getRequestParam('npk', ''));
    $namaLengkap = trim(getRequestParam('nama_lengkap', ''));
    $unitKerjaId = intval(getRequestParam('unit_kerja_id', 0));
    $noTelepon = trim(getRequestParam('no_telepon', ''));
    $pilihPermintaan = trim(getRequestParam('pilih_permintaan', ''));
    $dataSurat = trim(getRequestParam('data_surat', ''));
    $statusSurat = trim(getRequestParam('status_surat', ''));
    $jenisSurat = trim(getRequestParam('jenis_surat', ''));
    $noSurat = trim(getRequestParam('no_surat', ''));
    $alasanPermintaan = trim(getRequestParam('alasan_permintaan', ''));
    $keteranganPermintaan = trim(getRequestParam('keterangan_permintaan', ''));
    $isiPenjelasan = trim(getRequestParam('isi_penjelasan', ''));
    $petugasId = intval(getRequestParam('petugas_id', 0));
    
    // Get selected option to determine which fields are required
    $optionResult = $conn->query("SELECT `bagian_target` FROM `pilih_permintaan_options` WHERE `nama_opsi` = '" . $conn->real_escape_string($pilihPermintaan) . "' AND `is_active` = 1 LIMIT 1");
    $optionRow = $optionResult ? $optionResult->fetch_assoc() : null;
    $bagianTarget = $optionRow['bagian_target'] ?? 'bagian_2';
    
    // Determine if this is Revisi, Pembatalan, or Perubahan Plt (skip bagian 3)
    $skipBagian3Options = ['Revisi', 'Pembatalan', 'Perubahan Plt'];
    $shouldSkipBagian3 = in_array($pilihPermintaan, $skipBagian3Options);
    
    // Validation - basic required fields (always required)
    if ($npk === '' || $namaLengkap === '' || $unitKerjaId <= 0 || $noTelepon === '' || 
        $pilihPermintaan === '' || $petugasId <= 0) {
        throw new Exception("Semua field wajib harus diisi.");
    }
    
    // Validate bagian 2 fields if needed (bagian_target = bagian_2 or Revisi/Pembatalan/Perubahan Plt)
    if ($bagianTarget === 'bagian_2' || $shouldSkipBagian3) {
        // Get posisi_surat (new field name) or fallback to status_surat (old field name)
        $posisiSurat = trim(getRequestParam('posisi_surat', ''));
        if ($posisiSurat === '') {
            $posisiSurat = $statusSurat; // Fallback to old field name
        }
        
        if ($posisiSurat === '' || $jenisSurat === '' || $alasanPermintaan === '') {
            throw new Exception("Field bagian 2 wajib diisi untuk pilihan ini.");
        }
        
        // Validate No Surat if Posisi Surat = Approver
        if ($posisiSurat === 'Approver') {
            if ($noSurat === '') {
                throw new Exception("No Surat wajib diisi jika Posisi Surat adalah Approver.");
            }
        }
        
        // isiPenjelasan is NOT required for bagian 2
    } else {
        // Validate bagian 3 fields (isiPenjelasan is required)
        if ($isiPenjelasan === '') {
            throw new Exception("Isi Penjelasan wajib diisi untuk pilihan ini.");
        }
    }
    
    // Get unit kerja name
    $unitResult = $conn->query("SELECT `nama_unit` FROM `unit_kerja` WHERE `id` = $unitKerjaId LIMIT 1");
    $unitRow = $unitResult->fetch_assoc();
    $unitKerja = $unitRow['nama_unit'] ?? '';
    
    // Get max row_number
    $maxResult = $conn->query("SELECT MAX(`row_number`) as max_row FROM `permintaan`");
    $maxRow = $maxResult->fetch_assoc();
    $rowNumber = ($maxRow['max_row'] ?? 0) + 1;
    
    // Get timestamp
    $timestamp = date('Y-m-d H:i:s');
    
    // Get petugas name
    $petugasResult = $conn->query("SELECT `nama`, `no_wa` FROM `petugas` WHERE `id` = $petugasId LIMIT 1");
    $petugasRow = $petugasResult->fetch_assoc();
    $petugasNama = $petugasRow['nama'] ?? '';
    $petugasNoWa = $petugasRow['no_wa'] ?? '';
    
    // Get user_id from session if available
    $userId = null;
    try {
        $token = getAuthTokenFromRequest();
        if ($token !== '') {
            $sessionResult = $conn->query("SELECT s.`user_id` FROM `auth_sessions` s
                JOIN `users` u ON u.`id` = s.`user_id`
                WHERE s.`token` = '" . $conn->real_escape_string($token) . "' 
                AND s.`expires_at` > NOW() 
                AND u.`is_active` = 1
                LIMIT 1");
            
            if ($sessionResult && $sessionResult->num_rows > 0) {
                $sessionRow = $sessionResult->fetch_assoc();
                $userId = intval($sessionRow['user_id']);
            }
        }
    } catch (Exception $e) {
        // Ignore auth errors
    }
    
    // Check if user_id column exists
    $checkColumn = $conn->query("SHOW COLUMNS FROM `permintaan` LIKE 'user_id'");
    $hasUserIdColumn = $checkColumn && $checkColumn->num_rows > 0;
    
    // Insert into permintaan table
    if ($hasUserIdColumn && $userId) {
        $sql = "INSERT INTO `permintaan` (
            `row_number`, `timestamp_data`, `npk`, `nama_lengkap`, `unit_kerja`, 
            `no_telepon`, `pilih_permintaan`, `status_surat`, `jenis_surat`, 
            `no_surat`, `alasan_permintaan`, `isi_penjelasan`, `petugas`, 
            `status`, `timestamp`, `user_id`, `petugas_id`, `petugas_no_wa`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare error: " . $conn->error);
        }
        
        // Get posisi_surat for database (use posisi_surat if available, otherwise use status_surat)
        $posisiSuratForDB = trim(getRequestParam('posisi_surat', ''));
        if ($posisiSuratForDB === '') {
            $posisiSuratForDB = $statusSurat;
        }
        
        $stmt->bind_param('isssssssssssssiis', 
            $rowNumber, $timestamp, $npk, $namaLengkap, $unitKerja,
            $noTelepon, $pilihPermintaan, $posisiSuratForDB, $jenisSurat,
            $noSurat, $alasanPermintaan, $isiPenjelasan, $petugasNama,
            $timestamp, $userId, $petugasId, $petugasNoWa
        );
    } else {
    $sql = "INSERT INTO `permintaan` (
        `row_number`, `timestamp_data`, `npk`, `nama_lengkap`, `unit_kerja`, 
        `no_telepon`, `pilih_permintaan`, `status_surat`, `jenis_surat`, 
        `no_surat`, `alasan_permintaan`, `isi_penjelasan`, `petugas`, 
        `status`, `timestamp`
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare error: " . $conn->error);
    }
    
    // Get posisi_surat for database (use posisi_surat if available, otherwise use status_surat)
    $posisiSuratForDB = trim(getRequestParam('posisi_surat', ''));
    if ($posisiSuratForDB === '') {
        $posisiSuratForDB = $statusSurat;
    }
    
    $stmt->bind_param('isssssssssssss', 
        $rowNumber, $timestamp, $npk, $namaLengkap, $unitKerja,
        $noTelepon, $pilihPermintaan, $posisiSuratForDB, $jenisSurat,
        $noSurat, $alasanPermintaan, $isiPenjelasan, $petugasNama,
        $timestamp
    );
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Execute error: " . $stmt->error);
    }
    
    $insertId = $conn->insert_id;
    $stmt->close();
    
    sendJSONResponse(true, [
        'id' => $insertId,
        'rowNumber' => $rowNumber
    ]);
}
