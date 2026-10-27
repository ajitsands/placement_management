<?php
/**
 * Dispute Controller - Categorized Dispute Filing, Reinstatement, and Non-destructive Termination
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Dispute;

class DisputeController {
    public function index(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $category = $data['category'] ?? null;
        $status = $data['status'] ?? null;

        $disputes = Dispute::all($scope, $category, $status);
        Response::json([
            'count' => count($disputes),
            'scoped_case_manager' => $scope,
            'disputes' => $disputes
        ]);
    }

    public function create(array $data): void {
        $user = Auth::getCurrentUser();
        $claimId = (int)($data['claim_id'] ?? 0);
        $milestoneId = (int)($data['milestone_id'] ?? 0);
        $candidateId = (int)($data['candidate_id'] ?? 0);
        $reason = trim($data['dispute_reason'] ?? ($data['reason'] ?? ''));

        if ($claimId <= 0 && $milestoneId <= 0 && $candidateId <= 0) {
            Response::error('Claim ID, Milestone ID, or Candidate ID is mandatory', 400);
        }

        if (empty($reason)) {
            Response::error('Dispute reason is mandatory', 400);
        }

        $newDispute = Dispute::logDispute($data, $user);
        Response::json($newDispute, 201, 'Dispute recorded and claim frozen pending resolution');
    }

    public function getReasons(array $data): void {
        $store = \App\Config\Database::getStore();
        $raw = $store['settings']['dispute_reasons'] ?? null;
        $reasons = [];
        if ($raw) {
            $parsed = is_string($raw) ? json_decode($raw, true) : $raw;
            if (is_array($parsed)) $reasons = $parsed;
        }
        if (empty($reasons)) {
            $reasons = [
                'CPR Resignation / Voluntary Exit',
                'Employer Termination / Non-Cure',
                'Wage Discrepancy / GOSI Variance',
                'Retention Failure (Prior to 180 Days)',
                'Contractual Breach by Employer',
                'Absconding / Absenteeism',
                'Disciplinary Dismissal',
                'Other Administrative Exception'
            ];
        }
        Response::json(['reasons' => $reasons]);
    }

    public function addReason(array $data): void {
        $newReason = trim($data['reason'] ?? ($data['dispute_reason'] ?? ''));
        if (empty($newReason)) {
            Response::error('Reason text is required', 400);
        }

        $store = \App\Config\Database::getStore();
        $raw = $store['settings']['dispute_reasons'] ?? null;
        $reasons = [];
        if ($raw) {
            $parsed = is_string($raw) ? json_decode($raw, true) : $raw;
            if (is_array($parsed)) $reasons = $parsed;
        }
        if (empty($reasons)) {
            $reasons = [
                'CPR Resignation / Voluntary Exit',
                'Employer Termination / Non-Cure',
                'Wage Discrepancy / GOSI Variance',
                'Retention Failure (Prior to 180 Days)',
                'Contractual Breach by Employer',
                'Absconding / Absenteeism',
                'Disciplinary Dismissal',
                'Other Administrative Exception'
            ];
        }

        if (!in_array($newReason, $reasons)) {
            $reasons[] = $newReason;
            $store['settings']['dispute_reasons'] = json_encode($reasons, JSON_UNESCAPED_UNICODE);
            \App\Config\Database::saveStore($store);
        }

        Response::json(['reasons' => $reasons, 'added' => $newReason], 200, 'Master dispute reason registered successfully');
    }

    public function reinstate(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = Auth::getCurrentUser();
        $notes = trim($data['notes'] ?? 'Candidate reinstated after employer clarification');

        $result = Dispute::resolveAndReinstate($id, $notes, $user);
        if (!$result) {
            Response::notFound("Dispute record with ID {$id} not found");
        }

        Response::json($result, 200, 'Dispute resolved and candidate placement reinstated');
    }

    public function terminate(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = Auth::getCurrentUser();
        $notes = trim($data['notes'] ?? 'Placement terminated after non-cure period');

        $result = Dispute::terminatePlacement($id, $notes, $user);
        if (!$result) {
            Response::notFound("Dispute record with ID {$id} not found");
        }

        Response::json($result, 200, 'Placement marked as terminated. Audit log preserved.');
    }
}
