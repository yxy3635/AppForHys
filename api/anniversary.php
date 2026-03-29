<?php
// 开启错误报告用于调试
error_reporting(E_ALL);
ini_set('display_errors', 0); // 不直接输出错误到页面
ini_set('log_errors', 1); // 记录错误到日志

require_once __DIR__ . '/db_connect.php'; // 引入数据库连接文件

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // 允许所有来源访问，生产环境请根据需要限制
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理 OPTIONS 请求（CORS 预检）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 获取请求方法和数据
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

$response = ['success' => false, 'message' => ''];

// 检查农历字段是否存在
function checkLunarFields($conn) {
    $result = $conn->query("SHOW COLUMNS FROM anniversaries");
    $columns = [];
    while ($row = $result->fetch_assoc()) {
        $columns[] = $row['Field'];
    }
    
    $requiredFields = ['is_lunar', 'lunar_year', 'lunar_month', 'lunar_day', 'lunar_leap'];
    $missingFields = array_diff($requiredFields, $columns);
    
    return empty($missingFields);
}

$hasLunarFields = checkLunarFields($conn);

try {

if ($method === 'GET') {
    // 获取所有纪念日（不区分用户）
    if ($hasLunarFields) {
        $stmt = $conn->prepare("SELECT id, user_id, title, date, description, is_lunar, lunar_year, lunar_month, lunar_day, lunar_leap, created_at, updated_at FROM anniversaries ORDER BY date ASC");
    } else {
        $stmt = $conn->prepare("SELECT id, user_id, title, date, description, created_at, updated_at FROM anniversaries ORDER BY date ASC");
    }
    
    $stmt->execute();
    $result = $stmt->get_result();

    $anniversaries = [];
    while ($row = $result->fetch_assoc()) {
        if ($hasLunarFields) {
            // 转换布尔值
            $row['is_lunar'] = (bool)$row['is_lunar'];
            $row['lunar_leap'] = (bool)$row['lunar_leap'];
        } else {
            // 如果没有农历字段，设置默认值
            $row['is_lunar'] = false;
            $row['lunar_year'] = null;
            $row['lunar_month'] = null;
            $row['lunar_day'] = null;
            $row['lunar_leap'] = false;
        }
        $anniversaries[] = $row;
    }

    $response['success'] = true;
    $response['message'] = '成功获取纪念日列表。';
    $response['data'] = $anniversaries;

    $stmt->close();

} elseif ($method === 'POST') {
    $action = $input['action'] ?? '';
    $userId = $input['user_id'] ?? null;

    if (!$userId) {
        $response['message'] = '缺少用户ID。';
        echo json_encode($response);
        exit();
    }

    switch ($action) {
        case 'add':
            $title = $input['title'] ?? '';
            $date = $input['date'] ?? '';
            $description = $input['description'] ?? null;

            if (empty($title) || empty($date)) {
                $response['message'] = '标题和日期不能为空。';
                break;
            }

            if ($hasLunarFields) {
                $is_lunar = isset($input['is_lunar']) ? (bool)$input['is_lunar'] : false;
                $lunar_year = $input['lunar_year'] ?? null;
                $lunar_month = $input['lunar_month'] ?? null;
                $lunar_day = $input['lunar_day'] ?? null;
                $lunar_leap = isset($input['lunar_leap']) ? (bool)$input['lunar_leap'] : false;
                
                // 转换为整数变量，因为bind_param需要变量引用
                $is_lunar_int = $is_lunar ? 1 : 0;
                $lunar_leap_int = $lunar_leap ? 1 : 0;

                $stmt = $conn->prepare("INSERT INTO anniversaries (user_id, title, date, description, is_lunar, lunar_year, lunar_month, lunar_day, lunar_leap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->bind_param("isssiiiii", $userId, $title, $date, $description, $is_lunar_int, $lunar_year, $lunar_month, $lunar_day, $lunar_leap_int);
            } else {
                $stmt = $conn->prepare("INSERT INTO anniversaries (user_id, title, date, description) VALUES (?, ?, ?, ?)");
                $stmt->bind_param("isss", $userId, $title, $date, $description);
            }

            if ($stmt->execute()) {
                $response['success'] = true;
                $response['message'] = '纪念日添加成功。';
            } else {
                $response['message'] = '纪念日添加失败: ' . $stmt->error;
            }
            $stmt->close();
            break;

        case 'update':
            $id = $input['id'] ?? null;
            $title = $input['title'] ?? '';
            $date = $input['date'] ?? '';
            $description = $input['description'] ?? null;

            // 添加调试信息
            error_log("UPDATE操作 - 接收到的数据: " . json_encode($input));
            error_log("UPDATE操作 - ID: " . var_export($id, true) . ", UserID: " . var_export($userId, true));

            if (!$id || empty($title) || empty($date)) {
                $response['message'] = '缺少纪念日ID、标题或日期。';
                break;
            }

            // 确保ID是整数
            $id = intval($id);

            if ($hasLunarFields) {
                $is_lunar = isset($input['is_lunar']) ? (bool)$input['is_lunar'] : false;
                $lunar_year = $input['lunar_year'] ?? null;
                $lunar_month = $input['lunar_month'] ?? null;
                $lunar_day = $input['lunar_day'] ?? null;
                $lunar_leap = isset($input['lunar_leap']) ? (bool)$input['lunar_leap'] : false;
                
                // 转换为整数变量，因为bind_param需要变量引用
                $is_lunar_int = $is_lunar ? 1 : 0;
                $lunar_leap_int = $lunar_leap ? 1 : 0;

                $stmt = $conn->prepare("UPDATE anniversaries SET title = ?, date = ?, description = ?, is_lunar = ?, lunar_year = ?, lunar_month = ?, lunar_day = ?, lunar_leap = ? WHERE id = ?");
                $stmt->bind_param("sssiiiiii", $title, $date, $description, $is_lunar_int, $lunar_year, $lunar_month, $lunar_day, $lunar_leap_int, $id);
            } else {
                $stmt = $conn->prepare("UPDATE anniversaries SET title = ?, date = ?, description = ? WHERE id = ?");
                $stmt->bind_param("sssi", $title, $date, $description, $id);
            }

            if ($stmt->execute()) {
                $affected_rows = $stmt->affected_rows;
                error_log("UPDATE操作 - 受影响的行数: " . $affected_rows);
                
                if ($affected_rows > 0) {
                    $response['success'] = true;
                    $response['message'] = '纪念日更新成功。';
                } else {
                    $response['message'] = '纪念日未找到或无更改。';
                    // 尝试查询是否存在该记录
                    $checkStmt = $conn->prepare("SELECT COUNT(*) as count FROM anniversaries WHERE id = ?");
                    $checkStmt->bind_param("i", $id);
                    $checkStmt->execute();
                    $checkResult = $checkStmt->get_result()->fetch_assoc();
                    error_log("UPDATE操作 - 记录是否存在 (id=$id): " . $checkResult['count']);
                    
                    $checkStmt->close();
                }
            } else {
                $response['message'] = '纪念日更新失败: ' . $stmt->error;
            }
            $stmt->close();
            break;

        case 'delete':
            $id = $input['id'] ?? null;

            if (!$id) {
                $response['message'] = '缺少纪念日ID。';
                break;
            }

            $stmt = $conn->prepare("DELETE FROM anniversaries WHERE id = ?");
            $stmt->bind_param("i", $id);

            if ($stmt->execute()) {
                if ($stmt->affected_rows > 0) {
                    $response['success'] = true;
                    $response['message'] = '纪念日删除成功。';
                } else {
                    $response['message'] = '纪念日未找到。';
                }
            } else {
                $response['message'] = '纪念日删除失败: ' . $stmt->error;
            }
            $stmt->close();
            break;

        default:
            $response['message'] = '无效的操作。';
            break;
    }
} else {
    $response['message'] = '不支持的请求方法。';
}

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = '服务器错误: ' . $e->getMessage();
} catch (Error $e) {
    $response['success'] = false;
    $response['message'] = '系统错误: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>