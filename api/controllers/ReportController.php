<?php
/**
 * Report Controller - Management KPIs and 10 Specialized Analytical Reports
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Report;
use App\Models\Candidate;
use App\Models\Job;
use App\Models\Event;
use App\Models\Interview;
use App\Models\ChecklistMaster;
use App\Models\DocumentCategory;
use App\Models\Milestone;
use App\Models\Claim;
use App\Models\Dispute;
use App\Models\Payment;
use App\Models\AuditLog;
use App\Models\User;

class ReportController {
    public function bootstrap(array $data): void {
        $user = Auth::getCurrentUser();
        $scope = Auth::getScopedCaseManagerName();
        $role = strtolower((string)($user['role'] ?? ''));

        $activities = [];
        if ($role === 'case_manager') {
            $cmName = $user['case_manager_code'] ?? ($user['full_name'] ?? '');
            if ($cmName !== '') {
                $activities = AuditLog::getCaseManagerActivities($cmName);
            }
        }

        $users = [];
        if ($role === 'superadmin' || $role === 'admin') {
            $users = User::all();
        }

        Response::json([
            'kpis'                => Report::getKPIs($scope),
            'candidates'          => Candidate::all($scope),
            'jobs'                => Job::all(),
            'events'              => Event::all(),
            'interviews'          => Interview::all(),
            'checklist_masters'   => ChecklistMaster::all(),
            'document_categories' => DocumentCategory::all(),
            'milestones'          => Milestone::all($scope),
            'claims'              => Claim::all($scope),
            'disputes'            => Dispute::all($scope),
            'payments'            => Payment::all($scope),
            'activities'          => $activities,
            'users'               => $users
        ]);
    }
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
