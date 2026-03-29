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
    
    // 获取统计数据
    $stats = [];
    
    // 总用户数
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM users");
    $stmt->execute();
    $result = $stmt->get_result();
    $stats['totalUsers'] = $result->fetch_assoc()['total'];
    
    // 在线用户数（最近5分钟有活动的用户）
    $stmt = $conn->prepare("SELECT COUNT(*) as online FROM users WHERE last_online > DATE_SUB(NOW(), INTERVAL 5 MINUTE)");
    $stmt->execute();
    $result = $stmt->get_result();
    $stats['onlineUsers'] = $result->fetch_assoc()['online'];
    
    // 总动态数
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM posts");
    $stmt->execute();
    $result = $stmt->get_result();
    $stats['totalPosts'] = $result->fetch_assoc()['total'];
    
    // 今日动态数
    $stmt = $conn->prepare("SELECT COUNT(*) as today FROM posts WHERE DATE(created_at) = CURDATE()");
    $stmt->execute();
    $result = $stmt->get_result();
    $stats['todayPosts'] = $result->fetch_assoc()['today'];
    
    echo json_encode([
        'success' => true,
        'stats' => $stats
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 