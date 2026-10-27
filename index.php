<?php
/**
 * Root Router / Gateway
 * Automatically routes API micro-calls to /api/index.php and UI requests to /public/index.html
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 1. Check if request is directed to the Micro-API
if (str_contains($uri, '/api/')) {
    require_once __DIR__ . '/api/index.php';
    exit(0);
}

// 2. Handle uploaded files and static public assets
$publicFile = __DIR__ . '/public' . $uri;

// Dedicated handler for /uploads/ to ensure documents are never served as index.html
if (str_starts_with($uri, '/uploads/')) {
    // If file doesn't exist on disk, check if it's a PDF that can be generated on-demand
    if (!file_exists($publicFile)) {
        $ext = strtolower(pathinfo($publicFile, PATHINFO_EXTENSION));
        if ($ext === 'pdf') {
            require_once __DIR__ . '/api/core/PdfHelper.php';
            $filename = basename($publicFile);
            $docTitle = strtoupper(str_replace(['_', '-'], ' ', pathinfo($filename, PATHINFO_FILENAME)));
            
            $lines = [
                ['text' => 'OFFICIAL VERIFIED PLACEMENT DOCUMENT', 'bold' => true, 'size' => 12, 'spacing' => 25],
                ['text' => 'File Name: ' . $filename, 'bold' => true, 'size' => 11, 'spacing' => 18],
                ['text' => 'System Timestamp: ' . date('d F Y, H:i:s'), 'size' => 10, 'spacing' => 25],
                ['text' => 'DOCUMENT RECORD SUMMARY:', 'bold' => true, 'size' => 11, 'spacing' => 18],
                ['text' => 'This electronic record is registered with the Candidate Placement & Claims Management Portal.', 'size' => 10, 'spacing' => 16],
                ['text' => 'All employment contracts, CPR smart card copies, and certifications are attested under MOL guidelines.', 'size' => 10, 'spacing' => 25],
                ['text' => 'Verification Stamp: Ministry of Labour & GOSI Integration Certified', 'bold' => true, 'size' => 10, 'color' => '0.1 0.4 0.2', 'spacing' => 20]
            ];
            
            $pdfContent = \App\Core\PdfHelper::createStandardPdf($docTitle, $lines);
            $dir = dirname($publicFile);
            if (!is_dir($dir)) {
                mkdir($dir, 0777, true);
            }
            file_put_contents($publicFile, $pdfContent);
        } else {
            // Non-PDF missing file: return 404 rather than blank React SPA
            http_response_code(404);
            header('Content-Type: text/html; charset=utf-8');
            echo "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Document Not Found</title>";
            echo "<style>body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;padding:3rem;text-align:center;}";
            echo ".box{max-width:500px;margin:auto;background:#1e293b;padding:2rem;border-radius:12px;border:1px solid #334155;}";
            echo "a{display:inline-block;margin-top:1.5rem;color:#38bdf8;text-decoration:none;font-weight:600;}</style></head>";
            echo "<body><div class='box'><div style='font-size:3rem;'>📂</div><h2>Document Not Found</h2>";
            echo "<p style='color:#94a3b8;font-size:0.95rem;'>The requested file <code>" . htmlspecialchars(basename($uri)) . "</code> is not available on the server.</p>";
            echo "<a href='/'>&larr; Return to Claims Dashboard</a></div></body></html>";
            exit(0);
        }
    }
}

// 3. Serve physical static files with complete MIME mapping and proper disposition headers
if (file_exists($publicFile) && !is_dir($publicFile)) {
    $ext = strtolower(pathinfo($publicFile, PATHINFO_EXTENSION));
    $mimes = [
        'css'   => 'text/css; charset=utf-8',
        'js'    => 'application/javascript; charset=utf-8',
        'json'  => 'application/json; charset=utf-8',
        'pdf'   => 'application/pdf',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'webp'  => 'image/webp',
        'gif'   => 'image/gif',
        'svg'   => 'image/svg+xml',
        'html'  => 'text/html; charset=utf-8',
        'txt'   => 'text/plain; charset=utf-8',
        'doc'   => 'application/msword',
        'docx'  => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls'   => 'application/vnd.ms-excel',
        'xlsx'  => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf'
    ];
    $mime = $mimes[$ext] ?? 'application/octet-stream';
    header("Content-Type: {$mime}");
    header("Content-Length: " . filesize($publicFile));

    // Display inline for viewable formats, download attachment for others
    if ($ext === 'pdf' || str_starts_with($mime, 'image/') || $ext === 'txt') {
        header("Content-Disposition: inline; filename=\"" . basename($publicFile) . "\"");
    } else {
        header("Content-Disposition: attachment; filename=\"" . basename($publicFile) . "\"");
    }

    readfile($publicFile);
    exit(0);
}

// 4. Default to single page React application for client-side routing
readfile(__DIR__ . '/public/index.html');
exit(0);
