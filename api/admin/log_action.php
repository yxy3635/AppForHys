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

$action = $data['action'] ?? '';
$details = $data['details'] ?? '';

try {
    // 验证用户是否为管理员
    $stmt = $conn->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $adminUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    if (!$user || $user['username'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Admin access required.']);
        exit();
    }
    
    // 记录操作日志
    $sql = "INSERT INTO system_logs (timestamp, level, message, admin_id, admin_username) VALUES (NOW(), ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    
    // 根据操作类型设置日志级别
    $level = 'info';
    if (strpos($action, 'delete') !== false) {
        $level = 'warning';
    } elseif (strpos($action, 'error') !== false) {
        $level = 'error';
    }
    
    $message = $action . ($details ? ': ' . $details : '');
    $stmt->bind_param("ssis", $level, $message, $adminUserId, $user['username']);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Action logged successfully.'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 