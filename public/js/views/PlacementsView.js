/**
 * Placements View - Candidate Employment Contracts & Milestone Retention Ledger
 * Powered by DataTable with multi-criteria filtering, child rows, and claim triggers.
 */

function PlacementsView({ state }) {
  const { candidates = [], jobs = [], milestones = [], claims = [], payments = [], settings = {}, currentUser = {}, caseManagers = [] } = state || {};
  const currency = settings.currency || 'BHD';
  const isAdminOrSuper = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  const { useState, useMemo, useEffect } = React;
  const SearchableSelect = window.SearchableSelect;

  // Session storage filter persistence
  const readSaved = (k, d = '') => {
    const v = sessionStorage.getItem('sands_placements_filter_' + k);
    return v !== null ? v : d;
  };

  const [selectedEmployer, setSelectedEmployer] = useState(() => readSaved('employer'));
  const [selectedCandidate, setSelectedCandidate] = useState(() => readSaved('candidate'));
  const [selectedPosition, setSelectedPosition] = useState(() => readSaved('position'));
  const [selectedDepartment, setSelectedDepartment] = useState(() => readSaved('department'));
  const [selectedCaseManager, setSelectedCaseManager] = useState(() => readSaved('case_manager'));
  const [joinDateFrom, setJoinDateFrom] = useState(() => readSaved('join_from'));
  const [joinDateTo, setJoinDateTo] = useState(() => readSaved('join_to'));
  const [filingDateFrom, setFilingDateFrom] = useState(() => readSaved('filing_from'));
  const [filingDateTo, setFilingDateTo] = useState(() => readSaved('filing_to'));
  const [statusFilter, setStatusFilter] = useState(() => readSaved('status', 'active'));
  const [scopeFilter, setScopeFilter] = useState(() => readSaved('scope', 'mine'));

  // Reset all placement filters to default on user switch or login
  useEffect(() => {
    setSelectedEmployer('');
    setSelectedCandidate('');
    setSelectedPosition('');
    setSelectedDepartment('');
    setSelectedCaseManager('');
    setJoinDateFrom('');
    setJoinDateTo('');
    setFilingDateFrom('');
    setFilingDateTo('');
    setStatusFilter('active');
    setScopeFilter('mine');
  }, [currentUser?.id, currentUser?.role]);

  const persist = (setter, key) => (val) => {
    setter(val);
    sessionStorage.setItem('sands_placements_filter_' + key, val);
  };

  const handleEmployerChange = persist(setSelectedEmployer, 'employer');
  const handleCandidateChange = persist(setSelectedCandidate, 'candidate');
  const handlePositionChange = persist(setSelectedPosition, 'position');
  const handleDepartmentChange = persist(setSelectedDepartment, 'department');
  const handleCaseManagerChange = persist(setSelectedCaseManager, 'case_manager');
  const handleJoinDateFrom = persist(setJoinDateFrom, 'join_from');
  const handleJoinDateTo = persist(setJoinDateTo, 'join_to');
  const handleFilingDateFrom = persist(setFilingDateFrom, 'filing_from');
  const handleFilingDateTo = persist(setFilingDateTo, 'filing_to');
  const handleStatusChange = persist(setStatusFilter, 'status');
  const handleScopeChange = persist(setScopeFilter, 'scope');

  const handleClearJoinDates = () => {
    handleJoinDateFrom('');
    handleJoinDateTo('');
  };

  const handleClearFilingDates = () => {
    handleFilingDateFrom('');
    handleFilingDateTo('');
  };

  const handleResetAll = () => {
    handleEmployerChange('');
    handleCandidateChange('');
    handlePositionChange('');
    handleDepartmentChange('');
    handleCaseManagerChange('');
    handleClearJoinDates();
    handleClearFilingDates();
    handleStatusChange('active');
    if (!isAdminOrSuper) {
      handleScopeChange('mine');
    }
  };

  const activeFiltersCount = (selectedEmployer ? 1 : 0) +
    (selectedCandidate ? 1 : 0) +
    (selectedPosition ? 1 : 0) +
    (selectedDepartment ? 1 : 0) +
    (selectedCaseManager ? 1 : 0) +
    ((joinDateFrom || joinDateTo) ? 1 : 0) +
    ((filingDateFrom || filingDateTo) ? 1 : 0) +
    (statusFilter !== 'active' ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  // Helper date parsing
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

  // Build jobs lookup map
  const jobsMap = useMemo(() => {
    const map = new Map();
    (jobs || []).forEach(j => {
      if (j.id) map.set(String(j.id), j);
      if (j.job_code) map.set(String(j.job_code).toLowerCase(), j);
    });
    return map;
  }, [jobs]);

  // Build milestones & claims lookup maps per candidate
  const candidateMilestonesMap = useMemo(() => {
    const map = new Map();
    (milestones || []).forEach(m => {
      const cid = String(m.candidate_id);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push(m);
    });
    return map;
  }, [milestones]);

  const candidateClaimsMap = useMemo(() => {
    const map = new Map();
    (claims || []).forEach(c => {
      const cid = String(c.candidate_id);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push(c);
    });
    return map;
  }, [claims]);

  // Filtered Placements dataset (candidates with an employment contract / placement link)
  const placementsList = useMemo(() => {
    return (candidates || []).filter(c => {
      // Must have employer linkage or placed status
      const hasPlacement = Boolean(c.company_name && c.company_name.trim()) ||
        c.status === 'placed' ||
        c.status === 'active' ||
        c.status === 'completed' ||
        Boolean(c.job_id);
      return hasPlacement;
    }).map(c => {
      const linkedJob = (c.job_id ? jobsMap.get(String(c.job_id)) : null) ||
        (c.job_code ? jobsMap.get(String(c.job_code).toLowerCase()) : null);
      const cMilestones = candidateMilestonesMap.get(String(c.id)) || [];
      const cClaims = candidateClaimsMap.get(String(c.id)) || [];

      // Calculate days elapsed since joining
      let daysElapsed = null;
      if (c.joining_date) {
        const jd = new Date(c.joining_date);
        const now = new Date();
        if (!isNaN(jd.getTime())) {
          const diffMs = now.getTime() - jd.getTime();
          daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      const positionTitle = (c.position_title || linkedJob?.position_title || linkedJob?.job_title || 'Placed Specialist').trim();
      const departmentName = (c.department || linkedJob?.department || 'Operations').trim();
      const filingDate = c.registration_date || c.created_at || '';

      return {
        ...c,
        linked_job: linkedJob,
        milestones_list: cMilestones,
        claims_list: cClaims,
        days_elapsed: daysElapsed,
        job_display_code: c.job_code || linkedJob?.job_code || null,
        job_display_title: positionTitle,
        department_display: departmentName,
        filing_date: filingDate
      };
    });
  }, [candidates, jobsMap, candidateMilestonesMap, candidateClaimsMap]);

  // Helper to determine if a placement is assigned to the currently logged in Case Manager
  const isMine = (p) => {
    if (!currentUser) return false;
    if (p.case_manager_id && currentUser.id && Number(p.case_manager_id) === Number(currentUser.id)) return true;
    const cmName = String(p.case_manager_name || '').trim().toLowerCase();
    const myCode = String(currentUser.case_manager_code || '').trim().toLowerCase();
    const myFull = String(currentUser.full_name || '').trim().toLowerCase();
    const myUser = String(currentUser.username || '').trim().toLowerCase();
    if (myCode && cmName === myCode) return true;
    if (myFull && cmName === myFull) return true;
    if (myUser && cmName === myUser) return true;
    return false;
  };

  // Scoped list: My Placements vs Global Placements (Case Manager) or All (Admin)
  const scopedPlacementsList = useMemo(() => {
    if (!isAdminOrSuper && scopeFilter === 'mine') {
      return placementsList.filter(isMine);
    }
    return placementsList;
  }, [placementsList, isAdminOrSuper, scopeFilter, currentUser]);

  // Filter options for dropdowns (scoped to current view)
  const candidateOptions = useMemo(() => {
    const list = scopedPlacementsList.map(p => ({
      value: String(p.id),
      label: p.full_name,
      subLabel: `Ref: ${p.ref_no} • CPR: ${p.cpr_no} • ${p.company_name}`,
      searchKeywords: `${p.full_name} ${p.cpr_no} ${p.ref_no} ${p.company_name}`
    })).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Candidates (${list.length})`, subLabel: 'Filter by placed candidate' }, ...list];
  }, [scopedPlacementsList]);

  const employerOptions = useMemo(() => {
    const map = new Map();
    scopedPlacementsList.forEach(p => {
      const comp = (p.company_name || '').trim();
      if (comp && !map.has(comp.toLowerCase())) {
        map.set(comp.toLowerCase(), {
          value: comp,
          label: comp,
          subLabel: p.employer_cr ? `CR: ${p.employer_cr}` : 'Enterprise Employer',
          searchKeywords: `${comp} ${p.employer_cr || ''}`
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Employers (${list.length})`, subLabel: 'Filter by employer company' }, ...list];
  }, [scopedPlacementsList]);

  const positionOptions = useMemo(() => {
    const map = new Map();
    scopedPlacementsList.forEach(p => {
      const pos = (p.job_display_title || p.position_title || '').trim();
      if (pos && !map.has(pos.toLowerCase())) {
        map.set(pos.toLowerCase(), {
          value: pos,
          label: pos,
          subLabel: 'Filter by job position',
          searchKeywords: pos
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Positions (${list.length})`, subLabel: 'Filter by job position' }, ...list];
  }, [scopedPlacementsList]);

  const departmentOptions = useMemo(() => {
    const map = new Map();
    scopedPlacementsList.forEach(p => {
      const dept = (p.department_display || p.department || '').trim();
      if (dept && !map.has(dept.toLowerCase())) {
        map.set(dept.toLowerCase(), {
          value: dept,
          label: dept,
          subLabel: 'Filter by department',
          searchKeywords: dept
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Departments (${list.length})`, subLabel: 'Filter by department' }, ...list];
  }, [scopedPlacementsList]);

  // Filter display dataset
  const displayData = useMemo(() => {
    return scopedPlacementsList.filter(p => {
      if (selectedEmployer && (p.company_name || '').toLowerCase() !== selectedEmployer.toLowerCase()) return false;
      if (selectedCandidate && String(p.id) !== String(selectedCandidate)) return false;
      if (selectedPosition) {
        const pos = (p.job_display_title || p.position_title || '').toLowerCase();
        if (pos !== selectedPosition.toLowerCase()) return false;
      }
      if (selectedDepartment) {
        const dept = (p.department_display || p.department || '').toLowerCase();
        if (dept !== selectedDepartment.toLowerCase()) return false;
      }
      if (selectedCaseManager && p.case_manager_name !== selectedCaseManager) return false;

      // Status filtering: 'active' (Active Placements), 'completed' (Completed 12 Months), 'all'
      if (statusFilter !== 'all') {
        const st = (p.status || 'placed').toLowerCase();
        const isCompleted12m = st === 'completed' || (p.days_elapsed !== null && p.days_elapsed >= 365);

        if (statusFilter === 'active' || statusFilter === 'placed') {
          // Active placements: currently employed in active cycle and not yet 12 months completed
          if (isCompleted12m || st === 'resigned' || st === 'completed') return false;
        } else if (statusFilter === 'completed') {
          // Completed 12 months after placement
          if (!isCompleted12m) return false;
        }
      }

      // Joining Date range filtering
      if (joinDateFrom) {
        const d = parseDateStr(p.joining_date);
        if (!d || d < joinDateFrom) return false;
      }
      if (joinDateTo) {
        const d = parseDateStr(p.joining_date);
        if (!d || d > joinDateTo) return false;
      }

      // Filing / Registration Date range filtering
      if (filingDateFrom) {
        const d = parseDateStr(p.filing_date || p.registration_date || p.created_at);
        if (!d || d < filingDateFrom) return false;
      }
      if (filingDateTo) {
        const d = parseDateStr(p.filing_date || p.registration_date || p.created_at);
        if (!d || d > filingDateTo) return false;
      }

      return true;
    });
  }, [scopedPlacementsList, selectedEmployer, selectedCandidate, selectedPosition, selectedDepartment, selectedCaseManager, statusFilter, joinDateFrom, joinDateTo, filingDateFrom, filingDateTo]);

  // Compute KPI summary
  const kpis = useMemo(() => {
    const total = placementsList.length;
    let activeCount = 0;
    let linkedJobsCount = 0;
    let totalWage = 0;

    placementsList.forEach(p => {
      const st = (p.status || 'placed').toLowerCase();
      if (st === 'placed' || st === 'active') activeCount++;
      if (p.job_id || p.job_code) linkedJobsCount++;
      totalWage += parseFloat(p.salary_bhd) || 0;
    });

    return {
      total,
      activeCount,
      linkedJobsCount,
      totalWage: totalWage.toFixed(3)
    };
  }, [placementsList]);

  // Status breakdown for Global Placements
  const globalStatusCounts = useMemo(() => {
    let active = 0;
    let completed = 0;
    const all = placementsList.length;

    placementsList.forEach(p => {
      const st = (p.status || 'placed').toLowerCase();
      const isCompleted12m = st === 'completed' || (p.days_elapsed !== null && p.days_elapsed >= 365);
      if (isCompleted12m) {
        completed++;
      } else if (st !== 'resigned') {
        active++;
      }
    });

    return { all, active, completed };
  }, [placementsList]);

  // Status breakdown for My Placements (assigned to logged in Case Manager)
  const myStatusCounts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let all = 0;

    placementsList.forEach(p => {
      if (isMine(p)) {
        all++;
        const st = (p.status || 'placed').toLowerCase();
        const isCompleted12m = st === 'completed' || (p.days_elapsed !== null && p.days_elapsed >= 365);
        if (isCompleted12m) {
          completed++;
        } else if (st !== 'resigned') {
          active++;
        }
      }
    });

    return { all, active, completed };
  }, [placementsList, currentUser]);

  // Active status counts depending on scope (My Placements vs Global Placements)
  const statusCounts = useMemo(() => {
    if (!isAdminOrSuper && scopeFilter === 'mine') {
      return myStatusCounts;
    }
    return globalStatusCounts;
  }, [isAdminOrSuper, scopeFilter, myStatusCounts, globalStatusCounts]);

  // Real-time filtered metrics
  const filteredMetrics = useMemo(() => {
    let wage = 0;
    displayData.forEach(p => {
      wage += parseFloat(p.salary_bhd) || 0;
    });
    return {
      count: displayData.length,
      totalWage: wage.toFixed(3)
    };
  }, [displayData]);

  // Available Talent Pool candidates (unplaced candidates in pool)
  const availablePoolCandidates = useMemo(() => {
    return (candidates || []).filter(c => {
      const st = (c.status || 'registered').toLowerCase();
      const hasEmployer = Boolean(c.company_name && c.company_name.trim()) || Boolean(c.job_id);
      return st === 'registered' && !hasEmployer;
    });
  }, [candidates]);

  // Open Employer Job Vacancies
  const openJobsList = useMemo(() => {
    return (jobs || []).filter(j => {
      const st = (j.status || 'active').toLowerCase();
      if (st === 'closed') return false;
      const remaining = typeof j.vacancies_remaining !== 'undefined'
        ? parseInt(j.vacancies_remaining, 10)
        : Math.max(0, (parseInt(j.vacancies_count, 10) || 1) - (parseInt(j.placed_count, 10) || 0));
      return remaining > 0;
    });
  }, [jobs]);

  // Milestone Gate pill helper
  const renderMilestonePills = (placement) => {
    const msList = placement.milestones_list || [];
    const findMs = (day) => msList.find(m => {
      const t = String(m.milestone_title || m.type || '').toLowerCase();
      if (day === 0) return t.includes('placement') || t.includes('day 0') || t.includes('joining');
      if (day === 180) return t.includes('180') || t.includes('6 month') || t.includes('probation');
      if (day === 365) return t.includes('365') || t.includes('1 year') || t.includes('annual');
      return false;
    });

    const m0 = findMs(0);
    const m180 = findMs(180);
    const m365 = findMs(365);

    const getPill = (label, ms) => {
      if (!ms) {
        return (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              fontSize: '0.68rem',
              fontWeight: 700,
              background: 'var(--bg-tertiary, #f1f5f9)',
              color: 'var(--text-muted, #94a3b8)',
              border: '1px solid var(--border-color, #e2e8f0)',
              fontFamily: 'var(--font-mono)'
            }}
            title={`${label}: Pending Gate`}
          >
            {label}
          </span>
        );
      }
      const st = (ms.status || 'pending').toLowerCase();
      let bg = 'rgba(148, 163, 184, 0.15)';
      let col = 'var(--text-muted, #64748b)';
      let border = 'rgba(148, 163, 184, 0.3)';
      let icon = '⏳';

      if (st === 'paid') {
        bg = 'rgba(16, 185, 129, 0.15)';
        col = 'var(--success, #10b981)';
        border = 'rgba(16, 185, 129, 0.3)';
        icon = '✓';
      } else if (st === 'claimed' || st === 'approved') {
        bg = 'rgba(14, 165, 233, 0.15)';
        col = 'var(--primary, #0ea5e9)';
        border = 'rgba(14, 165, 233, 0.3)';
        icon = '📑';
      } else if (st === 'due' || st === 'eligible') {
        bg = 'rgba(245, 158, 11, 0.15)';
        col = 'var(--warning, #f59e0b)';
        border = 'rgba(245, 158, 11, 0.3)';
        icon = '⚡';
      } else if (st === 'disputed') {
        bg = 'rgba(239, 68, 68, 0.15)';
        col = 'var(--danger, #ef4444)';
        border = 'rgba(239, 68, 68, 0.3)';
        icon = '⚠️';
      }

      return (
        <span
          style={{
            padding: '2px 7px',
            borderRadius: '4px',
            fontSize: '0.68rem',
            fontWeight: 700,
            background: bg,
            color: col,
            border: `1px solid ${border}`,
            fontFamily: 'var(--font-mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}
          title={`${label}: ${ms.milestone_title || ''} • Status: ${ms.status}`}
        >
          <span>{icon}</span> {label}
        </span>
      );
    };

    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {getPill('D0', m0)}
        {getPill('D180', m180)}
        {getPill('D365', m365)}
      </div>
    );
  };

  // Expandable Child Row
  const renderPlacementChildRow = (row) => {
    const job = row.linked_job;
    const msList = row.milestones_list || [];

    return (
      <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', margin: '0.25rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          
          {/* Box 1: Employment Contract Particulars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📜</span> Employment Contract & Compliance
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div><strong>Employee Type:</strong> {row.employee_type || 'Full-Time Standard'}</div>
              <div><strong>MOL Certified:</strong> <span className={`badge ${row.mol_certified === 'Yes' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>{row.mol_certified || 'Yes'}</span></div>
              <div><strong>Long MOL Verification:</strong> {row.long_mol || 'No'}</div>
              <div><strong>Joining Date:</strong> {window.formatAppDate(row.joining_date)} {row.days_elapsed !== null && <span style={{ color: 'var(--text-muted)' }}>({row.days_elapsed} days in placement)</span>}</div>
              <div><strong>Commercial Registration (CR):</strong> <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.employer_cr || 'N/A'}</span></div>
              {row.comments && <div><strong>Placement Remarks:</strong> <em>{row.comments}</em></div>}
            </div>
          </div>

          {/* Box 2: Linked Employer Job Vacancy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🏢</span> Linked Employer Job Allocation
            </div>
            {job ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div><strong>Job Code:</strong> <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>{job.job_code}</span></div>
                <div><strong>Job Title:</strong> {job.position_title}</div>
                <div><strong>Department:</strong> {job.department || 'General Operations'}</div>
                <div><strong>Vacancies:</strong> {job.placed_count || 1} Placed / {job.vacancies_count} Total ({job.vacancies_remaining} Remaining)</div>
                {job.requirements && <div><strong>Requirements:</strong> <span style={{ fontSize: '0.74rem' }}>{job.requirements}</span></div>}
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div>Direct placement without formal vacancy linkage.</div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ width: 'fit-content', fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                  onClick={() => window.AppStore.openModal('LINK_PLACEMENT', { candidate: row })}
                >
                  🔗 Re-link to Job Vacancy
                </button>
              </div>
            )}
          </div>

          {/* Box 3: Milestone Subsidy Progression */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🎯</span> Retention Milestone Gates ({msList.length})
            </div>
            {msList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {msList.map(m => (
                  <div key={m.id || m.milestone_title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', padding: '0.25rem 0.5rem', background: 'var(--card-bg, #ffffff)', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                    <span><strong>{m.milestone_title}</strong> (Due: {window.formatAppDate(m.target_date)})</span>
                    <span className={`badge ${m.status === 'paid' ? 'badge-success' : (m.status === 'claimed' ? 'badge-info' : 'badge-neutral')}`} style={{ fontSize: '0.68rem', textTransform: 'capitalize' }}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active milestones registered for this placement.
              </div>
            )}
          </div>

          {/* Box 4: Candidate Contact Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>👤</span> Candidate Contact Card
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div><strong>Full Name:</strong> {row.full_name}</div>
              <div><strong>CPR:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{row.cpr_no}</span> • {row.gender}</div>
              <div><strong>Education:</strong> {row.education}</div>
              {row.email && <div><strong>Email:</strong> {row.email}</div>}
              {row.phone && <div><strong>Phone:</strong> {row.phone}</div>}
              <div><strong>Case Manager:</strong> {row.case_manager_name || 'System'}</div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  // DataTable Columns
  const columns = [
    {
      key: 'ref_no',
      label: 'Candidate / CPR',
      sortable: true,
      render: (val, row) => {
        const isMyRow = !isAdminOrSuper && isMine(row);
        const inGlobal = !isAdminOrSuper && scopeFilter === 'global';
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem' }}>
                {val}
              </span>
              {isMyRow && inGlobal && (
                <span
                  className="badge badge-primary"
                  style={{ fontSize: '0.64rem', padding: '0.08rem 0.4rem', fontWeight: 800 }}
                  title="Your assigned placement"
                >
                  ★ Mine
                </span>
              )}
            </div>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
              {row.full_name}
            </strong>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              CPR: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.cpr_no}</span> • {row.education}
            </div>
            <div style={{ marginTop: '3px' }}>
              {(() => {
                const isJc = row.approved_by_job_center === true || String(row.approved_by_job_center || 'Yes').toLowerCase() === 'yes';
                const isTamkeen = row.approved_by_tamkeen === true || String(row.approved_by_tamkeen || '').toLowerCase() === 'yes';
                if (isJc && isTamkeen) {
                  return (
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      color: '#059669',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '0.05rem 0.35rem',
                      borderRadius: '3px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px'
                    }} title="Approved by both Job Center & Tamkeen">
                      ✓ Both Approved
                    </span>
                  );
                }
                if (isJc) {
                  return (
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      color: '#d97706',
                      background: 'rgba(245, 158, 11, 0.14)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      padding: '0.05rem 0.35rem',
                      borderRadius: '3px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px'
                    }} title="Approved by Job Center only (Tamkeen Pending)">
                      🏬 Job Center Only
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        );
      }
    },
    {
      key: 'company_name',
      label: 'Employer Enterprise',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{val}</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
            {row.employer_cr ? (
              <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                CR: {row.employer_cr}
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CR Not Stated</span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>&bull; {row.department_display}</span>
          </div>
        </div>
      )
    },
    {
      key: 'position_title',
      label: 'Job Position & Code',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
            {row.job_display_title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
            {row.job_display_code ? (
              <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700 }}>
                {row.job_display_code}
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Unlinked Code
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              &bull; {row.employee_type || 'Full-Time'}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'joining_date',
      label: 'Joining Date & Tenure',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
            {window.formatAppDate(val)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {row.days_elapsed !== null ? `${row.days_elapsed} days in service` : 'Active Placement'}
          </div>
        </div>
      )
    },
    {
      key: 'salary_bhd',
      label: 'Salary & MOL',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.86rem', color: 'var(--primary)' }}>
            {currency} {Number(val || 0).toFixed(3)}
          </div>
          <div style={{ marginTop: '2px' }}>
            <span className={`badge ${row.mol_certified === 'Yes' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
              MOL: {row.mol_certified || 'Yes'}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'milestones',
      label: 'Retention Gates',
      sortable: false,
      render: (_, row) => renderMilestonePills(row)
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val, row) => {
        const isMyRow = !isAdminOrSuper && isMine(row);
        const inGlobal = !isAdminOrSuper && scopeFilter === 'global';
        return (
          <span
            className={`badge ${isMyRow ? 'badge-primary' : 'badge-neutral'}`}
            style={{
              fontWeight: isMyRow ? 800 : 600,
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              border: isMyRow && inGlobal ? '1px solid var(--primary)' : undefined,
              boxShadow: isMyRow && inGlobal ? '0 1px 3px rgba(37,99,235,0.25)' : undefined
            }}
            title={isMyRow ? 'Assigned to your caseload' : ''}
          >
            {isMyRow && <span>★</span>}
            {val || 'System'}
            {isMyRow && <span style={{ opacity: 0.85, fontSize: '0.68rem' }}>(You)</span>}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '175px' }}>
          {/* Row 1: Claim and Renew / Exit */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className="btn btn-primary btn-sm"
              title="File Subsidy Claim for this Placement"
              style={{ fontSize: '0.74rem', padding: '0.22rem 0.5rem', fontWeight: 700, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
              onClick={() => window.AppStore.openModal('NEW_CLAIM', { candidate: row })}
            >
              <span>💰</span> Claim
            </button>

            <button
              className="btn btn-warning btn-sm"
              title="If candidate exited or resigned, renew registration and return to available pool"
              style={{ fontSize: '0.74rem', padding: '0.22rem 0.5rem', fontWeight: 700, flex: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap' }}
              onClick={() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate: row, fromPlaced: true })}
            >
              <span>🔄</span> Renew / Exit
            </button>
          </div>

          {/* Row 2: Dossier and Edit */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className="btn btn-outline btn-sm"
              title="View Placement Dossier"
              style={{ fontSize: '0.74rem', padding: '0.22rem 0.5rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
              onClick={() => window.AppStore.openModal('PLACEMENT_DOSSIER', { candidate: row })}
            >
              <span>👁️</span> Dossier
            </button>
            
            <button
              className="btn btn-outline btn-sm"
              title="Edit Employment Contract / Placement"
              style={{ fontSize: '0.74rem', padding: '0.22rem 0.5rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
              onClick={() => window.AppStore.openModal('LINK_PLACEMENT', { candidate: row })}
            >
              <span>✏️</span> Edit
            </button>
          </div>
        </div>
      )
    }
  ];

  const labelStyle = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' };
  const filterBox = (flex, min) => ({ display: 'flex', alignItems: 'center', gap: '0.45rem', flex, minWidth: min });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💼</span> Placements & Employment Contracts
          </h1>
          <p className="page-subtitle">
            Employer-candidate employment contracts, salary commitments, and Tamkeen/MOL retention milestone gates.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 700 }}
            onClick={() => window.AppStore.openModal('BATCH_PLACEMENT')}
            title="Open Placement Allocation Studio to allocate candidates into open employer job vacancies"
          >
            <span>⚡</span>
            <span>Open Placement Allocation Studio</span>
            {availablePoolCandidates.length > 0 && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.25)',
                padding: '1px 7px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.74rem',
                fontWeight: 800
              }}>
                {availablePoolCandidates.length} in Pool
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scope Navigation Segmented Switch for Case Managers: My Placements vs Global Placements */}
      {!isAdminOrSuper && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          padding: '0.65rem 0.85rem',
          background: 'var(--bg-tertiary, #f8fafc)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 'var(--radius-md, 10px)',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.95rem' }}>📂</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              View Scope:
            </span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-card, #ffffff)',
            border: '1.5px solid var(--border-light, #cbd5e1)',
            borderRadius: '24px',
            padding: '3px',
            gap: '3px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <button
              type="button"
              style={{
                border: 'none',
                borderRadius: '20px',
                padding: '0.45rem 1.15rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                background: scopeFilter === 'mine' ? 'var(--primary, #2563eb)' : 'transparent',
                color: scopeFilter === 'mine' ? '#ffffff' : 'var(--text-secondary, #64748b)',
                boxShadow: scopeFilter === 'mine' ? '0 2px 6px rgba(37,99,235,0.35)' : 'none'
              }}
              onClick={() => handleScopeChange('mine')}
            >
              <span>👤 My Placements</span>
              <span style={{
                background: scopeFilter === 'mine' ? 'rgba(255,255,255,0.28)' : 'var(--bg-tertiary, #f1f5f9)',
                color: scopeFilter === 'mine' ? '#ffffff' : 'var(--text-primary)',
                border: scopeFilter === 'mine' ? 'none' : '1px solid var(--border-light)',
                padding: '0.1rem 0.5rem',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 800
              }}>
                {myStatusCounts.all}
              </span>
            </button>

            <button
              type="button"
              style={{
                border: 'none',
                borderRadius: '20px',
                padding: '0.45rem 1.15rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                background: scopeFilter === 'global' ? 'var(--primary, #2563eb)' : 'transparent',
                color: scopeFilter === 'global' ? '#ffffff' : 'var(--text-secondary, #64748b)',
                boxShadow: scopeFilter === 'global' ? '0 2px 6px rgba(37,99,235,0.35)' : 'none'
              }}
              onClick={() => handleScopeChange('global')}
            >
              <span>🌐 Global Placements</span>
              <span style={{
                background: scopeFilter === 'global' ? 'rgba(255,255,255,0.28)' : 'var(--bg-card, #ffffff)',
                color: scopeFilter === 'global' ? '#ffffff' : 'var(--text-primary)',
                border: scopeFilter === 'global' ? 'none' : '1px solid var(--border-light)',
                padding: '0.1rem 0.5rem',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 800
              }}>
                {globalStatusCounts.all}
              </span>
            </button>
          </div>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {scopeFilter === 'mine' 
              ? 'Showing only placements assigned to your caseload' 
              : 'Viewing all placements across all case managers (your placements are highlighted)'}
          </span>
        </div>
      )}

      {/* Scope Info Banner for Global Placements in Case Manager Login */}
      {!isAdminOrSuper && scopeFilter === 'global' && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.55rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.8rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.05rem' }}>🌐</span>
            <span>
              <strong>Global Placements View:</strong> Viewing all {globalStatusCounts.all} placements. Your assigned placements are highlighted in blue with <strong style={{ color: 'var(--primary)' }}>★ Mine</strong>.
            </span>
          </div>
          <span className="badge badge-primary" style={{ fontWeight: 800, fontSize: '0.74rem' }}>
            ★ {myStatusCounts.all} of Yours Highlighted
          </span>
        </div>
      )}

      {/* Lifecycle Status Navigation Filter Chips: Active Placements (Default) -> Completed 12 Months -> All */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1.25rem',
        overflowX: 'auto',
        paddingBottom: '4px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem' }}>🎯</span>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Lifecycle Status:
          </span>
        </div>

        {[
          { key: 'active', label: '💼 Active Placements', count: statusCounts.active },
          { key: 'completed', label: '🎓 Completed 12 Months', count: statusCounts.completed },
          { key: 'all', label: 'All', count: statusCounts.all },
        ].map(tab => {
          const isSelected = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              style={{
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: isSelected ? 700 : 500,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                color: isSelected ? 'var(--primary)' : 'var(--text-primary)'
              }}
              onClick={() => handleStatusChange(tab.key)}
            >
              <span>{tab.label}</span>
              <span style={{
                background: isSelected ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: isSelected ? '#ffffff' : 'var(--text-muted)',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Structured Multi-Criteria Filter Card */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          overflow: 'visible',
          position: 'relative',
          zIndex: 20
        }}
      >
        {/* Row 1: Employer, Candidate, Position, and Department Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem 1rem', alignItems: 'center' }}>
          
          {/* Employer Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <span style={labelStyle}><span>🏢</span> Employer:</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={employerOptions}
                  value={selectedEmployer}
                  onChange={handleEmployerChange}
                  placeholder="All Employers..."
                />
              ) : (
                <select className="select-control" value={selectedEmployer} onChange={e => handleEmployerChange(e.target.value)}>
                  {employerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Candidate Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <span style={labelStyle}><span>👤</span> Candidate:</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={candidateOptions}
                  value={selectedCandidate}
                  onChange={handleCandidateChange}
                  placeholder="All Candidates..."
                />
              ) : (
                <select className="select-control" value={selectedCandidate} onChange={e => handleCandidateChange(e.target.value)}>
                  {candidateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Position Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <span style={labelStyle}><span>💼</span> Position:</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={positionOptions}
                  value={selectedPosition}
                  onChange={handlePositionChange}
                  placeholder="All Positions..."
                />
              ) : (
                <select className="select-control" value={selectedPosition} onChange={e => handlePositionChange(e.target.value)}>
                  {positionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Department Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <span style={labelStyle}><span>🏬</span> Department:</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={departmentOptions}
                  value={selectedDepartment}
                  onChange={handleDepartmentChange}
                  placeholder="All Departments..."
                />
              ) : (
                <select className="select-control" value={selectedDepartment} onChange={e => handleDepartmentChange(e.target.value)}>
                  {departmentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Joining Date Range, Filing Date Range, Case Manager, and Clear Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            
            {/* Joining Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={labelStyle}><span>📅</span> Joining Date:</span>
              <input
                type="date"
                className="input-control"
                style={{ width: '135px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                value={joinDateFrom}
                onChange={e => handleJoinDateFrom(e.target.value)}
                title="Joining Date From"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
              <input
                type="date"
                className="input-control"
                style={{ width: '135px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                value={joinDateTo}
                onChange={e => handleJoinDateTo(e.target.value)}
                title="Joining Date To"
              />
              {(joinDateFrom || joinDateTo) && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleClearJoinDates}
                  title="Clear Joining Date range"
                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem', lineHeight: 1 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filing / Registration Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={labelStyle}><span>🗓️</span> Filing Date:</span>
              <input
                type="date"
                className="input-control"
                style={{ width: '135px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                value={filingDateFrom}
                onChange={e => handleFilingDateFrom(e.target.value)}
                title="Filing / Registration Date From"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
              <input
                type="date"
                className="input-control"
                style={{ width: '135px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                value={filingDateTo}
                onChange={e => handleFilingDateTo(e.target.value)}
                title="Filing / Registration Date To"
              />
              {(filingDateFrom || filingDateTo) && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleClearFilingDates}
                  title="Clear Filing Date range"
                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem', lineHeight: 1 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Case Manager Filter */}
            {isAdminOrSuper && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={labelStyle}><span>🛡️</span> Case Manager:</span>
                <select
                  className="select-control"
                  value={selectedCaseManager}
                  onChange={e => handleCaseManagerChange(e.target.value)}
                  style={{ minWidth: '140px', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  <option value="">All Managers</option>
                  {caseManagers.map(cm => (
                    <option key={cm.id || cm.username} value={cm.case_manager_code || cm.full_name}>
                      {cm.case_manager_code || cm.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Reset All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'var(--danger)', padding: '0.3rem 0.75rem' }}
              onClick={handleResetAll}
            >
              ✕ Reset All Filters ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Row 3: Filter Summary Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-light)', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--primary)' }}>{filteredMetrics.count}</strong> of {scopedPlacementsList.length} placements
            </span>
            <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
            <span style={{ color: 'var(--text-muted)' }}>
              Filtered Wage Commitment: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{currency} {filteredMetrics.totalWage}</strong>
            </span>
            {!isAdminOrSuper && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  View Scope: <strong style={{ color: scopeFilter === 'mine' ? 'var(--primary)' : 'inherit' }}>{scopeFilter === 'mine' ? '👤 My Placements' : '🌐 Global View'}</strong>
                </span>
              </>
            )}
          </div>
          {statusFilter !== 'all' && (
            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
              Filtered by: {statusFilter === 'active' ? 'Active Placements' : (statusFilter === 'completed' ? 'Completed 12 Months' : statusFilter)}
            </span>
          )}
        </div>
      </div>

      {/* DataTable */}
      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          expandable={true}
          renderChildRow={renderPlacementChildRow}
          rowStyle={row => {
            if (!isAdminOrSuper && isMine(row) && scopeFilter === 'global') {
              return {
                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                borderLeft: '4px solid var(--primary)'
              };
            }
            return undefined;
          }}
          searchPlaceholder="🔍 Search Candidate, CPR, Employer, CR, Job Title, Job Code..."
          searchKeys={[
            'ref_no',
            'full_name',
            'cpr_no',
            'company_name',
            'employer_cr',
            'position_title',
            'job_code',
            'department',
            'department_display',
            'case_manager_name'
          ]}
          exportFilename="Candidate_Placements_Ledger_SaNDS.csv"
          emptyMessage="No placement agreements found matching your search criteria."
        />
      </div>
    </div>
  );
}


window.PlacementsView = PlacementsView;

