<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db_connect.php';

// 获取请求方法
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGetDiaries();
            break;
        case 'POST':
            handleCreateDiary();
            break;
        case 'PUT':
            handleUpdateDiary();
            break;
        case 'DELETE':
            handleDeleteDiary();
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => '不支持的请求方法']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}

// 获取手记列表
function handleGetDiaries() {
    global $conn;
    
    $user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    $diary_id = isset($_GET['diary_id']) ? (int)$_GET['diary_id'] : 0;
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;
    
    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '缺少用户ID']);
        return;
    }
    
    // 如果提供了diary_id，获取单个手记详情
    if ($diary_id) {
        $sql = "SELECT d.*, u.username as author_name, u.avatar_url as author_avatar 
                FROM diaries d 
                LEFT JOIN users u ON d.user_id = u.id 
                WHERE d.id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $diary_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $diary = $result->fetch_assoc();
        
        if (!$diary) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => '手记不存在']);
            return;
        }
        
        // 处理标签和图片
        $diary['tags'] = $diary['tags'] ? json_decode($diary['tags'], true) : [];
        $diary['images'] = $diary['images'] ? json_decode($diary['images'], true) : [];
        $diary['is_private'] = false;
        
        echo json_encode([
            'success' => true,
            'diaries' => [$diary]
        ]);
        return;
    }
    
    // 构建查询条件 - 获取所有用户的手记（公开的）
    $where_conditions = ['d.is_private = 0'];
    $params = [];
    $param_types = '';
    
    // 搜索条件
    if (!empty($search)) {
        $where_conditions[] = '(d.title LIKE ? OR d.content LIKE ? OR d.tags LIKE ?)';
        $search_param = '%' . $search . '%';
        $params[] = $search_param;
        $params[] = $search_param;
        $params[] = $search_param;
        $param_types .= 'sss';
    }
    
    $where_clause = implode(' AND ', $where_conditions);
    
    // 查询手记列表
    $sql = "SELECT d.*, u.username as author_name, u.avatar_url as author_avatar 
            FROM diaries d 
            LEFT JOIN users u ON d.user_id = u.id 
            WHERE $where_clause 
            ORDER BY d.created_at DESC 
            LIMIT ? OFFSET ?";
    
    $params[] = $limit;
    $params[] = $offset;
    $param_types .= 'ii';
    
    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($param_types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    
    $diaries = [];
    while ($row = $result->fetch_assoc()) {
        // 处理标签和图片
        $row['tags'] = $row['tags'] ? json_decode($row['tags'], true) : [];
        $row['images'] = $row['images'] ? json_decode($row['images'], true) : [];
        $row['is_private'] = false;
        
        $diaries[] = $row;
    }
    
    // 获取总数
    $count_sql = "SELECT COUNT(*) as total FROM diaries d WHERE $where_clause";
    $count_stmt = $conn->prepare($count_sql);
    if (!empty($count_params)) {
        $count_stmt->bind_param($count_param_types, ...$count_params);
    }
    $count_stmt->execute();
    $count_result = $count_stmt->get_result();
    $total = $count_result->fetch_assoc()['total'];
    
    echo json_encode([
        'success' => true,
        'diaries' => $diaries,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => ceil($total / $limit)
        ]
    ]);
}

// 创建手记
function handleCreateDiary() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '无效的请求数据']);
        return;
    }
    
    $user_id = isset($input['user_id']) ? (int)$input['user_id'] : 0;
    $title = isset($input['title']) ? trim($input['title']) : '';
    $content = isset($input['content']) ? trim($input['content']) : '';
    $mood = isset($input['mood']) ? trim($input['mood']) : '😊';
    $tags = isset($input['tags']) ? $input['tags'] : [];
    $images = isset($input['images']) ? $input['images'] : [];
    $is_private = 0; // 强制公开
    
    // 验证必填字段
    if (!$user_id || !$title || !$content) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '缺少必填字段']);
        return;
    }
    
    // 验证内容长度
    if (strlen($title) > 255) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '标题不能超过255个字符']);
        return;
    }
    
    if (strlen($content) > 2000) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '内容不能超过2000个字符']);
        return;
    }
    
    // 处理图片上传
    $uploaded_images = [];
    if (!empty($images)) {
        $uploaded_images = handleImageUpload($images, $user_id);
    }
    
    // 插入数据库
    $sql = "INSERT INTO diaries (user_id, title, content, mood, tags, images, is_private) VALUES (?, ?, ?, ?, ?, ?, 0)";
    $stmt = $conn->prepare($sql);
    
    $tags_json = json_encode($tags);
    $images_json = json_encode($uploaded_images);
    
    $stmt->bind_param('isssss', $user_id, $title, $content, $mood, $tags_json, $images_json);
    
    if ($stmt->execute()) {
        $diary_id = $conn->insert_id;
        
        // 获取创建的手记详情
        $get_sql = "SELECT d.*, u.username as author_name, u.avatar_url as author_avatar 
                    FROM diaries d 
                    LEFT JOIN users u ON d.user_id = u.id 
                    WHERE d.id = ?";
        $get_stmt = $conn->prepare($get_sql);
        $get_stmt->bind_param('i', $diary_id);
        $get_stmt->execute();
        $result = $get_stmt->get_result();
        $diary = $result->fetch_assoc();
        
        if ($diary) {
            $diary['tags'] = json_decode($diary['tags'], true);
            $diary['images'] = json_decode($diary['images'], true);
            $diary['is_private'] = false;
        }
        
        echo json_encode([
            'success' => true,
            'message' => '手记创建成功',
            'diary' => $diary
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '创建手记失败']);
    }
}

