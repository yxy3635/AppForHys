<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

$input=json_decode(file_get_contents('php://input'),true);
if(!$input||!isset($input['room_code'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$code=trim($input['room_code']);
try{
  $d1=$conn->prepare("DELETE FROM shoot_messages WHERE room_code=?"); $d1->bind_param("s",$code); $d1->execute(); $d1->close();
  $d2=$conn->prepare("DELETE FROM shoot_rooms WHERE room_code=?"); $d2->bind_param("s",$code); $d2->execute(); $d2->close();
  echo json_encode(['success'=>true]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'清理失败: '.$e->getMessage()]); }
?>


