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

// 获取用户ID
$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($user_id <= 0) {
    echo json_encode(["success" => false, "message" => "无效的用户ID"]);
    exit();
}

try {
    // 先获取用户的所有对话伙伴和未读消息数
    $sql = "
        SELECT 
            CASE 
                WHEN m.from_user_id = ? THEN m.to_user_id 
                ELSE m.from_user_id 
            END as peer_id,
            COUNT(CASE WHEN m.to_user_id = ? AND m.is_read = 0 THEN 1 END) as unread_count,
            MAX(m.created_at) as last_message_time
        FROM messages m
        WHERE m.from_user_id = ? OR m.to_user_id = ?
        GROUP BY peer_id
        HAVING unread_count > 0
        ORDER BY last_message_time DESC
    ";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("SQL准备失败: " . $conn->error);
    }
    
    $stmt->bind_param('iiii', $user_id, $user_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $conversations = [];
    while ($row = $result->fetch_assoc()) {
        $peer_id = intval($row['peer_id']);
        
        // 获取对话伙伴的用户信息
        $user_sql = "SELECT username, avatar_url FROM users WHERE id = ?";
        $user_stmt = $conn->prepare($user_sql);
        if (!$user_stmt) {
            throw new Exception("用户查询SQL准备失败: " . $conn->error);
        }
        $user_stmt->bind_param('i', $peer_id);
        $user_stmt->execute();
        $user_result = $user_stmt->get_result();
        $peer_info = $user_result->fetch_assoc();
        $user_stmt->close();
        
        // 获取最新消息内容和类型
        $last_msg_sql = "
            SELECT content, 
                   CASE 
                       WHEN content LIKE 'data:image/%' THEN 'image' 
                       ELSE 'text' 
                   END as type
            FROM messages 
            WHERE (
                (from_user_id = ? AND to_user_id = ?) OR 
                (from_user_id = ? AND to_user_id = ?)
            )
            ORDER BY created_at DESC 
            LIMIT 1
        ";
        
        $last_stmt = $conn->prepare($last_msg_sql);
        if (!$last_stmt) {
            throw new Exception("最新消息查询SQL准备失败: " . $conn->error);
        }
        $last_stmt->bind_param('iiii', $user_id, $peer_id, $peer_id, $user_id);
        $last_stmt->execute();
        $last_result = $last_stmt->get_result();
        $last_message = $last_result->fetch_assoc();
        $last_stmt->close();
        
        // 处理头像路径
        $avatar = isset($peer_info['avatar_url']) ? $peer_info['avatar_url'] : '';
        if (!empty($avatar) && strpos($avatar, 'http') !== 0 && strpos($avatar, 'img/') !== 0) {
            $avatar = 'http://38.207.133.8/uploads/avatars/' . $avatar;
        } elseif (empty($avatar)) {
            $avatar = 'img/default-avatar.png';
        }
        
        $conversations[] = [
            'peer_id' => $peer_id,
            'peer_name' => isset($peer_info['username']) ? $peer_info['username'] : '用户',
            'peer_avatar' => $avatar,
            'unread_count' => intval($row['unread_count']),
            'last_message_time' => $row['last_message_time'],
            'last_message' => [
                'content' => isset($last_message['content']) ? $last_message['content'] : '',
                'type' => isset($last_message['type']) ? $last_message['type'] : 'text'
            ]
        ];
    }
    
    $stmt->close();
    
    echo json_encode([
        "success" => true,
        "conversations" => $conversations,
        "total_unread" => array_sum(array_column($conversations, 'unread_count'))
    ]);
    
} catch(Exception $e) {
    echo json_encode(["success" => false, "message" => "查询失败: " . $e->getMessage()]);
}

$conn->close();
?> 