<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
$user_id = intval($input['user_id'] ?? 0);
$room_code = $input['room_code'] ?? '';
$x = intval($input['x'] ?? -1);
$y = intval($input['y'] ?? -1);

if (!$user_id || !$room_code || $x < 0 || $y < 0) {
    echo json_encode(['success' => false, 'message' => '参数错误']);
    exit();
}

// 获取房间信息
$stmt = $conn->prepare("SELECT id, player1_id, player2_id, board_state, current_turn, winner FROM gomoku_rooms WHERE room_code = ?");
$stmt->bind_param("s", $room_code);
$stmt->execute();
$result = $stmt->get_result();
$room = $result->fetch_assoc();
$stmt->close();

if (!$room) {
    echo json_encode(['success' => false, 'message' => '房间不存在']);
    exit();
}
if ($room['winner']) {
    echo json_encode(['success' => false, 'message' => '游戏已结束']);
    exit();
}
if (($room['current_turn'] == 1 && $user_id != $room['player1_id']) ||
    ($room['current_turn'] == 2 && $user_id != $room['player2_id'])) {
    echo json_encode(['success' => false, 'message' => '还没轮到你']);
    exit();
}

// 解析棋盘
$board = json_decode($room['board_state'], true);
if (!is_array($board) || !isset($board[$x][$y]) || $board[$x][$y] != 0) {
    echo json_encode(['success' => false, 'message' => '落子无效']);
    exit();
}

// 落子
$color = $room['current_turn']; // 1=player1(黑), 2=player2(白)
$board[$x][$y] = $color;

// 检查胜负
function check_win($board, $x, $y, $color) {
    $dirs = [[1,0],[0,1],[1,1],[1,-1]];
    foreach ($dirs as $dir) {
        $count = 1;
        for ($d = 1; $d <= 4; $d++) {
            $nx = $x + $dir[0]*$d;
            $ny = $y + $dir[1]*$d;
            if (isset($board[$nx][$ny]) && $board[$nx][$ny] == $color) $count++;
            else break;
        }
        for ($d = 1; $d <= 4; $d++) {
            $nx = $x - $dir[0]*$d;
            $ny = $y - $dir[1]*$d;
            if (isset($board[$nx][$ny]) && $board[$nx][$ny] == $color) $count++;
            else break;
        }
        if ($count >= 5) return true;
    }
    return false;
}

$winner = null;
if (check_win($board, $x, $y, $color)) {
    $winner = $user_id;
}

// 更新数据库
$new_board_state = json_encode($board);
$new_turn = $room['current_turn'] == 1 ? 2 : 1;
$stmt = $conn->prepare("UPDATE gomoku_rooms SET board_state = ?, current_turn = ?, winner = ? WHERE id = ?");
$stmt->bind_param("siii", $new_board_state, $new_turn, $winner, $room['id']);
$stmt->execute();
$stmt->close();

echo json_encode([
    'success' => true,
    'winner' => $winner,
    'next_turn' => $new_turn,
    'board' => $board
]);
$conn->close();
?>