// 更新手记
function handleUpdateDiary() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '无效的请求数据']);
        return;
    }
    
    $diary_id = isset($input['id']) ? (int)$input['id'] : 0;
    $user_id = isset($input['user_id']) ? (int)$input['user_id'] : 0;
    $title = isset($input['title']) ? trim($input['title']) : '';
    $content = isset($input['content']) ? trim($input['content']) : '';
    $mood = isset($input['mood']) ? trim($input['mood']) : '😊';
    $tags = isset($input['tags']) ? $input['tags'] : [];
    $images = isset($input['images']) ? $input['images'] : [];
    $is_private = 0; // 强制公开
    
    if (!$diary_id || !$user_id || !$title || !$content) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '缺少必填字段']);
        return;
    }
    
    // 检查权限
    $check_sql = "SELECT id FROM diaries WHERE id = ? AND user_id = ?";
    $check_stmt = $conn->prepare($check_sql);
    $check_stmt->bind_param('ii', $diary_id, $user_id);
    $check_stmt->execute();
    $check_result = $check_stmt->get_result();
    
    if ($check_result->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '没有权限修改此手记']);
        return;
    }
    
    // 处理图片上传
    $uploaded_images = [];
    if (!empty($images)) {
        $uploaded_images = handleImageUpload($images, $user_id);
    }
    
    // 更新数据库
    $sql = "UPDATE diaries SET title = ?, content = ?, mood = ?, tags = ?, images = ?, is_private = 0 WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    
    $tags_json = json_encode($tags);
    $images_json = json_encode($uploaded_images);
    
    $stmt->bind_param('sssssii', $title, $content, $mood, $tags_json, $images_json, $diary_id, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => '手记更新成功'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '更新手记失败']);
    }
}

// 删除手记
function handleDeleteDiary() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '无效的请求数据']);
        return;
    }
    
    $diary_id = isset($input['id']) ? (int)$input['id'] : 0;
    $user_id = isset($input['user_id']) ? (int)$input['user_id'] : 0;
    
    if (!$diary_id || !$user_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '缺少必填字段']);
        return;
    }
    
    // 检查权限
    $check_sql = "SELECT images FROM diaries WHERE id = ? AND user_id = ?";
    $check_stmt = $conn->prepare($check_sql);
    $check_stmt->bind_param('ii', $diary_id, $user_id);
    $check_stmt->execute();
    $check_result = $check_stmt->get_result();
    
    if ($check_result->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '没有权限删除此手记']);
        return;
    }
    
    $diary = $check_result->fetch_assoc();
    
    // 删除手记
    $sql = "DELETE FROM diaries WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ii', $diary_id, $user_id);
    
    if ($stmt->execute()) {
        // 删除相关图片文件
        if ($diary['images']) {
            $images = json_decode($diary['images'], true);
            foreach ($images as $image) {
                if (file_exists($image)) {
                    unlink($image);
                }
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => '手记删除成功'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '删除手记失败']);
    }
}

// 处理图片上传
function handleImageUpload($images, $user_id) {
    $uploaded_images = [];
    $upload_dir = __DIR__ . '/../uploads/diaries/' . $user_id . '/';
    
    // 创建用户目录
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }
    
    foreach ($images as $index => $image_data) {
        // 如果是base64数据
        if (strpos($image_data, 'data:image/') === 0) {
            $image_data = substr($image_data, strpos($image_data, ',') + 1);
            $image_data = base64_decode($image_data);
            
            $filename = 'diary_' . time() . '_' . $index . '.jpg';
            $filepath = $upload_dir . $filename;
            
            if (file_put_contents($filepath, $image_data)) {
                $uploaded_images[] = 'uploads/diaries/' . $user_id . '/' . $filename;
            }
        } 
        // 如果是文件路径（已上传的文件）
        else if (file_exists(__DIR__ . '/../' . $image_data)) {
            $uploaded_images[] = $image_data;
        }
    }
    
    return $uploaded_images;
}
?> 