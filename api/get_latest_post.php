<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// 引入数据库连接
require_once __DIR__ . '/db_connect.php';

try {
    $sql = "
        SELECT p.id, p.content, p.created_at, p.user_id,
               u.username, u.avatar_url
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 1
    ";
    
    $result = $conn->query($sql);
    
    if ($result && $result->num_rows > 0) {
        $post = $result->fetch_assoc();
        
        // 处理头像路径
        $avatar = $post['avatar_url'];
        if (!empty($avatar) && strpos($avatar, 'http') !== 0 && strpos($avatar, 'img/') !== 0) {
            $avatar = 'http://38.207.133.8/uploads/avatars/' . $avatar;
        } elseif (empty($avatar)) {
            $avatar = 'img/default-avatar.png';
        }
        
        echo json_encode([
            "success" => true,
            "post" => [
                "id" => (int)$post['id'],
                "content" => $post['content'],
                "created_at" => $post['created_at'],
                "user_id" => (int)$post['user_id'],
                "username" => isset($post['username']) ? $post['username'] : '未知用户',
                "avatar" => $avatar
            ]
        ]);
    } else {
        echo json_encode([
            "success" => true,
            "post" => null,
            "message" => "暂无动态"
        ]);
    }
    
} catch(Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "查询失败: " . $e->getMessage()
    ]);
}

$conn->close();
?> 