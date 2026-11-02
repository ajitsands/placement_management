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

        // Process checklist criteria & compute registration percentage
        $checkedIdentifiers = [];
        if (!empty($data['checklist_items'])) {
            if (is_array($data['checklist_items'])) {
                foreach ($data['checklist_items'] as $chk) {
                    if (is_string($chk) || is_numeric($chk)) {
                        $checkedIdentifiers[] = $chk;
                    } elseif (is_array($chk) && (!empty($chk['completed']) || !empty($chk['is_checked']))) {
                        $checkedIdentifiers[] = $chk['code'] ?? ($chk['id'] ?? null);
                    }
                }
            }
        }
        $checklistEval = ChecklistMaster::evaluateProgress($checkedIdentifiers);

        // If mandatory checklist criteria are pending, classify as registration_incomplete
        if (!empty($checklistEval['missing_mandatory'])) {
            $status = 'registration_incomplete';
        }

        $newCandidate = [
            'id'                       => $id,
            'ref_no'                   => $refNo,
            'full_name'                => strtoupper(trim($data['full_name'] ?? '')),
            'cpr_no'                   => trim($data['cpr_no'] ?? ''),
            'phone'                    => !empty($data['phone']) ? trim($data['phone']) : null,
            'email'                    => !empty($data['email']) ? trim($data['email']) : null,
            'gender'                   => $data['gender'] ?? 'Unspecified',
            'education'                => $data['education'] ?? 'High School',
            'date_of_birth'            => !empty($data['date_of_birth']) ? trim($data['date_of_birth']) : null,
            'registration_date'        => $regDate,
            'status'                   => $status,
            'salary_bhd'               => $hasPlacement ? (float)($data['salary_bhd'] ?? 450.000) : 0.000,
            'position_title'           => $hasPlacement ? trim($data['position_title'] ?? 'Specialist') : null,
            'employee_type'            => $hasPlacement ? trim($data['employee_type'] ?? 'Full-Time') : 'Full-Time',
            'company_name'             => $hasPlacement ? trim($data['company_name']) : null,
            'employer_cr'              => $hasPlacement ? trim($data['employer_cr'] ?? '') : null,
            'mol_certified'            => $data['mol_certified'] ?? 'Yes',
            'long_mol'                 => $data['long_mol'] ?? 'No',
            'joining_date'             => $hasPlacement ? $data['joining_date'] : null,
            'case_manager_id'          => isset($data['case_manager_id']) ? (int)$data['case_manager_id'] : 3,
            'case_manager_name'        => $caseManagerName,
            'notes'                    => $remarks,
            'comments'                 => trim($data['comments'] ?? ''),
            'remarks'                  => $remarks,
            'documents'                => $documents,
            'job_id'                   => !empty($data['job_id']) ? (int)$data['job_id'] : null,
            'job_code'                 => !empty($data['job_code']) ? trim($data['job_code']) : null,
            'checklist_completion_pct' => $checklistEval['percentage'],
            'checklist_items'          => $checklistEval['item_breakdown'],
            'created_at'               => date('Y-m-d H:i:s')
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
                if (!empty($placementData['job_id'])) {
                    $c['job_id'] = (int)$placementData['job_id'];
                }
                if (!empty($placementData['job_code'])) {
                    $c['job_code'] = trim($placementData['job_code']);
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
        $allowedStatuses = ['registered', 'placed', 'active', 'completed', 'resigned', 'on_hold', 'registration_incomplete', 'incomplete'];
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

    public static function updateChecklist(int $id, array $checkedIdentifiers, ?string $caseManagerScope = null): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] as &$c) {
            if ((int)$c['id'] === $id) {
                if ($caseManagerScope !== null && strcasecmp($c['case_manager_name'] ?? '', $caseManagerScope) !== 0) {
                    return null;
                }

                $eval = ChecklistMaster::evaluateProgress($checkedIdentifiers);
                $c['checklist_completion_pct'] = $eval['percentage'];
                $c['checklist_items'] = $eval['item_breakdown'];

                // If mandatory checklist criteria are missing, categorize as registration_incomplete
                if (!empty($eval['missing_mandatory'])) {
                    $c['status'] = 'registration_incomplete';
                } elseif (empty($eval['missing_mandatory']) && in_array($c['status'] ?? '', ['registration_incomplete', 'incomplete', 'pending_registration', 'registration_not_completed'])) {
                    $hasPlacement = !empty($c['company_name']) && !empty($c['joining_date']);
                    $c['status'] = $hasPlacement ? 'placed' : 'registered';
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
                if (isset($data['phone'])) $c['phone'] = !empty($data['phone']) ? trim($data['phone']) : null;
                if (isset($data['email'])) $c['email'] = !empty($data['email']) ? trim($data['email']) : null;
                if (isset($data['gender'])) $c['gender'] = $data['gender'];
                if (isset($data['education'])) $c['education'] = $data['education'];
                if (isset($data['date_of_birth'])) $c['date_of_birth'] = !empty($data['date_of_birth']) ? trim($data['date_of_birth']) : null;
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

    public static function renew(int $id, array $data, ?string $renewedBy = null): ?array {
        $store = Database::getStore();
        foreach ($store['candidates'] as &$c) {
            if ((int)$c['id'] === $id) {
                // Must preserve same candidate reference number
                $refNo = $c['ref_no'];
                $prevRenewalDate = $c['last_renewal_date'] ?? null;
                $prevRegDate = $c['registration_date'] ?? null;
                $renewalDate = !empty($data['renewal_date']) ? $data['renewal_date'] : date('Y-m-d');
                $renewalsCount = (int)($c['renewals_count'] ?? 0) + 1;
                $remarks = trim($data['remarks'] ?? ($data['renewal_notes'] ?? ''));

                // Calculate days elapsed since previous baseline
                $baseline = $prevRenewalDate ?: $prevRegDate;
                $daysElapsed = null;
                $daysPast12m = 0;
                if ($baseline) {
                    $daysElapsed = max(0, (int)floor((time() - strtotime($baseline)) / 86400));
                    if ($daysElapsed > 365) {
                        $daysPast12m = $daysElapsed - 365;
                    }
                }

                $renewalItem = [
                    'renewal_index'         => $renewalsCount,
                    'renewal_date'          => $renewalDate,
                    'renewed_at'            => date('Y-m-d H:i:s'),
                    'renewed_by'            => $renewedBy ?: ($data['renewed_by'] ?? 'Directorate Admin'),
                    'ref_no'                => $refNo,
                    'previous_reg_date'     => $prevRegDate,
                    'previous_renewal_date' => $prevRenewalDate,
                    'days_since_previous'   => $daysElapsed,
                    'days_past_12m'         => $daysPast12m,
                    'remarks'               => $remarks,
                    'updated_fields'        => [
                        'phone'             => $data['phone'] ?? $c['phone'] ?? null,
                        'email'             => $data['email'] ?? $c['email'] ?? null,
                        'education'         => $data['education'] ?? $c['education'] ?? null,
                        'case_manager_name' => $data['case_manager_name'] ?? $c['case_manager_name'] ?? null
                    ],
                    'documents_count'       => !empty($data['documents']) && is_array($data['documents']) ? count($data['documents']) : 0
                ];

                $c['last_renewal_date'] = $renewalDate;
                $c['renewals_count'] = $renewalsCount;

                $existingHistory = is_array($c['renewal_history'] ?? null) ? $c['renewal_history'] : [];
                $existingHistory[] = $renewalItem;
                $c['renewal_history'] = $existingHistory;

                if (isset($data['phone'])) $c['phone'] = !empty($data['phone']) ? trim($data['phone']) : null;
                if (isset($data['email'])) $c['email'] = !empty($data['email']) ? trim($data['email']) : null;
                if (isset($data['education'])) $c['education'] = trim($data['education']);
                if (isset($data['case_manager_name'])) $c['case_manager_name'] = trim($data['case_manager_name']);
                if ($remarks) {
                    $c['remarks'] = $remarks;
                    $c['notes'] = $remarks;
                }

                // If new documents provided, append them
                if (!empty($data['documents']) && is_array($data['documents'])) {
                    $currentDocs = is_array($c['documents'] ?? null) ? $c['documents'] : [];
                    foreach ($data['documents'] as $doc) {
                        $currentDocs[] = $doc;
                    }
                    $c['documents'] = $currentDocs;
                }

                // Renewing places candidate back in Available in Pool
                $c['status'] = 'registered';

                // Record in audit logs
                $store['audit_logs'][] = [
                    'id'          => count($store['audit_logs'] ?? []) + 1,
                    'user_id'     => null,
                    'username'    => $renewedBy ?: 'System',
                    'role'        => 'admin',
                    'action'      => 'candidate_renewed',
                    'entity_type' => 'candidate',
                    'entity_id'   => $id,
                    'details'     => "Candidate {$c['full_name']} (Ref: {$refNo}) renewed for 12 months. Previous validity was " . ($daysPast12m > 0 ? "expired by {$daysPast12m} days." : "within cycle.") . " Remarks: {$remarks}",
                    'ip_address'  => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                    'created_at'  => date('Y-m-d H:i:s')
                ];

                Database::saveStore($store);
                return $c;
            }
        }
        return null;
    }

    public static function getActivityLog(int $candidateId): array {
        $store = Database::getStore();
        $candidate = self::find($candidateId);
        if (!$candidate) {
            return [];
        }

        $activities = [];

        // 1. Initial Registration
        $regDate = $candidate['registration_date'] ?? $candidate['created_at'] ?? date('Y-m-d');
        $activities[] = [
            'id'        => 'act_reg_' . $candidateId,
            'timestamp' => $regDate . ' 08:30:00',
            'date'      => $regDate,
            'category'  => 'registration',
            'title'     => 'Candidate Registered in National Talent Pool',
            'ref'       => $candidate['ref_no'],
            'amount'    => null,
            'status'    => 'registered',
            'details'   => "Initial registration created with CPR {$candidate['cpr_no']}. Education level: {$candidate['education']}. Assigned Case Manager: {$candidate['case_manager_name']}.",
            'actor'     => $candidate['case_manager_name'] ?: 'System Registrar'
        ];

        // 2. Renewal Events
        $renewals = is_array($candidate['renewal_history'] ?? null) ? $candidate['renewal_history'] : [];
        foreach ($renewals as $idx => $r) {
            $rDate = $r['renewal_date'] ?? ($r['renewed_at'] ? substr($r['renewed_at'], 0, 10) : date('Y-m-d'));
            $rTime = $r['renewed_at'] ?? ($rDate . ' 10:00:00');
            $pastDays = (int)($r['days_past_12m'] ?? 0);
            $expiryNote = $pastDays > 0 ? " (+{$pastDays} days past 12m validity)" : "";
            $activities[] = [
                'id'        => 'act_ren_' . ($idx + 1),
                'timestamp' => $rTime,
                'date'      => $rDate,
                'category'  => 'renewal',
                'title'     => "Candidate Registration Renewed (Cycle #" . ($r['renewal_index'] ?? ($idx + 1)) . ")",
                'ref'       => $candidate['ref_no'],
                'amount'    => null,
                'status'    => 'renewed',
                'details'   => "12-month registration cycle successfully renewed{$expiryNote}. Reference number preserved. Remarks: " . ($r['remarks'] ?: 'Profile active in pool.'),
                'actor'     => $r['renewed_by'] ?? 'Directorate Admin'
            ];
        }

        // 3. Compliance Checklist
        $checklistPct = (int)($candidate['checklist_completion_pct'] ?? 0);
        $chkItems = is_array($candidate['checklist_items'] ?? null) ? $candidate['checklist_items'] : [];
        $completedCount = 0;
        foreach ($chkItems as $item) {
            if (!empty($item['completed']) || !empty($item['is_checked'])) $completedCount++;
        }
        if ($completedCount > 0 || $checklistPct > 0) {
            $activities[] = [
                'id'        => 'act_chk_' . $candidateId,
                'timestamp' => $regDate . ' 08:45:00',
                'date'      => $regDate,
                'category'  => 'checklist',
                'title'     => "Compliance Checklist Verified ({$checklistPct}% Complete)",
                'ref'       => "CHK-{$candidate['ref_no']}",
                'amount'    => null,
                'status'    => $checklistPct >= 100 ? 'verified' : 'pending',
                'details'   => "{$completedCount} verification criteria completed. Compliance score: {$checklistPct}%. Status: " . ($checklistPct >= 100 ? 'Compliant' : 'Checklist Incomplete'),
                'actor'     => $candidate['case_manager_name'] ?: 'Case Manager'
            ];
        }

        // 4. Documents Uploaded
        $docs = is_array($candidate['documents'] ?? null) ? $candidate['documents'] : [];
        foreach ($docs as $dIdx => $doc) {
            $docTime = $doc['uploaded_at'] ?? ($regDate . ' 08:50:00');
            $docDate = substr($docTime, 0, 10);
            $activities[] = [
                'id'        => 'act_doc_' . ($doc['id'] ?? ($dIdx + 1)),
                'timestamp' => $docTime,
                'date'      => $docDate,
                'category'  => 'document',
                'title'     => "Document Vault: " . ($doc['name'] ?? 'Verification File'),
                'ref'       => $doc['file_name'] ?? 'DOC',
                'amount'    => null,
                'status'    => 'attached',
                'details'   => "Category: " . ($doc['type'] ?? 'ID') . ". File: " . ($doc['file_name'] ?? 'document') . " (" . round(($doc['file_size'] ?? 1024) / 1024, 1) . " KB).",
                'actor'     => $candidate['case_manager_name'] ?: 'User'
            ];
        }

        // 5. Placement & Employment Contract
        if (!empty($candidate['company_name'])) {
            $joiningDate = $candidate['joining_date'] ?? $regDate;
            $activities[] = [
                'id'        => 'act_place_' . $candidateId,
                'timestamp' => $joiningDate . ' 09:00:00',
                'date'      => $joiningDate,
                'category'  => 'placement',
                'title'     => "Employment Contract Linked: " . $candidate['company_name'],
                'ref'       => $candidate['employer_cr'] ?: ("JOB-" . ($candidate['job_code'] ?: 'DIR')),
                'amount'    => (float)($candidate['salary_bhd'] ?? 0),
                'status'    => $candidate['status'] ?? 'placed',
                'details'   => "Placed as {$candidate['position_title']} at {$candidate['company_name']}" . ($candidate['employer_cr'] ? " (CR: {$candidate['employer_cr']})" : "") . ". Basic Wage: BHD " . number_format($candidate['salary_bhd'] ?? 0, 3) . ". MOL Certified: " . ($candidate['mol_certified'] ?: 'Yes') . ". Employee Type: " . ($candidate['employee_type'] ?: 'Full-Time') . ".",
                'actor'     => $candidate['case_manager_name'] ?: 'Case Manager'
            ];
        }

        // 6. Retention Milestones (+0d, +180d, +365d)
        foreach ($store['milestones'] ?? [] as $m) {
            if ((int)$m['candidate_id'] === $candidateId) {
                $mDate = $m['due_date'] ?? $regDate;
                $activities[] = [
                    'id'        => 'act_ms_' . $m['id'],
                    'timestamp' => $mDate . ' 08:00:00',
                    'date'      => $mDate,
                    'category'  => 'milestone',
                    'title'     => "Retention Gate: " . $m['milestone_title'],
                    'ref'       => "MS-{$m['id']}",
                    'amount'    => null,
                    'status'    => $m['status'],
                    'details'   => "Milestone Stage: {$m['milestone_type']}. Due/Target Date: {$mDate}. Status: {$m['status']}.",
                    'actor'     => 'Tamkeen Retention Engine'
                ];
            }
        }

        // 7. Subsidy Claims
        $claimIds = [];
        foreach ($store['claims'] ?? [] as $cl) {
            if ((int)$cl['candidate_id'] === $candidateId) {
                $claimIds[] = (int)$cl['id'];
                $clDate = $cl['claim_date'] ?? $regDate;
                $clTime = $cl['created_at'] ?? ($clDate . ' 11:30:00');
                $activities[] = [
                    'id'        => 'act_claim_' . $cl['id'],
                    'timestamp' => $clTime,
                    'date'      => $clDate,
                    'category'  => 'claim',
                    'title'     => "Subsidy Claim Filed (BHD " . number_format($cl['claim_amount_bhd'], 3) . ")",
                    'ref'       => $cl['claim_ref'] ?? ("CLM-{$cl['id']}"),
                    'amount'    => (float)$cl['claim_amount_bhd'],
                    'status'    => $cl['status'],
                    'details'   => "Claim Amount: BHD " . number_format($cl['claim_amount_bhd'], 3) . " for Milestone #{$cl['milestone_id']}. Status: {$cl['status']}." . (!empty($cl['notes']) ? " Notes: {$cl['notes']}" : ""),
                    'actor'     => $cl['case_manager_name'] ?? 'Case Manager'
                ];
            }
        }

        // 8. Payments & Treasury Disbursements
        foreach ($store['payments'] ?? [] as $p) {
            $pClaimId = (int)($p['claim_id'] ?? 0);
            $pCandId = (int)($p['candidate_id'] ?? 0);
            if ($pCandId === $candidateId || in_array($pClaimId, $claimIds, true)) {
                $pDate = $p['payment_date'] ?? $regDate;
                $pTime = $p['created_at'] ?? ($pDate . ' 14:00:00');
                $activities[] = [
                    'id'        => 'act_pay_' . $p['id'],
                    'timestamp' => $pTime,
                    'date'      => $pDate,
                    'category'  => 'payment',
                    'title'     => "Treasury Disbursement Settled (BHD " . number_format($p['amount_paid_bhd'] ?? 0, 3) . ")",
                    'ref'       => $p['payment_reference'] ?? $p['receipt_number'] ?? ("PAY-{$p['id']}"),
                    'amount'    => (float)($p['amount_paid_bhd'] ?? 0),
                    'status'    => 'settled',
                    'details'   => "Disbursement processed via " . ($p['payment_method'] ?? 'Bank Transfer') . ". Receipt: " . ($p['receipt_number'] ?? 'N/A') . ". Reference: " . ($p['payment_reference'] ?? 'N/A') . ".",
                    'actor'     => 'Treasury Finance'
                ];
            }
        }

        // 9. Disputes & Terminations
        foreach ($store['disputes'] ?? [] as $d) {
            $dCandId = (int)($d['candidate_id'] ?? 0);
            $dClaimId = (int)($d['claim_id'] ?? 0);
            if ($dCandId === $candidateId || in_array($dClaimId, $claimIds, true)) {
                $dDate = $d['issue_date'] ?? $regDate;
                $dTime = $d['created_at'] ?? ($dDate . ' 15:00:00');
                $activities[] = [
                    'id'        => 'act_disp_' . $d['id'],
                    'timestamp' => $dTime,
                    'date'      => $dDate,
                    'category'  => 'dispute',
                    'title'     => "Dispute Logged: " . ($d['dispute_reason'] ?: 'Retention Discrepancy'),
                    'ref'       => $d['dispute_ref'] ?? ("DISP-{$d['id']}"),
                    'amount'    => (float)($d['disputed_amount_bhd'] ?? 0),
                    'status'    => $d['status'],
                    'details'   => "Dispute flagged on Claim #{$d['claim_id']}. Disputed Amount: BHD " . number_format($d['disputed_amount_bhd'] ?? 0, 3) . ". Status: {$d['status']}." . (!empty($d['resolution_notes']) ? " Resolution: {$d['resolution_notes']}" : ""),
                    'actor'     => 'Dispute Directorate'
                ];
            }
        }

        // 10. System Audit Logs
        foreach ($store['audit_logs'] ?? [] as $log) {
            if (($log['entity_type'] ?? '') === 'candidate' && (int)($log['entity_id'] ?? 0) === $candidateId) {
                $logTime = $log['created_at'] ?? date('Y-m-d H:i:s');
                $activities[] = [
                    'id'        => 'act_audit_' . $log['id'],
                    'timestamp' => $logTime,
                    'date'      => substr($logTime, 0, 10),
                    'category'  => 'audit',
                    'title'     => "System Audit Event: " . ucfirst(str_replace('_', ' ', $log['action'] ?? 'event')),
                    'ref'       => "AUD-{$log['id']}",
                    'amount'    => null,
                    'status'    => 'logged',
                    'details'   => $log['details'] ?? 'Audit log record',
                    'actor'     => $log['username'] ?? 'System'
                ];
            }
        }

        // Sort descending by timestamp
        usort($activities, function($a, $b) {
            return strcmp($b['timestamp'], $a['timestamp']);
        });

        return array_values($activities);
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
