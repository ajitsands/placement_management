<?php
/**
 * Claim Model (Manual Claim Amount Entry Workflow)
 */

namespace App\Models;

use App\Config\Database;

class Claim {
    public static function all(?string $caseManagerScope = null, ?string $statusFilter = null): array {
        $store = Database::getStore();
        $claims = $store['claims'] ?? [];
        $candidates = array_column($store['candidates'] ?? [], null, 'id');
        $milestones = array_column($store['milestones'] ?? [], null, 'id');
        $payments = $store['payments'] ?? [];

        // Precompute paid amounts per claim
        $paidMap = [];
        foreach ($payments as $p) {
            $cid = $p['claim_id'];
            $paidMap[$cid] = ($paidMap[$cid] ?? 0.0) + (float)$p['amount_paid_bhd'];
        }

        $result = [];
        foreach ($claims as $c) {
            // Case manager scoping
            if ($caseManagerScope !== null && $caseManagerScope !== '') {
                if (strcasecmp($c['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    continue;
                }
            }

            if ($statusFilter && $c['status'] !== $statusFilter) {
                continue;
            }

            $cand = $candidates[$c['candidate_id']] ?? null;
            $ms = $milestones[$c['milestone_id']] ?? null;

            $paid = (float)($paidMap[$c['id']] ?? 0.0);
            $claimAmt = (float)$c['claim_amount_bhd'];
            $balance = max(0.0, $claimAmt - $paid);

            // Auto-detect settled if balance is 0 and status was undisputed
            $status = $c['status'];
            if ($status === 'undisputed' && $balance <= 0.0001 && $claimAmt > 0) {
                $status = 'settled';
            }

            $c['status'] = $status;
            $c['total_paid_bhd'] = $paid;
            $c['balance_bhd'] = $balance;
            $c['candidate_ref'] = $cand['ref_no'] ?? 'N/A';
            $c['candidate_name'] = $cand['full_name'] ?? 'N/A';
            $c['candidate_cpr'] = $cand['cpr_no'] ?? 'N/A';
            $c['company_name'] = $cand['company_name'] ?? 'N/A';
            $c['milestone_title'] = $ms['milestone_title'] ?? ucfirst(str_replace('_', ' ', $c['claim_type']));

            $result[] = $c;
        }

        return $result;
    }

    public static function find(int $id, ?string $caseManagerScope = null): ?array {
        $claims = self::all($caseManagerScope);
        foreach ($claims as $c) {
            if ((int)$c['id'] === $id) return $c;
        }
        return null;
    }

    public static function create(array $data, array $currentUser): array {
        $store = Database::getStore();
        $id = count($store['claims']) > 0 ? max(array_column($store['claims'], 'id')) + 1 : 1;

        $candId = (int)($data['candidate_id'] ?? 0);
        $milestoneId = !empty($data['milestone_id']) ? (int)$data['milestone_id'] : 0;
        $claimType = $data['claim_type'] ?? 'placement';
        if ($claimType === 'initial_placement') $claimType = 'placement';
        if ($claimType === 'probation_completion' || $claimType === 'retention_6m') $claimType = '180_days';
        if ($claimType === 'year_completion' || $claimType === 'retention_12m') $claimType = '365_days';

        // Auto-link milestone if not explicitly provided
        if ($milestoneId <= 0 && $candId > 0) {
            foreach ($store['milestones'] ?? [] as $m) {
                if ((int)$m['candidate_id'] === $candId && $m['milestone_type'] === $claimType) {
                    $milestoneId = (int)$m['id'];
                    break;
                }
            }
        }
        $milestoneId = $milestoneId > 0 ? $milestoneId : null;

        // Manual claim amount input in BHD
        $manualAmount = (float)($data['claim_amount_bhd'] ?? 550.000);

        // Check if a claim already exists for this milestone or candidate gate
        foreach ($store['claims'] as &$existingClaim) {
            $isSameMilestone = ($milestoneId > 0 && !empty($existingClaim['milestone_id']) && (int)$existingClaim['milestone_id'] === $milestoneId);
            $isSameCandidateGate = ($candId > 0 && (int)$existingClaim['candidate_id'] === $candId && $existingClaim['claim_type'] === $claimType);

            if ($isSameMilestone || $isSameCandidateGate) {
                if ($milestoneId > 0 && empty($existingClaim['milestone_id'])) {
                    $existingClaim['milestone_id'] = $milestoneId;
                }
                $existingClaim['claim_amount_bhd'] = $manualAmount;
                if (!empty($data['status'])) {
                    $existingClaim['status'] = $data['status'];
                }
                if (isset($data['remarks'])) {
                    $existingClaim['remarks'] = trim($data['remarks']);
                }
                if (!empty($data['claim_date'])) {
                    $existingClaim['claim_date'] = $data['claim_date'];
                }
                // Mark milestone as claimed
                if ($milestoneId > 0) {
                    foreach ($store['milestones'] as &$m) {
                        if ((int)$m['id'] === $milestoneId) {
                            $m['status'] = 'claimed';
                            break;
                        }
                    }
                }
                Database::saveStore($store);
                return $existingClaim;
            }
        }

        // Fetch candidate details
        $cand = null;
        foreach ($store['candidates'] as $c) {
            if ((int)$c['id'] === $candId) {
                $cand = $c;
                break;
            }
        }

        $caseManagerName = $cand['case_manager_name'] ?? ($currentUser['case_manager_code'] ?? $currentUser['full_name']);

        // Generate claim reference (CLM-YEAR-ID)
        $claimRef = !empty($data['claim_ref']) ? trim($data['claim_ref']) : ('CLM-' . date('Y') . '-' . str_pad($id, 3, '0', STR_PAD_LEFT));

        $newClaim = [
            'id'                => $id,
            'claim_ref'         => $claimRef,
            'candidate_id'      => $candId,
            'milestone_id'      => $milestoneId,
            'claim_type'        => $claimType,
            'claim_amount_bhd'  => $manualAmount,
            'status'            => $data['status'] ?? 'undisputed',
            'claim_date'        => !empty($data['claim_date']) ? $data['claim_date'] : date('Y-m-d'),
            'case_manager_id'   => $cand['case_manager_id'] ?? $currentUser['id'],
            'case_manager_name' => $caseManagerName,
            'remarks'           => trim($data['remarks'] ?? 'Agreed manual claim amount registered'),
            'created_by'        => $currentUser['id'],
            'created_at'        => date('Y-m-d H:i:s')
        ];

        $store['claims'][] = $newClaim;

        // Mark the milestone as claimed
        if ($milestoneId > 0) {
            foreach ($store['milestones'] as &$m) {
                if ((int)$m['id'] === $milestoneId) {
                    $m['status'] = 'claimed';
                    break;
                }
            }
        }

        // Add audit log
        $store['audit_logs'][] = [
            'id' => count($store['audit_logs']) + 1,
            'user_id' => $currentUser['id'],
            'username' => $currentUser['username'],
            'role' => $currentUser['role'],
            'action' => 'CLAIM_CREATED',
            'entity_type' => 'claim',
            'entity_id' => $id,
            'details' => "Claim {$claimRef} created with manual amount {$manualAmount} BHD for candidate {$cand['full_name']}",
            'created_at' => date('Y-m-d H:i:s')
        ];

        Database::saveStore($store);
        return $newClaim;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        $targetMilestoneId = !empty($data['milestone_id']) ? (int)$data['milestone_id'] : 0;
        $updatedClaim = null;

        // 1. Try finding by ID
        foreach ($store['claims'] as &$c) {
            if ((int)$c['id'] === $id) {
                if (isset($data['claim_amount_bhd'])) {
                    $c['claim_amount_bhd'] = (float)$data['claim_amount_bhd'];
                }
                if (isset($data['status'])) {
                    $c['status'] = $data['status'];
                }
                if (isset($data['remarks'])) {
                    $c['remarks'] = trim($data['remarks']);
                }
                if (isset($data['claim_date'])) {
                    $c['claim_date'] = $data['claim_date'];
                }
                if (isset($data['case_manager_name'])) {
                    $c['case_manager_name'] = trim($data['case_manager_name']);
                }
                if ($targetMilestoneId > 0 && empty($c['milestone_id'])) {
                    $c['milestone_id'] = $targetMilestoneId;
                }
                $updatedClaim = $c;
                break;
            }
        }

        // 2. Fallback: Find by milestone_id if not found by ID
        if (!$updatedClaim && $targetMilestoneId > 0) {
            foreach ($store['claims'] as &$c) {
                if (!empty($c['milestone_id']) && (int)$c['milestone_id'] === $targetMilestoneId) {
                    if (isset($data['claim_amount_bhd'])) {
                        $c['claim_amount_bhd'] = (float)$data['claim_amount_bhd'];
                    }
                    if (isset($data['status'])) {
                        $c['status'] = $data['status'];
                    }
                    if (isset($data['remarks'])) {
                        $c['remarks'] = trim($data['remarks']);
                    }
                    $updatedClaim = $c;
                    break;
                }
            }
        }

        if ($updatedClaim) {
            // Also synchronize amount across any related claim rows for the same milestone
            $msId = !empty($updatedClaim['milestone_id']) ? (int)$updatedClaim['milestone_id'] : $targetMilestoneId;
            $candId = (int)($updatedClaim['candidate_id'] ?? 0);
            $cType = $updatedClaim['claim_type'] ?? '';

            if (isset($data['claim_amount_bhd'])) {
                $newAmt = (float)$data['claim_amount_bhd'];
                foreach ($store['claims'] as &$c) {
                    if ($msId > 0 && !empty($c['milestone_id']) && (int)$c['milestone_id'] === $msId) {
                        $c['claim_amount_bhd'] = $newAmt;
                    } elseif ($candId > 0 && (int)$c['candidate_id'] === $candId && $c['claim_type'] === $cType) {
                        $c['claim_amount_bhd'] = $newAmt;
                    }
                }
            }

            // Ensure milestone is marked claimed if not already
            if ($msId > 0) {
                foreach ($store['milestones'] as &$m) {
                    if ((int)$m['id'] === $msId) {
                        $m['status'] = 'claimed';
                        break;
                    }
                }
            }

            Database::saveStore($store);
            return $updatedClaim;
        }

        return null;
    }

    public static function updateStatus(int $id, string $status, ?string $remarks = null): ?array {
        $store = Database::getStore();
        foreach ($store['claims'] as &$c) {
            if ((int)$c['id'] === $id) {
                $c['status'] = $status;
                if ($remarks !== null) {
                    $c['remarks'] = $remarks;
                }
                Database::saveStore($store);
                return $c;
            }
        }
        return null;
    }
}
