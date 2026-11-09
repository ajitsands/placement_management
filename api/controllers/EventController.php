<?php
/**
 * Event Controller - Training & Career Fair Events and Candidate Attendees
 */

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Response;
use App\Models\Event;
use App\Models\Candidate;
use App\Models\AuditLog;

class EventController {
    public function index(array $data): void {
        $moduleType = $data['module_type'] ?? null;
        $status = $data['status'] ?? null;
        $search = $data['q'] ?? null;

        $events = Event::all($moduleType, $status, $search);

        Response::json([
            'count'  => count($events),
            'events' => $events
        ]);
    }

    public function show(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $event = Event::find($id);

        if (!$event) {
            Response::notFound("Event record not found");
        }

        Response::json($event);
    }

    public function nextCode(array $data): void {
        $moduleType = $data['module_type'] ?? 'training';
        $code = Event::generateNextCode($moduleType);
        Response::json(['next_code' => $code]);
    }

    public function create(array $data): void {
        $user = Auth::getCurrentUser();
        $title = trim($data['title'] ?? '');
        $location = trim($data['location'] ?? '');
        $eventDate = trim($data['event_date'] ?? '');

        if (empty($title)) {
            Response::error('Event Title is mandatory', 400);
        }
        if (empty($location)) {
            Response::error('Event Location is mandatory', 400);
        }
        if (empty($eventDate)) {
            Response::error('Event Date is mandatory', 400);
        }

        $newEvent = Event::create($data, (int)($user['id'] ?? 1));

        AuditLog::log(
            'EVENT_CREATED',
            'event',
            (int)$newEvent['id'],
            $newEvent['event_code'],
            "Created " . ucfirst($newEvent['module_type']) . " Event '{$newEvent['title']}' scheduled on {$newEvent['event_date']} at {$newEvent['location']}.",
            $user
        );

        Response::json($newEvent, 201, 'Event created successfully');
    }

    public function update(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = Auth::getCurrentUser();

        $existing = Event::find($id);
        if (!$existing) {
            Response::notFound("Event record not found");
        }

        $updated = Event::update($id, $data);

        AuditLog::log(
            'EVENT_UPDATED',
            'event',
            $id,
            $updated['event_code'] ?? null,
            "Updated " . ucfirst($updated['module_type'] ?? 'Event') . " '{$updated['title']}' parameters.",
            $user
        );

        Response::json($updated, 200, 'Event updated successfully');
    }

    public function delete(array $data, array $params): void {
        $id = (int)($params['id'] ?? 0);
        $user = Auth::getCurrentUser();

        $existing = Event::find($id);
        if (!$existing) {
            Response::notFound("Event record not found");
        }

        Event::delete($id);

        AuditLog::log(
            'EVENT_DELETED',
            'event',
            $id,
            $existing['event_code'] ?? null,
            "Deleted " . ucfirst($existing['module_type'] ?? 'Event') . " '{$existing['title']}'.",
            $user
        );

        Response::json(['id' => $id], 200, 'Event removed successfully');
    }

    public function attendees(array $data, array $params): void {
        $eventId = (int)($params['id'] ?? 0);
        $attendees = Event::getAttendees($eventId);

        Response::json([
            'count'     => count($attendees),
            'attendees' => $attendees
        ]);
    }

    public function addAttendee(array $data, array $params): void {
        $eventId = (int)($params['id'] ?? 0);
        $candidateId = (int)($data['candidate_id'] ?? 0);

        if (!$candidateId) {
            Response::error('Candidate ID is mandatory to record attendance', 400);
        }

        $status = !empty($data['status']) ? trim($data['status']) : 'attended';
        $notes = !empty($data['notes']) ? trim($data['notes']) : null;

        $record = Event::addAttendee($eventId, $candidateId, $status, $notes);

        // Fetch candidate details for rich client response
        $cand = Candidate::find($candidateId);
        $user = Auth::getCurrentUser();
        $event = Event::find($eventId);

        if ($cand && $event) {
            AuditLog::log(
                'EVENT_ATTENDEE_ADDED',
                'event',
                $eventId,
                $event['event_code'] ?? null,
                "Candidate {$cand['full_name']} (CPR: {$cand['cpr_no']}) marked as {$status} in event '{$event['title']}'.",
                $user
            );
        }

        Response::json($record, 201, 'Candidate attendance recorded successfully');
    }

    public function removeAttendee(array $data, array $params): void {
        $eventId = (int)($params['id'] ?? 0);
        $candidateId = (int)($params['candidateId'] ?? ($data['candidate_id'] ?? 0));

        if (!$candidateId) {
            Response::error('Candidate ID is required', 400);
        }

        Event::removeAttendee($eventId, $candidateId);

        Response::json(['event_id' => $eventId, 'candidate_id' => $candidateId], 200, 'Attendee removed from event');
    }

    public function updateAttendee(array $data, array $params): void {
        $eventId = (int)($params['id'] ?? 0);
        $candidateId = (int)($params['candidateId'] ?? ($data['candidate_id'] ?? 0));

        if (!$candidateId) {
            Response::error('Candidate ID is required', 400);
        }

        $updated = Event::updateAttendee($eventId, $candidateId, $data);
        if (!$updated) {
            Response::notFound("Attendee record not found");
        }

        Response::json($updated, 200, 'Attendance updated successfully');
    }
}

