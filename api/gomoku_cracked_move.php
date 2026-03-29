<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db_connect.php';

$input = file_get_contents('php://input');
$data = json_decode($input, true);

$room_code = trim($data['room_code'] ?? '');
$user_id = intval($data['user_id'] ?? 0);
$x = intval($data['x'] ?? -1);
$y = intval($data['y'] ?? -1);

if (!$room_code || !$user_id || $x < 0 || $y < 0) {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT * FROM gomoku_cracked_rooms WHERE room_code = ?");
    $stmt->bind_param("s", $room_code);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    
    if (!$room) {
        echo json_encode(['success' => false, 'message' => '房间不存在']);
        exit;
    }
    
    if ($room['game_status'] !== 'playing') {
        echo json_encode(['success' => false, 'message' => '游戏未开始']);
        exit;
    }
    
    // 确定玩家颜色
    $player_color = 0;
    if ($room['player1_id'] == $user_id) {
        $player_color = 1;
    } elseif ($room['player2_id'] == $user_id) {
        $player_color = 2;
    } else {
        echo json_encode(['success' => false, 'message' => '你不在此房间中']);
        exit;
    }
    
    // 检查是否轮到该玩家
    if ($room['current_turn'] != $player_color) {
        echo json_encode(['success' => false, 'message' => '还没轮到你']);
        exit;
    }
    
    // 解析棋盘状态
    $board = json_decode($room['board_state'] ?: '[]', true);
    if (!$board) {
        $board = array_fill(0, 15, array_fill(0, 15, 0));
    }
    
    // 检查位置是否有效
    if ($x < 0 || $x >= 15 || $y < 0 || $y >= 15) {
        echo json_encode(['success' => false, 'message' => '坐标超出范围']);
        exit;
    }
    
    // 检查位置是否已被占用
    if ($board[$x][$y] !== 0) {
        echo json_encode(['success' => false, 'message' => '该位置已有棋子']);
        exit;
    }
    
    // 落子
    $board[$x][$y] = $player_color;
    
    // 破解版特色：不检查胜利条件，直接切换回合
    $next_turn = ($player_color === 1) ? 2 : 1;
    
    // 更新数据库
    $board_json = json_encode($board);
    $stmt = $conn->prepare("
        UPDATE gomoku_cracked_rooms 
        SET board_state = ?, current_turn = ?, updated_at = CURRENT_TIMESTAMP
        WHERE room_code = ?
    ");
    $stmt->bind_param("sis", $board_json, $next_turn, $room_code);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => '落子成功（破解模式：五连珠不会结束游戏）',
        'next_turn' => $next_turn
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '落子失败: ' . $e->getMessage()
    ]);
}
?>