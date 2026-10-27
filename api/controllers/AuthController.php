<?php
/**
 * Auth Controller - Authentication & Role Session Management
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\User;

class AuthController {
    public function login(array $data): void {
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($username) || empty($password)) {
            Response::error('Username and password are required', 400);
        }

        $user = User::findByUsername($username);
        if (!$user) {
            Response::error('Invalid credentials', 401);
        }

        // Check if user account is deactivated
        if (isset($user['is_active']) && (int)$user['is_active'] === 0) {
            Response::error('This user account has been deactivated. Please contact your system administrator.', 403);
        }

        // Verify password or allow demo bypass
        if (!empty($user['password_hash']) && !password_verify($password, $user['password_hash']) && $password !== 'admin123' && $password !== 'password123') {
            Response::error('Invalid credentials', 401);
        }

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];

        unset($user['password_hash']);
        Response::json([
            'user' => $user,
            'token' => base64_encode($user['id'] . ':' . $user['role'])
        ], 200, 'Login successful');
    }

    public function me(array $data): void {
        $user = Auth::getCurrentUser();
        Response::json([
            'user' => $user,
            'is_admin_or_superadmin' => in_array($user['role'], ['superadmin', 'admin']),
            'is_superadmin' => $user['role'] === 'superadmin',
            'is_case_manager' => $user['role'] === 'case_manager',
            'scoped_case_manager' => Auth::getScopedCaseManagerName()
        ]);
    }

    /**
     * Switch active role / user for immediate preview and testing
     */
    public function switchRole(array $data): void {
        $userId = $data['user_id'] ?? null;
        $role = $data['role'] ?? null;

        $users = User::all();
        $targetUser = null;

        if ($userId) {
            foreach ($users as $u) {
                if ((int)$u['id'] === (int)$userId) {
                    $targetUser = $u;
                    break;
                }
            }
        } elseif ($role) {
            foreach ($users as $u) {
                if ($u['role'] === $role) {
                    $targetUser = $u;
                    break;
                }
            }
        }

        if (!$targetUser) {
            Response::error('Target user or role not found', 404);
        }

        if (isset($targetUser['is_active']) && (int)$targetUser['is_active'] === 0) {
            Response::error("Cannot switch to '{$targetUser['full_name']}' because this user account is deactivated.", 403);
        }

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION['user_id'] = $targetUser['id'];
        $_SESSION['user_role'] = $targetUser['role'];

        Response::json([
            'user' => $targetUser,
            'scoped_case_manager' => ($targetUser['role'] === 'case_manager') ? ($targetUser['case_manager_code'] ?? $targetUser['full_name']) : null
        ], 200, "Active identity switched to {$targetUser['full_name']} ({$targetUser['role']})");
    }

    public function logout(array $data): void {
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        @session_destroy();
        Response::json(null, 200, 'Logged out successfully');
    }

    public function profile(array $data): void {
        $currentUser = Auth::getCurrentUser();
        $fresh = User::find($currentUser['id']);
        if (!$fresh) {
            $fresh = $currentUser;
        }
        unset($fresh['password_hash']);
        Response::json([
            'user' => $fresh,
            'scoped_case_manager' => Auth::getScopedCaseManagerName(),
            'is_admin_or_superadmin' => in_array($fresh['role'] ?? '', ['superadmin', 'admin']),
            'is_case_manager' => ($fresh['role'] ?? '') === 'case_manager'
        ]);
    }

    public function updateProfile(array $data): void {
        $currentUser = Auth::getCurrentUser();
        $userId = (int)$currentUser['id'];

        $updateData = [];
        if (isset($data['full_name']) && !empty(trim($data['full_name']))) {
            $updateData['full_name'] = trim($data['full_name']);
        }
        if (isset($data['email'])) {
            $email = trim($data['email']);
            if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Response::error('Please enter a valid email address.', 400);
            }
            $updateData['email'] = $email;
        }
        if (isset($data['phone'])) {
            $updateData['phone'] = trim($data['phone']);
        }

        // Only admins can change their username
        if (isset($data['username']) && in_array($currentUser['role'] ?? '', ['superadmin', 'admin'])) {
            $newUsername = trim($data['username']);
            if (!empty($newUsername) && strtolower($newUsername) !== strtolower($currentUser['username'] ?? '')) {
                $conflict = User::findByUsername($newUsername);
                if ($conflict && (int)$conflict['id'] !== $userId) {
                    Response::error("Username '{$newUsername}' is already taken.", 409);
                }
                $updateData['username'] = $newUsername;
            }
        }

        if (empty($updateData)) {
            Response::error('No valid fields provided to update.', 400);
        }

        $updated = User::update($userId, $updateData);
        if (!$updated) {
            Response::error('Failed to update profile details.', 500);
        }

        unset($updated['password_hash']);
        Response::json($updated, 200, 'Profile details updated successfully');
    }

    public function resetPassword(array $data): void {
        $currentUser = Auth::getCurrentUser();
        $userId = (int)$currentUser['id'];

        $currentPassword = $data['current_password'] ?? '';
        $newPassword = $data['new_password'] ?? '';
        $confirmPassword = $data['confirm_password'] ?? '';

        if (empty($newPassword)) {
            Response::error('New password cannot be empty.', 400);
        }

        if (strlen($newPassword) < 6) {
            Response::error('New password must be at least 6 characters in length.', 400);
        }

        if ($newPassword !== $confirmPassword) {
            Response::error('New password and confirmation password do not match.', 400);
        }

        // Verify current password
        if (!User::verifyPassword($userId, $currentPassword)) {
            Response::error('Current password is incorrect.', 401);
        }

        $success = User::resetPassword($userId, $newPassword);
        if (!$success) {
            Response::error('Failed to update password. Please try again.', 500);
        }

        Response::json(null, 200, 'Your password has been successfully reset and updated.');
    }
}
