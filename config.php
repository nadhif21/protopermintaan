<?php
// Konfigurasi database MySQL

define('DB_HOST', 'auth-db1637.hstgr.io');
define('DB_USER', 'u207689956_andaladkorpkt');
define('DB_PASS', 'Permintaandof2025!');
define('DB_NAME', 'u207689956_permintaandof');

// Koneksi database
function getDBConnection() {
    static $conn = null;
    
    if ($conn === null) {
        try {
            $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            
            if ($conn->connect_error) {
                throw new Exception("Koneksi database gagal: " . $conn->connect_error);
            }
            
            $conn->set_charset("utf8mb4");
        } catch (Exception $e) {
            error_log("Database connection error: " . $e->getMessage());
            throw $e;
        }
    }
    
    return $conn;
}

// Helper function untuk response JSON
function sendJSONResponse($success, $data = null, $error = null, $headers = null) {
    // Clear any output buffer before sending JSON
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    
    $response = [
        'success' => $success
    ];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    if ($error !== null) {
        $response['error'] = $error;
    }
    
    if ($headers !== null) {
        $response['headers'] = $headers;
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Helper function untuk escape string
function escapeString($str) {
    if ($str === null || $str === '') {
        return '';
    }
    return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
}
