<?php
/**
 * Specialized Reports Engine (10 Enterprise Reports)
 */

namespace App\Models;

use App\Config\Database;

class Report {
    public static function getKPIs(?string $caseManagerScope = null): array {
        $candidates = Candidate::all($caseManagerScope);
        $milestones = Milestone::all($caseManagerScope);
        $claims = Claim::all($caseManagerScope);
        $disputes = Dispute::all($caseManagerScope);
        $payments = Payment::all($caseManagerScope);

        $totalPlacements = count($candidates);
        $dueMilestones = count(array_filter($milestones, fn($m) => in_array($m['current_status'], ['due', 'overdue'])));
        $totalClaimsCount = count($claims);

        $totalClaimedAmount = array_sum(array_column($claims, 'claim_amount_bhd'));
        $totalCollectedAmount = array_sum(array_column($payments, 'amount_paid_bhd'));
        $totalOutstandingBalance = max(0.0, $totalClaimedAmount - $totalCollectedAmount);

        $activeDisputesCount = count(array_filter($disputes, fn($d) => $d['status'] === 'active_dispute'));
        $terminatedClaimsCount = count(array_filter($claims, fn($c) => $c['status'] === 'terminated'));

        return [
            'total_placements'          => $totalPlacements,
            'due_milestones'            => $dueMilestones,
            'total_claims'              => $totalClaimsCount,
            'total_claimed_bhd'         => $totalClaimedAmount,
            'total_collected_bhd'       => $totalCollectedAmount,
            'total_outstanding_bhd'     => $totalOutstandingBalance,
            'active_disputes'           => $activeDisputesCount,
            'terminated_claims'         => $terminatedClaimsCount,
            'collection_rate_percent'   => $totalClaimedAmount > 0 ? round(($totalCollectedAmount / $totalClaimedAmount) * 100, 1) : 0
        ];
    }

    private static function inDateRange(?string $rawDate, ?string $dateFrom, ?string $dateTo): bool {
        if (empty($dateFrom) && empty($dateTo)) {
            return true;
        }
        $d = substr(trim((string)$rawDate), 0, 10);
        if ($d === '' || $d === '0000-00-00') {
            return false;
        }
        if (!empty($dateFrom) && $d < $dateFrom) {
            return false;
        }
        if (!empty($dateTo) && $d > $dateTo) {
            return false;
        }
        return true;
    }

