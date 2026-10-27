<?php
/**
 * Candidate Model - Registration, Placements, Status & Documents
 */

namespace App\Models;

use App\Config\Database;

class Candidate {
    public static function all(?string $caseManagerScope = null, ?string $search = null): array {
        $store = Database::getStore();
        $candidates = $store['candidates'] ?? [];

        // 1. Strict Case Manager scoping
        if ($caseManagerScope !== null && $caseManagerScope !== '') {
            $candidates = array_filter($candidates, function($c) use ($caseManagerScope) {
                return strcasecmp($c['case_manager_name'] ?? '', $caseManagerScope) === 0;
            });
        }

        // 2. Search query filter
        if ($search) {
            $q = strtolower(trim($search));
            $candidates = array_filter($candidates, function($c) use ($q) {
                return str_contains(strtolower($c['full_name'] ?? ''), $q) ||
                       str_contains(strtolower($c['ref_no'] ?? ''), $q) ||
                       str_contains(strtolower($c['cpr_no'] ?? ''), $q) ||
                       str_contains(strtolower($c['company_name'] ?? ''), $q) ||
                       str_contains(strtolower($c['status'] ?? ''), $q);
            });
        }

        return array_values($candidates);
    }

    public static function find(int $id, ?string $caseManagerScope = null): ?array {
        $candidates = self::all($caseManagerScope);
        foreach ($candidates as $c) {
            if ((int)$c['id'] === $id) return $c;
        }
        return null;
    }

