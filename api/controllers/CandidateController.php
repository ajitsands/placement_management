<?php
/**
 * Candidate Controller - Registration, Placement Linking, Status Management & Document Uploads
 * Scoped to Case Manager when role is case_manager; Global for Admin/Superadmin.
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Candidate;

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

        $newCandidate = Candidate::create($data, $defaultCaseManager);
        $hasPlacement = !empty($newCandidate['company_name']);

        $message = $hasPlacement 
            ? 'Candidate registered and linked to placement with automated Day 0, Day 180, and Day 365 retention milestones'
            : 'Candidate registered successfully in available registry';

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

        Response::json($updated, 200, "Candidate successfully linked to {$companyName} with Day 0, Day 180, and Day 365 milestones created!");
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
}
