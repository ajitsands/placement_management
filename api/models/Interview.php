<?php
/**
 * Interview Model - Candidate Interviews & Job Placement Matching
 * Manages interview scheduling against job openings, candidate rosters, evaluation outcomes, and candidate history.
 */

namespace App\Models;

use App\Config\Database;
use App\Models\AuditLog;
use App\Models\Job;
use App\Models\Candidate;

class Interview {
    /**
     * Retrieve all interviews, optionally filtered by job_id
     */
    public static function all(?int $jobId = null): array {
        $store = Database::getStore();
        $interviews = $store['job_interviews'] ?? [];
        $interviewCandidates = $store['job_interview_candidates'] ?? [];
        $jobs = $store['jobs'] ?? [];
        $candidates = $store['candidates'] ?? [];

        // Build jobs index
        $jobsMap = [];
        foreach ($jobs as $j) {
            $jobsMap[(int)$j['id']] = $j;
        }

        // Build candidates index
        $candidatesMap = [];
        foreach ($candidates as $c) {
            $candidatesMap[(int)$c['id']] = $c;
        }

        // Index candidate attendees per interview
        $candidatesByInterview = [];
        foreach ($interviewCandidates as $ic) {
            $iId = (int)$ic['interview_id'];
            $cId = (int)$ic['candidate_id'];
            $candObj = $candidatesMap[$cId] ?? null;

            $candidatesByInterview[$iId][] = [
                'id'              => (int)$ic['id'],
                'interview_id'    => $iId,
                'candidate_id'    => $cId,
                'full_name'       => $candObj['full_name'] ?? ('Candidate #' . $cId),
                'cpr_no'          => $candObj['cpr_no'] ?? '',
                'ref_no'          => $candObj['ref_no'] ?? '',
                'gender'          => $candObj['gender'] ?? 'Male',
                'education'       => $candObj['education'] ?? '',
                'date_of_birth'   => $candObj['date_of_birth'] ?? null,
                'center'          => $candObj['center'] ?? 'Enma Mall',
                'phone'           => $candObj['phone'] ?? '',
                'email'           => $candObj['email'] ?? '',
                'status'          => $ic['status'] ?? 'scheduled',
                'remarks'         => $ic['remarks'] ?? '',
                'attended_at'     => $ic['attended_at'] ?? null,
                'updated_by_name' => $ic['updated_by_name'] ?? ''
            ];
        }

        $result = [];
        foreach ($interviews as $int) {
            $id = (int)$int['id'];
            $jId = (int)$int['job_id'];

            if ($jobId !== null && $jobId > 0 && $jId !== $jobId) {
                continue;
            }

            $job = $jobsMap[$jId] ?? null;
            $roster = $candidatesByInterview[$id] ?? [];

            $totalCandidates = count($roster);
            $attendedCount = 0;
            $passedCount = 0;
            $rejectedCount = 0;
            $absentCount = 0;
            $scheduledCount = 0;

            foreach ($roster as $rc) {
                $st = strtolower($rc['status'] ?? 'scheduled');
                if ($st === 'passed' || $st === 'selected') {
                    $passedCount++;
                    $attendedCount++;
                } elseif ($st === 'attended') {
                    $attendedCount++;
                } elseif ($st === 'rejected') {
                    $rejectedCount++;
                    $attendedCount++;
                } elseif ($st === 'absent') {
                    $absentCount++;
                } else {
                    $scheduledCount++;
                }
            }

            $int['id'] = $id;
            $int['job_id'] = $jId;
            $int['job_title'] = $job['job_title'] ?? $job['position_title'] ?? 'Job Opening';
            $int['company_name'] = $job['company_name'] ?? 'Employer';
            $int['job_code'] = $job['job_code'] ?? '';
            $int['employer_cr'] = $job['employer_cr'] ?? '';
            $int['department'] = $job['department'] ?? '';
            $int['salary_offered_bhd'] = (float)($job['salary_offered_bhd'] ?? 0);
            $int['vacancies_count'] = (int)($job['vacancies_count'] ?? 1);
            $int['vacancies_remaining'] = (int)($job['vacancies_remaining'] ?? 1);

            $int['candidates'] = $roster;
            $int['candidates_count'] = $totalCandidates;
            $int['attended_count'] = $attendedCount;
            $int['passed_count'] = $passedCount;
            $int['rejected_count'] = $rejectedCount;
            $int['absent_count'] = $absentCount;
            $int['scheduled_count'] = $scheduledCount;

            $result[] = $int;
        }

        // Sort by interview date DESC, id DESC
        usort($result, function($a, $b) {
            $cmp = strcmp($b['interview_date'] ?? '', $a['interview_date'] ?? '');
            if ($cmp !== 0) return $cmp;
            return ($b['id'] ?? 0) - ($a['id'] ?? 0);
        });

        return $result;
    }

