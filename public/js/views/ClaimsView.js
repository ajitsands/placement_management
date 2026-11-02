/**
 * Claims View - Manual Claim Amount Entry & Transaction Ledger
 * Powered by DataTable with sorting, multi-criteria filtering, search, pagination, and CSV export.
 * Supports filtering by Candidate, Employer, Milestone/Gate, Claimed Date Range (From & To), and Status.
 */

const { useState, useMemo, useEffect, useRef } = React;

/**
 * SearchableSelect Component
 * Accessible, keyboard-navigable searchable combobox dropdown.
 */
function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Type to search...',
  icon = null,
  style = {},
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase().trim();
    return options.filter(opt => {
      const matchLabel = opt.label && String(opt.label).toLowerCase().includes(q);
      const matchSub = opt.subLabel && String(opt.subLabel).toLowerCase().includes(q);
      const matchKeywords = opt.searchKeywords && String(opt.searchKeywords).toLowerCase().includes(q);
      return matchLabel || matchSub || matchKeywords;
    });
  }, [options, searchTerm]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => String(opt.value) === String(value)) || null;
  }, [options, value]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Reset highlight and focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setHighlightedIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 30);
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  const handleSelect = (optVal) => {
    onChange(optVal);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  const scrollOptionIntoView = (index) => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
        scrollOptionIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
        scrollOptionIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        ...style
      }}
    >
      {/* Trigger Box */}
      <div
        className="input-control"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0.35rem 0.65rem',
          fontSize: '0.82rem',
          userSelect: 'none',
          minHeight: '34px',
          borderColor: isOpen ? 'var(--primary)' : 'var(--border-light)',
          boxShadow: isOpen ? '0 0 0 3px var(--primary-glow)' : 'none',
          background: 'var(--bg-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {icon && <span style={{ fontSize: '0.9rem' }}>{icon}</span>}
          <span style={{
            color: selectedOption && selectedOption.value !== '' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: selectedOption && selectedOption.value !== '' ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.45rem' }}>
          {value !== '' && (
            <span
              onClick={handleClear}
              title="Clear selection"
              style={{
                color: 'var(--danger)',
                fontSize: '0.85rem',
                padding: '0 0.2rem',
                cursor: 'pointer',
                fontWeight: 700,
                lineHeight: 1
              }}
            >
              ✕
            </span>
          )}
          <span style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0,0,0,0.25))',
            zIndex: 1000,
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Search Box */}
          <div style={{ padding: '0.45rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-tertiary)' }}>
            <input
              ref={searchInputRef}
              type="text"
              className="input-control"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem', width: '100%' }}
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Options List */}
          <div ref={listRef} style={{ overflowY: 'auto', maxHeight: '200px', padding: '0.25rem' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '0.65rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                No matching results found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={String(opt.value) + '_' + idx}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected
                        ? 'var(--primary-subtle, rgba(37, 99, 235, 0.12))'
                        : (isHighlighted ? 'var(--bg-tertiary)' : 'transparent'),
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'background 0.1s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                      {opt.subLabel && (
                        <span style={{
                          fontSize: '0.72rem',
                          color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                          fontWeight: 400
                        }}>
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, marginLeft: '0.5rem' }}>✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimsView({ state }) {
  const { claims = [], candidates = [], disputes = [], currentUser = {}, settings = {} } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const currency = settings.currency || 'BHD';

  // 1. Status Filter - Default to 'unsettled'
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = sessionStorage.getItem('sands_claims_filter_status');
    const valid = ['unsettled', 'settled', 'disputed', ''];
    if (saved !== null && valid.includes(saved)) {
      return saved;
    }
    return 'unsettled';
  });

  // 2. Candidate Filter
  const [selectedCandidate, setSelectedCandidate] = useState(() => {
    return sessionStorage.getItem('sands_claims_filter_candidate') || '';
  });

  // 3. Employer Filter
  const [selectedEmployer, setSelectedEmployer] = useState(() => {
    return sessionStorage.getItem('sands_claims_filter_employer') || '';
  });

  // 4. Milestone / Claim Type Filter
  const [selectedMilestone, setSelectedMilestone] = useState(() => {
    return sessionStorage.getItem('sands_claims_filter_milestone') || '';
  });

  // 5. Claimed Date Range (From & To)
  const [claimDateFrom, setClaimDateFrom] = useState(() => {
    return sessionStorage.getItem('sands_claims_filter_date_from') || '';
  });
  const [claimDateTo, setClaimDateTo] = useState(() => {
    return sessionStorage.getItem('sands_claims_filter_date_to') || '';
  });

  // Filter change handlers
  const handleStatusFilterChange = (id) => {
    setStatusFilter(id);
    sessionStorage.setItem('sands_claims_filter_status', id);
  };

  const handleCandidateChange = (candId) => {
    setSelectedCandidate(candId);
    sessionStorage.setItem('sands_claims_filter_candidate', candId);
  };

  const handleEmployerChange = (empName) => {
    setSelectedEmployer(empName);
    sessionStorage.setItem('sands_claims_filter_employer', empName);
  };

  const handleMilestoneChange = (msType) => {
    setSelectedMilestone(msType);
    sessionStorage.setItem('sands_claims_filter_milestone', msType);
  };

  const handleDateFromChange = (date) => {
    setClaimDateFrom(date);
    sessionStorage.setItem('sands_claims_filter_date_from', date);
  };

  const handleDateToChange = (date) => {
    setClaimDateTo(date);
    sessionStorage.setItem('sands_claims_filter_date_to', date);
  };

  const handleClearDates = () => {
    setClaimDateFrom('');
    setClaimDateTo('');
    sessionStorage.removeItem('sands_claims_filter_date_from');
    sessionStorage.removeItem('sands_claims_filter_date_to');
  };

  const handleResetAllFilters = () => {
    setSelectedCandidate('');
    setSelectedEmployer('');
    setSelectedMilestone('');
    setClaimDateFrom('');
    setClaimDateTo('');
    setStatusFilter('unsettled');
    sessionStorage.removeItem('sands_claims_filter_candidate');
    sessionStorage.removeItem('sands_claims_filter_employer');
    sessionStorage.removeItem('sands_claims_filter_milestone');
    sessionStorage.removeItem('sands_claims_filter_date_from');
    sessionStorage.removeItem('sands_claims_filter_date_to');
    sessionStorage.setItem('sands_claims_filter_status', 'unsettled');
  };

  // Candidate lookup map for rapid reference resolution
  const candidateMap = useMemo(() => {
    const map = new Map();
    (candidates || []).forEach(c => {
      if (c && c.id) {
        map.set(String(c.id), c);
      }
    });
    return map;
  }, [candidates]);

  // Compute Unique Candidates Options
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

    (claims || []).forEach(cl => {
      if (cl.candidate_id && !map.has(String(cl.candidate_id))) {
        map.set(String(cl.candidate_id), {
          value: String(cl.candidate_id),
          label: cl.candidate_name || `Candidate #${cl.candidate_id}`,
          subLabel: `CPR: ${cl.candidate_cpr || 'N/A'} • ${cl.company_name || 'Employer'}`,
          searchKeywords: `${cl.candidate_name} ${cl.candidate_cpr} ${cl.candidate_ref} ${cl.company_name}`
        });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [
      { value: '', label: `All Candidates (${list.length})`, subLabel: 'Show claims across all candidates' },
      ...list
    ];
  }, [candidates, claims]);

  // Compute Unique Employers Options
  const employerOptions = useMemo(() => {
    const set = new Map();
    (claims || []).forEach(cl => {
      const comp = (cl.company_name || '').trim();
      if (comp && comp !== 'N/A') {
        const key = comp.toLowerCase();
        if (!set.has(key)) {
          set.set(key, {
            value: comp,
            label: comp,
            subLabel: 'Corporate Enterprise',
            searchKeywords: comp
          });
        }
      }
    });

    (candidates || []).forEach(c => {
      const comp = (c.company_name || '').trim();
      if (comp && comp !== 'N/A') {
        const key = comp.toLowerCase();
        const cr = (c.employer_cr || '').trim();
        if (!set.has(key)) {
          set.set(key, {
            value: comp,
            label: comp,
            subLabel: cr ? `CR: ${cr}` : 'Corporate Enterprise',
            searchKeywords: `${comp} ${cr}`
          });
        }
      }
    });

    const list = Array.from(set.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [
      { value: '', label: `All Employers (${list.length})`, subLabel: 'Show claims across all corporate employers' },
      ...list
    ];
  }, [claims, candidates]);

  // Compute Unique Milestone / Claim Types
  const milestoneOptions = useMemo(() => {
    const list = [
      { value: '', label: 'All Milestone Gates', subLabel: 'Show all claim types & retention checkpoints' },
      { value: 'placement', label: 'Day 0 - Placement Joining', subLabel: 'Initial contract signing & placement subsidy' },
      { value: '180_days', label: 'Day 180 - 6 Months Retention', subLabel: 'Probation completion & 6-month retention gate' },
      { value: '365_days', label: 'Day 365 - 1 Year Retention', subLabel: 'Annual completion & 12-month retention gate' }
    ];

    const standardKeys = ['placement', '180_days', '365_days'];
    const customTypes = new Set();
    (claims || []).forEach(cl => {
      const t = (cl.claim_type || '').toLowerCase();
      if (t && !standardKeys.includes(t)) {
        customTypes.add(cl.claim_type);
      }
    });

    customTypes.forEach(ct => {
      list.push({
        value: ct,
        label: ct.replace(/_/g, ' ').toUpperCase(),
        subLabel: 'Custom claim classification'
      });
    });

    return list;
  }, [claims]);

  // Active filters calculation (active when criteria differs from default 'unsettled' view)
  const hasActiveFilters = Boolean(
    selectedCandidate ||
    selectedEmployer ||
    selectedMilestone ||
    claimDateFrom ||
    claimDateTo ||
    (statusFilter && statusFilter !== 'unsettled')
  );

  const activeFiltersCount = (selectedCandidate ? 1 : 0) +
    (selectedEmployer ? 1 : 0) +
    (selectedMilestone ? 1 : 0) +
    ((claimDateFrom || claimDateTo) ? 1 : 0) +
    ((statusFilter && statusFilter !== 'unsettled') ? 1 : 0);

  // Multi-Criteria Display Data Filtering
  const displayData = useMemo(() => {
    return (claims || []).filter(c => {
      // 1. Status Filter: Unsettled, Settled, Disputed, All
      if (statusFilter) {
        if (statusFilter === 'unsettled') {
          if (c.status === 'settled' || c.status === 'disputed' || c.status === 'terminated') {
            return false;
          }
        } else if (statusFilter === 'settled') {
          if (c.status !== 'settled') {
            return false;
          }
        } else if (statusFilter === 'disputed') {
          if (c.status !== 'disputed') {
            return false;
          }
        } else if (c.status !== statusFilter) {
          return false;
        }
      }

      // 2. Candidate Filter
      if (selectedCandidate) {
        if (String(c.candidate_id) !== String(selectedCandidate)) {
          return false;
        }
      }

      // 3. Employer Filter
      if (selectedEmployer) {
        const emp = (c.company_name || '').trim().toLowerCase();
        if (emp !== selectedEmployer.trim().toLowerCase()) {
          return false;
        }
      }

      // 4. Milestone / Claim Type Filter
      if (selectedMilestone) {
        const cType = (c.claim_type || '').toLowerCase();
        const mTitle = (c.milestone_title || '').toLowerCase();
        const sel = selectedMilestone.toLowerCase();

        if (sel === 'placement' || sel === 'day_0' || sel === '0') {
          const isPlacement = cType.includes('placement') || mTitle.includes('placement') || mTitle.includes('day 0') || mTitle.includes('joining');
          if (!isPlacement) return false;
        } else if (sel === '180_days' || sel === '180' || sel === 'day_180') {
          const is180 = cType.includes('180') || mTitle.includes('180') || mTitle.includes('6 month') || cType.includes('probation');
          if (!is180) return false;
        } else if (sel === '365_days' || sel === '365' || sel === 'day_365') {
          const is365 = cType.includes('365') || mTitle.includes('365') || mTitle.includes('year') || mTitle.includes('12 month') || mTitle.includes('annual');
          if (!is365) return false;
        } else {
          if (cType !== sel && mTitle !== sel) return false;
        }
      }

      // 5. Claimed Date Range (From & To)
      if (claimDateFrom || claimDateTo) {
        const rawDate = c.submission_date || c.claim_date || c.created_at || '';
        const cDate = String(rawDate).split('T')[0].split(' ')[0];
        if (!cDate || cDate === '0000-00-00') return false;
        if (claimDateFrom && cDate < claimDateFrom) return false;
        if (claimDateTo && cDate > claimDateTo) return false;
      }

      return true;
    }).map(c => {
      const cand = candidateMap.get(String(c.candidate_id));
      const candRef = (c.candidate_ref && c.candidate_ref !== 'N/A') ? c.candidate_ref : (cand?.ref_no || (c.candidate_id ? `CR-${c.candidate_id}` : 'N/A'));
      const empCr = (c.employer_cr && c.employer_cr !== 'N/A') ? c.employer_cr : (cand?.employer_cr || '');
      return {
        ...c,
        candidate_ref: candRef,
        candidate_name: c.candidate_name || cand?.full_name || 'N/A',
        candidate_cpr: c.candidate_cpr || cand?.cpr_no || 'N/A',
        company_name: c.company_name || cand?.company_name || 'N/A',
        employer_cr: empCr
      };
    });
  }, [claims, statusFilter, selectedCandidate, selectedEmployer, selectedMilestone, claimDateFrom, claimDateTo, candidateMap]);

  // Financial summary for filtered claims
  const filteredMetrics = useMemo(() => {
    let claimed = 0;
    let paid = 0;
    let balance = 0;

    displayData.forEach(c => {
      claimed += parseFloat(c.claim_amount_bhd || 0);
      paid += parseFloat(c.total_paid_bhd || c.amount_collected_bhd || 0);
      balance += parseFloat(c.balance_bhd !== undefined ? c.balance_bhd : Math.max(0, (c.claim_amount_bhd || 0) - (c.total_paid_bhd || 0)));
    });

    return {
      count: displayData.length,
      claimed,
      paid,
      balance
    };
  }, [displayData]);

  const handleApprove = async (claimId) => {
    const swal = window.Swal || window.swal;
    if (swal) {
      const res = await swal.fire({
        title: 'Approve Claim?',
        text: 'Approve this claim for disbursement and treasury processing?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Approve Claim',
        cancelButtonText: 'Cancel',
        reverseButtons: true
      });
      if (!res.isConfirmed) return;
    } else if (!confirm('Approve this claim for disbursement and treasury processing?')) {
      return;
    }

    try {
      await window.api.claims.approve(claimId, 'Approved by Directorate Admin');
      if (window.Swal) {
        window.Swal.fire({
          title: 'Claim Approved!',
          text: 'The claim has been approved for treasury disbursement.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        window.AppStore.showNotification('Claim approved successfully', 'success');
      }
      await window.AppStore.refreshData();
    } catch (err) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Approval Error',
          text: err.message,
          icon: 'error'
        });
      } else {
        window.AppStore.showNotification('Failed to approve claim: ' + err.message, 'error');
      }
    }
  };

  const columns = [
    {
      key: 'candidate_ref',
      label: 'Candidate Ref',
      sortable: true,
      render: (val, row) => {
        const cand = candidateMap.get(String(row.candidate_id));
        const candidateRef = (val && val !== 'N/A') ? val : (cand?.ref_no || (row.candidate_id ? `CR-${row.candidate_id}` : 'N/A'));
        const claimRef = row.claim_ref || (row.id ? `CLM-${row.id}` : 'N/A');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.22rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
              {candidateRef}
            </span>
            <span
              className="badge badge-primary"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                padding: '0.12rem 0.48rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                textTransform: 'none'
              }}
              title={`Claim Ref: ${claimRef}`}
            >
              {claimRef}
            </span>
          </div>
        );
      }
    },
    {
      key: 'candidate_name',
      label: 'Candidate / CPR / Employer',
      sortable: true,
      render: (val, row) => {
        const cand = candidateMap.get(String(row.candidate_id));
        const employerName = row.company_name || cand?.company_name || 'N/A';
        const employerCr = (row.employer_cr && row.employer_cr !== 'N/A') ? row.employer_cr : (cand?.employer_cr || '');

        return (
          <div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
              {val}
            </strong>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
              <span>CPR: {row.candidate_cpr || cand?.cpr_no || 'N/A'}</span>
              <span style={{ margin: '0 5px', color: 'var(--border-light)' }}>•</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {employerName}
              </span>
              {employerCr ? (
                <span
                  style={{
                    marginLeft: '5px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '3px',
                    padding: '0.05rem 0.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  title="Employer Commercial Registration (CR) Number"
                >
                  <span style={{ opacity: 0.75 }}>CR:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{employerCr}</span>
                </span>
              ) : null}
            </div>
          </div>
        );
      }
    },
    {
      key: 'milestone_title',
      label: 'Claim Type / Gate',
      sortable: true,
      render: (val, row) => (
        <span className="badge badge-info">{val || row.claim_type}</span>
      )
    },
    {
      key: 'claim_amount_bhd',
      label: 'Claim Amount',
      sortable: true,
      render: (val) => (
        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
          {currency} {Number(val || 0).toFixed(3)}
        </span>
      )
    },
    {
      key: 'total_paid_bhd',
      label: 'Total Paid',
      sortable: true,
      render: (val, row) => {
        const paidAmount = Number(val || 0);
        return (
          <div
            onClick={() => window.AppStore.openModal('CLAIM_PAYMENTS', { claim: row })}
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Click to view payment breakdown & receipts"
          >
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>
              {currency} {paidAmount.toFixed(3)}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.8 }}>🔍</span>
          </div>
        );
      }
    },
    {
      key: 'balance_bhd',
      label: 'Balance',
      sortable: true,
      render: (val) => (
        <span style={{ color: (val > 0) ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700 }}>
          {currency} {Number(val || 0).toFixed(3)}
        </span>
      )
    },
    {
      key: 'submission_date',
      label: 'Claim Date',
      sortable: true,
      render: (val, row) => window.formatAppDate(val || row.claim_date || row.created_at)
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => <span className="badge badge-neutral">{val || 'Unassigned'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => {
        const isSettled = val === 'settled';
        const isDisputed = val === 'disputed';
        const isTerminated = val === 'terminated';
        const displayLabel = isDisputed ? '⚠️ Disputed' : (isSettled ? 'Settled' : (isTerminated ? 'Terminated' : 'Unsettled'));
        const disputeRef = isDisputed
          ? window.getDisputeRef(window.getDisputeForRow(disputes, { claim_id: row.id, milestone_id: row.milestone_id }))
          : null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
          <span
            className={`badge ${
              isSettled ? 'badge-success' : 
              (isDisputed ? 'badge-danger' : 
              (isTerminated ? 'badge-neutral' : 'badge-warning'))
            }`}
            style={isDisputed ? { cursor: 'pointer', fontWeight: 700 } : {}}
            onClick={isDisputed ? () => window.AppStore.openModal('DISPUTE_DETAILS', { claim: row, claim_id: row.id, candidate_id: row.candidate_id, from: 'claims' }) : undefined}
            title={isDisputed ? "Click to view dispute details" : undefined}
          >
            {displayLabel}
          </span>
          {disputeRef && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#dc2626',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid #fca5a5',
                borderRadius: '3px',
                padding: '0.05rem 0.4rem',
                cursor: 'pointer'
              }}
              onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { claim: row, claim_id: row.id, candidate_id: row.candidate_id, from: 'claims' })}
              title="Dispute reference number"
            >
              {disputeRef}
            </span>
          )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => {
        const isSettled = row.status === 'settled';
        const isDisputed = row.status === 'disputed';
        const isTerminated = row.status === 'terminated';
        const rowBalance = Number(
          row.balance_bhd !== undefined && row.balance_bhd !== null
            ? row.balance_bhd
            : Math.max(0, Number(row.claim_amount_bhd || 0) - Number(row.total_paid_bhd || 0))
        );
        const hasBalance = rowBalance > 0.0001;

        return (
          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isAdminOrSuper && row.status === 'submitted' && (
              <button
                className="btn btn-sm btn-primary"
                title="Approve Claim"
                onClick={() => handleApprove(row.id)}
              >
                ✓ Approve
              </button>
            )}

            {/* View Payment Receipts Modal Button */}
            <button
              className="btn btn-sm btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              title="View Payment Breakdown & Receipts"
              onClick={() => window.AppStore.openModal('CLAIM_PAYMENTS', { claim: row })}
            >
              <span>🧾</span>
              <span>Receipts</span>
            </button>

            {!isSettled && !isTerminated && hasBalance && (
              <button
                className="btn btn-sm btn-outline"
                title="Record Payment Receipt"
                onClick={() => window.AppStore.openModal('NEW_PAYMENT', { claim: row })}
              >
                💳 Pay
              </button>
            )}

            {isDisputed && (
              <button
                className="btn btn-sm btn-outline-danger"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="View Dispute Details"
                onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { claim: row, claim_id: row.id, candidate_id: row.candidate_id, from: 'claims' })}
              >
                <span>⚠️</span>
                <span>Dispute Details</span>
              </button>
            )}

            {!isDisputed && !isTerminated && (
              <button
                className="btn btn-sm btn-outline"
                title="File Dispute"
                onClick={() => window.AppStore.openModal('NEW_DISPUTE', { claim: row })}
              >
                ⚠️ Dispute
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const statusOptions = [
    { id: 'unsettled', label: 'Unsettled' },
    { id: 'settled', label: 'Settled' },
    { id: 'disputed', label: 'Disputed' },
    { id: '', label: 'All' }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Claims Management & Settlements</h1>
          <p className="page-subtitle">
            User-directed claim amounts with automated balance tracking against payments
          </p>
        </div>
      </div>

      {/* Comprehensive Filter Toolbar Card */}
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
        {/* Row 1: Candidate, Employer, Milestone, and Claimed Date Filters (Labels and Controls in one row) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          {/* Candidate Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: '1 1 230px', minWidth: '210px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>👤</span> Candidate:
            </label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <SearchableSelect
                options={candidateOptions}
                value={selectedCandidate}
                onChange={handleCandidateChange}
                placeholder={candidateOptions[0]?.label || 'All Candidates'}
                searchPlaceholder="Search candidate, CPR, ref..."
              />
            </div>
          </div>

          {/* Employer Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: '1 1 230px', minWidth: '210px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🏢</span> Employer:
            </label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <SearchableSelect
                options={employerOptions}
                value={selectedEmployer}
                onChange={handleEmployerChange}
                placeholder={employerOptions[0]?.label || 'All Employers'}
                searchPlaceholder="Search company or CR..."
              />
            </div>
          </div>

          {/* Milestone Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: '1 1 210px', minWidth: '190px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🎯</span> Milestone:
            </label>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <SearchableSelect
                options={milestoneOptions}
                value={selectedMilestone}
                onChange={handleMilestoneChange}
                placeholder="All Milestone Gates"
                searchPlaceholder="Search gate (Day 0, 180, 365)..."
              />
            </div>
          </div>

          {/* Claimed Date Range Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>📅</span> Claimed Date:
            </label>
            <input
              type="date"
              className="input-control"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
              value={claimDateFrom}
              onChange={e => handleDateFromChange(e.target.value)}
              title="Claimed Date From"
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="input-control"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
              value={claimDateTo}
              onChange={e => handleDateToChange(e.target.value)}
              title="Claimed Date To"
            />
            {(claimDateFrom || claimDateTo) && (
              <button
                type="button"
                onClick={handleClearDates}
                title="Clear Claimed Date filter"
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

        {/* Row 2: Status Filter Tabs + Reset All Filters Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--border-light)'
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.25rem' }}>Status:</span>
            {statusOptions.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                onClick={() => handleStatusFilterChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Reset All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.76rem', color: 'var(--danger)', borderColor: 'var(--danger)', padding: '0.25rem 0.65rem' }}
              onClick={handleResetAllFilters}
              title="Reset all active filters"
            >
              ✕ Clear All Filters ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Real-time Ledger Filter Summary Metrics Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Matching Claims</span>
            <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>{filteredMetrics.count}</strong>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total Claimed</span>
            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{currency} {filteredMetrics.claimed.toFixed(3)}</strong>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total Collected</span>
            <strong style={{ fontSize: '1rem', color: 'var(--success)' }}>{currency} {filteredMetrics.paid.toFixed(3)}</strong>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Outstanding Balance</span>
            <strong style={{ fontSize: '1rem', color: filteredMetrics.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {currency} {filteredMetrics.balance.toFixed(3)}
            </strong>
          </div>
        </div>
      </div>

      {/* Claims Ledger DataTable */}
      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          searchPlaceholder="🔍 Search Candidate Ref, Claim Ref, CPR, Employer, CR..."
          searchKeys={['candidate_ref', 'claim_ref', 'candidate_name', 'candidate_cpr', 'company_name', 'employer_cr', 'milestone_title', 'claim_type', 'case_manager_name']}
          exportFilename="Claims_Ledger_Filtered.csv"
          emptyMessage="No claims found matching your filter criteria."
        />
      </div>
    </div>
  );
}

window.ClaimsView = ClaimsView;
window.SearchableSelect = SearchableSelect;
