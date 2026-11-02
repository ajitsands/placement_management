<?php
/**
 * ChecklistMaster Model - Candidate Registration Compliance Checklist Master
 * Manages mandatory criteria, weights, categories, and completion percentage calculation.
 */

namespace App\Models;

use App\Config\Database;

class ChecklistMaster {
    public static function getDefaultItems(): array {
        return [
            [
                'id'            => 1,
                'code'          => 'CPR_VERIF',
                'title'         => 'CPR Identity & Smart Card Verification',
                'description'   => 'Valid Kingdom of Bahrain CPR Smart Card copy uploaded and identity confirmed against National Population Registry.',
                'category'      => 'Identity & Legal',
                'weight'        => 25,
                'is_mandatory'  => 1,
                'display_order' => 1,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 2,
                'code'          => 'CV_RESUME',
                'title'         => 'Curriculum Vitae (CV / Resume) Vetted',
                'description'   => 'Current professional resume submitted, verified, and tagged with candidate specializations and skills.',
                'category'      => 'Profile & Qualifications',
                'weight'        => 20,
                'is_mandatory'  => 1,
                'display_order' => 2,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 3,
                'code'          => 'EDU_CERT',
                'title'         => 'Educational Certificate / Attested Degree',
                'description'   => 'Verified graduation degree or diploma certificate from accredited university/institution.',
                'category'      => 'Profile & Qualifications',
                'weight'        => 20,
                'is_mandatory'  => 1,
                'display_order' => 3,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 4,
                'code'          => 'BANK_IBAN',
                'title'         => 'Bank Account IBAN Certificate',
                'description'   => 'Official bank account verification letter / IBAN certificate in candidate name for wage disbursement compliance.',
                'category'      => 'Banking & Compliance',
                'weight'        => 15,
                'is_mandatory'  => 1,
                'display_order' => 4,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 5,
                'code'          => 'GOSI_RECORD',
                'title'         => 'GOSI Employment History / Status Record',
                'description'   => 'Social insurance contribution clearance confirming candidate eligibility under Tamkeen subsidy guidelines.',
                'category'      => 'Compliance & Verification',
                'weight'        => 10,
                'is_mandatory'  => 0,
                'display_order' => 5,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 6,
                'code'          => 'MOL_AGREE',
                'title'         => 'MOL & Placement Retention Consent',
                'description'   => 'Signed candidate acknowledgment of Ministry of Labour employment terms and Tamkeen retention milestones.',
                'category'      => 'Compliance & Verification',
                'weight'        => 10,
                'is_mandatory'  => 1,
                'display_order' => 6,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ]
        ];
    }

    public static function all(bool $activeOnly = false): array {
        $store = Database::getStore();
        $items = $store['checklist_masters'] ?? [];

        if (empty($items)) {
            $items = self::getDefaultItems();
            $store['checklist_masters'] = $items;
            Database::saveStore($store);
        }

        if ($activeOnly) {
            $items = array_filter($items, function($item) {
                return !empty($item['is_active']);
            });
        }

        // Sort by display_order then id
        usort($items, function($a, $b) {
            $ordA = (int)($a['display_order'] ?? 0);
            $ordB = (int)($b['display_order'] ?? 0);
            if ($ordA === $ordB) {
                return (int)($a['id'] ?? 0) - (int)($b['id'] ?? 0);
            }
            return $ordA - $ordB;
        });

        return array_values($items);
    }

    public static function find(int $id): ?array {
        $items = self::all(false);
        foreach ($items as $item) {
            if ((int)$item['id'] === $id) return $item;
        }
        return null;
    }

    public static function findByCode(string $code): ?array {
        $items = self::all(false);
        foreach ($items as $item) {
            if (strcasecmp($item['code'], $code) === 0) return $item;
        }
        return null;
    }

