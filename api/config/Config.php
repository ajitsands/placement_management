<?php
/**
 * Configuration & Localization for GCC & Bahrain
 * Candidate Placement & Claims Management System
 */

namespace App\Config;

class Config {
    private static bool $envLoaded = false;

    // Database Credentials (Default Fallbacks for Localhost & Server)
    public const DB_HOST = '127.0.0.1';
    public const DB_PORT = '3306';
    public const DB_NAME = 'teamtoob_hr_db';
    public const DB_USER = 'teamtoob_hr_user';
    public const DB_PASS = 'S@nds1@b';

    /**
     * Load .env file from project root or current directory
     */
    public static function loadEnv(): void {
        if (self::$envLoaded) return;
        self::$envLoaded = true;

        $paths = [
            __DIR__ . '/../../.env',
            __DIR__ . '/../.env',
            __DIR__ . '/.env',
            dirname(__DIR__, 2) . '/.env'
        ];

        foreach ($paths as $path) {
            if (file_exists($path) && is_readable($path)) {
                $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || str_starts_with($line, '#')) continue;
                    if (str_contains($line, '=')) {
                        [$name, $value] = explode('=', $line, 2);
                        $name = trim($name);
                        $value = trim($value);
                        // Strip quotes if present
                        if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                            (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                            $value = substr($value, 1, -1);
                        }
                        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
                            putenv("{$name}={$value}");
                            $_ENV[$name] = $value;
                            $_SERVER[$name] = $value;
                        }
                    }
                }
                break;
            }
        }
    }

    /**
     * Get environment variable with fallback
     */
    public static function env(string $key, mixed $default = null): mixed {
        self::loadEnv();
        $val = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        return ($val !== false && $val !== null) ? $val : $default;
    }

    // Dynamic Database Getters (Supporting both localhost & server deployment)
    public static function getDbHost(): string { return (string) self::env('DB_HOST', self::DB_HOST); }
    public static function getDbPort(): string { return (string) self::env('DB_PORT', self::DB_PORT); }
    public static function getDbName(): string { return (string) self::env('DB_NAME', self::DB_NAME); }
    public static function getDbUser(): string { return (string) self::env('DB_USER', self::DB_USER); }
    public static function getDbPass(): string { return (string) self::env('DB_PASS', self::DB_PASS); }
    public static function getAppEnv(): string { return (string) self::env('APP_ENV', 'local'); }

    // Default Localization (Bahrain & GCC)
    public const DEFAULT_TIMEZONE = 'Asia/Bahrain';
    public const DEFAULT_CURRENCY = 'BHD';
    public const DEFAULT_CURRENCY_SYMBOL = 'BD';
    public const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';
    public const DEFAULT_TIME_FORMAT = '12h';

    // GCC Timezones
    public static array $supportedTimezones = [
        'Asia/Bahrain' => ['name' => 'Bahrain (GMT+3)', 'offset' => '+03:00'],
        'Asia/Riyadh'  => ['name' => 'Saudi Arabia - Riyadh (GMT+3)', 'offset' => '+03:00'],
        'Asia/Dubai'   => ['name' => 'United Arab Emirates - Dubai (GMT+4)', 'offset' => '+04:00'],
        'Asia/Qatar'   => ['name' => 'Qatar - Doha (GMT+3)', 'offset' => '+03:00'],
        'Asia/Kuwait'  => ['name' => 'Kuwait (GMT+3)', 'offset' => '+03:00'],
        'Asia/Muscat'  => ['name' => 'Oman - Muscat (GMT+4)', 'offset' => '+04:00'],
    ];

    // GCC Currencies
    public static array $supportedCurrencies = [
        'BHD' => ['name' => 'Bahraini Dinar (BHD)', 'symbol' => 'BD', 'decimals' => 3],
        'SAR' => ['name' => 'Saudi Riyal (SAR)', 'symbol' => 'SR', 'decimals' => 2],
        'AED' => ['name' => 'UAE Dirham (AED)', 'symbol' => 'AED', 'decimals' => 2],
        'QAR' => ['name' => 'Qatari Riyal (QAR)', 'symbol' => 'QR', 'decimals' => 2],
        'KWD' => ['name' => 'Kuwaiti Dinar (KWD)', 'symbol' => 'KD', 'decimals' => 3],
        'OMR' => ['name' => 'Omani Rial (OMR)', 'symbol' => 'RO', 'decimals' => 3],
    ];

    // Supported Date & Time Formats
    public static array $dateFormats = [
        'DD MMM YYYY'  => 'd M Y (e.g. 15 Aug 2026)',
        'DD/MM/YYYY'   => 'd/m/Y (e.g. 25/10/2026)',
        'YYYY-MM-DD'   => 'Y-m-d (e.g. 2026-10-25)',
        'DD-MMM-YYYY'  => 'd-M-Y (e.g. 25-Oct-2026)',
        'MM/DD/YYYY'   => 'm/d/Y (e.g. 10/25/2026)'
    ];

    public static array $timeFormats = [
        '12h' => '12-Hour (02:30 PM)',
        '24h' => '24-Hour (14:30)'
    ];

    // System Roles
    public const ROLE_SUPERADMIN = 'superadmin';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_CASE_MANAGER = 'case_manager';
}
