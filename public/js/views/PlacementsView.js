/**
 * Placements View - Candidate Employment Contracts & Milestone Retention Ledger
 * Powered by DataTable with multi-criteria filtering, child rows, and claim triggers.
 */

function PlacementsView({ state }) {
  const { candidates = [], jobs = [], milestones = [], claims = [], payments = [], settings = {}, currentUser, caseManagers = [] } = state;
  const currency = settings.currency || 'BHD';
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const { useState, useMemo } = React;
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

  // Placement Studio State (for placing available pool candidates to jobs)
  const [studioOpen, setStudioOpen] = useState(true);
  const [studioJobId, setStudioJobId] = useState('');
  const [candidatePoolSearch, setCandidatePoolSearch] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [batchJoiningDate, setBatchJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchNotes, setBatchNotes] = useState('');
  const [studioSubmitting, setStudioSubmitting] = useState(false);

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

  // Filter options for dropdowns
  const candidateOptions = useMemo(() => {
    const list = placementsList.map(p => ({
      value: String(p.id),
      label: p.full_name,
      subLabel: `Ref: ${p.ref_no} • CPR: ${p.cpr_no} • ${p.company_name}`,
      searchKeywords: `${p.full_name} ${p.cpr_no} ${p.ref_no} ${p.company_name}`
    })).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Candidates (${list.length})`, subLabel: 'Filter by placed candidate' }, ...list];
  }, [placementsList]);

  const employerOptions = useMemo(() => {
    const map = new Map();
    placementsList.forEach(p => {
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
  }, [placementsList]);

  const positionOptions = useMemo(() => {
    const map = new Map();
    placementsList.forEach(p => {
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
  }, [placementsList]);

  const departmentOptions = useMemo(() => {
    const map = new Map();
    placementsList.forEach(p => {
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
  }, [placementsList]);

  // Filter display dataset
  const displayData = useMemo(() => {
    return placementsList.filter(p => {
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
  }, [placementsList, selectedEmployer, selectedCandidate, selectedPosition, selectedDepartment, selectedCaseManager, statusFilter, joinDateFrom, joinDateTo, filingDateFrom, filingDateTo]);

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

  // Status breakdown counts across all placements: Active Placements, Completed 12 Months, All
  const statusCounts = useMemo(() => {
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

  // Selected Studio Job & Dynamic Constraints
  const selectedStudioJob = useMemo(() => {
    if (!studioJobId) return null;
    return (jobs || []).find(j => String(j.id) === String(studioJobId)) || null;
  }, [studioJobId, jobs]);

  const maxVacancies = useMemo(() => {
    if (!selectedStudioJob) return 0;
    return typeof selectedStudioJob.vacancies_remaining !== 'undefined'
      ? parseInt(selectedStudioJob.vacancies_remaining, 10)
      : Math.max(0, (parseInt(selectedStudioJob.vacancies_count, 10) || 1) - (parseInt(selectedStudioJob.placed_count, 10) || 0));
  }, [selectedStudioJob]);

  const jobDefaultSalary = useMemo(() => {
    if (!selectedStudioJob) return 450.0;
    const s = parseFloat(selectedStudioJob.salary_offered_bhd || selectedStudioJob.salary_bhd);
    return isNaN(s) || s <= 0 ? 450.0 : s;
  }, [selectedStudioJob]);

  // Filter available pool candidates with live search
  const filteredPool = useMemo(() => {
    if (!candidatePoolSearch.trim()) return availablePoolCandidates;
    const q = candidatePoolSearch.toLowerCase().trim();
    return availablePoolCandidates.filter(c => {
      const name = (c.candidate_name || c.full_name || '').toLowerCase();
      const cpr = (c.cpr_no || '').toLowerCase();
      const ref = (c.ref_no || '').toLowerCase();
      const skills = (c.skills || '').toLowerCase();
      const phone = (c.phone_number || c.phone || '').toLowerCase();
      const edu = (c.highest_education || c.education || '').toLowerCase();
      return name.includes(q) || cpr.includes(q) || ref.includes(q) || skills.includes(q) || phone.includes(q) || edu.includes(q);
    });
  }, [availablePoolCandidates, candidatePoolSearch]);

  const totalAllocatedSalary = useMemo(() => {
    return allocations.reduce((acc, cur) => acc + (parseFloat(cur.salary_bhd) || 0), 0);
  }, [allocations]);

  // Studio Handlers
  const handleSelectStudioJob = (jobId) => {
    setStudioJobId(jobId);
    if (!jobId) {
      setAllocations([]);
      return;
    }
    const job = (jobs || []).find(j => String(j.id) === String(jobId));
    if (!job) return;
    const rem = typeof job.vacancies_remaining !== 'undefined'
      ? parseInt(job.vacancies_remaining, 10)
      : Math.max(0, (parseInt(job.vacancies_count, 10) || 1) - (parseInt(job.placed_count, 10) || 0));
    const newSalary = parseFloat(job.salary_offered_bhd || job.salary_bhd) || 450.0;
    const newTitle = job.position_title || job.job_title || 'Specialist';

    // If existing allocations exceed remaining vacancies, trim them
    setAllocations(prev => {
      const trimmed = prev.slice(0, rem);
      return trimmed.map(a => ({
        ...a,
        position_title: newTitle,
        salary_bhd: newSalary
      }));
    });
  };

  const handleToggleCandidate = (cand) => {
    if (!selectedStudioJob) {
      window.AppStore.showNotification('Please select an employer job opening first.', 'warning');
      return;
    }
    const exists = allocations.some(a => a.candidate_id === cand.id);
    if (exists) {
      setAllocations(prev => prev.filter(a => a.candidate_id !== cand.id));
    } else {
      if (allocations.length >= maxVacancies) {
        window.AppStore.showNotification(`Cannot allocate more than ${maxVacancies} candidate(s). This job opening only has ${maxVacancies} remaining vacancy slot(s).`, 'warning');
        return;
      }
      const newAllocation = {
        candidate_id: cand.id,
        full_name: cand.candidate_name || cand.full_name,
        cpr_no: cand.cpr_no || '',
        ref_no: cand.ref_no || '',
        position_title: selectedStudioJob.position_title || selectedStudioJob.job_title || 'Specialist',
        salary_bhd: jobDefaultSalary,
        joining_date: batchJoiningDate || new Date().toISOString().split('T')[0],
        employee_type: 'Full-Time',
        mol_certified: 'Yes',
        comments: batchNotes || ''
      };
      setAllocations(prev => [...prev, newAllocation]);
    }
  };

  const handleUpdateAllocation = (candidateId, field, val) => {
    setAllocations(prev => prev.map(a => {
      if (a.candidate_id === candidateId) {
        return { ...a, [field]: val };
      }
      return a;
    }));
  };

  const handleRemoveAllocation = (candidateId) => {
    setAllocations(prev => prev.filter(a => a.candidate_id !== candidateId));
  };

  const handleApplyDateToAll = () => {
    if (!batchJoiningDate) {
      window.AppStore.showNotification('Please pick a batch joining date first.', 'warning');
      return;
    }
    if (allocations.length === 0) {
      window.AppStore.showNotification('No candidates currently allocated to apply date to.', 'info');
      return;
    }
    setAllocations(prev => prev.map(a => ({ ...a, joining_date: batchJoiningDate })));
    window.AppStore.showNotification(`Applied joining date (${batchJoiningDate}) to all ${allocations.length} allocated candidates!`, 'success');
  };

  const handleApplyNotesToAll = () => {
    if (allocations.length === 0) {
      window.AppStore.showNotification('No candidates currently allocated to apply notes to.', 'info');
      return;
    }
    setAllocations(prev => prev.map(a => ({ ...a, comments: batchNotes })));
    window.AppStore.showNotification(`Applied notes to all ${allocations.length} allocated candidates!`, 'success');
  };

  const handleResetAllSalary = () => {
    if (!selectedStudioJob) return;
    if (allocations.length === 0) return;
    setAllocations(prev => prev.map(a => ({ ...a, salary_bhd: jobDefaultSalary })));
    window.AppStore.showNotification(`Reset all salaries to job default (${currency} ${jobDefaultSalary.toFixed(3)})!`, 'info');
  };

  const handleConfirmBatchPlacement = async () => {
    if (!selectedStudioJob) {
      window.AppStore.showNotification('Please select an employer job opening first.', 'warning');
      return;
    }
    if (allocations.length === 0) {
      window.AppStore.showNotification('Please select at least one candidate from the pool.', 'warning');
      return;
    }
    if (allocations.length > maxVacancies) {
      window.AppStore.showNotification(`Cannot place ${allocations.length} candidates. Maximum remaining vacancies is ${maxVacancies}.`, 'error');
      return;
    }

    for (const a of allocations) {
      const s = parseFloat(a.salary_bhd);
      if (isNaN(s) || s <= 0) {
        window.AppStore.showNotification(`Please specify a valid salary (> 0) for candidate ${a.full_name}.`, 'warning');
        return;
      }
      if (!a.joining_date) {
        window.AppStore.showNotification(`Please specify a valid joining date for candidate ${a.full_name}.`, 'warning');
        return;
      }
    }

    const jobTitle = selectedStudioJob.position_title || selectedStudioJob.job_title || 'Position';
    const confirmMsg = `Are you sure you want to place ${allocations.length} candidate(s) at ${selectedStudioJob.company_name} for position "${jobTitle}"?\n\nAutomated Day 0, Day 180, and Day 365 retention milestone gates will be created for each candidate.`;

    let userConfirmed = false;
    if (window.swal) {
      const result = await window.swal.fire({
        title: 'Confirm Placements',
        text: confirmMsg,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Yes, Confirm Placements (${allocations.length})`,
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#10b981'
      });
      userConfirmed = result.isConfirmed;
    } else if (window.confirm) {
      userConfirmed = window.confirm(confirmMsg);
    }

    if (!userConfirmed) return;

    setStudioSubmitting(true);
    try {
      const payload = {
        job_id: selectedStudioJob.id,
        job_code: selectedStudioJob.job_code,
        company_name: selectedStudioJob.company_name,
        employer_cr: selectedStudioJob.employer_cr,
        department: selectedStudioJob.department || 'Operations',
        position_title: jobTitle,
        placements: allocations.map(a => ({
          candidate_id: a.candidate_id,
          position_title: a.position_title || jobTitle,
          salary_bhd: parseFloat(a.salary_bhd),
          joining_date: a.joining_date,
          employee_type: a.employee_type || 'Full-Time',
          mol_certified: a.mol_certified || 'Yes',
          comments: a.comments || ''
        }))
      };

      if (window.api && window.api.candidates && typeof window.api.candidates.batchPlacement === 'function') {
        await window.api.candidates.batchPlacement(payload);
      } else {
        for (const p of payload.placements) {
          await window.api.candidates.linkPlacement(p.candidate_id, {
            job_id: payload.job_id,
            job_code: payload.job_code,
            company_name: payload.company_name,
            employer_cr: payload.employer_cr,
            department: payload.department,
            position_title: p.position_title,
            salary_bhd: p.salary_bhd,
            joining_date: p.joining_date,
            employee_type: p.employee_type,
            mol_certified: p.mol_certified,
            comments: p.comments
          });
        }
      }

      window.AppStore.showNotification(`Successfully placed ${allocations.length} candidate(s) to ${selectedStudioJob.company_name}! Automated milestone gates created.`, 'success');
      setAllocations([]);
      setStudioJobId('');
      setCandidatePoolSearch('');
      await window.AppStore.refreshData();
    } catch (err) {
      console.error('Batch placement error:', err);
      window.AppStore.showNotification('Error creating batch placements: ' + (err.message || 'Server error'), 'error');
    } finally {
      setStudioSubmitting(false);
    }
  };

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
      render: (val, row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem' }}>
              {val}
            </span>
          </div>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
            {row.full_name}
          </strong>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            CPR: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.cpr_no}</span> • {row.education}
          </div>
        </div>
      )
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
      render: (val) => (
        <span className="badge badge-neutral" style={{ fontWeight: 600, fontSize: '0.74rem' }}>
          {val || 'System'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          <button
            className="btn btn-outline btn-sm"
            title="View Placement Dossier"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
            onClick={() => window.AppStore.openModal('PLACEMENT_DOSSIER', { candidate: row })}
          >
            👁️ Dossier
          </button>
          
          <button
            className="btn btn-outline btn-sm"
            title="Edit Employment Contract / Placement"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
            onClick={() => window.AppStore.openModal('LINK_PLACEMENT', { candidate: row })}
          >
            ✏️ Edit
          </button>

          <button
            className="btn btn-warning btn-sm"
            title="If candidate exited or resigned, renew registration and return to available pool"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}
            onClick={() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate: row, fromPlaced: true })}
          >
            <span>🔄</span> Renew / Exit
          </button>

          <button
            className="btn btn-primary btn-sm"
            title="File Subsidy Claim for this Placement"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
            onClick={() => window.AppStore.openModal('NEW_CLAIM', { candidate: row })}
          >
            Claim
          </button>
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
            className={`btn ${studioOpen ? 'btn-primary' : 'btn-outline'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 700 }}
            onClick={() => setStudioOpen(prev => !prev)}
            title="Toggle the Talent Pool & Placement Studio to place unplaced pool candidates to open vacancies"
          >
            <span>⚡</span>
            <span>{studioOpen ? 'Hide Placement Studio' : `Talent Pool Studio (${availablePoolCandidates.length} in Pool)`}</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            onClick={() => window.AppStore.setTab('jobs')}
          >
            <span>🏢</span> View Jobs & Vacancies
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            onClick={() => window.AppStore.openModal('LINK_PLACEMENT')}
          >
            <span>➕</span> Link New Placement
          </button>
        </div>
      </div>

      {/* Talent Pool & Job Placement Studio Area */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          background: 'var(--bg-primary, #ffffff)'
        }}
      >
        {/* Studio Header Bar */}
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%)',
            borderBottom: studioOpen ? '1px solid var(--border-color, #e2e8f0)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={() => setStudioOpen(prev => !prev)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Talent Pool & Job Placement Studio
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--success, #10b981)',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {availablePoolCandidates.length} Available in Pool
                </span>
                {allocations.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(14, 165, 233, 0.15)',
                      color: 'var(--primary, #0ea5e9)',
                      border: '1px solid rgba(14, 165, 233, 0.3)'
                    }}
                  >
                    {allocations.length} Candidate(s) Selected
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Allocate single or multiple candidates from the available pool into open job vacancies with custom salaries, individual remarks, and automated retention milestones.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={(e) => {
                e.stopPropagation();
                setStudioOpen(prev => !prev);
              }}
            >
              <span>{studioOpen ? '▲ Collapse Studio' : '▼ Expand Studio'}</span>
            </button>
          </div>
        </div>

        {/* Studio Content Body */}
        {studioOpen && (
          <div style={{ padding: '1.25rem' }}>
            {/* Step 1: Select Employer Job Opening */}
            <div
              style={{
                background: 'var(--bg-secondary, #f8fafc)',
                padding: '1rem',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-color, #e2e8f0)',
                marginBottom: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>1</span>
                  Select Employer Job Opening ({openJobsList.length} Open Vacancies Available)
                </label>
                {selectedStudioJob && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Job Code: <strong>{selectedStudioJob.job_code || `JOB-${selectedStudioJob.id}`}</strong></span>
                    <span>&bull;</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Department: <strong>{selectedStudioJob.department || 'General'}</strong></span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: selectedStudioJob ? '1.5fr 1fr' : '1fr', gap: '1rem', alignItems: 'center' }}>
                <select
                  className="select-control"
                  style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600, padding: '0.55rem 0.75rem' }}
                  value={studioJobId}
                  onChange={e => handleSelectStudioJob(e.target.value)}
                >
                  <option value="">-- Choose Employer Vacancy Opening --</option>
                  {openJobsList.map(j => {
                    const rem = typeof j.vacancies_remaining !== 'undefined'
                      ? parseInt(j.vacancies_remaining, 10)
                      : Math.max(0, (parseInt(j.vacancies_count, 10) || 1) - (parseInt(j.placed_count, 10) || 0));
                    const sal = parseFloat(j.salary_offered_bhd || j.salary_bhd || 0).toFixed(3);
                    return (
                      <option key={j.id} value={j.id}>
                        {j.company_name} — {j.position_title || j.job_title} ({rem} open / {j.vacancies_count || 1} total • {currency} {sal})
                      </option>
                    );
                  })}
                </select>

                {selectedStudioJob && (
                  <div
                    style={{
                      background: 'var(--bg-primary, #ffffff)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '0.55rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {selectedStudioJob.position_title || selectedStudioJob.job_title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Default Salary: <strong style={{ color: 'var(--primary)' }}>{currency} {jobDefaultSalary.toFixed(3)}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span
                          className={`badge ${allocations.length >= maxVacancies ? 'badge-success' : 'badge-warning'}`}
                          style={{ fontSize: '0.75rem', fontWeight: 800 }}
                        >
                          {allocations.length} / {maxVacancies} slots filled
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {maxVacancies - allocations.length > 0
                          ? `${maxVacancies - allocations.length} slot(s) remaining`
                          : 'Job capacity reached'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Steps 2 & 3: Two-Column Studio Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '1.25rem', alignItems: 'start' }}>
              
              {/* Left Column: Step 2 Available Talent Pool */}
              <div
                style={{
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1rem',
                  background: 'var(--bg-primary, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>2</span>
                    Available Talent Pool
                  </label>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {filteredPool.length} of {availablePoolCandidates.length}
                  </span>
                </div>

                {/* Candidate Pool Live Search */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Search pool by name, CPR, skills, phone..."
                    style={{ fontSize: '0.82rem', paddingRight: '2rem' }}
                    value={candidatePoolSearch}
                    onChange={e => setCandidatePoolSearch(e.target.value)}
                  />
                  {candidatePoolSearch && (
                    <button
                      type="button"
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                      onClick={() => setCandidatePoolSearch('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Capacity warning if filled */}
                {selectedStudioJob && allocations.length >= maxVacancies && (
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.74rem',
                      color: 'var(--warning, #b45309)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>⚠️</span>
                    <span>Job capacity limit reached ({maxVacancies} max openings). Uncheck an allocated candidate to pick another.</span>
                  </div>
                )}

                {/* Candidate Pool Scrollable List */}
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '2px' }}>
                  {filteredPool.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {availablePoolCandidates.length === 0
                        ? 'No unplaced candidates in the available pool. All registered candidates are placed.'
                        : 'No candidates matched your search criteria.'}
                    </div>
                  ) : (
                    filteredPool.map(cand => {
                      const isAllocated = allocations.some(a => a.candidate_id === cand.id);
                      const isMaxReached = selectedStudioJob && allocations.length >= maxVacancies;

                      return (
                        <div
                          key={cand.id}
                          style={{
                            border: `1px solid ${isAllocated ? 'var(--primary, #0ea5e9)' : 'var(--border-color, #e2e8f0)'}`,
                            background: isAllocated ? 'rgba(14, 165, 233, 0.05)' : 'var(--bg-secondary, #f8fafc)',
                            borderRadius: 'var(--radius-sm, 6px)',
                            padding: '0.6rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                                {cand.candidate_name || cand.full_name}
                              </span>
                              <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                CPR: {cand.cpr_no || 'N/A'}
                              </span>
                              {cand.ref_no && (
                                <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                  {cand.ref_no}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {cand.skills && <span>Skills: <strong>{cand.skills}</strong></span>}
                              {cand.highest_education && <span>&bull; {cand.highest_education}</span>}
                              {cand.phone_number && <span>&bull; 📞 {cand.phone_number}</span>}
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`btn btn-sm ${isAllocated ? 'btn-primary' : 'btn-outline'}`}
                            disabled={!selectedStudioJob || (!isAllocated && isMaxReached)}
                            title={!selectedStudioJob ? 'Choose a job vacancy in Step 1 first' : (!isAllocated && isMaxReached ? `Capacity reached (${maxVacancies} max openings)` : isAllocated ? 'Remove from placement' : 'Allocate to this job')}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.55rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => handleToggleCandidate(cand)}
                          >
                            {isAllocated ? '✓ Selected' : '+ Allocate'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Step 3 Allocations, Individual Salary & Notes, Confirm */}
              <div
                style={{
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1rem',
                  background: 'var(--bg-primary, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>3</span>
                    Configure Placement Details ({allocations.length} Selected)
                  </label>
                  {allocations.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', color: 'var(--danger)' }}
                      onClick={() => setAllocations([])}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {allocations.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '3rem 1.5rem',
                      background: 'var(--bg-secondary, #f8fafc)',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px dashed var(--border-color, #cbd5e1)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>👥</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      No Candidates Allocated Yet
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.35rem auto 0 auto', maxWidth: '340px' }}>
                      {selectedStudioJob
                        ? `Select up to ${maxVacancies} candidate(s) from the available talent pool on the left to configure salaries, joining dates, and notes.`
                        : 'Select an employer vacancy opening in Step 1, then choose candidates from the talent pool.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Batch Quick-Apply Controls Bar */}
                    <div
                      style={{
                        background: 'var(--bg-secondary, #f8fafc)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: 'var(--radius-sm, 6px)',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.55rem'
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                        ⚡ Batch Quick-Apply Actions (Optional)
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', alignItems: 'center' }}>
                        {/* Quick-Apply Date */}
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <input
                            type="date"
                            className="form-control"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.45rem', flex: 1 }}
                            value={batchJoiningDate}
                            onChange={e => setBatchJoiningDate(e.target.value)}
                            title="Batch joining date"
                          />
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', padding: '0.3rem 0.55rem' }}
                            onClick={handleApplyDateToAll}
                            title="Apply this joining date to all candidates below"
                          >
                            Apply Date to All
                          </button>
                        </div>

                        {/* Reset Salaries Button */}
                        <div>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.72rem', width: '100%', padding: '0.3rem 0.55rem' }}
                            onClick={handleResetAllSalary}
                            title={`Reset all allocated salaries to default job salary (${currency} ${jobDefaultSalary.toFixed(3)})`}
                          >
                            Reset All to Job Salary ({currency} {jobDefaultSalary.toFixed(3)})
                          </button>
                        </div>
                      </div>

                      {/* Quick-Apply Notes */}
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Uniform remarks/notes for all candidates..."
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem', flex: 1 }}
                          value={batchNotes}
                          onChange={e => setBatchNotes(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', padding: '0.3rem 0.55rem' }}
                          onClick={handleApplyNotesToAll}
                          title="Apply these remarks to all allocated candidates"
                        >
                          Apply Notes to All
                        </button>
                      </div>
                    </div>

                    {/* Candidate Allocations List with Editable Salary and Notes */}
                    <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '2px' }}>
                      {allocations.map((item, idx) => (
                        <div
                          key={item.candidate_id}
                          style={{
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: 'var(--radius-sm, 6px)',
                            padding: '0.65rem 0.85rem',
                            background: 'var(--bg-primary, #ffffff)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          {/* Row 1: Candidate Header + Remove Button */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>
                                {idx + 1}
                              </span>
                              <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                                {item.full_name}
                              </strong>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                CPR: {item.cpr_no || 'N/A'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                              onClick={() => handleRemoveAllocation(item.candidate_id)}
                              title="Remove from allocation"
                            >
                              ✕ Remove
                            </button>
                          </div>

                          {/* Row 2: Inputs for Salary, Joining Date, and Remarks */}
                          <div style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr', gap: '0.6rem', alignItems: 'center' }}>
                            {/* Salary Input */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                                Salary ({currency}):
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                min="1"
                                className="form-control"
                                style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '0.3rem 0.45rem' }}
                                value={item.salary_bhd}
                                onChange={e => handleUpdateAllocation(item.candidate_id, 'salary_bhd', e.target.value)}
                              />
                            </div>

                            {/* Joining Date Input */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                                Joining Date:
                              </label>
                              <input
                                type="date"
                                className="form-control"
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.45rem' }}
                                value={item.joining_date}
                                onChange={e => handleUpdateAllocation(item.candidate_id, 'joining_date', e.target.value)}
                              />
                            </div>

                            {/* Individual Remarks Input */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                                Individual Remarks / Notes:
                              </label>
                              <input
                                type="text"
                                placeholder="Specific terms, probation, notes..."
                                className="form-control"
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.55rem' }}
                                value={item.comments}
                                onChange={e => handleUpdateAllocation(item.candidate_id, 'comments', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Studio Footer: Summary & Confirmation Action */}
                    <div
                      style={{
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-color, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Allocating <strong>{allocations.length}</strong> of <strong>{maxVacancies}</strong> openings to <strong>{selectedStudioJob?.company_name}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Combined Monthly Salary: <strong style={{ color: 'var(--primary)' }}>{currency} {totalAllocatedSalary.toFixed(3)}</strong>
                          &nbsp;&bull;&nbsp;
                          Remaining Vacancies: <strong>{maxVacancies - allocations.length}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-success"
                        disabled={studioSubmitting || allocations.length === 0 || allocations.length > maxVacancies}
                        onClick={handleConfirmBatchPlacement}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          padding: '0.55rem 1.25rem',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <span>{studioSubmitting ? '⏳ Creating Placements...' : '✓ Confirm & Create Placements'}</span>
                        {!studioSubmitting && (
                          <span
                            style={{
                              background: 'rgba(255,255,255,0.25)',
                              borderRadius: 'var(--radius-full)',
                              padding: '1px 7px',
                              fontSize: '0.75rem'
                            }}
                          >
                            {allocations.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lifecycle Status Navigation Tabs: Active Placements (Default) -> Completed 12 Months -> All */}
      <div className="placement-status-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
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
              className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap'
              }}
              onClick={() => handleStatusChange(tab.key)}
            >
              <span>{tab.label}</span>
              <span style={{
                marginLeft: '0.4rem',
                background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--primary)' }}>{filteredMetrics.count}</strong> of {placementsList.length} placements
            </span>
            <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
            <span style={{ color: 'var(--text-muted)' }}>
              Filtered Wage Commitment: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{currency} {filteredMetrics.totalWage}</strong>
            </span>
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

