<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => '只支持POST请求'
    ]);
    exit;
}

try {
    require_once __DIR__ . '/../db_connect.php';
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['room_code'])) {
        echo json_encode([
            'success' => false,
            'message' => '缺少必要参数'
        ]);
        exit;
    }
    
    $roomCode = $input['room_code'];
    
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
    
    // 检查房间状态
    if ($room['game_status'] !== 'waiting') {
        echo json_encode([
            'success' => false,
            'message' => '游戏已经在进行中'
        ]);
        exit;
    }
    
    // 检查是否有两个玩家
    if (!$room['player1_id'] || !$room['player2_id']) {
        echo json_encode([
            'success' => false,
            'message' => '需要两个玩家才能开始游戏'
        ]);
        exit;
    }
    
    // 随机选择第一个画家
    $firstDrawer = rand(0, 1) ? $room['player1_id'] : $room['player2_id'];
    $drawerName = ($firstDrawer == $room['player1_id']) ? $room['player1_name'] : $room['player2_name'];
    
    echo json_encode([
        'success' => true,
        'current_drawer' => $firstDrawer,
        'drawer_name' => $drawerName,
        'player1_id' => $room['player1_id'],
        'player2_id' => $room['player2_id'],
        'player1_name' => $room['player1_name'],
        'player2_name' => $room['player2_name']
    ]);
    
    $conn->close();

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '服务器错误: ' . $e->getMessage(),
        'error_file' => $e->getFile(),
        'error_line' => $e->getLine(),
        'debug' => [
            'request_method' => $_SERVER['REQUEST_METHOD'],
            'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'not set',
            'post_data' => $input ?? 'failed to decode'
        ]
    ]);
}
?>