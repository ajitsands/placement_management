<?php
/**
 * Event Model - Training & Career Fair Event Management and Candidate Attendance
 */

namespace App\Models;

use App\Config\Database;

class Event {
    public static function all(?string $moduleType = null, ?string $status = null, ?string $search = null): array {
        $store = Database::getStore();
        $events = $store['events'] ?? [];
        $attendees = $store['event_attendees'] ?? [];

        // Compute attendees count map
        $attendeeCountMap = [];
        foreach ($attendees as $att) {
            $eId = (int)$att['event_id'];
            $attendeeCountMap[$eId] = ($attendeeCountMap[$eId] ?? 0) + 1;
        }

        foreach ($events as &$ev) {
            $ev['attendees_count'] = $attendeeCountMap[(int)$ev['id']] ?? 0;
        }

        // Filter by module_type ('training' or 'career_fair')
        if ($moduleType !== null && $moduleType !== '' && $moduleType !== 'all') {
            $type = strtolower(trim($moduleType));
            $events = array_filter($events, function($e) use ($type) {
                return strtolower($e['module_type'] ?? 'training') === $type;
            });
        }

        // Filter by status ('upcoming', 'active', 'completed', 'cancelled')
        if ($status !== null && $status !== '' && $status !== 'all') {
            $st = strtolower(trim($status));
            $events = array_filter($events, function($e) use ($st) {
                return strtolower($e['status'] ?? 'upcoming') === $st;
            });
        }

        // Search filter
        if ($search) {
            $q = strtolower(trim($search));
            $events = array_filter($events, function($e) use ($q) {
                return str_contains(strtolower($e['title'] ?? ''), $q) ||
                       str_contains(strtolower($e['event_code'] ?? ''), $q) ||
                       str_contains(strtolower($e['location'] ?? ''), $q) ||
                       str_contains(strtolower($e['remarks'] ?? ''), $q);
            });
        }

        // Sort descending by event date
        usort($events, function($a, $b) {
            $da = $a['event_date'] ?? '';
            $db = $b['event_date'] ?? '';
            if ($da === $db) {
                return ((int)($b['id'] ?? 0)) <=> ((int)($a['id'] ?? 0));
            }
            return strcmp($db, $da);
        });

        return array_values($events);
    }

    public static function find(int $id): ?array {
        $store = Database::getStore();
        $events = $store['events'] ?? [];
        foreach ($events as $ev) {
            if ((int)$ev['id'] === $id) {
                $attendees = self::getAttendees($id);
                $ev['attendees_count'] = count($attendees);
                $ev['attendees'] = $attendees;
                return $ev;
            }
        }
        return null;
    }

    public static function generateNextCode(string $moduleType): string {
        $store = Database::getStore();
        $events = $store['events'] ?? [];
        $prefix = (strtolower(trim($moduleType)) === 'career_fair') ? 'EVT-CF-26' : 'EVT-TRN-26';

        $maxSeq = 0;
        foreach ($events as $ev) {
            $code = $ev['event_code'] ?? '';
            if (preg_match('#^' . preg_quote($prefix, '#') . '(\d+)$#i', $code, $m)) {
                $seq = (int)$m[1];
                if ($seq > $maxSeq) {
                    $maxSeq = $seq;
                }
            }
        }

        $nextSeq = $maxSeq + 1;
        return $prefix . str_pad((string)$nextSeq, 3, '0', STR_PAD_LEFT);
    }

