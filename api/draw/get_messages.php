<?php
// 强化CORS头设置
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: false');
header('Access-Control-Max-Age: 86400');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/../db_connect.php';

if (!isset($_GET['room_code'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少房间代码'
    ]);
    exit;
}

$roomCode = trim($_GET['room_code']);

try {
    
    // 获取最近的聊天消息（最多50条）
    $stmt = $conn->prepare("
        SELECT user_id, nickname, message, is_correct, is_system, created_at
        FROM draw_messages 
        WHERE room_code = ? 
        ORDER BY created_at ASC 
        LIMIT 50
    ");
    $stmt->bind_param("s", $roomCode);
    $stmt->execute();
    $result = $stmt->get_result();
    $messages = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'messages' => $messages
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '获取消息失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>