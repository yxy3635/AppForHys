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

// 获取POST数据
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['user_id'], $input['room_code'], $input['canvas_data'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

$userId = (int)$input['user_id'];
$roomCode = trim($input['room_code']);
$canvasData = $input['canvas_data'];

try {
    
    // 获取房间信息
    $stmt = $conn->prepare("SELECT * FROM draw_rooms WHERE room_code = ?");
    $stmt->bind_param("s", $roomCode);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    $stmt->close();
    
    if (!$room) {
        echo json_encode([
            'success' => false,
            'message' => '房间不存在'
        ]);
        exit;
    }
    
    // 检查是否是当前画家
    if ($room['current_drawer'] != $userId) {
        echo json_encode([
            'success' => false,
            'message' => '只有当前画家可以绘画'
        ]);
        exit;
    }
    
    // 检查游戏状态
    if ($room['game_status'] !== 'playing') {
        echo json_encode([
            'success' => false,
            'message' => '游戏未在进行中'
        ]);
        exit;
    }
    
    // 验证canvas数据格式
    if (!preg_match('/^data:image\/(png|jpeg);base64,/', $canvasData)) {
        echo json_encode([
            'success' => false,
            'message' => '无效的画板数据格式'
        ]);
        exit;
    }
    
    // 保存画板数据
    $updateStmt = $conn->prepare("
        UPDATE draw_rooms 
        SET canvas_data = ?, canvas_updated_at = NOW() 
        WHERE room_code = ?
    ");
    
    $updateStmt->bind_param("ss", $canvasData, $roomCode);
    $updateStmt->execute();
    $updateStmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => '画板保存成功'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '保存画板失败: ' . $e->getMessage()
    ]);
}

$conn->close();
?>