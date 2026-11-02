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
        $category = trim($data['dispute_category'] ?? ($data['category'] ?? ($data['dispute_reason'] ?? '')));

        if ($claimId <= 0 && $milestoneId <= 0 && $candidateId <= 0) {
            Response::error('Claim ID, Milestone ID, or Candidate ID is mandatory', 400);
        }

        if (empty($category)) {
            Response::error('Dispute category is mandatory', 400);
        }

        $newDispute = Dispute::logDispute($data, $user);
        Response::json($newDispute, 201, 'Dispute recorded and claim frozen pending resolution');
    }

    public function update(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = Auth::getCurrentUser();

        $result = Dispute::updateDispute($id, $data, $user);
        if (!$result) {
            Response::notFound("Dispute record with ID {$id} not found");
        }

        Response::json($result, 200, 'Dispute details updated successfully');
    }

    public function uploadAttachment(array $data): void {
        $uploadDir = dirname(__DIR__, 2) . '/public/uploads/disputes/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $allowedExts = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'xlsx', 'xls'];
        $docName = trim($data['name'] ?? '');
        $docNotes = trim($data['notes'] ?? '');

        if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $origName = basename($_FILES['file']['name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts)) {
                Response::error('Invalid file format. Allowed: PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX, TXT, CSV', 400);
            }
            $safeName = 'dispute_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            if (!move_uploaded_file($_FILES['file']['tmp_name'], $uploadDir . $safeName)) {
                Response::error('Failed to save uploaded file to storage directory', 500);
            }
            $fileSize = filesize($uploadDir . $safeName);
        } elseif (!empty($data['file_data']) && !empty($data['file_name'])) {
            $origName = basename($data['file_name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts)) {
                Response::error('Invalid file format. Allowed: PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX, TXT, CSV', 400);
            }
            $raw = $data['file_data'];
            if (str_contains($raw, ',')) {
                $raw = explode(',', $raw, 2)[1];
            }
            $decoded = base64_decode($raw, true);
            if ($decoded === false) {
                Response::error('Failed to decode base64 file data', 400);
            }
            $safeName = 'dispute_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            if (file_put_contents($uploadDir . $safeName, $decoded) === false) {
                Response::error('Failed to write file to disk', 500);
            }
            $fileSize = strlen($decoded);
        } else {
            Response::error('No file data provided in request', 400);
        }

        Response::json([
            'id'          => 'ATT-' . time() . '-' . rand(100, 999),
            'name'        => $docName !== '' ? $docName : pathinfo($origName, PATHINFO_FILENAME),
            'notes'       => $docNotes,
            'file_name'   => $origName,
            'file_size'   => $fileSize,
            'file_url'    => 'uploads/disputes/' . $safeName,
            'uploaded_at' => date('Y-m-d H:i:s')
        ], 201, 'Dispute attachment uploaded successfully');
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
        $notes = trim($data['notes'] ?? ($data['remarks'] ?? 'Candidate reinstated after employer clarification'));
        $date = !empty($data['date']) ? $data['date'] : (!empty($data['reinstated_date']) ? $data['reinstated_date'] : date('Y-m-d'));

        $result = Dispute::resolveAndReinstate($id, $notes, $user, $date);
        if (!$result) {
            Response::notFound("Dispute record with ID {$id} not found");
        }

        Response::json($result, 200, 'Dispute resolved and candidate placement reinstated');
    }

    public function terminate(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = Auth::getCurrentUser();
        $notes = trim($data['notes'] ?? ($data['remarks'] ?? 'Placement terminated after non-cure period'));
        $date = !empty($data['date']) ? $data['date'] : (!empty($data['terminated_date']) ? $data['terminated_date'] : date('Y-m-d'));

        $result = Dispute::terminatePlacement($id, $notes, $user, $date);
        if (!$result) {
            Response::notFound("Dispute record with ID {$id} not found");
        }

        Response::json($result, 200, 'Placement marked as terminated. Audit log preserved.');
    }
}
