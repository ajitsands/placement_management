<?php
/**
 * Database Migration & Table Initialization CLI Script
 * Candidate Placement & Claims Management System
 * Run via terminal: php database/migrate.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/config/Config.php';
require_once __DIR__ . '/../api/config/Database.php';

use App\Config\Config;
use App\Config\Database;

echo "=============================================================\n";
echo " Candidate Placement & Claims Management System (JCP-CMS)\n";
echo " Automated Database Migration & Setup\n";
echo "=============================================================\n\n";

Config::loadEnv();

$dbHost = Config::getDbHost();
$dbPort = Config::getDbPort();
$dbName = Config::getDbName();
$dbUser = Config::getDbUser();
$dbPass = Config::getDbPass();

echo "Connecting to MySQL database '{$dbName}' on '{$dbHost}:{$dbPort}' as user '{$dbUser}'...\n";

try {
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_MULTI_STATEMENTS => true
    ]);
    echo "✓ Connected to MySQL database successfully!\n\n";
} catch (Exception $e) {
    echo "✗ Connection failed: " . $e->getMessage() . "\n";
    echo "\nPlease verify your .env file credentials.\n";
    exit(1);
}

$sqlFile = __DIR__ . '/setup_database.sql';
if (!file_exists($sqlFile)) {
    echo "✗ setup_database.sql file not found at: {$sqlFile}\n";
    exit(1);
}

echo "Reading SQL commands from setup_database.sql...\n";
$sql = file_get_contents($sqlFile);

try {
    echo "Executing table creation and seed data insertion...\n";
    $pdo->exec($sql);
    echo "✓ Database schema and initial seeds executed successfully!\n\n";
} catch (Exception $e) {
    echo "✗ Execution error: " . $e->getMessage() . "\n";
    exit(1);
}

// Verification of tables
echo "Verifying created tables:\n";
$tables = ['settings', 'users', 'candidates', 'milestones', 'claims', 'disputes', 'payments', 'audit_logs'];

foreach ($tables as $table) {
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `{$table}`");
        $row = $stmt->fetch();
        $cnt = $row['cnt'] ?? 0;
        echo "  [✓] Table '{$table}' exists with {$cnt} records\n";
    } catch (Exception $e) {
        echo "  [✗] Table '{$table}' could not be verified: " . $e->getMessage() . "\n";
    }
}

echo "\n=============================================================\n";
echo " Setup Complete! Your database is ready for production.\n";
echo "=============================================================\n";
