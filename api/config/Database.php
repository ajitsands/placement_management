<?php
/**
 * Database Connection & Data Access Layer
 * Candidate Placement & Claims Management System
 */

namespace App\Config;

use PDO;
use Exception;

class Database {
    private static ?PDO $pdo = null;
    private static bool $useMySQL = false;
    private static string $storeFile = __DIR__ . '/../data/store.json';

    public static function getConnection(): ?PDO {
        if (self::$pdo === null) {
            $hosts = [Config::getDbHost()];
            if (Config::getDbHost() === '127.0.0.1') $hosts[] = 'localhost';
            if (Config::getDbHost() === 'localhost') $hosts[] = '127.0.0.1';

            foreach ($hosts as $host) {
                try {
                    $dsn = sprintf(
                        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                        $host,
                        Config::getDbPort(),
                        Config::getDbName()
                    );
                    self::$pdo = new PDO($dsn, Config::getDbUser(), Config::getDbPass(), [
                        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_TIMEOUT            => 2
                    ]);
                    self::$useMySQL = true;
                    try {
                        self::ensureDisputeColumns(self::$pdo);
                        self::ensureJobsTable(self::$pdo);
                        self::ensureCandidateJobColumn(self::$pdo);
                        self::ensureChecklistTables(self::$pdo);
                        self::ensureCandidateChecklistColumns(self::$pdo);
                        self::ensureDocumentCategoriesTable(self::$pdo);
                    } catch (Exception $migrationError) {
                        // Non-fatal: continue with existing schema
                    }
                    break;
                } catch (Exception $e) {
                    self::$useMySQL = false;
                    self::$pdo = null;
                }
            }
        }
        return self::$pdo;
    }

