<?php
// ============================================================
// BloodConnect — Get Donors List (Admin Only)
// ============================================================
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

// Check admin session
if (empty($_SESSION['user_id']) || empty($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    jsonResponse(['error' => 'Unauthorized. Admin access required.'], 403);
}

$db = getDB();

$stmt = $db->query('SELECT id, first_name, middle_name, last_name, email, phone, blood_type, gender, dob, address, is_eligible, created_at FROM profiles WHERE role = "donor" ORDER BY created_at DESC');
$donors = $stmt->fetchAll();

jsonResponse(['donors' => $donors]);