    /**
     * Resolve claims with their point-in-time status, paid amount, and balance as of $dateTo (or current if null).
     * Ensures historical reports (e.g. Jan) show a claim as 'disputed' if it was disputed in Jan even if reinstated in Feb.
     */
    private static function resolveClaimsAsOf(?string $caseManagerScope, ?string $dateFrom, ?string $dateTo, bool $forOutstanding = false): array {
        $store = Database::getStore();
        $claims = Claim::all($caseManagerScope);
        $disputes = $store['disputes'] ?? [];
        $payments = $store['payments'] ?? [];

        $disputesByClaim = [];
        foreach ($disputes as $d) {
            $cid = (int)($d['claim_id'] ?? 0);
            if ($cid > 0) {
                $disputesByClaim[$cid][] = $d;
            }
        }

        $paymentsByClaim = [];
        foreach ($payments as $p) {
            $cid = (int)($p['claim_id'] ?? 0);
            if ($cid > 0) {
                $paymentsByClaim[$cid][] = $p;
            }
        }

        $asOf = !empty($dateTo) ? $dateTo : null;
        $result = [];

        foreach ($claims as $c) {
            $cid = (int)$c['id'];
            $claimDate = substr(trim((string)($c['claim_date'] ?? ($c['created_at'] ?? ''))), 0, 10);
            $createdDate = substr(trim((string)($c['created_at'] ?? $claimDate)), 0, 10);
            $earliestDate = ($createdDate !== '' && $createdDate !== '0000-00-00' && $claimDate !== '' && $createdDate < $claimDate)
                ? $createdDate
                : $claimDate;

            $cDisputes = $disputesByClaim[$cid] ?? [];

            // Check if claim existed on or before $asOf
            if ($asOf !== null && $earliestDate !== '' && $earliestDate > $asOf) {
                $hadDisputeByAsOf = false;
                foreach ($cDisputes as $d) {
                    $dDate = substr(trim((string)($d['dispute_date'] ?? ($d['created_at'] ?? ''))), 0, 10);
                    if ($dDate !== '' && $dDate <= $asOf) {
                        $hadDisputeByAsOf = true;
                        break;
                    }
                }
                if (!$hadDisputeByAsOf) {
                    continue;
                }
            }

            // Compute point-in-time status as of $asOf
            $statusAsOf = $c['status'] ?? 'undisputed';
            if ($asOf !== null) {
                $statusAsOf = 'undisputed';
                $relevantDisputes = [];
                foreach ($cDisputes as $d) {
                    $dDate = substr(trim((string)($d['dispute_date'] ?? ($d['created_at'] ?? ''))), 0, 10);
                    if ($dDate !== '' && $dDate <= $asOf) {
                        $relevantDisputes[] = $d;
                    }
                }

                if (!empty($relevantDisputes)) {
                    // Use the latest dispute filed on or before $asOf
                    usort($relevantDisputes, fn($a, $b) => strcmp(
                        ($b['dispute_date'] ?? '') . ($b['id'] ?? ''),
                        ($a['dispute_date'] ?? '') . ($a['id'] ?? '')
                    ));
                    $latestDisp = $relevantDisputes[0];
                    $reinstDate = substr(trim((string)($latestDisp['reinstated_date'] ?? '')), 0, 10);
                    $termDate = substr(trim((string)($latestDisp['terminated_date'] ?? '')), 0, 10);

                    if ($termDate !== '' && $termDate !== '0000-00-00' && $termDate <= $asOf) {
                        $statusAsOf = 'terminated';
                    } elseif ($reinstDate !== '' && $reinstDate !== '0000-00-00' && $reinstDate <= $asOf) {
                        $statusAsOf = 'undisputed';
                    } else {
                        $statusAsOf = 'disputed';
                    }
                } elseif (($c['status'] ?? '') === 'terminated') {
                    $statusAsOf = 'terminated';
                }
            }

            // Compute payments received on or before $asOf
            $paidAsOf = 0.0;
            foreach ($paymentsByClaim[$cid] ?? [] as $p) {
                $pDate = substr(trim((string)($p['payment_date'] ?? ($p['created_at'] ?? ''))), 0, 10);
                if ($asOf === null || ($pDate !== '' && $pDate <= $asOf)) {
                    $paidAsOf += (float)($p['amount_paid_bhd'] ?? 0);
                }
            }
            $claimAmt = (float)($c['claim_amount_bhd'] ?? 0);
            $balanceAsOf = max(0.0, round($claimAmt - $paidAsOf, 3));

            if ($statusAsOf === 'undisputed' && $balanceAsOf <= 0.0001 && $claimAmt > 0) {
                $statusAsOf = 'settled';
            }

            // Period inclusion check when $dateFrom is provided
            if (!empty($dateFrom) && !$forOutstanding) {
                $inPeriod = self::inDateRange($claimDate, $dateFrom, $dateTo)
                    || self::inDateRange($createdDate, $dateFrom, $dateTo)
                    || ($statusAsOf === 'disputed');
                if (!$inPeriod) {
                    continue;
                }
            } elseif (!empty($dateFrom) && $forOutstanding) {
                // For outstanding report with dateFrom..dateTo: include active unpaid claims that existed by $dateTo
                // and (if dateFrom is set) were active in or before the period
                if ($asOf !== null && $earliestDate !== '' && $earliestDate > $asOf) {
                    continue;
                }
            }

            $c['status'] = $statusAsOf;
            $c['total_paid_bhd'] = round($paidAsOf, 3);
            $c['balance_bhd'] = $balanceAsOf;
            $result[] = $c;
        }

        return $result;
    }

