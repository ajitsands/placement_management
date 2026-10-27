<?php
/**
 * Report Controller - Management KPIs and 10 Specialized Analytical Reports
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Report;

class ReportController {
    public function kpis(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $kpis = Report::getKPIs($scope);
        Response::json([
            'scoped_case_manager' => $scope,
            'kpis' => $kpis
        ]);
    }

    public function generate(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $type = $data['type'] ?? 'candidate_placement';
        $report = Report::generate($type, $scope);

        Response::json([
            'type' => $type,
            'scoped_case_manager' => $scope,
            'title' => $report['title'],
            'count' => count($report['data']),
            'data' => $report['data']
        ]);
    }
}
