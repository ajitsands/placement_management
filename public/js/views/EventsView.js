/**
 * Events View - Training & Career Fair Management Studio
 * Supports dual-module operation: 'training' and 'career_fair'
 * Includes Event Creation, Attendance Tracking, Candidate Auto-Linking, Direct Registration & CSV Export
 */

const { useState, useMemo, useEffect } = React;

function EventsView({ state, moduleType = 'training' }) {
  const isTraining = moduleType === 'training';
  const moduleLabel = isTraining ? 'Training' : 'Career Fair';
  const defaultCenter = isTraining ? 'Training' : 'Career Fair';

  const { events = [], candidates = [], currentUser } = state;
  const isAdminOrSuper = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  // Local state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [attendeesEvent, setAttendeesEvent] = useState(null);
  const [attendeesList, setAttendeesList] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [isAddExistingOpen, setIsAddExistingOpen] = useState(false);
  const [candSearchQuery, setCandSearchQuery] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [addAttendeeStatus, setAddAttendeeStatus] = useState('attended');
  const [addAttendeeNotes, setAddAttendeeNotes] = useState('');
  const [savingAttendee, setSavingAttendee] = useState(false);
  const [exportingEventId, setExportingEventId] = useState(null);

  // Filter events for current module
  const moduleEvents = useMemo(() => {
    return (events || []).filter(e => {
      const type = (e.module_type || 'training').toLowerCase();
      return type === moduleType.toLowerCase();
    });
  }, [events, moduleType]);

  // Filter by search & status ('active', 'completed', 'all')
  const filteredEvents = useMemo(() => {
    return moduleEvents.filter(e => {
      const st = (e.status || 'active').toLowerCase();
      const isEvCompleted = st === 'completed';
      if (statusFilter === 'active') {
        if (isEvCompleted) return false;
      } else if (statusFilter === 'completed') {
        if (!isEvCompleted) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchCode = (e.event_code || '').toLowerCase().includes(q);
        const matchLoc = (e.location || '').toLowerCase().includes(q);
        const matchRem = (e.remarks || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchLoc && !matchRem) return false;
      }
      return true;
    });
  }, [moduleEvents, statusFilter, search]);

  // Statistics (Active, Completed, All, Attended Candidates)
  const stats = useMemo(() => {
    const total = moduleEvents.length;
    const completed = moduleEvents.filter(e => (e.status || '').toLowerCase() === 'completed').length;
    const active = total - completed;
    const totalAttendees = moduleEvents.reduce((acc, e) => acc + (parseInt(e.attendees_count, 10) || 0), 0);
    return { total, active, completed, totalAttendees };
  }, [moduleEvents]);

  // Load attendees for an event (silent option keeps datatable mounted without loading spinner)
  const loadAttendees = async (eventId, silent = false) => {
    if (!silent) {
      setLoadingAttendees(true);
    }
    try {
      const res = await window.api.events.getAttendees(eventId);
      setAttendeesList(res?.attendees || []);
    } catch (err) {
      window.AppStore.showNotification('Error loading attendees: ' + err.message, 'error');
    } finally {
      if (!silent) {
        setLoadingAttendees(false);
      }
    }
  };

  const handleOpenAttendees = (event) => {
    setAttendeesEvent(event);
    setIsAttendeesModalOpen(true);
    loadAttendees(event.id);
  };

  // Open Create/Edit Event Modal
  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (event) => {
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleDeleteEvent = async (event) => {
    const swal = window.Swal || window.swal;
    if (swal) {
      const res = await swal.fire({
        title: 'Delete Event?',
        text: `Are you sure you want to delete event "${event.title}"? All attendance links will be removed.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel'
      });
      if (!res.isConfirmed) return;
    }
    try {
      await window.api.events.delete(event.id);
      window.AppStore.showNotification(`Event "${event.title}" removed`, 'success');
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error deleting event: ' + err.message, 'error');
    }
  };

  // Toggle Event Status between Active and Completed
  const handleToggleEventStatus = async (event, newStatus) => {
    try {
      await window.api.events.update(event.id, { status: newStatus });
      window.AppStore.showNotification(`Event marked as ${newStatus === 'completed' ? 'Completed' : 'Active'}`, 'success');
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error updating event status: ' + err.message, 'error');
    }
  };

  // Add existing candidate to event
  const handleAddExistingCandidate = async (e) => {
    e.preventDefault();
    if (!selectedCandidateId || !attendeesEvent) return;

    setSavingAttendee(true);
    try {
      await window.api.events.addAttendee(attendeesEvent.id, {
        candidate_id: parseInt(selectedCandidateId, 10),
        status: addAttendeeStatus,
        notes: addAttendeeNotes.trim()
      });
      window.AppStore.showNotification('Candidate added to event attendees successfully', 'success');
      // Reset form fields but keep panel open so user can immediately add another candidate
      setSelectedCandidateId('');
      setCandSearchQuery('');
      setAddAttendeeNotes('');
      setAddAttendeeStatus('attended');
      setIsAddExistingOpen(true);
      // Silent load so datatable updates in place without loading spinner jump
      await loadAttendees(attendeesEvent.id, true);
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error adding candidate: ' + err.message, 'error');
    } finally {
      setSavingAttendee(false);
    }
  };

  // Remove attendee from event
  const handleRemoveAttendee = async (candidateId, candName) => {
    if (!attendeesEvent) return;
    const swal = window.Swal || window.swal;
    if (swal) {
      const res = await swal.fire({
        title: 'Remove Attendee?',
        text: `Remove ${candName || 'candidate'} from this event's attendee record?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, Remove'
      });
      if (!res.isConfirmed) return;
    }
    try {
      await window.api.events.removeAttendee(attendeesEvent.id, candidateId);
      window.AppStore.showNotification('Attendee removed', 'info');
      await loadAttendees(attendeesEvent.id, true);
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error removing attendee: ' + err.message, 'error');
    }
  };

  // Update attendee attendance status
  const handleUpdateAttendeeStatus = async (candidateId, newStatus) => {
    if (!attendeesEvent) return;
    try {
      await window.api.events.updateAttendee(attendeesEvent.id, candidateId, { status: newStatus });
      await loadAttendees(attendeesEvent.id, true);
      window.AppStore.showNotification('Attendance status updated to ' + newStatus, 'success');
    } catch (err) {
      window.AppStore.showNotification('Error updating status: ' + err.message, 'error');
    }
  };

  // Direct Candidate Registration from Event Studio
  const handleRegisterNewCandidateFromEvent = () => {
    if (!attendeesEvent) return;
    // Launch candidate registration modal with prefilled center and eventId
    window.AppStore.openModal('NEW_CANDIDATE', {
      initialCenter: defaultCenter,
      eventId: attendeesEvent.id,
      onCandidateCreated: async () => {
        await loadAttendees(attendeesEvent.id);
        await window.AppStore.refreshData();
      }
    });
  };

  // Export Attendees to CSV
  const handleExportAttendeesCSV = () => {
    if (!attendeesList || attendeesList.length === 0) {
      window.AppStore.showNotification('No attendees to export', 'warning');
      return;
    }

    const headers = [
      '#',
      'Event Code',
      'Event Title',
      'Event Date',
      'Candidate Ref',
      'Candidate Full Name',
      'CPR Number',
      'Contact Phone',
      'Contact Email',
      'Center',
      'Education',
      'Candidate Status',
      'Attendance Status',
      'Attended At',
      'Remarks / Notes'
    ];

    const rows = attendeesList.map((a, idx) => [
      idx + 1,
      `"${attendeesEvent?.event_code || ''}"`,
      `"${attendeesEvent?.title || ''}"`,
      `"${attendeesEvent?.event_date || ''}"`,
      `"${a.ref_no || ''}"`,
      `"${a.full_name || ''}"`,
      `"${a.cpr_no || ''}"`,
      `"${a.phone || ''}"`,
      `"${a.email || ''}"`,
      `"${a.center || defaultCenter}"`,
      `"${a.education || ''}"`,
      `"${a.candidate_status || ''}"`,
      `"${a.status || 'attended'}"`,
      `"${a.attended_at || ''}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filename = `${moduleLabel.replace(/\s+/g, '_')}_${attendeesEvent?.event_code || 'Event'}_Attendees_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.AppStore.showNotification(`Exported ${attendeesList.length} attendees to CSV`, 'success');
  };

  // Direct CSV Export from Event Card for attended candidates
  const handleExportEventAttendees = async (event) => {
    setExportingEventId(event.id);
    try {
      const res = await window.api.events.getAttendees(event.id);
      const attendees = res?.attendees || [];

      if (!attendees || attendees.length === 0) {
        window.AppStore.showNotification(`No candidates have attended "${event.title}" yet.`, 'warning');
        return;
      }

      const headers = [
        '#',
        'Event Code',
        'Event Title',
        'Event Date',
        'Candidate Ref',
        'Candidate Full Name',
        'CPR Number',
        'Contact Phone',
        'Contact Email',
        'Center',
        'Education',
        'Gender',
        'Candidate Status',
        'Attendance Status',
        'Attended At',
        'Notes / Remarks'
      ];

      const rows = attendees.map((a, idx) => [
        idx + 1,
        `"${event.event_code || ''}"`,
        `"${(event.title || '').replace(/"/g, '""')}"`,
        `"${event.event_date || ''}"`,
        `"${a.ref_no || ''}"`,
        `"${(a.full_name || '').replace(/"/g, '""')}"`,
        `"${a.cpr_no || ''}"`,
        `"${a.phone || ''}"`,
        `"${a.email || ''}"`,
        `"${a.center || defaultCenter}"`,
        `"${a.education || ''}"`,
        `"${a.gender || ''}"`,
        `"${a.candidate_status || ''}"`,
        `"${a.status || 'attended'}"`,
        `"${a.attended_at || ''}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const safeTitle = (event.title || 'Event').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      const filename = `${moduleLabel.replace(/\s+/g, '_')}_${event.event_code || 'Event'}_${safeTitle}_Attendees.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.AppStore.showNotification(`Exported ${attendees.length} candidate attendee(s) for "${event.title}" to CSV`, 'success');
    } catch (err) {
      window.AppStore.showNotification('Error exporting attendees: ' + err.message, 'error');
    } finally {
      setExportingEventId(null);
    }
  };

  // Existing candidates available to add (exclude already attending candidates)
  const existingCandidatesAvailable = useMemo(() => {
    const attendingIds = new Set(attendeesList.map(a => parseInt(a.candidate_id, 10)));
    return (candidates || []).filter(c => !attendingIds.has(parseInt(c.id, 10)));
  }, [candidates, attendeesList]);

  // Filtered candidate options for searchable picker
  const filteredCandidatesToAdd = useMemo(() => {
    if (!candSearchQuery.trim()) return existingCandidatesAvailable.slice(0, 15);
    const q = candSearchQuery.toLowerCase().trim();
    return existingCandidatesAvailable.filter(c => {
      return (c.full_name || '').toLowerCase().includes(q) ||
             (c.cpr_no || '').toLowerCase().includes(q) ||
             (c.ref_no || '').toLowerCase().includes(q) ||
             (c.phone || '').toLowerCase().includes(q);
    }).slice(0, 20);
  }, [existingCandidatesAvailable, candSearchQuery]);

  return (
    <div className="view-container">
      {/* Talent & Workforce Events Module Switcher */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '4px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-light)',
        marginBottom: '1rem',
        gap: '4px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <button
          type="button"
          onClick={() => window.AppStore.setActiveTab('candidates')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'var(--transition)'
          }}
          title="Return to Candidates Talent Pool"
        >
          <span>👥</span>
          <span>Candidates Talent Pool</span>
        </button>

        <button
          type="button"
          onClick={() => isTraining ? null : window.AppStore.setActiveTab('training')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: isTraining ? 'var(--primary)' : 'transparent',
            color: isTraining ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: isTraining ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'var(--transition)'
          }}
        >
          <span>🎓</span>
          <span>Training Module</span>
        </button>

        <button
          type="button"
          onClick={() => !isTraining ? null : window.AppStore.setActiveTab('career_fair')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: !isTraining ? 'var(--primary)' : 'transparent',
            color: !isTraining ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: !isTraining ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transition: 'var(--transition)'
          }}
        >
          <span>🎪</span>
          <span>Career Fair Module</span>
        </button>
      </div>

      {/* View Header with Title, Actions & Search */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.6rem' }}>{isTraining ? '🎓' : '🎪'}</span>
            <div>
              <h1 className="view-title" style={{ margin: 0 }}>{moduleLabel} Module</h1>
              <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isTraining 
                  ? 'Plan workforce readiness & skill-building sessions, track attended candidates, and register new talent on-site.'
                  : 'Organize recruitment fairs & direct walk-in hiring drives, view attended jobseekers, and register new candidates directly.'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem', fontWeight: 700 }}
            onClick={handleOpenCreateEvent}
          >
            <span>➕</span>
            <span>Create {moduleLabel} Event</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
        {/* Status Filter Tabs: Active, Completed, All */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto' }}>
          {[
            { id: 'active', label: '🟢 Active Events', count: stats.active },
            { id: 'completed', label: '✅ Completed Events', count: stats.completed },
            { id: 'all', label: '📋 All Events', count: stats.total }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: statusFilter === tab.id ? 'var(--primary)' : 'var(--border-light)',
                background: statusFilter === tab.id ? 'var(--primary)' : 'transparent',
                color: statusFilter === tab.id ? '#fff' : 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                background: statusFilter === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
                color: statusFilter === tab.id ? '#fff' : 'var(--text-muted)',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
          <input
            type="text"
            className="input-control"
            placeholder={`Search ${moduleLabel} events...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.2rem', margin: 0, height: '36px', fontSize: '0.82rem' }}
          />
        </div>
      </div>

      {/* Events Cards Grid */}
      {filteredEvents.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{isTraining ? '📚' : '🎪'}</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.4rem' }}>No {moduleLabel} Events Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '450px', margin: '0 auto 1.25rem' }}>
            {search || statusFilter !== 'all' 
              ? 'No events match your selected filters. Try clearing search filters.'
              : `Start by creating your first ${moduleLabel.toLowerCase()} event to organize registrations and track attending candidates.`}
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleOpenCreateEvent}>
            ➕ Create New {moduleLabel} Event
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
          {filteredEvents.map(event => {
            const attendeesCount = parseInt(event.attendees_count, 10) || 0;
            const isCompleted = (event.status || '').toLowerCase() === 'completed';
            const statusColor = isCompleted ? '#8b5cf6' : '#10b981';
            const statusLabel = isCompleted ? 'Completed' : 'Active';
            const statusIcon = isCompleted ? '✅' : '🟢';

            return (
              <div
                key={event.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  padding: '1.25rem',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div>
                  {/* Card Header: Code & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{
                      background: 'rgba(37,99,235,0.08)',
                      color: 'var(--primary)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      fontFamily: 'monospace'
                    }}>
                      {event.event_code}
                    </span>

                    <span style={{
                      background: `${statusColor}18`,
                      color: statusColor,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      <span>{statusIcon}</span>
                      <span>{statusLabel}</span>
                    </span>
                  </div>

                  {/* Event Title */}
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.65rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {event.title}
                  </h3>

                  {/* Date, Time & Location Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ color: 'var(--primary)' }}>📅</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{window.formatAppDate(event.event_date)}</strong>
                      {event.event_time && (
                        <span style={{ color: 'var(--text-muted)' }}>• {event.event_time}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                      <span style={{ color: '#ef4444' }}>📍</span>
                      <span style={{ fontWeight: 600 }}>{event.location}</span>
                    </div>

                    {event.remarks && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                        {event.remarks}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Attendees pill & Action buttons */}
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleOpenAttendees(event)}
                    style={{
                      background: attendeesCount > 0 ? 'rgba(16,185,129,0.12)' : 'var(--bg-tertiary)',
                      color: attendeesCount > 0 ? '#059669' : 'var(--text-secondary)',
                      border: '1px solid',
                      borderColor: attendeesCount > 0 ? 'rgba(16,185,129,0.3)' : 'var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer'
                    }}
                    title="View attendee details & register talent"
                  >
                    <span>👥</span>
                    <span>{attendeesCount} Attended Candidate{attendeesCount === 1 ? '' : 's'}</span>
                    <span style={{ fontSize: '0.7rem' }}>→</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {/* Quick Toggle Active / Completed */}
                    {isCompleted ? (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleToggleEventStatus(event, 'active')}
                        title="Reopen event as active"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', color: '#0284c7', borderColor: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <span>🔄</span>
                        <span>Mark Active</span>
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleToggleEventStatus(event, 'completed')}
                        title="Mark event as completed"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', color: '#059669', borderColor: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <span>✓</span>
                        <span>Mark Completed</span>
                      </button>
                    )}

                    {/* Export Button with Icon, Label & Tooltip */}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleExportEventAttendees(event)}
                      disabled={exportingEventId === event.id}
                      title={`Export candidate attendees for "${event.title}" to CSV`}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: attendeesCount > 0 ? '#059669' : 'var(--text-muted)',
                        borderColor: attendeesCount > 0 ? 'rgba(16,185,129,0.45)' : 'var(--border-light)',
                        background: attendeesCount > 0 ? 'rgba(16,185,129,0.08)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      aria-label="Export"
                    >
                      <span>{exportingEventId === event.id ? '⏳' : '📥'}</span>
                      <span>Export</span>
                    </button>

                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleOpenEditEvent(event)}
                      title="Edit event"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      ✏️
                    </button>
                    {isAdminOrSuper && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDeleteEvent(event)}
                        title="Delete event"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger)' }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== CREATE / EDIT EVENT MODAL ==================== */}
      {isEventModalOpen && (
        <EventFormModal
          moduleType={moduleType}
          moduleLabel={moduleLabel}
          event={editingEvent}
          onClose={() => setIsEventModalOpen(false)}
          onSaved={async () => {
            setIsEventModalOpen(false);
            await window.AppStore.refreshData();
          }}
        />
      )}

      {/* ==================== EVENT ATTENDEES STUDIO MODAL ==================== */}
      {isAttendeesModalOpen && attendeesEvent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '96vw', maxWidth: '1440px', maxHeight: '94vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{
                    background: 'rgba(37,99,235,0.1)',
                    color: 'var(--primary)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    fontFamily: 'monospace'
                  }}>
                    {attendeesEvent.event_code}
                  </span>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                    {attendeesEvent.title}
                  </h2>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span>📅 <strong>{window.formatAppDate(attendeesEvent.event_date)}</strong></span>
                  {attendeesEvent.event_time && <span>⏰ {attendeesEvent.event_time}</span>}
                  <span>📍 {attendeesEvent.location}</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setIsAttendeesModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Top Studio Action Bar */}
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Attending Candidates Pool ({attendeesList.length})
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Track attending talent, record status, or perform instant on-site registrations
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Button 1: Direct On-Site Candidate Registration */}
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                    onClick={handleRegisterNewCandidateFromEvent}
                    title={`Register a new candidate in the system with Center prefilled to ${defaultCenter}`}
                  >
                    <span>➕</span>
                    <span>Register New Candidate</span>
                  </button>

                  {/* Button 2: Add Existing Candidate from Pool */}
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                    onClick={() => {
                      setIsAddExistingOpen(true);
                      setCandSearchQuery('');
                      setSelectedCandidateId('');
                    }}
                  >
                    <span>👤</span>
                    <span>Add Existing Candidate</span>
                  </button>

                  {/* Button 3: Export Attendees to CSV */}
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                    onClick={handleExportAttendeesCSV}
                  >
                    <span>📥</span>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Add Existing Candidate Picker Sub-Panel (Enhanced Visibility & Textarea Notes) */}
              {isAddExistingOpen && (
                <form
                  onSubmit={handleAddExistingCandidate}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '2px solid var(--primary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 4px 20px rgba(37, 99, 235, 0.15)',
                    overflow: 'hidden',
                    marginBottom: '0.5rem',
                    transition: 'var(--transition)'
                  }}
                >
                  {/* High-Visibility Header Bar */}
                  <div style={{
                    background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0.05) 100%)',
                    borderBottom: '1px solid rgba(37, 99, 235, 0.2)',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <span style={{ fontSize: '1.15rem' }}>👤</span>
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--primary)', fontWeight: 800 }}>
                          Link Candidate to this {moduleLabel} Event
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Search candidates from the national pool, set their attendance status, and record notes
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)'
                      }}
                      onClick={() => setIsAddExistingOpen(false)}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Row 1: Candidate Picker + Attendance Status */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Search & Select Candidate *</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {filteredCandidatesToAdd.length} available
                          </span>
                        </label>
                        <div style={{ position: 'relative', marginBottom: '0.45rem' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>🔍</span>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="Type CPR number, name, reference or phone..."
                            value={candSearchQuery}
                            onChange={e => setCandSearchQuery(e.target.value)}
                            style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.82rem', margin: 0 }}
                          />
                        </div>
                        <select
                          className="select-control"
                          value={selectedCandidateId}
                          onChange={e => setSelectedCandidateId(e.target.value)}
                          required
                          style={{ height: '38px', fontSize: '0.84rem', fontWeight: 600, borderColor: selectedCandidateId ? 'var(--primary)' : undefined }}
                        >
                          <option value="">-- Click to Select Candidate --</option>
                          {filteredCandidatesToAdd.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.full_name} (CPR: {c.cpr_no} • Ref: {c.ref_no} • Center: {c.center || 'Enma Mall'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                          Attendance Status *
                        </label>
                        <select
                          className="select-control"
                          value={addAttendeeStatus}
                          onChange={e => setAddAttendeeStatus(e.target.value)}
                          style={{ height: '38px', fontSize: '0.84rem', fontWeight: 700 }}
                        >
                          <option value="attended">✓ Attended (Present on-site)</option>
                          <option value="registered">⏳ Registered (RSVP confirmed)</option>
                          <option value="absent">✕ Absent (Did not attend)</option>
                        </select>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
                          Candidates marked as "Attended" will automatically reflect in this session's attendance tally.
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Notes / Remarks as TEXTAREA */}
                    <div>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                        Session Notes & Remarks
                      </label>
                      <textarea
                        className="input-control"
                        rows="3"
                        placeholder="Record detailed notes, candidate evaluation, interview feedback, or session participation remarks..."
                        value={addAttendeeNotes}
                        onChange={e => setAddAttendeeNotes(e.target.value)}
                        style={{
                          fontSize: '0.84rem',
                          lineHeight: 1.5,
                          resize: 'vertical',
                          minHeight: '75px',
                          padding: '0.55rem 0.75rem'
                        }}
                      />
                    </div>

                    {/* Row 3: Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.65rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setIsAddExistingOpen(false)}
                        style={{ padding: '0.45rem 0.95rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={savingAttendee || !selectedCandidateId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontWeight: 700,
                          padding: '0.45rem 1.15rem'
                        }}
                      >
                        <span>{savingAttendee ? '⏳' : '➕'}</span>
                        <span>{savingAttendee ? 'Linking Candidate...' : 'Confirm Add to Event'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Attendees List Table */}
              {loadingAttendees ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  ⏳ Loading event attendees...
                </div>
              ) : attendeesList.length === 0 ? (
                <div style={{
                  padding: '3rem 1rem',
                  textAlign: 'center',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-light)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
                  <h4 style={{ margin: '0 0 0.35rem', fontWeight: 800 }}>No Attended Candidates Yet</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1rem' }}>
                    Candidates who participate in this event will be listed here. You can register walk-ins immediately or link existing candidates.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={handleRegisterNewCandidateFromEvent}>
                    ➕ Register Walk-in Candidate
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                        <th style={{ padding: '0.65rem 0.75rem' }}>#</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Candidate</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>CPR No.</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Contact</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Status in Pool</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Attendance</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Notes</th>
                        <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendeesList.map((att, idx) => {
                        const attColor = 
                          att.status === 'attended' ? '#10b981' :
                          att.status === 'absent' ? '#ef4444' : '#0284c7';

                        return (
                          <tr key={att.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            
                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{att.full_name}</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ref: {att.ref_no}</span>
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>
                              {att.cpr_no || '—'}
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              <div>{att.phone || '—'}</div>
                              {att.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{att.email}</div>}
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.78rem' }}>
                                {att.candidate_status || 'registered'}
                              </span>
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              <select
                                className="select-control"
                                value={att.status || 'attended'}
                                onChange={e => handleUpdateAttendeeStatus(att.candidate_id, e.target.value)}
                                style={{
                                  padding: '0.2rem 0.45rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  height: '28px',
                                  color: attColor,
                                  borderColor: `${attColor}60`
                                }}
                              >
                                <option value="attended">✓ Attended</option>
                                <option value="registered">⏳ Registered</option>
                                <option value="absent">✕ Absent</option>
                              </select>
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.75rem', maxWidth: '300px', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                              {att.notes || '—'}
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.85rem' }}
                                onClick={() => handleRemoveAttendee(att.candidate_id, att.full_name)}
                                title="Remove attendee from event"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Total Attendees Recorded: <strong>{attendeesList.length}</strong>
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => setIsAttendeesModalOpen(false)}>
                Close Studio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Modal to Create or Edit an Event
function EventFormModal({ moduleType, moduleLabel, event, onClose, onSaved }) {
  const isEditing = Boolean(event);

  const [form, setForm] = useState({
    event_code: event?.event_code || '',
    module_type: event?.module_type || moduleType,
    title: event?.title || '',
    event_date: event?.event_date || new Date().toISOString().split('T')[0],
    event_time: event?.event_time || '09:00 AM - 01:00 PM',
    location: event?.location || (moduleType === 'training' ? 'Training Center - Hall 1' : 'Enma Mall Atrium'),
    status: event?.status || 'active',
    remarks: event?.remarks || ''
  });

  const [saving, setSaving] = useState(false);

  // Auto-generate preview code if creating new
  useEffect(() => {
    if (!isEditing && !form.event_code) {
      window.api.events.getNextCode(moduleType)
        .then(res => {
          if (res?.next_code) {
            setForm(prev => ({ ...prev, event_code: res.next_code }));
          }
        })
        .catch(() => {});
    }
  }, [isEditing, moduleType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.location.trim() || !form.event_date) {
      window.AppStore.showNotification('Title, Location and Date are mandatory', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await window.api.events.update(event.id, form);
        window.AppStore.showNotification(`${moduleLabel} event updated successfully`, 'success');
      } else {
        await window.api.events.create(form);
        window.AppStore.showNotification(`${moduleLabel} event created successfully`, 'success');
      }
      onSaved();
    } catch (err) {
      window.AppStore.showNotification('Error saving event: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? `✏️ Edit ${moduleLabel} Event` : `➕ Create New ${moduleLabel} Event`}
          </h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Event Code</label>
                <input
                  type="text"
                  className="input-control"
                  value={form.event_code}
                  readOnly={!isEditing}
                  onChange={e => setForm({ ...form, event_code: e.target.value })}
                  style={{ fontFamily: 'monospace', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status *</label>
                <select
                  className="select-control"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  required
                >
                  <option value="active">Active (Ongoing / Scheduled)</option>
                  <option value="completed">Completed (Concluded)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Event Title *</label>
              <input
                type="text"
                className="input-control"
                placeholder={moduleType === 'training' ? 'e.g. Workplace Ethics & Onboarding Workshop' : 'e.g. Annual Banking & Hospitality Job Fair 2026'}
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Event Date *</label>
                <input
                  type="date"
                  className="input-control"
                  value={form.event_date}
                  onChange={e => setForm({ ...form, event_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time / Schedule</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. 09:00 AM - 01:00 PM"
                  value={form.event_time}
                  onChange={e => setForm({ ...form, event_time: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Location / Venue *</label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. Enma Mall Atrium, Riffa / Bahrain Polytechnic Hall 2"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Remarks / Description</label>
              <textarea
                className="input-control"
                rows="3"
                placeholder="Session objectives, candidate instructions, or corporate sponsors..."
                value={form.remarks}
                onChange={e => setForm({ ...form, remarks: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

window.EventsView = EventsView;

