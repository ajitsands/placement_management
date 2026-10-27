<?php
/**
 * Standardized JSON API Response Helper
 */

namespace App\Core;

class Response {
    public static function json(mixed $data = null, int $statusCode = 200, string $message = 'Success'): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-User-Role, X-User-Id');

        echo json_encode([
            'status'     => $statusCode >= 200 && $statusCode < 300 ? 'success' : 'error',
            'code'       => $statusCode,
            'message'    => $message,
            'data'       => $data,
            'timestamp'  => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    public static function error(string $message, int $statusCode = 400, mixed $errors = null): void {
        self::json(['errors' => $errors], $statusCode, $message);
    }

    public static function unauthorized(string $message = 'Authentication required'): void {
        self::error($message, 401);
    }

    public static function forbidden(string $message = 'Access forbidden: Insufficient permissions for this role'): void {
        self::error($message, 403);
    }

    public static function notFound(string $message = 'Requested resource not found'): void {
        self::error($message, 404);
    }
}
