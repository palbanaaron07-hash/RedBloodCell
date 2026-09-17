<?php
// Fallback entry point to serve BloodConnect index.html
if (file_exists(__DIR__ . '/index.html')) {
    readfile(__DIR__ . '/index.html');
    exit;
} else {
    header("Location: index.html");
    exit;
}
