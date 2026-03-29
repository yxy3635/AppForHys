<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../db_connect.php';

$sql = "SELECT id, room_code, player1_id, player2_id, winner, created_at, updated_at 
        FROM gomoku_rooms 
        WHERE winner IS NULL 
        ORDER BY updated_at DESC";

$result = $conn->query($sql);

$rooms = [];
while ($row = $result->fetch_assoc()) {
    $rooms[] = $row;
}

echo json_encode([
    'success' => true,
    'rooms' => $rooms
]);
$conn->close();
?>