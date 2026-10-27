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

    public static function generate(string $type, ?string $caseManagerScope = null): array {
        switch ($type) {
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

            case 'claims_summary':
                return [
                    'title' => 'Claims Summary & Status Pipeline Report',
                    'data'  => Claim::all($caseManagerScope)
                ];

            case 'disputed_claims':
                return [
                    'title' => 'Disputed Claims Investigation Report',
                    'data'  => Dispute::all($caseManagerScope)
                ];

            case 'terminated_claims':
                $claims = Claim::all($caseManagerScope);
                return [
                    'title' => 'Terminated Claims Audit Archive Report',
                    'data'  => array_values(array_filter($claims, fn($c) => $c['status'] === 'terminated'))
                ];

            case 'payment_collection':
                return [
                    'title' => 'Payment Collections Ledger Report',
                    'data'  => Payment::all($caseManagerScope)
                ];

            case 'outstanding_balance':
                $claims = Claim::all($caseManagerScope);
                $unpaid = array_filter($claims, fn($c) => (float)$c['balance_bhd'] > 0.001 && $c['status'] !== 'terminated');
                return [
                    'title' => 'Outstanding Claims Balance Aging Report',
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
                    $cDisputes = Dispute::all($name);

                    $claimed = array_sum(array_column($cClaims, 'claim_amount_bhd'));
                    $collected = array_sum(array_column($cPayments, 'amount_paid_bhd'));

                    $kpiRows[] = [
                        'case_manager_name' => $name,
                        'total_candidates'  => count($cands),
                        'total_claims'      => count($cClaims),
                        'claimed_bhd'       => $claimed,
                        'collected_bhd'     => $collected,
                        'balance_bhd'       => max(0.0, $claimed - $collected),
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
