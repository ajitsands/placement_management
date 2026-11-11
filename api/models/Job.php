<?php
/**
 * Job & Vacancy Model
 * Manages Employer Job Openings, Requirements, and Candidate Placement Links
 */

namespace App\Models;

use App\Config\Database;

class Job {
    public static function all(?string $employerFilter = null, ?string $statusFilter = null): array {
        $store = Database::getStore();
        $jobs = $store['jobs'] ?? [];
        $candidates = $store['candidates'] ?? [];

        // Count placed candidates per job
        $placedCounts = [];
        $placedCandidates = [];
        foreach ($candidates as $c) {
            $jid = $c['job_id'] ?? null;
            if (!$jid && !empty($c['company_name'])) {
                // Fallback matching by company name
                foreach ($jobs as $j) {
                    if (strcasecmp($j['company_name'], $c['company_name']) === 0) {
                        $jid = $j['id'];
                        break;
                    }
                }
            }
            if ($jid) {
                $placedCounts[$jid] = ($placedCounts[$jid] ?? 0) + 1;
                $placedCandidates[$jid][] = [
                    'id' => $c['id'],
                    'full_name' => $c['full_name'],
                    'cpr_no' => $c['cpr_no'],
                    'ref_no' => $c['ref_no'],
                    'joining_date' => $c['joining_date'] ?? null,
                    'status' => $c['status'] ?? 'placed'
                ];
            }
        }

        $result = [];
        foreach ($jobs as $job) {
            if ($employerFilter && strcasecmp($job['company_name'], $employerFilter) !== 0) {
                continue;
            }
            if ($statusFilter && strcasecmp($job['status'], $statusFilter) !== 0) {
                continue;
            }

            $jobId = $job['id'];
            $placed = $placedCounts[$jobId] ?? 0;
            $vacancies = (int)($job['vacancies_count'] ?? 1);
            $remaining = max(0, $vacancies - $placed);

            $job['placed_count'] = $placed;
            $job['vacancies_remaining'] = $remaining;
            $job['placed_candidates'] = $placedCandidates[$jobId] ?? [];
            $job['position_title'] = $job['job_title'] ?? '';
            $job['salary_bhd'] = (float)($job['salary_offered_bhd'] ?? 0);

            // Normalize assigned_case_managers
            $assignedCms = $job['assigned_case_managers'] ?? [];
            if (is_string($assignedCms)) {
                $decoded = json_decode($assignedCms, true);
                $assignedCms = is_array($decoded) ? $decoded : [];
            }
            $job['assigned_case_managers'] = is_array($assignedCms) ? $assignedCms : [];

            if ($remaining === 0 && ($job['status'] === 'active' || $job['status'] === 'open')) {
                $job['computed_status'] = 'filled';
            } else {
                $job['computed_status'] = $job['status'] ?? 'active';
            }

            $result[] = $job;
        }

        // Sort by id descending
        usort($result, fn($a, $b) => $b['id'] - $a['id']);
        return $result;
    }

    public static function find(int $id): ?array {
        $jobs = self::all();
        foreach ($jobs as $j) {
            if ($j['id'] === $id) return $j;
        }
        return null;
    }

    public static function generateNextCode(): string {
        $store = Database::getStore();
        $jobs = $store['jobs'] ?? [];
        $year = date('Y');
        $maxSeq = 0;
        foreach ($jobs as $j) {
            if (preg_match('#^JOB-' . $year . '-(\d+)$#i', (string)($j['job_code'] ?? ''), $m)) {
                $num = (int)$m[1];
                if ($num > $maxSeq) $maxSeq = $num;
            }
        }
        if ($maxSeq === 0) {
            $maxSeq = count($jobs);
        }
        return sprintf('JOB-%s-%03d', $year, $maxSeq + 1);
    }

