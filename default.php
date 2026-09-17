<?php
// Overwrite default placeholder and serve BloodConnect app
if (file_exists(__DIR__ . '/index.html')) {
    readfile(__DIR__ . '/index.html');
    exit;
} else {
    header("Location: index.html");
    exit;
}
