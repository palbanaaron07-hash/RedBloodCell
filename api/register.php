<?php
// ============================================================
// BloodConnect — Register API
// POST /api/register.php
// ============================================================
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);

// Required fields
$required = ['email', 'password', 'firstName', 'lastName'];
foreach ($required as $field) {
    if (empty($input[$field])) {
        jsonResponse(['error' => "Missing required field: $field"], 400);
    }
}

$email        = trim($input['email']);
$password     = $input['password'];
$firstName    = trim($input['firstName']);
$middleName   = trim($input['middleName'] ?? '');
$lastName     = trim($input['lastName']);
$phone        = trim($input['phone'] ?? '');
$dob          = $input['dob'] ?? null;
$address      = trim($input['address'] ?? '');
$gender       = $input['gender'] ?? null;
$bloodType    = $input['bloodType'] ?? null;
$selectedRole = trim($input['role'] ?? '');
$role         = in_array(strtolower($selectedRole), ['donor']) ? 'donor' : 'patient';
$username     = trim($input['username'] ?? '');
$medicalNotes = trim($input['medicalNotes'] ?? '');

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Invalid email address'], 400);
}

// Validate password length
if (strlen($password) < 8) {
    jsonResponse(['error' => 'Password must be at least 8 characters'], 400);
}

// Check if email already exists
$stmt = $pdo->prepare('SELECT id FROM profiles WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonResponse(['error' => 'An account with this email already exists'], 409);
}

// Check if username already exists (if provided)
if ($username) {
    $stmt = $pdo->prepare('SELECT id FROM profiles WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'This username is already taken'], 409);
    }
}

// Hash the password
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

// Insert new user
$stmt = $pdo->prepare('
    INSERT INTO profiles (email, password_hash, first_name, middle_name, last_name, phone, dob, address, gender, blood_type, role, username, medical_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
');
$stmt->execute([
    $email,
    $passwordHash,
    $firstName,
    $middleName ?: null,
    $lastName,
    $phone ?: null,
    $dob ?: null,
    $address ?: null,
    $gender ?: null,
    $bloodType ?: null,
    $role,
    $username ?: null,
    $medicalNotes ?: null
]);

$userId = $pdo->lastInsertId();

jsonResponse([
    'data' => [
        'user' => [
            'id'    => (int) $userId,
            'email' => $email
        ]
    ],
    'error' => null
], 201);
