<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

$input=json_decode(file_get_contents('php://input'),true);
if(!$input||!isset($input['user_id'],$input['room_code'],$input['text'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$uid=(int)$input['user_id']; $code=trim($input['room_code']); $text=trim($input['text']);

try{
  $stmt=$conn->prepare("SELECT * FROM shoot_rooms WHERE room_code=?");
  $stmt->bind_param("s",$code); $stmt->execute(); $room=$stmt->get_result()->fetch_assoc(); $stmt->close();
  if(!$room){ echo json_encode(['success'=>false,'message'=>'房间不存在']); exit; }
  if($room['game_status']!=='asking'){ echo json_encode(['success'=>false,'message'=>'当前不可提问']); exit; }
  // 履者提问/猜测后暂停计时：将 turn_deadline 置空等待射者回应
  $u=$conn->prepare("UPDATE shoot_rooms SET turn_deadline=NULL WHERE room_code=?");
  $u->bind_param("s",$code); $u->execute(); $u->close();

  $role = ($uid==$room['shooter_id'])? 'shooter' : 'asker';
  $msg=$conn->prepare("INSERT INTO shoot_messages (room_code,role,type,text) VALUES (?,?, 'text', ?)");
  $msg->bind_param("sss",$code,$role,$text); $msg->execute(); $msg->close();

  echo json_encode(['success'=>true]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'发送失败: '.$e->getMessage()]); }
?>


