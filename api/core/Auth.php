<?php
/**
 * Authentication & Role-Based Access Control (RBAC) Helper
 */

namespace App\Core;

use App\Config\Database;

class Auth {
    private static ?array $currentUser = null;

    public static function getCurrentUser(): array {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }

        // 1. Check custom headers (X-User-Id, X-User-Role) for micro-API client flexibility
        $headers = getallheaders();
        $headerUserId = $headers['X-User-Id'] ?? $_SERVER['HTTP_X_USER_ID'] ?? null;
        $headerRole = $headers['X-User-Role'] ?? $_SERVER['HTTP_X_USER_ROLE'] ?? null;

        $store = Database::getStore();
        $users = $store['users'] ?? [];

        if ($headerUserId) {
            foreach ($users as $u) {
                if ((int)$u['id'] === (int)$headerUserId) {
                    self::$currentUser = $u;
                    return self::$currentUser;
                }
            }
        }

        if ($headerRole) {
            foreach ($users as $u) {
                if ($u['role'] === $headerRole) {
                    self::$currentUser = $u;
                    return self::$currentUser;
                }
            }
        }

        // 2. Check PHP Session
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        if (!empty($_SESSION['user_id'])) {
            foreach ($users as $u) {
                if ((int)$u['id'] === (int)$_SESSION['user_id']) {
                    self::$currentUser = $u;
                    return self::$currentUser;
                }
            }
        }

        // Default to Superadmin for initial bootstrap/demo if unauthenticated
        self::$currentUser = $users[0] ?? [
            'id' => 1,
            'username' => 'superadmin',
            'full_name' => 'Dr. Salman (Super Admin)',
            'role' => 'superadmin',
            'case_manager_code' => null
        ];

        return self::$currentUser;
    }

    public static function requireAdminOrSuperadmin(): void {
        $user = self::getCurrentUser();
        if ($user['role'] !== 'superadmin' && $user['role'] !== 'admin') {
            Response::forbidden('Only Administrator or Superadmin can perform this action.');
        }
    }

    public static function requireSuperadmin(): void {
        $user = self::getCurrentUser();
        if ($user['role'] !== 'superadmin') {
            Response::forbidden('Superadmin access required.');
        }
    }

    /**
     * Determines whether transaction queries should be filtered to a specific Case Manager.
     * Returns the case manager name string if scoped, or null if Admin/Superadmin (global access).
     */
    public static function getScopedCaseManagerName(): ?string {
        $user = self::getCurrentUser();
        if ($user['role'] === 'case_manager') {
            return $user['case_manager_code'] ?? $user['full_name'];
        }
        return null; // Admins and Superadmins handle ALL transactions by default
    }
}
