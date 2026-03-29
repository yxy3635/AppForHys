<?php
// 设置错误报告
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

if (!$input || !isset($input['user_id'], $input['room_code'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

$userId = (int)$input['user_id'];
$roomCode = trim($input['room_code']);
$customWord = isset($input['custom_word']) ? trim($input['custom_word']) : null;

try {
    require_once __DIR__ . '/../db_connect.php';
    
    // 获取房间信息
    $stmt = $conn->prepare("SELECT * FROM draw_rooms WHERE room_code = ?");
    if (!$stmt) {
        throw new Exception("准备查询语句失败: " . $conn->error);
    }
    
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
    
    // 权限检查：第一局检查房主，后续局检查当前画家
    if ($room['current_word'] === 'WAITING_FOR_WORD') {
        // 等待词汇选择状态，检查是否是当前画家
        if ($room['current_drawer'] && intval($room['current_drawer']) !== $userId) {
            echo json_encode([
                'success' => false,
                'message' => '只有当前画家可以选择词汇'
            ]);
            exit;
        }
    } else {
        // 第一局，检查是否是房主
        if ($room['player1_id'] != $userId) {
            echo json_encode([
                'success' => false,
                'message' => '只有房主可以开始游戏'
            ]);
            exit;
        }
    }
    
    // 检查房间状态
    if ($room['game_status'] !== 'waiting') {
        echo json_encode([
            'success' => false,
            'message' => '游戏已经开始或已结束'
        ]);
        exit;
    }
    
    // 检查玩家数量
    if (!$room['player1_id'] || !$room['player2_id']) {
        echo json_encode([
            'success' => false,
            'message' => '需要两个玩家才能开始游戏'
        ]);
        exit;
    }
    
    // 确定画家：等待词汇选择状态使用已确定的画家，第一局使用点击者
    if ($room['game_status'] === 'waiting' && $room['current_word'] === 'WAITING_FOR_WORD' && $room['current_drawer']) {
        $firstDrawer = intval($room['current_drawer']);
    } else {
        // 第一局，点击开始游戏的用户成为画家
        $firstDrawer = intval($input['user_id']);
    }
    
    // 获取游戏词汇
    if ($customWord) {
        // 验证自定义词语
        if (mb_strlen($customWord) > 5) {
            echo json_encode([
                'success' => false,
                'message' => '自定义词语不能超过5个字'
            ]);
            exit;
        }
        if (empty($customWord) || preg_match('/[^\p{L}\p{N}]/u', $customWord)) {
            echo json_encode([
                'success' => false,
                'message' => '词语只能包含汉字、字母和数字'
            ]);
            exit;
        }
        $firstWord = $customWord;
    } else {
        // 使用默认词库
        $words = ['苹果', '太阳', '汽车', '房子', '猫', '狗', '花', '树', '月亮', '星星'];
        $firstWord = $words[array_rand($words)];
    }
    
    // 确定当前轮数
    $currentRound = ($room['current_word'] === 'WAITING_FOR_WORD') ? $room['current_round'] : 1;
    
    // 确定是否重置分数（只在第一局重置）
    $resetScores = ($room['current_word'] !== 'WAITING_FOR_WORD');
    
    // 开始游戏 - 清空画布并更新基本字段
    if ($resetScores) {
        // 第一局，重置分数
        $updateStmt = $conn->prepare("
            UPDATE draw_rooms 
            SET game_status = 'playing', 
                current_round = ?, 
                current_drawer = ?, 
                current_word = ?,
                player1_score = 0,
                player2_score = 0,
                canvas_data = NULL,
                canvas_updated_at = NOW()
            WHERE room_code = ?
        ");
        $updateStmt->bind_param("iiss", $currentRound, $firstDrawer, $firstWord, $roomCode);
    } else {
        // 后续局，保持分数
        $updateStmt = $conn->prepare("
            UPDATE draw_rooms 
            SET game_status = 'playing', 
                current_round = ?, 
                current_drawer = ?, 
                current_word = ?,
                canvas_data = NULL,
                canvas_updated_at = NOW()
            WHERE room_code = ?
        ");
        $updateStmt->bind_param("iiss", $currentRound, $firstDrawer, $firstWord, $roomCode);
    }
    
    if (!$updateStmt) {
        throw new Exception("准备更新语句失败: " . $conn->error);
    }
    
    if (!$updateStmt->execute()) {
        throw new Exception("更新房间失败: " . $updateStmt->error);
    }
    $updateStmt->close();
    
    // 添加系统消息
    $drawerName = ($firstDrawer == $room['player1_id']) ? $room['player1_name'] : $room['player2_name'];
    $message = "游戏开始！第{$currentRound}轮由 $drawerName 来画画！";
    
    $msgStmt = $conn->prepare("
        INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
        VALUES (?, 0, 'System', ?, 1)
    ");
    
    if ($msgStmt) {
        $msgStmt->bind_param("ss", $roomCode, $message);
        $msgStmt->execute();
        $msgStmt->close();
    }
    
    echo json_encode([
        'success' => true,
        'message' => '游戏开始成功',
        'current_word' => $firstWord,
        'current_drawer' => $firstDrawer
    ]);
    
    $conn->close();
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '开始游戏失败: ' . $e->getMessage(),
        'debug_info' => [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ]);
    
    if (isset($conn)) {
        $conn->close();
    }
}
?>