<?php
/**
 * Milestone Model (+180d, +365d Automation Engine)
 */

namespace App\Models;

use App\Config\Database;

class Milestone {
    public static function all(?string $caseManagerScope = null, int|string|null $candidateIdOrStatus = null, ?string $statusFilter = null): array {
        $candidateId = null;
        if (is_int($candidateIdOrStatus)) {
            $candidateId = $candidateIdOrStatus;
        } elseif (is_string($candidateIdOrStatus) && $statusFilter === null) {
            $statusFilter = $candidateIdOrStatus;
        }

        $store = Database::getStore();
        $milestones = $store['milestones'] ?? [];
        $candidates = array_column($store['candidates'] ?? [], null, 'id');
        $today = date('Y-m-d');
        $todayTimestamp = strtotime($today);

        $claims = $store['claims'] ?? [];
        $payments = $store['payments'] ?? [];

        // Precompute paid amounts per claim
        $paidMap = [];
        foreach ($payments as $p) {
            $cid = (int)($p['claim_id'] ?? 0);
            if ($cid > 0) {
                $paidMap[$cid] = ($paidMap[$cid] ?? 0.0) + (float)($p['amount_paid_bhd'] ?? 0.0);
            }
        }

        $claimMap = [];
        $candTypeClaimMap = [];
        foreach ($claims as $c) {
            $cType = $c['claim_type'] ?? '';
            if ($cType === 'initial_placement') $cType = 'placement';
            if ($cType === 'probation_completion' || $cType === 'retention_6m') $cType = '180_days';
            if ($cType === 'year_completion' || $cType === 'retention_12m') $cType = '365_days';

            if (!empty($c['milestone_id'])) {
                $claimMap[(int)$c['milestone_id']] = $c;
            }
            if (!empty($c['candidate_id']) && !empty($cType)) {
                $candTypeClaimMap[$c['candidate_id'] . '_' . $cType] = $c;
            }
        }

        $result = [];
        foreach ($milestones as $ms) {
            $cand = $candidates[$ms['candidate_id']] ?? null;
            if (!$cand) continue;

            if ($candidateId !== null && (int)$ms['candidate_id'] !== $candidateId) {
                continue;
            }

            // Check case manager scoping
            if ($caseManagerScope !== null && $caseManagerScope !== '') {
                if (strcasecmp($cand['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    continue;
                }
            }

            // Target Date calculation
            $targetDate = $ms['due_date'] ?? null;
            if (!$targetDate && !empty($cand['joining_date'])) {
                if ($ms['milestone_type'] === 'placement') {
                    $targetDate = $cand['joining_date'];
                } elseif ($ms['milestone_type'] === '180_days') {
                    $targetDate = date('Y-m-d', strtotime('+180 days', strtotime($cand['joining_date'])));
                } elseif ($ms['milestone_type'] === '365_days') {
                    $targetDate = date('Y-m-d', strtotime('+365 days', strtotime($cand['joining_date'])));
                }
            }

            // Days Remaining calculation
            $daysRemaining = null;
            if ($targetDate) {
                $targetTimestamp = strtotime($targetDate);
                $daysRemaining = (int) round(($targetTimestamp - $todayTimestamp) / 86400);
            }

            // Calculate dynamic status if not claimed/disputed
            $status = $ms['status'];
            if ($status !== 'claimed' && $status !== 'disputed') {
                if ($daysRemaining !== null) {
                    if ($daysRemaining < -30) {
                        $status = 'overdue';
                    } elseif ($daysRemaining <= 0) {
                        $status = 'due';
                    } else {
                        $status = 'upcoming';
                    }
                }
            }

            if ($statusFilter && $status !== $statusFilter) {
                continue;
            }

            // Determine milestone stage in days (0, 180, 365)
            $stage = 0;
            if ($ms['milestone_type'] === '180_days') $stage = 180;
            elseif ($ms['milestone_type'] === '365_days') $stage = 365;

            // Resolve linked submitted claim details
            $linkedClaim = $claimMap[(int)$ms['id']] 
                ?? $candTypeClaimMap[$ms['candidate_id'] . '_' . $ms['milestone_type']]
                ?? null;

            $claimAmount = $linkedClaim ? (float)$linkedClaim['claim_amount_bhd'] : null;
            $claimRef = $linkedClaim['claim_ref'] ?? null;
            $claimId = $linkedClaim ? (int)$linkedClaim['id'] : null;
            $claimStatus = $linkedClaim['status'] ?? null;

            $collected = $claimId ? (float)($paidMap[$claimId] ?? 0.0) : 0.0;
            $balance = $claimAmount !== null ? max(0.0, $claimAmount - $collected) : null;

            if ($claimStatus === 'disputed' || ($ms['status'] ?? '') === 'disputed') {
                $status = 'disputed';
            }

            $ms['status'] = $status;
            $ms['current_status'] = $status;
            $ms['target_date'] = $targetDate;
            $ms['due_date'] = $targetDate;
            $ms['days_remaining'] = $daysRemaining;
            $ms['milestone_stage'] = $stage;
            $ms['claim_amount_bhd'] = $claimAmount;
            $ms['amount_collected_bhd'] = $collected;
            $ms['total_paid_bhd'] = $collected;
            $ms['balance_bhd'] = $balance;
            $ms['claim_ref'] = $claimRef;
            $ms['claim_id'] = $claimId;
            $ms['claim_status'] = $claimStatus;
            $ms['candidate_ref'] = $cand['ref_no'];
            $ms['candidate_name'] = $cand['full_name'];
            $ms['candidate_cpr'] = $cand['cpr_no'];
            $ms['company_name'] = $cand['company_name'];
            $ms['employer_cr'] = $cand['employer_cr'] ?? null;
            $ms['salary_bhd'] = $cand['salary_bhd'];
            $ms['case_manager_name'] = $cand['case_manager_name'];
            $ms['joining_date'] = $cand['joining_date'] ?? null;

            $result[] = $ms;
        }

        return $result;
    }

    public static function find(int $id): ?array {
        $all = self::all();
        foreach ($all as $m) {
            if ((int)$m['id'] === $id) return $m;
        }
        return null;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        foreach ($store['milestones'] as &$m) {
            if ((int)$m['id'] === $id) {
                if (isset($data['status'])) $m['status'] = $data['status'];
                if (isset($data['due_date'])) $m['due_date'] = $data['due_date'];
                if (isset($data['target_date'])) $m['due_date'] = $data['target_date'];
                if (isset($data['milestone_title'])) $m['milestone_title'] = $data['milestone_title'];
                if (isset($data['alert_dispatched'])) $m['alert_dispatched'] = (int)$data['alert_dispatched'];
                Database::saveStore($store);
                return $m;
            }
        }
        return null;
    }

    public static function markClaimed(int $milestoneId): bool {
        $store = Database::getStore();
        foreach ($store['milestones'] as &$m) {
            if ((int)$m['id'] === $milestoneId) {
                $m['status'] = 'claimed';
                Database::saveStore($store);
                return true;
            }
        }
        return false;
    }

    public static function markDisputed(int $milestoneId): bool {
        $store = Database::getStore();
        foreach ($store['milestones'] as &$m) {
            if ((int)$m['id'] === $milestoneId) {
                $m['status'] = 'disputed';
                Database::saveStore($store);
                return true;
            }
        }
        return false;
    }

    public static function markReinstated(int $milestoneId): bool {
        $store = Database::getStore();
        foreach ($store['milestones'] as &$m) {
            if ((int)$m['id'] === $milestoneId) {
                $m['status'] = 'due';
                Database::saveStore($store);
                return true;
            }
        }
        return false;
    }
}
