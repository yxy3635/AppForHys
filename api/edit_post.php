<?php
// 设置响应头，允许跨域请求
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS"); // 允许GET和OPTIONS方法
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
$postId = $_POST['post_id'] ?? null;
$userId = $_POST['user_id'] ?? null;
$content = $_POST['content'] ?? '';
$clearMedia = ($_POST['clear_media'] ?? 'false') === 'true'; // 获取前端发送的清除媒体标志

if (empty($postId) || !is_numeric($postId)) {
    echo json_encode(["success" => false, "message" => "无效的动态ID。"]);
    exit();
}
if (empty($userId) || !is_numeric($userId)) {
    echo json_encode(["success" => false, "message" => "用户ID无效，无法编辑动态。"]);
    exit();
}

// 1. 查询旧动态信息，验证用户权限
$stmt = $conn->prepare("SELECT user_id, media_type, media_url FROM posts WHERE id = ?");
$stmt->bind_param("i", $postId);
$stmt->execute();
$result = $stmt->get_result();
$oldPost = $result->fetch_assoc();
$stmt->close();

if (!$oldPost) {
    echo json_encode(["success" => false, "message" => "动态不存在。"]);
    exit();
}

if (intval($oldPost['user_id']) !== intval($userId)) {
    echo json_encode(["success" => false, "message" => "无权编辑此动态。"]);
    exit();
}

$newMediaType = 'text'; // 默认是文本类型
$newMediaUrlJson = $oldPost['media_url']; // 默认保留旧的媒体URL JSON

// 2. 处理媒体文件删除和上传逻辑
$uploadDir = '../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

// 解析旧的媒体URL，用于删除旧文件
$oldMediaUrls = json_decode($oldPost['media_url'], true);
if (!is_array($oldMediaUrls)) {
    $oldMediaUrls = []; // 确保是一个数组
}

// 如果前端指示清除媒体，或者有新的文件上传，则需要删除旧文件
if ($clearMedia || (!empty($_FILES['media']['name'][0]))) {
    foreach ($oldMediaUrls as $mediaItem) {
        if (isset($mediaItem['url']) && !empty($mediaItem['url'])) {
            $oldFilePath = '../' . $mediaItem['url']; // 拼接完整路径
            if (file_exists($oldFilePath)) {
                unlink($oldFilePath); // 删除旧文件
            }
        }
    }
    $newMediaUrlJson = null; // 默认为空，等待新文件上传或明确设置为空
}


$uploadedMedia = [];
// 检查是否有新文件上传
if (isset($_FILES['media']) && !empty($_FILES['media']['name'][0])) {
    $files = $_FILES['media'];
    $isImageUpload = false;
    $isVideoUpload = false;

    // Determine if it's primarily image or video upload based on the first file's type
    if (strpos($files['type'][0], 'image') !== false) {
        $isImageUpload = true;
        $newMediaType = 'image';
    } elseif (strpos($files['type'][0], 'video') !== false) {
        $isVideoUpload = true;
        $newMediaType = 'video';
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
            $allowVideoTypes = ['mp4', 'mov', 'avi', 'webm'];

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
                    'type' => $isImageUpload ? 'image' : 'video'
                ];
            } else {
                echo json_encode(["success" => false, "message" => "文件 " . $fileName . " 上传失败。"]);
                exit();
            }
        } else {
            echo json_encode(["success" => false, "message" => "文件 " . $fileName . " 上传错误: " . $files['error'][$index]]);
            exit();
        }
    }
    // 将上传的媒体信息JSON编码后存储
    $newMediaUrlJson = json_encode($uploadedMedia);
} else if ($clearMedia) {
    // 如果没有新文件上传，但前端明确表示清除媒体
    $newMediaUrlJson = null;
    $newMediaType = 'text'; // 如果清除了所有媒体，类型变回文本
} else {
    // 否则，保持旧的媒体信息
    $newMediaUrlJson = $oldPost['media_url'];
    $newMediaType = $oldPost['media_type'];
}


// 如果新内容是空的，并且没有新媒体，则不允许编辑
if (empty($content) && empty($uploadedMedia) && $newMediaUrlJson === null) {
    echo json_encode(["success" => false, "message" => "内容和媒体至少需要有一个。"]);
    exit();
}


// 3. 更新数据库
$stmt = $conn->prepare("UPDATE posts SET content = ?, media_type = ?, media_url = ? WHERE id = ? AND user_id = ?");
// 注意：如果 $newMediaUrlJson 为 null，bind_param 会自动处理为 SQL NULL
$stmt->bind_param("sssii", $content, $newMediaType, $newMediaUrlJson, $postId, $userId);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "动态编辑成功！"]);
} else {
    echo json_encode(["success" => false, "message" => "动态编辑失败: " . $stmt->error]);
}

$stmt->close();
$conn->close();
?>