<?php
/**
 * Dispute Resolution & Termination Model
 */

namespace App\Models;

use App\Config\Database;

class Dispute {
    public static function all(?string $caseManagerScope = null, ?string $categoryFilter = null, ?string $statusFilter = null): array {
        $store = Database::getStore();
        $disputes = $store['disputes'] ?? [];
        $claims = array_column($store['claims'] ?? [], null, 'id');
        $candidates = array_column($store['candidates'] ?? [], null, 'id');
        $milestones = array_column($store['milestones'] ?? [], null, 'id');

        $result = [];
        foreach ($disputes as $d) {
            $claim = $claims[$d['claim_id']] ?? null;
            $candId = $d['candidate_id'] ?? ($claim['candidate_id'] ?? null);
            $cand = $candId ? ($candidates[$candId] ?? null) : null;
            $msId = $d['milestone_id'] ?? ($claim['milestone_id'] ?? null);
            $milestone = $msId ? ($milestones[$msId] ?? null) : null;

            if ($caseManagerScope !== null && $caseManagerScope !== '') {
                $cm = $claim['case_manager_name'] ?? ($cand['case_manager_name'] ?? '');
                if (strcasecmp($cm, $caseManagerScope) !== 0) {
                    continue;
                }
            }

            if ($categoryFilter && !empty($d['dispute_category']) && strcasecmp($d['dispute_category'], $categoryFilter) !== 0) {
                continue;
            }

            if ($statusFilter && $d['status'] !== $statusFilter) {
                continue;
            }

            $d['claim_ref'] = $claim['claim_ref'] ?? ($milestone['claim_ref'] ?? 'Pending');
            $d['claim_amount_bhd'] = $claim['claim_amount_bhd'] ?? ($milestone['claim_amount_bhd'] ?? null);
            $d['claim_status'] = $claim['status'] ?? ($milestone['status'] ?? 'disputed');
            $d['claim_remarks'] = $claim['remarks'] ?? ($d['remarks'] ?? '');
            $d['case_manager_name'] = $claim['case_manager_name'] ?? ($cand['case_manager_name'] ?? 'System');
            $d['candidate_id'] = $candId;
            $d['candidate_name'] = $cand['full_name'] ?? ($milestone['candidate_name'] ?? 'N/A');
            $d['candidate_cpr'] = $cand['cpr_no'] ?? ($milestone['candidate_cpr'] ?? 'N/A');
            $d['company_name'] = $cand['company_name'] ?? ($milestone['company_name'] ?? 'N/A');
            $d['employer_cr'] = $cand['employer_cr'] ?? ($milestone['employer_cr'] ?? 'N/A');
            $d['milestone_id'] = $msId;
            $d['milestone_title'] = $milestone['milestone_title'] ?? 'Retention Gate';

            $result[] = $d;
        }

        return $result;
    }