    public static function create(array $data): array {
        $store = Database::getStore();
        $items = $store['checklist_masters'] ?? self::getDefaultItems();

        $maxId = 0;
        $maxOrder = 0;
        foreach ($items as $item) {
            if ((int)$item['id'] > $maxId) $maxId = (int)$item['id'];
            if ((int)($item['display_order'] ?? 0) > $maxOrder) $maxOrder = (int)$item['display_order'];
        }

        $code = strtoupper(trim($data['code'] ?? ''));
        if (empty($code)) {
            $code = 'CHK_' . strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $data['title'] ?? 'ITEM'), 0, 8)) . '_' . ($maxId + 1);
        }

        $newItem = [
            'id'            => $maxId + 1,
            'code'          => $code,
            'title'         => trim($data['title'] ?? 'New Checklist Criterion'),
            'description'   => trim($data['description'] ?? ''),
            'category'      => trim($data['category'] ?? 'General Verification'),
            'weight'        => max(1, (int)($data['weight'] ?? 10)),
            'is_mandatory'  => !empty($data['is_mandatory']) ? 1 : 0,
            'display_order' => isset($data['display_order']) ? (int)$data['display_order'] : ($maxOrder + 1),
            'is_active'     => isset($data['is_active']) ? (int)$data['is_active'] : 1,
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s')
        ];

        $items[] = $newItem;
        $store['checklist_masters'] = $items;
        Database::saveStore($store);

        return $newItem;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        $items = $store['checklist_masters'] ?? self::getDefaultItems();

        foreach ($items as &$item) {
            if ((int)$item['id'] === $id) {
                if (isset($data['title'])) $item['title'] = trim($data['title']);
                if (isset($data['code'])) $item['code'] = strtoupper(trim($data['code']));
                if (isset($data['description'])) $item['description'] = trim($data['description']);
                if (isset($data['category'])) $item['category'] = trim($data['category']);
                if (isset($data['weight'])) $item['weight'] = max(1, (int)$data['weight']);
                if (isset($data['is_mandatory'])) $item['is_mandatory'] = !empty($data['is_mandatory']) ? 1 : 0;
                if (isset($data['display_order'])) $item['display_order'] = (int)$data['display_order'];
                if (isset($data['is_active'])) $item['is_active'] = !empty($data['is_active']) ? 1 : 0;
                $item['updated_at'] = date('Y-m-d H:i:s');

                $store['checklist_masters'] = $items;
                Database::saveStore($store);
                return $item;
            }
        }
        return null;
    }

    public static function delete(int $id): bool {
        $store = Database::getStore();
        $items = $store['checklist_masters'] ?? self::getDefaultItems();
        $originalCount = count($items);

        $items = array_values(array_filter($items, function($item) use ($id) {
            return (int)$item['id'] !== $id;
        }));

        if (count($items) === $originalCount) {
            return false;
        }

        $store['checklist_masters'] = $items;
        Database::saveStore($store);
        return true;
    }

    /**
     * Compute completion percentage based on active master items and checked item IDs / codes.
     * Returns: ['percentage' => 85, 'is_complete' => false, 'missing_mandatory' => [...], 'summary' => '...']
     */
    public static function evaluateProgress(array $checkedIdentifiers): array {
        $masters = self::all(true);
        if (empty($masters)) {
            return [
                'percentage'         => 100,
                'is_complete'        => true,
                'total_weight'       => 0,
                'earned_weight'      => 0,
                'total_items'        => 0,
                'completed_items'    => 0,
                'missing_mandatory'  => [],
                'item_breakdown'     => []
            ];
        }

        // Normalize checked identifiers to lower case strings
        $checkedSet = [];
        foreach ($checkedIdentifiers as $idOrCode) {
            if ($idOrCode !== null && $idOrCode !== '') {
                $checkedSet[strtolower(trim((string)$idOrCode))] = true;
            }
        }

        $totalWeight = 0;
        $earnedWeight = 0;
        $totalItems = count($masters);
        $completedItems = 0;
        $missingMandatory = [];
        $itemBreakdown = [];

        foreach ($masters as $m) {
            $w = (int)($m['weight'] ?? 10);
            $totalWeight += $w;

            $isDone = isset($checkedSet[strtolower((string)$m['id'])]) || 
                      isset($checkedSet[strtolower((string)$m['code'])]);

            if ($isDone) {
                $earnedWeight += $w;
                $completedItems++;
            } else if (!empty($m['is_mandatory'])) {
                $missingMandatory[] = [
                    'id'    => $m['id'],
                    'code'  => $m['code'],
                    'title' => $m['title']
                ];
            }

            $itemBreakdown[] = [
                'id'           => $m['id'],
                'code'         => $m['code'],
                'title'        => $m['title'],
                'category'     => $m['category'],
                'weight'       => $w,
                'is_mandatory' => (bool)$m['is_mandatory'],
                'completed'    => $isDone
            ];
        }

        $percentage = $totalWeight > 0 ? (int)round(($earnedWeight / $totalWeight) * 100) : 0;
        if ($percentage > 100) $percentage = 100;

        $isComplete = empty($missingMandatory) && ($percentage >= 100 || $completedItems === $totalItems);

        return [
            'percentage'        => $percentage,
            'is_complete'       => $isComplete,
            'total_weight'      => $totalWeight,
            'earned_weight'     => $earnedWeight,
            'total_items'       => $totalItems,
            'completed_items'   => $completedItems,
            'missing_mandatory' => $missingMandatory,
            'item_breakdown'    => $itemBreakdown
        ];
    }
}

