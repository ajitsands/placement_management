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
        $milestones = array_column($store['milestones'] ?? [], null, 'id');

        $result = [];
        foreach ($payments as $p) {
            $claim = $claims[$p['claim_id']] ?? null;
            if (!$claim) continue;

            if ($caseManagerScope !== null && $caseManagerScope !== '') {
                if (strcasecmp($claim['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    continue;
                }
            }

            $candId = $claim['candidate_id'] ?? null;
            $cand = $candId ? ($candidates[$candId] ?? null) : null;
            $msId = $claim['milestone_id'] ?? null;
            $ms = $msId ? ($milestones[$msId] ?? null) : null;

            $p['claim_ref'] = $claim['claim_ref'];
            $p['claim_type'] = $claim['claim_type'];
            $p['total_claim_amount_bhd'] = (float)$claim['claim_amount_bhd'];
            $p['case_manager_name'] = $claim['case_manager_name'] ?? ($cand['case_manager_name'] ?? 'System');
            $p['candidate_id'] = $candId;
            $p['candidate_name'] = $cand['full_name'] ?? 'N/A';
            $p['candidate_cpr'] = $cand['cpr_no'] ?? 'N/A';
            $p['candidate_ref'] = $cand['ref_no'] ?? ($candId ? ('CR-' . str_pad($candId, 4, '0', STR_PAD_LEFT)) : 'N/A');
            $p['company_name'] = $cand['company_name'] ?? 'N/A';
            $p['employer_cr'] = $cand['employer_cr'] ?? ($claim['employer_cr'] ?? '');
            $p['milestone_id'] = $msId;
            $p['milestone_title'] = $ms['milestone_title'] ?? ($claim['milestone_title'] ?? 'Retention Gate');
            $p['milestone_code'] = $ms['milestone_code'] ?? ($claim['milestone_code'] ?? '');

            $result[] = $p;
        }

        // Sort by payment_date descending
        usort($result, fn($a, $b) => strcmp($b['payment_date'], $a['payment_date']));
        return $result;
    }

    public static function generateNextReceiptNo(): string {
        $store = Database::getStore();
        $year = date('Y');
        $existing = array_column($store['payments'] ?? [], 'receipt_no');

        $maxSeq = 0;
        foreach ($existing as $r) {
            if (preg_match('#^RCPT-' . $year . '-(\d+)$#i', (string)$r, $m)) {
                $num = (int)$m[1];
                if ($num > $maxSeq) {
                    $maxSeq = $num;
                }
            }
        }

        if ($maxSeq === 0) {
            $maxSeq = count($store['payments'] ?? []);
        }

        $nextSeq = $maxSeq + 1;
        return sprintf('RCPT-%s-%04d', $year, $nextSeq);
    }

    public static function recordPayment(array $data, array $currentUser): array {
        $store = Database::getStore();
        $id = count($store['payments']) > 0 ? max(array_column($store['payments'], 'id')) + 1 : 1;
        $claimId = (int)($data['claim_id'] ?? 0);

        $receiptNo = !empty($data['receipt_no'])
            ? trim($data['receipt_no'])
            : (!empty($data['receipt_reference'])
                ? trim($data['receipt_reference'])
                : self::generateNextReceiptNo());
        $amountPaid = (float)($data['amount_paid_bhd'] ?? 0.0);

        // Normalize payment method to database enum: 'Bank Transfer', 'Cheque', 'BenefitPay', 'Cash'
        $methodMap = [
            'bank_transfer' => 'Bank Transfer',
            'fawri'         => 'Bank Transfer',
            'fawri+'        => 'Bank Transfer',
            'online_portal' => 'Bank Transfer',
            'check'         => 'Cheque',
            'cheque'        => 'Cheque',
            'benefitpay'    => 'BenefitPay',
            'cash'          => 'Cash'
        ];
        $rawMethod = strtolower(trim((string)($data['payment_method'] ?? 'Bank Transfer')));
        $cleanMethod = str_replace([' ', '-', '+', '_'], '', $rawMethod);
        $paymentMethod = $methodMap[$rawMethod] ?? ($methodMap[$cleanMethod] ?? ($data['payment_method'] ?? 'Bank Transfer'));

        // Process attachments (multiple files with notes)
        $processedAttachments = [];
        $uploadDir = dirname(__DIR__, 2) . '/public/uploads/payments/';
        if (!empty($data['attachments']) && is_array($data['attachments'])) {
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            foreach ($data['attachments'] as $att) {
                $fileUrl = $att['file_url'] ?? '';
                $fileName = $att['file_name'] ?? 'receipt_doc';
                $notes = trim($att['notes'] ?? '');
                $name = trim($att['name'] ?? $fileName);
                $fileSize = (int)($att['file_size'] ?? 0);

                // If file_data base64 was passed inline
                if (!empty($att['file_data']) && empty($fileUrl)) {
                    $origName = basename($fileName);
                    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
                    if (!$ext) $ext = 'pdf';
                    $safeName = 'receipt_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                    $raw = $att['file_data'];
                    if (str_contains($raw, ',')) {
                        $raw = explode(',', $raw)[1];
                    }
                    $dec = base64_decode($raw);
                    if ($dec !== false && file_put_contents($uploadDir . $safeName, $dec) !== false) {
                        $fileUrl = 'uploads/payments/' . $safeName;
                        $fileSize = strlen($dec);
                    }
                }

                $processedAttachments[] = [
                    'id'          => $att['id'] ?? ('ATT-' . time() . '-' . rand(100, 999)),
                    'name'        => $name,
                    'notes'       => $notes,
                    'file_name'   => $fileName,
                    'file_size'   => $fileSize,
                    'file_url'    => $fileUrl,
                    'uploaded_at' => $att['uploaded_at'] ?? date('Y-m-d H:i:s')
                ];
            }
        }

        $newPayment = [
            'id'               => $id,
            'receipt_no'       => $receiptNo,
            'claim_id'         => $claimId,
            'payment_date'     => !empty($data['payment_date']) ? $data['payment_date'] : date('Y-m-d'),
            'amount_paid_bhd'  => $amountPaid,
            'payment_method'   => $paymentMethod,
            'reference_doc_no' => trim($data['reference_doc_no'] ?? ($data['receipt_reference'] ?? '')),
            'cashier_notes'    => trim($data['cashier_notes'] ?? ($data['notes'] ?? 'Installment payment collected')),
            'attachments'      => $processedAttachments,
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
