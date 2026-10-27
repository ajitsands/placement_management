/**
 * Candidates View - Candidate Registry, Document Vault & Placement Linker
 * Powered by DataTable with multi-column search, sorting, pagination, lifecycle status maintenance, and CSV export.
 * Scoped by Case Manager for case_manager role; Global for Admin/Superadmin.
 */

const { useState, useMemo } = React;

function CandidatesView({ state }) {
  const [selectedCaseManager, setSelectedCaseManager] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_cm') || '';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_status') || 'all';
  });
  const [regDateFrom, setRegDateFrom] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_reg_from') || '';
  });
  const [regDateTo, setRegDateTo] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_reg_to') || '';
  });
  const [joinDateFrom, setJoinDateFrom] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_join_from') || '';
  });
  const [joinDateTo, setJoinDateTo] = useState(() => {
    return sessionStorage.getItem('sands_claims_cand_join_to') || '';
  });

  const { candidates, currentUser, caseManagers, settings } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const currency = settings.currency || 'BHD';

  const handleStatusFilterChange = (key) => {
    setStatusFilter(key);
    sessionStorage.setItem('sands_claims_cand_status', key);
  };

  const handleCaseManagerChange = (cm) => {
    setSelectedCaseManager(cm);
    sessionStorage.setItem('sands_claims_cand_cm', cm);
  };

  const handleRegDateFrom = (val) => {
    setRegDateFrom(val);
    sessionStorage.setItem('sands_claims_cand_reg_from', val);
  };

  const handleRegDateTo = (val) => {
    setRegDateTo(val);
    sessionStorage.setItem('sands_claims_cand_reg_to', val);
  };

  const handleJoinDateFrom = (val) => {
    setJoinDateFrom(val);
    sessionStorage.setItem('sands_claims_cand_join_from', val);
  };

  const handleJoinDateTo = (val) => {
    setJoinDateTo(val);
    sessionStorage.setItem('sands_claims_cand_join_to', val);
  };

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

  const handleClearRegDate = () => {
    setRegDateFrom('');
    setRegDateTo('');
    sessionStorage.removeItem('sands_claims_cand_reg_from');
    sessionStorage.removeItem('sands_claims_cand_reg_to');
  };

  const handleClearJoinDate = () => {
    setJoinDateFrom('');
    setJoinDateTo('');
    sessionStorage.removeItem('sands_claims_cand_join_from');
    sessionStorage.removeItem('sands_claims_cand_join_to');
  };

  const handleApplyYearPreset = (type, year) => {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    if (type === 'join') {
      setJoinDateFrom(from);
      setJoinDateTo(to);
      sessionStorage.setItem('sands_claims_cand_join_from', from);
      sessionStorage.setItem('sands_claims_cand_join_to', to);
    } else if (type === 'reg') {
      setRegDateFrom(from);
      setRegDateTo(to);
      sessionStorage.setItem('sands_claims_cand_reg_from', from);
      sessionStorage.setItem('sands_claims_cand_reg_to', to);
    }
  };

  const handleClearDateFilters = () => {
    setRegDateFrom('');
    setRegDateTo('');
    setJoinDateFrom('');
    setJoinDateTo('');
    sessionStorage.removeItem('sands_claims_cand_reg_from');
    sessionStorage.removeItem('sands_claims_cand_reg_to');
    sessionStorage.removeItem('sands_claims_cand_join_from');
    sessionStorage.removeItem('sands_claims_cand_join_to');
  };

  // Compute status counts for filter tabs
  const statusCounts = useMemo(() => {
    const counts = {
      all: candidates.length,
      registered: 0,
      placed: 0,
      completed: 0,
      resigned: 0,
      on_hold: 0
    };
    candidates.forEach(c => {
      let st = (c.status || 'placed').toLowerCase();
      if (st === 'active') st = 'placed';
      if (counts[st] !== undefined) counts[st]++;
      else counts.registered++;
    });
    return counts;
  }, [candidates]);

  // Filter candidates by case manager, status filter, registration dates & joining dates
  const displayData = useMemo(() => {
    let result = candidates;
    if (selectedCaseManager) {
      result = result.filter(c => c.case_manager_name === selectedCaseManager);
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => {
        let st = (c.status || 'placed').toLowerCase();
        if (st === 'active') st = 'placed';
        return st === statusFilter;
      });
    }
    // Filter by Registration Date Range
    if (regDateFrom) {
      result = result.filter(c => {
        const d = parseDateStr(c.registration_date || c.created_at);
        return d && d >= regDateFrom;
      });
    }
    if (regDateTo) {
      result = result.filter(c => {
        const d = parseDateStr(c.registration_date || c.created_at);
        return d && d <= regDateTo;
      });
    }
    // Filter by Joining Date Range
    if (joinDateFrom) {
      result = result.filter(c => {
        const d = parseDateStr(c.joining_date);
        return d && d >= joinDateFrom;
      });
    }
    if (joinDateTo) {
      result = result.filter(c => {
        const d = parseDateStr(c.joining_date);
        return d && d <= joinDateTo;
      });
    }
    return result;
  }, [candidates, selectedCaseManager, statusFilter, regDateFrom, regDateTo, joinDateFrom, joinDateTo]);

  // Status badge styling helper
  const renderStatusBadge = (status, candidate) => {
    let st = (status || 'placed').toLowerCase();
    if (st === 'active') st = 'placed';
    const config = {
      registered: { label: '📋 Registered', cls: 'badge-info', title: 'Available in Talent Pool' },
      placed:     { label: '💼 Placed', cls: 'badge-warning', title: 'Placement Contract Linked' },
      completed:  { label: '🎓 Completed', cls: 'badge-primary', title: '365 Days Program Completed' },
      resigned:   { label: '⚠️ Resigned', cls: 'badge-danger', title: 'Resigned / Voluntary Exit' },
      on_hold:    { label: '⏸️ On Hold', cls: 'badge-neutral', title: 'Verification / On Hold' }
    };
    const c = config[st] || config.placed;

    return (
      <span
        className={`badge ${c.cls}`}
        style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
        title={`${c.title} • Click to change status`}
        onClick={() => window.AppStore.openModal('UPDATE_STATUS', { candidate })}
      >
        {c.label} ▾
      </span>
    );
  };

  const columns = [
    {
      key: 'ref_no',
      label: 'Ref & Reg Date',
      sortable: true,
      render: (val, row) => (
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
            {val}
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Reg: {window.formatAppDate(row.registration_date || row.created_at)}
          </div>
        </div>
      )
    },
    {
      key: 'full_name',
      label: 'Candidate Details',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{val}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            CPR: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.cpr_no}</span> • {row.gender} • {row.education}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Candidate Status',
      sortable: true,
      render: (val, row) => renderStatusBadge(val, row)
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
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
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
      key: 'company_name',
      label: 'Linked Employer Placement',
      sortable: true,
      render: (val, row) => {
        if (val) {
          return (
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>{val}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {row.position_title} • {row.employee_type || 'Full-Time'} • {currency} {Number(row.salary_bhd || 0).toFixed(3)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Joined: {window.formatAppDate(row.joining_date)} {row.employer_cr ? `• CR: ${row.employer_cr}` : ''} • MOL: {row.mol_certified || 'Yes'}
              </div>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontStyle: 'italic' }}>
              ⏳ Available / Unplaced
            </span>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
              onClick={() => window.AppStore.openModal('LINK_PLACEMENT', { candidate: row })}
            >
              🔗 Link Placement
            </button>
          </div>
        );
      }
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => (
        <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{val}</span>
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
            title="Candidate Dossier & Timeline"
            onClick={() => window.AppStore.openModal('CANDIDATE_DETAIL', { candidate: row })}
          >
            👁️ Dossier
          </button>
          
          <button
            className="btn btn-outline btn-sm"
            title={row.company_name ? "Update Placement" : "Link Placement"}
            onClick={() => window.AppStore.openModal('LINK_PLACEMENT', { candidate: row })}
          >
            🔗 Placement
          </button>

          {row.company_name && (
            <button
              className="btn btn-primary btn-sm"
              title="Register Manual Claim"
              onClick={() => window.AppStore.openModal('NEW_CLAIM', { candidate: row })}
            >
              Claim
            </button>
          )}
        </div>
      )
    }
  ];

  const caseManagerFilter = isAdminOrSuper ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Case Manager:</label>
      <select
        className="select-control"
        style={{ padding: '0.3rem 0.65rem', fontSize: '0.82rem', width: 'auto' }}
        value={selectedCaseManager}
        onChange={e => handleCaseManagerChange(e.target.value)}
      >
        <option value="">All Case Managers</option>
        {caseManagers.map(cm => (
          <option key={cm.id} value={cm.case_manager_code || cm.full_name}>
            {cm.full_name} ({cm.case_manager_code || 'CM'})
          </option>
        ))}
      </select>
    </div>
  ) : null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Candidate Registry & Placement Lifecycle</h1>
          <p className="page-subtitle">
            Register candidates, manage verification documents, maintain lifecycle status, and link employer placements with automated retention milestones.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => window.AppStore.openModal('NEW_CANDIDATE')}>
            ➕ Register New Candidate
          </button>
        </div>
      </div>

      {/* Lifecycle Status Filter Navigation Tabs */}
      <div className="candidate-status-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { key: 'all', label: 'All Candidates', count: statusCounts.all },
          { key: 'registered', label: '📋 Available / Registered', count: statusCounts.registered },
          { key: 'placed', label: '💼 Placed', count: statusCounts.placed },
          { key: 'completed', label: '🎓 Completed (365d)', count: statusCounts.completed },
          { key: 'resigned', label: '⚠️ Resigned / Terminated', count: statusCounts.resigned },
          { key: 'on_hold', label: '⏸️ On Hold', count: statusCounts.on_hold },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`btn btn-sm ${statusFilter === tab.key ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.35rem 0.85rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => handleStatusFilterChange(tab.key)}
          >
            <span>{tab.label}</span>
            <span style={{ 
              marginLeft: '0.4rem', 
              background: statusFilter === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
              padding: '0.1rem 0.45rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 800
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Date Filters Bar (Registration Date & Joining Date) */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Registration Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>📅</span> Reg Date:
              </span>
              <input
                type="date"
                className="input-control"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '135px' }}
                value={regDateFrom}
                onChange={e => handleRegDateFrom(e.target.value)}
                title="Registration Date From"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="input-control"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '135px' }}
                value={regDateTo}
                onChange={e => handleRegDateTo(e.target.value)}
                title="Registration Date To"
              />
              {(regDateFrom || regDateTo) && (
                <button
                  type="button"
                  onClick={handleClearRegDate}
                  title="Clear Registration Date filter"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--danger)',
                    fontSize: '0.85rem',
                    padding: '0 0.25rem',
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ width: '1px', height: '22px', background: 'var(--border-light)' }}></div>

            {/* Joining Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>🏢</span> Join Date:
              </span>
              <input
                type="date"
                className="input-control"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '135px' }}
                value={joinDateFrom}
                onChange={e => handleJoinDateFrom(e.target.value)}
                title="Joining Date From"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="input-control"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '135px' }}
                value={joinDateTo}
                onChange={e => handleJoinDateTo(e.target.value)}
                title="Joining Date To"
              />
              {(joinDateFrom || joinDateTo) && (
                <button
                  type="button"
                  onClick={handleClearJoinDate}
                  title="Clear Joining Date filter"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--danger)',
                    fontSize: '0.85rem',
                    padding: '0 0.25rem',
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Indicators & Clear All */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Showing <strong style={{ color: 'var(--primary)' }}>{displayData.length}</strong> of {candidates.length} candidates
            </span>
            {(regDateFrom || regDateTo || joinDateFrom || joinDateTo) ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}
                onClick={handleClearDateFilters}
                title="Clear all registration and joining date filters"
              >
                ✕ Clear All Dates
              </button>
            ) : null}
          </div>
        </div>

        {/* Quick Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px dashed var(--border-light)' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}
            onClick={() => handleApplyYearPreset('join', '2025')}
            title="Filter candidates with Joining Date in 2025"
          >
            🏢 Joined 2025
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}
            onClick={() => handleApplyYearPreset('join', '2026')}
            title="Filter candidates with Joining Date in 2026"
          >
            🏢 Joined 2026
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}
            onClick={() => handleApplyYearPreset('reg', '2025')}
            title="Filter candidates with Registration Date in 2025"
          >
            📅 Reg 2025
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}
            onClick={() => handleApplyYearPreset('reg', '2026')}
            title="Filter candidates with Registration Date in 2026"
          >
            📅 Reg 2026
          </button>
          {(regDateFrom || regDateTo || joinDateFrom || joinDateTo) && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', color: 'var(--text-muted)' }}
              onClick={handleClearDateFilters}
              title="Reset all date filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>


      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          searchPlaceholder="🔍 Search CPR, Name, Ref No, Status, or Employer..."
          customFilter={caseManagerFilter}
          exportFilename="Candidate_Registry_Placements_SaNDS.csv"
          emptyMessage="No candidate records match your selected criteria."
        />
      </div>
    </div>
  );
}

window.CandidatesView = CandidatesView;
