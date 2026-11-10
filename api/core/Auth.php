<?php
/**
 * Authentication & Role-Based Access Control (RBAC) Helper
 */

namespace App\Core;

use App\Config\Database;

class Auth {
    private static ?array $currentUser = null;

    public static function user(): array {
        return self::getCurrentUser();
    }

    public static function getCurrentUser(): array {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }

        // 1. Check custom headers (X-User-Id, X-User-Role) for micro-API client flexibility
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $headerUserId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? $_SERVER['HTTP_X_USER_ID'] ?? null;
        $headerRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? $_SERVER['HTTP_X_USER_ROLE'] ?? null;

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
     * All Case Managers have full cross-collaboration access: they can register, place,
     * claim, collect payments, and see details of all others.
     * Query scoping returns null by default to allow universal visibility.
     */
    public static function getScopedCaseManagerName(): ?string {
        return null;
    }

    /**
     * Returns the active Case Manager name/code if the current logged-in identity is a case manager.
     */
    public static function getActiveCaseManagerName(): ?string {
        $user = self::getCurrentUser();
        if ($user['role'] === 'case_manager') {
            return $user['case_manager_code'] ?? $user['full_name'];
        }
        return null;
    }
}
