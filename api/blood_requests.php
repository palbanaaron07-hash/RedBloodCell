<?php
// ============================================================
// BloodConnect — Blood Requests API (Patient)
// ============================================================
require_once __DIR__ . '/config.php';

// Check session
if (empty($_SESSION['user_id'])) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get requests for the logged-in patient
    $stmt = $db->prepare('SELECT * FROM blood_requests WHERE requester_id = ? ORDER BY created_at DESC');
    $stmt->execute([$_SESSION['user_id']]);
    $requests = $stmt->fetchAll();
    jsonResponse(['requests' => $requests]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    $bloodType  = trim($input['blood_type'] ?? '');
    $units      = intval($input['units_needed'] ?? 1);
    $hospital   = trim($input['hospital'] ?? '');
    $urgency    = trim($input['urgency'] ?? 'normal');
    $notes      = trim($input['notes'] ?? '');

    if (!$bloodType || !$hospital) {
        jsonResponse(['error' => 'Blood type and hospital are required.'], 400);
    }

    $validBloodTypes = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
    if (!in_array($bloodType, $validBloodTypes)) {
        jsonResponse(['error' => 'Invalid blood type.'], 400);
    }

    if (!in_array($urgency, ['normal', 'urgent', 'critical'])) {
        jsonResponse(['error' => 'Invalid urgency level.'], 400);
    }

    // Get patient name
    $stmt = $db->prepare('SELECT first_name, middle_name, last_name FROM profiles WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    $requesterName = implode(' ', array_filter([
        $user['first_name'],
        $user['middle_name'] ?? null,
        $user['last_name']
    ]));

    $stmt = $db->prepare('
        INSERT INTO blood_requests (requester_id, requester_name, blood_type, units_needed, hospital, urgency, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, "pending")
    ');
    $stmt->execute([
        $_SESSION['user_id'],
        $requesterName,
        $bloodType,
        $units,
        $hospital,
        $urgency,
        $notes ?: null
    ]);

    jsonResponse(['message' => 'Blood request submitted successfully.'], 201);

} else {
    jsonResponse(['error' => 'Method not allowed'], 405);
}
