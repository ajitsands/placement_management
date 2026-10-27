<?php
/**
 * System Settings & GCC Localization Model
 */

namespace App\Models;

use App\Config\Database;
use App\Config\Config;

class Setting {
    public static function all(): array {
        $store = Database::getStore();
        $settings = $store['settings'] ?? [];

        // Attach GCC choices for frontend UI
        return [
            'values'              => $settings,
            'supportedTimezones'  => Config::$supportedTimezones,
            'supportedCurrencies' => Config::$supportedCurrencies,
            'dateFormats'         => Config::$dateFormats,
            'timeFormats'         => Config::$timeFormats,
            'databaseStatus'      => Database::getStatus()
        ];
    }

    public static function get(string $key, mixed $default = null): mixed {
        $store = Database::getStore();
        return $store['settings'][$key] ?? $default;
    }

    public static function update(array $newSettings, array $currentUser): array {
        $store = Database::getStore();
        if (!isset($store['settings'])) $store['settings'] = [];

        foreach ($newSettings as $k => $v) {
            $store['settings'][$k] = $v;
        }

        // Add audit log
        $store['audit_logs'][] = [
            'id' => count($store['audit_logs']) + 1,
            'user_id' => $currentUser['id'],
            'username' => $currentUser['username'],
            'role' => $currentUser['role'],
            'action' => 'SETTINGS_UPDATED',
            'entity_type' => 'settings',
            'entity_id' => null,
            'details' => 'Updated system localization and GCC operational settings',
            'created_at' => date('Y-m-d H:i:s')
        ];

        Database::saveStore($store);
        return self::all();
    }
}
