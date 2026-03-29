<?php
// 设置响应头，允许跨域请求
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// 处理 OPTIONS 请求（CORS 预检）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 包含数据库配置
include_once 'config.php'; // config.php在同一个目录

// 创建数据库连接
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// 检查连接
if ($conn->connect_error) {
    echo json_encode(["success" => false, "message" => "数据库连接失败: " . $conn->connect_error]);
    exit();
}

// 获取POST数据
$content = $_POST['content'] ?? '';
$username = $_POST['username'] ?? "未知用户"; // 从前端获取用户名
$userId = $_POST['user_id'] ?? null; // 从前端获取用户ID

// 检查用户ID是否有效
if ($userId === null || !is_numeric($userId)) {
    echo json_encode(["success" => false, "message" => "用户ID无效，无法发布动态。"]);
    exit();
}

// 处理文件上传
$uploadDir = '../uploads/'; 
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true); // 如果目录不存在则创建
}

$uploadedMedia = [];
$mediaType = 'text'; // 默认动态类型为文本

// 检查是否有文件上传
if (isset($_FILES['media']) && !empty($_FILES['media']['name'][0])) {
    $files = $_FILES['media'];
    $isImageUpload = false;
    $isVideoUpload = false;

    // Determine if it's primarily image or video upload based on the first file's type
    if (strpos($files['type'][0], 'image') !== false) {
        $isImageUpload = true;
        $mediaType = 'image';
    } elseif (strpos($files['type'][0], 'video') !== false) {
        $isVideoUpload = true;
        $mediaType = 'video';
    } else {
        echo json_encode(["success" => false, "message" => "不支持的文件类型。"]);
        exit();
    }

    // 强制只允许上传一个视频
    if ($isVideoUpload && count($files['name']) > 1) {
        echo json_encode(["success" => false, "message" => "一次只能上传一个视频文件。"]);
        exit();
    }

    foreach ($files['name'] as $index => $fileName) {
        if ($files['error'][$index] === UPLOAD_ERR_OK) {
            $tmpFilePath = $files['tmp_name'][$index];
            $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            $newFileName = uniqid() . '.' . $fileExtension; // 生成唯一文件名
            $targetFilePath = $uploadDir . $newFileName;

            $allowImageTypes = ['jpg', 'png', 'jpeg', 'gif'];
            $allowVideoTypes = ['mp4', 'mov', 'avi', 'webm']; // Added webm for broader compatibility

            $currentFileType = $files['type'][$index];

            if ($isImageUpload) {
                if (!in_array($fileExtension, $allowImageTypes) || strpos($currentFileType, 'image') === false) {
                    echo json_encode(["success" => false, "message" => "文件 " . $fileName . " 不是受支持的图片类型。"]);
                    exit();
                }
            } elseif ($isVideoUpload) {
                if (!in_array($fileExtension, $allowVideoTypes) || strpos($currentFileType, 'video') === false) {
                    echo json_encode(["success" => false, "message" => "文件 " . $fileName . " 不是受支持的视频类型。"]);
                    exit();
                }
            }
            

            if (move_uploaded_file($tmpFilePath, $targetFilePath)) {
                $uploadedMedia[] = [
                    'url' => 'uploads/' . $newFileName,
                    'type' => $isImageUpload ? 'image' : 'video' // Based on initial determination
                ];
            } else {
                echo json_encode(["success" => false, "message" => "文件 " . $fileName . " 上传失败。"]);
                exit();
            }
        } else {
            // Handle upload errors for individual files
            echo json_encode(["success" => false, "message" => "文件 " . $fileName . " 上传错误: " . $files['error'][$index]]);
            exit();
        }
    }
}

// 将上传的媒体信息JSON编码后存储
$mediaUrlJson = json_encode($uploadedMedia);

// 插入数据到数据库
$stmt = $conn->prepare("INSERT INTO posts (user_id, username, content, media_type, media_url) VALUES (?, ?, ?, ?, ?)");
// Use $mediaType determined from the first file or 'text' if no media
$stmt->bind_param("issss", $userId, $username, $content, $mediaType, $mediaUrlJson);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "动态发布成功！"]);
} else {
    echo json_encode(["success" => false, "message" => "动态发布失败: " . $stmt->error]);
}

$stmt->close();
$conn->close();
?>