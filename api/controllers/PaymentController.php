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

        $scope = Auth::getScopedCaseManagerName();
        if ($scope !== null && strcasecmp($claim['case_manager_name'] ?? '', $scope) !== 0) {
            Response::forbidden("Access restricted: Claim belongs to Case Manager '{$claim['case_manager_name']}'");
        }

        $payment = Payment::recordPayment($data, $user);
        Response::json($payment, 201, "Payment of BHD {$amount} recorded with receipt {$payment['receipt_no']}");
    }
}