    public static function create(array $data, ?int $userId = null): array {
        $store = Database::getStore();
        $events = $store['events'] ?? [];
        $id = count($events) > 0 ? max(array_column($events, 'id')) + 1 : 1;

        $moduleType = strtolower(trim($data['module_type'] ?? 'training'));
        if (!in_array($moduleType, ['training', 'career_fair'])) {
            $moduleType = 'training';
        }

        $eventCode = !empty($data['event_code']) ? trim($data['event_code']) : self::generateNextCode($moduleType);
        $title = trim($data['title'] ?? 'New Event');
        $eventDate = !empty($data['event_date']) ? trim($data['event_date']) : date('Y-m-d');
        $eventTime = !empty($data['event_time']) ? trim($data['event_time']) : null;
        $location = trim($data['location'] ?? 'Job Center');
        $remarks = trim($data['remarks'] ?? '');
        $status = strtolower(trim($data['status'] ?? 'upcoming'));
        if (!in_array($status, ['upcoming', 'active', 'completed', 'cancelled'])) {
            $status = 'upcoming';
        }

        $newEvent = [
            'id'          => $id,
            'event_code'  => $eventCode,
            'module_type' => $moduleType,
            'title'       => $title,
            'event_date'  => $eventDate,
            'event_time'  => $eventTime,
            'location'    => $location,
            'remarks'     => $remarks,
            'status'      => $status,
            'created_by'  => $userId,
            'created_at'  => date('Y-m-d H:i:s'),
            'updated_at'  => date('Y-m-d H:i:s')
        ];

        $store['events'][] = $newEvent;
        Database::saveStore($store);

        $newEvent['attendees_count'] = 0;
        return $newEvent;
    }

    public static function update(int $id, array $data): ?array {
        $store = Database::getStore();
        if (empty($store['events'])) return null;

        foreach ($store['events'] as &$ev) {
            if ((int)$ev['id'] === $id) {
                if (isset($data['title'])) $ev['title'] = trim($data['title']);
                if (isset($data['module_type']) && in_array(strtolower($data['module_type']), ['training', 'career_fair'])) {
                    $ev['module_type'] = strtolower(trim($data['module_type']));
                }
                if (isset($data['event_date'])) $ev['event_date'] = trim($data['event_date']);
                if (isset($data['event_time'])) $ev['event_time'] = trim($data['event_time']);
                if (isset($data['location'])) $ev['location'] = trim($data['location']);
                if (isset($data['remarks'])) $ev['remarks'] = trim($data['remarks']);
                if (isset($data['status']) && in_array(strtolower($data['status']), ['upcoming', 'active', 'completed', 'cancelled'])) {
                    $ev['status'] = strtolower(trim($data['status']));
                }
                $ev['updated_at'] = date('Y-m-d H:i:s');

                Database::saveStore($store);

                $attendees = self::getAttendees($id);
                $ev['attendees_count'] = count($attendees);
                $ev['attendees'] = $attendees;
                return $ev;
            }
        }
        return null;
    }

    public static function delete(int $id): bool {
        $store = Database::getStore();
        $found = false;

        if (!empty($store['events'])) {
            $initialCount = count($store['events']);
            $store['events'] = array_values(array_filter($store['events'], function($e) use ($id) {
                return (int)$e['id'] !== $id;
            }));
            $found = count($store['events']) < $initialCount;
        }

        if ($found && !empty($store['event_attendees'])) {
            $store['event_attendees'] = array_values(array_filter($store['event_attendees'], function($att) use ($id) {
                return (int)$att['event_id'] !== $id;
            }));
        }

        if ($found) {
            Database::saveStore($store);
        }

        return $found;
    }

    public static function getAttendees(int $eventId): array {
        $store = Database::getStore();
        $attendees = $store['event_attendees'] ?? [];
        $candidates = $store['candidates'] ?? [];

        // Build candidate lookup map
        $candMap = [];
        foreach ($candidates as $c) {
            $candMap[(int)$c['id']] = $c;
        }

        $eventAttendees = [];
        foreach ($attendees as $att) {
            if ((int)$att['event_id'] === $eventId) {
                $candId = (int)$att['candidate_id'];
                $cand = $candMap[$candId] ?? null;

                $eventAttendees[] = [
                    'id'                => (int)$att['id'],
                    'event_id'          => $eventId,
                    'candidate_id'      => $candId,
                    'status'            => $att['status'] ?? 'attended',
                    'attended_at'       => $att['attended_at'] ?? $att['created_at'] ?? date('Y-m-d H:i:s'),
                    'notes'             => $att['notes'] ?? '',
                    'created_at'        => $att['created_at'] ?? date('Y-m-d H:i:s'),
                    // Joined Candidate Details
                    'ref_no'            => $cand['ref_no'] ?? ('CAND-' . $candId),
                    'full_name'         => $cand['full_name'] ?? 'Candidate #' . $candId,
                    'cpr_no'            => $cand['cpr_no'] ?? '',
                    'phone'             => $cand['phone'] ?? '',
                    'email'             => $cand['email'] ?? '',
                    'gender'            => $cand['gender'] ?? 'Unspecified',
                    'education'         => $cand['education'] ?? 'High School',
                    'candidate_status'  => $cand['status'] ?? 'registered',
                    'center'            => $cand['center'] ?? 'Enma Mall',
                    'company_name'      => $cand['company_name'] ?? null,
                    'position_title'    => $cand['position_title'] ?? null,
                    'case_manager_name' => $cand['case_manager_name'] ?? 'Husain',
                    'registration_date' => $cand['registration_date'] ?? null
                ];
            }
        }

        // Sort latest attendees first
        usort($eventAttendees, function($a, $b) {
            return ((int)$b['id']) <=> ((int)$a['id']);
        });

        return array_values($eventAttendees);
    }