    /**
     * Find single interview by ID
     */
    public static function find(int $id): ?array {
        $interviews = self::all();
        foreach ($interviews as $int) {
            if ($int['id'] === $id) {
                return $int;
            }
        }
        return null;
    }

    /**
     * Generate sequential interview code e.g. INT-2026-001
     */
    public static function generateNextCode(): string {
        $store = Database::getStore();
        $interviews = $store['job_interviews'] ?? [];
        $year = date('Y');
        $maxSeq = 0;

        foreach ($interviews as $int) {
            if (preg_match('#^INT-' . $year . '-(\d+)$#i', (string)($int['interview_code'] ?? ''), $m)) {
                $seq = (int)$m[1];
                if ($seq > $maxSeq) {
                    $maxSeq = $seq;
                }
            }
        }

        return sprintf('INT-%s-%03d', $year, $maxSeq + 1);
    }

    /**
     * Create new interview schedule against a job opening
     */
    public static function create(array $data, ?array $user = null): array {
        $store = Database::getStore();
        if (!isset($store['job_interviews'])) {
            $store['job_interviews'] = [];
        }
        if (!isset($store['job_interview_candidates'])) {
            $store['job_interview_candidates'] = [];
        }

        $nextId = 1;
        foreach ($store['job_interviews'] as $int) {
            if ((int)$int['id'] >= $nextId) {
                $nextId = (int)$int['id'] + 1;
            }
        }

        $code = !empty($data['interview_code']) ? trim($data['interview_code']) : self::generateNextCode();
        $jobId = (int)($data['job_id'] ?? 0);
        $date = trim($data['interview_date'] ?? date('Y-m-d'));
        $time = trim($data['interview_time'] ?? '10:00 AM');
        $location = trim($data['location'] ?? 'Job Center - Ministry Hall');
        $remarks = trim($data['remarks'] ?? '');
        $status = in_array($data['status'] ?? '', ['scheduled', 'in_progress', 'completed', 'cancelled'])
            ? $data['status']
            : 'scheduled';

        $userName = $user['full_name'] ?? $user['username'] ?? 'Case Manager';
        $userId = $user['id'] ?? null;

        $newInterview = [
            'id'              => $nextId,
            'interview_code'  => $code,
            'job_id'          => $jobId,
            'interview_date'  => $date,
            'interview_time'  => $time,
            'location'        => $location,
            'remarks'         => $remarks,
            'status'          => $status,
            'created_by'      => $userId,
            'created_by_name' => $userName,
            'created_at'      => date('Y-m-d H:i:s'),
            'updated_at'      => date('Y-m-d H:i:s')
        ];

        $store['job_interviews'][] = $newInterview;

        // Attach candidate IDs if provided
        $candidateIds = $data['candidate_ids'] ?? [];
        if (is_array($candidateIds) && count($candidateIds) > 0) {
            $nextJicId = 1;
            foreach ($store['job_interview_candidates'] as $jic) {
                if ((int)$jic['id'] >= $nextJicId) {
                    $nextJicId = (int)$jic['id'] + 1;
                }
            }

            foreach ($candidateIds as $cid) {
                $cIdInt = (int)$cid;
                if ($cIdInt <= 0) continue;

                $store['job_interview_candidates'][] = [
                    'id'              => $nextJicId++,
                    'interview_id'    => $nextId,
                    'candidate_id'    => $cIdInt,
                    'status'          => 'scheduled',
                    'remarks'         => $remarks ?: 'Scheduled for job interview',
                    'attended_at'     => null,
                    'updated_by_name' => $userName,
                    'created_at'      => date('Y-m-d H:i:s'),
                    'updated_at'      => date('Y-m-d H:i:s')
                ];
            }
        }

        Database::saveStore($store);

        // Audit log
        AuditLog::log(
            'INTERVIEW_SCHEDULED',
            'interview',
            $nextId,
            $code,
            "Scheduled interview {$code} on {$date} at {$time} for Job ID {$jobId} with " . count($candidateIds) . " candidates",
            $user
        );

        return self::find($nextId) ?? $newInterview;
    }

