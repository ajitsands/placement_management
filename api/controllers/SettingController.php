<?php
/**
 * Setting Controller - GCC Localization & System Configuration
 * Manages Timezone, Currency, Date/Time Formats with Bahrain defaults and GCC options.
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Setting;

class SettingController {
    public function index(array $data): void {
        $settings = Setting::all();
        Response::json($settings);
    }

    public function update(array $data): void {
        // Enforce Admin or Superadmin
        Auth::requireAdminOrSuperadmin();

        $user = Auth::getCurrentUser();
        $allowedKeys = [
            'app_name',
            'timezone',
            'currency',
            'currency_symbol',
            'date_format',
            'time_format',
            'locale',
            'default_country',
            'auto_calc_enabled',
            'theme_mode',
            'notification_email'
        ];

        $toUpdate = [];
        foreach ($allowedKeys as $key) {
            if (isset($data[$key])) {
                $toUpdate[$key] = trim((string)$data[$key]);
            }
        }

        if (empty($toUpdate)) {
            Response::error('No valid configuration fields provided for update', 400);
        }

        $updated = Setting::update($toUpdate, $user);
        Response::json($updated, 200, 'System GCC settings updated successfully');
    }
}
