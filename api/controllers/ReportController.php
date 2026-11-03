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
        $cm = !empty($data['case_manager']) ? trim($data['case_manager']) : null;
        if ($cm === 'all' || $cm === '') $cm = null;
        $dateFrom = !empty($data['date_from']) ? trim($data['date_from']) : null;
        $dateTo = !empty($data['date_to']) ? trim($data['date_to']) : null;

        $type = $data['type'] ?? 'candidate_placement';
        $report = Report::generate($type, $cm, $dateFrom, $dateTo);

        Response::json([
            'type' => $type,
            'scoped_case_manager' => $cm,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'title' => $report['title'],
            'count' => count($report['data']),
            'data' => $report['data']
        ]);
    }
}
