<?php
/**
 * Activity Controller - Real-time Action Traceability & Case Manager Activities Feed
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\AuditLog;
use App\Models\User;

class ActivityController {
    public function index(array $data): void {
        $currentUser = Auth::getCurrentUser();
        $cmName = $data['case_manager'] ?? null;
        $cmId = !empty($data['case_manager_id']) ? (int)$data['case_manager_id'] : null;
        $userId = !empty($data['user_id']) ? (int)$data['user_id'] : null;
        $limit = !empty($data['limit']) ? (int)$data['limit'] : 250;

        // If no filter specified and active user is a case manager, default to active user
        if ($cmName === null && $cmId === null && $userId === null && ($currentUser['role'] ?? '') === 'case_manager') {
            $cmName = $currentUser['case_manager_code'] ?? $currentUser['full_name'];
            $userId = (int)$currentUser['id'];
        }

        $activities = AuditLog::getActivitiesForCaseManager($cmName, $userId ?: $cmId, $limit);

        // Optional search filter
        if (!empty($data['search'])) {
            $q = strtolower(trim($data['search']));
            $activities = array_filter($activities, function($a) use ($q) {
                return str_contains(strtolower($a['title'] ?? ''), $q) ||
                       str_contains(strtolower($a['ref'] ?? ''), $q) ||
                       str_contains(strtolower($a['details'] ?? ''), $q) ||
                       str_contains(strtolower($a['actor'] ?? ''), $q) ||
                       str_contains(strtolower($a['candidate_name'] ?? ''), $q) ||
                       str_contains(strtolower($a['employer_name'] ?? ''), $q);
            });
            $activities = array_values($activities);
        }

        // Optional category filter
        if (!empty($data['category']) && $data['category'] !== 'all') {
            $cat = strtolower(trim($data['category']));
            $activities = array_filter($activities, fn($a) => strtolower($a['category'] ?? '') === $cat);
            $activities = array_values($activities);
        }

        Response::json([
            'count'        => count($activities),
            'case_manager' => $cmName ?: ($currentUser['full_name'] ?? 'All'),
            'activities'   => $activities
        ]);
    }
}

