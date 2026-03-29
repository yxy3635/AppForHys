<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db_connect.php';

$current_user_id = intval($_GET['current_user_id'] ?? 0); // 当前登录用户ID

$sql = "SELECT id, username, avatar_url FROM users";
$result = $conn->query($sql);

$users = [];
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        // 头像字段如果为空，给默认头像
        if (empty($row['avatar_url'])) {
            $row['avatar_url'] = 'img/default-avatar.png';
        }

        // 查询该用户发给当前用户的未读消息数
        $unread_count = 0;
        if ($current_user_id && $row['id'] != $current_user_id) {
            $peer_id = intval($row['id']);
            $sql2 = "SELECT COUNT(*) AS cnt FROM messages 
                     WHERE from_user_id = $peer_id AND to_user_id = $current_user_id AND is_read = 0";
            $res2 = $conn->query($sql2);
            if ($res2 && $r2 = $res2->fetch_assoc()) {
                $unread_count = intval($r2['cnt']);
            }
        }
        $row['unread_count'] = $unread_count;
        $users[] = $row;
    }
}

echo json_encode([
    "success" => true,
    "users" => $users
], JSON_UNESCAPED_UNICODE);

$conn->close();
?>