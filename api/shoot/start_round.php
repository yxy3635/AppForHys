<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

$input=json_decode(file_get_contents('php://input'),true);
if(!$input||!isset($input['user_id'],$input['room_code'],$input['word'],$input['category'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$uid=(int)$input['user_id']; $code=trim($input['room_code']); $word=trim($input['word']); $cat=trim($input['category']);

try{
  $stmt=$conn->prepare("SELECT * FROM shoot_rooms WHERE room_code=?");
  $stmt->bind_param("s",$code); $stmt->execute(); $room=$stmt->get_result()->fetch_assoc(); $stmt->close();
  if(!$room){ echo json_encode(['success'=>false,'message'=>'房间不存在']); exit; }
  if($room['shooter_id']!=$uid){ echo json_encode(['success'=>false,'message'=>'仅射者可设置']); exit; }

  $deadline = date('Y-m-d H:i:s', time()+60);
  $u=$conn->prepare("UPDATE shoot_rooms SET game_status='asking', category=?, secret_word=?, chances_left=15, turn_deadline=? WHERE room_code=?");
  $u->bind_param("ssss",$cat,$word,$deadline,$code); $u->execute(); $u->close();

  $msg=$conn->prepare("INSERT INTO shoot_messages (room_code,role,type,text) VALUES (?, 'system','text',?)");
  $txt = '本轮开始，类别：'.$cat.'（履者可以提问或直接猜测）';
  $msg->bind_param("ss",$code,$txt); $msg->execute(); $msg->close();

  echo json_encode(['success'=>true]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'开始失败: '.$e->getMessage()]); }
?>


