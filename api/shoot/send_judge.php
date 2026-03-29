<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../db_connect.php';

$input=json_decode(file_get_contents('php://input'),true);
if(!$input||!isset($input['user_id'],$input['room_code'],$input['judge'])){ echo json_encode(['success'=>false,'message'=>'缺少参数']); exit; }
$uid=(int)$input['user_id']; $code=trim($input['room_code']); $judge=trim($input['judge']);

try{
  $stmt=$conn->prepare("SELECT * FROM shoot_rooms WHERE room_code=?");
  $stmt->bind_param("s",$code); $stmt->execute(); $room=$stmt->get_result()->fetch_assoc(); $stmt->close();
  if(!$room){ echo json_encode(['success'=>false,'message'=>'房间不存在']); exit; }
  if($room['shooter_id']!=$uid){ echo json_encode(['success'=>false,'message'=>'仅射者可判定']); exit; }
  if($room['game_status']!=='asking'){ echo json_encode(['success'=>false,'message'=>'当前不可判定']); exit; }

  // 记录判定
  $msg=$conn->prepare("INSERT INTO shoot_messages (room_code,role,type,text) VALUES (?, 'shooter','judge', ?)");
  $msg->bind_param("ss",$code,$judge); $msg->execute(); $msg->close();

  if($judge==='答案正确'){
    // 履者 +1 分，并进入下一轮或结束
    $p1=$room['player1_score']; $p2=$room['player2_score'];
    if($room['shooter_id']==$room['player1_id']) $p2++; else $p1++;
    $nextRound=((int)$room['current_round'])+1;
    $revealMsg='谜底是：'.$room['secret_word'];
    $m2=$conn->prepare("INSERT INTO shoot_messages (room_code,role,type,text) VALUES (?, 'system','text', ?)");
    $m2->bind_param("ss",$code,$revealMsg); $m2->execute(); $m2->close();
    if($nextRound>5){
      $u=$conn->prepare("UPDATE shoot_rooms SET player1_score=?, player2_score=?, game_status='finished' WHERE room_code=?");
      $u->bind_param("iis",$p1,$p2,$code); $u->execute(); $u->close();
    }else{
      $u=$conn->prepare("UPDATE shoot_rooms SET player1_score=?, player2_score=?, current_round=?, game_status='waiting_set', category=NULL, secret_word=NULL, chances_left=15, turn_deadline=NULL, shooter_id=CASE WHEN shooter_id=player1_id THEN player2_id ELSE player1_id END WHERE room_code=?");
      $u->bind_param("iiis",$p1,$p2,$nextRound,$code); $u->execute(); $u->close();
    }
  }else{
    // 非“答案正确”则继续下一问：恢复一分钟倒计时并减少一次机会
    $ch=max(0, ((int)$room['chances_left']) - 1);
    $deadline=date('Y-m-d H:i:s', time()+60);
    if($ch<=0){
      // 机会耗尽：射者 +1
      $p1=$room['player1_score']; $p2=$room['player2_score'];
      if($room['shooter_id']==$room['player1_id']) $p1++; else $p2++;
      $nextRound=((int)$room['current_round'])+1;
      $revealMsg='15次机会用尽，谜底是：'.$room['secret_word'];
      $m2=$conn->prepare("INSERT INTO shoot_messages (room_code,role,type,text) VALUES (?, 'system','text', ?)");
      $m2->bind_param("ss",$code,$revealMsg); $m2->execute(); $m2->close();
      if($nextRound>5){
        $u=$conn->prepare("UPDATE shoot_rooms SET player1_score=?, player2_score=?, game_status='finished' WHERE room_code=?");
        $u->bind_param("iis",$p1,$p2,$code); $u->execute(); $u->close();
      }else{
        $u=$conn->prepare("UPDATE shoot_rooms SET player1_score=?, player2_score=?, current_round=?, game_status='waiting_set', category=NULL, secret_word=NULL, chances_left=15, turn_deadline=NULL, shooter_id=CASE WHEN shooter_id=player1_id THEN player2_id ELSE player1_id END WHERE room_code=?");
        $u->bind_param("iiis",$p1,$p2,$nextRound,$code); $u->execute(); $u->close();
      }
    }else{
      $u=$conn->prepare("UPDATE shoot_rooms SET chances_left=?, turn_deadline=? WHERE room_code=?");
      $u->bind_param("iss",$ch,$deadline,$code); $u->execute(); $u->close();
    }
  }

  echo json_encode(['success'=>true]);
}catch(Exception $e){ echo json_encode(['success'=>false,'message'=>'判定失败: '.$e->getMessage()]); }
?>


