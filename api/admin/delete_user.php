<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理 OPTIONS 请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 检查请求方法
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

// 验证管理员权限
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$adminUserId = null;

if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $adminUserId = $matches[1];
}

if (!$adminUserId) {
    echo json_encode(['success' => false, 'message' => 'Authorization required.']);
    exit();
}

// 获取请求数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);
$targetUserId = $data['user_id'] ?? null;

if (!$targetUserId) {
    echo json_encode(['success' => false, 'message' => 'User ID is required.']);
    exit();
}

try {
    // 验证管理员权限
    $stmt = $conn->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $adminUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $adminUser = $result->fetch_assoc();
    
    if (!$adminUser || $adminUser['username'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Admin access required.']);
        exit();
    }
    
    // 检查要删除的用户是否存在
    $stmt = $conn->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $targetUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $targetUser = $result->fetch_assoc();
    
    if (!$targetUser) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit();
    }
    
    // 防止删除管理员账户
    if ($targetUser['username'] === 'admin') {
        echo json_encode(['success' => false, 'message' => 'Cannot delete admin account.']);
        exit();
    }
    
    // 开始事务
    $conn->begin_transaction();
    
    try {
        // 删除用户相关的所有数据
        
        // 1. 删除用户的评论
        $stmt = $conn->prepare("DELETE FROM comments WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        
        // 2. 删除用户的动态
        $stmt = $conn->prepare("DELETE FROM posts WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        
        // 3. 删除用户的日记
        $stmt = $conn->prepare("DELETE FROM diaries WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        
        // 4. 删除用户的消息
        $stmt = $conn->prepare("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        
        // 5. 删除用户的通知
        $stmt = $conn->prepare("DELETE FROM notifications WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        
        // 6. 删除用户的纪念日
        $stmt = $conn->prepare("DELETE FROM anniversaries WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        
        // 7. 删除用户的五子棋房间
        $stmt = $conn->prepare("DELETE FROM gomoku_rooms WHERE user1_id = ? OR user2_id = ?");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        
        // 8. 删除用户的五子棋重赛邀请
        $stmt = $conn->prepare("DELETE FROM gomoku_rematch_invite WHERE user1_id = ? OR user2_id = ?");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        
        // 9. 最后删除用户本身
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        
        // 提交事务
        $conn->commit();
        
        // 记录管理员操作日志
        $logSql = "INSERT INTO system_logs (level, message, admin_id, admin_username) VALUES (?, ?, ?, ?)";
        $logMessage = "管理员删除了用户: " . $targetUser['username'];
        $stmt = $conn->prepare($logSql);
        $level = 'warning';
        $stmt->bind_param("ssis", $level, $logMessage, $adminUserId, $adminUser['username']);
        $stmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => 'User deleted successfully.'
        ]);
        
    } catch (Exception $e) {
        // 回滚事务
        $conn->rollback();
        throw $e;
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 