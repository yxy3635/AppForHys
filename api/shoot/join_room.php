<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

$input=json_decode(file_get_contents('php://input'),true);
if(!$input||!isset($input['user_id'],$input['room_code'],$input['nickname'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$uid=(int)$input['user_id']; $code=trim($input['room_code']); $nick=trim($input['nickname']);

try{
  $stmt=$conn->prepare("SELECT * FROM shoot_rooms WHERE room_code=?");
  $stmt->bind_param("s",$code); $stmt->execute(); $room=$stmt->get_result()->fetch_assoc(); $stmt->close();
  if(!$room){ echo json_encode(['success'=>false,'message'=>'房间不存在']); exit; }

  if(!$room['player1_id']){
    $u=$conn->prepare("UPDATE shoot_rooms SET player1_id=?, player1_name=? WHERE room_code=?");
    $u->bind_param("iss",$uid,$nick,$code); $u->execute(); $u->close();
  }elseif(!$room['player2_id'] && $room['player1_id']!=$uid){
    $u=$conn->prepare("UPDATE shoot_rooms SET player2_id=?, player2_name=? WHERE room_code=?");
    $u->bind_param("iss",$uid,$nick,$code); $u->execute(); $u->close();
  }
  // 双方到齐后将状态切到 waiting_set，准备射者设置
  $stmt2=$conn->prepare("SELECT player1_id,player2_id,game_status FROM shoot_rooms WHERE room_code=?");
  $stmt2->bind_param("s",$code); $stmt2->execute(); $r2=$stmt2->get_result()->fetch_assoc(); $stmt2->close();
  if($r2 && $r2['player1_id'] && $r2['player2_id'] && $r2['game_status']==='waiting'){
    $u2=$conn->prepare("UPDATE shoot_rooms SET game_status='waiting_set', chances_left=15, turn_deadline=NULL WHERE room_code=?");
    $u2->bind_param("s",$code); $u2->execute(); $u2->close();
  }
  echo json_encode(['success'=>true]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'加入失败: '.$e->getMessage()]); }
?>


