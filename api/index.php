<?php
/**
 * Candidate Placement & Claims Management System
 * RESTful Micro-API Gateway & Router Dispatcher
 * Strictly adhering to MVC Architecture (Model - View/API - Controller)
 */

declare(strict_types=1);

// Error reporting for robust API responses
error_reporting(E_ALL);
ini_set('display_errors', '0');

// Cross-Origin Resource Sharing (CORS) Headers for Micro API
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-User-Role, X-User-Id');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Autoloader for App\* namespace
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    // Convert namespace separators to directory separators
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    // Account for directory casing (core, config, models, controllers)
    $parts = explode('/', str_replace('\\', '/', $relativeClass));
    if (count($parts) >= 2) {
        $parts[0] = strtolower($parts[0]);
        $file = $baseDir . implode('/', $parts) . '.php';
    }

    if (file_exists($file)) {
        require_once $file;
    }
});

// Explicit requires to guarantee core and config load under all server configs
require_once __DIR__ . '/config/Config.php';
require_once __DIR__ . '/config/Database.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/core/Router.php';

require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Candidate.php';
require_once __DIR__ . '/models/Milestone.php';
require_once __DIR__ . '/models/Claim.php';
require_once __DIR__ . '/models/Dispute.php';
require_once __DIR__ . '/models/Payment.php';
require_once __DIR__ . '/models/Setting.php';
require_once __DIR__ . '/models/Report.php';
require_once __DIR__ . '/models/DocumentCategory.php';
require_once __DIR__ . '/models/AuditLog.php';
require_once __DIR__ . '/models/Event.php';

require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/CandidateController.php';
require_once __DIR__ . '/controllers/JobController.php';
require_once __DIR__ . '/controllers/MilestoneController.php';
require_once __DIR__ . '/controllers/ClaimController.php';
require_once __DIR__ . '/controllers/DisputeController.php';
require_once __DIR__ . '/controllers/PaymentController.php';
require_once __DIR__ . '/controllers/SettingController.php';
require_once __DIR__ . '/controllers/ReportController.php';
require_once __DIR__ . '/controllers/ChecklistMasterController.php';
require_once __DIR__ . '/controllers/DocumentCategoryController.php';
require_once __DIR__ . '/controllers/ActivityController.php';
require_once __DIR__ . '/controllers/EventController.php';

use App\Core\Router;
use App\Controllers\AuthController;
use App\Controllers\UserController;
use App\Controllers\CandidateController;
use App\Controllers\JobController;
use App\Controllers\MilestoneController;
use App\Controllers\ClaimController;
use App\Controllers\DisputeController;
use App\Controllers\PaymentController;
use App\Controllers\SettingController;
use App\Controllers\ReportController;
use App\Controllers\ChecklistMasterController;
use App\Controllers\DocumentCategoryController;
use App\Controllers\ActivityController;
use App\Controllers\EventController;

$router = new Router();

// ==================== AUTH & PROFILE MICRO ROUTES ====================
$router->post('/auth/login', [AuthController::class, 'login']);
$router->get('/auth/me', [AuthController::class, 'me']);
$router->post('/auth/switch', [AuthController::class, 'switchRole']);
$router->post('/auth/logout', [AuthController::class, 'logout']);
$router->get('/profile', [AuthController::class, 'profile']);
$router->put('/profile', [AuthController::class, 'updateProfile']);
$router->post('/profile', [AuthController::class, 'updateProfile']);
$router->post('/profile/password', [AuthController::class, 'resetPassword']);

// ==================== USER MANAGEMENT MICRO ROUTES (Only Admin/Superadmin) ====================
$router->get('/users', [UserController::class, 'index']);
$router->get('/users/{id}', [UserController::class, 'show']);
$router->post('/users', [UserController::class, 'create']);
$router->put('/users/{id}', [UserController::class, 'update']);
$router->post('/users/{id}', [UserController::class, 'update']);
$router->post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus']);
$router->get('/case-managers', [UserController::class, 'caseManagers']);

// ==================== CANDIDATE REGISTRY MICRO ROUTES (Scoped to Case Manager) ====================
$router->get('/candidates', [CandidateController::class, 'index']);
$router->get('/candidates/next-ref', [CandidateController::class, 'nextRef']);
$router->get('/candidates/{id}', [CandidateController::class, 'show']);
$router->post('/candidates/upload', [CandidateController::class, 'uploadDocument']);
$router->post('/candidates/batch-placement', [CandidateController::class, 'batchPlacement']);
$router->post('/placements/batch', [CandidateController::class, 'batchPlacement']);
$router->post('/candidates/{id}/placement', [CandidateController::class, 'linkPlacement']);
$router->post('/candidates/{id}/status', [CandidateController::class, 'updateStatus']);
$router->post('/candidates/{id}/checklist', [CandidateController::class, 'updateChecklist']);
$router->put('/candidates/{id}/checklist', [CandidateController::class, 'updateChecklist']);
$router->post('/candidates/{id}/documents', [CandidateController::class, 'addDocument']);
$router->delete('/candidates/{id}/documents/{docId}', [CandidateController::class, 'deleteDocument']);
$router->post('/candidates/{id}/renew', [CandidateController::class, 'renew']);
$router->get('/candidates/{id}/activities', [CandidateController::class, 'activities']);
$router->post('/candidates', [CandidateController::class, 'create']);
$router->put('/candidates/{id}', [CandidateController::class, 'update']);

