<?php
/**
 * Candidate Controller - Registration, Placement Linking, Status Management & Document Uploads
 * Scoped to Case Manager when role is case_manager; Global for Admin/Superadmin.
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Candidate;
use App\Models\Job;

class CandidateController {
    public function index(array $data): void {
        $scope = Auth::getScopedCaseManagerName();

        // Admins can optionally filter by a chosen case manager
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $search = $data['q'] ?? null;
        $candidates = Candidate::all($scope, $search);

        // Optional status filter
        if (!empty($data['status'])) {
            $statusFilter = strtolower(trim($data['status']));
            $candidates = array_values(array_filter($candidates, function($c) use ($statusFilter) {
                return strtolower($c['status'] ?? '') === $statusFilter;
            }));
        }

        Response::json([
            'count' => count($candidates),
            'scoped_case_manager' => $scope,
            'candidates' => $candidates
        ]);
    }

    public function show(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $scope = Auth::getScopedCaseManagerName();
        $candidate = Candidate::find($id, $scope);

        if (!$candidate) {
            Response::notFound("Candidate record not found or access restricted to assigned Case Manager");
        }

        Response::json($candidate);
    }

    public function create(array $data): void {
        $user = Auth::getCurrentUser();
        $fullName = trim($data['full_name'] ?? '');
        $cprNo = trim($data['cpr_no'] ?? '');

        if (empty($fullName) || empty($cprNo)) {
            Response::error('Candidate Full Name and CPR Number are mandatory', 400);
        }

        // Validate 9-digit Bahrain CPR format if numeric
        if (preg_match('/^[0-9]{9}$/', $cprNo) !== 1 && strlen($cprNo) < 6) {
            Response::error('CPR Number must be a valid Bahrain CPR identification number', 400);
        }

        // Check duplicate CPR
        $existing = Candidate::findByCPR($cprNo);
        if ($existing) {
            Response::error("Candidate with CPR {$cprNo} is already registered under Ref {$existing['ref_no']} ({$existing['full_name']})", 409);
        }

        // Validate custom reference if supplied
        $customRef = trim($data['ref_no'] ?? '');
        if (!empty($customRef)) {
            $existingRef = Candidate::findByRef($customRef);
            if ($existingRef) {
                Response::error("Reference number '{$customRef}' is already taken by candidate {$existingRef['full_name']} (CPR: {$existingRef['cpr_no']})", 409);
            }
        }

        // Scope to Case Manager if creator is case_manager
        $defaultCaseManager = ($user['role'] === 'case_manager') 
            ? ($user['case_manager_code'] ?? $user['full_name']) 
            : null;

        // Verify registration checklist compliance
        $checklistPending = false;
        if (isset($data['checklist_items'])) {
            $checked = [];
            if (is_array($data['checklist_items'])) {
                foreach ($data['checklist_items'] as $item) {
                    if (is_string($item) || is_numeric($item)) {
                        $checked[] = $item;
                    } elseif (is_array($item) && (!empty($item['completed']) || !empty($item['is_checked']))) {
                        $checked[] = $item['code'] ?? ($item['id'] ?? null);
                    }
                }
            }
            $eval = \App\Models\ChecklistMaster::evaluateProgress($checked);
            if (!empty($eval['missing_mandatory'])) {
                $checklistPending = true;
                $data['status'] = 'registration_incomplete';
            }
        }

        $newCandidate = Candidate::create($data, $defaultCaseManager);
        $hasPlacement = !empty($newCandidate['company_name']);

        // If candidate registered from Training or Career Fair Event Studio, automatically record attendance
        if (!empty($data['event_id'])) {
            $eventId = (int)$data['event_id'];
            $eventNotes = "Registered at " . ($newCandidate['center'] ?? 'event');
            \App\Models\Event::addAttendee($eventId, (int)$newCandidate['id'], 'attended', $eventNotes);
        }

        // Log candidate registration action
        \App\Models\AuditLog::log(
            'CANDIDATE_REGISTERED',
            'candidate',
            (int)$newCandidate['id'],
            $newCandidate['ref_no'],
            "Candidate {$newCandidate['full_name']} (CPR: {$newCandidate['cpr_no']}) registered in talent pool with education {$newCandidate['education']} at Center {$newCandidate['center']}.",
            $user
        );

        if ($hasPlacement) {
            \App\Models\AuditLog::log(
                'CANDIDATE_PLACED',
                'candidate',
                (int)$newCandidate['id'],
                $newCandidate['ref_no'],
                "Candidate {$newCandidate['full_name']} placed at {$newCandidate['company_name']} as {$newCandidate['position_title']} (Salary: BHD " . number_format($newCandidate['salary_bhd'] ?? 0, 3) . ").",
                $user
            );
        }

        if ($checklistPending || ($newCandidate['status'] ?? '') === 'registration_incomplete') {
            $pct = $newCandidate['checklist_completion_pct'] ?? 0;
            $message = "Candidate saved in Incomplete Profile list ({$pct}% checklist completed)";
        } elseif ($hasPlacement) {
            $message = 'Candidate registered and linked to placement with automated Day 0, Day 180, and Day 365 retention milestones';
        } else {
            $message = 'Candidate registered successfully in available registry';
        }

        Response::json($newCandidate, 201, $message);
    }

    public function nextRef(): void {
        $nextRef = Candidate::generateNextRef();
        Response::json(['next_ref' => $nextRef]);
    }

    public function update(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $scope = Auth::getScopedCaseManagerName();
        $existing = Candidate::find($id, $scope);

        if (!$existing) {
            Response::notFound("Candidate not found or access unauthorized for this Case Manager");
        }

        $updated = Candidate::update($id, $data, $scope);
        Response::json($updated, 200, 'Candidate profile updated successfully');
    }

    public function linkPlacement(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $scope = Auth::getScopedCaseManagerName();

        $companyName = trim($data['company_name'] ?? '');
        $joiningDate = trim($data['joining_date'] ?? '');

        if (empty($companyName) || empty($joiningDate)) {
            Response::error('Employer Company Name and Placement Joining Date are required to link a placement', 400);
        }

        $updated = Candidate::linkPlacement($id, $data, $scope);
        if (!$updated) {
            Response::notFound("Candidate not found or unauthorized to link placement");
        }

        $user = Auth::getCurrentUser();
        \App\Models\AuditLog::log(
            'CANDIDATE_PLACED',
            'candidate',
            $id,
            $updated['ref_no'],
            "Candidate {$updated['full_name']} placed at {$companyName} as {$updated['position_title']} (Salary: BHD " . number_format($updated['salary_bhd'] ?? 0, 3) . ") by {$user['full_name']}.",
            $user
        );

        Response::json($updated, 200, "Candidate successfully linked to {$companyName} with Day 0, Day 180, and Day 365 milestones created!");
    }

    public function batchPlacement(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        $jobId = (int)($data['job_id'] ?? 0);
        $placements = $data['placements'] ?? [];

        if (empty($placements) || !is_array($placements)) {
            Response::error('No candidates selected for placement allocation', 400);
        }

        $job = null;
        if ($jobId > 0) {
            $job = Job::find($jobId);
            if (!$job) {
                Response::error("Job vacancy with ID {$jobId} not found", 400);
            }
            $remaining = (int)($job['vacancies_remaining'] ?? $job['vacancies_count'] ?? 1);
            if (count($placements) > $remaining) {
                Response::error("Cannot allocate " . count($placements) . " candidates. Job opening only has {$remaining} available vacancy opening(s).", 400);
            }
        }

        $results = [];
        foreach ($placements as $p) {
            $candId = (int)($p['candidate_id'] ?? $p['id'] ?? 0);
            if ($candId <= 0) continue;

            $placementData = [
                'job_id'            => $jobId ?: null,
                'job_code'          => $data['job_code'] ?? ($job['job_code'] ?? null),
                'company_name'      => $data['company_name'] ?? ($job['company_name'] ?? 'Employer'),
                'employer_cr'       => $data['employer_cr'] ?? ($job['employer_cr'] ?? ''),
                'position_title'    => $p['position_title'] ?? ($data['position_title'] ?? ($job['position_title'] ?? 'Specialist')),
                'department'        => $data['department'] ?? ($job['department'] ?? 'Operations'),
                'salary_bhd'        => (float)($p['salary_bhd'] ?? ($data['salary_bhd'] ?? ($job['salary_offered_bhd'] ?? 450.0))),
                'joining_date'      => !empty($p['joining_date']) ? $p['joining_date'] : (!empty($data['joining_date']) ? $data['joining_date'] : date('Y-m-d')),
                'employee_type'     => $p['employee_type'] ?? 'Full-Time',
                'mol_certified'     => $p['mol_certified'] ?? 'Yes',
                'long_mol'          => $p['long_mol'] ?? ($data['long_mol'] ?? 'No'),
                'comments'          => !empty($p['comments']) ? $p['comments'] : ($data['comments'] ?? ''),
                'case_manager_name' => $p['case_manager_name'] ?? ($data['case_manager_name'] ?? null),
                'case_manager_id'   => $p['case_manager_id'] ?? ($data['case_manager_id'] ?? null)
            ];

            $updated = Candidate::linkPlacement($candId, $placementData, $scope);
            if ($updated) {
                $results[] = $updated;
            }
        }

        $company = $data['company_name'] ?? ($job['company_name'] ?? 'Employer');
        $user = Auth::getCurrentUser();
        \App\Models\AuditLog::log(
            'BATCH_PLACED',
            'job',
            $jobId ?: null,
            $data['job_code'] ?? ($job['job_code'] ?? 'BATCH'),
            "Batch placement of " . count($results) . " candidate(s) allocated to {$company} by {$user['full_name']}.",
            $user
        );

        Response::json([
            'count' => count($results),
            'candidates' => $results
        ], 200, "Successfully allocated " . count($results) . " candidate(s) to {$company} with automated milestones!");
    }

    public function updateStatus(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $scope = Auth::getScopedCaseManagerName();
        $status = strtolower(trim($data['status'] ?? ''));
        $remarks = trim($data['remarks'] ?? '');

        if (empty($status)) {
            Response::error('Candidate status is required', 400);
        }

        $updated = Candidate::updateStatus($id, $status, $remarks, $scope);
        if (!$updated) {
            Response::error("Invalid status or candidate access unauthorized", 400);
        }

        $user = Auth::getCurrentUser();
        \App\Models\AuditLog::log(
            'CANDIDATE_STATUS_UPDATED',
            'candidate',
            $id,
            $updated['ref_no'] ?? null,
            "Candidate status updated to '{$status}' by {$user['full_name']}." . ($remarks ? " Remarks: {$remarks}" : ''),
            $user
        );

        Response::json($updated, 200, "Candidate status updated to '{$status}' successfully");
    }

    public function uploadDocument(array $data): void {
        $uploadDir = dirname(__DIR__, 2) . '/public/uploads/candidates/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $docName = trim($data['name'] ?? 'Candidate Document');
        $docType = trim($data['type'] ?? 'General Document');
        $candidateId = !empty($data['candidate_id']) ? (int)$data['candidate_id'] : null;

        $fileName = '';
        $fileSize = 0;
        $fileUrl = '';

        // 1. Check if multipart $_FILES upload
        if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $origName = basename($_FILES['file']['name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'txt'];

            if (!in_array($ext, $allowedExts)) {
                Response::error('Invalid file format. Allowed: PDF, DOC, DOCX, PNG, JPG, JPEG', 400);
            }

            $safeName = 'doc_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $targetPath = $uploadDir . $safeName;

            if (move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
                $fileName = $origName;
                $fileSize = filesize($targetPath);
                $fileUrl = 'uploads/candidates/' . $safeName;
            } else {
                Response::error('Failed to save uploaded file to storage directory', 500);
            }
        } 
        // 2. Check if base64 encoded file payload
        elseif (!empty($data['file_data']) && !empty($data['file_name'])) {
            $origName = basename($data['file_name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'txt'];

            if (!in_array($ext, $allowedExts)) {
                Response::error('Invalid file format. Allowed: PDF, DOC, DOCX, PNG, JPG, JPEG', 400);
            }

            $rawBase64 = $data['file_data'];
            if (str_contains($rawBase64, ',')) {
                $rawBase64 = explode(',', $rawBase64)[1];
            }

            $decodedData = base64_decode($rawBase64);
            if ($decodedData === false) {
                Response::error('Failed to decode base64 file data', 400);
            }

            $safeName = 'doc_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $targetPath = $uploadDir . $safeName;

            if (file_put_contents($targetPath, $decodedData) !== false) {
                $fileName = $origName;
                $fileSize = strlen($decodedData);
                $fileUrl = 'uploads/candidates/' . $safeName;
            } else {
                Response::error('Failed to write decoded file to disk', 500);
            }
        } else {
            Response::error('No file data provided in request', 400);
        }

        $document = [
            'id'          => 'DOC-' . time() . '-' . rand(100, 999),
            'name'        => $docName,
            'type'        => $docType,
            'file_name'   => $fileName,
            'file_size'   => $fileSize,
            'file_url'    => $fileUrl,
            'uploaded_at' => date('Y-m-d H:i:s')
        ];

        // If candidate_id was passed, automatically attach to candidate record
        if ($candidateId > 0) {
            $scope = Auth::getScopedCaseManagerName();
            Candidate::addDocument($candidateId, $document, $scope);
        }

        Response::json([
            'success'  => true,
            'document' => $document
        ], 201, 'Document uploaded successfully');
    }

    public function addDocument(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $scope = Auth::getScopedCaseManagerName();

        $updated = Candidate::addDocument($id, $data, $scope);
        if (!$updated) {
            Response::notFound("Candidate not found or access unauthorized");
        }

        $user = Auth::getCurrentUser();
        \App\Models\AuditLog::log(
            'DOCUMENT_UPLOADED',
            'candidate',
            $id,
            $data['file_name'] ?? 'DOC',
            "Document '{$data['name']}' uploaded to candidate {$updated['full_name']} vault by {$user['full_name']}.",
            $user
        );

        Response::json($updated, 200, 'Document attached to candidate successfully');
    }

    public function deleteDocument(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $docId = (string)($params['docId'] ?? '');
        $scope = Auth::getScopedCaseManagerName();

        $updated = Candidate::deleteDocument($id, $docId, $scope);
        if (!$updated) {
            Response::notFound("Candidate not found or access unauthorized");
        }

        Response::json($updated, 200, 'Document removed from candidate profile');
    }

    public function updateChecklist(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $scope = Auth::getScopedCaseManagerName();
        $candidate = Candidate::find($id, $scope);

        if (!$candidate) {
            Response::notFound("Candidate record not found or access restricted to assigned Case Manager");
        }

        $checked = is_array($data['checked'] ?? null) 
            ? $data['checked'] 
            : (is_array($data['checklist_items'] ?? null) ? $data['checklist_items'] : []);

        $updated = Candidate::updateChecklist($id, $checked, $scope);
        Response::json($updated, 200, "Candidate registration checklist updated ({$updated['checklist_completion_pct']}% complete)");
    }

    public function renew(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = Auth::getCurrentUser();
        $scope = Auth::getScopedCaseManagerName();

        $candidate = Candidate::find($id, $scope);
        if (!$candidate) {
            Response::notFound("Candidate record not found or access restricted to assigned Case Manager");
        }

        $renewedBy = $user['full_name'] ?? ($user['username'] ?? 'Directorate Officer');
        $renewed = Candidate::renew($id, $data, $renewedBy);

        if (!$renewed) {
            Response::error("Failed to renew candidate registration", 500);
        }

        Response::json($renewed, 200, "Candidate registration successfully renewed (Ref: {$renewed['ref_no']})");
    }

    public function activities(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $scope = Auth::getScopedCaseManagerName();
        $candidate = Candidate::find($id, $scope);

        if (!$candidate) {
            Response::notFound("Candidate record not found or access restricted to assigned Case Manager");
        }

        $activities = Candidate::getActivityLog($id);

        Response::json([
            'candidate' => [
                'id'                => $candidate['id'],
                'full_name'         => $candidate['full_name'],
                'cpr_no'            => $candidate['cpr_no'],
                'ref_no'            => $candidate['ref_no'],
                'status'            => $candidate['status'],
                'registration_date' => $candidate['registration_date'],
                'last_renewal_date' => $candidate['last_renewal_date'] ?? null,
                'renewals_count'    => (int)($candidate['renewals_count'] ?? 0),
                'education'         => $candidate['education'] ?? 'N/A',
                'case_manager_name' => $candidate['case_manager_name'] ?? 'System',
                'approved_by_job_center' => $candidate['approved_by_job_center'] ?? 'Yes',
                'approved_by_tamkeen'    => $candidate['approved_by_tamkeen'] ?? 'No',
                'tamkeen_approval_date'  => $candidate['tamkeen_approval_date'] ?? null,
                'tamkeen_approval_notes' => $candidate['tamkeen_approval_notes'] ?? null,
                'phone'             => $candidate['phone'] ?? '',
                'email'             => $candidate['email'] ?? ''
            ],
            'count'      => count($activities),
            'activities' => $activities
        ]);
    }

    public function approveTamkeen(array $data, array $params): void {
        try {
            $id = (int)($params['id'] ?? 0);
            $user = Auth::getCurrentUser();
            $scope = Auth::getScopedCaseManagerName();

            $approvalDate = !empty($data['approval_date']) ? trim($data['approval_date']) : date('Y-m-d');
            $notes = trim($data['notes'] ?? ($data['remarks'] ?? ''));

            $approvedBy = $user['full_name'] ?? ($user['username'] ?? 'Tamkeen Directorate');
            $candidate = Candidate::approveTamkeen($id, [
                'approval_date' => $approvalDate,
                'notes' => $notes
            ], $approvedBy, $scope);

            if (!$candidate) {
                Response::notFound("Candidate record not found or access restricted");
                return;
            }

            \App\Models\AuditLog::log(
                'CANDIDATE_TAMKEEN_APPROVED',
                'candidate',
                $id,
                $candidate['ref_no'],
                "Candidate {$candidate['full_name']} (CPR: {$candidate['cpr_no']}) approved by Tamkeen on {$approvalDate}. Notes: {$notes}. Approved by {$approvedBy}.",
                $user
            );

            Response::json($candidate, 200, "Candidate '{$candidate['full_name']}' approved by Tamkeen successfully.");
        } catch (\Throwable $e) {
            error_log("[CandidateController::approveTamkeen Error] " . $e->getMessage());
            Response::error("Approval processing failed: " . $e->getMessage(), 500);
        }
    }

    public function updateApprovals(array $data, array $params): void {
        try {
            $id = (int)($params['id'] ?? 0);
            $user = Auth::getCurrentUser();
            $scope = Auth::getScopedCaseManagerName();

            $approvedBy = $user['full_name'] ?? ($user['username'] ?? 'Authorized Officer');
            $candidate = Candidate::updateApprovals($id, $data, $approvedBy, $scope);

            if (!$candidate) {
                Response::notFound("Candidate record not found or access restricted");
                return;
            }

            \App\Models\AuditLog::log(
                'CANDIDATE_APPROVALS_UPDATED',
                'candidate',
                $id,
                $candidate['ref_no'],
                "Approvals updated for {$candidate['full_name']} (Job Center: {$candidate['approved_by_job_center']}, Tamkeen: {$candidate['approved_by_tamkeen']}).",
                $user
            );

            Response::json($candidate, 200, "Approvals updated successfully for '{$candidate['full_name']}'.");
        } catch (\Throwable $e) {
            error_log("[CandidateController::updateApprovals Error] " . $e->getMessage());
            Response::error("Approval update failed: " . $e->getMessage(), 500);
        }
    }
}
