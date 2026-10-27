<?php
/**
 * Milestone Controller - Placement Retention Milestones (+0d, +180d, +365d)
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Milestone;

class MilestoneController {
    public function index(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $candidateId = !empty($data['candidate_id']) ? (int)$data['candidate_id'] : null;
        $status = $data['status'] ?? null;

        $milestones = Milestone::all($scope, $candidateId, $status);
        Response::json([
            'count' => count($milestones),
            'scoped_case_manager' => $scope,
            'milestones' => $milestones
        ]);
    }

    public function due(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $all = Milestone::all($scope);
        $dueOrOverdue = array_filter($all, function($m) {
            return in_array($m['status'], ['due', 'overdue']) || 
                   ($m['status'] === 'upcoming' && strtotime($m['target_date']) <= time());
        });

        Response::json([
            'count' => count($dueOrOverdue),
            'scoped_case_manager' => $scope,
            'milestones' => array_values($dueOrOverdue)
        ]);
    }

    public function update(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $updated = Milestone::update($id, $data);
        if (!$updated) {
            Response::notFound("Milestone record with ID {$id} not found");
        }
        Response::json($updated, 200, 'Milestone updated successfully');
    }
}
