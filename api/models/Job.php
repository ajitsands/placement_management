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

        $newJob = [
            'id' => $newId,
            'job_code' => $jobCode,
            'job_title' => trim($data['job_title'] ?? $data['position_title'] ?? 'Job Position'),
            'company_name' => trim($data['company_name'] ?? 'Employer'),
            'employer_cr' => trim($data['employer_cr'] ?? ''),
            'department' => trim($data['department'] ?? 'General'),
            'salary_offered_bhd' => (float)($data['salary_offered_bhd'] ?? $data['salary_bhd'] ?? 500.0),
            'vacancies_count' => max(1, (int)($data['vacancies_count'] ?? 1)),
            'status' => trim($data['status'] ?? 'active'),
            'requirements' => trim($data['requirements'] ?? ''),
            'description' => trim($data['description'] ?? ''),
            'created_by' => $user['id'] ?? null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        $store['jobs'][] = $newJob;
        Database::saveStore($store);

        return $newJob;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        $jobs = $store['jobs'] ?? [];
        $found = false;

        foreach ($jobs as &$j) {
            if ($j['id'] === $id) {
                if (isset($data['job_title'])) $j['job_title'] = trim($data['job_title']);
                else if (isset($data['position_title'])) $j['job_title'] = trim($data['position_title']);

                if (isset($data['company_name'])) $j['company_name'] = trim($data['company_name']);
                if (isset($data['employer_cr'])) $j['employer_cr'] = trim($data['employer_cr']);
                if (isset($data['department'])) $j['department'] = trim($data['department']);

                if (isset($data['salary_offered_bhd'])) $j['salary_offered_bhd'] = (float)$data['salary_offered_bhd'];
                else if (isset($data['salary_bhd'])) $j['salary_offered_bhd'] = (float)$data['salary_bhd'];
                if (isset($data['vacancies_count'])) $j['vacancies_count'] = max(1, (int)$data['vacancies_count']);
                if (isset($data['status'])) $j['status'] = trim($data['status']);
                if (isset($data['requirements'])) $j['requirements'] = trim($data['requirements']);
                if (isset($data['description'])) $j['description'] = trim($data['description']);
                $j['updated_at'] = date('Y-m-d H:i:s');
                $found = true;
                break;
            }
        }

        if (!$found) return null;

        $store['jobs'] = $jobs;
        Database::saveStore($store);

        return self::find($id);
    }

    public static function delete(int $id): bool {
        $store = Database::getStore();
        $jobs = $store['jobs'] ?? [];
        $initial = count($jobs);

        $jobs = array_values(array_filter($jobs, fn($j) => $j['id'] !== $id));
        if (count($jobs) === $initial) return false;

        $store['jobs'] = $jobs;
        Database::saveStore($store);
        return true;
    }
}

