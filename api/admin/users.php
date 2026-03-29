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
    
    // 获取用户列表
    $sql = "SELECT 
                u.id,
                u.username,
                u.password,
                u.signature,
                u.avatar_url,
                u.created_at,
                u.last_online,
                CASE 
                    WHEN u.last_online > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 
                    ELSE 0 
                END as is_online,
                CASE 
                    WHEN u.username = 'admin' THEN '管理员'
                    ELSE '普通用户'
                END as role,
                COALESCE(p.posts_count, 0) as posts_count
            FROM users u
            LEFT JOIN (
                SELECT user_id, COUNT(*) as posts_count 
                FROM posts 
                GROUP BY user_id
            ) p ON u.id = p.user_id
            ORDER BY u.created_at DESC";
    
    $result = $conn->query($sql);
    $users = [];
    
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => $row['id'],
            'username' => $row['username'],
            'password' => $row['password'], // 返回加密后的密码
            'signature' => $row['signature'],
            'avatar_url' => $row['avatar_url'],
            'created_at' => $row['created_at'],
            'last_login' => $row['last_online'],
            'is_online' => (bool)$row['is_online'],
            'role' => $row['role'],
            'posts_count' => (int)$row['posts_count']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 