    /**
     * Update an interview schedule
     */
    public static function update(int $id, array $data, ?array $user = null): ?array {
        $store = Database::getStore();
        $foundIndex = -1;

        foreach ($store['job_interviews'] as $idx => $int) {
            if ((int)$int['id'] === $id) {
                $foundIndex = $idx;
                break;
            }
        }

        if ($foundIndex === -1) {
            return null;
        }

        $cur = $store['job_interviews'][$foundIndex];

        if (isset($data['job_id'])) $cur['job_id'] = (int)$data['job_id'];
        if (!empty($data['interview_date'])) $cur['interview_date'] = trim($data['interview_date']);
        if (isset($data['interview_time'])) $cur['interview_time'] = trim($data['interview_time']);
        if (!empty($data['location'])) $cur['location'] = trim($data['location']);
        if (isset($data['remarks'])) $cur['remarks'] = trim($data['remarks']);
        if (!empty($data['status'])) {
            $s = strtolower(trim($data['status']));
            if (in_array($s, ['scheduled', 'in_progress', 'completed', 'cancelled'])) {
                $cur['status'] = $s;
            }
        }
        $cur['updated_at'] = date('Y-m-d H:i:s');

        $store['job_interviews'][$foundIndex] = $cur;
        Database::saveStore($store);

        AuditLog::log(
            'INTERVIEW_UPDATED',
            'interview',
            $id,
            $cur['interview_code'],
            "Updated interview session {$cur['interview_code']} status to {$cur['status']}",
            $user
        );

        return self::find($id);
    }

    /**
     * Delete an interview and its candidate links
     */
    public static function delete(int $id, ?array $user = null): bool {
        $store = Database::getStore();
        $initialCount = count($store['job_interviews'] ?? []);

        $store['job_interviews'] = array_values(array_filter($store['job_interviews'] ?? [], function($i) use ($id) {
            return (int)$i['id'] !== $id;
        }));

        if (count($store['job_interviews']) === $initialCount) {
            return false;
        }

        // Remove linked candidates
        $store['job_interview_candidates'] = array_values(array_filter($store['job_interview_candidates'] ?? [], function($ic) use ($id) {
            return (int)$ic['interview_id'] !== $id;
        }));

        Database::saveStore($store);
        AuditLog::log(
            'INTERVIEW_DELETED',
            'interview',
            $id,
            "INT-{$id}",
            "Deleted interview session #{$id}",
            $user
        );
        return true;
    }

    /**
     * Add multiple candidates to an existing interview
     */
    public static function addCandidates(int $interviewId, array $candidateIds, ?string $remarks = null, ?array $user = null): array {
        $store = Database::getStore();
        if (!isset($store['job_interview_candidates'])) {
            $store['job_interview_candidates'] = [];
        }

        $existing = [];
        $nextId = 1;
        foreach ($store['job_interview_candidates'] as $ic) {
            if ((int)$ic['id'] >= $nextId) {
                $nextId = (int)$ic['id'] + 1;
            }
            if ((int)$ic['interview_id'] === $interviewId) {
                $existing[(int)$ic['candidate_id']] = true;
            }
        }

        $userName = $user['full_name'] ?? $user['username'] ?? 'Case Manager';
        $added = 0;

        foreach ($candidateIds as $cId) {
            $candId = (int)$cId;
            if ($candId <= 0 || isset($existing[$candId])) {
                continue;
            }

            $store['job_interview_candidates'][] = [
                'id'              => $nextId++,
                'interview_id'    => $interviewId,
                'candidate_id'    => $candId,
                'status'          => 'scheduled',
                'remarks'         => $remarks ?: 'Scheduled for interview',
                'attended_at'     => null,
                'updated_by_name' => $userName,
                'created_at'      => date('Y-m-d H:i:s'),
                'updated_at'      => date('Y-m-d H:i:s')
            ];
            $existing[$candId] = true;
            $added++;
        }

        Database::saveStore($store);

        AuditLog::log(
            'INTERVIEW_CANDIDATES_ADDED',
            'interview',
            $interviewId,
            "INT-{$interviewId}",
            "Added {$added} candidates to interview session #{$interviewId}",
            $user
        );

        return self::find($interviewId) ?? [];
    }

