/**
 * Disputes View - Categorized Dispute Resolution & Placement State Machine
 * Powered by DataTable with sorting, search, pagination, and CSV export.
 */

function DisputesView({ state }) {
  const { disputes = [], candidates = [], currentUser } = state;
  const { useState, useMemo, useEffect } = React;
  const SearchableSelect = window.SearchableSelect;

  const readSaved = (k, d = '') => {
    const v = sessionStorage.getItem('sands_disputes_filter_' + k);
    return v !== null ? v : d;
  };
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = readSaved('status', 'active_dispute');
    return ['active_dispute', 'reinstated', 'terminated', ''].includes(saved) ? saved : 'active_dispute';
  });
  const [selectedCandidate, setSelectedCandidate] = useState(() => readSaved('candidate'));
  const [selectedEmployer, setSelectedEmployer] = useState(() => readSaved('employer'));
  const [selectedMilestone, setSelectedMilestone] = useState(() => readSaved('milestone'));
  const [selectedCategory, setSelectedCategory] = useState(() => readSaved('category'));
  const [dateFrom, setDateFrom] = useState(() => readSaved('date_from'));
  const [dateTo, setDateTo] = useState(() => readSaved('date_to'));

  // Reset all dispute filters to default on user switch or login
  useEffect(() => {
    setStatusFilter('active_dispute');
    setSelectedCandidate('');
    setSelectedEmployer('');
    setSelectedMilestone('');
    setSelectedCategory('');
    setDateFrom('');
    setDateTo('');
  }, [currentUser?.id, currentUser?.role]);

  const persist = (setter, key) => (val) => {
    setter(val);
    sessionStorage.setItem('sands_disputes_filter_' + key, val);
  };
  const handleStatusChange = persist(setStatusFilter, 'status');
  const handleCandidateChange = persist(setSelectedCandidate, 'candidate');
  const handleEmployerChange = persist(setSelectedEmployer, 'employer');
  const handleMilestoneChange = persist(setSelectedMilestone, 'milestone');
  const handleCategoryChange = persist(setSelectedCategory, 'category');
  const handleDateFromChange = persist(setDateFrom, 'date_from');
  const handleDateToChange = persist(setDateTo, 'date_to');
  const handleClearDates = () => { handleDateFromChange(''); handleDateToChange(''); };
  const handleResetAll = () => {
    handleCandidateChange('');
    handleEmployerChange('');
    handleMilestoneChange('');
    handleCategoryChange('');
    handleClearDates();
    handleStatusChange('active_dispute');
  };

  const candidateOptions = useMemo(() => {
    const map = new Map();
    (candidates || []).forEach(c => {
      if (c && c.id) {
        map.set(String(c.id), {
          value: String(c.id),
          label: c.full_name || `Candidate #${c.id}`,
          subLabel: `CPR: ${c.cpr_no || 'N/A'} • ${c.company_name || 'Employer'}`,
          searchKeywords: `${c.full_name} ${c.cpr_no} ${c.ref_no} ${c.company_name}`
        });
      }
    });
    (disputes || []).forEach(d => {
      if (d.candidate_id && !map.has(String(d.candidate_id))) {
        map.set(String(d.candidate_id), {
          value: String(d.candidate_id),
          label: d.candidate_name || `Candidate #${d.candidate_id}`,
          subLabel: `CPR: ${d.candidate_cpr || 'N/A'} • ${d.company_name || 'Employer'}`,
          searchKeywords: `${d.candidate_name} ${d.candidate_cpr} ${d.company_name}`
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Candidates (${list.length})`, subLabel: 'Show disputes across all candidates' }, ...list];
  }, [candidates, disputes]);

  const employerOptions = useMemo(() => {
    const set = new Map();
    (disputes || []).forEach(d => {
      const comp = (d.company_name || '').trim();
      if (comp && comp !== 'N/A' && !set.has(comp.toLowerCase())) {
        set.set(comp.toLowerCase(), { value: comp, label: comp, subLabel: 'Corporate Enterprise', searchKeywords: comp });
      }
    });
    (candidates || []).forEach(c => {
      const comp = (c.company_name || '').trim();
      if (comp && comp !== 'N/A' && !set.has(comp.toLowerCase())) {
        const cr = (c.employer_cr || '').trim();
        set.set(comp.toLowerCase(), { value: comp, label: comp, subLabel: cr ? `CR: ${cr}` : 'Corporate Enterprise', searchKeywords: `${comp} ${cr}` });
      }
    });
    const list = Array.from(set.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Employers (${list.length})`, subLabel: 'Show disputes across all employers' }, ...list];
  }, [disputes, candidates]);

  const categoryOf = (d) => String(d.category || d.dispute_category || '').trim();

  const categoryOptions = useMemo(() => {
    const set = new Map();
    (disputes || []).forEach(d => {
      const cat = categoryOf(d);
      if (cat && !set.has(cat.toLowerCase())) {
        set.set(cat.toLowerCase(), { value: cat, label: cat, searchKeywords: cat });
      }
    });
    const list = Array.from(set.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Categories (${list.length})`, subLabel: 'Show disputes across all categories' }, ...list];
  }, [disputes]);

  const milestoneOptions = [
    { value: '', label: 'All Milestone Gates', subLabel: 'Show all claim types & retention checkpoints' },
    { value: 'placement', label: 'Day 0 - Placement Joining', subLabel: 'Initial contract signing & placement subsidy' },
    { value: '180_days', label: 'Day 180 - 6 Months Retention', subLabel: 'Probation completion & 6-month retention gate' },
    { value: '365_days', label: 'Day 365 - 1 Year Retention', subLabel: 'Annual completion & 12-month retention gate' }
  ];

  const statusOptions = [
    { id: 'active_dispute', label: 'Disputed' },
    { id: 'reinstated', label: 'Reinstated' },
    { id: 'terminated', label: 'Terminated' },
    { id: '', label: 'All' }
  ];

  const displayData = useMemo(() => {
    return (disputes || []).filter(d => {
      const st = String(d.status || '').toLowerCase();
      if (statusFilter) {
        if (statusFilter === 'active_dispute') {
          if (st !== 'active_dispute') return false;
        } else if (!st.includes(statusFilter)) {
          return false;
        }
      }
      if (selectedCandidate && String(d.candidate_id) !== String(selectedCandidate)) return false;
      if (selectedEmployer && (d.company_name || '').trim().toLowerCase() !== selectedEmployer.trim().toLowerCase()) return false;
      if (selectedCategory && categoryOf(d).toLowerCase() !== selectedCategory.toLowerCase()) return false;
      if (selectedMilestone) {
        const text = `${d.claim_type || ''} ${d.milestone_title || ''} ${d.milestone_type || ''}`.toLowerCase();
        if (selectedMilestone === 'placement') {
          if (!(text.includes('placement') || text.includes('day 0') || text.includes('joining'))) return false;
        } else if (selectedMilestone === '180_days') {
          if (!(text.includes('180') || text.includes('6 month') || text.includes('probation'))) return false;
        } else if (selectedMilestone === '365_days') {
          if (!(text.includes('365') || text.includes('year') || text.includes('12 month') || text.includes('annual'))) return false;
        }
      }
      if (dateFrom || dateTo) {
        const raw = d.filed_date || d.dispute_date || d.created_at || '';
        const fd = String(raw).split('T')[0].split(' ')[0];
        if (!fd || fd === '0000-00-00') return false;
        if (dateFrom && fd < dateFrom) return false;
        if (dateTo && fd > dateTo) return false;
      }
      return true;
    });
  }, [disputes, statusFilter, selectedCandidate, selectedEmployer, selectedMilestone, selectedCategory, dateFrom, dateTo]);

  const activeFiltersCount = (selectedCandidate ? 1 : 0) + (selectedEmployer ? 1 : 0) + (selectedMilestone ? 1 : 0) + (selectedCategory ? 1 : 0) +
    ((dateFrom || dateTo) ? 1 : 0) + ((statusFilter !== 'active_dispute') ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  const labelStyle = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' };
  const filterBox = (flex, min) => ({ display: 'flex', alignItems: 'center', gap: '0.45rem', flex, minWidth: min });

  const handleReinstate = async (disputeId) => {
    const swal = window.Swal || window.swal;
    const today = new Date().toISOString().split('T')[0];
    let payload = null;

    if (swal) {
      const { value, isConfirmed } = await swal.fire({
        title: 'Reinstate Placement',
        html: `
          <div style="text-align: left; display: flex; flex-direction: column; gap: 0.85rem; padding-top: 0.25rem;">
            <div>
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #1e293b); display: block; margin-bottom: 0.35rem;">
                Reinstatement Date *
              </label>
              <input id="swal-reinstate-date" type="date" class="swal2-input" value="${today}" style="margin: 0; width: 100%; box-sizing: border-box; font-size: 0.88rem; height: 2.5rem;" />
            </div>
            <div>
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #1e293b); display: block; margin-bottom: 0.35rem;">
                Reinstatement Remarks *
              </label>
              <textarea id="swal-reinstate-notes" class="swal2-textarea" placeholder="Enter remarks (e.g. Employer provided updated GOSI / CPR documentation)..." style="margin: 0; width: 100%; box-sizing: border-box; min-height: 85px; font-size: 0.85rem;"></textarea>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Confirm Reinstatement',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        preConfirm: () => {
          const date = document.getElementById('swal-reinstate-date')?.value;
          const notes = document.getElementById('swal-reinstate-notes')?.value;
          if (!date) {
            swal.showValidationMessage('Reinstatement date is required');
            return false;
          }
          if (!notes || !notes.trim()) {
            swal.showValidationMessage('Remarks are required for reinstatement audit logs');
            return false;
          }
          return { date, notes: notes.trim(), remarks: notes.trim(), reinstated_date: date };
        }
      });
      if (!isConfirmed || !value) return;
      payload = value;
    } else {
      const d = prompt('Enter Reinstatement Date (YYYY-MM-DD):', today) || today;
      const n = prompt('Enter Reinstatement Remarks (e.g. Employer provided updated GOSI / CPR documentation):');
      if (!n || !n.trim()) return;
      payload = { date: d, notes: n.trim(), remarks: n.trim(), reinstated_date: d };
    }

    try {
      await window.api.disputes.reinstate(disputeId, payload);
      if (window.Swal) {
        window.Swal.fire({
          title: 'Reinstated!',
          text: 'Candidate placement reinstated successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        window.AppStore.showNotification('Candidate placement reinstated successfully', 'success');
      }
      await window.AppStore.refreshData();
    } catch (err) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Error',
          text: 'Failed to reinstate: ' + err.message,
          icon: 'error'
        });
      } else {
        window.AppStore.showNotification('Failed to reinstate: ' + err.message, 'error');
      }
    }
  };

  const handleTerminate = async (disputeId) => {
    const swal = window.Swal || window.swal;
    const today = new Date().toISOString().split('T')[0];
    let payload = null;

    if (swal) {
      const { value, isConfirmed } = await swal.fire({
        title: 'Terminate Placement',
        html: `
          <div style="text-align: left; display: flex; flex-direction: column; gap: 0.85rem; padding-top: 0.25rem;">
            <div>
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #1e293b); display: block; margin-bottom: 0.35rem;">
                Termination Date *
              </label>
              <input id="swal-terminate-date" type="date" class="swal2-input" value="${today}" style="margin: 0; width: 100%; box-sizing: border-box; font-size: 0.88rem; height: 2.5rem;" />
            </div>
            <div>
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #1e293b); display: block; margin-bottom: 0.35rem;">
                Termination Reason / Remarks *
              </label>
              <textarea id="swal-terminate-notes" class="swal2-textarea" placeholder="Enter reason for termination under program guidelines..." style="margin: 0; width: 100%; box-sizing: border-box; min-height: 85px; font-size: 0.85rem;"></textarea>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Confirm Termination',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        preConfirm: () => {
          const date = document.getElementById('swal-terminate-date')?.value;
          const notes = document.getElementById('swal-terminate-notes')?.value;
          if (!date) {
            swal.showValidationMessage('Termination date is required');
            return false;
          }
          if (!notes || !notes.trim()) {
            swal.showValidationMessage('Termination reason is required for audit logs');
            return false;
          }
          return { date, notes: notes.trim(), remarks: notes.trim(), terminated_date: date };
        }
      });
      if (!isConfirmed || !value) return;
      payload = value;
    } else {
      const d = prompt('Enter Termination Date (YYYY-MM-DD):', today) || today;
      const n = prompt('Enter Termination Reason (Non-destructive: Candidate audit history is preserved):');
      if (!n || !n.trim()) return;
      payload = { date: d, notes: n.trim(), remarks: n.trim(), terminated_date: d };
    }

    try {
      await window.api.disputes.terminate(disputeId, payload);
      if (window.Swal) {
        window.Swal.fire({
          title: 'Terminated',
          text: 'Placement marked as terminated under audit logs.',
          icon: 'info',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        window.AppStore.showNotification('Placement marked as terminated under audit logs', 'info');
      }
      await window.AppStore.refreshData();
    } catch (err) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Error',
          text: 'Failed to terminate: ' + err.message,
          icon: 'error'
        });
      } else {
        window.AppStore.showNotification('Failed to terminate: ' + err.message, 'error');
      }
    }
  };

  const candidateLookup = useMemo(() => {
    const m = new Map();
    (candidates || []).forEach(c => { if (c && c.id) m.set(String(c.id), c); });
    return m;
  }, [candidates]);

  const categoryIcon = (cat) => {
    const c = String(cat || '').toLowerCase();
    if (c.includes('resign') || c.includes('cpr')) return '🚪';
    if (c.includes('terminat') || c.includes('cure')) return '⛔';
    if (c.includes('wage') || c.includes('gosi') || c.includes('salary')) return '💰';
    if (c.includes('retention')) return '📉';
    if (c.includes('breach') || c.includes('contract')) return '📜';
    if (c.includes('abscond') || c.includes('absen')) return '🏃';
    if (c.includes('disciplin') || c.includes('dismiss')) return '⚖️';
    return '⚠️';
  };

  const renderDisputeChildRow = (row) => {
    const cand = candidateLookup.get(String(row.candidate_id));
    const isReinstated = row.status === 'reinstated';
    const isTerminated = row.status === 'terminated';
    const isActive = row.status === 'active_dispute';
    const resDate = row.reinstated_date || row.terminated_date;
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    const claimRemarks = row.claim_remarks || row.remarks;

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.85rem',
        padding: '0.35rem 0'
      }}>
        {/* Panel 1: Detailed Grounds & Remarks */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>📝</span> Detailed Grounds / Reason
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.45, whiteSpace: 'pre-wrap', background: 'var(--bg-tertiary, #f8fafc)', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              {row.reason || row.dispute_reason || 'No specific grounds recorded.'}
            </div>
          </div>

          {claimRemarks && (
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>💬</span> Claim / Audit Remarks
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, background: 'var(--bg-tertiary, #f8fafc)', padding: '0.45rem 0.65rem', borderRadius: '6px' }}>
                {claimRemarks}
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Status Audit & Case Context */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>⚖️</span> Status Audit & Resolution History
          </div>

          {isReinstated && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              padding: '0.55rem 0.75rem',
              color: 'var(--success)'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>✓</span> Placement Reinstated
                {resDate && resDate !== '0000-00-00' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', opacity: 0.9 }}>
                    ({window.formatAppDate ? window.formatAppDate(resDate) : resDate})
                  </span>
                )}
              </div>
              {row.resolution_notes && (
                <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  <strong>Notes:</strong> {row.resolution_notes}
                </div>
              )}
            </div>
          )}

          {isTerminated && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              padding: '0.55rem 0.75rem',
              color: 'var(--danger)'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>⛔</span> Placement Terminated
                {resDate && resDate !== '0000-00-00' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', opacity: 0.9 }}>
                    ({window.formatAppDate ? window.formatAppDate(resDate) : resDate})
                  </span>
                )}
              </div>
              {row.resolution_notes && (
                <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  <strong>Notes:</strong> {row.resolution_notes}
                </div>
              )}
            </div>
          )}

          {isActive && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '6px',
              padding: '0.55rem 0.75rem',
              color: '#d97706'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>⚠️</span> Active Dispute Under Audit
              </div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                Placement claim is currently on hold pending employer / candidate verification.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.78rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-light)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Case Manager:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.case_manager_name || cand?.case_manager_name || 'System'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Milestone Gate:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.milestone_title || 'Retention Gate'}</div>
            </div>
          </div>
        </div>

        {/* Panel 3: Attachments & Details */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>📎</span> Attachments ({attachments.length})
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
              onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { dispute: row, dispute_id: row.id, from: 'disputes' })}
            >
              Full Details Modal ↗
            </button>
          </div>

          {attachments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '110px', overflowY: 'auto' }}>
              {attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.file_url || att.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="attachment-link"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    padding: '0.3rem 0.5rem',
                    background: 'var(--bg-tertiary, #f8fafc)',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    textDecoration: 'none',
                    color: 'var(--primary)'
                  }}
                  title={att.file_name || att.name}
                >
                  <span>📄</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.file_name || att.name || `Attachment ${i + 1}`}
                  </span>
                  {att.uploaded_at && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {window.formatAppDate ? window.formatAppDate(att.uploaded_at) : att.uploaded_at}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No supporting attachments uploaded for this dispute.
            </div>
          )}

          {row.claim_amount_bhd && (
            <div style={{ marginTop: 'auto', paddingTop: '0.35rem', borderTop: '1px solid var(--border-light)', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Claim Value:</span>
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                {window.formatCurrency ? window.formatCurrency(row.claim_amount_bhd) : `${row.claim_amount_bhd} BHD`}
              </strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  const columns = [
    {
      key: 'id',
      label: 'Candidate / Dispute & Claim Ref',
      sortable: true,
      render: (val, row) => {
        const cand = candidateLookup.get(String(row.candidate_id));
        const candName = row.candidate_name || cand?.full_name || '—';
        const candRef = (row.candidate_ref && row.candidate_ref !== 'N/A')
          ? row.candidate_ref
          : (cand?.ref_no || (row.candidate_id ? `CR-${row.candidate_id}` : 'N/A'));
        const claimRef = row.claim_ref || (row.claim_id ? `CLM-${String(row.claim_id).padStart(4, '0')}` : '');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              {candName}
            </strong>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>CPR: {row.candidate_cpr || cand?.cpr_no || '—'}</span>
              <span>&bull;</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{candRef}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
              <button
                type="button"
                className="badge badge-danger"
                onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { dispute: row, dispute_id: row.id, from: 'disputes' })}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  padding: '0.12rem 0.48rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  textTransform: 'none'
                }}
                title="Click to view full dispute details"
              >
                DSP-{String(row.id).padStart(4, '0')}
              </button>
              {claimRef && claimRef !== '—' && (
                <span
                  className="badge badge-info"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    padding: '0.12rem 0.48rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    textTransform: 'none'
                  }}
                  title="Claim Reference Number"
                >
                  {claimRef}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'company_name',
      label: 'Employer',
      sortable: true,
      render: (val, row) => {
        const cand = candidateLookup.get(String(row.candidate_id));
        const cr = (row.employer_cr && row.employer_cr !== 'N/A') ? row.employer_cr : (cand?.employer_cr || '');
        return (
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {val || '—'}
            </div>
            {cr ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '0.2rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '3px',
                  padding: '0.05rem 0.35rem',
                  whiteSpace: 'nowrap'
                }}
                title="Employer Commercial Registration (CR) Number"
              >
                <span style={{ opacity: 0.75 }}>CR:</span> <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{cr}</span>
              </span>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (val, row) => (
        <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {val || row.dispute_category || row.dispute_reason || '—'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status & Key Dates',
      sortable: true,
      render: (val, row) => {
        const isActive = val === 'active_dispute';
        const isReinstated = val === 'reinstated';
        const filedDate = row.filed_date || row.dispute_date;
        const resDate = row.reinstated_date || row.terminated_date;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div>
              <span className={`badge ${isActive ? 'badge-danger' : (isReinstated ? 'badge-success' : 'badge-danger')}`} style={{ fontSize: '0.72rem' }}>
                {isActive ? 'Active Dispute' : (isReinstated ? 'Reinstated' : 'Terminated')}
              </span>
            </div>
            {filedDate && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Filed: <span style={{ fontFamily: 'var(--font-mono)' }}>{window.formatAppDate ? window.formatAppDate(filedDate) : filedDate}</span>
              </div>
            )}
            {resDate && resDate !== '0000-00-00' && (
              <div style={{ fontSize: '0.72rem', color: isReinstated ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {isReinstated ? 'Reinstated:' : 'Terminated:'} <span style={{ fontFamily: 'var(--font-mono)' }}>{window.formatAppDate ? window.formatAppDate(resDate) : resDate}</span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Resolution Actions',
      sortable: false,
      render: (_, row) => {
        const isActive = row.status === 'active_dispute';
        return (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm btn-outline"
              title="View Full Dispute Record"
              onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { dispute: row, dispute_id: row.id, from: 'disputes' })}
            >
              👁️ View
            </button>
            {isActive && (
              <>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                  title="Reinstate to Active Placement"
                  onClick={() => handleReinstate(row.id)}
                >
                  🔄 Reinstate
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  title="Mark as Terminated"
                  onClick={() => handleTerminate(row.id)}
                >
                  ⛔ Terminate
                </button>
              </>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Disputes & Termination Management</h1>
          <p className="page-subtitle">
            Lifecycle tracking of employer retention failures, CPR resignations, and wage discrepancy audits
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', overflow: 'visible', position: 'relative', zIndex: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={filterBox('1 1 230px', '210px')}>
            <label style={labelStyle}><span>👤</span> Candidate:</label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <SearchableSelect options={candidateOptions} value={selectedCandidate} onChange={handleCandidateChange}
                placeholder={candidateOptions[0]?.label || 'All Candidates'} searchPlaceholder="Search candidate, CPR, ref..." />
            </div>
          </div>

          <div style={filterBox('1 1 230px', '210px')}>
            <label style={labelStyle}><span>🏢</span> Employer:</label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <SearchableSelect options={employerOptions} value={selectedEmployer} onChange={handleEmployerChange}
                placeholder={employerOptions[0]?.label || 'All Employers'} searchPlaceholder="Search company or CR..." />
            </div>
          </div>

          <div style={filterBox('1 1 230px', '210px')}>
            <label style={labelStyle}><span>🏷️</span> Category:</label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <SearchableSelect options={categoryOptions} value={selectedCategory} onChange={handleCategoryChange}
                placeholder="All Categories" searchPlaceholder="Search category..." />
            </div>
          </div>

          <div style={filterBox('1 1 210px', '190px')}>
            <label style={labelStyle}><span>🎯</span> Milestone:</label>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <SearchableSelect options={milestoneOptions} value={selectedMilestone} onChange={handleMilestoneChange}
                placeholder="All Milestone Gates" searchPlaceholder="Search gate (Day 0, 180, 365)..." />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
            <label style={labelStyle}><span>📅</span> Filed Date:</label>
            <input type="date" className="input-control" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
              value={dateFrom} onChange={e => handleDateFromChange(e.target.value)} title="Filed Date From" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>to</span>
            <input type="date" className="input-control" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
              value={dateTo} onChange={e => handleDateToChange(e.target.value)} title="Filed Date To" />
            {(dateFrom || dateTo) && (
              <button type="button" onClick={handleClearDates} title="Clear Filed Date filter"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.85rem', padding: '0 0.25rem', lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.25rem' }}>Status:</span>
            {statusOptions.map(tab => (
              <button key={tab.id || 'all'} type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                onClick={() => handleStatusChange(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm btn-outline"
              style={{ fontSize: '0.76rem', color: 'var(--danger)', borderColor: 'var(--danger)', padding: '0.25rem 0.65rem' }}
              onClick={handleResetAll} title="Reset all active filters">
              ✕ Clear All Filters ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          expandable={true}
          renderChildRow={renderDisputeChildRow}
          searchPlaceholder="🔍 Search Candidate, Ref, CPR, Employer, Dispute Reason, Case Manager..."
          searchKeys={[
            'id',
            'candidate_name',
            'candidate_cpr',
            'candidate_ref',
            'company_name',
            'employer_cr',
            'category',
            'dispute_category',
            'reason',
            'dispute_reason',
            'remarks',
            'claim_remarks',
            'status',
            'case_manager_name',
            'milestone_title',
            'claim_ref'
          ]}
          exportFilename="Disputes_Audit_SaNDS.csv"
          emptyMessage="No dispute records found."
        />
      </div>
    </div>
  );
}

window.DisputesView = DisputesView;
