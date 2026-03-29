<?php
// 清理房间数据的API端点
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// CORS头设置
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

// 获取POST数据
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['room_code'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少房间代码参数'
    ]);
    exit;
}

$roomCode = trim($input['room_code']);

try {
    require_once __DIR__ . '/../db_connect.php';
    
    // 检查房间是否存在且已结束
    $checkStmt = $conn->prepare("SELECT game_status FROM draw_rooms WHERE room_code = ?");
    if (!$checkStmt) {
        throw new Exception("准备检查语句失败: " . $conn->error);
    }
    
    $checkStmt->bind_param("s", $roomCode);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $room = $result->fetch_assoc();
    $checkStmt->close();
    
    if (!$room) {
        echo json_encode([
            'success' => false,
            'message' => '房间不存在'
        ]);
        exit;
    }
    
    if ($room['game_status'] !== 'finished') {
        echo json_encode([
            'success' => false,
            'message' => '只能清理已结束的房间'
        ]);
        exit;
    }
    
    // 开始事务
    $conn->autocommit(false);
    
    $cleanupResults = [];
    
    // 删除房间相关的消息
    $msgStmt = $conn->prepare("DELETE FROM draw_messages WHERE room_code = ?");
    if ($msgStmt) {
        $msgStmt->bind_param("s", $roomCode);
        if ($msgStmt->execute()) {
            $cleanupResults['messages_deleted'] = $msgStmt->affected_rows;
        } else {
            throw new Exception("删除消息失败: " . $msgStmt->error);
        }
        $msgStmt->close();
    }
    
    // 删除房间
    $roomStmt = $conn->prepare("DELETE FROM draw_rooms WHERE room_code = ?");
    if ($roomStmt) {
        $roomStmt->bind_param("s", $roomCode);
        if ($roomStmt->execute()) {
            $cleanupResults['room_deleted'] = $roomStmt->affected_rows > 0;
        } else {
            throw new Exception("删除房间失败: " . $roomStmt->error);
        }
        $roomStmt->close();
    }
    
    // 提交事务
    $conn->commit();
    $conn->autocommit(true);
    
    echo json_encode([
        'success' => true,
        'message' => '房间数据清理完成',
        'cleanup_results' => $cleanupResults
    ]);
    
    $conn->close();
    
} catch (Exception $e) {
    // 回滚事务
    if (isset($conn)) {
        $conn->rollback();
        $conn->autocommit(true);
    }
    
    echo json_encode([
        'success' => false,
        'message' => '清理房间数据失败: ' . $e->getMessage(),
        'debug_info' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
    
    if (isset($conn)) {
        $conn->close();
    }
}
?>