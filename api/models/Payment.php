<?php
/**
 * Payment Collection & Financial Ledger Model
 */

namespace App\Models;

use App\Config\Database;

class Payment {
    public static function all(?string $caseManagerScope = null): array {
        $store = Database::getStore();
        $payments = $store['payments'] ?? [];
        $claims = array_column($store['claims'] ?? [], null, 'id');
        $candidates = array_column($store['candidates'] ?? [], null, 'id');

        $result = [];
        foreach ($payments as $p) {
            $claim = $claims[$p['claim_id']] ?? null;
            if (!$claim) continue;

            if ($caseManagerScope !== null && $caseManagerScope !== '') {
                if (strcasecmp($claim['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    continue;
                }
            }

            $cand = $candidates[$claim['candidate_id']] ?? null;

            $p['claim_ref'] = $claim['claim_ref'];
            $p['claim_type'] = $claim['claim_type'];
            $p['total_claim_amount_bhd'] = (float)$claim['claim_amount_bhd'];
            $p['case_manager_name'] = $claim['case_manager_name'];
            $p['candidate_name'] = $cand['full_name'] ?? 'N/A';
            $p['candidate_cpr'] = $cand['cpr_no'] ?? 'N/A';
            $p['company_name'] = $cand['company_name'] ?? 'N/A';

            $result[] = $p;
        }

        // Sort by payment_date descending
        usort($result, fn($a, $b) => strcmp($b['payment_date'], $a['payment_date']));
        return $result;
    }

    public static function recordPayment(array $data, array $currentUser): array {
        $store = Database::getStore();
        $id = count($store['payments']) > 0 ? max(array_column($store['payments'], 'id')) + 1 : 1;
        $claimId = (int)($data['claim_id'] ?? 0);

        $receiptNo = !empty($data['receipt_no']) ? trim($data['receipt_no']) : ('RCPT-' . date('Y') . '-' . str_pad($id, 4, '0', STR_PAD_LEFT));
        $amountPaid = (float)($data['amount_paid_bhd'] ?? 0.0);

        $newPayment = [
            'id'               => $id,
            'receipt_no'       => $receiptNo,
            'claim_id'         => $claimId,
            'payment_date'     => !empty($data['payment_date']) ? $data['payment_date'] : date('Y-m-d'),
            'amount_paid_bhd'  => $amountPaid,
            'payment_method'   => $data['payment_method'] ?? 'Bank Transfer',
            'reference_doc_no' => trim($data['reference_doc_no'] ?? ''),
            'cashier_notes'    => trim($data['cashier_notes'] ?? 'Installment payment collected'),
            'created_by'       => $currentUser['id'],
            'created_at'       => date('Y-m-d H:i:s')
        ];

        $store['payments'][] = $newPayment;

        // Check if claim is now fully paid
        $totalPaid = 0.0;
        foreach ($store['payments'] as $p) {
            if ((int)$p['claim_id'] === $claimId) {
                $totalPaid += (float)$p['amount_paid_bhd'];
            }
        }

        foreach ($store['claims'] as &$c) {
            if ((int)$c['id'] === $claimId) {
                if ($totalPaid >= (float)$c['claim_amount_bhd'] && $c['status'] === 'undisputed') {
                    $c['status'] = 'settled';
                }
                break;
            }
        }

        // Audit log
        $store['audit_logs'][] = [
            'id' => count($store['audit_logs']) + 1,
            'user_id' => $currentUser['id'],
            'username' => $currentUser['username'],
            'role' => $currentUser['role'],
            'action' => 'PAYMENT_RECORDED',
            'entity_type' => 'payment',
            'entity_id' => $id,
            'details' => "Recorded payment {$receiptNo} for BHD {$amountPaid} against Claim ID {$claimId}",
            'created_at' => date('Y-m-d H:i:s')
        ];

        Database::saveStore($store);
        return $newPayment;
    }
}