    public static function logDispute(array $data, array $currentUser): array {
        $store = Database::getStore();
        $id = count($store['disputes']) > 0 ? max(array_column($store['disputes'], 'id')) + 1 : 1;
        $claimId = (int)($data['claim_id'] ?? 0);
        $milestoneId = !empty($data['milestone_id']) ? (int)$data['milestone_id'] : 0;
        $candId = (int)($data['candidate_id'] ?? 0);

        // If claimId not provided, look up by milestone_id or candidate
        if ($claimId <= 0 && $milestoneId > 0) {
            foreach ($store['claims'] as $c) {
                if (!empty($c['milestone_id']) && (int)$c['milestone_id'] === $milestoneId) {
                    $claimId = (int)$c['id'];
                    break;
                }
            }
        }

        // If still no claim found, create a claim record for this milestone
        if ($claimId <= 0 && $milestoneId > 0 && $candId > 0) {
            $createdClaim = Claim::create([
                'candidate_id' => $candId,
                'milestone_id' => $milestoneId,
                'claim_type' => $data['claim_type'] ?? 'placement',
                'claim_amount_bhd' => (float)($data['claim_amount_bhd'] ?? 500.000),
                'status' => 'disputed',
                'remarks' => trim($data['remarks'] ?? 'Claim marked as disputed')
            ], $currentUser);
            $claimId = (int)$createdClaim['id'];
            $store = Database::getStore();
            $id = count($store['disputes']) > 0 ? max(array_column($store['disputes'], 'id')) + 1 : 1;
        }

        $reason = trim($data['dispute_reason'] ?? ($data['reason'] ?? 'Dispute reported during employment milestone verification'));
        $category = trim($data['dispute_category'] ?? ($data['category'] ?? $reason));
        $remarks = trim($data['remarks'] ?? '');

        $newDispute = [
            'id'                 => $id,
            'claim_id'           => $claimId,
            'milestone_id'       => $milestoneId,
            'candidate_id'       => $candId,
            'dispute_category'   => $category,
            'dispute_reason'     => $reason,
            'dispute_date'       => !empty($data['dispute_date']) ? $data['dispute_date'] : date('Y-m-d'),
            'status'             => 'active_dispute',
            'resolution_notes'   => !empty($remarks) ? $remarks : trim($data['resolution_notes'] ?? 'Under review with employer and Ministry of Labour'),
            'remarks'            => $remarks,
            'handled_by_user_id' => $currentUser['id'],
            'created_at'         => date('Y-m-d H:i:s')
        ];

        $store['disputes'][] = $newDispute;

        // Transition claim status to disputed and update remarks
        foreach ($store['claims'] as &$c) {
            if ((int)$c['id'] === $claimId) {
                $c['status'] = 'disputed';
                if (!empty($remarks)) {
                    $c['remarks'] = $remarks;
                }
                if ($milestoneId <= 0 && !empty($c['milestone_id'])) {
                    $milestoneId = (int)$c['milestone_id'];
                }
                break;
            }
        }

        // Mark the linked milestone as disputed
        if ($milestoneId > 0) {
            foreach ($store['milestones'] as &$m) {
                if ((int)$m['id'] === $milestoneId) {
                    $m['status'] = 'disputed';
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
            'action' => 'DISPUTE_LOGGED',
            'entity_type' => 'claim',
            'entity_id' => $claimId,
            'details' => "Dispute logged ({$category}): {$reason}" . (!empty($remarks) ? " | Remarks: {$remarks}" : ""),
            'created_at' => date('Y-m-d H:i:s')
        ];

        Database::saveStore($store);
        return $newDispute;
    }

    public static function create(array $data, array $currentUser): array {
        return self::logDispute($data, $currentUser);
    }

    public static function reinstate(int $disputeId, string $notes, array $currentUser): ?array {
        $store = Database::getStore();
        foreach ($store['disputes'] as &$d) {
            if ((int)$d['id'] === $disputeId) {
                $d['status'] = 'reinstated';
                $d['reinstated_date'] = date('Y-m-d');
                $d['resolution_notes'] = $notes;

                $claimId = (int)$d['claim_id'];
                $milestoneId = null;

                // Reinstate claim to undisputed
                foreach ($store['claims'] as &$c) {
                    if ((int)$c['id'] === $claimId) {
                        $c['status'] = 'undisputed';
                        if (!empty($c['milestone_id'])) {
                            $milestoneId = (int)$c['milestone_id'];
                        }
                        break;
                    }
                }

                // Revert milestone back to claimed
                if ($milestoneId > 0) {
                    foreach ($store['milestones'] as &$m) {
                        if ((int)$m['id'] === $milestoneId) {
                            $m['status'] = 'claimed';
                            break;
                        }
                    }
                }

                $store['audit_logs'][] = [
                    'id' => count($store['audit_logs']) + 1,
                    'user_id' => $currentUser['id'],
                    'username' => $currentUser['username'],
                    'role' => $currentUser['role'],
                    'action' => 'CLAIM_REINSTATED',
                    'entity_type' => 'claim',
                    'entity_id' => $d['claim_id'],
                    'details' => "Claim reinstated to active collections: {$notes}",
                    'created_at' => date('Y-m-d H:i:s')
                ];

                Database::saveStore($store);
                return $d;
            }
        }
        return null;
    }

    public static function resolveAndReinstate(int $disputeId, string $notes, array $currentUser): ?array {
        return self::reinstate($disputeId, $notes, $currentUser);
    }

    public static function terminate(int $disputeId, string $notes, array $currentUser): ?array {
        $store = Database::getStore();
        foreach ($store['disputes'] as &$d) {
            if ((int)$d['id'] === $disputeId) {
                $d['status'] = 'terminated';
                $d['terminated_date'] = date('Y-m-d');
                $d['resolution_notes'] = $notes;

                $claimId = (int)$d['claim_id'];
                $milestoneId = null;

                // Terminate claim non-destructively
                foreach ($store['claims'] as &$c) {
                    if ((int)$c['id'] === $claimId) {
                        $c['status'] = 'terminated';
                        if (!empty($c['milestone_id'])) {
                            $milestoneId = (int)$c['milestone_id'];
                        }
                        break;
                    }
                }

                // Update milestone status
                if ($milestoneId > 0) {
                    foreach ($store['milestones'] as &$m) {
                        if ((int)$m['id'] === $milestoneId) {
                            $m['status'] = 'disputed';
                            break;
                        }
                    }
                }

                $store['audit_logs'][] = [
                    'id' => count($store['audit_logs']) + 1,
                    'user_id' => $currentUser['id'],
                    'username' => $currentUser['username'],
                    'role' => $currentUser['role'],
                    'action' => 'CLAIM_TERMINATED',
                    'entity_type' => 'claim',
                    'entity_id' => $d['claim_id'],
                    'details' => "Claim marked Terminated (permanently preserved for audit): {$notes}",
                    'created_at' => date('Y-m-d H:i:s')
                ];

                Database::saveStore($store);
                return $d;
            }
        }
        return null;
    }

    public static function terminatePlacement(int $disputeId, string $notes, array $currentUser): ?array {
        return self::terminate($disputeId, $notes, $currentUser);
    }
}
