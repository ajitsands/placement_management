<?php
/**
 * DocumentCategory Model - Candidate Document Category Master
 * Manages official document categories, mandatory requirements, icons, and display ordering.
 */

namespace App\Models;

use App\Config\Database;

class DocumentCategory {
    public static function getDefaultCategories(): array {
        return [
            [
                'id'            => 1,
                'code'          => 'CPR_CARD',
                'name'          => 'CPR / Smart Card Copy',
                'icon'          => '🆔',
                'description'   => 'Valid Kingdom of Bahrain CPR Smart Card front and back copy.',
                'is_mandatory'  => 1,
                'display_order' => 1,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 2,
                'code'          => 'RESUME_CV',
                'name'          => 'Curriculum Vitae (CV / Resume)',
                'icon'          => '📄',
                'description'   => 'Current professional resume vetted and tagged with qualifications.',
                'is_mandatory'  => 1,
                'display_order' => 2,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 3,
                'code'          => 'EDU_CERT',
                'name'          => 'Educational Certificate / Attested Degree',
                'icon'          => '🎓',
                'description'   => 'Attested university graduation degree or diploma certificate.',
                'is_mandatory'  => 1,
                'display_order' => 3,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 4,
                'code'          => 'BANK_IBAN',
                'name'          => 'Bank Account IBAN Certificate',
                'icon'          => '🏦',
                'description'   => 'Official bank IBAN certificate or salary account confirmation letter.',
                'is_mandatory'  => 1,
                'display_order' => 4,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 5,
                'code'          => 'GOSI_RECORD',
                'name'          => 'GOSI Salary & Social Insurance Record',
                'icon'          => '🛡️',
                'description'   => 'Official social insurance contribution and employment status clearance.',
                'is_mandatory'  => 0,
                'display_order' => 5,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 6,
                'code'          => 'MOL_AGREE',
                'name'          => 'MOL & Placement Retention Consent',
                'icon'          => '📝',
                'description'   => 'Signed candidate acknowledgment of Ministry of Labour employment terms.',
                'is_mandatory'  => 1,
                'display_order' => 6,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 7,
                'code'          => 'CONTRACT_OFFER',
                'name'          => 'Employment Contract / Offer Letter',
                'icon'          => '📑',
                'description'   => 'Signed job placement contract or official company job offer letter.',
                'is_mandatory'  => 0,
                'display_order' => 7,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 8,
                'code'          => 'EXIT_LETTER',
                'name'          => 'Resignation Letter / Exit Settlement',
                'icon'          => '📄',
                'description'   => 'Voluntary resignation letter or employer exit settlement document.',
                'is_mandatory'  => 0,
                'display_order' => 8,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 9,
                'code'          => 'PHOTO',
                'name'          => 'Candidate Photo / Passport Size',
                'icon'          => '📷',
                'description'   => 'Formal passport size photograph for profile verification.',
                'is_mandatory'  => 0,
                'display_order' => 9,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ],
            [
                'id'            => 10,
                'code'          => 'OTHER',
                'name'          => 'Other Supporting Document',
                'icon'          => '📁',
                'description'   => 'Any additional vocational credentials or experience certificates.',
                'is_mandatory'  => 0,
                'display_order' => 10,
                'is_active'     => 1,
                'created_at'    => '2026-01-01 09:00:00'
            ]
        ];
    }

    public static function all(bool $activeOnly = false): array {
        $store = Database::getStore();
        $items = $store['document_categories'] ?? [];

        if (empty($items)) {
            $items = self::getDefaultCategories();
            $store['document_categories'] = $items;
            Database::saveStore($store);
        }

        if ($activeOnly) {
            $items = array_filter($items, function($item) {
                return !empty($item['is_active']);
            });
        }

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
        $items = $store['document_categories'] ?? self::getDefaultCategories();

        $maxId = 0;
        $maxOrder = 0;
        foreach ($items as $item) {
            if ((int)$item['id'] > $maxId) $maxId = (int)$item['id'];
            if ((int)($item['display_order'] ?? 0) > $maxOrder) $maxOrder = (int)$item['display_order'];
        }

        $code = strtoupper(trim($data['code'] ?? ''));
        if (empty($code)) {
            $code = 'DOC_' . strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $data['name'] ?? 'CAT'), 0, 8)) . '_' . ($maxId + 1);
        }

        $newItem = [
            'id'            => $maxId + 1,
            'code'          => $code,
            'name'          => trim($data['name'] ?? 'New Document Category'),
            'icon'          => trim($data['icon'] ?? '📄') ?: '📄',
            'description'   => trim($data['description'] ?? ''),
            'is_mandatory'  => !empty($data['is_mandatory']) ? 1 : 0,
            'display_order' => isset($data['display_order']) ? (int)$data['display_order'] : ($maxOrder + 1),
            'is_active'     => isset($data['is_active']) ? (int)$data['is_active'] : 1,
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s')
        ];

        $items[] = $newItem;
        $store['document_categories'] = $items;
        Database::saveStore($store);

        return $newItem;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        $items = $store['document_categories'] ?? self::getDefaultCategories();

        foreach ($items as &$item) {
            if ((int)$item['id'] === $id) {
                if (isset($data['name'])) $item['name'] = trim($data['name']);
                if (isset($data['icon'])) $item['icon'] = trim($data['icon']) ?: '📄';
                if (isset($data['code'])) $item['code'] = strtoupper(trim($data['code']));
                if (isset($data['description'])) $item['description'] = trim($data['description']);
                if (isset($data['is_mandatory'])) $item['is_mandatory'] = !empty($data['is_mandatory']) ? 1 : 0;
                if (isset($data['display_order'])) $item['display_order'] = (int)$data['display_order'];
                if (isset($data['is_active'])) $item['is_active'] = !empty($data['is_active']) ? 1 : 0;
                $item['updated_at'] = date('Y-m-d H:i:s');

                $store['document_categories'] = $items;
                Database::saveStore($store);
                return $item;
            }
        }

        return null;
    }

    public static function delete(int $id): bool {
        $store = Database::getStore();
        $items = $store['document_categories'] ?? self::getDefaultCategories();

        $originalCount = count($items);
        $items = array_values(array_filter($items, function($item) use ($id) {
            return (int)$item['id'] !== $id;
        }));

        if (count($items) < $originalCount) {
            $store['document_categories'] = $items;
            Database::saveStore($store);
            return true;
        }

        return false;
    }
}

