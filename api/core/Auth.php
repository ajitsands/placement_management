<?php
/**
 * Authentication & Role-Based Access Control (RBAC) Helper
 */

namespace App\Core;

use App\Config\Database;

class Auth {
    private static ?array $currentUser = null;

    public static function user(): array {
        return self::getCurrentUser(true) ?? [];
    }

    public static function setCurrentUser(?array $user): void {
        self::$currentUser = $user;
    }

    public static function getCurrentUser(bool $fallbackToDefault = true): ?array {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }

        $store = Database::getStore();
        $users = $store['users'] ?? [];

        // 1. Authoritative check: Active PHP Session
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        if (!empty($_SESSION['user_id'])) {
            foreach ($users as $u) {
                if ((int)$u['id'] === (int)$_SESSION['user_id']) {
                    if (!isset($u['is_active']) || (int)$u['is_active'] === 1) {
                        self::$currentUser = $u;
                        return self::$currentUser;
                    }
                }
            }
        }

        // 2. Micro-API custom headers (X-User-Id, X-User-Role) for client flexibility
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $headerUserId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? $_SERVER['HTTP_X_USER_ID'] ?? null;
        $headerRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? $_SERVER['HTTP_X_USER_ROLE'] ?? null;

        if ($headerUserId) {
            foreach ($users as $u) {
                if ((int)$u['id'] === (int)$headerUserId) {
                    if (!isset($u['is_active']) || (int)$u['is_active'] === 1) {
                        self::$currentUser = $u;
                        if (session_status() === PHP_SESSION_NONE) {
                            @session_start();
                        }
                        $_SESSION['user_id'] = $u['id'];
                        $_SESSION['user_role'] = $u['role'];
                        return self::$currentUser;
                    }
                }
            }
        }

        if ($headerRole) {
            foreach ($users as $u) {
                if ($u['role'] === $headerRole) {
                    if (!isset($u['is_active']) || (int)$u['is_active'] === 1) {
                        self::$currentUser = $u;
                        return self::$currentUser;
                    }
                }
            }
        }

        // 3. Optional fallback for CLI scripts or headless tests
        if ($fallbackToDefault) {
            self::$currentUser = $users[0] ?? [
                'id' => 1,
                'username' => 'superadmin',
                'full_name' => 'Dr. Salman (Super Admin)',
                'role' => 'superadmin',
                'case_manager_code' => null
            ];
            return self::$currentUser;
        }

        return null;
    }

    public static function requireAdminOrSuperadmin(): void {
        $user = self::getCurrentUser();
        if (!$user || ($user['role'] !== 'superadmin' && $user['role'] !== 'admin')) {
            Response::forbidden('Only Administrator or Superadmin can perform this action.');
        }
    }

    public static function requireSuperadmin(): void {
        $user = self::getCurrentUser();
        if (!$user || $user['role'] !== 'superadmin') {
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
