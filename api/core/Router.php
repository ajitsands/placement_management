<?php
/**
 * Lightweight Micro-API REST Router
 */

namespace App\Core;

class Router {
    private array $routes = [];

    public function get(string $path, callable|array $handler): void {
        $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable|array $handler): void {
        $this->addRoute('POST', $path, $handler);
    }

    public function put(string $path, callable|array $handler): void {
        $this->addRoute('PUT', $path, $handler);
    }

    public function delete(string $path, callable|array $handler): void {
        $this->addRoute('DELETE', $path, $handler);
    }

    private function addRoute(string $method, string $path, callable|array $handler): void {
        $this->routes[] = [
            'method'  => $method,
            'path'    => $path,
            'pattern' => $this->compilePattern($path),
            'handler' => $handler
        ];
    }

    private function compilePattern(string $path): string {
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $path);
        return '#^' . $pattern . '$#';
    }

    public function dispatch(): void {
        // Handle preflight OPTIONS request
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-User-Role, X-User-Id');
            http_response_code(200);
            exit(0);
        }

        $method = $_SERVER['REQUEST_METHOD'];
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        // Normalize base URI to match routes relative to /api or /api/v1
        $basePrefixes = ['/api/v1', '/api', '/Claims/api/v1', '/Claims/api'];
        foreach ($basePrefixes as $prefix) {
            if (str_starts_with($uri, $prefix)) {
                $uri = substr($uri, strlen($prefix));
                break;
            }
        }
        $uri = '/' . trim($uri, '/');
        if ($uri === '//') $uri = '/';

        // Parse JSON input payload if present
        $rawInput = file_get_contents('php://input');
        $jsonInput = !empty($rawInput) ? json_decode($rawInput, true) : [];
        if (!is_array($jsonInput)) $jsonInput = [];
        $requestData = array_merge($_GET, $_POST, $jsonInput);

        foreach ($this->routes as $route) {
            if ($route['method'] === $method && preg_match($route['pattern'], $uri, $matches)) {
                $params = [];
                foreach ($matches as $key => $val) {
                    if (is_string($key)) {
                        $params[$key] = $val;
                    }
                }

                $handler = $route['handler'];
                if (is_array($handler)) {
                    [$class, $action] = $handler;
                    $controller = new $class();
                    $controller->$action($requestData, $params);
                    return;
                } elseif (is_callable($handler)) {
                    $handler($requestData, $params);
                    return;
                }
            }
        }

        Response::notFound("Endpoint {$method} {$uri} not found on Micro API");
    }
}
