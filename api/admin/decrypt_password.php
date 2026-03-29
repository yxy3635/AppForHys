<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理 OPTIONS 请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 检查请求方法
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

// 验证管理员权限
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$adminUserId = null;

if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $adminUserId = $matches[1];
}

if (!$adminUserId) {
    echo json_encode(['success' => false, 'message' => 'Authorization required.']);
    exit();
}

// 获取请求数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$targetUserId = $data['user_id'] ?? null;

if (!$targetUserId) {
    echo json_encode(['success' => false, 'message' => 'User ID is required.']);
    exit();
}

try {
    // 验证管理员权限
    $stmt = $conn->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $adminUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $adminUser = $result->fetch_assoc();
    
    if (!$adminUser || $adminUser['username'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Admin access required.']);
        exit();
    }
    
    // 获取用户密码信息
    $stmt = $conn->prepare("SELECT username, password FROM users WHERE id = ?");
    $stmt->bind_param("i", $targetUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit();
    }
    
    // 分析密码信息
    $passwordInfo = [
        'username' => $user['username'],
        'hashed_password' => $user['password'],
        'hash_type' => 'bcrypt',
        'hash_cost' => null,
        'is_secure' => true
    ];
    
    // 检查密码哈希类型和成本
    if (preg_match('/^\$2y\$(\d+)\$/', $user['password'], $matches)) {
        $passwordInfo['hash_cost'] = intval($matches[1]);
        $passwordInfo['hash_type'] = 'bcrypt';
        $passwordInfo['is_secure'] = $passwordInfo['hash_cost'] >= 10;
    } elseif (preg_match('/^\$2a\$(\d+)\$/', $user['password'], $matches)) {
        $passwordInfo['hash_cost'] = intval($matches[1]);
        $passwordInfo['hash_type'] = 'bcrypt (legacy)';
        $passwordInfo['is_secure'] = false;
    } elseif (preg_match('/^\$1\$/', $user['password'])) {
        $passwordInfo['hash_type'] = 'MD5 crypt';
        $passwordInfo['is_secure'] = false;
    } else {
        $passwordInfo['hash_type'] = 'unknown';
        $passwordInfo['is_secure'] = false;
    }
    
    // 记录管理员操作日志
    $logSql = "INSERT INTO system_logs (level, message, admin_id, admin_username) VALUES (?, ?, ?, ?)";
    $logMessage = "管理员查看了用户密码信息: " . $user['username'];
    $stmt = $conn->prepare($logSql);
    $level = 'info';
    $stmt->bind_param("ssis", $level, $logMessage, $adminUserId, $adminUser['username']);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'password_info' => $passwordInfo
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 