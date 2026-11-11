<?php
/**
 * Job Controller - Employer Job Postings & Placement Capacity
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Job;

class JobController {
    public function index(array $data): void {
        $employer = !empty($data['employer']) ? trim($data['employer']) : null;
        $status = !empty($data['status']) ? trim($data['status']) : null;

        $jobs = Job::all($employer, $status);
        $totalVacancies = array_sum(array_column($jobs, 'vacancies_count'));
        $totalPlaced = array_sum(array_column($jobs, 'placed_count'));
        $totalOpen = array_sum(array_column($jobs, 'vacancies_remaining'));

        Response::json([
            'count' => count($jobs),
            'total_vacancies' => $totalVacancies,
            'total_placed' => $totalPlaced,
            'total_open' => $totalOpen,
            'jobs' => $jobs
        ]);
    }

    public function show($arg1, $arg2 = []): void {
        $data = is_array($arg1) ? $arg1 : (is_array($arg2) ? $arg2 : []);
        $params = is_array($arg2) ? $arg2 : [];
        $id = is_numeric($arg1) ? (int)$arg1 : (int)($params['id'] ?? ($data['id'] ?? 0));

        $job = Job::find($id);
        if (!$job) {
            Response::notFound("Job position with ID {$id} not found");
        }
        Response::json($job);
    }

    public function nextCode(): void {
        Response::json(['next_job_code' => Job::generateNextCode()]);
    }

    public function create(array $data): void {
        $user = Auth::getCurrentUser();
        $jobTitle = trim($data['job_title'] ?? $data['position_title'] ?? '');
        if (empty($jobTitle)) {
            Response::error('Job Title is required', 400);
        }
        $companyName = trim($data['company_name'] ?? '');
        if (empty($companyName)) {
            Response::error('Employer Company Name is required', 400);
        }

        $data['job_title'] = $jobTitle;
        if (!isset($data['salary_offered_bhd']) && isset($data['salary_bhd'])) {
            $data['salary_offered_bhd'] = (float)$data['salary_bhd'];
        }

        $job = Job::create($data, $user);
        Response::json($job, 201, "Job '{$job['job_title']}' under {$job['company_name']} created successfully");
    }

    public function update($arg1, $arg2 = []): void {
        $data = is_array($arg1) ? $arg1 : (is_array($arg2) ? $arg2 : []);
        $params = is_array($arg2) ? $arg2 : [];
        $id = is_numeric($arg1) ? (int)$arg1 : (int)($params['id'] ?? ($data['id'] ?? 0));

        if ($id <= 0) {
            Response::error('Invalid Job ID', 400);
        }

        if (isset($data['position_title']) && !isset($data['job_title'])) {
            $data['job_title'] = trim($data['position_title']);
        }
        if (isset($data['salary_bhd']) && !isset($data['salary_offered_bhd'])) {
            $data['salary_offered_bhd'] = (float)$data['salary_bhd'];
        }

        $job = Job::update($id, $data);
        if (!$job) {
            Response::notFound("Job with ID {$id} not found");
        }
        Response::json($job, 200, "Job position updated successfully");
    }

    public function delete($arg1, $arg2 = []): void {
        $data = is_array($arg1) ? $arg1 : (is_array($arg2) ? $arg2 : []);
        $params = is_array($arg2) ? $arg2 : [];
        $id = is_numeric($arg1) ? (int)$arg1 : (int)($params['id'] ?? ($data['id'] ?? 0));

        if ($id <= 0) {
            Response::error('Invalid Job ID', 400);
        }

        $job = Job::find($id);
        if (!$job) {
            Response::notFound("Job with ID {$id} not found");
        }

        if (($job['placed_count'] ?? 0) > 0) {
            Response::error("Cannot delete Job: {$job['placed_count']} candidate placement(s) are linked to this job position.", 400);
        }

        Job::delete($id);
        Response::json(['id' => $id], 200, "Job position deleted successfully");
    }
}