// ==================== TRAINING & CAREER FAIR EVENTS MICRO ROUTES ====================
$router->get('/events', [EventController::class, 'index']);
$router->get('/events/next-code', [EventController::class, 'nextCode']);
$router->get('/events/{id}', [EventController::class, 'show']);
$router->post('/events', [EventController::class, 'create']);
$router->put('/events/{id}', [EventController::class, 'update']);
$router->post('/events/{id}', [EventController::class, 'update']);
$router->delete('/events/{id}', [EventController::class, 'delete']);
$router->get('/events/{id}/attendees', [EventController::class, 'attendees']);
$router->post('/events/{id}/attendees', [EventController::class, 'addAttendee']);
$router->delete('/events/{id}/attendees/{candidateId}', [EventController::class, 'removeAttendee']);
$router->put('/events/{id}/attendees/{candidateId}', [EventController::class, 'updateAttendee']);
$router->post('/events/{id}/attendees/{candidateId}', [EventController::class, 'updateAttendee']);

// ==================== EMPLOYER JOBS & VACANCIES MICRO ROUTES ====================
$router->get('/jobs', [JobController::class, 'index']);
$router->get('/jobs/next-code', [JobController::class, 'nextCode']);
$router->get('/jobs/{id}', [JobController::class, 'show']);
$router->post('/jobs', [JobController::class, 'create']);
$router->put('/jobs/{id}', [JobController::class, 'update']);
$router->post('/jobs/{id}', [JobController::class, 'update']);
$router->delete('/jobs/{id}', [JobController::class, 'delete']);

// ==================== RETENTION MILESTONE MICRO ROUTES (+0d, +180d, +365d) ====================
$router->get('/milestones', [MilestoneController::class, 'index']);
$router->get('/milestones/due', [MilestoneController::class, 'due']);
$router->put('/milestones/{id}', [MilestoneController::class, 'update']);

// ==================== CLAIM TRANSACTION MICRO ROUTES (Manual Amount Entry) ====================
$router->get('/claims', [ClaimController::class, 'index']);
$router->get('/claims/{id}', [ClaimController::class, 'show']);
$router->post('/claims', [ClaimController::class, 'create']);
$router->put('/claims/{id}', [ClaimController::class, 'update']);
$router->post('/claims/{id}', [ClaimController::class, 'update']);
$router->post('/claims/{id}/approve', [ClaimController::class, 'approve']);

// ==================== DISPUTE & TERMINATION MICRO ROUTES ====================
$router->get('/disputes', [DisputeController::class, 'index']);
$router->post('/disputes', [DisputeController::class, 'create']);
$router->post('/disputes/upload', [DisputeController::class, 'uploadAttachment']);
$router->put('/disputes/{id}', [DisputeController::class, 'update']);
$router->post('/disputes/{id}', [DisputeController::class, 'update']);
$router->get('/dispute-reasons', [DisputeController::class, 'getReasons']);
$router->post('/dispute-reasons', [DisputeController::class, 'addReason']);
$router->post('/disputes/{id}/reinstate', [DisputeController::class, 'reinstate']);
$router->post('/disputes/{id}/terminate', [DisputeController::class, 'terminate']);

// ==================== FINANCIAL PAYMENT LEDGER MICRO ROUTES ====================
$router->get('/payments/next-ref', [PaymentController::class, 'nextRef']);
$router->get('/payments', [PaymentController::class, 'index']);
$router->post('/payments/upload', [PaymentController::class, 'uploadAttachment']);
$router->post('/payments', [PaymentController::class, 'create']);

// ==================== GCC LOCALIZATION & SETTINGS MICRO ROUTES ====================
$router->get('/settings', [SettingController::class, 'index']);
$router->put('/settings', [SettingController::class, 'update']);
$router->post('/settings', [SettingController::class, 'update']);

// ==================== CANDIDATE REGISTRATION CHECKLIST MASTER ====================
$router->get('/checklist-master', [ChecklistMasterController::class, 'index']);
$router->post('/checklist-master/evaluate', [ChecklistMasterController::class, 'evaluate']);
$router->get('/checklist-master/{id}', [ChecklistMasterController::class, 'show']);
$router->post('/checklist-master', [ChecklistMasterController::class, 'create']);
$router->put('/checklist-master/{id}', [ChecklistMasterController::class, 'update']);
$router->post('/checklist-master/{id}', [ChecklistMasterController::class, 'update']);
$router->delete('/checklist-master/{id}', [ChecklistMasterController::class, 'delete']);

// ==================== CANDIDATE DOCUMENT CATEGORY MASTER ====================
$router->get('/document-categories', [DocumentCategoryController::class, 'index']);
$router->get('/document-categories/{id}', [DocumentCategoryController::class, 'show']);
$router->post('/document-categories', [DocumentCategoryController::class, 'create']);
$router->put('/document-categories/{id}', [DocumentCategoryController::class, 'update']);
$router->post('/document-categories/{id}', [DocumentCategoryController::class, 'update']);
$router->delete('/document-categories/{id}', [DocumentCategoryController::class, 'delete']);

// ==================== EXECUTIVE REPORTS & KPI MICRO ROUTES ====================
$router->get('/reports/kpis', [ReportController::class, 'kpis']);
$router->get('/reports', [ReportController::class, 'generate']);

// ==================== REAL-TIME ACTIVITIES & AUDIT LOGS ====================
$router->get('/activities', [ActivityController::class, 'index']);
$router->get('/audit-logs', [ActivityController::class, 'index']);

// Dispatch incoming request
$router->dispatch();
