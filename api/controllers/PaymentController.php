<?php
/**
 * Payment Controller - Financial Collection Ledger & Receipts
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Payment;
use App\Models\Claim;

class PaymentController {
    public function index(array $data): void {
        $scope = Auth::getScopedCaseManagerName();
        if ($scope === null && !empty($data['case_manager'])) {
            $scope = trim($data['case_manager']);
        }

        $payments = Payment::all($scope);
        $totalCollected = array_sum(array_column($payments, 'amount_paid_bhd'));

        Response::json([
            'count' => count($payments),
            'total_collected_bhd' => $totalCollected,
            'scoped_case_manager' => $scope,
            'payments' => $payments
        ]);
    }

    public function nextRef(): void {
        $nextRef = Payment::generateNextReceiptNo();
        Response::json(['next_receipt_no' => $nextRef]);
    }

    public function create(array $data): void {
        $user = Auth::getCurrentUser();
        $claimId = (int)($data['claim_id'] ?? 0);
        $amount = (float)($data['amount_paid_bhd'] ?? 0.0);

        if ($claimId <= 0 || $amount <= 0.0) {
            Response::error('Valid Claim ID and Payment Amount (BHD) are required', 400);
        }

        $claim = Claim::find($claimId);
        if (!$claim) {
            Response::notFound("Claim record with ID {$claimId} not found");
        }

        $payment = Payment::recordPayment($data, $user);
        Response::json($payment, 201, "Payment of BHD {$amount} recorded with receipt {$payment['receipt_no']}");
    }

    public function uploadAttachment(array $data): void {
        $uploadDir = dirname(__DIR__, 2) . '/public/uploads/payments/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $docName = trim($data['name'] ?? 'Payment Receipt Voucher');
        $docNotes = trim($data['notes'] ?? '');
        $fileName = '';
        $fileSize = 0;
        $fileUrl = '';

        if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $origName = basename($_FILES['file']['name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'xlsx'];
            if (!in_array($ext, $allowedExts)) {
                Response::error('Invalid file format. Allowed: PDF, PNG, JPG, JPEG, DOCX, XLSX, TXT', 400);
            }

            $safeName = 'receipt_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $targetPath = $uploadDir . $safeName;

            if (move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
                $fileName = $origName;
                $fileSize = filesize($targetPath);
                $fileUrl = 'uploads/payments/' . $safeName;
            } else {
                Response::error('Failed to save uploaded file to storage directory', 500);
            }
        } elseif (!empty($data['file_data']) && !empty($data['file_name'])) {
            $origName = basename($data['file_name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'xlsx'];
            if (!in_array($ext, $allowedExts)) {
                Response::error('Invalid file format. Allowed: PDF, PNG, JPG, JPEG, DOCX, XLSX, TXT', 400);
            }

            $rawBase64 = $data['file_data'];
            if (str_contains($rawBase64, ',')) {
                $rawBase64 = explode(',', $rawBase64)[1];
            }

            $decoded = base64_decode($rawBase64);
            if ($decoded === false) {
                Response::error('Failed to decode base64 file data', 400);
            }

            $safeName = 'receipt_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $targetPath = $uploadDir . $safeName;

            if (file_put_contents($targetPath, $decoded) !== false) {
                $fileName = $origName;
                $fileSize = strlen($decoded);
                $fileUrl = 'uploads/payments/' . $safeName;
            } else {
                Response::error('Failed to write decoded file to disk', 500);
            }
        } else {
            Response::error('No file data provided in request', 400);
        }

        $attachment = [
            'id'          => 'ATT-' . time() . '-' . rand(100, 999),
            'name'        => !empty($docName) ? $docName : $fileName,
            'notes'       => $docNotes,
            'file_name'   => $fileName,
            'file_size'   => $fileSize,
            'file_url'    => $fileUrl,
            'uploaded_at' => date('Y-m-d H:i:s')
        ];

        Response::json($attachment, 201, "Receipt attachment uploaded successfully");
    }
}
