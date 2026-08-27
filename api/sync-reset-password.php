<?php
// Synchronize the legacy MySQL credential after Supabase recovery verification.
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? '';
$password = $input['password'] ?? '';
$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
    jsonResponse(['error' => 'Verification has expired. Request a new code.'], 401);
}

if (!in_array($action, ['validate', 'commit'], true)) {
    jsonResponse(['error' => 'Invalid reset action.'], 400);
}

$strongPassword = strlen($password) >= 10
    && preg_match('/[A-Z]/', $password)
    && preg_match('/[a-z]/', $password)
    && preg_match('/[0-9]/', $password)
    && preg_match('/[^A-Za-z0-9]/', $password);

if (!$strongPassword) {
    jsonResponse(['error' => 'Password does not meet the required security rules.'], 400);
}

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://addntsuplwotkymkyboh.supabase.co';
$supabaseAnonKey = getenv('SUPABASE_ANON_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkZG50c3VwbHdvdGt5bWt5Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTU1NDgsImV4cCI6MjA5MDgzMTU0OH0.UJMvVp9g-kc4XzmcCtnVyTIsyvV1nZ0C0T4YuzOqNb0';

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "apikey: {$supabaseAnonKey}\r\nAuthorization: Bearer {$matches[1]}\r\nAccept: application/json\r\n",
        'ignore_errors' => true,
        'timeout' => 8
    ]
]);
$authResponse = @file_get_contents($supabaseUrl . '/auth/v1/user', false, $context);
$authUser = $authResponse !== false ? json_decode($authResponse, true) : null;
$email = strtolower(trim($authUser['email'] ?? ''));

if (!$email || empty($authUser['id'])) {
    jsonResponse(['error' => 'Verification has expired. Request a new code.'], 401);
}

$stmt = $pdo->prepare('SELECT id, password_hash FROM profiles WHERE LOWER(email) = ? LIMIT 1');
$stmt->execute([$email]);
$profile = $stmt->fetch();

if (!$profile) {
    jsonResponse(['data' => ['synced' => false]]);
}

if ($action === 'validate') {
    if (password_verify($password, $profile['password_hash'])) {
        jsonResponse(['error' => 'Your new password must be different from your current password.'], 400);
    }
    jsonResponse(['data' => ['valid' => true]]);
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('UPDATE profiles SET password_hash = ? WHERE id = ?');
$stmt->execute([$passwordHash, $profile['id']]);

if (!empty($_SESSION['user_id']) && (int) $_SESSION['user_id'] === (int) $profile['id']) {
    session_regenerate_id(true);
    $_SESSION = [];
}

error_log(sprintf('Password reset synchronized for profile id %d', $profile['id']));
jsonResponse(['data' => ['synced' => true]]);
