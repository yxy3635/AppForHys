<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db_connect.php'; // 引入数据库连接文件

$response = ['success' => false, 'message' => '', 'avatar_url' => ''];

$userId = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;

if (!$userId) {
    $response['message'] = '用户ID缺失。';
    echo json_encode($response);
    $conn->close();
    exit();
}

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    $response['message'] = '未接收到头像文件或文件上传出错。';
    echo json_encode($response);
    $conn->close();
    exit();
}

$file = $_FILES['avatar'];
$fileName = $file['name'];
$fileTmpName = $file['tmp_name'];
$fileSize = $file['size'];
$fileError = $file['error'];
$fileType = $file['type'];

$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
$allowed = array('jpg', 'jpeg', 'png', 'gif'); // 允许的图片类型

if (!in_array($fileExt, $allowed)) {
    $response['message'] = '不支持的文件类型，请上传图片。';
    echo json_encode($response);
    $conn->close();
    exit();
}

if ($fileSize > 5000000) { // 限制文件大小为 5MB
    $response['message'] = '文件太大，请上传小于5MB的图片。';
    echo json_encode($response);
    $conn->close();
    exit();
}

if ($fileError !== 0) {
    $response['message'] = '文件上传过程中发生错误。';
    echo json_encode($response);
    $conn->close();
    exit();
}

// 查询旧头像URL，以便删除
$oldAvatarUrl = '';
$stmt = $conn->prepare("SELECT avatar_url FROM users WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    $oldAvatarUrl = $row['avatar_url'];
}
$stmt->close();

// 构建文件保存路径
$uploadDir = __DIR__ . '/../uploads/avatars/'; // 相对于 api 目录，uploads/avatars 在根目录
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true); // 创建目录，如果不存在
}

$newFileName = uniqid('avatar_') . '.' . $fileExt;
$destination = $uploadDir . $newFileName;

if (move_uploaded_file($fileTmpName, $destination)) {
    // 文件上传成功，更新用户资料中的头像URL
    $newAvatarRelativePath = 'uploads/avatars/' . $newFileName;

    $stmt = $conn->prepare("UPDATE users SET avatar_url = ? WHERE id = ?");
    if ($stmt === false) {
        $response['message'] = '数据库预处理失败: ' . $conn->error;
        echo json_encode($response);
        $conn->close();
        exit();
    }
    $stmt->bind_param("si", $newAvatarRelativePath, $userId);
    $stmt->execute();

    if ($stmt->affected_rows > 0) {
        $response['success'] = true;
        $response['message'] = '头像上传成功！';
        
        // 构建完整的头像 URL 返回给前端
        $base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'] . "/";
        $response['avatar_url'] = $base_url . $newAvatarRelativePath; 

        // 删除旧头像文件（如果不是默认头像且存在）
        if ($oldAvatarUrl && strpos($oldAvatarUrl, 'default-avatar.png') === false && file_exists(__DIR__ . '/../' . $oldAvatarUrl)) {
            unlink(__DIR__ . '/../' . $oldAvatarUrl);
        }
    } else {
        $response['message'] = '更新数据库头像URL失败。';
    }
    $stmt->close();

} else {
    $response['message'] = '文件移动失败。';
}

$conn->close();

echo json_encode($response);
?>