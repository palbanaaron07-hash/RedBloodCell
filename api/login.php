<?php
// ============================================================
// BloodConnect — Login API
// POST /api/login.php
// ============================================================
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);

$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (!$email || !$password) {
    jsonResponse(['error' => 'Email and password are required'], 400);
}

$stmt = $pdo->prepare('SELECT * FROM profiles WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(['error' => 'Invalid email or password'], 401);
}

// Allow admin, donor, and recipient (patient) accounts to log in
if (!in_array($user['role'], ['admin', 'patient', 'donor'])) {
    jsonResponse(['error' => 'Access denied. Only admin, donor, and recipient accounts can log in.'], 403);
}

// Set session
$_SESSION['user_id'] = $user['id'];
$_SESSION['role']    = $user['role'];

// Remove password hash before sending
unset($user['password_hash']);

jsonResponse([
    'data' => [
        'user'    => ['id' => $user['id'], 'email' => $user['email']],
        'profile' => $user
    ],
    'error' => null
]);