    /**
     * Ensure the disputes table has the columns needed for edited details and attachments.
     */
    private static function ensureDisputeColumns(PDO $pdo): void {
        $wanted = [
            'attachments'      => 'LONGTEXT NULL',
            'remarks'          => 'TEXT NULL',
            'milestone_id'     => 'INT NULL',
            'candidate_id'     => 'INT NULL',
            'updated_at'       => 'DATETIME NULL',
            'reinstated_date'  => 'DATE NULL',
            'terminated_date'  => 'DATE NULL'
        ];
        $stmt = $pdo->query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'disputes'"
        );
        $existing = array_map('strtolower', array_column($stmt->fetchAll(), 'COLUMN_NAME'));
        if (empty($existing)) {
            return; // table not present yet
        }
        foreach ($wanted as $col => $def) {
            if (!in_array($col, $existing, true)) {
                $pdo->exec("ALTER TABLE disputes ADD COLUMN {$col} {$def}");
            }
        }
    }

    private static function ensureJobsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `jobs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_code` VARCHAR(64) NOT NULL UNIQUE,
                `job_title` VARCHAR(191) NOT NULL,
                `company_name` VARCHAR(191) NOT NULL,
                `employer_cr` VARCHAR(64) NULL,
                `department` VARCHAR(128) NULL,
                `salary_offered_bhd` DECIMAL(10, 3) NOT NULL DEFAULT 500.000,
                `vacancies_count` INT NOT NULL DEFAULT 1,
                `status` ENUM('active', 'filled', 'closed') NOT NULL DEFAULT 'active',
                `requirements` TEXT NULL,
                `description` TEXT NULL,
                `created_by` INT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_jobs_company` (`company_name`),
                INDEX `idx_jobs_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }

    private static function ensureCandidateJobColumn(PDO $pdo): void {
        $stmt = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'candidates'");
        $existing = array_map('strtolower', array_column($stmt->fetchAll(), 'COLUMN_NAME'));
        if (!in_array('job_id', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN job_id INT NULL");
        }
        if (!in_array('job_code', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN job_code VARCHAR(64) NULL");
        }
    }

    private static function ensureChecklistTables(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `checklist_masters` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `code` VARCHAR(64) NOT NULL UNIQUE,
                `title` VARCHAR(191) NOT NULL,
                `description` TEXT NULL,
                `category` VARCHAR(64) NOT NULL DEFAULT 'Identity & Legal',
                `weight` INT NOT NULL DEFAULT 15,
                `is_mandatory` TINYINT(1) NOT NULL DEFAULT 1,
                `display_order` INT NOT NULL DEFAULT 1,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_checklist_code` (`code`),
                INDEX `idx_checklist_order` (`display_order`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }

    private static function ensureDocumentCategoriesTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `document_categories` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `code` VARCHAR(64) NOT NULL UNIQUE,
                `name` VARCHAR(191) NOT NULL,
                `icon` VARCHAR(32) NOT NULL DEFAULT '📄',
                `description` TEXT NULL,
                `is_mandatory` TINYINT(1) NOT NULL DEFAULT 0,
                `display_order` INT NOT NULL DEFAULT 1,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_doc_cat_code` (`code`),
                INDEX `idx_doc_cat_order` (`display_order`),
                INDEX `idx_doc_cat_active` (`is_active`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    }

    private static function ensureCandidateChecklistColumns(PDO $pdo): void {
        $stmt = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'candidates'");
        $existing = array_map('strtolower', array_column($stmt->fetchAll(), 'COLUMN_NAME'));
        if (!in_array('checklist_completion_pct', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN checklist_completion_pct INT NOT NULL DEFAULT 0");
        }
        if (!in_array('checklist_items', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN checklist_items LONGTEXT NULL");
        }
        if (!in_array('date_of_birth', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN date_of_birth DATE NULL AFTER education");
        }
        if (!in_array('phone', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN phone VARCHAR(64) NULL AFTER cpr_no");
        }
        if (!in_array('email', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN email VARCHAR(191) NULL AFTER phone");
        }
        if (!in_array('last_renewal_date', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN last_renewal_date DATE NULL AFTER registration_date");
        }
        if (!in_array('renewals_count', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN renewals_count INT NOT NULL DEFAULT 0 AFTER last_renewal_date");
        }
        if (!in_array('renewal_history', $existing, true)) {
            $pdo->exec("ALTER TABLE candidates ADD COLUMN renewal_history LONGTEXT NULL AFTER renewals_count");
        }

        try {
            $pdo->exec("ALTER TABLE `candidates` MODIFY COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'registered'");
        } catch (\PDOException $e) {
            // Ignore if already modified
        }
    }

    public static function isMySQL(): bool {
        self::getConnection();
        return self::$useMySQL;
    }

    public static function getStore(): array {
        if (self::isMySQL()) {
            try {
                return self::loadStoreFromMySQL();
            } catch (Exception $e) {
                // Graceful fallback to store.json if query fails
            }
        }

        if (!file_exists(self::$storeFile)) {
            self::initStore();
        }
        $data = file_get_contents(self::$storeFile);
        $decoded = json_decode($data, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function saveStore(array $data): bool {
        // 1. If MySQL is connected, persist to MySQL relational tables
        if (self::isMySQL()) {
            try {
                self::saveStoreToMySQL($data);
            } catch (Exception $e) {
                // Keep local store.json synced even if MySQL throws an error
            }
        }

        // 2. Persist to local JSON store as atomic fallback cache
        $dir = dirname(self::$storeFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        return (bool) file_put_contents(self::$storeFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Fetch store directly from live MySQL tables
     */
    private static function loadStoreFromMySQL(): array {
        $pdo = self::getConnection();
        if (!$pdo) {
            throw new Exception("MySQL connection unavailable");
        }

        // Settings
        $settings = [];
        $settingsRows = $pdo->query("SELECT setting_key, setting_value FROM settings")->fetchAll();
        foreach ($settingsRows as $r) {
            $v = $r['setting_value'];
            if (is_numeric($v) && strpos($v, '.') === false) $v = (int)$v;
            $settings[$r['setting_key']] = $v;
        }

        // Users
        $users = array_map(function($u) {
            $u['id'] = (int)$u['id'];
            $u['is_active'] = (int)$u['is_active'];
            return $u;
        }, $pdo->query("SELECT * FROM users ORDER BY id ASC")->fetchAll());

        // Candidates
        $candidates = array_map(function($c) {
            $c['id'] = (int)$c['id'];
            $c['salary_bhd'] = (float)$c['salary_bhd'];
            $c['case_manager_id'] = $c['case_manager_id'] !== null ? (int)$c['case_manager_id'] : null;
            $c['status'] = $c['status'] ?? 'placed';
            $c['registration_date'] = $c['registration_date'] ?? $c['joining_date'] ?? date('Y-m-d');
            $c['last_renewal_date'] = $c['last_renewal_date'] ?? null;
            $c['renewals_count'] = isset($c['renewals_count']) ? (int)$c['renewals_count'] : 0;
            if (isset($c['renewal_history']) && is_string($c['renewal_history'])) {
                $decodedRenewals = json_decode($c['renewal_history'], true);
                $c['renewal_history'] = is_array($decodedRenewals) ? $decodedRenewals : [];
            } else {
                $c['renewal_history'] = is_array($c['renewal_history'] ?? null) ? $c['renewal_history'] : [];
            }
            $c['date_of_birth'] = $c['date_of_birth'] ?? null;
            $c['phone'] = $c['phone'] ?? null;
            $c['email'] = $c['email'] ?? null;
            $c['remarks'] = $c['remarks'] ?? $c['notes'] ?? '';
            $c['checklist_completion_pct'] = isset($c['checklist_completion_pct']) ? (int)$c['checklist_completion_pct'] : 0;
            if (isset($c['checklist_items']) && is_string($c['checklist_items'])) {
                $decodedItems = json_decode($c['checklist_items'], true);
                $c['checklist_items'] = is_array($decodedItems) ? $decodedItems : [];
            } else {
                $c['checklist_items'] = is_array($c['checklist_items'] ?? null) ? $c['checklist_items'] : [];
            }
            if (isset($c['documents']) && is_string($c['documents'])) {
                $decodedDocs = json_decode($c['documents'], true);
                $c['documents'] = is_array($decodedDocs) ? $decodedDocs : [];
            } else {
                $c['documents'] = is_array($c['documents'] ?? null) ? $c['documents'] : [];
            }
            return $c;
        }, $pdo->query("SELECT * FROM candidates ORDER BY id ASC")->fetchAll());

        // Milestones
        $milestones = array_map(function($m) {
            $m['id'] = (int)$m['id'];
            $m['candidate_id'] = (int)$m['candidate_id'];
            $m['alert_dispatched'] = (int)$m['alert_dispatched'];
            return $m;
        }, $pdo->query("SELECT * FROM milestones ORDER BY id ASC")->fetchAll());

        // Claims
        $claims = array_map(function($cl) {
            $cl['id'] = (int)$cl['id'];
            $cl['candidate_id'] = (int)$cl['candidate_id'];
            $cl['milestone_id'] = $cl['milestone_id'] !== null ? (int)$cl['milestone_id'] : null;
            $cl['claim_amount_bhd'] = (float)$cl['claim_amount_bhd'];
            $cl['case_manager_id'] = $cl['case_manager_id'] !== null ? (int)$cl['case_manager_id'] : null;
            return $cl;
        }, $pdo->query("SELECT * FROM claims ORDER BY id ASC")->fetchAll());

        // Disputes
        $disputes = array_map(function($d) {
            $d['id'] = (int)$d['id'];
            $d['claim_id'] = (int)$d['claim_id'];
            $d['handled_by_user_id'] = $d['handled_by_user_id'] !== null ? (int)$d['handled_by_user_id'] : null;
            if (isset($d['milestone_id'])) $d['milestone_id'] = (int)$d['milestone_id'];
            if (isset($d['candidate_id'])) $d['candidate_id'] = (int)$d['candidate_id'];
            if (!empty($d['attachments']) && is_string($d['attachments'])) {
                $decodedAtt = json_decode($d['attachments'], true);
                $d['attachments'] = is_array($decodedAtt) ? $decodedAtt : [];
            } else if (empty($d['attachments']) || !is_array($d['attachments'])) {
                $d['attachments'] = [];
            }
            return $d;
        }, $pdo->query("SELECT * FROM disputes ORDER BY id ASC")->fetchAll());

        // Payments
        $payments = array_map(function($p) {
            $p['id'] = (int)$p['id'];
            $p['claim_id'] = (int)$p['claim_id'];
            $p['amount_paid_bhd'] = (float)$p['amount_paid_bhd'];
            if (!empty($p['attachments']) && is_string($p['attachments'])) {
                $decoded = json_decode($p['attachments'], true);
                $p['attachments'] = is_array($decoded) ? $decoded : [];
            } else if (empty($p['attachments']) || !is_array($p['attachments'])) {
                $p['attachments'] = [];
            }
            return $p;
        }, $pdo->query("SELECT * FROM payments ORDER BY id ASC")->fetchAll());

        // Audit Logs
        $auditLogs = array_map(function($a) {
            $a['id'] = (int)$a['id'];
            $a['user_id'] = $a['user_id'] !== null ? (int)$a['user_id'] : null;
            $a['entity_id'] = $a['entity_id'] !== null ? (int)$a['entity_id'] : null;
            return $a;
        }, $pdo->query("SELECT * FROM audit_logs ORDER BY id ASC")->fetchAll());

        // Jobs
        try {
            $jobs = array_map(function($j) {
                $j['id'] = (int)$j['id'];
                $j['salary_offered_bhd'] = (float)$j['salary_offered_bhd'];
                $j['vacancies_count'] = (int)$j['vacancies_count'];
                return $j;
            }, $pdo->query("SELECT * FROM jobs ORDER BY id ASC")->fetchAll());
        } catch (Exception $e) {
            $jobs = [];
        }

        if (empty($jobs) && file_exists(self::$storeFile)) {
            $jsonRaw = json_decode(file_get_contents(self::$storeFile), true);
            if (!empty($jsonRaw['jobs'])) {
                $jobs = $jsonRaw['jobs'];
                self::saveJobsToMySQL($pdo, $jobs);
            }
        }

        // Checklist Masters
        try {
            $checklistMasters = array_map(function($c) {
                $c['id'] = (int)$c['id'];
                $c['weight'] = (int)$c['weight'];
                $c['is_mandatory'] = (int)$c['is_mandatory'];
                $c['display_order'] = (int)$c['display_order'];
                $c['is_active'] = (int)$c['is_active'];
                return $c;
            }, $pdo->query("SELECT * FROM checklist_masters ORDER BY display_order ASC, id ASC")->fetchAll());
        } catch (Exception $e) {
            $checklistMasters = [];
        }

        if (empty($checklistMasters) && file_exists(self::$storeFile)) {
            $jsonRaw = json_decode(file_get_contents(self::$storeFile), true);
            if (!empty($jsonRaw['checklist_masters'])) {
                $checklistMasters = $jsonRaw['checklist_masters'];
                self::saveChecklistMastersToMySQL($pdo, $checklistMasters);
            }
        }
        if (empty($checklistMasters)) {
            $checklistMasters = \App\Models\ChecklistMaster::getDefaultItems();
            self::saveChecklistMastersToMySQL($pdo, $checklistMasters);
        }

        // Document Categories
        try {
            $docCategories = array_map(function($c) {
                $c['id'] = (int)$c['id'];
                $c['is_mandatory'] = (int)$c['is_mandatory'];
                $c['display_order'] = (int)$c['display_order'];
                $c['is_active'] = (int)$c['is_active'];
                return $c;
            }, $pdo->query("SELECT * FROM document_categories ORDER BY display_order ASC, id ASC")->fetchAll());
        } catch (Exception $e) {
            $docCategories = [];
        }

        if (empty($docCategories) && file_exists(self::$storeFile)) {
            $jsonRaw = json_decode(file_get_contents(self::$storeFile), true);
            if (!empty($jsonRaw['document_categories'])) {
                $docCategories = $jsonRaw['document_categories'];
                self::saveDocumentCategoriesToMySQL($pdo, $docCategories);
            }
        }
        if (empty($docCategories)) {
            $docCategories = \App\Models\DocumentCategory::getDefaultCategories();
            self::saveDocumentCategoriesToMySQL($pdo, $docCategories);
        }

        return [
            'settings'            => $settings,
            'users'               => $users,
            'candidates'          => $candidates,
            'jobs'                => $jobs,
            'checklist_masters'   => $checklistMasters,
            'document_categories' => $docCategories,
            'milestones'          => $milestones,
            'claims'              => $claims,
            'disputes'            => $disputes,
            'payments'            => $payments,
            'audit_logs'          => $auditLogs
        ];
    }

    private static function saveJobsToMySQL(PDO $pdo, array $jobs): void {
        try {
            self::ensureJobsTable($pdo);
            $stmt = $pdo->prepare("INSERT INTO jobs (id, job_code, job_title, company_name, employer_cr, department, salary_offered_bhd, vacancies_count, status, requirements, description, created_at)
                VALUES (:id, :job_code, :job_title, :company_name, :employer_cr, :department, :salary_offered_bhd, :vacancies_count, :status, :requirements, :description, :created_at)
                ON DUPLICATE KEY UPDATE
                    job_title = VALUES(job_title),
                    company_name = VALUES(company_name),
                    employer_cr = VALUES(employer_cr),
                    department = VALUES(department),
                    salary_offered_bhd = VALUES(salary_offered_bhd),
                    vacancies_count = VALUES(vacancies_count),
                    status = VALUES(status),
                    requirements = VALUES(requirements),
                    description = VALUES(description)");

            foreach ($jobs as $j) {
                $stmt->execute([
                    ':id' => (int)$j['id'],
                    ':job_code' => $j['job_code'],
                    ':job_title' => $j['job_title'],
                    ':company_name' => $j['company_name'],
                    ':employer_cr' => $j['employer_cr'] ?? '',
                    ':department' => $j['department'] ?? 'General',
                    ':salary_offered_bhd' => (float)($j['salary_offered_bhd'] ?? 500.0),
                    ':vacancies_count' => (int)($j['vacancies_count'] ?? 1),
                    ':status' => $j['status'] ?? 'active',
                    ':requirements' => $j['requirements'] ?? '',
                    ':description' => $j['description'] ?? '',
                    ':created_at' => $j['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        } catch (Exception $e) {
            // Ignore error if schema being populated
        }
    }

    private static function saveChecklistMastersToMySQL(PDO $pdo, array $items): void {
        try {
            self::ensureChecklistTables($pdo);
            $stmt = $pdo->prepare("INSERT INTO checklist_masters (id, code, title, description, category, weight, is_mandatory, display_order, is_active, created_at)
                VALUES (:id, :code, :title, :description, :category, :weight, :is_mandatory, :display_order, :is_active, :created_at)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    description = VALUES(description),
                    category = VALUES(category),
                    weight = VALUES(weight),
                    is_mandatory = VALUES(is_mandatory),
                    display_order = VALUES(display_order),
                    is_active = VALUES(is_active)");

            foreach ($items as $item) {
                $stmt->execute([
                    ':id'            => (int)$item['id'],
                    ':code'          => $item['code'],
                    ':title'         => $item['title'],
                    ':description'   => $item['description'] ?? '',
                    ':category'      => $item['category'] ?? 'Identity & Legal',
                    ':weight'        => (int)($item['weight'] ?? 10),
                    ':is_mandatory'  => !empty($item['is_mandatory']) ? 1 : 0,
                    ':display_order' => (int)($item['display_order'] ?? 1),
                    ':is_active'     => !empty($item['is_active']) ? 1 : 0,
                    ':created_at'    => $item['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        } catch (Exception $e) {
            // Ignore error
        }
    }

    private static function saveDocumentCategoriesToMySQL(PDO $pdo, array $items): void {
        try {
            self::ensureDocumentCategoriesTable($pdo);
            $stmt = $pdo->prepare("INSERT INTO document_categories (id, code, name, icon, description, is_mandatory, display_order, is_active, created_at)
                VALUES (:id, :code, :name, :icon, :description, :is_mandatory, :display_order, :is_active, :created_at)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    icon = VALUES(icon),
                    description = VALUES(description),
                    is_mandatory = VALUES(is_mandatory),
                    display_order = VALUES(display_order),
                    is_active = VALUES(is_active)");

            foreach ($items as $item) {
                $stmt->execute([
                    ':id'            => (int)$item['id'],
                    ':code'          => $item['code'],
                    ':name'          => $item['name'],
                    ':icon'          => $item['icon'] ?? '📄',
                    ':description'   => $item['description'] ?? '',
                    ':is_mandatory'  => !empty($item['is_mandatory']) ? 1 : 0,
                    ':display_order' => (int)($item['display_order'] ?? 1),
                    ':is_active'     => !empty($item['is_active']) ? 1 : 0,
                    ':created_at'    => $item['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        } catch (Exception $e) {
            // Ignore error
        }
    }

    /**
     * Persist store changes to live MySQL tables with relational integrity
     */
    private static function saveStoreToMySQL(array $data): void {
        $pdo = self::getConnection();
        if (!$pdo) return;

        $pdo->beginTransaction();
        try {
            // 1. Settings
            if (!empty($data['settings']) && is_array($data['settings'])) {
                $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value, category) VALUES (:k, :v, 'general') ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                foreach ($data['settings'] as $k => $v) {
                    $stmt->execute([':k' => (string)$k, ':v' => (string)$v]);
                }
            }

            // 2. Users
            if (!empty($data['users']) && is_array($data['users'])) {
                $stmt = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, full_name, role, case_manager_code, phone, is_active, created_at)
                    VALUES (:id, :username, :email, :password_hash, :full_name, :role, :case_manager_code, :phone, :is_active, :created_at)
                    ON DUPLICATE KEY UPDATE
                        username = VALUES(username),
                        email = VALUES(email),
                        password_hash = VALUES(password_hash),
                        full_name = VALUES(full_name),
                        role = VALUES(role),
                        case_manager_code = VALUES(case_manager_code),
                        phone = VALUES(phone),
                        is_active = VALUES(is_active)");

                foreach ($data['users'] as $u) {
                    $stmt->execute([
                        ':id' => (int)$u['id'],
                        ':username' => $u['username'],
                        ':email' => $u['email'] ?? ($u['username'] . '@sandslab.bh'),
                        ':password_hash' => $u['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                        ':full_name' => $u['full_name'] ?? $u['username'],
                        ':role' => $u['role'] ?? 'case_manager',
                        ':case_manager_code' => $u['case_manager_code'] ?? null,
                        ':phone' => $u['phone'] ?? null,
                        ':is_active' => isset($u['is_active']) ? (int)$u['is_active'] : 1,
                        ':created_at' => $u['created_at'] ?? date('Y-m-d H:i:s')
                    ]);
                }
            }

            // 3. Candidates
            if (!empty($data['candidates']) && is_array($data['candidates'])) {
                $stmt = $pdo->prepare("INSERT INTO candidates (id, ref_no, full_name, cpr_no, phone, email, gender, education, date_of_birth, registration_date, last_renewal_date, renewals_count, renewal_history, status, salary_bhd, position_title, employee_type, company_name, employer_cr, mol_certified, long_mol, joining_date, case_manager_id, case_manager_name, notes, comments, remarks, documents, job_id, job_code, checklist_completion_pct, checklist_items, created_at)
                    VALUES (:id, :ref_no, :full_name, :cpr_no, :phone, :email, :gender, :education, :date_of_birth, :registration_date, :last_renewal_date, :renewals_count, :renewal_history, :status, :salary_bhd, :position_title, :employee_type, :company_name, :employer_cr, :mol_certified, :long_mol, :joining_date, :case_manager_id, :case_manager_name, :notes, :comments, :remarks, :documents, :job_id, :job_code, :checklist_completion_pct, :checklist_items, :created_at)
                    ON DUPLICATE KEY UPDATE
                        full_name = VALUES(full_name),
                        cpr_no = VALUES(cpr_no),
                        phone = VALUES(phone),
                        email = VALUES(email),
                        gender = VALUES(gender),
                        education = VALUES(education),
                        date_of_birth = VALUES(date_of_birth),
                        registration_date = VALUES(registration_date),
                        last_renewal_date = VALUES(last_renewal_date),
                        renewals_count = VALUES(renewals_count),
                        renewal_history = VALUES(renewal_history),
                        status = VALUES(status),
                        salary_bhd = VALUES(salary_bhd),
                        position_title = VALUES(position_title),
                        employee_type = VALUES(employee_type),
                        company_name = VALUES(company_name),
                        employer_cr = VALUES(employer_cr),
                        mol_certified = VALUES(mol_certified),
                        long_mol = VALUES(long_mol),
                        joining_date = VALUES(joining_date),
                        case_manager_name = VALUES(case_manager_name),
                        notes = VALUES(notes),
                        comments = VALUES(comments),
                        remarks = VALUES(remarks),
                        documents = VALUES(documents),
                        job_id = VALUES(job_id),
                        job_code = VALUES(job_code),
                        checklist_completion_pct = VALUES(checklist_completion_pct),
                        checklist_items = VALUES(checklist_items)");

                foreach ($data['candidates'] as $c) {
                    $docsJson = !empty($c['documents']) ? (is_string($c['documents']) ? $c['documents'] : json_encode($c['documents'], JSON_UNESCAPED_UNICODE)) : '[]';
                    $chkItemsJson = !empty($c['checklist_items']) ? (is_string($c['checklist_items']) ? $c['checklist_items'] : json_encode($c['checklist_items'], JSON_UNESCAPED_UNICODE)) : '[]';
                    $stmt->execute([
                        ':id' => (int)$c['id'],
                        ':ref_no' => $c['ref_no'],
                        ':full_name' => $c['full_name'],
                        ':cpr_no' => $c['cpr_no'],
                        ':phone' => !empty($c['phone']) ? trim($c['phone']) : null,
                        ':email' => !empty($c['email']) ? trim($c['email']) : null,
                        ':gender' => $c['gender'] ?? 'Unspecified',
                        ':education' => $c['education'] ?? 'High School',
                        ':date_of_birth' => !empty($c['date_of_birth']) ? $c['date_of_birth'] : null,
                        ':registration_date' => $c['registration_date'] ?? $c['joining_date'] ?? date('Y-m-d'),
                        ':last_renewal_date' => !empty($c['last_renewal_date']) ? $c['last_renewal_date'] : null,
                        ':renewals_count' => (int)($c['renewals_count'] ?? 0),
                        ':renewal_history' => !empty($c['renewal_history']) ? (is_string($c['renewal_history']) ? $c['renewal_history'] : json_encode($c['renewal_history'], JSON_UNESCAPED_UNICODE)) : '[]',
                        ':status' => $c['status'] ?? 'registered',
                        ':salary_bhd' => (float)($c['salary_bhd'] ?? 0.0),
                        ':position_title' => $c['position_title'] ?? null,
                        ':employee_type' => $c['employee_type'] ?? 'Full-Time',
                        ':company_name' => $c['company_name'] ?? null,
                        ':employer_cr' => $c['employer_cr'] ?? null,
                        ':mol_certified' => $c['mol_certified'] ?? 'Yes',
                        ':long_mol' => $c['long_mol'] ?? 'No',
                        ':joining_date' => $c['joining_date'] ?? null,
                        ':case_manager_id' => !empty($c['case_manager_id']) ? (int)$c['case_manager_id'] : null,
                        ':case_manager_name' => $c['case_manager_name'] ?? 'Husain',
                        ':notes' => $c['notes'] ?? null,
                        ':comments' => $c['comments'] ?? null,
                        ':remarks' => $c['remarks'] ?? $c['notes'] ?? null,
                        ':documents' => $docsJson,
                        ':job_id' => !empty($c['job_id']) ? (int)$c['job_id'] : null,
                        ':job_code' => !empty($c['job_code']) ? $c['job_code'] : null,
                        ':checklist_completion_pct' => (int)($c['checklist_completion_pct'] ?? 0),
                        ':checklist_items' => $chkItemsJson,
                        ':created_at' => $c['created_at'] ?? date('Y-m-d H:i:s')
                    ]);
                }
            }

            // 4. Milestones
            if (!empty($data['milestones']) && is_array($data['milestones'])) {
                $stmt = $pdo->prepare("INSERT INTO milestones (id, candidate_id, milestone_type, milestone_title, due_date, status, alert_dispatched, created_at)
                    VALUES (:id, :candidate_id, :milestone_type, :milestone_title, :due_date, :status, :alert_dispatched, :created_at)
                    ON DUPLICATE KEY UPDATE
                        due_date = VALUES(due_date),
                        status = VALUES(status),
                        alert_dispatched = VALUES(alert_dispatched)");

                foreach ($data['milestones'] as $m) {
                    $stmt->execute([
                        ':id' => (int)$m['id'],
                        ':candidate_id' => (int)$m['candidate_id'],
                        ':milestone_type' => $m['milestone_type'],
                        ':milestone_title' => $m['milestone_title'],
                        ':due_date' => $m['due_date'],
                        ':status' => $m['status'] ?? 'upcoming',
                        ':alert_dispatched' => isset($m['alert_dispatched']) ? (int)$m['alert_dispatched'] : 0,
                        ':created_at' => $m['created_at'] ?? date('Y-m-d H:i:s')
                    ]);
                }
            }

            // 5. Claims
            if (!empty($data['claims']) && is_array($data['claims'])) {
                $stmt = $pdo->prepare("INSERT INTO claims (id, claim_ref, candidate_id, milestone_id, claim_type, claim_amount_bhd, status, claim_date, case_manager_id, case_manager_name, remarks, created_at)
                    VALUES (:id, :claim_ref, :candidate_id, :milestone_id, :claim_type, :claim_amount_bhd, :status, :claim_date, :case_manager_id, :case_manager_name, :remarks, :created_at)
                    ON DUPLICATE KEY UPDATE
                        claim_amount_bhd = VALUES(claim_amount_bhd),
                        status = VALUES(status),
                        remarks = VALUES(remarks)");

                foreach ($data['claims'] as $cl) {
                    $mId = !empty($cl['milestone_id']) ? (int)$cl['milestone_id'] : null;
                    $type = $cl['claim_type'] ?? 'placement';
                    if ($type === 'initial_placement') $type = 'placement';
                    if ($type === 'probation_completion' || $type === 'retention_6m') $type = '180_days';
                    if ($type === 'year_completion' || $type === 'retention_12m') $type = '365_days';
                    if (!in_array($type, ['placement', '180_days', '365_days'])) $type = 'placement';

                    $stmt->execute([
                        ':id' => (int)$cl['id'],
                        ':claim_ref' => $cl['claim_ref'],
                        ':candidate_id' => (int)$cl['candidate_id'],
                        ':milestone_id' => $mId,
                        ':claim_type' => $type,
                        ':claim_amount_bhd' => (float)$cl['claim_amount_bhd'],
                        ':status' => $cl['status'] ?? 'undisputed',
                        ':claim_date' => $cl['claim_date'] ?? date('Y-m-d'),
                        ':case_manager_id' => !empty($cl['case_manager_id']) ? (int)$cl['case_manager_id'] : null,
                        ':case_manager_name' => $cl['case_manager_name'] ?? 'Husain',
                        ':remarks' => $cl['remarks'] ?? null,
                        ':created_at' => $cl['created_at'] ?? date('Y-m-d H:i:s')
                    ]);
                }
            }

            // 6. Disputes
            if (!empty($data['disputes']) && is_array($data['disputes'])) {
                $stmt = $pdo->prepare("INSERT INTO disputes (id, claim_id, milestone_id, candidate_id, dispute_category, dispute_reason, dispute_date, status, resolution_notes, remarks, attachments, reinstated_date, terminated_date, handled_by_user_id, created_at)
                    VALUES (:id, :claim_id, :milestone_id, :candidate_id, :dispute_category, :dispute_reason, :dispute_date, :status, :resolution_notes, :remarks, :attachments, :reinstated_date, :terminated_date, :handled_by_user_id, :created_at)
                    ON DUPLICATE KEY UPDATE
                        milestone_id = VALUES(milestone_id),
                        candidate_id = VALUES(candidate_id),
                        dispute_category = VALUES(dispute_category),
                        dispute_reason = VALUES(dispute_reason),
                        dispute_date = VALUES(dispute_date),
                        status = VALUES(status),
                        resolution_notes = VALUES(resolution_notes),
                        remarks = VALUES(remarks),
                        attachments = VALUES(attachments),
                        reinstated_date = VALUES(reinstated_date),
                        terminated_date = VALUES(terminated_date)");

                foreach ($data['disputes'] as $d) {
                    $dispAttachments = null;
                    if (!empty($d['attachments'])) {
                        $dispAttachments = is_string($d['attachments']) ? $d['attachments'] : json_encode($d['attachments'], JSON_UNESCAPED_UNICODE);
                    }
                    $stmt->execute([
                        ':id' => (int)$d['id'],
                        ':claim_id' => (int)$d['claim_id'],
                        ':milestone_id' => !empty($d['milestone_id']) ? (int)$d['milestone_id'] : null,
                        ':candidate_id' => !empty($d['candidate_id']) ? (int)$d['candidate_id'] : null,
                        ':dispute_category' => $d['dispute_category'],
                        ':dispute_reason' => $d['dispute_reason'],
                        ':dispute_date' => $d['dispute_date'],
                        ':status' => $d['status'] ?? 'active_dispute',
                        ':resolution_notes' => $d['resolution_notes'] ?? null,
                        ':remarks' => $d['remarks'] ?? null,
                        ':attachments' => $dispAttachments,
                        ':reinstated_date' => $d['reinstated_date'] ?? null,
                        ':terminated_date' => $d['terminated_date'] ?? null,
                        ':handled_by_user_id' => !empty($d['handled_by_user_id']) ? (int)$d['handled_by_user_id'] : null,
                        ':created_at' => $d['created_at'] ?? date('Y-m-d H:i:s')
                    ]);
                }
            }

            // 7. Payments
            if (!empty($data['payments']) && is_array($data['payments'])) {
                $stmt = $pdo->prepare("INSERT INTO payments (id, receipt_no, claim_id, payment_date, amount_paid_bhd, payment_method, reference_doc_no, cashier_notes, attachments, created_at)
                    VALUES (:id, :receipt_no, :claim_id, :payment_date, :amount_paid_bhd, :payment_method, :reference_doc_no, :cashier_notes, :attachments, :created_at)
                    ON DUPLICATE KEY UPDATE
                        amount_paid_bhd = VALUES(amount_paid_bhd),
                        payment_method = VALUES(payment_method),
                        reference_doc_no = VALUES(reference_doc_no),
                        cashier_notes = VALUES(cashier_notes),
                        attachments = VALUES(attachments)");

                foreach ($data['payments'] as $p) {
                    $attachmentsJson = null;
                    if (!empty($p['attachments'])) {
                        $attachmentsJson = is_string($p['attachments']) ? $p['attachments'] : json_encode($p['attachments'], JSON_UNESCAPED_UNICODE);
                    }

                    $stmt->execute([
                        ':id' => (int)$p['id'],
                        ':receipt_no' => $p['receipt_no'],
                        ':claim_id' => (int)$p['claim_id'],
                        ':payment_date' => $p['payment_date'],
                        ':amount_paid_bhd' => (float)$p['amount_paid_bhd'],
                        ':payment_method' => $p['payment_method'] ?? 'Bank Transfer',
                        ':reference_doc_no' => $p['reference_doc_no'] ?? null,
                        ':cashier_notes' => $p['cashier_notes'] ?? null,
                        ':attachments' => $attachmentsJson,
                        ':created_at' => $p['created_at'] ?? date('Y-m-d H:i:s')
                    ]);
                }
            }

            // 7. Checklist Masters
            if (!empty($data['checklist_masters']) && is_array($data['checklist_masters'])) {
                self::saveChecklistMastersToMySQL($pdo, $data['checklist_masters']);
            }

            // 8. Document Categories
            if (!empty($data['document_categories']) && is_array($data['document_categories'])) {
                self::saveDocumentCategoriesToMySQL($pdo, $data['document_categories']);
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Diagnostic status report of database subsystem
     */
    public static function getStatus(): array {
        $isMySql = self::isMySQL();
        return [
            'driver'       => $isMySql ? 'MySQL' : 'Atomic JSON Store (Fallback)',
            'is_mysql'     => $isMySql,
            'host'         => Config::getDbHost(),
            'port'         => Config::getDbPort(),
            'database'     => Config::getDbName(),
            'user'         => Config::getDbUser(),
            'environment'  => Config::getAppEnv(),
            'storage_file' => self::$storeFile
        ];
    }

    public static function initStore(): void {
        $defaultStore = [
            'settings' => [
                'app_name'           => 'Candidate Placement & Claims Management System',
                'timezone'           => 'Asia/Bahrain',
                'currency'           => 'BHD',
                'currency_symbol'    => 'BD',
                'currency_decimals'  => 3,
                'date_format'        => 'DD/MM/YYYY',
                'time_format'        => '12h',
                'country'            => 'Bahrain',
                'theme_default'      => 'light',
                'lead_days_alert_180'=> 14,
                'lead_days_alert_365'=> 21,
                'standard_tier_amount_bhd' => 500
            ],
            'users' => [
                [
                    'id'                => 1,
                    'username'          => 'superadmin',
                    'email'             => 'superadmin@sandslab.com',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password123
                    'full_name'         => 'Dr. Salman (Super Admin)',
                    'role'              => 'superadmin',
                    'case_manager_code' => null,
                    'phone'             => '+973 35078079',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-01 10:00:00'
                ],
                [
                    'id'                => 2,
                    'username'          => 'directorate_admin',
                    'email'             => 'admin@placement.gov.bh',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                    'full_name'         => 'Directorate Operations Admin',
                    'role'              => 'admin',
                    'case_manager_code' => null,
                    'phone'             => '+973 77931123',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-02 11:00:00'
                ],
                [
                    'id'                => 3,
                    'username'          => 'cm_husain',
                    'email'             => 'husain@placement.gov.bh',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                    'full_name'         => 'Husain Al-Mulla',
                    'role'              => 'case_manager',
                    'case_manager_code' => 'Husain',
                    'phone'             => '+973 39123451',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-05 09:00:00'
                ],
                [
                    'id'                => 4,
                    'username'          => 'cm_meaad',
                    'email'             => 'meaad@placement.gov.bh',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                    'full_name'         => 'Meaad Al-Alawi',
                    'role'              => 'case_manager',
                    'case_manager_code' => 'Meaad',
                    'phone'             => '+973 39123452',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-05 09:30:00'
                ],
                [
                    'id'                => 5,
                    'username'          => 'cm_dina',
                    'email'             => 'dina@placement.gov.bh',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                    'full_name'         => 'Dina Aldoseri',
                    'role'              => 'case_manager',
                    'case_manager_code' => 'Dina',
                    'phone'             => '+973 39123453',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-06 08:30:00'
                ],
                [
                    'id'                => 6,
                    'username'          => 'cm_malak',
                    'email'             => 'malak@placement.gov.bh',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                    'full_name'         => 'Malak Al-Sayed',
                    'role'              => 'case_manager',
                    'case_manager_code' => 'Malak',
                    'phone'             => '+973 39123454',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-06 10:00:00'
                ],
                [
                    'id'                => 7,
                    'username'          => 'cm_zainab',
                    'email'             => 'zainab@placement.gov.bh',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                    'full_name'         => 'Zainab Mattar',
                    'role'              => 'case_manager',
                    'case_manager_code' => 'Zainab Mattar',
                    'phone'             => '+973 39123455',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-07 09:15:00'
                ],
                [
                    'id'                => 8,
                    'username'          => 'cm_mahdi',
                    'email'             => 'mahdi@placement.gov.bh',
                    'password_hash'     => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                    'full_name'         => 'Mahdi Habib',
                    'role'              => 'case_manager',
                    'case_manager_code' => 'Mahdi',
                    'phone'             => '+973 39123456',
                    'is_active'         => 1,
                    'created_at'        => '2026-01-08 11:20:00'
                ]
            ],
            'candidates' => [
                [
                    'id'                => 1,
                    'ref_no'            => 'JCP/26/268524',
                    'full_name'         => 'LULWA EZZ EBRAHIM ALBANKI',
                    'cpr_no'            => '990408710',
                    'gender'            => 'Female',
                    'education'         => 'Bachelors +',
                    'salary_bhd'        => 500.000,
                    'position_title'    => 'Quality Analyst',
                    'company_name'      => 'BAHRAIN PHARMA',
                    'employer_cr'       => 'CR-45892-1',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-10-15',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'notes'             => 'Placement confirmed under national employment program',
                    'created_at'        => '2025-10-15 08:30:00'
                ],
                [
                    'id'                => 2,
                    'ref_no'            => 'JCP/25/172042',
                    'full_name'         => 'WALEED ABDULWAHID J ABDULAZIZ',
                    'cpr_no'            => '040710890',
                    'gender'            => 'Male',
                    'education'         => 'High School',
                    'salary_bhd'        => 350.000,
                    'position_title'    => 'Sales Representative',
                    'company_name'      => 'CENTRE POINT COLOUR',
                    'employer_cr'       => 'CR-12048-2',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-08-01',
                    'case_manager_id'   => 3,
                    'case_manager_name' => 'Husain',
                    'notes'             => 'Contract registered with Ministry',
                    'created_at'        => '2025-08-01 09:00:00'
                ],
                [
                    'id'                => 3,
                    'ref_no'            => 'JCP/24/057296',
                    'full_name'         => 'ASMA MOHAMMAD ASHFAQMO DIN',
                    'cpr_no'            => '010706941',
                    'gender'            => 'Female',
                    'education'         => 'Bachelors +',
                    'salary_bhd'        => 500.000,
                    'position_title'    => 'QA Specialist',
                    'company_name'      => 'Konexus IT Solutions',
                    'employer_cr'       => 'CR-90412-1',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-09-10',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'notes'             => 'Software engineering placement',
                    'created_at'        => '2025-09-10 10:15:00'
                ],
                [
                    'id'                => 4,
                    'ref_no'            => 'JCP/25/218398',
                    'full_name'         => 'ZIYAD TAREQ MAJEDA ALTHAWADI',
                    'cpr_no'            => '980309620',
                    'gender'            => 'Male',
                    'education'         => 'Bachelors +',
                    'salary_bhd'        => 508.000,
                    'position_title'    => 'Sales Executive',
                    'company_name'      => 'Bahrain Duty Free',
                    'employer_cr'       => 'CR-00215-4',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-07-20',
                    'case_manager_id'   => 6,
                    'case_manager_name' => 'Malak',
                    'notes'             => 'Commercial duty free placement',
                    'created_at'        => '2025-07-20 08:45:00'
                ],
                [
                    'id'                => 5,
                    'ref_no'            => 'JCP/25/183340',
                    'full_name'         => 'AYSHA OMAR SALEH AL ALYAZEEDI',
                    'cpr_no'            => '031103103',
                    'gender'            => 'Female',
                    'education'         => 'Diploma',
                    'salary_bhd'        => 482.000,
                    'position_title'    => 'Retail Associate',
                    'company_name'      => 'Bahrain Duty Free',
                    'employer_cr'       => 'CR-00215-4',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-08-15',
                    'case_manager_id'   => 7,
                    'case_manager_name' => 'Zainab Mattar',
                    'notes'             => 'Airport retail location',
                    'created_at'        => '2025-08-15 11:00:00'
                ],
                [
                    'id'                => 6,
                    'ref_no'            => 'JCP/25/210558',
                    'full_name'         => 'ALI ABDULAMEER ALI ALI MOHAMED',
                    'cpr_no'            => '990805476',
                    'gender'            => 'Male',
                    'education'         => 'High School',
                    'salary_bhd'        => 450.000,
                    'position_title'    => 'Operations Assistant',
                    'company_name'      => 'ALMOAYYED CLEANING',
                    'employer_cr'       => 'CR-33019-1',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-11-01',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'notes'             => 'Almoayyed facility maintenance',
                    'created_at'        => '2025-11-01 09:20:00'
                ],
                [
                    'id'                => 7,
                    'ref_no'            => 'JCP/25/267702',
                    'full_name'         => 'ABBAS AHMED A ALHANNAN',
                    'cpr_no'            => '000508920',
                    'gender'            => 'Male',
                    'education'         => 'High School',
                    'salary_bhd'        => 400.000,
                    'position_title'    => 'Ground Support Officer',
                    'company_name'      => 'BAHRAIN AIRPORT SERVICES',
                    'employer_cr'       => 'CR-00104-1',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-11-12',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'notes'             => 'Aviation ground handling role',
                    'created_at'        => '2025-11-12 10:00:00'
                ],
                [
                    'id'                => 8,
                    'ref_no'            => 'JCP/25/267727',
                    'full_name'         => 'MAYTHAM MOHAMED JAAFAR ALI',
                    'cpr_no'            => '970204730',
                    'gender'            => 'Male',
                    'education'         => 'High School',
                    'salary_bhd'        => 450.000,
                    'position_title'    => 'Flight Dispatch Trainee',
                    'company_name'      => 'GULF AIR ACADEMY',
                    'employer_cr'       => 'CR-78219-3',
                    'mol_certified'     => 'No',
                    'joining_date'      => '2025-12-01',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'notes'             => 'Private aviation placement',
                    'created_at'        => '2025-12-01 08:30:00'
                ],
                [
                    'id'                => 9,
                    'ref_no'            => 'JCP/25/204298',
                    'full_name'         => 'ABDULLA MOHAMED HOORAN ALENEZI',
                    'cpr_no'            => '020309481',
                    'gender'            => 'Male',
                    'education'         => 'Bachelors +',
                    'salary_bhd'        => 550.000,
                    'position_title'    => 'Project Coordinator',
                    'company_name'      => 'ALMOAYYED CONTRACTING',
                    'employer_cr'       => 'CR-33019-2',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-09-01',
                    'case_manager_id'   => 7,
                    'case_manager_name' => 'Zainab Mattar',
                    'notes'             => 'Civil engineering works',
                    'created_at'        => '2025-09-01 11:30:00'
                ],
                [
                    'id'                => 10,
                    'ref_no'            => 'JCP/26/268505',
                    'full_name'         => 'YUSUF ALI YUSUF HABIB DAGHER',
                    'cpr_no'            => '010903820',
                    'gender'            => 'Male',
                    'education'         => 'Diploma',
                    'salary_bhd'        => 450.000,
                    'position_title'    => 'Maintenance Technician',
                    'company_name'      => 'KHALID SERVICES',
                    'employer_cr'       => 'CR-54128-1',
                    'mol_certified'     => 'No',
                    'joining_date'      => '2026-01-10',
                    'case_manager_id'   => 8,
                    'case_manager_name' => 'Mahdi',
                    'notes'             => 'Electro-mechanical maintenance',
                    'created_at'        => '2026-01-10 14:00:00'
                ],
                [
                    'id'                => 11,
                    'ref_no'            => 'JCP/25/219615',
                    'full_name'         => 'HUSAIN ABDULMONEM HU MOTHANNA',
                    'cpr_no'            => '010207910',
                    'gender'            => 'Male',
                    'education'         => 'High School',
                    'salary_bhd'        => 450.000,
                    'position_title'    => 'Facility Inspector',
                    'company_name'      => 'ALMOAYYED CLEANING',
                    'employer_cr'       => 'CR-33019-1',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-10-01',
                    'case_manager_id'   => 3,
                    'case_manager_name' => 'Husain',
                    'notes'             => 'Site inspection team',
                    'created_at'        => '2025-10-01 10:10:00'
                ],
                [
                    'id'                => 12,
                    'ref_no'            => 'JCP/25/212208',
                    'full_name'         => 'WALAA ISA A. HASAN',
                    'cpr_no'            => '990900045',
                    'gender'            => 'Female',
                    'education'         => 'Bachelors +',
                    'salary_bhd'        => 700.000,
                    'position_title'    => 'Senior Recruiter',
                    'company_name'      => 'STUDENT PLATFORM',
                    'employer_cr'       => 'CR-62910-1',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-07-01',
                    'case_manager_id'   => 3,
                    'case_manager_name' => 'Husain',
                    'notes'             => 'HR and talent placement specialist',
                    'created_at'        => '2025-07-01 09:00:00'
                ],
                [
                    'id'                => 13,
                    'ref_no'            => 'JCP/25/215389',
                    'full_name'         => 'DINA MOHAMED YUSUF ALDOSERI',
                    'cpr_no'            => '010408520',
                    'gender'            => 'Female',
                    'education'         => 'Bachelors +',
                    'salary_bhd'        => 620.000,
                    'position_title'    => 'Clinical Administrator',
                    'company_name'      => 'KOREAN MEDICAL CENTER',
                    'employer_cr'       => 'CR-88201-1',
                    'mol_certified'     => 'Yes',
                    'joining_date'      => '2025-06-15',
                    'case_manager_id'   => 5,
                    'case_manager_name' => 'Dina',
                    'notes'             => 'Healthcare operations coordinator',
                    'created_at'        => '2025-06-15 08:00:00'
                ]
            ],
            'milestones' => [
                ['id' => 1, 'candidate_id' => 1, 'milestone_type' => 'placement', 'milestone_title' => 'Placement Claim (Day 0)', 'due_date' => '2025-10-15', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 2, 'candidate_id' => 1, 'milestone_type' => '180_days', 'milestone_title' => '6-Month Claim (+180d)', 'due_date' => '2026-04-13', 'status' => 'due', 'alert_dispatched' => 1],
                ['id' => 3, 'candidate_id' => 1, 'milestone_type' => '365_days', 'milestone_title' => '12-Month Claim (+365d)', 'due_date' => '2026-10-15', 'status' => 'upcoming', 'alert_dispatched' => 0],
                ['id' => 4, 'candidate_id' => 2, 'milestone_type' => 'placement', 'milestone_title' => 'Placement Claim (Day 0)', 'due_date' => '2025-08-01', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 5, 'candidate_id' => 2, 'milestone_type' => '180_days', 'milestone_title' => '6-Month Claim (+180d)', 'due_date' => '2026-01-28', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 6, 'candidate_id' => 2, 'milestone_type' => '365_days', 'milestone_title' => '12-Month Claim (+365d)', 'due_date' => '2026-08-01', 'status' => 'upcoming', 'alert_dispatched' => 0],
                ['id' => 7, 'candidate_id' => 3, 'milestone_type' => 'placement', 'milestone_title' => 'Placement Claim (Day 0)', 'due_date' => '2025-09-10', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 8, 'candidate_id' => 3, 'milestone_type' => '180_days', 'milestone_title' => '6-Month Claim (+180d)', 'due_date' => '2026-03-09', 'status' => 'disputed', 'alert_dispatched' => 1],
                ['id' => 9, 'candidate_id' => 4, 'milestone_type' => 'placement', 'milestone_title' => 'Placement Claim (Day 0)', 'due_date' => '2025-07-20', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 10, 'candidate_id' => 4, 'milestone_type' => '180_days', 'milestone_title' => '6-Month Claim (+180d)', 'due_date' => '2026-01-16', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 11, 'candidate_id' => 12, 'milestone_type' => 'placement', 'milestone_title' => 'Placement Claim (Day 0)', 'due_date' => '2025-07-01', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 12, 'candidate_id' => 12, 'milestone_type' => '180_days', 'milestone_title' => '6-Month Claim (+180d)', 'due_date' => '2025-12-28', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 13, 'candidate_id' => 12, 'milestone_type' => '365_days', 'milestone_title' => '12-Month Claim (+365d)', 'due_date' => '2026-07-01', 'status' => 'due', 'alert_dispatched' => 1],
                ['id' => 14, 'candidate_id' => 13, 'milestone_type' => 'placement', 'milestone_title' => 'Placement Claim (Day 0)', 'due_date' => '2025-06-15', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 15, 'candidate_id' => 13, 'milestone_type' => '180_days', 'milestone_title' => '6-Month Claim (+180d)', 'due_date' => '2025-12-12', 'status' => 'claimed', 'alert_dispatched' => 1],
                ['id' => 16, 'candidate_id' => 13, 'milestone_type' => '365_days', 'milestone_title' => '12-Month Claim (+365d)', 'due_date' => '2026-06-15', 'status' => 'overdue', 'alert_dispatched' => 1]
            ],
            'claims' => [
                [
                    'id'                => 1,
                    'claim_ref'         => 'CLM-2025-001',
                    'candidate_id'      => 1,
                    'milestone_id'      => 1,
                    'claim_type'        => 'placement',
                    'claim_amount_bhd'  => 797.500, // Manually entered
                    'status'            => 'settled',
                    'claim_date'        => '2025-10-20',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'remarks'           => 'Approved standard placement claim for Bahrain Pharma',
                    'created_at'        => '2025-10-20 11:00:00'
                ],
                [
                    'id'                => 2,
                    'claim_ref'         => 'CLM-2025-002',
                    'candidate_id'      => 2,
                    'milestone_id'      => 4,
                    'claim_type'        => 'placement',
                    'claim_amount_bhd'  => 605.000,
                    'status'            => 'settled',
                    'claim_date'        => '2025-08-05',
                    'case_manager_id'   => 3,
                    'case_manager_name' => 'Husain',
                    'remarks'           => 'Initial placement agreed contract amount',
                    'created_at'        => '2025-08-05 09:30:00'
                ],
                [
                    'id'                => 3,
                    'claim_ref'         => 'CLM-2026-003',
                    'candidate_id'      => 2,
                    'milestone_id'      => 5,
                    'claim_type'        => '180_days',
                    'claim_amount_bhd'  => 605.000,
                    'status'            => 'undisputed',
                    'claim_date'        => '2026-02-02',
                    'case_manager_id'   => 3,
                    'case_manager_name' => 'Husain',
                    'remarks'           => '6-Month employment attendance verified',
                    'created_at'        => '2026-02-02 14:00:00'
                ],
                [
                    'id'                => 4,
                    'claim_ref'         => 'CLM-2025-004',
                    'candidate_id'      => 3,
                    'milestone_id'      => 7,
                    'claim_type'        => 'placement',
                    'claim_amount_bhd'  => 797.500,
                    'status'            => 'settled',
                    'claim_date'        => '2025-09-15',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'remarks'           => 'Placement confirmed with Konexus',
                    'created_at'        => '2025-09-15 10:45:00'
                ],
                [
                    'id'                => 5,
                    'claim_ref'         => 'CLM-2026-005',
                    'candidate_id'      => 3,
                    'milestone_id'      => 8,
                    'claim_type'        => '180_days',
                    'claim_amount_bhd'  => 797.500,
                    'status'            => 'disputed',
                    'claim_date'        => '2026-03-12',
                    'case_manager_id'   => 4,
                    'case_manager_name' => 'Meaad',
                    'remarks'           => 'Employer noted resignation before 180 days',
                    'created_at'        => '2026-03-12 11:30:00'
                ],
                [
                    'id'                => 6,
                    'claim_ref'         => 'CLM-2025-006',
                    'candidate_id'      => 4,
                    'milestone_id'      => 9,
                    'claim_type'        => 'placement',
                    'claim_amount_bhd'  => 660.000,
                    'status'            => 'settled',
                    'claim_date'        => '2025-07-25',
                    'case_manager_id'   => 6,
                    'case_manager_name' => 'Malak',
                    'remarks'           => 'Placement agreed for Duty Free',
                    'created_at'        => '2025-07-25 15:00:00'
                ],
                [
                    'id'                => 7,
                    'claim_ref'         => 'CLM-2026-007',
                    'candidate_id'      => 4,
                    'milestone_id'      => 10,
                    'claim_type'        => '180_days',
                    'claim_amount_bhd'  => 660.000,
                    'status'            => 'undisputed',
                    'claim_date'        => '2026-01-20',
                    'case_manager_id'   => 6,
                    'case_manager_name' => 'Malak',
                    'remarks'           => 'Approved 6-month claim for Duty Free',
                    'created_at'        => '2026-01-20 12:00:00'
                ],
                [
                    'id'                => 8,
                    'claim_ref'         => 'CLM-2025-008',
                    'candidate_id'      => 12,
                    'milestone_id'      => 11,
                    'claim_type'        => 'placement',
                    'claim_amount_bhd'  => 880.000,
                    'status'            => 'settled',
                    'claim_date'        => '2025-07-05',
                    'case_manager_id'   => 3,
                    'case_manager_name' => 'Husain',
                    'remarks'           => 'Placement confirmed Student Platform',
                    'created_at'        => '2025-07-05 09:30:00'
                ],
                [
                    'id'                => 9,
                    'claim_ref'         => 'CLM-2026-009',
                    'candidate_id'      => 12,
                    'milestone_id'      => 12,
                    'claim_type'        => '180_days',
                    'claim_amount_bhd'  => 880.000,
                    'status'            => 'settled',
                    'claim_date'        => '2026-01-05',
                    'case_manager_id'   => 3,
                    'case_manager_name' => 'Husain',
                    'remarks'           => '6M employment milestone completed',
                    'created_at'        => '2026-01-05 16:00:00'
                ],
                [
                    'id'                => 10,
                    'claim_ref'         => 'CLM-2025-010',
                    'candidate_id'      => 13,
                    'milestone_id'      => 14,
                    'claim_type'        => 'placement',
                    'claim_amount_bhd'  => 880.000,
                    'status'            => 'settled',
                    'claim_date'        => '2025-06-20',
                    'case_manager_id'   => 5,
                    'case_manager_name' => 'Dina',
                    'remarks'           => 'Clinical placement approved',
                    'created_at'        => '2025-06-20 10:15:00'
                ],
                [
                    'id'                => 11,
                    'claim_ref'         => 'CLM-2026-011',
                    'candidate_id'      => 13,
                    'milestone_id'      => 15,
                    'claim_type'        => '180_days',
                    'claim_amount_bhd'  => 880.000,
                    'status'            => 'undisputed',
                    'claim_date'        => '2025-12-18',
                    'case_manager_id'   => 5,
                    'case_manager_name' => 'Dina',
                    'remarks'           => 'Awaiting balance collection',
                    'created_at'        => '2025-12-18 14:30:00'
                ]
            ],
            'disputes' => [
                [
                    'id'                 => 1,
                    'claim_id'           => 5,
                    'dispute_category'   => 'Employer Disagreement',
                    'dispute_reason'     => 'Employer asserts candidate tendered resignation before completing 180 days.',
                    'dispute_date'       => '2026-03-15',
                    'status'             => 'active_dispute',
                    'resolution_notes'   => 'Case manager reviewing GOSI exit records with Ministry',
                    'handled_by_user_id' => 4,
                    'created_at'         => '2026-03-15 11:00:00'
                ]
            ],
            'payments' => [
                ['id' => 1, 'receipt_no' => 'RCPT-2025-0142', 'claim_id' => 1, 'payment_date' => '2025-11-10', 'amount_paid_bhd' => 797.500, 'payment_method' => 'Bank Transfer', 'reference_doc_no' => 'BBK-TRF-994102', 'cashier_notes' => 'Full payment settled via BBK wire'],
                ['id' => 2, 'receipt_no' => 'RCPT-2025-0108', 'claim_id' => 2, 'payment_date' => '2025-08-25', 'amount_paid_bhd' => 605.000, 'payment_method' => 'Cheque', 'reference_doc_no' => 'NBB-CHQ-44810', 'cashier_notes' => 'Cheque cleared NBB'],
                ['id' => 3, 'receipt_no' => 'RCPT-2026-0033', 'claim_id' => 3, 'payment_date' => '2026-02-15', 'amount_paid_bhd' => 300.000, 'payment_method' => 'Bank Transfer', 'reference_doc_no' => 'AUB-TRF-11029', 'cashier_notes' => 'First installment partial payment received'],
                ['id' => 4, 'receipt_no' => 'RCPT-2025-0129', 'claim_id' => 4, 'payment_date' => '2025-10-02', 'amount_paid_bhd' => 797.500, 'payment_method' => 'Bank Transfer', 'reference_doc_no' => 'BISB-TRF-88102', 'cashier_notes' => 'Settled in full'],
                ['id' => 5, 'receipt_no' => 'RCPT-2025-0091', 'claim_id' => 6, 'payment_date' => '2025-08-12', 'amount_paid_bhd' => 660.000, 'payment_method' => 'Cheque', 'reference_doc_no' => 'BIB-CHQ-00219', 'cashier_notes' => 'Settled in full'],
                ['id' => 6, 'receipt_no' => 'RCPT-2026-0045', 'claim_id' => 7, 'payment_date' => '2026-02-01', 'amount_paid_bhd' => 400.000, 'payment_method' => 'Bank Transfer', 'reference_doc_no' => 'NBB-TRF-66104', 'cashier_notes' => 'Partial receipt for Duty Free claim'],
                ['id' => 7, 'receipt_no' => 'RCPT-2025-0082', 'claim_id' => 8, 'payment_date' => '2025-07-20', 'amount_paid_bhd' => 880.000, 'payment_method' => 'Bank Transfer', 'reference_doc_no' => 'BBK-TRF-55102', 'cashier_notes' => 'Full settlement'],
                ['id' => 8, 'receipt_no' => 'RCPT-2026-0012', 'claim_id' => 9, 'payment_date' => '2026-01-18', 'amount_paid_bhd' => 880.000, 'payment_method' => 'Bank Transfer', 'reference_doc_no' => 'BBK-TRF-77291', 'cashier_notes' => 'Full settlement 6M'],
                ['id' => 9, 'receipt_no' => 'RCPT-2025-0065', 'claim_id' => 10, 'payment_date' => '2025-07-02', 'amount_paid_bhd' => 880.000, 'payment_method' => 'Cheque', 'reference_doc_no' => 'AUB-CHQ-10492', 'cashier_notes' => 'Cleared'],
                ['id' => 10, 'receipt_no' => 'RCPT-2026-0005', 'claim_id' => 11, 'payment_date' => '2026-01-10', 'amount_paid_bhd' => 500.000, 'payment_method' => 'Bank Transfer', 'reference_doc_no' => 'NBB-TRF-33019', 'cashier_notes' => 'Partial collection 500 BHD, balance 380 BHD remaining']
            ],
            'audit_logs' => [
                ['id' => 1, 'user_id' => 1, 'username' => 'superadmin', 'role' => 'superadmin', 'action' => 'SYSTEM_INIT', 'entity_type' => 'system', 'entity_id' => null, 'details' => 'Application initialized with default Bahrain settings', 'created_at' => '2026-01-01 10:00:00'],
                ['id' => 2, 'user_id' => 3, 'username' => 'cm_husain', 'role' => 'case_manager', 'action' => 'CLAIM_CREATED', 'entity_type' => 'claim', 'entity_id' => 3, 'details' => 'Entered manual claim amount 605.000 BHD for Waleed Abdulwahid', 'created_at' => '2026-02-02 14:00:00'],
                ['id' => 3, 'user_id' => 4, 'username' => 'cm_meaad', 'role' => 'case_manager', 'action' => 'DISPUTE_LOGGED', 'entity_type' => 'dispute', 'entity_id' => 1, 'details' => 'Logged dispute for claim CLM-2026-005', 'created_at' => '2026-03-15 11:00:00']
            ]
        ];

        self::saveStore($defaultStore);
    }
}
