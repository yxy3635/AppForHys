<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理 OPTIONS 请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 检查请求方法
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

// 验证管理员权限
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$userId = null;

if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $userId = $matches[1];
}

if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Authorization required.']);
    exit();
}

try {
    // 验证用户是否为管理员
    $stmt = $conn->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    if (!$user || $user['username'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Admin access required.']);
        exit();
    }
    
    // 获取系统日志
    $sql = "SELECT 
                timestamp,
                level,
                message,
                admin_id,
                admin_username
            FROM system_logs 
            ORDER BY timestamp DESC 
            LIMIT 100";
    
    $result = $conn->query($sql);
    $logs = [];
    
    while ($row = $result->fetch_assoc()) {
        $logs[] = [
            'timestamp' => $row['timestamp'],
            'level' => $row['level'],
            'message' => $row['message'],
            'admin_id' => $row['admin_id'],
            'admin_username' => $row['admin_username']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'logs' => $logs
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 