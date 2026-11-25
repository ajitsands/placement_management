/**
 * Candidates View - Candidate Registry & National Talent Pool
 * Powered by DataTable with multi-column search, sorting, pagination, and document vault.
 * Scoped by Case Manager for case_manager role; Global for Admin/Superadmin.
 */

function CandidatesView({ state }) {
  const { useState, useMemo, useEffect } = React;
  const { candidates = [], jobs = [], currentUser = {}, caseManagers = [], settings = {} } = state || {};
  const isAdminOrSuper = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  const currency = settings.currency || 'BHD';

  const [scopeFilter, setScopeFilter] = useState(() => {
    const saved = sessionStorage.getItem('sands_claims_cand_scope');
    return saved === 'global' ? 'global' : 'mine';
  });
  const [selectedCaseManager, setSelectedCaseManager] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_cm') || '';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = sessionStorage.getItem('sands_claims_cand_status_v2');
    return saved || 'registered';
  });
  const [selectedHotList, setSelectedHotList] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_hot_list') || 'all';
  });
  const [selectedCenter, setSelectedCenter] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_center') || 'all';
  });
  const [selectedTamkeenFilter, setSelectedTamkeenFilter] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_tamkeen') || 'all';
  });

  // Reset all candidate filters to default on user switch or login
  useEffect(() => {
    setScopeFilter('mine');
    sessionStorage.setItem('sands_claims_cand_scope', 'mine');
    setSelectedCaseManager('');
    setStatusFilter('registered');
    setSelectedHotList('all');
    setSelectedCenter('all');
    setSelectedTamkeenFilter('all');
  }, [currentUser?.id, currentUser?.role]);

  const handleScopeChange = (val) => {
    setScopeFilter(val);
    sessionStorage.setItem('sands_claims_cand_scope', val);
  };

  const handleTamkeenFilterChange = (val) => {
    setSelectedTamkeenFilter(val);
    sessionStorage.setItem('sands_claims_cand_tamkeen', val);
  };

  const handleStatusFilterChange = (key) => {
    setStatusFilter(key);
    sessionStorage.setItem('sands_claims_cand_status_v2', key);
    sessionStorage.setItem('sands_claims_cand_status', key);
  };

  // Listen for programmatic status filter change (e.g. from candidate registration modal)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        setStatusFilter(e.detail);
        sessionStorage.setItem('sands_claims_cand_status_v2', e.detail);
        sessionStorage.setItem('sands_claims_cand_status', e.detail);
      }
    };
    window.addEventListener('cand_filter_status_change', handler);
    return () => window.removeEventListener('cand_filter_status_change', handler);
  }, []);

  const handleCaseManagerChange = (cm) => {
    setSelectedCaseManager(cm);
    sessionStorage.setItem('sands_claims_cand_cm', cm);
  };

  const handleHotListChange = (val) => {
    setSelectedHotList(val);
    sessionStorage.setItem('sands_claims_cand_hot_list', val);
  };

  const handleCenterChange = (center) => {
    setSelectedCenter(center);
    sessionStorage.setItem('sands_claims_cand_center', center);
  };

  const hotListFilterOptions = useMemo(() => {
    const defaults = ['Priority Placement', 'VIP / Executive', 'Immediate Joiner', 'High Demand Skill', 'Tamkeen Priority'];
    let configured = [];
    const raw = settings?.hot_list_options;
    if (Array.isArray(raw)) {
      configured = raw;
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      try {
        const parsed = JSON.parse(raw);
        configured = Array.isArray(parsed) ? parsed : raw.split(',').map(s => s.trim()).filter(Boolean);
      } catch (e) {
        configured = raw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const base = configured.length > 0 ? configured : defaults;
    const set = new Set(base.map(t => String(t).trim()).filter(Boolean));
    (candidates || []).forEach(c => {
      if (Array.isArray(c.hot_lists)) {
        c.hot_lists.forEach(t => {
          const clean = String(t || '').trim();
          if (clean) set.add(clean);
        });
      }
    });
    return Array.from(set);
  }, [settings?.hot_list_options, candidates]);

  const parseDateStr = (raw) => {
    if (!raw) return '';
    const str = String(raw).trim().split('T')[0].split(' ')[0];
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    const mMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (mMatch) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = months.findIndex(m => m.toLowerCase() === mMatch[2].toLowerCase());
      if (mIdx !== -1) {
        return `${mMatch[3]}-${String(mIdx + 1).padStart(2, '0')}-${mMatch[1].padStart(2, '0')}`;
      }
    }
    return str;
  };

  const handleClearAllFilters = () => {
    setSelectedCaseManager('');
    setStatusFilter('registered');
    setSelectedHotList('all');
    setSelectedCenter('all');
    setSelectedTamkeenFilter('all');
    sessionStorage.removeItem('sands_claims_cand_cm');
    sessionStorage.setItem('sands_claims_cand_status_v2', 'registered');
    sessionStorage.setItem('sands_claims_cand_status', 'registered');
    sessionStorage.removeItem('sands_claims_cand_hot_list');
    sessionStorage.removeItem('sands_claims_cand_center');
    sessionStorage.removeItem('sands_claims_cand_tamkeen');
  };

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCaseManager) count++;
    if (statusFilter && statusFilter !== 'registered') count++;
    if (selectedHotList && selectedHotList !== 'all') count++;
    if (selectedCenter && selectedCenter !== 'all') count++;
    if (selectedTamkeenFilter && selectedTamkeenFilter !== 'all') count++;
    return count;
  }, [selectedCaseManager, statusFilter, selectedHotList, selectedCenter, selectedTamkeenFilter]);

  // Tamkeen Approval summary counters
  const pendingTamkeenCount = useMemo(() => {
    return candidates.filter(c => !(c.approved_by_tamkeen === true || String(c.approved_by_tamkeen || '').toLowerCase() === 'yes')).length;
  }, [candidates]);

  const approvedTamkeenCount = useMemo(() => {
    return candidates.filter(c => c.approved_by_tamkeen === true || String(c.approved_by_tamkeen || '').toLowerCase() === 'yes').length;
  }, [candidates]);

  // Helper to determine if a candidate belongs to the Incomplete Profile category
  const isCandidateIncomplete = (c) => {
    if (!c) return false;
    const st = String(c.status || '').toLowerCase().trim();
    if (st === 'registration_incomplete' || st === 'registration_not_completed' || st === 'incomplete' || st === 'pending_registration') {
      return true;
    }
    // If checklist items exist, check if any mandatory item is unchecked
    if (Array.isArray(c.checklist_items) && c.checklist_items.length > 0) {
      const hasMissingMandatory = c.checklist_items.some(item => {
        const isMandatory = item.is_mandatory === 1 || item.is_mandatory === true || item.is_mandatory === '1';
        const isDone = item.completed === true || item.completed === 1 || item.is_checked === true || item.is_checked === 1;
        return isMandatory && !isDone;
      });
      if (hasMissingMandatory) return true;
    } else if (c.checklist_completion_pct !== undefined && c.checklist_completion_pct !== null) {
      if (Number(c.checklist_completion_pct) < 100 && st !== 'placed' && st !== 'completed' && st !== 'resigned') {
        return true;
      }
    }
    return false;
  };

  // Helper to determine candidate 12-month registration validity & overdue status
  const getCandidateRenewalInfo = (c) => {
    if (!c) return { isAwaitingRenewal: false, daysElapsed: 0, daysPast12m: 0, baselineDate: null, isPast12m: false, isPlaced: false };
    const baselineStr = c.last_renewal_date || c.registration_date || (c.created_at ? c.created_at.substring(0, 10) : null);
    if (!baselineStr) {
      return { isAwaitingRenewal: false, daysElapsed: 0, daysPast12m: 0, baselineDate: null, isPast12m: false, isPlaced: false };
    }
    const baselineTime = new Date(baselineStr).getTime();
    const nowTime = new Date().setHours(0, 0, 0, 0);
    const daysElapsed = Math.max(0, Math.floor((nowTime - baselineTime) / (1000 * 60 * 60 * 24)));
    const isPast12m = daysElapsed > 365;
    const daysPast12m = isPast12m ? (daysElapsed - 365) : 0;

    const st = String(c.status || '').toLowerCase().trim();
    const isPlaced = (st === 'placed' || st === 'active');
    // If candidate has completed 12 months and is not currently placed in employment -> Awaiting Renewal
    const isAwaitingRenewal = !isPlaced && isPast12m;

    return {
      isAwaitingRenewal,
      isPast12m,
      daysElapsed,
      daysPast12m,
      baselineDate: baselineStr,
      isPlaced
    };
  };

  const isUserMatch = (cm) => {
    if (!cm || !currentUser) return false;
    if (cm.id && currentUser.id && Number(cm.id) === Number(currentUser.id)) return true;
    const myCode = String(currentUser.case_manager_code || '').trim().toLowerCase();
    const myFull = String(currentUser.full_name || '').trim().toLowerCase();
    const myUser = String(currentUser.username || '').trim().toLowerCase();
    const cmName = String(cm.name || cm.full_name || '').trim().toLowerCase();
    const cmUser = String(cm.username || '').trim().toLowerCase();
    const cmCode = String(cm.code || cm.case_manager_code || '').trim().toLowerCase();
    if (myUser && (cmUser === myUser || cmName === myUser)) return true;
    if (myFull && (cmName === myFull || cmUser === myFull)) return true;
    if (myCode && (cmCode === myCode || cmName === myCode)) return true;
    return false;
  };

  const isMine = (c) => {
    if (!currentUser) return false;
    const assigned = Array.isArray(c.assigned_case_managers) ? c.assigned_case_managers : [];
    if (assigned.length > 0) {
      return assigned.some(isUserMatch);
    }
    if (c.case_manager_id && currentUser.id && Number(c.case_manager_id) === Number(currentUser.id)) return true;
    const cmName = String(c.case_manager_name || '').trim().toLowerCase();
    const myCode = String(currentUser.case_manager_code || '').trim().toLowerCase();
    const myFull = String(currentUser.full_name || '').trim().toLowerCase();
    const myUser = String(currentUser.username || '').trim().toLowerCase();
    if (myCode && cmName === myCode) return true;
    if (myFull && cmName === myFull) return true;
    if (myUser && cmName === myUser) return true;
    return false;
  };

  const myCandidatesCount = useMemo(() => {
    if (isAdminOrSuper) return (candidates || []).length;
    return (candidates || []).filter(isMine).length;
  }, [candidates, isAdminOrSuper, currentUser]);

  const scopedCandidates = useMemo(() => {
    if (!isAdminOrSuper && scopeFilter === 'mine') {
      return (candidates || []).filter(isMine);
    }
    return candidates || [];
  }, [candidates, isAdminOrSuper, scopeFilter, currentUser]);

  // Compute status counts for filter tabs strictly based on core lifecycle logic
  const statusCounts = useMemo(() => {
    const counts = {
      all: scopedCandidates.length,
      registered: 0,
      awaiting_renewal: 0,
      registration_incomplete: 0,
      placed: 0
    };
    scopedCandidates.forEach(c => {
      const incomplete = isCandidateIncomplete(c);
      const ren = getCandidateRenewalInfo(c);
      let st = (c.status || 'registered').toLowerCase();
      if (st === 'active') st = 'placed';
      const isPlaced = st === 'placed';

      if (incomplete) {
        counts.registration_incomplete++;
      } else if (isPlaced) {
        counts.placed++;
      } else if (ren.isAwaitingRenewal) {
        // Completed 12 months and not placed -> Awaiting Renewal
        counts.awaiting_renewal++;
      } else {
        // Complete checklist, not placed, within 12 months -> Available in Pool
        counts.registered++;
      }
    });
    return counts;
  }, [scopedCandidates]);

  // Filter candidates by case manager, status filter, gender, education level & registration dates
  const displayData = useMemo(() => {
    let result = scopedCandidates;
    if (selectedCaseManager) {
      result = result.filter(c => c.case_manager_name === selectedCaseManager);
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => {
        const incomplete = isCandidateIncomplete(c);
        const ren = getCandidateRenewalInfo(c);
        let st = (c.status || 'registered').toLowerCase();
        if (st === 'active') st = 'placed';
        const isPlaced = st === 'placed';

        // 1. Available in Pool: mandatory checklist complete, not placed, within 12 months
        if (statusFilter === 'registered') {
          return !isPlaced && !incomplete && !ren.isAwaitingRenewal;
        }

        // 2. Awaiting Renewal Tab: not placed, complete checklist, and completed 12 months
        if (statusFilter === 'awaiting_renewal') {
          return !isPlaced && !incomplete && ren.isAwaitingRenewal;
        }

        // 3. Incomplete Profile Tab: candidates with pending mandatory checklist
        if (statusFilter === 'registration_incomplete') {
          return incomplete;
        }

        // 4. Placed in Employment Tab: placed candidates
        if (statusFilter === 'placed') {
          return isPlaced;
        }

        return true;
      });
    }
    if (selectedHotList && selectedHotList !== 'all') {
      result = result.filter(c => {
        const list = Array.isArray(c.hot_lists) ? c.hot_lists : [];
        return list.some(t => String(t || '').trim().toLowerCase() === selectedHotList.toLowerCase());
      });
    }
    if (selectedCenter && selectedCenter !== 'all') {
      result = result.filter(c => {
        const center = String(c.center || 'Enma Mall').trim().toLowerCase();
        return center === selectedCenter.toLowerCase();
      });
    }
    if (selectedTamkeenFilter !== 'all') {
      result = result.filter(c => {
        const isApproved = c.approved_by_tamkeen === true || String(c.approved_by_tamkeen || '').toLowerCase() === 'yes';
        return selectedTamkeenFilter === 'approved' ? isApproved : !isApproved;
      });
    }
    return result;
  }, [candidates, selectedCaseManager, statusFilter, selectedHotList, selectedCenter, selectedTamkeenFilter]);

  // Status badge styling helper strictly mapped to core lifecycle logic
  const renderStatusBadge = (status, candidate) => {
    const ren = getCandidateRenewalInfo(candidate);
    let st = (status || 'registered').toLowerCase();
    if (st === 'active') st = 'placed';
    const isPlaced = st === 'placed';

    // 1. Incomplete Profile
    if (isCandidateIncomplete(candidate) || st === 'incomplete' || st === 'pending_registration' || st === 'registration_incomplete' || st === 'registration_not_completed') {
      return (
        <span
          className="badge badge-danger"
          style={{ cursor: 'pointer', fontWeight: 800, fontSize: '0.74rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          title="Mandatory checklist pending. Click to complete checklist criteria."
          onClick={() => window.AppStore.openModal('CANDIDATE_CHECKLIST', { candidate })}
        >
          <span>⚠️</span> Incomplete Profile ▾
        </span>
      );
    }

    // 2. Placed in Employment
    if (isPlaced) {
      return (
        <span
          className="badge badge-warning"
          style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          title={`Placed with ${candidate.company_name || 'Employer'}. Click to update placement status.`}
          onClick={() => window.AppStore.openModal('UPDATE_STATUS', { candidate })}
        >
          <span>💼</span> Placed ▾
        </span>
      );
    }

    // 3. Awaiting Renewal (>12 months from registration/renewal)
    if (ren.isAwaitingRenewal) {
      return (
        <span
          className="badge badge-warning"
          style={{
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.74rem',
            padding: '0.25rem 0.6rem',
            background: 'rgba(245, 158, 11, 0.18)',
            color: 'var(--warning, #d97706)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
          title={`12-month registration period expired by ${ren.daysPast12m} days. Click to renew candidate registration.`}
          onClick={() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate })}
        >
          <span>⏳</span> Awaiting Renewal (+{ren.daysPast12m}d) ▾
        </span>
      );
    }

    // 4. Available in Pool (default valid state)
    return (
      <span
        className="badge badge-info"
        style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        title="Checklist verified. Available in national talent pool for corporate matching."
        onClick={() => window.AppStore.openModal('UPDATE_STATUS', { candidate })}
      >
        <span>📋</span> Available in Pool ▾
      </span>
    );
  };

  // Expandable Child Row
  const renderCandidateChildRow = (row) => {
    const docs = row.documents || [];
    const isPlaced = Boolean(row.company_name && row.company_name.trim());

    return (
      <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', margin: '0.25rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          
          {/* Box 1: Profile & Contact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>👤</span> Candidate Contact & Demographics
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div><strong>Full Name:</strong> {row.full_name}</div>
              <div><strong>CPR:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{row.cpr_no}</span> • {row.gender}</div>
              <div>
                <strong>Date of Birth & Age:</strong>{' '}
                {row.date_of_birth ? (
                  <span>
                    {window.formatAppDate(row.date_of_birth)}
                    {window.calculateAge && window.calculateAge(row.date_of_birth) !== null ? ` (${window.calculateAge(row.date_of_birth)} yrs)` : ''}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Not specified</span>
                )}
              </div>
              <div><strong>Education:</strong> {row.education || 'High School / Diploma'}</div>
              <div><strong>Email:</strong> {row.email || 'Not specified'}</div>
              <div><strong>Phone:</strong> {row.phone || 'Not specified'}</div>
              <div><strong>Registered:</strong> {window.formatAppDate(row.registration_date || row.created_at)}</div>
            </div>
          </div>

          {/* Box 2: Current Placement Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🏢</span> Placement & Job Linkage
            </div>
            {isPlaced ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div><strong>Employer:</strong> {row.company_name} {row.employer_cr ? `(CR: ${row.employer_cr})` : ''}</div>
                <div><strong>Position:</strong> {row.position_title} {row.job_code ? `(${row.job_code})` : ''}</div>
                <div><strong>Base Wage:</strong> {currency} {Number(row.salary_bhd || 0).toFixed(3)}</div>
                <div><strong>Joined:</strong> {window.formatAppDate(row.joining_date)}</div>
                <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                    onClick={() => window.AppStore.setTab('placements')}
                  >
                    💼 Placements Ledger &rarr;
                  </button>
                  <button
                    className="btn btn-warning btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}
                    title="If candidate exited or resigned, renew their registration and return to available pool"
                    onClick={() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate: row, fromPlaced: true })}
                  >
                    <span>🔄</span> Exit / Resign & Renew to Pool
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Currently unplaced. Available in the national talent pool for corporate matching.
              </div>
            )}
          </div>

          {/* Box 3: Document Vault & Case Management */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📁</span> Document Vault & Case Assignment
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div><strong>Center:</strong> 🏬 {row.center || 'Enma Mall'}</div>
              <div><strong>Case Manager:</strong> {row.case_manager_name || 'System Assigned'}</div>
              <div><strong>Documents Vault:</strong> {docs.length} uploaded file(s)</div>
              {row.remarks && <div><strong>Remarks:</strong> <em>{row.remarks}</em></div>}
              <div style={{ marginTop: '0.35rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                  onClick={() => window.AppStore.openModal('CANDIDATE_DOCUMENTS', { candidate: row })}
                >
                  📎 Manage Documents ({docs.length})
                </button>
              </div>
            </div>
          </div>

          {/* Box 4: Registration Checklist Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📋</span> Registration Checklist ({row.checklist_completion_pct || 0}%)
              </span>
              <span className={`badge ${(row.checklist_completion_pct || 0) >= 100 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                {(row.checklist_completion_pct || 0) >= 100 ? 'Verified' : 'Pending'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {Array.isArray(row.checklist_items) && row.checklist_items.length > 0 ? (
                row.checklist_items.map((ci, i) => (
                  <div key={ci.code || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ color: ci.completed ? 'var(--success, #10b981)' : 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
                        {ci.completed ? '✓' : '○'}
                      </span>
                      <span style={{ color: ci.completed ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {ci.title}
                      </span>
                    </span>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>+{ci.weight}%</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No itemized criteria recorded. Click below to verify criteria.
                </div>
              )}
              <div style={{ marginTop: '0.35rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                  onClick={() => window.AppStore.openModal('CANDIDATE_CHECKLIST', { candidate: row })}
                >
                  📋 Update Checklist Criteria &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Box 5: Government & Tamkeen Scheme Approvals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🏛️</span> Government & Tamkeen Approvals
              </span>
              <span
                className={`badge ${(row.approved_by_tamkeen === true || String(row.approved_by_tamkeen || '').toLowerCase() === 'yes') ? 'badge-success' : 'badge-warning'}`}
                style={{ fontSize: '0.68rem', fontWeight: 800 }}
              >
                {(row.approved_by_tamkeen === true || String(row.approved_by_tamkeen || '').toLowerCase() === 'yes') ? '✓ Both Approved' : '🏬 Job Center Only'}
              </span>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {/* Job Center Approval Item */}
              <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(16, 185, 129, 0.07)', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🏬</span> Ministry Job Center:
                  </strong>
                  <span className="badge badge-success" style={{ fontSize: '0.66rem', fontWeight: 700 }}>
                    ✓ Approved (Yes)
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Approved upon registration on {window.formatAppDate(row.job_center_approved_at || row.registration_date || row.created_at)} by {row.job_center_approved_by || row.case_manager_name || 'Job Center'}.
                </div>
              </div>

              {/* Tamkeen Scheme Approval Item */}
              {(() => {
                const isTamkeen = row.approved_by_tamkeen === true || String(row.approved_by_tamkeen || '').toLowerCase() === 'yes';
                if (isTamkeen) {
                  return (
                    <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(5, 150, 105, 0.08)', borderRadius: '4px', border: '1px solid rgba(5, 150, 105, 0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>🏛️</span> Tamkeen Labor Scheme:
                        </strong>
                        <span className="badge badge-success" style={{ fontSize: '0.66rem', fontWeight: 800 }}>
                          ✓ Approved (Yes)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <strong>Date:</strong> {window.formatAppDate(row.tamkeen_approval_date)} • <strong>By:</strong> {row.tamkeen_approved_by || 'Tamkeen Directorate'}
                      </div>
                      {row.tamkeen_approval_notes && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                          "{row.tamkeen_approval_notes}"
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div style={{ padding: '0.45rem 0.5rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>🏛️</span> Tamkeen Labor Scheme:
                      </strong>
                      <span className="badge badge-warning" style={{ fontSize: '0.66rem', fontWeight: 700 }}>
                        ⏳ Pending Approval
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Candidate is registered in pool but requires manual Tamkeen scheme approval.
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', fontWeight: 700, color: 'var(--primary)', borderColor: 'var(--primary)' }}
                        onClick={() => window.AppStore.openModal('EDIT_CANDIDATE', { candidate: row })}
                      >
                        ✏️ Edit Candidate Details
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: '0.2rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', width: '100%', justifyContent: 'center' }}
                  onClick={() => window.AppStore.openModal('CANDIDATE_ACTIVITY_LOG', { candidate: row })}
                >
                  📜 View Full Approval & Activity Timeline &rarr;
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  const columns = [
    {
      key: 'ref_no',
      label: 'Ref & Reg Date',
      sortable: true,
      render: (val, row) => {
        const centerName = row.center || 'Enma Mall';
        const isEnma = centerName === 'Enma Mall';
        const isCF = centerName === 'Career Fair';
        const isTrn = centerName === 'Training';
        const bg = isCF ? 'rgba(16,185,129,0.1)' : (isTrn ? 'rgba(139,92,246,0.1)' : (isEnma ? 'rgba(37,99,235,0.08)' : 'rgba(100,116,139,0.1)'));
        const color = isCF ? '#059669' : (isTrn ? '#7c3aed' : (isEnma ? '#2563eb' : '#475569'));
        const icon = isCF ? '🎪' : (isTrn ? '🎓' : (isEnma ? '🏬' : '🏢'));

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem' }}>
                {val}
              </span>
              <span style={{
                background: bg,
                color: color,
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.68rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <span>{icon}</span> {centerName}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Reg: {window.formatAppDate(row.registration_date || row.created_at)}
            </div>
          </div>
        );
      }
    },
    {
      key: 'full_name',
      label: 'Candidate Details',
      sortable: true,
      render: (val, row) => {
        const ren = getCandidateRenewalInfo(row);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{val}</strong>
              {ren.isAwaitingRenewal && (
                <span
                  className="badge badge-warning"
                  style={{
                    fontSize: '0.66rem',
                    padding: '0.1rem 0.4rem',
                    fontWeight: 800,
                    background: 'rgba(245, 158, 11, 0.18)',
                    color: 'var(--warning, #d97706)',
                    border: '1px solid rgba(245, 158, 11, 0.4)'
                  }}
                  title={`Registration expired by ${ren.daysPast12m} days past 12-month validity (${ren.daysElapsed} days total)`}
                >
                  ⚠️ Expired (+{ren.daysPast12m}d past 12m)
                </span>
              )}
              {row.renewals_count > 0 && (
                <span
                  className="badge badge-success"
                  style={{
                    fontSize: '0.66rem',
                    padding: '0.1rem 0.4rem',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: 'var(--success, #059669)',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                  title={`Candidate renewed ${row.renewals_count} time(s). Last: ${window.formatAppDate(row.last_renewal_date)}`}
                >
                  🔄 Renewed (x{row.renewals_count})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              CPR: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.cpr_no}</span> • {row.gender || 'N/A'} • {row.education || 'N/A'}
            </div>
            {row.date_of_birth && (
              <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🎂</span>
                <span>DOB: {window.formatAppDate(row.date_of_birth)}</span>
                {window.calculateAge && window.calculateAge(row.date_of_birth) !== null && (
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', fontWeight: 700 }}>
                    {window.calculateAge(row.date_of_birth)}y
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'contact',
      label: 'Contact Info',
      sortable: false,
      render: (_, row) => (
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
            {row.phone || 'No Phone'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {row.email || 'No Email'}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Talent Pool Status',
      sortable: true,
      render: (val, row) => {
        const isJc = row.approved_by_job_center === true || String(row.approved_by_job_center || 'Yes').toLowerCase() === 'yes';
        const isTamkeen = row.approved_by_tamkeen === true || String(row.approved_by_tamkeen || '').toLowerCase() === 'yes';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start' }}>
            <div>{renderStatusBadge(val, row)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '3px',
                  background: isJc ? 'rgba(37, 99, 235, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                  color: isJc ? '#2563eb' : '#64748b',
                  border: isJc ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid rgba(100, 116, 139, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  whiteSpace: 'nowrap'
                }}
                title={isJc ? 'Approved by Job Center upon registration' : 'Pending Job Center approval'}
              >
                <span>🏬</span> JC: {isJc ? 'Yes' : 'No'}
              </span>

              <span
                style={{
                  fontSize: '0.67rem',
                  fontWeight: 800,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '3px',
                  background: isTamkeen ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                  color: isTamkeen ? '#059669' : '#d97706',
                  border: isTamkeen ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  whiteSpace: 'nowrap'
                }}
                title={isTamkeen ? `Approved by Tamkeen on ${window.formatAppDate(row.tamkeen_approval_date || row.updated_at)}${row.tamkeen_approval_notes ? ` • ${row.tamkeen_approval_notes}` : ''}` : 'Tamkeen Scheme Approval: Pending'}
              >
                <span>{isTamkeen ? '✓' : '✕'}</span> Tamkeen: {isTamkeen ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'checklist_completion_pct',
      label: 'Registration %',
      sortable: true,
      render: (val, row) => {
        const pct = parseInt(val, 10) || 0;
        let badgeCls = 'badge-danger';
        let icon = '⚠️';
        let label = `${pct}% Incomplete`;

        if (pct >= 100) {
          badgeCls = 'badge-success';
          icon = '✓';
          label = '100% Completed';
        } else if (pct >= 70) {
          badgeCls = 'badge-info';
          icon = '⚡';
          label = `${pct}% Compliant`;
        } else if (pct > 0) {
          badgeCls = 'badge-warning';
          icon = '⚠️';
          label = `${pct}% Incomplete`;
        } else {
          badgeCls = 'badge-danger';
          icon = '❌';
          label = '0% Pending';
        }

        return (
          <div
            style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', gap: '4px' }}
            title="Click to view or complete candidate registration checklist criteria"
            onClick={() => window.AppStore.openModal('CANDIDATE_CHECKLIST', { candidate: row })}
          >
            <span className={`badge ${badgeCls}`} style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>{icon}</span> {label} ▾
            </span>
            <div style={{ width: '85px', height: '5px', background: 'var(--border-light, #e2e8f0)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: pct >= 100 ? 'var(--success, #10b981)' : (pct >= 70 ? 'var(--primary, #0ea5e9)' : (pct > 0 ? 'var(--warning, #f59e0b)' : 'var(--danger, #ef4444)')),
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        );
      }
    },
    {
      key: 'documents',
      label: 'Document Vault',
      sortable: false,
      render: (_, row) => {
        const docs = row.documents || [];
        return (
          <button
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="View or upload candidate documents"
            onClick={() => window.AppStore.openModal('CANDIDATE_DOCUMENTS', { candidate: row })}
          >
            <span>📎</span>
            <span>{docs.length} Docs</span>
          </button>
        );
      }
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager(s)',
      sortable: true,
      render: (val, row) => {
        const assigned = Array.isArray(row.assigned_case_managers) ? row.assigned_case_managers : [];
        if (assigned.length > 0) {
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '210px' }}>
              {assigned.map((cm, idx) => {
                const mine = !isAdminOrSuper && isUserMatch(cm);
                return (
                  <span
                    key={cm.id || cm.username || idx}
                    className={`badge ${mine ? 'badge-primary' : 'badge-neutral'}`}
                    style={{ fontWeight: mine ? 800 : 600, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    {mine && <span>★</span>}
                    {cm.name || cm.username || cm.code}
                    {mine && <span style={{ opacity: 0.85, fontSize: '0.66rem' }}>(You)</span>}
                  </span>
                );
              })}
            </div>
          );
        }
        const mine = !isAdminOrSuper && isMine(row);
        return (
          <span className={`badge ${mine ? 'badge-primary' : 'badge-neutral'}`} style={{ fontWeight: mine ? 800 : 600, fontSize: '0.74rem' }}>
            {mine ? '★ ' : ''}{val || 'System'}{mine ? ' (You)' : ''}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => {
        const ren = getCandidateRenewalInfo(row);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '190px', maxWidth: '230px', marginLeft: 'auto' }}>
            {/* Row 1: Primary Action Buttons (Edit + Renewal/Exit) */}
            <div style={{ display: 'flex', gap: '0.3rem', width: '100%' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                title={`Edit ${row.full_name} details`}
                style={{
                  flex: 1,
                  fontSize: '0.72rem',
                  padding: '0.22rem 0.45rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap',
                  color: 'var(--primary)',
                  borderColor: 'var(--primary)'
                }}
                onClick={() => window.AppStore.openModal('EDIT_CANDIDATE', { candidate: row })}
              >
                <span>✏️</span> Edit
              </button>

                {ren.isAwaitingRenewal && (
                  <button
                    className="btn btn-warning btn-sm"
                    title={`Renew Candidate Registration (Overdue by ${ren.daysPast12m} days)`}
                    style={{
                      flex: 1,
                      fontSize: '0.72rem',
                      padding: '0.22rem 0.45rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate: row })}
                  >
                    <span>🔄</span> Renew
                  </button>
                )}

                {/* Placed candidate exit or renewal option */}
                {ren.isPlaced && (
                  <button
                    className="btn btn-outline btn-sm"
                    title="If candidate exited or resigned, renew registration and return to available pool"
                    style={{
                      flex: 1,
                      fontSize: '0.72rem',
                      padding: '0.22rem 0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      whiteSpace: 'nowrap',
                      color: 'var(--primary)',
                      borderColor: 'var(--primary)'
                    }}
                    onClick={() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate: row, fromPlaced: true })}
                  >
                    <span>🔄</span> Renew / Exit
                  </button>
                )}

                {/* Resigned candidate direct renewal option */}
                {String(row.status || '').toLowerCase() === 'resigned' && !ren.isAwaitingRenewal && (
                  <button
                    className="btn btn-warning btn-sm"
                    title="Renew resigned candidate registration and return to available pool"
                    style={{
                      flex: 1,
                      fontSize: '0.72rem',
                      padding: '0.22rem 0.45rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate: row, fromPlaced: true })}
                  >
                    <span>🔄</span> Renew to Pool
                  </button>
                )}
            </div>

            {/* Row 2: Inspection & Log Buttons */}
            <div style={{ display: 'flex', gap: '0.3rem', width: '100%' }}>
              <button
                className="btn btn-outline btn-sm"
                title="Candidate Full Activity Log & Export to Excel"
                style={{
                  flex: 1,
                  fontSize: '0.72rem',
                  padding: '0.22rem 0.45rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => window.AppStore.openModal('CANDIDATE_ACTIVITY_LOG', { candidate: row })}
              >
                <span>📜</span> Log
              </button>

              <button
                className="btn btn-outline btn-sm"
                title="Candidate Dossier & Timeline"
                style={{
                  flex: 1,
                  fontSize: '0.72rem',
                  padding: '0.22rem 0.45rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => window.AppStore.openModal('CANDIDATE_DETAIL', { candidate: row })}
              >
                <span>👁️</span> Dossier
              </button>
            </div>
          </div>
        );
      }
    }
  ];

  return (
    <div>
      {/* Talent & Workforce Events Module Switcher */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '3px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-light)',
        marginBottom: '0.5rem',
        gap: '4px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <button
          type="button"
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--primary)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span>👥</span>
          <span>Candidates Talent Pool</span>
        </button>

        <button
          type="button"
          onClick={() => window.AppStore.setActiveTab('training')}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'var(--transition)'
          }}
          title="Go to Training Module"
        >
          <span>🎓</span>
          <span>Training Module</span>
        </button>

        <button
          type="button"
          onClick={() => window.AppStore.setActiveTab('career_fair')}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'var(--transition)'
          }}
          title="Go to Career Fair Module"
        >
          <span>🎪</span>
          <span>Career Fair Module</span>
        </button>
      </div>

      <div className="page-header" style={{ marginBottom: '0.65rem', gap: '0.65rem' }}>
        <div className="page-title-group">
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: 0 }}>
            <span>👥</span> Candidate Registry & Talent Pool
          </h1>
          <p className="page-subtitle" style={{ marginTop: '0.1rem', marginBottom: 0 }}>
            National candidate registry, CPR verification records, CV document vault, and employer placement matching.
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            onClick={() => window.AppStore.openModal('CANDIDATE_ACTIVITY_LOG')}
          >
            <span>📜</span> Candidate Activity Log
          </button>
          <button className="btn btn-primary" onClick={() => window.AppStore.openModal('NEW_CANDIDATE')}>
            ➕ Register New Candidate
          </button>
        </div>
      </div>

      {/* Case Manager Scope Switcher: My Candidates vs Global View */}
      {!isAdminOrSuper && (
        <div
          className="card"
          style={{
            padding: '0.45rem 0.75rem',
            marginBottom: '0.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            background: 'var(--bg-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              View Scope:
            </span>
            <div style={{
              display: 'inline-flex',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: '999px',
              padding: '3px',
              gap: '3px'
            }}>
              <button
                type="button"
                className={`btn btn-sm ${scopeFilter === 'mine' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => handleScopeChange('mine')}
              >
                <span>👤 My Candidates</span>
                <span style={{
                  background: scopeFilter === 'mine' ? 'rgba(255,255,255,0.22)' : 'var(--bg-primary)',
                  color: scopeFilter === 'mine' ? '#fff' : 'var(--text-primary)',
                  borderRadius: '999px',
                  padding: '0.05rem 0.45rem',
                  fontSize: '0.72rem',
                  fontWeight: 800
                }}>
                  {myCandidatesCount}
                </span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${scopeFilter === 'global' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => handleScopeChange('global')}
              >
                <span>🌐 Global View</span>
                <span style={{
                  background: scopeFilter === 'global' ? 'rgba(255,255,255,0.22)' : 'var(--bg-primary)',
                  color: scopeFilter === 'global' ? '#fff' : 'var(--text-primary)',
                  borderRadius: '999px',
                  padding: '0.05rem 0.45rem',
                  fontSize: '0.72rem',
                  fontWeight: 800
                }}>
                  {(candidates || []).length}
                </span>
              </button>
            </div>
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {scopeFilter === 'mine'
              ? 'Showing candidates assigned to you'
              : 'Showing all candidates (your assigned candidates are highlighted)'}
          </span>
        </div>
      )}

      {/* Lifecycle Status Filter Navigation Tabs - Strictly required lifecycle stages based on business logic */}
      <div className="candidate-status-tabs" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { key: 'registered', label: '📋 Available in Pool', count: statusCounts.registered },
          { key: 'registration_incomplete', label: '⚠️ Incomplete Profile', count: statusCounts.registration_incomplete, isDanger: true },
          { key: 'awaiting_renewal', label: '⏳ Awaiting Renewal', count: statusCounts.awaiting_renewal, isWarning: true },
          { key: 'placed', label: '💼 Placed in Employment', count: statusCounts.placed },
          { key: 'all', label: 'All Candidates', count: statusCounts.all },
        ].map(tab => {
          const isSelected = statusFilter === tab.key;
          const hasDanger = tab.isDanger && tab.count > 0;
          const hasWarning = tab.isWarning && tab.count > 0;

          let btnClass = 'btn-outline';
          if (isSelected) {
            btnClass = tab.isDanger ? 'btn-danger' : (tab.isWarning ? 'btn-warning' : 'btn-primary');
          }

          let borderColor = undefined;
          let textColor = undefined;
          let badgeBg = isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)';
          let badgeColor = undefined;

          if (!isSelected) {
            if (hasDanger) {
              borderColor = 'var(--danger, #ef4444)';
              textColor = 'var(--danger, #ef4444)';
              badgeBg = 'rgba(239, 68, 68, 0.15)';
              badgeColor = 'var(--danger, #ef4444)';
            } else if (hasWarning) {
              borderColor = 'var(--warning, #d97706)';
              textColor = 'var(--warning, #d97706)';
              badgeBg = 'rgba(245, 158, 11, 0.15)';
              badgeColor = 'var(--warning, #d97706)';
            }
          }

          return (
            <button
              key={tab.key}
              type="button"
              className={`btn btn-sm ${btnClass}`}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                borderColor,
                color: textColor
              }}
              onClick={() => handleStatusFilterChange(tab.key)}
            >
              <span>{tab.label}</span>
              <span style={{ 
                marginLeft: '0.4rem', 
                background: badgeBg,
                color: badgeColor,
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Multi-Criteria Filtering Control Panel */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '0.6rem 0.85rem',
          marginBottom: '0.65rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        {/* Row 1: Filter Selectors (Case Manager, Reg Dates, Gender, Education) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          
          {/* 1. Case Manager Selector */}
          {isAdminOrSuper ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                👔 Case Manager:
              </span>
              <select
                className="select-control"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', minWidth: '150px', width: 'auto' }}
                value={selectedCaseManager}
                onChange={e => handleCaseManagerChange(e.target.value)}
              >
                <option value="">All Case Managers</option>
                {caseManagers.map(cm => (
                  <option key={cm.id || cm.username} value={cm.case_manager_code || cm.full_name}>
                    {cm.full_name} ({cm.case_manager_code || 'CM'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>👔 Case Manager:</span>
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {currentUser.case_manager_code || currentUser.full_name}
              </span>
            </div>
          )}

          {/* 2. Hot List Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              🔥 Hot List:
            </span>
            <select
              className="select-control"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', minWidth: '165px', width: 'auto' }}
              value={selectedHotList}
              onChange={e => handleHotListChange(e.target.value)}
            >
              <option value="all">All Hot Lists</option>
              {hotListFilterOptions.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* 5. Center Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              🏬 Center:
            </span>
            <select
              className="select-control"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', minWidth: '135px', width: 'auto' }}
              value={selectedCenter}
              onChange={e => handleCenterChange(e.target.value)}
            >
              <option value="all">All Centers</option>
              <option value="Enma Mall">Enma Mall</option>
              <option value="Career Fair">Career Fair</option>
              <option value="Training">Training</option>
              <option value="Other Job Center">Other Job Center</option>
            </select>
          </div>

          {/* 6. Tamkeen Scheme Approval Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              🏛️ Tamkeen:
            </span>
            <select
              className="select-control"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', minWidth: '165px', width: 'auto' }}
              value={selectedTamkeenFilter}
              onChange={e => handleTamkeenFilterChange(e.target.value)}
            >
              <option value="all">All Tamkeen Statuses</option>
              <option value="pending">⏳ Pending Tamkeen Approval</option>
              <option value="approved">✓ Approved by Tamkeen</option>
            </select>
          </div>
        </div>

        {/* Row 2: Match Counter & Clear All Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--border-light)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing <strong style={{ color: 'var(--primary)' }}>{displayData.length}</strong> of {candidates.length} candidates
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={handleClearAllFilters}
              title="Reset all filters to default"
            >
              ✕ Clear All Filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          expandable={true}
          renderChildRow={renderCandidateChildRow}
          rowStyle={row => {
            if (!isAdminOrSuper && isMine(row) && scopeFilter === 'global') {
              return {
                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                borderLeft: '4px solid var(--primary)'
              };
            }
            return undefined;
          }}
          searchPlaceholder="🔍 Search CPR, Name, Ref No, Status, Phone, Hot List, or Placement..."
          exportFilename="Candidate_Registry_SaNDS.csv"
          emptyMessage="No candidate records match your selected criteria."
        />
      </div>
    </div>
  );
}

window.CandidatesView = CandidatesView;
