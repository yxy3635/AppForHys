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
    
    // 获取用户详细信息
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
                COALESCE(p.posts_count, 0) as posts_count,
                COALESCE(c.comments_count, 0) as comments_count,
                COALESCE(d.diaries_count, 0) as diaries_count
            FROM users u
            LEFT JOIN (
                SELECT user_id, COUNT(*) as posts_count 
                FROM posts 
                GROUP BY user_id
            ) p ON u.id = p.user_id
            LEFT JOIN (
                SELECT user_id, COUNT(*) as comments_count 
                FROM comments 
                GROUP BY user_id
            ) c ON u.id = c.user_id
            LEFT JOIN (
                SELECT user_id, COUNT(*) as diaries_count 
                FROM diaries 
                GROUP BY user_id
            ) d ON u.id = d.user_id
            WHERE u.id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $targetUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit();
    }
    
    // 获取用户最近的动态
    $stmt = $conn->prepare("SELECT id, content, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5");
    $stmt->bind_param("i", $targetUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $recentPosts = [];
    while ($row = $result->fetch_assoc()) {
        $recentPosts[] = [
            'id' => $row['id'],
            'content' => $row['content'],
            'created_at' => $row['created_at']
        ];
    }
    
    $userData = [
        'id' => $user['id'],
        'username' => $user['username'],
        'password' => $user['password'], // 返回加密后的密码
        'signature' => $user['signature'],
        'avatar_url' => $user['avatar_url'],
        'created_at' => $user['created_at'],
        'last_login' => $user['last_online'],
        'is_online' => (bool)$user['is_online'],
        'role' => $user['role'],
        'posts_count' => (int)$user['posts_count'],
        'comments_count' => (int)$user['comments_count'],
        'diaries_count' => (int)$user['diaries_count'],
        'recent_posts' => $recentPosts
    ];
    
    echo json_encode([
        'success' => true,
        'user' => $userData
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 