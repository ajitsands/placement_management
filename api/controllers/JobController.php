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

    public function show(int $id): void {
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
        if (empty($data['job_title'])) {
            Response::error('Job Title is required', 400);
        }
        if (empty($data['company_name'])) {
            Response::error('Employer Company Name is required', 400);
        }

        $job = Job::create($data, $user);
        Response::json($job, 201, "Job '{$job['job_title']}' under {$job['company_name']} created successfully");
    }

    public function update(int $id, array $data): void {
        $job = Job::update($id, $data);
        if (!$job) {
            Response::notFound("Job with ID {$id} not found");
        }
        Response::json($job, 200, "Job position updated successfully");
    }

    public function delete(int $id): void {
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

