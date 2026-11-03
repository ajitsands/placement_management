<?php
/**
 * AuditLog Model - Complete Action Traceability & Case Manager Activity Ledger
 */

namespace App\Models;

use App\Config\Database;
use App\Core\Auth;

class AuditLog {
    /**
     * Record a system action performed by an active user
     */
    public static function log(
        string $action,
        string $entityType,
        ?int $entityId,
        ?string $entityRef,
        string $details,
        ?array $user = null
    ): array {
        if ($user === null) {
            $user = Auth::getCurrentUser();
        }

        $store = Database::getStore();
        if (!isset($store['audit_logs']) || !is_array($store['audit_logs'])) {
            $store['audit_logs'] = [];
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $now = date('Y-m-d H:i:s');
        $id = count($store['audit_logs']) + 1;

        $entry = [
            'id'             => $id,
            'user_id'        => !empty($user['id']) ? (int)$user['id'] : null,
            'username'       => $user['username'] ?? 'system',
            'user_full_name' => $user['full_name'] ?? ($user['username'] ?? 'System'),
            'role'           => $user['role'] ?? 'system',
            'action'         => $action,
            'entity_type'    => $entityType,
            'entity_id'      => $entityId,
            'entity_ref'     => $entityRef,
            'details'        => $details,
            'ip_address'     => $ip,
            'created_at'     => $now
        ];

        $store['audit_logs'][] = $entry;
        Database::saveStore($store);

        return $entry;
    }

    /**
     * Get all raw audit logs with optional filtering
     */
    public static function all(?string $action = null, ?int $userId = null, int $limit = 200): array {
        $store = Database::getStore();
        $logs = $store['audit_logs'] ?? [];

        if ($action !== null && $action !== '') {
            $logs = array_filter($logs, fn($l) => strcasecmp($l['action'] ?? '', $action) === 0);
        }

        if ($userId !== null && $userId > 0) {
            $logs = array_filter($logs, fn($l) => (int)($l['user_id'] ?? 0) === $userId);
        }

        usort($logs, function($a, $b) {
            return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
        });

        return array_values(array_slice($logs, 0, $limit));
    }

    /**
     * Retrieve audit log entries for reporting with date range and case manager filter
     * Gathers all system audit events, registrations, placements, claims, and payments.
     */
    public static function getAuditReport(?string $cmName = null, ?string $dateFrom = null, ?string $dateTo = null): array {
        $store = Database::getStore();
        $users = $store['users'] ?? [];
        $userMap = [];
        foreach ($users as $u) {
            $userMap[(int)$u['id']] = $u;
            if (!empty($u['username'])) $userMap[strtolower($u['username'])] = $u;
            if (!empty($u['full_name'])) $userMap[strtolower($u['full_name'])] = $u;
            if (!empty($u['case_manager_code'])) $userMap[strtolower($u['case_manager_code'])] = $u;
        }

        $isAll = empty($cmName) || strtolower(trim($cmName)) === 'all';
        $targetCmLower = $isAll ? null : strtolower(trim($cmName));

        $matchesFilter = function(?string $actor, ?string $extra = null) use ($isAll, $targetCmLower) {
            if ($isAll) return true;
            $a = strtolower(trim((string)$actor));
            $e = strtolower(trim((string)$extra));
            return str_contains($a, $targetCmLower) || str_contains($targetCmLower, $a) ||
                   ($extra && (str_contains($e, $targetCmLower) || str_contains($targetCmLower, $e)));
        };

        $inDateRange = function(string $dateStr) use ($dateFrom, $dateTo) {
            $d = substr($dateStr, 0, 10);
            if ($dateFrom && $d < $dateFrom) return false;
            if ($dateTo && $d > $dateTo) return false;
            return true;
        };

        $records = [];
        $seen = [];

        // 1. Audit Logs Table
        foreach ($store['audit_logs'] ?? [] as $l) {
            $actor = $l['user_full_name'] ?? ($l['username'] ?? 'System');
            if (!$matchesFilter($actor, $l['username'] ?? '')) continue;
            $time = $l['created_at'] ?? date('Y-m-d H:i:s');
            if (!$inDateRange($time)) continue;

            $key = ($l['action'] ?? '') . '_' . ($l['entity_type'] ?? '') . '_' . ($l['entity_id'] ?? '') . '_' . substr($time, 0, 10);
            $seen[$key] = true;

            $records[] = [
                'id'             => (int)($l['id'] ?? count($records) + 1),
                'created_at'     => $time,
                'date'           => substr($time, 0, 10),
                'user_full_name' => $actor,
                'username'       => $l['username'] ?? 'system',
                'role'           => $l['role'] ?? 'case_manager',
                'action'         => $l['action'] ?? 'AUDIT_LOG',
                'category'       => self::categorizeAction($l['action'] ?? '', $l['entity_type'] ?? ''),
                'action_label'   => self::formatActionTitle($l['action'] ?? '', $l['entity_type'] ?? ''),
                'entity_type'    => $l['entity_type'] ?? 'system',
                'entity_id'      => $l['entity_id'] ?? null,
                'entity_ref'     => $l['entity_ref'] ?? ($l['entity_type'] . '#' . ($l['entity_id'] ?? '')),
                'details'        => $l['details'] ?? 'System audit action',
                'ip_address'     => $l['ip_address'] ?? '127.0.0.1'
            ];
        }

        // 2. Candidate Registrations & Placements
        foreach ($store['candidates'] ?? [] as $c) {
            $cm = !empty($c['case_manager_name']) ? $c['case_manager_name'] : 'Husain Al-Mulla';
            if (!$matchesFilter($cm)) continue;

            $regTime = $c['created_at'] ?? (($c['registration_date'] ?? date('Y-m-d')) . ' 09:00:00');
            $regKey = 'CANDIDATE_REGISTERED_candidate_' . $c['id'] . '_' . substr($regTime, 0, 10);
            if (!isset($seen[$regKey]) && $inDateRange($regTime)) {
                $seen[$regKey] = true;
                $records[] = [
                    'id'             => 'reg_' . $c['id'],
                    'created_at'     => $regTime,
                    'date'           => substr($regTime, 0, 10),
                    'user_full_name' => $cm,
                    'username'       => strtolower(explode(' ', trim($cm))[0]),
                    'role'           => 'case_manager',
                    'action'         => 'CANDIDATE_REGISTERED',
                    'category'       => 'registration',
                    'action_label'   => 'Candidate Registered in Talent Pool',
                    'entity_type'    => 'candidate',
                    'entity_id'      => (int)$c['id'],
                    'entity_ref'     => $c['ref_no'],
                    'details'        => "Candidate {$c['full_name']} (CPR: {$c['cpr_no']}) registered in national talent pool. Education: {$c['education']}.",
                    'ip_address'     => '127.0.0.1'
                ];
            }

            if (!empty($c['company_name'])) {
                $joinTime = ($c['joining_date'] ?? date('Y-m-d')) . ' 10:00:00';
                $placeKey = 'CANDIDATE_PLACED_candidate_' . $c['id'] . '_' . substr($joinTime, 0, 10);
                if (!isset($seen[$placeKey]) && $inDateRange($joinTime)) {
                    $seen[$placeKey] = true;
                    $records[] = [
                        'id'             => 'place_' . $c['id'],
                        'created_at'     => $joinTime,
                        'date'           => substr($joinTime, 0, 10),
                        'user_full_name' => $cm,
                        'username'       => strtolower(explode(' ', trim($cm))[0]),
                        'role'           => 'case_manager',
                        'action'         => 'CANDIDATE_PLACED',
                        'category'       => 'placement',
                        'action_label'   => 'Employment Contract Linked',
                        'entity_type'    => 'candidate',
                        'entity_id'      => (int)$c['id'],
                        'entity_ref'     => $c['job_code'] ?: ($c['employer_cr'] ?: $c['ref_no']),
                        'details'        => "Placed {$c['full_name']} at {$c['company_name']} as {$c['position_title']}. Basic Salary: BHD " . number_format($c['salary_bhd'] ?? 0, 3) . ". MOL Certified: " . ($c['mol_certified'] ?? 'Yes') . ".",
                        'ip_address'     => '127.0.0.1'
                    ];
                }
            }
        }

        // 3. Claims
        foreach ($store['claims'] ?? [] as $cl) {
            $cm = !empty($cl['case_manager_name']) ? $cl['case_manager_name'] : 'Husain Al-Mulla';
            if (!$matchesFilter($cm)) continue;

            $clTime = $cl['created_at'] ?? (($cl['claim_date'] ?? date('Y-m-d')) . ' 11:30:00');
            $claimKey = 'CLAIM_CREATED_claim_' . $cl['id'] . '_' . substr($clTime, 0, 10);
            if (!isset($seen[$claimKey]) && $inDateRange($clTime)) {
                $seen[$claimKey] = true;
                $records[] = [
                    'id'             => 'clm_' . $cl['id'],
                    'created_at'     => $clTime,
                    'date'           => substr($clTime, 0, 10),
                    'user_full_name' => $cm,
                    'username'       => strtolower(explode(' ', trim($cm))[0]),
                    'role'           => 'case_manager',
                    'action'         => 'CLAIM_FILED',
                    'category'       => 'claim',
                    'action_label'   => 'Subsidy Claim Filed',
                    'entity_type'    => 'claim',
                    'entity_id'      => (int)$cl['id'],
                    'entity_ref'     => $cl['claim_ref'],
                    'details'        => "Subsidy claim {$cl['claim_ref']} filed for BHD " . number_format($cl['claim_amount_bhd'] ?? 0, 3) . " (Milestone: {$cl['claim_type']}). Status: {$cl['status']}.",
                    'ip_address'     => '127.0.0.1'
                ];
            }
        }

        // 4. Payments
        foreach ($store['payments'] ?? [] as $p) {
            $pTime = $p['created_at'] ?? (($p['payment_date'] ?? date('Y-m-d')) . ' 14:15:00');
            $payKey = 'PAYMENT_RECORDED_payment_' . $p['id'] . '_' . substr($pTime, 0, 10);
            $cm = !empty($p['cashier_name']) ? $p['cashier_name'] : ($p['recorded_by'] ?? 'Husain Al-Mulla');
            if (!$matchesFilter($cm)) continue;

            if (!isset($seen[$payKey]) && $inDateRange($pTime)) {
                $seen[$payKey] = true;
                $records[] = [
                    'id'             => 'pay_' . $p['id'],
                    'created_at'     => $pTime,
                    'date'           => substr($pTime, 0, 10),
                    'user_full_name' => $cm,
                    'username'       => strtolower(explode(' ', trim($cm))[0]),
                    'role'           => 'case_manager',
                    'action'         => 'PAYMENT_COLLECTED',
                    'category'       => 'payment',
                    'action_label'   => 'Treasury Payment Receipt Recorded',
                    'entity_type'    => 'payment',
                    'entity_id'      => (int)$p['id'],
                    'entity_ref'     => $p['receipt_no'],
                    'details'        => "Payment receipt {$p['receipt_no']} for BHD " . number_format($p['amount_paid_bhd'] ?? 0, 3) . " recorded via {$p['payment_method']}. Ref: " . ($p['reference_doc_no'] ?? 'N/A') . ".",
                    'ip_address'     => '127.0.0.1'
                ];
            }
        }

        // Sort descending by timestamp
        usort($records, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        return array_values($records);
    }

    /**
     * Retrieve all chronological activities associated with a specific Case Manager
     * Gathers audit trail, candidate registrations, placements, claims, payments, and milestones.
     */
    public static function getActivitiesForCaseManager(?string $cmName = null, ?int $userId = null, int $limit = 250): array {
        $store = Database::getStore();
        $users = $store['users'] ?? [];

        $targetUser = null;
        if ($userId) {
            foreach ($users as $u) {
                if ((int)$u['id'] === (int)$userId) {
                    $targetUser = $u;
                    break;
                }
            }
        }

        if (!$targetUser && $cmName) {
            $q = strtolower(trim($cmName));
            foreach ($users as $u) {
                if (strtolower($u['full_name'] ?? '') === $q ||
                    strtolower($u['username'] ?? '') === $q ||
                    strtolower($u['case_manager_code'] ?? '') === $q) {
                    $targetUser = $u;
                    break;
                }
            }
        }

        // Build list of matching aliases
        $aliases = [];
        if ($targetUser) {
            if (!empty($targetUser['full_name'])) $aliases[] = strtolower(trim($targetUser['full_name']));
            if (!empty($targetUser['username'])) $aliases[] = strtolower(trim($targetUser['username']));
            if (!empty($targetUser['case_manager_code'])) $aliases[] = strtolower(trim($targetUser['case_manager_code']));
            $targetUserId = (int)$targetUser['id'];
        } else {
            $targetUserId = $userId ?: 0;
            if ($cmName) $aliases[] = strtolower(trim($cmName));
        }

        $matchesCM = function(?string $val, ?int $uid = null) use ($aliases, $targetUserId) {
            if ($targetUserId > 0 && $uid !== null && (int)$uid === $targetUserId) {
                return true;
            }
            if (!$val) return false;
            $v = strtolower(trim($val));
            foreach ($aliases as $alias) {
                if ($v === $alias || str_contains($v, $alias) || str_contains($alias, $v)) {
                    return true;
                }
            }
            return false;
        };

        $activities = [];
        $seenKeys = [];

        // 1. Audit Logs where this user is actor or referenced
        foreach ($store['audit_logs'] ?? [] as $log) {
            $isActor = ($targetUserId > 0 && (int)($log['user_id'] ?? 0) === $targetUserId) ||
                       $matchesCM($log['username'] ?? null) ||
                       $matchesCM($log['user_full_name'] ?? null);

            $inDetails = false;
            if (!empty($log['details'])) {
                $ld = strtolower($log['details']);
                foreach ($aliases as $a) {
                    if (str_contains($ld, $a)) {
                        $inDetails = true;
                        break;
                    }
                }
            }

            if ($isActor || $inDetails) {
                $time = $log['created_at'] ?? date('Y-m-d H:i:s');
                $dedupKey = ($log['action'] ?? '') . '_' . ($log['entity_type'] ?? '') . '_' . ($log['entity_id'] ?? '') . '_' . substr($time, 0, 10);
                $seenKeys[$dedupKey] = true;

                $activities[] = [
                    'id'          => 'act_audit_' . $log['id'],
                    'timestamp'   => $time,
                    'date'        => substr($time, 0, 10),
                    'category'    => self::categorizeAction($log['action'] ?? '', $log['entity_type'] ?? ''),
                    'action'      => $log['action'] ?? 'AUDIT_EVENT',
                    'title'       => self::formatActionTitle($log['action'] ?? '', $log['entity_type'] ?? ''),
                    'ref'         => $log['entity_ref'] ?: ($log['entity_type'] . '#' . ($log['entity_id'] ?? '')),
                    'amount'      => null,
                    'status'      => 'logged',
                    'details'     => $log['details'] ?? 'System Audit Event',
                    'actor'       => $log['user_full_name'] ?: ($log['username'] ?: 'Case Manager'),
                    'actor_role'  => $log['role'] ?? 'case_manager',
                    'entity_type' => $log['entity_type'] ?? 'system',
                    'entity_id'   => $log['entity_id'] ?? null
                ];
            }
        }

        // 2. Candidates registered by or assigned to this Case Manager
        $myCandidateIds = [];
        foreach ($store['candidates'] ?? [] as $c) {
            $isAssigned = $matchesCM($c['case_manager_name'] ?? null, (int)($c['case_manager_id'] ?? 0));
            if (!$isAssigned) continue;

            $candId = (int)$c['id'];
            $myCandidateIds[$candId] = true;
            $regDate = $c['registration_date'] ?? ($c['created_at'] ? substr($c['created_at'], 0, 10) : date('Y-m-d'));
            $regTime = ($c['created_at'] ?? ($regDate . ' 08:30:00'));

            // Registration activity
            $dedupKey = 'CANDIDATE_REGISTERED_candidate_' . $candId . '_' . substr($regTime, 0, 10);
            if (!isset($seenKeys[$dedupKey])) {
                $activities[] = [
                    'id'             => 'act_cand_reg_' . $candId,
                    'timestamp'      => $regTime,
                    'date'           => $regDate,
                    'category'       => 'registration',
                    'action'         => 'CANDIDATE_REGISTERED',
                    'title'          => "Candidate Registered: {$c['full_name']}",
                    'ref'            => $c['ref_no'],
                    'amount'         => null,
                    'status'         => $c['status'] ?? 'registered',
                    'details'        => "Candidate {$c['full_name']} (CPR: {$c['cpr_no']}) registered in talent pool with education {$c['education']}.",
                    'actor'          => $c['case_manager_name'] ?: 'Case Manager',
                    'actor_role'     => 'case_manager',
                    'candidate_name' => $c['full_name'],
                    'entity_type'    => 'candidate',
                    'entity_id'      => $candId
                ];
            }

            // Placement activity (if placed)
            if (!empty($c['company_name'])) {
                $joinDate = $c['joining_date'] ?? $regDate;
                $joinTime = $joinDate . ' 09:30:00';
                $dedupKey = 'CANDIDATE_PLACED_candidate_' . $candId . '_' . substr($joinTime, 0, 10);
                if (!isset($seenKeys[$dedupKey])) {
                    $activities[] = [
                        'id'             => 'act_cand_place_' . $candId,
                        'timestamp'      => $joinTime,
                        'date'           => $joinDate,
                        'category'       => 'placement',
                        'action'         => 'CANDIDATE_PLACED',
                        'title'          => "Placement Contract: {$c['company_name']}",
                        'ref'            => $c['job_code'] ?: ($c['employer_cr'] ?: $c['ref_no']),
                        'amount'         => (float)($c['salary_bhd'] ?? 0),
                        'status'         => $c['status'] ?? 'placed',
                        'details'        => "Placed {$c['full_name']} as {$c['position_title']} at {$c['company_name']}. Monthly basic wage: BHD " . number_format($c['salary_bhd'] ?? 0, 3) . ". MOL Certified: " . ($c['mol_certified'] ?? 'Yes') . ".",
                        'actor'          => $c['case_manager_name'] ?: 'Case Manager',
                        'actor_role'     => 'case_manager',
                        'candidate_name' => $c['full_name'],
                        'employer_name'  => $c['company_name'],
                        'entity_type'    => 'candidate',
                        'entity_id'      => $candId
                    ];
                }
            }

            // Candidate Renewals
            foreach ($c['renewal_history'] ?? [] as $idx => $r) {
                $rDate = $r['renewal_date'] ?? ($r['renewed_at'] ? substr($r['renewed_at'], 0, 10) : date('Y-m-d'));
                $rTime = $r['renewed_at'] ?? ($rDate . ' 10:15:00');
                $activities[] = [
                    'id'             => 'act_ren_' . $candId . '_' . ($idx + 1),
                    'timestamp'      => $rTime,
                    'date'           => $rDate,
                    'category'       => 'renewal',
                    'action'         => 'CANDIDATE_RENEWED',
                    'title'          => "Registration Renewed: {$c['full_name']}",
                    'ref'            => $c['ref_no'],
                    'amount'         => null,
                    'status'         => 'renewed',
                    'details'        => "12-month registration renewed for candidate {$c['full_name']} (Ref: {$c['ref_no']}).",
                    'actor'          => $r['renewed_by'] ?? ($c['case_manager_name'] ?: 'Case Manager'),
                    'actor_role'     => 'case_manager',
                    'candidate_name' => $c['full_name'],
                    'entity_type'    => 'candidate',
                    'entity_id'      => $candId
                ];
            }
        }

        // 3. Claims associated with this Case Manager
        $myClaimIds = [];
        foreach ($store['claims'] ?? [] as $cl) {
            $candId = (int)($cl['candidate_id'] ?? 0);
            $isMyClaim = $matchesCM($cl['case_manager_name'] ?? null, (int)($cl['case_manager_id'] ?? 0)) ||
                         isset($myCandidateIds[$candId]) ||
                         ($targetUserId > 0 && (int)($cl['created_by'] ?? 0) === $targetUserId);

            if (!$isMyClaim) continue;

            $claimId = (int)$cl['id'];
            $myClaimIds[$claimId] = true;
            $clDate = $cl['claim_date'] ?? date('Y-m-d');
            $clTime = $cl['created_at'] ?? ($clDate . ' 11:00:00');

            $dedupKey = 'CLAIM_CREATED_claim_' . $claimId . '_' . substr($clTime, 0, 10);
            if (!isset($seenKeys[$dedupKey])) {
                $activities[] = [
                    'id'          => 'act_claim_' . $claimId,
                    'timestamp'   => $clTime,
                    'date'        => $clDate,
                    'category'    => 'claim',
                    'action'      => 'CLAIM_FILED',
                    'title'       => "Subsidy Claim Filed (BHD " . number_format($cl['claim_amount_bhd'] ?? 0, 3) . ")",
                    'ref'         => $cl['claim_ref'] ?? ('CLM-' . $claimId),
                    'amount'      => (float)($cl['claim_amount_bhd'] ?? 0),
                    'status'      => $cl['status'] ?? 'undisputed',
                    'details'     => "Filed subsidy claim {$cl['claim_ref']} for BHD " . number_format($cl['claim_amount_bhd'] ?? 0, 3) . " (Stage: {$cl['claim_type']}). Status: {$cl['status']}.",
                    'actor'       => $cl['case_manager_name'] ?: 'Case Manager',
                    'actor_role'  => 'case_manager',
                    'entity_type' => 'claim',
                    'entity_id'   => $claimId
                ];
            }
        }

        // 4. Payments collected on claims of this Case Manager
        foreach ($store['payments'] ?? [] as $p) {
            $claimId = (int)($p['claim_id'] ?? 0);
            $candId = (int)($p['candidate_id'] ?? 0);

            $isMyPayment = isset($myClaimIds[$claimId]) ||
                           isset($myCandidateIds[$candId]) ||
                           ($targetUserId > 0 && (int)($p['user_id'] ?? 0) === $targetUserId);

            if (!$isMyPayment) continue;

            $payId = (int)$p['id'];
            $pDate = $p['payment_date'] ?? date('Y-m-d');
            $pTime = $p['created_at'] ?? ($pDate . ' 14:30:00');

            $dedupKey = 'PAYMENT_RECORDED_payment_' . $payId . '_' . substr($pTime, 0, 10);
            if (!isset($seenKeys[$dedupKey])) {
                $activities[] = [
                    'id'          => 'act_pay_' . $payId,
                    'timestamp'   => $pTime,
                    'date'        => $pDate,
                    'category'    => 'payment',
                    'action'      => 'PAYMENT_COLLECTED',
                    'title'       => "Treasury Payment Collected (BHD " . number_format($p['amount_paid_bhd'] ?? 0, 3) . ")",
                    'ref'         => $p['receipt_no'] ?: ($p['reference_doc_no'] ?: ('RCPT-' . $payId)),
                    'amount'      => (float)($p['amount_paid_bhd'] ?? 0),
                    'status'      => 'settled',
                    'details'     => "Payment receipt {$p['receipt_no']} for BHD " . number_format($p['amount_paid_bhd'] ?? 0, 3) . " collected via {$p['payment_method']}. Reference: " . ($p['reference_doc_no'] ?: 'N/A') . ".",
                    'actor'       => $targetUser['full_name'] ?? 'Case Manager / Treasury',
                    'actor_role'  => 'case_manager',
                    'entity_type' => 'payment',
                    'entity_id'   => $payId
                ];
            }
        }

        // Sort chronological newest first
        usort($activities, function($a, $b) {
            return strcmp($b['timestamp'], $a['timestamp']);
        });

        return array_values(array_slice($activities, 0, $limit));
    }

    private static function categorizeAction(string $action, string $entityType): string {
        $a = strtoupper($action);
        if (str_contains($a, 'REG')) return 'registration';
        if (str_contains($a, 'PLACE')) return 'placement';
        if (str_contains($a, 'CLAIM')) return 'claim';
        if (str_contains($a, 'PAY')) return 'payment';
        if (str_contains($a, 'RENEW')) return 'renewal';
        if (str_contains($a, 'DOC')) return 'document';
        if (str_contains($a, 'DISP')) return 'dispute';
        if (str_contains($a, 'CHECK')) return 'checklist';
        return $entityType ?: 'audit';
    }

    private static function formatActionTitle(string $action, string $entityType): string {
        switch (strtoupper($action)) {
            case 'CANDIDATE_REGISTERED': return 'Candidate Registered in Talent Pool';
            case 'CANDIDATE_PLACED': return 'Employment Contract Linked';
            case 'BATCH_PLACED': return 'Batch Placement Allocation';
            case 'CANDIDATE_STATUS_UPDATED': return 'Candidate Status Modified';
            case 'CANDIDATE_RENEWED': return 'Candidate Registration Renewed';
            case 'CLAIM_CREATED':
            case 'CLAIM_FILED': return 'Subsidy Claim Filed';
            case 'CLAIM_UPDATED': return 'Subsidy Claim Status Updated';
            case 'CLAIM_APPROVED': return 'Subsidy Claim Approved for Payment';
            case 'PAYMENT_RECORDED':
            case 'PAYMENT_COLLECTED': return 'Treasury Payment Receipt Recorded';
            case 'DOCUMENT_UPLOADED': return 'Verification Document Uploaded';
            case 'CHECKLIST_UPDATED': return 'Registration Checklist Progress Updated';
            case 'DISPUTE_LOGGED': return 'Claim Dispute Logged';
            case 'DISPUTE_RESOLVED': return 'Claim Dispute Resolved';
            default:
                return ucfirst(str_replace('_', ' ', strtolower($action ?: $entityType)));
        }
    }
}

