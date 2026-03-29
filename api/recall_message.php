<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);

$message_id = intval($data['message_id'] ?? 0);
$user_id = intval($data['user_id'] ?? 0); // 当前用户ID，用于验证权限

if ($message_id && $user_id) {
    // 检查消息是否存在且是当前用户发送的
    $check_stmt = $conn->prepare("SELECT from_user_id, created_at FROM messages WHERE id = ? AND from_user_id = ?");
    $check_stmt->bind_param("ii", $message_id, $user_id);
    $check_stmt->execute();
    $result = $check_stmt->get_result();
    
    if ($result->num_rows > 0) {
        $message = $result->fetch_assoc();
        
        // 检查消息发送时间是否超过2分钟（可选的时间限制）
        $created_time = strtotime($message['created_at']);
        $current_time = time();
        // if (($current_time - $created_time) >= 0) {  
        //     echo json_encode(['success' => false, 'message' => '超过撤回时间限制']);
        // } else 
        
         if (($current_time - $created_time) >= 0) {
            // 直接删除消息
            $delete_stmt = $conn->prepare("DELETE FROM messages WHERE id = ?");
            $delete_stmt->bind_param("i", $message_id);
            $success = $delete_stmt->execute();
            $delete_stmt->close();
            
            echo json_encode(['success' => $success]);
        }
    } else {
        echo json_encode(['success' => false, 'message' => '消息不存在或无权限撤回']);
    }
    $check_stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
}
$conn->close();
?>