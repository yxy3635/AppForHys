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
$newPassword = $data['new_password'] ?? null;

if (!$targetUserId || !$newPassword) {
    echo json_encode(['success' => false, 'message' => 'User ID and new password are required.']);
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
    
    // 检查要重置密码的用户是否存在
    $stmt = $conn->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->bind_param("i", $targetUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $targetUser = $result->fetch_assoc();
    
    if (!$targetUser) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit();
    }
    
    // 加密新密码
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    
    // 更新用户密码
    $stmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
    $stmt->bind_param("si", $hashedPassword, $targetUserId);
    $stmt->execute();
    
    if ($stmt->affected_rows > 0) {
        // 记录管理员操作日志
        $logSql = "INSERT INTO system_logs (level, message, admin_id, admin_username) VALUES (?, ?, ?, ?)";
        $logMessage = "管理员重置了用户密码: " . $targetUser['username'];
        $stmt = $conn->prepare($logSql);
        $level = 'warning';
        $stmt->bind_param("ssis", $level, $logMessage, $adminUserId, $adminUser['username']);
        $stmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => 'Password reset successfully.',
            'new_password' => $newPassword // 返回明文密码供管理员查看
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to reset password.']);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?> 