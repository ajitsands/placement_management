<?php
/**
 * DocumentCategoryController - Candidate Document Category Master API
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\DocumentCategory;

class DocumentCategoryController {
    public function index(array $data): void {
        $activeOnly = !empty($data['active_only']);
        $items = DocumentCategory::all($activeOnly);

        $mandatoryCount = count(array_filter($items, function($item) {
            return !empty($item['is_mandatory']);
        }));

        Response::json([
            'count'           => count($items),
            'mandatory_count' => $mandatoryCount,
            'items'           => $items
        ]);
    }

    public function show(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $item = DocumentCategory::find($id);

        if (!$item) {
            Response::notFound("Document category #{$id} not found");
        }

        Response::json($item);
    }

    public function create(array $data): void {
        Auth::requireAdminOrSuperadmin();

        $name = trim($data['name'] ?? '');
        if (empty($name)) {
            Response::error('Document category name is required', 400);
        }

        $code = strtoupper(trim($data['code'] ?? ''));
        if (!empty($code)) {
            $existing = DocumentCategory::findByCode($code);
            if ($existing) {
                Response::error("Document category with code '{$code}' already exists", 409);
            }
        }

        $newItem = DocumentCategory::create($data);
        Response::json($newItem, 201, 'Document category created successfully');
    }

    public function update(array $data, array $params): void {
        Auth::requireAdminOrSuperadmin();

        $id = (int)($params['id'] ?? 0);
        $item = DocumentCategory::find($id);

        if (!$item) {
            Response::notFound("Document category #{$id} not found");
        }

        $code = strtoupper(trim($data['code'] ?? ''));
        if (!empty($code) && strcasecmp($code, $item['code']) !== 0) {
            $existing = DocumentCategory::findByCode($code);
            if ($existing && (int)$existing['id'] !== $id) {
                Response::error("Document category with code '{$code}' already exists", 409);
            }
        }

        $updated = DocumentCategory::update($id, $data);
        Response::json($updated, 200, 'Document category updated successfully');
    }

    public function delete(array $data, array $params): void {
        Auth::requireAdminOrSuperadmin();

        $id = (int)($params['id'] ?? 0);
        $item = DocumentCategory::find($id);

        if (!$item) {
            Response::notFound("Document category #{$id} not found");
        }

        DocumentCategory::delete($id);
        Response::json(null, 200, "Document category #{$id} removed successfully");
    }
}

