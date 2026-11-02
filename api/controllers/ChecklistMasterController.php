<?php
/**
 * ChecklistMaster Controller - Candidate Registration Compliance Checklist API
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\ChecklistMaster;

class ChecklistMasterController {
    public function index(array $data): void {
        $activeOnly = !empty($data['active_only']);
        $items = ChecklistMaster::all($activeOnly);

        $totalWeight = array_sum(array_column($items, 'weight'));
        $mandatoryCount = count(array_filter($items, function($item) {
            return !empty($item['is_mandatory']);
        }));

        Response::json([
            'count'           => count($items),
            'total_weight'    => $totalWeight,
            'mandatory_count' => $mandatoryCount,
            'items'           => $items
        ]);
    }

    public function show(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $item = ChecklistMaster::find($id);

        if (!$item) {
            Response::notFound("Checklist criterion #{$id} not found");
        }

        Response::json($item);
    }

    public function create(array $data): void {
        Auth::requireAdminOrSuperadmin();

        $title = trim($data['title'] ?? '');
        if (empty($title)) {
            Response::error('Checklist criterion title is required', 400);
        }

        $code = strtoupper(trim($data['code'] ?? ''));
        if (!empty($code)) {
            $existing = ChecklistMaster::findByCode($code);
            if ($existing) {
                Response::error("Criterion with code '{$code}' already exists", 409);
            }
        }

        $newItem = ChecklistMaster::create($data);
        Response::json($newItem, 201, 'Checklist criterion created successfully');
    }

    public function update(array $data, array $params): void {
        Auth::requireAdminOrSuperadmin();

        $id = (int)($params['id'] ?? 0);
        $item = ChecklistMaster::find($id);

        if (!$item) {
            Response::notFound("Checklist criterion #{$id} not found");
        }

        $code = strtoupper(trim($data['code'] ?? ''));
        if (!empty($code) && strcasecmp($code, $item['code']) !== 0) {
            $existing = ChecklistMaster::findByCode($code);
            if ($existing && (int)$existing['id'] !== $id) {
                Response::error("Criterion with code '{$code}' already exists", 409);
            }
        }

        $updated = ChecklistMaster::update($id, $data);
        Response::json($updated, 200, 'Checklist criterion updated successfully');
    }

    public function delete(array $data, array $params): void {
        Auth::requireAdminOrSuperadmin();

        $id = (int)($params['id'] ?? 0);
        $item = ChecklistMaster::find($id);

        if (!$item) {
            Response::notFound("Checklist criterion #{$id} not found");
        }

        ChecklistMaster::delete($id);
        Response::json(null, 200, "Checklist criterion #{$id} removed successfully");
    }

    public function evaluate(array $data): void {
        $checked = is_array($data['checked'] ?? null) ? $data['checked'] : [];
        $evaluation = ChecklistMaster::evaluateProgress($checked);
        Response::json($evaluation);
    }
}

