<?php
// ============================================================
// BloodConnect — Add Donor (Admin Only)
// ============================================================
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

// Check admin session
if (empty($_SESSION['user_id']) || empty($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    jsonResponse(['error' => 'Unauthorized. Admin access required.'], 403);
}

$input = json_decode(file_get_contents('php://input'), true);

$firstName  = trim($input['first_name'] ?? '');
$middleName = trim($input['middle_name'] ?? '');
$lastName   = trim($input['last_name'] ?? '');
$email      = trim($input['email'] ?? '');
$phone      = trim($input['phone'] ?? '');
$bloodType  = trim($input['blood_type'] ?? '');
$gender     = trim($input['gender'] ?? '');
$dob        = trim($input['dob'] ?? '');
$address    = trim($input['address'] ?? '');

// Validation
if (!$firstName || !$lastName || !$email || !$bloodType) {
    jsonResponse(['error' => 'First name, last name, email, and blood type are required.'], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Invalid email address.'], 400);
}

$validBloodTypes = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
if (!in_array($bloodType, $validBloodTypes)) {
    jsonResponse(['error' => 'Invalid blood type.'], 400);
}

$db = getDB();

// Check duplicate email
$stmt = $db->prepare('SELECT id FROM profiles WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonResponse(['error' => 'A user with this email already exists.'], 409);
}

// Insert donor with a default password (admin can share it)
$defaultPassword = password_hash('donor123', PASSWORD_DEFAULT);

$stmt = $db->prepare('
    INSERT INTO profiles (email, password_hash, first_name, middle_name, last_name, phone, dob, address, gender, blood_type, role, is_eligible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
');

$stmt->execute([
    $email,
    $defaultPassword,
    $firstName,
    $middleName ?: null,
    $lastName,
    $phone ?: null,
    $dob ?: null,
    $address ?: null,
    $gender ?: null,
    $bloodType,
    'donor'
]);

$donorId = $db->lastInsertId();

// Fetch the created donor
$stmt = $db->prepare('SELECT id, first_name, middle_name, last_name, email, phone, blood_type, gender, dob, address, role, is_eligible, created_at FROM profiles WHERE id = ?');
$stmt->execute([$donorId]);
$donor = $stmt->fetch();

jsonResponse(['message' => 'Donor added successfully.', 'donor' => $donor], 201);
