/**
 * Milestones View - Retention Milestones (+0d, +180d, +365d) Tracker
 * Powered by DataTable with sorting, search, pagination, CSV export,
 * and comprehensive SEARCHABLE filters: Candidate, Employer, Joining Date, Milestone Stage, and Lifecycle Status.
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

  // Ensure highlighted index stays in bounds
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

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '0.45rem',
            animation: 'fadeIn 0.12s ease-out',
            minWidth: '260px'
          }}
        >
          {/* Live Search Input Box */}
          <div style={{ position: 'relative', marginBottom: '0.45rem' }}>
            <span style={{
              position: 'absolute',
              left: '0.65rem',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}>
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="input-control"
              style={{
                padding: '0.35rem 1.6rem 0.35rem 1.85rem',
                fontSize: '0.8rem',
                width: '100%',
                background: 'var(--bg-tertiary)'
              }}
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {searchTerm && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                ✕
              </span>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{
                padding: '0.85rem 0.5rem',
                textAlign: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                No options match "<strong>{searchTerm}</strong>"
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={opt.value || idx}
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

window.SearchableSelect = SearchableSelect;

function MilestonesView({ state }) {
  const { milestones = [], claims = [], candidates = [], payments = [], disputes = [], currentUser, settings = {} } = state;
  const currency = settings.currency || 'BHD';

  // 1. Status Filter (Default: 'due_or_overdue' / Action Required)
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = sessionStorage.getItem('sands_claims_ms_status');
    return saved !== null && saved !== undefined ? saved : 'due_or_overdue';
  });

  // 2. Candidate Filter
  const [selectedCandidate, setSelectedCandidate] = useState(() => {
    return sessionStorage.getItem('sands_claims_ms_candidate') || '';
  });

  // 3. Employer Filter
  const [selectedEmployer, setSelectedEmployer] = useState(() => {
    return sessionStorage.getItem('sands_claims_ms_employer') || '';
  });

  // 4. Milestone Stage Filter
  const [selectedMilestone, setSelectedMilestone] = useState(() => {
    return sessionStorage.getItem('sands_claims_ms_type') || '';
  });

  // 5. Joining Date Range Filter
  const [joinDateFrom, setJoinDateFrom] = useState(() => {
    return sessionStorage.getItem('sands_claims_ms_join_from') || '';
  });
  const [joinDateTo, setJoinDateTo] = useState(() => {
    return sessionStorage.getItem('sands_claims_ms_join_to') || '';
  });

  // Candidate Lookup Map
  const candidateMap = useMemo(() => {
    const map = {};
    (candidates || []).forEach(c => {
      if (c && c.id) {
        map[c.id] = c;
      }
    });
    return map;
  }, [candidates]);

  // Unique Candidates list
  const candidateOptions = useMemo(() => {
    const map = new Map();
    (candidates || []).forEach(c => {
      if (c && c.id) {
        map.set(String(c.id), {
          id: String(c.id),
          name: c.full_name || `Candidate #${c.id}`,
          ref: c.ref_no || `CR-${c.id}`,
          cpr: c.cpr_no || '',
          joining_date: c.joining_date || null
        });
      }
    });
    (milestones || []).forEach(m => {
      if (m.candidate_id && !map.has(String(m.candidate_id))) {
        map.set(String(m.candidate_id), {
          id: String(m.candidate_id),
          name: m.candidate_name || `Candidate #${m.candidate_id}`,
          ref: m.candidate_ref || `CR-${m.candidate_id}`,
          cpr: m.candidate_cpr || '',
          joining_date: m.joining_date || null
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [candidates, milestones]);

  // Unique Employers list
  const employerOptions = useMemo(() => {
    const map = new Map();
    (candidates || []).forEach(c => {
      if (c && c.company_name && c.company_name.trim()) {
        const name = c.company_name.trim();
        const cr = (c.employer_cr || '').trim();
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name, cr });
        } else if (cr && !map.get(key).cr) {
          map.get(key).cr = cr;
        }
      }
    });

    (milestones || []).forEach(m => {
      if (m && m.company_name && m.company_name.trim()) {
        const name = m.company_name.trim();
        const cr = (m.employer_cr || '').trim();
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name, cr });
        } else if (cr && !map.get(key).cr) {
          map.get(key).cr = cr;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [candidates, milestones]);

  // Searchable Candidate Select Options
  const candidateSelectOptions = useMemo(() => {
    const list = [
      {
        value: '',
        label: `All Candidates (${candidateOptions.length})`,
        subLabel: 'Show milestones across all candidates',
        searchKeywords: 'all candidates everyone reset'
      }
    ];

    candidateOptions.forEach(c => {
      const parts = [];
      if (c.cpr) parts.push(`CPR: ${c.cpr}`);
      if (c.joining_date) parts.push(`Joined: ${window.formatAppDate(c.joining_date)}`);

      list.push({
        value: c.id,
        label: `${c.name} (${c.ref})`,
        subLabel: parts.join(' • '),
        searchKeywords: `${c.name} ${c.ref} ${c.cpr || ''}`
      });
    });

    return list;
  }, [candidateOptions]);

  // Searchable Employer Select Options
  const employerSelectOptions = useMemo(() => {
    const list = [
      {
        value: '',
        label: `All Employers (${employerOptions.length})`,
        subLabel: 'Show milestones across all employers',
        searchKeywords: 'all employers companies cr reset'
      }
    ];

    employerOptions.forEach(emp => {
      list.push({
        value: emp.name,
        label: emp.name,
        subLabel: emp.cr ? `CR: ${emp.cr}` : 'No CR specified',
        searchKeywords: `${emp.name} ${emp.cr || ''}`
      });
    });

    return list;
  }, [employerOptions]);

  // Searchable Milestone Select Options
  const milestoneSelectOptions = useMemo(() => {
    return [
      {
        value: '',
        label: 'All Milestone Gates',
        subLabel: 'Show Day 0, Day 180, and Day 365 gates',
        searchKeywords: 'all gates 0 180 365'
      },
      {
        value: 'placement',
        label: 'Day 0: Initial Placement Gate',
        subLabel: 'Immediate claim upon job placement',
        searchKeywords: 'day 0 placement initial job'
      },
      {
        value: '180_days',
        label: 'Day 180: 6-Month Retention Gate',
        subLabel: 'Retention milestone after 6 months of employment',
        searchKeywords: 'day 180 6m 6 month retention'
      },
      {
        value: '365_days',
        label: 'Day 365: 12-Month Retention Gate',
        subLabel: 'Retention milestone after 1 full year of employment',
        searchKeywords: 'day 365 12m 1 year retention annual'
      }
    ];
  }, []);

  // Filter Handlers
  const handleStatusFilterChange = (id) => {
    setStatusFilter(id);
    sessionStorage.setItem('sands_claims_ms_status', id);
  };

  const handleCandidateChange = (val) => {
    setSelectedCandidate(val);
    sessionStorage.setItem('sands_claims_ms_candidate', val);
  };

  const handleEmployerChange = (val) => {
    setSelectedEmployer(val);
    sessionStorage.setItem('sands_claims_ms_employer', val);
  };

  const handleMilestoneChange = (val) => {
    setSelectedMilestone(val);
    sessionStorage.setItem('sands_claims_ms_type', val);
  };

  const handleJoinDateFrom = (val) => {
    setJoinDateFrom(val);
    sessionStorage.setItem('sands_claims_ms_join_from', val);
  };

  const handleJoinDateTo = (val) => {
    setJoinDateTo(val);
    sessionStorage.setItem('sands_claims_ms_join_to', val);
  };

  const handleClearJoinDate = () => {
    setJoinDateFrom('');
    setJoinDateTo('');
    sessionStorage.removeItem('sands_claims_ms_join_from');
    sessionStorage.removeItem('sands_claims_ms_join_to');
  };

  const handleClearAllFilters = () => {
    setStatusFilter('due_or_overdue');
    setSelectedCandidate('');
    setSelectedEmployer('');
    setSelectedMilestone('');
    setJoinDateFrom('');
    setJoinDateTo('');
    sessionStorage.setItem('sands_claims_ms_status', 'due_or_overdue');
    sessionStorage.removeItem('sands_claims_ms_candidate');
    sessionStorage.removeItem('sands_claims_ms_employer');
    sessionStorage.removeItem('sands_claims_ms_type');
    sessionStorage.removeItem('sands_claims_ms_join_from');
    sessionStorage.removeItem('sands_claims_ms_join_to');
  };

  const hasActiveFilters = Boolean(
    statusFilter !== 'due_or_overdue' ||
    selectedCandidate ||
    selectedEmployer ||
    selectedMilestone ||
    joinDateFrom ||
    joinDateTo
  );

  // Filter & Format Data
  const displayData = useMemo(() => {
    const todayMidnight = new Date().setHours(0, 0, 0, 0);

    // Build claim lookup map
    const claimByMilestoneId = {};
    const claimByCandidateType = {};
    (claims || []).forEach(cl => {
      let cType = cl.claim_type;
      if (cType === 'initial_placement') cType = 'placement';
      if (cType === 'probation_completion' || cType === 'retention_6m') cType = '180_days';
      if (cType === 'year_completion' || cType === 'retention_12m') cType = '365_days';

      if (cl.milestone_id) {
        claimByMilestoneId[cl.milestone_id] = cl;
      }
      if (cl.candidate_id && cType) {
        claimByCandidateType[`${cl.candidate_id}_${cType}`] = cl;
      }
    });

    // Build payment lookup map by claim_id
    const paidByClaimId = {};
    (payments || []).forEach(p => {
      if (p.claim_id) {
        paidByClaimId[p.claim_id] = (paidByClaimId[p.claim_id] || 0) + parseFloat(p.amount_paid_bhd || 0);
      }
    });

    return (milestones || [])
      .map(m => {
        const target = m.target_date || m.due_date;
        let days = m.days_remaining;
        if ((days === undefined || days === null) && target) {
          const targetMidnight = new Date(target).setHours(0, 0, 0, 0);
          days = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
        }

        // Calculate dynamic status if not claimed/disputed
        let dynStatus = m.status;
        if (dynStatus !== 'claimed' && dynStatus !== 'disputed' && days !== null && days !== undefined) {
          if (days < -30) {
            dynStatus = 'overdue';
          } else if (days <= 0) {
            dynStatus = 'due';
          } else {
            dynStatus = 'upcoming';
          }
        }

        // Resolve linked submitted claim details
        const linkedClaim = (m.claim_id ? (claims || []).find(c => Number(c.id) === Number(m.claim_id)) : null)
          || claimByMilestoneId[m.id] 
          || claimByCandidateType[`${m.candidate_id}_${m.milestone_type}`] 
          || null;

        const claimAmount = (linkedClaim && linkedClaim.claim_amount_bhd !== undefined && linkedClaim.claim_amount_bhd !== null)
          ? parseFloat(linkedClaim.claim_amount_bhd)
          : ((m.claim_amount_bhd !== undefined && m.claim_amount_bhd !== null) ? parseFloat(m.claim_amount_bhd) : null);

        const claimId = m.claim_id || linkedClaim?.id || null;
        const claimRef = m.claim_ref || linkedClaim?.claim_ref || null;
        const claimStatus = m.claim_status || linkedClaim?.status || null;

        if (claimStatus === 'disputed' || m.status === 'disputed') {
          dynStatus = 'disputed';
        }

        // Resolve amount collected and balance
        let collected = 0;
        if (claimId && paidByClaimId[claimId] !== undefined) {
          collected = paidByClaimId[claimId];
        } else if (linkedClaim && linkedClaim.total_paid_bhd !== undefined && linkedClaim.total_paid_bhd !== null) {
          collected = parseFloat(linkedClaim.total_paid_bhd);
        } else if (m.amount_collected_bhd !== undefined && m.amount_collected_bhd !== null) {
          collected = parseFloat(m.amount_collected_bhd);
        } else if (m.total_paid_bhd !== undefined && m.total_paid_bhd !== null) {
          collected = parseFloat(m.total_paid_bhd);
        }

        const balance = (claimAmount !== null && !isNaN(claimAmount))
          ? Math.max(0, claimAmount - collected)
          : null;

        // Resolve candidate joining date, company name, employer CR
        const cand = candidateMap[m.candidate_id];
        const joiningDate = m.joining_date || cand?.joining_date || null;
        const employerCr = m.employer_cr || cand?.employer_cr || null;
        const companyName = m.company_name || cand?.company_name || null;

        return {
          ...m,
          status: dynStatus,
          company_name: companyName,
          employer_cr: employerCr,
          target_date: target,
          days_remaining: days,
          claim_id: claimId,
          claim_amount_bhd: claimAmount,
          amount_collected_bhd: collected,
          total_paid_bhd: collected,
          balance_bhd: balance,
          claim_ref: claimRef,
          claim_status: claimStatus,
          joining_date: joiningDate
        };
      })
      .filter(m => {
        // 1. Status Filter
        if (statusFilter) {
          if (statusFilter === 'due_or_overdue') {
            if (m.status !== 'due' && m.status !== 'overdue') return false;
          } else if (m.status !== statusFilter) {
            return false;
          }
        }

        // 2. Candidate Filter
        if (selectedCandidate) {
          if (String(m.candidate_id) !== String(selectedCandidate)) {
            return false;
          }
        }

        // 3. Employer Filter
        if (selectedEmployer) {
          if (!m.company_name || m.company_name.trim().toLowerCase() !== selectedEmployer.trim().toLowerCase()) {
            return false;
          }
        }

        // 4. Milestone Stage Filter
        if (selectedMilestone) {
          if (selectedMilestone === 'placement' || selectedMilestone === '0') {
            if (m.milestone_stage !== 0 && m.milestone_type !== 'placement') return false;
          } else if (selectedMilestone === '180_days' || selectedMilestone === '180') {
            if (m.milestone_stage !== 180 && m.milestone_type !== '180_days') return false;
          } else if (selectedMilestone === '365_days' || selectedMilestone === '365') {
            if (m.milestone_stage !== 365 && m.milestone_type !== '365_days') return false;
          }
        }

        // 5. Joining Date Range Filter
        if (joinDateFrom || joinDateTo) {
          if (!m.joining_date) return false;
          const jDate = String(m.joining_date).split('T')[0].split(' ')[0];
          if (joinDateFrom && jDate < joinDateFrom) return false;
          if (joinDateTo && jDate > joinDateTo) return false;
        }

        return true;
      });
  }, [milestones, claims, candidateMap, statusFilter, selectedCandidate, selectedEmployer, selectedMilestone, joinDateFrom, joinDateTo]);

  const handleEditClaim = (row) => {
    let linkedClaim = null;
    if (row.claim_id) {
      linkedClaim = (claims || []).find(c => Number(c.id) === Number(row.claim_id));
    }
    if (!linkedClaim && row.id) {
      const msClaims = (claims || []).filter(c => Number(c.milestone_id) === Number(row.id));
      if (msClaims.length > 0) linkedClaim = msClaims[msClaims.length - 1];
    }
    if (!linkedClaim && row.candidate_id) {
      const targetType = row.milestone_type;
      const matched = (claims || []).filter(c => {
        if (Number(c.candidate_id) !== Number(row.candidate_id)) return false;
        let cType = c.claim_type;
        if (cType === 'initial_placement') cType = 'placement';
        if (cType === 'probation_completion' || cType === 'retention_6m') cType = '180_days';
        if (cType === 'year_completion' || cType === 'retention_12m') cType = '365_days';
        return cType === targetType;
      });
      if (matched.length > 0) linkedClaim = matched[matched.length - 1];
    }

    window.AppStore.openModal('EDIT_CLAIM_AMOUNT', {
      milestone: row,
      claim: linkedClaim
    });
  };

  const handleDisputeClaim = (row) => {
    let linkedClaim = null;
    if (row.claim_id) {
      linkedClaim = (claims || []).find(c => Number(c.id) === Number(row.claim_id));
    }
    if (!linkedClaim && row.id) {
      const msClaims = (claims || []).filter(c => Number(c.milestone_id) === Number(row.id));
      if (msClaims.length > 0) linkedClaim = msClaims[msClaims.length - 1];
    }
    if (!linkedClaim && row.candidate_id) {
      const targetType = row.milestone_type;
      const matched = (claims || []).filter(c => {
        if (Number(c.candidate_id) !== Number(row.candidate_id)) return false;
        let cType = c.claim_type;
        if (cType === 'initial_placement') cType = 'placement';
        if (cType === 'probation_completion' || cType === 'retention_6m') cType = '180_days';
        if (cType === 'year_completion' || cType === 'retention_12m') cType = '365_days';
        return cType === targetType;
      });
      if (matched.length > 0) linkedClaim = matched[matched.length - 1];
    }

    window.AppStore.openModal('NEW_DISPUTE', {
      milestone: row,
      claim: linkedClaim,
      claim_id: linkedClaim?.id || row.claim_id,
      candidate_id: row.candidate_id,
      candidate: candidateMap[row.candidate_id]
    });
  };

  const handleViewDispute = (row) => {
    let linkedClaim = null;
    if (row.claim_id) {
      linkedClaim = (claims || []).find(c => Number(c.id) === Number(row.claim_id));
    }
    if (!linkedClaim && row.id) {
      const msClaims = (claims || []).filter(c => Number(c.milestone_id) === Number(row.id));
      if (msClaims.length > 0) linkedClaim = msClaims[msClaims.length - 1];
    }
    if (!linkedClaim && row.candidate_id) {
      const targetType = row.milestone_type;
      const matched = (claims || []).filter(c => {
        if (Number(c.candidate_id) !== Number(row.candidate_id)) return false;
        let cType = c.claim_type;
        if (cType === 'initial_placement') cType = 'placement';
        if (cType === 'probation_completion' || cType === 'retention_6m') cType = '180_days';
        if (cType === 'year_completion' || cType === 'retention_12m') cType = '365_days';
        return cType === targetType;
      });
      if (matched.length > 0) linkedClaim = matched[matched.length - 1];
    }

    const linkedDispute = (disputes || []).find(d => 
      (linkedClaim?.id && Number(d.claim_id) === Number(linkedClaim.id)) ||
      (row.claim_id && Number(d.claim_id) === Number(row.claim_id)) ||
      (row.id && d.milestone_id && Number(d.milestone_id) === Number(row.id)) ||
      (row.candidate_id && d.candidate_id && Number(d.candidate_id) === Number(row.candidate_id))
    );

    window.AppStore.openModal('DISPUTE_DETAILS', {
      dispute: linkedDispute,
      milestone: row,
      claim: linkedClaim,
      claim_id: linkedClaim?.id || row.claim_id,
      candidate_id: row.candidate_id,
      candidate: candidateMap[row.candidate_id]
    });
  };

  const columns = [
    {
      key: 'candidate_ref',
      label: 'Candidate Ref',
      sortable: true,
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
          {val}
        </span>
      )
    },
    {
      key: 'candidate_name',
      label: 'Candidate Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{val}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CPR: {row.candidate_cpr || '—'}</div>
          {row.joining_date && (
            <div
              style={{
                fontSize: '0.73rem',
                color: 'var(--primary)',
                marginTop: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Candidate Official Joining Date"
            >
              <span>📅</span> Joined: <strong>{window.formatAppDate(row.joining_date)}</strong>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'company_name',
      label: 'Employer',
      sortable: true,
      render: (val, row) => {
        if (!val && !row.employer_cr) {
          return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        }
        return (
          <div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
              {val || '—'}
            </strong>
            {row.employer_cr ? (
              <div
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Employer Commercial Registration (CR) Number"
              >
                <span style={{ opacity: 0.7 }}>CR:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{row.employer_cr}</span>
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '1px' }}>
                No CR registered
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'milestone_title',
      label: 'Milestone Stage',
      sortable: true,
      render: (val) => (
        <span className="badge badge-info" style={{ fontWeight: 800 }}>
          {val}
        </span>
      )
    },
    {
      key: 'target_date',
      label: 'Target Date',
      sortable: true,
      render: (val, row) => {
        const d = val || row.due_date;
        return (
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {window.formatAppDate(d)}
          </span>
        );
      }
    },
    {
      key: 'days_remaining',
      label: 'Days Remaining',
      sortable: true,
      render: (val, row) => {
        if (row.status === 'claimed') {
          return (
            <span className="badge badge-success" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ✓ Claimed
            </span>
          );
        }

        let days = val;
        if (days === undefined || days === null) {
          const target = row.target_date || row.due_date;
          if (target) {
            const diff = new Date(target).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
            days = Math.round(diff / (1000 * 60 * 60 * 24));
          }
        }

        if (days === undefined || days === null) {
          return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        }

        if (days < 0) {
          return (
            <span
              className="badge badge-danger"
              style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title={`Milestone is ${Math.abs(days)} days overdue past target date`}
            >
              <span>⚠️</span> {Math.abs(days)}d Overdue
            </span>
          );
        }

        if (days === 0) {
          return (
            <span
              className="badge badge-warning"
              style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Target milestone is due today"
            >
              <span>⏱️</span> Due Today
            </span>
          );
        }

        return (
          <span
            style={{
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: days <= 14 ? 'var(--warning)' : 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>⏳</span> {days} {days === 1 ? 'day' : 'days'}
          </span>
        );
      }
    },
    {
      key: 'claim_amount_bhd',
      label: 'Submitted Amount',
      sortable: true,
      render: (val, row) => {
        if (val !== null && val !== undefined && !isNaN(val)) {
          const collected = Number(row.amount_collected_bhd || row.total_paid_bhd || 0);
          const balance = (row.balance_bhd !== null && row.balance_bhd !== undefined)
            ? Number(row.balance_bhd)
            : Math.max(0, Number(val) - collected);
          const isClaimed = row.status === 'claimed';

          return (
            <div
              style={{ cursor: isClaimed ? 'pointer' : 'default', display: 'inline-block' }}
              onClick={() => { if (isClaimed) handleEditClaim(row); }}
              title={isClaimed ? 'Click to edit claim amount' : ''}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  color: 'var(--success)',
                  fontSize: '0.9rem'
                }}>
                  {currency} {Number(val).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </span>
                {isClaimed && (
                  <span style={{ fontSize: '0.72rem', opacity: 0.6, color: 'var(--primary)' }} title="Edit Amount">✏️</span>
                )}
              </div>

              {row.claim_ref && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {row.claim_ref}
                </div>
              )}

              {/* Amount Collected and Balance in small span for Claimed status */}
              {isClaimed && (
                <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.71rem',
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1px 5px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap'
                    }}
                    title={`Total subsidy collected to date: ${currency} ${collected.toFixed(3)}`}
                  >
                    Collected: <strong style={{ color: 'var(--success)', fontWeight: 700 }}>{currency} {collected.toFixed(3)}</strong>
                  </span>
                  <span
                    style={{
                      fontSize: '0.71rem',
                      fontFamily: 'var(--font-mono)',
                      background: balance <= 0.001 ? 'var(--success-bg)' : 'var(--warning-bg)',
                      border: `1px solid ${balance <= 0.001 ? 'var(--success-border)' : 'var(--warning-border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '1px 5px',
                      color: balance <= 0.001 ? 'var(--success)' : 'var(--warning)',
                      whiteSpace: 'nowrap'
                    }}
                    title={`Remaining balance to be disbursed: ${currency} ${balance.toFixed(3)}`}
                  >
                    Bal: <strong style={{ fontWeight: 700 }}>{currency} {balance.toFixed(3)}</strong>
                  </span>
                </div>
              )}
            </div>
          );
        }

        return (
          <span style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ opacity: 0.5 }}>—</span> No amount specified
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => {
        const isClaimed = val === 'claimed';
        const isDisputed = val === 'disputed';
        const isOverdue = val === 'overdue';
        const isDue = val === 'due';
        return (
          <span
            className={`badge ${
              isClaimed ? 'badge-success' : 
              (isDisputed ? 'badge-danger' : 
              (isOverdue ? 'badge-danger' : 
              (isDue ? 'badge-warning' : 'badge-neutral')))
            }`}
            style={isDisputed ? {
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              fontWeight: 800,
              cursor: 'pointer'
            } : {}}
            onClick={isDisputed ? () => handleViewDispute(row) : undefined}
            title={isDisputed ? "Click to view dispute details" : undefined}
          >
            {isDisputed ? '⚠️ Disputed' : val}
          </span>
        );
      }
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => <span className="badge badge-neutral">{val}</span>
    },
    {
      key: 'actions',
      label: 'Action',
      sortable: false,
      render: (_, row) => {
        const isClaimed = row.status === 'claimed';
        const isDisputed = row.status === 'disputed';

        if (isDisputed) {
          return (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              style={{
                padding: '0.25rem 0.65rem',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 600,
                color: 'var(--danger, #dc2626)',
                borderColor: 'var(--danger-border, #fca5a5)',
                background: 'rgba(239, 68, 68, 0.06)'
              }}
              onClick={() => handleViewDispute(row)}
              title="View dispute details, investigation grounds, and claim remarks"
            >
              <span>⚠️</span>
              <span>Dispute Details</span>
            </button>
          );
        }

        if (isClaimed) {
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => handleEditClaim(row)}
                title="Edit the submitted claim amount for this milestone"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit Amount</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--danger, #dc2626)',
                  borderColor: 'var(--danger-border, #fca5a5)'
                }}
                onClick={() => handleDisputeClaim(row)}
                title="Flag and mark this claimed milestone as disputed"
              >
                <span>⚠️</span>
                <span>Dispute</span>
              </button>
            </div>
          );
        }
        return (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => window.AppStore.openModal('NEW_CLAIM', {
              candidate: candidateMap[row.candidate_id],
              candidate_id: row.candidate_id,
              candidate_name: row.candidate_name,
              milestone_id: row.id,
              milestone_stage: row.milestone_stage,
              milestone_type: row.milestone_type,
              milestone_title: row.milestone_title,
              milestone: row,
              claim_type: row.milestone_type || (row.milestone_stage === 0 ? 'placement' : (row.milestone_stage === 180 ? '180_days' : '365_days')),
              case_manager_name: row.case_manager_name
            })}
          >
            Submit Claim
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Retention Milestones Tracker</h1>
          <p className="page-subtitle">
            Automated Day 0, Day 180, and Day 365 retention gates tracker
          </p>
        </div>
      </div>

      {/* Dynamic Filter Controls Card with Searchable Comboboxes */}
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
        {/* Row 1: Searchable Candidate, Searchable Employer, Searchable Milestone, Joining Date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          
          {/* Searchable Candidate Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: '1 1 230px', minWidth: '210px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>👤</span> Candidate:
            </label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <SearchableSelect
                options={candidateSelectOptions}
                value={selectedCandidate}
                onChange={handleCandidateChange}
                placeholder="Select candidate..."
                searchPlaceholder="Search candidate, CPR, ref..."
              />
            </div>
          </div>

          {/* Searchable Employer Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: '1 1 230px', minWidth: '210px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🏢</span> Employer:
            </label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <SearchableSelect
                options={employerSelectOptions}
                value={selectedEmployer}
                onChange={handleEmployerChange}
                placeholder="Select employer..."
                searchPlaceholder="Search company or CR..."
              />
            </div>
          </div>

          {/* Searchable Milestone Stage Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: '1 1 210px', minWidth: '190px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🎯</span> Milestone:
            </label>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <SearchableSelect
                options={milestoneSelectOptions}
                value={selectedMilestone}
                onChange={handleMilestoneChange}
                placeholder="Select gate..."
                searchPlaceholder="Search gate (180, Day 0)..."
              />
            </div>
          </div>

          {/* Joining Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>📅</span> Join Date:
            </label>
            <input
              type="date"
              className="input-control"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
              value={joinDateFrom}
              onChange={e => handleJoinDateFrom(e.target.value)}
              title="Joining Date From"
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="input-control"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
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

        {/* Row 2: Status Pills & Reset All Button */}
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
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>
              Status:
            </span>
            {[
              { id: 'due_or_overdue', label: 'Action Required' },
              { id: '', label: 'All' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'claimed', label: 'Claimed' },
              { id: 'disputed', label: 'Disputed' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.76rem' }}
                onClick={() => handleStatusFilterChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Counts & Clear Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Showing <strong style={{ color: 'var(--primary)' }}>{displayData.length}</strong> of {milestones.length} milestones
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.65rem',
                  borderColor: 'var(--danger-border)',
                  color: 'var(--danger)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onClick={handleClearAllFilters}
                title="Reset all filters to default"
              >
                <span>✕</span> Reset All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Milestones Data Table */}
      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          searchPlaceholder="🔍 Search Candidate, Ref, CPR, Employer, CR..."
          searchKeys={['candidate_ref', 'candidate_name', 'candidate_cpr', 'company_name', 'employer_cr', 'milestone_title', 'status', 'case_manager_name', 'claim_ref']}
          exportFilename="Retention_Milestones_SaNDS.csv"
          emptyMessage="No milestone records found matching your filter criteria."
        />
      </div>
    </div>
  );
}

window.MilestonesView = MilestonesView;
