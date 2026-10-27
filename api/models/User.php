<?php
/**
 * User & RBAC Model
 */

namespace App\Models;

use App\Config\Database;

class User {
    public static function all(): array {
        $store = Database::getStore();
        return array_map(function($u) {
            unset($u['password_hash']);
            return $u;
        }, $store['users'] ?? []);
    }

    public static function find(int $id): ?array {
        $users = self::all();
        foreach ($users as $u) {
            if ((int)$u['id'] === $id) return $u;
        }
        return null;
    }

    public static function findByUsername(string $username): ?array {
        $store = Database::getStore();
        foreach ($store['users'] ?? [] as $u) {
            if (strtolower($u['username']) === strtolower($username)) {
                return $u;
            }
        }
        return null;
    }

    public static function create(array $data): array {
        $store = Database::getStore();
        $id = count($store['users']) > 0 ? max(array_column($store['users'], 'id')) + 1 : 1;

        $newUser = [
            'id'                => $id,
            'username'          => trim($data['username'] ?? ''),
            'email'             => trim($data['email'] ?? ''),
            'password_hash'     => password_hash($data['password'] ?? 'password123', PASSWORD_BCRYPT),
            'full_name'         => trim($data['full_name'] ?? ''),
            'role'              => in_array($data['role'] ?? '', ['superadmin', 'admin', 'case_manager']) ? $data['role'] : 'case_manager',
            'case_manager_code' => !empty($data['case_manager_code']) ? trim($data['case_manager_code']) : trim($data['full_name'] ?? ''),
            'phone'             => trim($data['phone'] ?? ''),
            'is_active'         => isset($data['is_active']) ? (int)$data['is_active'] : 1,
            'created_at'        => date('Y-m-d H:i:s')
        ];

        $store['users'][] = $newUser;
        Database::saveStore($store);

        unset($newUser['password_hash']);
        return $newUser;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        foreach ($store['users'] as &$u) {
            if ((int)$u['id'] === $id) {
                if (isset($data['username']) && !empty(trim($data['username']))) {
                    $u['username'] = trim($data['username']);
                }
                if (isset($data['full_name']) && !empty(trim($data['full_name']))) {
                    $u['full_name'] = trim($data['full_name']);
                }
                if (isset($data['email'])) {
                    $u['email'] = trim($data['email']);
                }
                if (isset($data['role']) && in_array($data['role'], ['superadmin', 'admin', 'case_manager'])) {
                    $u['role'] = $data['role'];
                }
                if (array_key_exists('case_manager_code', $data)) {
                    $cmCode = trim($data['case_manager_code'] ?? '');
                    if ($u['role'] === 'case_manager') {
                        $u['case_manager_code'] = !empty($cmCode) ? $cmCode : trim($u['full_name']);
                    } else {
                        $u['case_manager_code'] = !empty($cmCode) ? $cmCode : null;
                    }
                }
                if (isset($data['phone'])) {
                    $u['phone'] = trim($data['phone']);
                }
                if (isset($data['is_active'])) {
                    $u['is_active'] = (int)$data['is_active'];
                }
                if (!empty($data['password'])) {
                    $u['password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
                }
                Database::saveStore($store);
                $res = $u;
                unset($res['password_hash']);
                return $res;
            }
        }
        return null;
    }

    public static function getCaseManagers(): array {
        $users = self::all();
        return array_values(array_filter($users, fn($u) => $u['role'] === 'case_manager'));
    }

    public static function getRawUser(int $id): ?array {
        $store = Database::getStore();
        foreach ($store['users'] ?? [] as $u) {
            if ((int)$u['id'] === $id) return $u;
        }
        return null;
    }

    public static function verifyPassword(int $userId, string $password): bool {
        $user = self::getRawUser($userId);
        if (!$user) return false;
        if (empty($user['password_hash'])) return true;
        if (password_verify($password, $user['password_hash'])) return true;
        // Demo passwords allowed
        if ($password === 'admin123' || $password === 'password123') return true;
        return false;
    }

    public static function resetPassword(int $userId, string $newPassword): bool {
        $updated = self::update($userId, ['password' => $newPassword]);
        return $updated !== null;
    }
}
