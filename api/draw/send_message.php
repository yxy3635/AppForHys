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

if (!$input || !isset($input['user_id'], $input['room_code'], $input['message'], $input['nickname'])) {
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

$userId = (int)$input['user_id'];
$roomCode = trim($input['room_code']);
$message = trim($input['message']);
$nickname = trim($input['nickname']);

if (empty($message)) {
    echo json_encode([
        'success' => false,
        'message' => '消息不能为空'
    ]);
    exit;
}

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
    
    // 检查用户是否在房间中
    if ($room['player1_id'] != $userId && $room['player2_id'] != $userId) {
        echo json_encode([
            'success' => false,
            'message' => '您不在此房间中'
        ]);
        exit;
    }
    
    $isCorrect = false;
    $correctWord = '';
    
    // 检查是否是正确答案
    if ($room['game_status'] === 'playing' && $room['current_word'] && $room['current_drawer'] != $userId) {
        // 只有非画家的玩家才能答题
        $currentWord = $room['current_word'];
        
        // 检查答案是否正确（不区分大小写，去除空格）
        if (strtolower(str_replace(' ', '', $message)) === strtolower(str_replace(' ', '', $currentWord))) {
            $isCorrect = true;
            $correctWord = $currentWord;
            
            // 给答题者加分
            $scoreField = ($userId == $room['player1_id']) ? 'player1_score' : 'player2_score';
            $updateStmt = $conn->prepare("
                UPDATE draw_rooms 
                SET $scoreField = $scoreField + 1 
                WHERE room_code = ?
            ");
            $updateStmt->bind_param("s", $roomCode);
            $updateStmt->execute();
            $updateStmt->close();
            
            // 进入下一轮
            nextRound($conn, $roomCode, $room);
        } else {
            // 答案错误，减少猜测机会
            $updateStmt = $conn->prepare("
                UPDATE draw_rooms 
                SET guess_attempts = guess_attempts - 1 
                WHERE room_code = ?
            ");
            $updateStmt->bind_param("s", $roomCode);
            $updateStmt->execute();
            $updateStmt->close();
            
            // 重新获取房间状态检查猜测机会
            $checkStmt = $conn->prepare("SELECT guess_attempts FROM draw_rooms WHERE room_code = ?");
            $checkStmt->bind_param("s", $roomCode);
            $checkStmt->execute();
            $result = $checkStmt->get_result();
            $updatedRoom = $result->fetch_assoc();
            $checkStmt->close();
            
            // 如果没有猜测机会了，画家得分并进入下一轮
            if ($updatedRoom['guess_attempts'] <= 0) {
                // 给画家加分
                $drawerScoreField = ($room['current_drawer'] == $room['player1_id']) ? 'player1_score' : 'player2_score';
                $updateStmt = $conn->prepare("
                    UPDATE draw_rooms 
                    SET $drawerScoreField = $drawerScoreField + 1 
                    WHERE room_code = ?
                ");
                $updateStmt->bind_param("s", $roomCode);
                $updateStmt->execute();
                $updateStmt->close();
                
                // 进入下一轮
                nextRound($conn, $roomCode, $room);
            }
        }
    }
    
    // 保存消息
    $insertStmt = $conn->prepare("
        INSERT INTO draw_messages (room_code, user_id, nickname, message, is_correct) 
        VALUES (?, ?, ?, ?, ?)
    ");
    $insertStmt->bind_param("sissi", $roomCode, $userId, $nickname, $message, $isCorrect);
    $insertStmt->execute();
    $insertStmt->close();
    
    echo json_encode([
        'success' => true,
        'is_correct' => $isCorrect,
        'correct_word' => $correctWord,
        'message' => '消息发送成功'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '发送消息失败: ' . $e->getMessage()
    ]);
}

$conn->close();

// 进入下一轮的函数
function nextRound($conn, $roomCode, $room) {
    try {
        // 检查是否还有下一轮
        if ($room['current_round'] >= $room['max_rounds']) {
            // 重新获取最新分数
            $scoreStmt = $conn->prepare("SELECT player1_score, player2_score, player1_name, player2_name FROM draw_rooms WHERE room_code = ?");
            $scoreStmt->bind_param("s", $roomCode);
            $scoreStmt->execute();
            $result = $scoreStmt->get_result();
            $scores = $result->fetch_assoc();
            $scoreStmt->close();
            
            $player1Score = $scores['player1_score'];
            $player2Score = $scores['player2_score'];
            $winner = '';
            
            if ($player1Score > $player2Score) {
                $winner = $scores['player1_name'] . ' 获胜！';
            } else if ($player2Score > $player1Score) {
                $winner = $scores['player2_name'] . ' 获胜！';
            } else {
                $winner = '平局！';
            }
            
            $msgStmt = $conn->prepare("
                INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
                VALUES (?, 0, 'System', ?, 1)
            ");
            $systemMessage = "游戏结束！最终比分 {$player1Score}:{$player2Score}，$winner";
            $msgStmt->bind_param("ss", $roomCode, $systemMessage);
            $msgStmt->execute();
            $msgStmt->close();
            
            // 将房间状态标记为已结束，保留数据，便于前端拉取结算信息
            $finishStmt = $conn->prepare("UPDATE draw_rooms SET game_status = 'finished', current_word = 'ENDED_AUTO' WHERE room_code = ?");
            $finishStmt->bind_param("s", $roomCode);
            $finishStmt->execute();
            $finishStmt->close();
            
        } else {
            // 进入下一轮
            $nextRound = $room['current_round'] + 1;
            $nextDrawer = ($room['current_drawer'] == $room['player1_id']) ? $room['player2_id'] : $room['player1_id'];
            
            // 临时方案：使用waiting状态，前端通过其他条件判断是否需要选择词汇
            $updateStmt = $conn->prepare("
                UPDATE draw_rooms 
                SET current_round = ?, current_drawer = ?, current_word = 'WAITING_FOR_WORD',
                    game_status = 'waiting',
                    guess_attempts = 5, round_start_time = NOW(), canvas_data = NULL 
                WHERE room_code = ?
            ");
            $updateStmt->bind_param("iis", $nextRound, $nextDrawer, $roomCode);
            $updateStmt->execute();
            $updateStmt->close();
            
            // 添加系统消息
            $drawerName = ($nextDrawer == $room['player1_id']) ? $room['player1_name'] : $room['player2_name'];
            $msgStmt = $conn->prepare("
                INSERT INTO draw_messages (room_code, user_id, nickname, message, is_system) 
                VALUES (?, 0, 'System', ?, 1)
            ");
            $systemMessage = "答对了！第{$nextRound}轮准备中，等待 $drawerName 选择词汇...";
            $msgStmt->bind_param("ss", $roomCode, $systemMessage);
            $msgStmt->execute();
            $msgStmt->close();
        }
        
    } catch (Exception $e) {
        // 静默处理错误
    }
}