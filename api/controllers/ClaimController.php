<?php
/**
 * Claim Controller - Manual Claim Amount Entry Workflow
 * Governed by Case Manager scoping and Admin/Superadmin overrides.
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Claim;

class ClaimController {
    public function index(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $status = $data['status'] ?? null;
        $claims = Claim::all($scope, $status);

        Response::json([
            'count' => count($claims),
            'scoped_case_manager' => $scope,
            'claims' => $claims
        ]);
    }

    public function show(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $claim = Claim::find($id);

        if (!$claim) {
            Response::notFound("Claim record with ID {$id} not found");
        }

        Response::json($claim);
    }

    public function create(array $data): void {
        $user = Auth::getCurrentUser();
        $candidateId = (int)($data['candidate_id'] ?? 0);
        $claimAmount = isset($data['claim_amount_bhd']) ? (float)$data['claim_amount_bhd'] : null;

        if ($candidateId <= 0) {
            Response::error('Candidate ID is required to file a claim', 400);
        }

        if ($claimAmount === null || $claimAmount < 0) {
            Response::error('User must manually enter the Claim Amount (BHD)', 400);
        }

        $defaultCaseManager = ($user['role'] === 'case_manager')
            ? ($user['case_manager_code'] ?? $user['full_name'])
            : null;

        $newClaim = Claim::create($data, $user);
        Response::json($newClaim, 201, "Claim registered for BHD {$newClaim['claim_amount_bhd']}");
    }

    public function update(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $claim = null;
        if ($id > 0) {
            $claim = Claim::find($id);
        }

        // Fallback: If not found by ID, look up by milestone_id
        if (!$claim && !empty($data['milestone_id'])) {
            $msId = (int)$data['milestone_id'];
            $store = \App\Config\Database::getStore();
            foreach ($store['claims'] as $c) {
                if (!empty($c['milestone_id']) && (int)$c['milestone_id'] === $msId) {
                    $claim = $c;
                    $id = (int)$c['id'];
                    break;
                }
            }
        }

        // If claim still does not exist, create it for this milestone
        $currentUser = Auth::getCurrentUser();
        if (!$claim) {
            $newClaim = Claim::create($data, $currentUser);
            Response::json($newClaim, 200, 'Claim registered and updated successfully');
            return;
        }

        $updated = Claim::update($id, $data);
        if ($updated) {
            \App\Models\AuditLog::log(
                'CLAIM_UPDATED',
                'claim',
                $id,
                $updated['claim_ref'] ?? ('CLM-' . $id),
                "Claim {$updated['claim_ref']} updated to status '{$updated['status']}' with amount BHD " . number_format($updated['claim_amount_bhd'] ?? 0, 3) . " by {$currentUser['full_name']}.",
                $currentUser
            );
        }
        Response::json($updated, 200, 'Claim updated successfully');
    }

    public function approve(array $data, array $params): void {
        Auth::requireAdminOrSuperadmin();
        $currentUser = Auth::getCurrentUser();

        $id = (int)($params['id'] ?? 0);
        $updated = Claim::update($id, [
            'status' => 'undisputed',
            'remarks' => trim($data['remarks'] ?? 'Claim approved by authorized Directorate Admin')
        ]);

        if (!$updated) {
            Response::notFound("Claim not found");
        }

        \App\Models\AuditLog::log(
            'CLAIM_APPROVED',
            'claim',
            $id,
            $updated['claim_ref'] ?? ('CLM-' . $id),
            "Claim {$updated['claim_ref']} approved for disbursement by {$currentUser['full_name']}.",
            $currentUser
        );

        Response::json($updated, 200, 'Claim approved for disbursement');
    }
}