    public static function findByRef(string $refNo): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] ?? [] as $c) {
            if (strcasecmp($c['ref_no'], $refNo) === 0) return $c;
        }
        return null;
    }

    public static function findByCPR(string $cprNo): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] ?? [] as $c) {
            if (trim((string)($c['cpr_no'] ?? '')) === trim((string)$cprNo)) return $c;
        }
        return null;
    }

    public static function generateNextRef(): string {
        $store = Database::getStore();
        $year = date('y');
        $existingRefs = array_column($store['candidates'] ?? [], 'ref_no');
        $existingSet = array_flip(array_map('strtoupper', $existingRefs));

        $maxSeq = 268500;
        foreach ($existingRefs as $r) {
            if (preg_match('#^JCP/' . $year . '/(\d+)$#i', $r, $m)) {
                $num = (int)$m[1];
                if ($num > $maxSeq) {
                    $maxSeq = $num;
                }
            }
        }

        $nextSeq = $maxSeq + 1;
        while (isset($existingSet[strtoupper("JCP/{$year}/" . str_pad($nextSeq, 6, '0', STR_PAD_LEFT))])) {
            $nextSeq++;
        }

        return "JCP/{$year}/" . str_pad($nextSeq, 6, '0', STR_PAD_LEFT);
    }

    public static function create(array $data, ?string $defaultCaseManager = null): array {
        $store = Database::getStore();
        $id = count($store['candidates']) > 0 ? max(array_column($store['candidates'], 'id')) + 1 : 1;

        // Custom reference number or automated next reference (JCP/26/XXXXXX)
        $customRef = trim($data['ref_no'] ?? '');
        $refNo = !empty($customRef) ? $customRef : self::generateNextRef();
        $caseManagerName = !empty($data['case_manager_name']) ? trim($data['case_manager_name']) : ($defaultCaseManager ?: 'Husain');

        $regDate = !empty($data['registration_date']) ? $data['registration_date'] : date('Y-m-d');
        $hasPlacement = !empty($data['company_name']) && !empty($data['joining_date']);

        $status = $data['status'] ?? ($hasPlacement ? 'placed' : 'registered');
        $remarks = trim($data['remarks'] ?? ($data['notes'] ?? ''));

        // Handle documents
        $documents = [];
        if (!empty($data['documents'])) {
            $rawDocs = [];
            if (is_string($data['documents'])) {
                $decoded = json_decode($data['documents'], true);
                $rawDocs = is_array($decoded) ? $decoded : [];
            } elseif (is_array($data['documents'])) {
                $rawDocs = $data['documents'];
            }
            foreach ($rawDocs as $docItem) {
                if (is_array($docItem)) {
                    $documents[] = self::processDocumentFile($docItem);
                }
            }
        }

        $newCandidate = [
            'id'                => $id,
            'ref_no'            => $refNo,
            'full_name'         => strtoupper(trim($data['full_name'] ?? '')),
            'cpr_no'            => trim($data['cpr_no'] ?? ''),
            'gender'            => $data['gender'] ?? 'Unspecified',
            'education'         => $data['education'] ?? 'High School',
            'registration_date' => $regDate,
            'status'            => $status,
            'salary_bhd'        => $hasPlacement ? (float)($data['salary_bhd'] ?? 450.000) : 0.000,
            'position_title'    => $hasPlacement ? trim($data['position_title'] ?? 'Specialist') : null,
            'employee_type'     => $hasPlacement ? trim($data['employee_type'] ?? 'Full-Time') : 'Full-Time',
            'company_name'      => $hasPlacement ? trim($data['company_name']) : null,
            'employer_cr'       => $hasPlacement ? trim($data['employer_cr'] ?? '') : null,
            'mol_certified'     => $data['mol_certified'] ?? 'Yes',
            'long_mol'          => $data['long_mol'] ?? 'No',
            'joining_date'      => $hasPlacement ? $data['joining_date'] : null,
            'case_manager_id'   => isset($data['case_manager_id']) ? (int)$data['case_manager_id'] : 3,
            'case_manager_name' => $caseManagerName,
            'notes'             => $remarks,
            'comments'          => trim($data['comments'] ?? ''),
            'remarks'           => $remarks,
            'documents'         => $documents,
            'created_at'        => date('Y-m-d H:i:s')
        ];

        $store['candidates'][] = $newCandidate;

        // If placement details are provided, automatically initialize retention milestones
        if ($hasPlacement) {
            self::generateMilestones($store, $id, $newCandidate['joining_date']);
        }

        Database::saveStore($store);
        return $newCandidate;
    }

    public static function linkPlacement(int $id, array $placementData, ?string $caseManagerScope = null): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] as &$c) {
            if ((int)$c['id'] === $id) {
                if ($caseManagerScope !== null && strcasecmp($c['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    return null;
                }

                $joiningDate = !empty($placementData['joining_date']) ? $placementData['joining_date'] : date('Y-m-d');
                $c['company_name'] = trim($placementData['company_name'] ?? 'Employer');
                $c['position_title'] = trim($placementData['position_title'] ?? 'Position');
                $c['employee_type'] = trim($placementData['employee_type'] ?? 'Full-Time');
                $c['salary_bhd'] = (float)($placementData['salary_bhd'] ?? 450.000);
                $c['joining_date'] = $joiningDate;
                $c['employer_cr'] = trim($placementData['employer_cr'] ?? '');
                $c['mol_certified'] = $placementData['mol_certified'] ?? 'Yes';
                $c['long_mol'] = $placementData['long_mol'] ?? 'No';
                $c['comments'] = trim($placementData['comments'] ?? '');
                if (!empty($placementData['case_manager_name'])) {
                    $c['case_manager_name'] = trim($placementData['case_manager_name']);
                }
                if (isset($placementData['case_manager_id'])) {
                    $c['case_manager_id'] = (int)$placementData['case_manager_id'];
                }
                $c['status'] = 'placed';

                // Automatically generate retention milestones if not existing
                self::generateMilestones($store, $id, $joiningDate);

                Database::saveStore($store);
                return $c;
            }
        }
        return null;
    }

    public static function updateStatus(int $id, string $status, ?string $remarks = null, ?string $caseManagerScope = null): ?array {
        $allowedStatuses = ['registered', 'placed', 'active', 'completed', 'resigned', 'on_hold'];
        if (!in_array($status, $allowedStatuses)) {
            return null;
        }

        $store = Database::getStore();
        foreach ($store['candidates'] as &$c) {
            if ((int)$c['id'] === $id) {
                if ($caseManagerScope !== null && strcasecmp($c['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    return null;
                }

                $c['status'] = $status;
                if ($remarks !== null && trim($remarks) !== '') {
                    $c['remarks'] = trim($remarks);
                    $c['notes'] = trim($remarks);
                }

                Database::saveStore($store);
                return $c;
            }
        }
        return null;
    }

    public static function addDocument(int $id, array $document, ?string $caseManagerScope = null): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] as &$c) {
            if ((int)$c['id'] === $id) {
                if ($caseManagerScope !== null && strcasecmp($c['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    return null;
                }

                if (!isset($c['documents']) || !is_array($c['documents'])) {
                    $c['documents'] = [];
                }

                $docId = !empty($document['id']) ? $document['id'] : ('DOC-' . time() . '-' . rand(100, 999));
                $newDoc = [
                    'id'          => $docId,
                    'name'        => trim($document['name'] ?? 'Candidate Document'),
                    'type'        => trim($document['type'] ?? 'General'),
                    'file_name'   => trim($document['file_name'] ?? 'document.pdf'),
                    'file_size'   => (int)($document['file_size'] ?? 0),
                    'file_url'    => trim($document['file_url'] ?? ''),
                    'uploaded_at' => date('Y-m-d H:i:s')
                ];

                $c['documents'][] = $newDoc;
                Database::saveStore($store);
                return $c;
            }
        }
        return null;
    }

    public static function deleteDocument(int $id, string $docId, ?string $caseManagerScope = null): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] as &$c) {
            if ((int)$c['id'] === $id) {
                if ($caseManagerScope !== null && strcasecmp($c['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    return null;
                }

                if (!empty($c['documents']) && is_array($c['documents'])) {
                    $c['documents'] = array_values(array_filter($c['documents'], function($d) use ($docId) {
                        return (string)($d['id'] ?? '') !== (string)$docId;
                    }));
                }

                Database::saveStore($store);
                return $c;
            }
        }
        return null;
    }

    public static function processDocumentFile(array $doc): array {
        $uploadDir = dirname(__DIR__, 2) . '/public/uploads/candidates/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        if (!empty($doc['file_data']) && !empty($doc['file_name'])) {
            $origName = basename($doc['file_name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'txt', 'webp'];
            if (!in_array($ext, $allowedExts)) {
                $ext = 'pdf';
            }

            $rawBase64 = $doc['file_data'];
            if (str_contains($rawBase64, ',')) {
                $rawBase64 = explode(',', $rawBase64)[1];
            }
            $decodedData = base64_decode($rawBase64);
            if ($decodedData !== false) {
                $safeName = 'doc_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                $targetPath = $uploadDir . $safeName;
                if (file_put_contents($targetPath, $decodedData) !== false) {
                    $doc['file_url'] = 'uploads/candidates/' . $safeName;
                    $doc['file_size'] = strlen($decodedData);
                    $doc['file_name'] = $origName;
                    unset($doc['file_data']);
                }
            }
        }

        if (empty($doc['id'])) {
            $doc['id'] = 'DOC-' . time() . '-' . rand(100, 999);
        }
        if (empty($doc['uploaded_at'])) {
            $doc['uploaded_at'] = date('Y-m-d H:i:s');
        }

        return $doc;
    }

    public static function update(int $id, array $data, ?string $caseManagerScope = null): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] as &$c) {
            if ((int)$c['id'] === $id) {
                if ($caseManagerScope !== null && strcasecmp($c['case_manager_name'], $caseManagerScope) !== 0) {
                    return null;
                }

                if (isset($data['full_name'])) $c['full_name'] = strtoupper(trim($data['full_name']));
                if (isset($data['cpr_no'])) $c['cpr_no'] = trim($data['cpr_no']);
                if (isset($data['gender'])) $c['gender'] = $data['gender'];
                if (isset($data['education'])) $c['education'] = $data['education'];
                if (isset($data['registration_date'])) $c['registration_date'] = $data['registration_date'];
                if (isset($data['status'])) $c['status'] = $data['status'];
                if (isset($data['salary_bhd'])) $c['salary_bhd'] = (float)$data['salary_bhd'];
                if (isset($data['position_title'])) $c['position_title'] = trim($data['position_title']);
                if (isset($data['company_name'])) $c['company_name'] = trim($data['company_name']);
                if (isset($data['employer_cr'])) $c['employer_cr'] = trim($data['employer_cr']);
                if (isset($data['mol_certified'])) $c['mol_certified'] = $data['mol_certified'];
                if (isset($data['joining_date'])) $c['joining_date'] = $data['joining_date'];
                if (isset($data['case_manager_name'])) $c['case_manager_name'] = trim($data['case_manager_name']);
                if (isset($data['remarks'])) {
                    $c['remarks'] = trim($data['remarks']);
                    $c['notes'] = trim($data['remarks']);
                }
                if (isset($data['documents']) && is_array($data['documents'])) {
                    $c['documents'] = $data['documents'];
                }

                Database::saveStore($store);
                return $c;
            }
        }
        return null;
    }

    private static function generateMilestones(array &$store, int $candidateId, string $joiningDate): void {
        // Check if milestones already exist for this candidate
        $existing = array_filter($store['milestones'] ?? [], function($m) use ($candidateId) {
            return (int)$m['candidate_id'] === $candidateId;
        });

        if (!empty($existing)) {
            return;
        }

        $joiningTimestamp = strtotime($joiningDate);
        $msIdStart = count($store['milestones']) > 0 ? max(array_column($store['milestones'], 'id')) + 1 : 1;

        $store['milestones'][] = [
            'id' => $msIdStart,
            'candidate_id' => $candidateId,
            'milestone_type' => 'placement',
            'milestone_title' => 'Placement Claim (Day 0)',
            'due_date' => $joiningDate,
            'status' => 'due',
            'alert_dispatched' => 1
        ];

        $store['milestones'][] = [
            'id' => $msIdStart + 1,
            'candidate_id' => $candidateId,
            'milestone_type' => '180_days',
            'milestone_title' => '6-Month Claim (+180d)',
            'due_date' => date('Y-m-d', strtotime('+180 days', $joiningTimestamp)),
            'status' => 'upcoming',
            'alert_dispatched' => 0
        ];

        $store['milestones'][] = [
            'id' => $msIdStart + 2,
            'candidate_id' => $candidateId,
            'milestone_type' => '365_days',
            'milestone_title' => '12-Month Claim (+365d)',
            'due_date' => date('Y-m-d', strtotime('+365 days', $joiningTimestamp)),
            'status' => 'upcoming',
            'alert_dispatched' => 0
        ];
    }
}