    public static function generate(string $type, ?string $caseManagerScope = null, ?string $dateFrom = null, ?string $dateTo = null): array {
        switch ($type) {
            case 'case_manager_audit_log':
                return [
                    'title' => 'Case Managers Operational Audit Log Report',
                    'data'  => AuditLog::getAuditReport($caseManagerScope, $dateFrom, $dateTo)
                ];
            case 'candidate_placement':
                return [
                    'title' => 'Candidate Placement Report',
                    'data'  => Candidate::all($caseManagerScope)
                ];

            case 'claim_milestones':
                return [
                    'title' => 'Claim Milestones (Day 0, 180, 365) Report',
                    'data'  => Milestone::all($caseManagerScope)
                ];

            case 'unclaimed_milestones':
                $all = Milestone::all($caseManagerScope);
                return [
                    'title' => 'Unclaimed Milestones Overdue Report',
                    'data'  => array_values(array_filter($all, fn($m) => in_array($m['current_status'], ['due', 'overdue'])))
                ];

            case 'claim_ledger':
            case 'claims_summary':
                return [
                    'title' => $type === 'claim_ledger'
                        ? 'Claim Ledger & Historical Status Report'
                        : 'Claims Summary & Status Pipeline Report',
                    'data'  => self::resolveClaimsAsOf($caseManagerScope, $dateFrom, $dateTo, false)
                ];

            case 'categorized_disputes':
            case 'disputed_claims':
                $allDisputes = Dispute::all($caseManagerScope);
                $asOf = !empty($dateTo) ? $dateTo : null;
                $filteredDisputes = [];
                foreach ($allDisputes as $d) {
                    $filedDate = $d['dispute_date'] ?? ($d['created_at'] ?? '');
                    if (!self::inDateRange($filedDate, $dateFrom, $dateTo)) {
                        continue;
                    }
                    if ($asOf !== null) {
                        $reinstDate = substr(trim((string)($d['reinstated_date'] ?? '')), 0, 10);
                        $termDate = substr(trim((string)($d['terminated_date'] ?? '')), 0, 10);
                        if ($termDate !== '' && $termDate !== '0000-00-00' && $termDate <= $asOf) {
                            $d['status'] = 'terminated';
                        } elseif ($reinstDate !== '' && $reinstDate !== '0000-00-00' && $reinstDate <= $asOf) {
                            $d['status'] = 'reinstated';
                        } else {
                            $d['status'] = 'active_dispute';
                        }
                    }
                    $filteredDisputes[] = $d;
                }
                return [
                    'title' => $type === 'categorized_disputes'
                        ? 'Categorized Disputes & Terminations Analysis'
                        : 'Disputed Claims Investigation Report',
                    'data'  => $filteredDisputes
                ];

            case 'terminated_claims':
                $claims = Claim::all($caseManagerScope);
                return [
                    'title' => 'Terminated Claims Audit Archive Report',
                    'data'  => array_values(array_filter($claims, fn($c) => $c['status'] === 'terminated'))
                ];

            case 'financial_collections':
            case 'payment_collection':
                $allPayments = Payment::all($caseManagerScope);
                $filteredPayments = array_values(array_filter($allPayments, function($p) use ($dateFrom, $dateTo) {
                    $pDate = $p['payment_date'] ?? ($p['created_at'] ?? '');
                    return self::inDateRange($pDate, $dateFrom, $dateTo);
                }));
                return [
                    'title' => 'Financial Collections Ledger & Receipts',
                    'data'  => $filteredPayments
                ];

            case 'payment_candidate_summary':
                $allPayments = Payment::all($caseManagerScope);
                $filteredPayments = array_values(array_filter($allPayments, function($p) use ($dateFrom, $dateTo) {
                    $pDate = $p['payment_date'] ?? ($p['created_at'] ?? '');
                    return self::inDateRange($pDate, $dateFrom, $dateTo);
                }));
                $allClaims = Claim::all($caseManagerScope);
                $claimedByCand = [];
                foreach ($allClaims as $cl) {
                    if (($cl['status'] ?? '') === 'terminated') continue;
                    $cid = (int)($cl['candidate_id'] ?? 0);
                    if ($cid > 0) {
                        $claimedByCand[$cid] = ($claimedByCand[$cid] ?? 0.0) + (float)($cl['claim_amount_bhd'] ?? 0);
                    }
                }
                $grouped = [];
                foreach ($filteredPayments as $p) {
                    $cid = !empty($p['candidate_id']) ? (int)$p['candidate_id'] : ($p['candidate_ref'] ?? $p['id']);
                    $key = (string)$cid;
                    if (!isset($grouped[$key])) {
                        $claimedAmt = is_int($cid) ? (float)($claimedByCand[$cid] ?? 0.0) : 0.0;
                        $grouped[$key] = [
                            'id'                  => $key,
                            'candidate_id'        => $p['candidate_id'] ?? null,
                            'candidate_ref'       => $p['candidate_ref'] ?? 'N/A',
                            'candidate_name'      => $p['candidate_name'] ?? 'N/A',
                            'candidate_cpr'       => $p['candidate_cpr'] ?? 'N/A',
                            'company_name'        => $p['company_name'] ?? 'N/A',
                            'employer_cr'         => $p['employer_cr'] ?? '',
                            'position_title'      => $p['position_title'] ?? '',
                            'case_manager_name'   => $p['case_manager_name'] ?? 'System',
                            'total_claimed_bhd'   => round($claimedAmt, 3),
                            'total_received_bhd'  => 0.0,
                            'balance_bhd'         => round($claimedAmt, 3),
                            'receipts_count'      => 0,
                            'latest_payment_date' => $p['payment_date'] ?? '',
                            'datewise_items'      => []
                        ];
                    }
                    $amt = (float)($p['amount_paid_bhd'] ?? 0);
                    $grouped[$key]['total_received_bhd'] = round($grouped[$key]['total_received_bhd'] + $amt, 3);
                    $grouped[$key]['balance_bhd'] = round($grouped[$key]['total_claimed_bhd'] - $grouped[$key]['total_received_bhd'], 3);
                    $grouped[$key]['receipts_count'] += 1;
                    $pDate = $p['payment_date'] ?? '';
                    if ($pDate !== '' && ($grouped[$key]['latest_payment_date'] === '' || $pDate > $grouped[$key]['latest_payment_date'])) {
                        $grouped[$key]['latest_payment_date'] = $pDate;
                    }
                    $grouped[$key]['datewise_items'][] = $pDate . ': ' . number_format($amt, 3) . ' (' . ($p['receipt_no'] ?? '') . ')';
                }
                $summaryRows = array_values(array_map(function($row) {
                    $row['datewise_breakdown'] = implode(' | ', $row['datewise_items']);
                    unset($row['datewise_items']);
                    return $row;
                }, $grouped));
                usort($summaryRows, fn($a, $b) => $b['total_received_bhd'] <=> $a['total_received_bhd']);
                return [
                    'title' => 'Payment Receipts — Candidate & Placement Summary',
                    'data'  => $summaryRows
                ];

            case 'outstanding_balance':
                $claims = self::resolveClaimsAsOf($caseManagerScope, $dateFrom, $dateTo, true);
                $unpaid = array_filter($claims, fn($c) => (float)$c['balance_bhd'] > 0.001 && !in_array($c['status'], ['disputed', 'terminated'], true));
                return [
                    'title' => 'Active Claims Outstanding Balance Report',
                    'data'  => array_values($unpaid)
                ];

            case 'financial_reconciliation':
                $claims = Claim::all($caseManagerScope);
                $rows = [];
                foreach ($claims as $c) {
                    $rows[] = [
                        'claim_ref'         => $c['claim_ref'],
                        'candidate_name'    => $c['candidate_name'],
                        'case_manager'      => $c['case_manager_name'],
                        'claim_type'        => $c['claim_type'],
                        'claim_amount_bhd'  => $c['claim_amount_bhd'],
                        'total_paid_bhd'    => $c['total_paid_bhd'],
                        'balance_bhd'       => $c['balance_bhd'],
                        'status'            => $c['status']
                    ];
                }
                return [
                    'title' => 'End-to-End Financial Ledger Reconciliation Report',
                    'data'  => $rows
                ];

            case 'case_manager_kpi':
                $store = Database::getStore();
                $cms = User::getCaseManagers();
                $kpiRows = [];
                foreach ($cms as $cm) {
                    $name = $cm['case_manager_code'] ?? $cm['full_name'];
                    $cands = Candidate::all($name);
                    $cClaims = Claim::all($name);
                    $cPayments = Payment::all($name);
                    $cDisputes = array_values(array_filter(Dispute::all($name), function($d) use ($dateFrom, $dateTo) {
                        $filedDate = $d['dispute_date'] ?? ($d['created_at'] ?? '');
                        return self::inDateRange($filedDate, $dateFrom, $dateTo);
                    }));

                    $claimed = array_sum(array_column($cClaims, 'claim_amount_bhd'));
                    $collected = array_sum(array_column($cPayments, 'amount_paid_bhd'));

                    $kpiRows[] = [
                        'case_manager_name' => $name,
                        'total_candidates'  => count($cands),
                        'total_claims'      => count($cClaims),
                        'claimed_bhd'       => $claimed,
                        'collected_bhd'     => $collected,
                        'balance_bhd'       => max(0.0, $claimed - $collected),
                        'disputes_count'    => count($cDisputes),
                        'active_disputes'   => count(array_filter($cDisputes, fn($d) => $d['status'] === 'active_dispute')),
                        'collection_rate'   => $claimed > 0 ? round(($collected / $claimed) * 100, 1) . '%' : '0%'
                    ];
                }
                return [
                    'title' => 'Case Manager Portfolio KPI Performance Matrix',
                    'data'  => $kpiRows
                ];

            default:
                return [
                    'title' => 'Executive Placement Summary',
                    'data'  => Candidate::all($caseManagerScope)
                ];
        }
    }
}
