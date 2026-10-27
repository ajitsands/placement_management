<?php
/**
 * User Controller - RBAC & User Administration
 * Strictly guarded: ONLY Superadmin and Admin can create or modify users.
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\User;

class UserController {
    public function index(array $data): void {
        $users = User::all();
        Response::json($users);
    }

    public function show(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = User::find($id);
        if (!$user) {
            Response::notFound("User with ID {$id} not found");
        }
        Response::json($user);
    }

    public function create(array $data): void {
        // Strict RBAC enforcement: Only Admin and Superadmin can create users
        Auth::requireAdminOrSuperadmin();

        $username = trim($data['username'] ?? '');
        $fullName = trim($data['full_name'] ?? '');
        $role = trim($data['role'] ?? 'case_manager');

        if (empty($username) || empty($fullName)) {
            Response::error('Username and Full Name are mandatory', 400);
        }

        if (!in_array($role, ['superadmin', 'admin', 'case_manager'])) {
            Response::error('Invalid user role specified. Must be superadmin, admin, or case_manager.', 400);
        }

        // Only superadmin can create other superadmins
        $currentUser = Auth::getCurrentUser();
        if ($role === 'superadmin' && $currentUser['role'] !== 'superadmin') {
            Response::forbidden('Only Superadmin can designate another Superadmin user.');
        }

        // Check if username already exists
        if (User::findByUsername($username)) {
            Response::error("Username '{$username}' already exists", 409);
        }

        $newUser = User::create($data);
        Response::json($newUser, 201, 'User created successfully by authorized administrator');
    }

    public function update(array $data, array $params): void {
        Auth::requireAdminOrSuperadmin();

        $id = (int)($params['id'] ?? 0);
        $existing = User::find($id);
        if (!$existing) {
            Response::notFound("User with ID {$id} not found");
        }

        $currentUser = Auth::getCurrentUser();

        // Prevent non-superadmin from modifying a superadmin
        if ($existing['role'] === 'superadmin' && $currentUser['role'] !== 'superadmin') {
            Response::forbidden('Only Superadmin can modify a Superadmin account.');
        }

        // Role escalation check
        if (isset($data['role']) && $data['role'] === 'superadmin' && $currentUser['role'] !== 'superadmin') {
            Response::forbidden('Only Superadmin can promote users to Superadmin role.');
        }

        // Role validity check
        if (isset($data['role']) && !in_array($data['role'], ['superadmin', 'admin', 'case_manager'])) {
            Response::error('Invalid user role specified. Must be superadmin, admin, or case_manager.', 400);
        }

        // Username uniqueness check if changed
        if (isset($data['username'])) {
            $newUsername = trim($data['username']);
            if (empty($newUsername)) {
                Response::error('Username cannot be empty', 400);
            }
            if (strtolower($newUsername) !== strtolower($existing['username'])) {
                $conflict = User::findByUsername($newUsername);
                if ($conflict && (int)$conflict['id'] !== $id) {
                    Response::error("Username '{$newUsername}' is already taken by another account", 409);
                }
            }
        }

        // Prevent self-deactivation
        if (isset($data['is_active']) && (int)$data['is_active'] === 0 && (int)$currentUser['id'] === $id) {
            Response::error('You cannot deactivate your own logged-in account.', 400);
        }

        // Prevent self-demotion from superadmin
        if (isset($data['role']) && $data['role'] !== 'superadmin' && (int)$currentUser['id'] === $id && $currentUser['role'] === 'superadmin') {
            Response::error('You cannot remove the Superadmin role from your own active session.', 400);
        }

        $updated = User::update($id, $data);
        Response::json($updated, 200, 'User updated successfully');
    }

    public function toggleStatus(array $data, array $params): void {
        Auth::requireAdminOrSuperadmin();

        $id = (int)($params['id'] ?? 0);
        $existing = User::find($id);
        if (!$existing) {
            Response::notFound("User with ID {$id} not found");
        }

        $currentUser = Auth::getCurrentUser();

        // Prevent non-superadmin from modifying a superadmin
        if ($existing['role'] === 'superadmin' && $currentUser['role'] !== 'superadmin') {
            Response::forbidden('Only Superadmin can activate or deactivate a Superadmin account.');
        }

        $currentStatus = isset($existing['is_active']) ? (int)$existing['is_active'] : 1;
        $newStatus = isset($data['is_active']) ? (int)$data['is_active'] : ($currentStatus === 1 ? 0 : 1);

        // Prevent self-deactivation
        if ($newStatus === 0 && (int)$currentUser['id'] === $id) {
            Response::error('You cannot deactivate your own logged-in account.', 400);
        }

        $updated = User::update($id, ['is_active' => $newStatus]);
        $statusLabel = $newStatus === 1 ? 'activated' : 'deactivated';
        Response::json($updated, 200, "User '{$existing['username']}' successfully {$statusLabel}.");
    }

    public function caseManagers(array $data): void {
        $cms = User::getCaseManagers();
        Response::json($cms);
    }
}