    /**
     * Remove a candidate from an interview
     */
    public static function removeCandidate(int $interviewId, int $candidateId): bool {
        $store = Database::getStore();
        $initial = count($store['job_interview_candidates'] ?? []);

        $store['job_interview_candidates'] = array_values(array_filter($store['job_interview_candidates'] ?? [], function($ic) use ($interviewId, $candidateId) {
            return !((int)$ic['interview_id'] === $interviewId && (int)$ic['candidate_id'] === $candidateId);
        }));

        if (count($store['job_interview_candidates']) === $initial) {
            return false;
        }

        Database::saveStore($store);
        return true;
    }

    /**
     * Update candidate interview outcome & remarks (e.g. Attended, Passed, Rejected, Absent)
     */
    public static function updateCandidateOutcome(int $interviewId, int $candidateId, array $data, ?array $user = null): ?array {
        $store = Database::getStore();
        $targetIndex = -1;

        foreach ($store['job_interview_candidates'] as $idx => $ic) {
            if ((int)$ic['interview_id'] === $interviewId && (int)$ic['candidate_id'] === $candidateId) {
                $targetIndex = $idx;
                break;
            }
        }

        $userName = $user['full_name'] ?? $user['username'] ?? 'Case Manager';

        if ($targetIndex === -1) {
            // Create record if not already in roster
            $nextId = 1;
            foreach ($store['job_interview_candidates'] as $ic) {
                if ((int)$ic['id'] >= $nextId) {
                    $nextId = (int)$ic['id'] + 1;
                }
            }
            $targetIndex = count($store['job_interview_candidates']);
            $store['job_interview_candidates'][] = [
                'id'              => $nextId,
                'interview_id'    => $interviewId,
                'candidate_id'    => $candidateId,
                'status'          => 'scheduled',
                'remarks'         => '',
                'attended_at'     => null,
                'updated_by_name' => $userName,
                'created_at'      => date('Y-m-d H:i:s'),
                'updated_at'      => date('Y-m-d H:i:s')
            ];
        }

        $row = $store['job_interview_candidates'][$targetIndex];

        if (isset($data['status'])) {
            $st = strtolower(trim($data['status']));
            if (in_array($st, ['scheduled', 'attended', 'passed', 'selected', 'rejected', 'absent', 'cancelled'])) {
                $row['status'] = $st;
                if ($st === 'attended' || $st === 'passed' || $st === 'selected' || $st === 'rejected') {
                    $row['attended_at'] = date('Y-m-d H:i:s');
                }
            }
        }

        if (isset($data['remarks'])) {
            $row['remarks'] = trim($data['remarks']);
        }
        if (isset($data['attended_at'])) {
            $row['attended_at'] = $data['attended_at'] ? date('Y-m-d H:i:s', strtotime($data['attended_at'])) : null;
        }

        $row['updated_by_name'] = $userName;
        $row['updated_at'] = date('Y-m-d H:i:s');

        $store['job_interview_candidates'][$targetIndex] = $row;
        Database::saveStore($store);

        AuditLog::log(
            'INTERVIEW_OUTCOME_UPDATED',
            'interview',
            $interviewId,
            "INT-{$interviewId}",
            "Updated candidate #{$candidateId} outcome to '{$row['status']}' with remarks: {$row['remarks']}",
            $user
        );

        $cand = Candidate::find($candidateId);
        $int = self::find($interviewId);
        $jobTitle = $int['job_title'] ?? 'Job Opening';
        $comp = $int['company_name'] ?? 'Employer';
        $statusLabels = [
            'scheduled' => 'Scheduled',
            'attended'  => 'Attended',
            'passed'    => 'Passed (Selected)',
            'selected'  => 'Passed (Selected)',
            'rejected'  => 'Rejected',
            'absent'    => 'Absent / No-Show',
            'cancelled' => 'Cancelled'
        ];
        $stLabel = $statusLabels[$row['status']] ?? ucfirst($row['status']);
        $remarksText = !empty($row['remarks']) ? " Remarks: {$row['remarks']}." : "";

        AuditLog::log(
            'INTERVIEW_EVALUATION',
            'candidate',
            $candidateId,
            $cand['ref_no'] ?? "CAND-{$candidateId}",
            "Candidate interview evaluated as '{$stLabel}' for Job Opening: {$jobTitle} at {$comp} by {$userName}.{$remarksText}",
            $user
        );

        return $row;
    }
}