    public static function addAttendee(int $eventId, int $candidateId, string $status = 'attended', ?string $notes = null): array {
        $store = Database::getStore();
        if (!isset($store['event_attendees'])) {
            $store['event_attendees'] = [];
        }

        $status = in_array(strtolower($status), ['registered', 'attended', 'absent', 'cancelled']) 
            ? strtolower($status) 
            : 'attended';

        // Check if candidate already registered in event
        foreach ($store['event_attendees'] as &$att) {
            if ((int)$att['event_id'] === $eventId && (int)$att['candidate_id'] === $candidateId) {
                $att['status'] = $status;
                if ($notes !== null) {
                    $att['notes'] = trim($notes);
                }
                $att['updated_at'] = date('Y-m-d H:i:s');
                if ($status === 'attended' && empty($att['attended_at'])) {
                    $att['attended_at'] = date('Y-m-d H:i:s');
                }
                Database::saveStore($store);
                return $att;
            }
        }

        $id = count($store['event_attendees']) > 0 ? max(array_column($store['event_attendees'], 'id')) + 1 : 1;
        $newAttendee = [
            'id'           => $id,
            'event_id'     => $eventId,
            'candidate_id' => $candidateId,
            'status'       => $status,
            'attended_at'  => ($status === 'attended') ? date('Y-m-d H:i:s') : null,
            'notes'        => $notes ? trim($notes) : '',
            'created_at'   => date('Y-m-d H:i:s'),
            'updated_at'   => date('Y-m-d H:i:s')
        ];

        $store['event_attendees'][] = $newAttendee;
        Database::saveStore($store);
        return $newAttendee;
    }

    public static function removeAttendee(int $eventId, int $candidateId): bool {
        $store = Database::getStore();
        if (empty($store['event_attendees'])) return false;

        $beforeCount = count($store['event_attendees']);
        $store['event_attendees'] = array_values(array_filter($store['event_attendees'], function($att) use ($eventId, $candidateId) {
            return !((int)$att['event_id'] === $eventId && (int)$att['candidate_id'] === $candidateId);
        }));

        $removed = count($store['event_attendees']) < $beforeCount;
        if ($removed) {
            Database::saveStore($store);
        }
        return $removed;
    }

    public static function updateAttendee(int $eventId, int $candidateId, array $data): ?array {
        $store = Database::getStore();
        if (empty($store['event_attendees'])) return null;

        foreach ($store['event_attendees'] as &$att) {
            if ((int)$att['event_id'] === $eventId && (int)$att['candidate_id'] === $candidateId) {
                if (isset($data['status'])) {
                    $st = strtolower(trim($data['status']));
                    if (in_array($st, ['registered', 'attended', 'absent', 'cancelled'])) {
                        $att['status'] = $st;
                        if ($st === 'attended' && empty($att['attended_at'])) {
                            $att['attended_at'] = date('Y-m-d H:i:s');
                        }
                    }
                }
                if (isset($data['notes'])) {
                    $att['notes'] = trim($data['notes']);
                }
                $att['updated_at'] = date('Y-m-d H:i:s');

                Database::saveStore($store);
                return $att;
            }
        }
        return null;
    }
}
