<?php
require_once __DIR__ . '/db_connect.php';

header('Content-Type: application/json');

$response = ['success' => false, 'message' => ''];

try {
    // 检查字段是否已存在并添加缺失的字段
    $fields = [
        'is_lunar' => "ADD COLUMN is_lunar TINYINT(1) DEFAULT 0 COMMENT '是否为农历日期'",
        'lunar_year' => "ADD COLUMN lunar_year INT DEFAULT NULL COMMENT '农历年份'",
        'lunar_month' => "ADD COLUMN lunar_month INT DEFAULT NULL COMMENT '农历月份'",
        'lunar_day' => "ADD COLUMN lunar_day INT DEFAULT NULL COMMENT '农历日期'",
        'lunar_leap' => "ADD COLUMN lunar_leap TINYINT(1) DEFAULT 0 COMMENT '是否为闰月'"
    ];
    
    $addedFields = [];
    $skippedFields = [];
    $errors = [];
    
    foreach ($fields as $fieldName => $addSql) {
        // 检查字段是否已存在
        $checkSql = "SHOW COLUMNS FROM anniversaries LIKE '$fieldName'";
        $result = $conn->query($checkSql);
        
        if ($result && $result->num_rows > 0) {
            // 字段已存在，跳过
            $skippedFields[] = $fieldName;
        } else {
            // 字段不存在，尝试添加
            $sql = "ALTER TABLE anniversaries " . $addSql;
            if ($conn->query($sql)) {
                $addedFields[] = $fieldName;
            } else {
                $errors[] = "$fieldName: " . $conn->error;
            }
        }
    }
    
    // 生成响应消息
    $messages = [];
    if (!empty($addedFields)) {
        $messages[] = "成功添加字段: " . implode(', ', $addedFields);
    }
    if (!empty($skippedFields)) {
        $messages[] = "字段已存在，跳过: " . implode(', ', $skippedFields);
    }
    if (!empty($errors)) {
        $messages[] = "添加失败: " . implode(', ', $errors);
    }
    
    if (empty($errors)) {
        $response['success'] = true;
        $response['message'] = implode('; ', $messages);
    } else {
        $response['message'] = implode('; ', $messages);
    }
} catch (Exception $e) {
    $response['message'] = '数据库迁移失败: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>