<?php
/**
 * Interview Controller - Candidate Interviews & Placement Scheduling
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Interview;
use App\Models\Job;
use App\Models\Candidate;
use App\Models\AuditLog;

class InterviewController {
    public function index(array $data): void {
        $jobId = !empty($data['job_id']) ? (int)$data['job_id'] : null;
        $interviews = Interview::all($jobId);

        Response::json([
            'count'      => count($interviews),
            'interviews' => $interviews
        ]);
    }

    public function show($arg1, $arg2 = []): void {
        $data = is_array($arg1) ? $arg1 : (is_array($arg2) ? $arg2 : []);
        $params = is_array($arg2) ? $arg2 : [];
        $id = is_numeric($arg1) ? (int)$arg1 : (int)($params['id'] ?? ($data['id'] ?? 0));

        $interview = Interview::find($id);
        if (!$interview) {
            Response::notFound("Interview schedule with ID {$id} not found");
        }

        Response::json($interview);
    }

    public function nextCode(): void {
        Response::json(['next_code' => Interview::generateNextCode()]);
    }

    public function create(array $data): void {
        $user = Auth::getCurrentUser();

        $jobId = (int)($data['job_id'] ?? 0);
        if ($jobId <= 0) {
            Response::error('Job vacancy selection is mandatory', 400);
        }

        $date = trim($data['interview_date'] ?? '');
        if (empty($date)) {
            Response::error('Interview date is mandatory', 400);
        }

        $location = trim($data['location'] ?? '');
        if (empty($location)) {
            Response::error('Interview location is mandatory', 400);
        }

        $job = Job::find($jobId);
        if (!$job) {
            Response::error("Associated job opening (ID {$jobId}) not found", 404);
        }

        $interview = Interview::create($data, $user);

        Response::json($interview, 201, "Interview '{$interview['interview_code']}' scheduled successfully for {$interview['job_title']}");
    }

    public function update($arg1, $arg2 = []): void {
        $data = is_array($arg1) ? $arg1 : (is_array($arg2) ? $arg2 : []);
        $params = is_array($arg2) ? $arg2 : [];
        $id = is_numeric($arg1) ? (int)$arg1 : (int)($params['id'] ?? ($data['id'] ?? 0));

        if ($id <= 0) {
            Response::error('Invalid Interview ID', 400);
        }

        $user = Auth::getCurrentUser();
        $updated = Interview::update($id, $data, $user);
        if (!$updated) {
            Response::notFound("Interview with ID {$id} not found");
        }

        Response::json($updated, 200, "Interview schedule updated successfully");
    }

    public function delete($arg1, $arg2 = []): void {
        $data = is_array($arg1) ? $arg1 : (is_array($arg2) ? $arg2 : []);
        $params = is_array($arg2) ? $arg2 : [];
        $id = is_numeric($arg1) ? (int)$arg1 : (int)($params['id'] ?? ($data['id'] ?? 0));

        if ($id <= 0) {
            Response::error('Invalid Interview ID', 400);
        }

        $deleted = Interview::delete($id);
        if (!$deleted) {
            Response::notFound("Interview with ID {$id} not found");
        }

        Response::json(['success' => true], 200, "Interview cancelled and deleted successfully");
    }

    public function candidates($arg1, $arg2 = []): void {
        $data = is_array($arg1) ? $arg1 : (is_array($arg2) ? $arg2 : []);
        $params = is_array($arg2) ? $arg2 : [];
        $id = is_numeric($arg1) ? (int)$arg1 : (int)($params['id'] ?? ($data['id'] ?? 0));

        $interview = Interview::find($id);
        if (!$interview) {
            Response::notFound("Interview not found");
        }

        Response::json([
            'interview_id' => $id,
            'count'        => count($interview['candidates'] ?? []),
            'candidates'   => $interview['candidates'] ?? []
        ]);
    }

    public function addCandidate(array $data, array $params): void {
        $interviewId = (int)($params['id'] ?? ($data['id'] ?? 0));
        $candId = (int)($data['candidate_id'] ?? 0);

        if ($interviewId <= 0 || $candId <= 0) {
            Response::error('Interview ID and Candidate ID are required', 400);
        }

        $user = Auth::getCurrentUser();
        $updated = Interview::addCandidates($interviewId, [$candId], $data['remarks'] ?? null, $user);

        Response::json($updated, 200, "Candidate added to interview roster");
    }

    public function addCandidatesBatch(array $data, array $params): void {
        $interviewId = (int)($params['id'] ?? ($data['id'] ?? 0));
        $candidateIds = $data['candidate_ids'] ?? [];

        if ($interviewId <= 0 || !is_array($candidateIds) || count($candidateIds) === 0) {
            Response::error('Interview ID and list of candidate IDs are required', 400);
        }

        $user = Auth::getCurrentUser();
        $updated = Interview::addCandidates($interviewId, $candidateIds, $data['remarks'] ?? null, $user);

        Response::json($updated, 200, count($candidateIds) . " candidate(s) added to interview roster successfully");
    }

    public function removeCandidate(array $data, array $params): void {
        $interviewId = (int)($params['id'] ?? 0);
        $candidateId = (int)($params['candidateId'] ?? ($data['candidate_id'] ?? 0));

        if ($interviewId <= 0 || $candidateId <= 0) {
            Response::error('Interview ID and Candidate ID are required', 400);
        }

        Interview::removeCandidate($interviewId, $candidateId);
        Response::json(['success' => true], 200, "Candidate removed from interview roster");
    }

    public function updateCandidateOutcome(array $data, array $params): void {
        $interviewId = (int)($params['id'] ?? 0);
        $candidateId = (int)($params['candidateId'] ?? ($data['candidate_id'] ?? 0));

        if ($interviewId <= 0 || $candidateId <= 0) {
            Response::error('Interview ID and Candidate ID are required', 400);
        }

        $user = Auth::getCurrentUser();
        $outcome = Interview::updateCandidateOutcome($interviewId, $candidateId, $data, $user);

        // If bulk outcome update:
        $interview = Interview::find($interviewId);

        Response::json([
            'success'   => true,
            'outcome'   => $outcome,
            'interview' => $interview
        ], 200, "Candidate interview evaluation and remarks updated successfully");
    }

    public function placeCandidate(array $data, array $params): void {
        $interviewId = (int)($params['id'] ?? 0);
        $candidateId = (int)($params['candidateId'] ?? ($data['candidate_id'] ?? 0));

        $interview = Interview::find($interviewId);
        if (!$interview) {
            Response::notFound("Interview with ID {$interviewId} not found");
        }

        $jobId = (int)$interview['job_id'];
        $job = Job::find($jobId);
        if (!$job) {
            Response::error("Associated job not found", 404);
        }

        $user = Auth::getCurrentUser();

        // Mark interview status as passed
        Interview::updateCandidateOutcome($interviewId, $candidateId, [
            'status'  => 'passed',
            'remarks' => $data['remarks'] ?? 'Passed interview, direct placement initiated'
        ], $user);

        // Link placement on candidate
        $candidate = Candidate::find($candidateId);
        if (!$candidate) {
            Response::notFound("Candidate with ID {$candidateId} not found");
        }

        $placementPayload = [
            'job_id'            => $jobId,
            'company_name'      => $job['company_name'],
            'employer_cr'       => $job['employer_cr'] ?? '',
            'position_title'    => $job['job_title'] ?? $job['position_title'] ?? '',
            'salary_bhd'        => (float)($data['salary_bhd'] ?? $job['salary_offered_bhd'] ?? 500),
            'joining_date'      => $data['joining_date'] ?? date('Y-m-d'),
            'mol_certified'     => 'Yes',
            'status'            => 'placed',
            'case_manager_name' => $user['full_name'] ?? $candidate['case_manager_name'] ?? 'Case Manager'
        ];

        $placed = Candidate::linkPlacement($candidateId, $placementPayload);

        Response::json([
            'success'   => true,
            'candidate' => $placed,
            'interview' => Interview::find($interviewId)
        ], 200, "Candidate {$candidate['full_name']} successfully placed in {$job['company_name']} ({$job['job_title']}) following interview!");
    }
}
