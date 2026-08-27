<?php
// ============================================================
// BloodConnect — Get Current User API
// GET /api/me.php
// ============================================================
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

if (empty($_SESSION['user_id'])) {
    jsonResponse(['user' => null, 'profile' => null]);
}

$db = getDB();

$stmt = $db->prepare('SELECT * FROM profiles WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    // Session exists but user deleted
    $_SESSION = [];
    jsonResponse(['user' => null, 'profile' => null]);
}

unset($user['password_hash']);

jsonResponse([
    'user'    => ['id' => $user['id'], 'email' => $user['email']],
    'profile' => $user
]);
