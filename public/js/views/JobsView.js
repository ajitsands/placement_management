/**
 * Jobs & Vacancies View - Employer Job Openings & Allocation
 * Powered by DataTable with sorting, multi-criteria filtering, child rows, and placement linking.
 */

function JobsView({ state }) {
  const { jobs = [], candidates = [], settings = {}, currentUser } = state;
  const currency = settings.currency || 'BHD';
  const { useState, useMemo } = React;
  const SearchableSelect = window.SearchableSelect;

  // Session storage filter persistence
  const readSaved = (k, d = '') => {
    const v = sessionStorage.getItem('sands_jobs_filter_' + k);
    return v !== null ? v : d;
  };

  const [selectedEmployer, setSelectedEmployer] = useState(() => readSaved('employer'));
  const [selectedDepartment, setSelectedDepartment] = useState(() => readSaved('department'));
  const [selectedPosition, setSelectedPosition] = useState(() => readSaved('position'));
  const [statusFilter, setStatusFilter] = useState(() => readSaved('status', 'active'));

  const persist = (setter, key) => (val) => {
    setter(val);
    sessionStorage.setItem('sands_jobs_filter_' + key, val);
  };

  const handleEmployerChange = persist(setSelectedEmployer, 'employer');
  const handleDepartmentChange = persist(setSelectedDepartment, 'department');
  const handlePositionChange = persist(setSelectedPosition, 'position');
  const handleStatusChange = persist(setStatusFilter, 'status');
  const handleResetAll = () => {
    handleEmployerChange('');
    handleDepartmentChange('');
    handlePositionChange('');
    handleStatusChange('active');
  };

  const activeFiltersCount = (selectedEmployer ? 1 : 0) + (selectedDepartment ? 1 : 0) + (selectedPosition ? 1 : 0) + (statusFilter !== 'active' ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  // Employer Filter Options
  const employerOptions = useMemo(() => {
    const map = new Map();
    (jobs || []).forEach(j => {
      const comp = (j.company_name || '').trim();
      if (comp && !map.has(comp.toLowerCase())) {
        map.set(comp.toLowerCase(), {
          value: comp,
          label: comp,
          subLabel: j.employer_cr ? `CR: ${j.employer_cr}` : 'Employer Enterprise',
          searchKeywords: `${comp} ${j.employer_cr || ''}`
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Employers (${list.length})`, subLabel: 'Filter by employer' }, ...list];
  }, [jobs]);

  // Department Filter Options
  const departmentOptions = useMemo(() => {
    const set = new Set();
    (jobs || []).forEach(j => {
      const dep = (j.department || '').trim();
      if (dep) set.add(dep);
    });
    const list = Array.from(set).sort().map(d => ({ value: d, label: d, subLabel: 'Department / Division' }));
    return [{ value: '', label: `All Departments (${list.length})`, subLabel: 'Filter by department' }, ...list];
  }, [jobs]);

  // Position / Job Title Filter Options
  const positionOptions = useMemo(() => {
    const map = new Map();
    (jobs || []).forEach(j => {
      const pos = (j.job_title || '').trim();
      if (pos && !map.has(pos.toLowerCase())) {
        map.set(pos.toLowerCase(), {
          value: pos,
          label: pos,
          subLabel: j.job_code ? `Code: ${j.job_code}` : 'Job Position',
          searchKeywords: `${pos} ${j.job_code || ''} ${j.department || ''}`
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Positions (${list.length})`, subLabel: 'Filter by job position' }, ...list];
  }, [jobs]);

  // Compute live counts for status tabs
  const statusCounts = useMemo(() => {
    let openCount = 0;
    let filledCount = 0;
    let closedCount = 0;
    const allCount = (jobs || []).length;

    (jobs || []).forEach(j => {
      const total = parseInt(j.vacancies_count, 10) || 1;
      const placed = parseInt(j.placed_count, 10) || 0;
      const remaining = (j.vacancies_remaining !== undefined && j.vacancies_remaining !== null)
        ? parseInt(j.vacancies_remaining, 10)
        : Math.max(0, total - placed);
      const compStatus = (j.computed_status || (remaining === 0 ? 'filled' : (j.status || 'active'))).toLowerCase();

      if (compStatus === 'closed' || (j.status || '').toLowerCase() === 'closed') {
        closedCount++;
      } else if (remaining <= 0 || compStatus === 'filled') {
        filledCount++;
      } else {
        openCount++;
      }
    });

    return {
      active: openCount,
      filled: filledCount,
      closed: closedCount,
      all: allCount
    };
  }, [jobs]);

  // Status Filter Options: Open Vacancies -> Filled -> Closed -> All
  const statusOptions = [
    { id: 'active', label: 'Open Vacancies', count: statusCounts.active },
    { id: 'filled', label: 'Filled', count: statusCounts.filled },
    { id: 'closed', label: 'Closed', count: statusCounts.closed },
    { id: 'all', label: 'All', count: statusCounts.all }
  ];

  // Filtered Jobs
  const displayData = useMemo(() => {
    return (jobs || []).filter(j => {
      if (selectedEmployer && strcasecmp(j.company_name, selectedEmployer) !== 0) return false;
      if (selectedDepartment && strcasecmp(j.department, selectedDepartment) !== 0) return false;
      if (selectedPosition && strcasecmp(j.job_title, selectedPosition) !== 0) return false;
      if (statusFilter !== 'all') {
        const total = parseInt(j.vacancies_count, 10) || 1;
        const placed = parseInt(j.placed_count, 10) || 0;
        const remaining = (j.vacancies_remaining !== undefined && j.vacancies_remaining !== null)
          ? parseInt(j.vacancies_remaining, 10)
          : Math.max(0, total - placed);
        const compStatus = (j.computed_status || (remaining === 0 ? 'filled' : (j.status || 'active'))).toLowerCase();

        if (statusFilter === 'active') {
          if (compStatus === 'closed' || (j.status || '').toLowerCase() === 'closed') return false;
          if (remaining <= 0 || compStatus === 'filled') return false;
        }
        if (statusFilter === 'filled') {
          if (compStatus === 'closed' || (j.status || '').toLowerCase() === 'closed') return false;
          if (remaining > 0 && compStatus !== 'filled') return false;
        }
        if (statusFilter === 'closed') {
          if (compStatus !== 'closed' && (j.status || '').toLowerCase() !== 'closed') return false;
        }
      }
      return true;
    });
  }, [jobs, selectedEmployer, selectedDepartment, selectedPosition, statusFilter]);

  function strcasecmp(a, b) {
    return String(a || '').toLowerCase().localeCompare(String(b || '').toLowerCase());
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalJobs = jobs.length;
    const totalVacancies = jobs.reduce((sum, j) => sum + (parseInt(j.vacancies_count) || 1), 0);
    const totalPlaced = jobs.reduce((sum, j) => sum + (parseInt(j.placed_count) || 0), 0);
    const totalOpen = jobs.reduce((sum, j) => sum + (parseInt(j.vacancies_remaining) || 0), 0);
    return { totalJobs, totalVacancies, totalPlaced, totalOpen };
  }, [jobs]);

  // Child Row renderer
  const renderJobChildRow = (job) => {
    const placed = job.placed_candidates || [];

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '0.9rem',
        padding: '0.35rem 0'
      }}>
        {/* Panel 1: Job Description & Qualifications */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem'
        }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>📝</span> Description & Scope of Work
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45, background: 'var(--bg-tertiary, #f8fafc)', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
            {job.description || 'No job description recorded for this position.'}
          </div>

          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🎓</span> Key Qualifications & Criteria
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-tertiary, #f8fafc)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
            {job.requirements || 'Standard high school or diploma qualification.'}
          </div>
        </div>

        {/* Panel 2: Placed Candidates List */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>👥</span> Placed Candidates ({placed.length} / {job.vacancies_count})
            </div>
          </div>

          {placed.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
              {placed.map((c, i) => (
                <div
                  key={c.id || i}
                  style={{
                    background: 'var(--bg-tertiary, #f8fafc)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{c.full_name}</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      CPR: <span style={{ fontFamily: 'var(--font-mono)' }}>{c.cpr_no}</span> &bull; {c.ref_no}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>Placed</span>
                    {c.joining_date && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Joined: {window.formatAppDate ? window.formatAppDate(c.joining_date) : c.joining_date}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>
              No candidates placed in this opening yet.
            </div>
          )}
        </div>

        {/* Panel 3: Placement Summary & Actions */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem'
        }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🏢</span> Employer & Subsidy Parameters
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.78rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Department:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{job.department || 'General'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Offered Wage:</span>
              <div style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                {currency} {Number(job.salary_offered_bhd || 500).toFixed(3)}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>CR Number:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {job.employer_cr || 'N/A'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Open Openings:</span>
              <div style={{ fontWeight: 700, color: job.vacancies_remaining > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                {job.vacancies_remaining} Position(s)
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ flex: 1, fontSize: '0.75rem' }}
              onClick={() => window.AppStore.openModal('EDIT_JOB', { job })}
            >
              ✏️ Edit Job Opening
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Columns
  const columns = [
    {
      key: 'job_code',
      label: 'Job Position & Code',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {row.job_title}
          </strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              className="badge badge-info"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '0.1rem 0.45rem', fontWeight: 700 }}
              title="Job Posting Code"
            >
              {val || `JOB-${row.id}`}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              &bull; {row.department || 'General'}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'company_name',
      label: 'Employer',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {val || '—'}
          </div>
          {row.employer_cr ? (
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
              <span style={{ opacity: 0.75 }}>CR:</span> <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{row.employer_cr}</span>
            </span>
          ) : null}
        </div>
      )
    },
    {
      key: 'salary_offered_bhd',
      label: 'Basic Salary Offered',
      sortable: true,
      render: (val) => (
        <strong style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
          {currency} {Number(val || 0).toFixed(3)}
        </strong>
      )
    },
    {
      key: 'vacancies_count',
      label: 'Vacancies & Capacity',
      sortable: true,
      render: (val, row) => {
        const total = parseInt(val) || 1;
        const placed = parseInt(row.placed_count) || 0;
        const remaining = parseInt(row.vacancies_remaining) || Math.max(0, total - placed);
        const isFilled = remaining === 0;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div>
              <span className={`badge ${isFilled ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
                {isFilled ? `✓ Filled (${placed}/${total})` : `⏳ ${remaining} Open (${placed}/${total})`}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Total Capacity: {total} Opening(s)
            </div>
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => {
        const compStatus = (row.computed_status || val || 'active').toLowerCase();
        let badgeCls = 'badge-success';
        let label = 'Active Open';
        if (compStatus === 'filled') {
          badgeCls = 'badge-primary';
          label = '✓ Filled';
        } else if (compStatus === 'closed') {
          badgeCls = 'badge-neutral';
          label = 'Closed';
        }

        return <span className={`badge ${badgeCls}`} style={{ fontSize: '0.74rem' }}>{label}</span>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
          onClick={() => window.AppStore.openModal('EDIT_JOB', { job: row })}
          title="Edit Job Details"
        >
          ✏️ Edit
        </button>
      )
    }
  ];

  const labelStyle = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' };
  const filterBox = (flex, min) => ({ display: 'flex', alignItems: 'center', gap: '0.45rem', flex, minWidth: min });

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Employer Jobs & Vacancies</h1>
          <p className="page-subtitle">
            Employer job openings, qualifications, basic wage subsidy gates, and candidate allocations
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => window.AppStore.openModal('NEW_JOB')}
          >
            ➕ Post New Job
          </button>
        </div>
      </div>

      {/* Filter Card */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          {/* Employer Filter */}
          <div style={filterBox('1 1 250px', '220px')}>
            <label style={labelStyle}><span>🏢</span> Employer:</label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={employerOptions}
                  value={selectedEmployer}
                  onChange={handleEmployerChange}
                  placeholder={employerOptions[0]?.label || 'All Employers'}
                  searchPlaceholder="Search company or CR..."
                />
              ) : (
                <select className="select-control" value={selectedEmployer} onChange={e => handleEmployerChange(e.target.value)}>
                  {employerOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Department Filter */}
          <div style={filterBox('1 1 220px', '190px')}>
            <label style={labelStyle}><span>🏷️</span> Department:</label>
            <div style={{ flex: 1, minWidth: '130px' }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={departmentOptions}
                  value={selectedDepartment}
                  onChange={handleDepartmentChange}
                  placeholder="All Departments"
                  searchPlaceholder="Search department..."
                />
              ) : (
                <select className="select-control" value={selectedDepartment} onChange={e => handleDepartmentChange(e.target.value)}>
                  {departmentOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Position Filter */}
          <div style={filterBox('1 1 230px', '200px')}>
            <label style={labelStyle}><span>💼</span> Position:</label>
            <div style={{ flex: 1, minWidth: '140px' }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={positionOptions}
                  value={selectedPosition}
                  onChange={handlePositionChange}
                  placeholder="All Positions"
                  searchPlaceholder="Search job position..."
                />
              ) : (
                <select className="select-control" value={selectedPosition} onChange={e => handlePositionChange(e.target.value)}>
                  {positionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.2rem' }}>Status:</span>
            {statusOptions.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                onClick={() => handleStatusChange(tab.id)}
              >
                {tab.label} {tab.count !== undefined ? <span style={{ opacity: 0.85, fontSize: '0.72rem', fontWeight: 700 }}>({tab.count})</span> : ''}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.76rem', color: 'var(--danger)', borderColor: 'var(--danger)', padding: '0.25rem 0.65rem' }}
              onClick={handleResetAll}
              title="Reset all active filters"
            >
              ✕ Clear All Filters ({activeFiltersCount})
            </button>
          </div>
        )}
      </div>

      {/* Datatable */}
      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          expandable={true}
          renderChildRow={renderJobChildRow}
          searchPlaceholder="🔍 Search Job Title, Code, Employer, CR, Department, Requirements..."
          searchKeys={[
            'job_title',
            'job_code',
            'company_name',
            'employer_cr',
            'department',
            'status',
            'requirements',
            'description'
          ]}
          exportFilename="Employer_Jobs_Vacancies_SaNDS.csv"
          emptyMessage="No job openings found matching your criteria."
        />
      </div>
    </div>
  );
}

window.JobsView = JobsView;