    public static function create(array $data, ?array $user = null): array {
        $store = Database::getStore();
        $jobs = $store['jobs'] ?? [];

        $newId = count($jobs) > 0 ? max(array_column($jobs, 'id')) + 1 : 1;
        $jobCode = !empty($data['job_code']) ? trim($data['job_code']) : self::generateNextCode();
        $title = trim($data['job_title'] ?? $data['position_title'] ?? 'Job Position');
        $company = trim($data['company_name'] ?? 'Employer');
        $cr = trim($data['employer_cr'] ?? '');
        $dept = trim($data['department'] ?? 'General');
        $salary = (float)($data['salary_offered_bhd'] ?? $data['salary_bhd'] ?? 500.0);
        $vacancies = max(1, (int)($data['vacancies_count'] ?? 1));
        $status = strtolower(trim($data['status'] ?? 'active'));
        if ($status === 'open') $status = 'active';
        if (!in_array($status, ['active', 'filled', 'closed'])) $status = 'active';
        $requirements = trim($data['requirements'] ?? '');
        $description = trim($data['description'] ?? '');
        $assignedCms = $data['assigned_case_managers'] ?? [];
        if (is_string($assignedCms)) {
            $decoded = json_decode($assignedCms, true);
            $assignedCms = is_array($decoded) ? $decoded : [];
        }
        $cmsJson = !empty($assignedCms) ? json_encode($assignedCms, JSON_UNESCAPED_UNICODE) : null;
        $now = date('Y-m-d H:i:s');

        // Direct MySQL insert when database is connected to ensure immediate persistence and real ID
        if (Database::isMySQL()) {
            try {
                $pdo = Database::getConnection();
                if ($pdo) {
                    try {
                        $check = $pdo->query("SHOW COLUMNS FROM `jobs` LIKE 'assigned_case_managers'")->fetch();
                        if (!$check) {
                            $pdo->exec("ALTER TABLE `jobs` ADD COLUMN `assigned_case_managers` TEXT NULL");
                        }
                    } catch (\Exception $ce) {}

                    $stmt = $pdo->prepare("INSERT INTO jobs (job_code, job_title, company_name, employer_cr, department, salary_offered_bhd, vacancies_count, status, requirements, description, assigned_case_managers, created_by, created_at, updated_at)
                        VALUES (:job_code, :job_title, :company_name, :employer_cr, :department, :salary_offered_bhd, :vacancies_count, :status, :requirements, :description, :assigned_case_managers, :created_by, :created_at, :updated_at)");
                    $stmt->execute([
                        ':job_code' => $jobCode,
                        ':job_title' => $title,
                        ':company_name' => $company,
                        ':employer_cr' => $cr,
                        ':department' => $dept,
                        ':salary_offered_bhd' => $salary,
                        ':vacancies_count' => $vacancies,
                        ':status' => $status,
                        ':requirements' => $requirements,
                        ':description' => $description,
                        ':assigned_case_managers' => $cmsJson,
                        ':created_by' => $user['id'] ?? null,
                        ':created_at' => $now,
                        ':updated_at' => $now
                    ]);
                    $mysqlId = (int)$pdo->lastInsertId();
                    if ($mysqlId > 0) {
                        $newId = $mysqlId;
                    }
                }
            } catch (\Exception $e) {
                error_log("Job::create direct MySQL error: " . $e->getMessage());
            }
        }

        $newJob = [
            'id' => $newId,
            'job_code' => $jobCode,
            'job_title' => $title,
            'position_title' => $title,
            'company_name' => $company,
            'employer_cr' => $cr,
            'department' => $dept,
            'salary_offered_bhd' => $salary,
            'salary_bhd' => $salary,
            'vacancies_count' => $vacancies,
            'vacancies_remaining' => $vacancies,
            'placed_count' => 0,
            'placed_candidates' => [],
            'status' => $status,
            'computed_status' => $status,
            'requirements' => $requirements,
            'description' => $description,
            'assigned_case_managers' => $assignedCms,
            'created_by' => $user['id'] ?? null,
            'created_at' => $now,
            'updated_at' => $now
        ];

        $store['jobs'][] = $newJob;
        Database::saveStore($store);

        return $newJob;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        $jobs = $store['jobs'] ?? [];
        $found = false;

        $title = isset($data['job_title']) ? trim($data['job_title']) : (isset($data['position_title']) ? trim($data['position_title']) : null);
        $company = isset($data['company_name']) ? trim($data['company_name']) : null;
        $cr = isset($data['employer_cr']) ? trim($data['employer_cr']) : null;
        $dept = isset($data['department']) ? trim($data['department']) : null;
        $salary = isset($data['salary_offered_bhd']) ? (float)$data['salary_offered_bhd'] : (isset($data['salary_bhd']) ? (float)$data['salary_bhd'] : null);
        $vacancies = isset($data['vacancies_count']) ? max(1, (int)$data['vacancies_count']) : null;
        $status = isset($data['status']) ? strtolower(trim($data['status'])) : null;
        if ($status && !in_array($status, ['active', 'filled', 'closed'])) $status = 'active';
        $reqs = isset($data['requirements']) ? trim($data['requirements']) : null;
        $desc = isset($data['description']) ? trim($data['description']) : null;
        $assignedCms = null;
        if (array_key_exists('assigned_case_managers', $data)) {
            $assignedCms = $data['assigned_case_managers'];
            if (is_string($assignedCms)) {
                $decoded = json_decode($assignedCms, true);
                $assignedCms = is_array($decoded) ? $decoded : [];
            }
            if (!is_array($assignedCms)) $assignedCms = [];
        }
        $now = date('Y-m-d H:i:s');

        if (Database::isMySQL()) {
            try {
                $pdo = Database::getConnection();
                if ($pdo) {
                    $fields = [];
                    $params = [':id' => $id];
                    if ($title !== null) { $fields[] = "job_title = :job_title"; $params[':job_title'] = $title; }
                    if ($company !== null) { $fields[] = "company_name = :company_name"; $params[':company_name'] = $company; }
                    if ($cr !== null) { $fields[] = "employer_cr = :employer_cr"; $params[':employer_cr'] = $cr; }
                    if ($dept !== null) { $fields[] = "department = :department"; $params[':department'] = $dept; }
                    if ($salary !== null) { $fields[] = "salary_offered_bhd = :salary_offered_bhd"; $params[':salary_offered_bhd'] = $salary; }
                    if ($vacancies !== null) { $fields[] = "vacancies_count = :vacancies_count"; $params[':vacancies_count'] = $vacancies; }
                    if ($status !== null) { $fields[] = "status = :status"; $params[':status'] = $status; }
                    if ($reqs !== null) { $fields[] = "requirements = :requirements"; $params[':requirements'] = $reqs; }
                    if ($desc !== null) { $fields[] = "description = :description"; $params[':description'] = $desc; }
                    if ($assignedCms !== null) {
                        try {
                            $check = $pdo->query("SHOW COLUMNS FROM `jobs` LIKE 'assigned_case_managers'")->fetch();
                            if (!$check) {
                                $pdo->exec("ALTER TABLE `jobs` ADD COLUMN `assigned_case_managers` TEXT NULL");
                            }
                        } catch (\Exception $ce) {}

                        $fields[] = "assigned_case_managers = :assigned_case_managers";
                        $params[':assigned_case_managers'] = !empty($assignedCms) ? json_encode($assignedCms, JSON_UNESCAPED_UNICODE) : null;
                    }
                    if (!empty($fields)) {
                        $fields[] = "updated_at = :updated_at";
                        $params[':updated_at'] = $now;
                        $sql = "UPDATE jobs SET " . implode(', ', $fields) . " WHERE id = :id";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($params);
                    }
                }
            } catch (\Exception $e) {
                error_log("Job::update direct MySQL error: " . $e->getMessage());
            }
        }

        foreach ($jobs as &$j) {
            if ((int)$j['id'] === $id) {
                if ($title !== null) $j['job_title'] = $title;
                if ($company !== null) $j['company_name'] = $company;
                if ($cr !== null) $j['employer_cr'] = $cr;
                if ($dept !== null) $j['department'] = $dept;
                if ($salary !== null) $j['salary_offered_bhd'] = $salary;
                if ($vacancies !== null) $j['vacancies_count'] = $vacancies;
                if ($status !== null) $j['status'] = $status;
                if ($reqs !== null) $j['requirements'] = $reqs;
                if ($desc !== null) $j['description'] = $desc;
                if ($assignedCms !== null) $j['assigned_case_managers'] = $assignedCms;
                $j['updated_at'] = $now;
                $found = true;
                break;
            }
        }

        if (!$found && !Database::isMySQL()) return null;

        $store['jobs'] = $jobs;
        Database::saveStore($store);

        return self::find($id);
    }

    public static function delete(int $id): bool {
        $store = Database::getStore();
        $jobs = $store['jobs'] ?? [];
        $initial = count($jobs);

        $jobs = array_values(array_filter($jobs, fn($j) => (int)$j['id'] !== $id));
        if (count($jobs) === $initial) return false;

        if (Database::isMySQL()) {
            try {
                $pdo = Database::getConnection();
                if ($pdo) {
                    $delStmt = $pdo->prepare("DELETE FROM jobs WHERE id = :id");
                    $delStmt->execute([':id' => $id]);
                }
            } catch (\Exception $e) {
                error_log("Job::delete direct MySQL error: " . $e->getMessage());
            }
        }

        $store['jobs'] = $jobs;
        Database::saveStore($store);
        return true;
    }
}

