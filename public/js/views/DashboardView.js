/**
 * Dashboard View Component - Executive Intelligence, Filtered Visualizations & Retention Analytics
 *
 * Provides real-time metrics, interactive multi-perspective charts, and actionable retention tracking:
 * - 9 Core KPIs: Candidates, Placements, Claims Claimed, Disputes, Settled Value, Outstanding Balance,
 *   Due Unclaimed, Overdue Unclaimed, and Actions Required.
 * - Interactive Dynamic Filters: Consolidated vs Case-Manager-Wise, Year-Wise, and Month-Wise.
 * - 6 Enterprise SVG / Analytical Charts (3 Rows x 2 Columns):
 *   1. Lifecycle & Milestone Pipeline (Interactive Donut & Status Distribution)
 *   2. Monthly Trajectory & Timeline Analysis (Multi-Metric 12-Month Bar Chart)
 *   3. Financial Liquidity & Realization Gauge (Settled vs Balance vs Disputed)
 *   4. Case Manager Leaderboard (Consolidated) / Retention Gate Funnel (Individual CM)
 *   5. Top Enterprise Employers by Placements & Claims Activity
 *   6. Retention Milestone Due Horizon & Cashflow Maturation Forecast
 */

const { useState, useMemo } = React;

function DashboardView({ state }) {
  const {
    candidates = [],
    milestones = [],
    claims = [],
    disputes = [],
    payments = [],
    settings = {},
    currentUser = {}
  } = state;

  const currency = settings.currency || 'BHD';

  // ---------------------------------------------------------------------------
  // 1. FILTER CONTROLS STATE
  // ---------------------------------------------------------------------------
  const [selectedCM, setSelectedCM] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [chartMetricMode, setChartMetricMode] = useState('count'); // 'count' | 'value'
  const [activeHoverTooltip, setActiveHoverTooltip] = useState(null);
  const [gridColumns, setGridColumns] = useState(() => {
    try {
      return sessionStorage.getItem('sands_dash_cols') || '2';
    } catch (e) {
      return '2';
    }
  });

  const handleSetGridColumns = (cols) => {
    setGridColumns(cols);
    try {
      sessionStorage.setItem('sands_dash_cols', cols);
    } catch (e) {}
  };

  // ---------------------------------------------------------------------------
  // 2. EXTRACT DYNAMIC FILTER LISTS
  // ---------------------------------------------------------------------------
  // Extract all distinct Case Managers
  const caseManagersList = useMemo(() => {
    const set = new Set();
    (candidates || []).forEach(c => c.case_manager_name && set.add(c.case_manager_name.trim()));
    (milestones || []).forEach(m => m.case_manager_name && set.add(m.case_manager_name.trim()));
    (claims || []).forEach(cl => cl.case_manager_name && set.add(cl.case_manager_name.trim()));
    if (state.caseManagers && Array.isArray(state.caseManagers)) {
      state.caseManagers.forEach(cm => {
        if (typeof cm === 'string') set.add(cm.trim());
        else if (cm?.name) set.add(cm.name.trim());
        else if (cm?.case_manager_name) set.add(cm.case_manager_name.trim());
      });
    }
    return Array.from(set).filter(Boolean).sort();
  }, [candidates, milestones, claims, state.caseManagers]);

  // Extract all distinct Years across records
  const yearsList = useMemo(() => {
    const set = new Set([new Date().getFullYear().toString()]);
    const addDate = (d) => {
      if (!d) return;
      const yr = String(d).split(/[-T :]/)[0];
      if (yr && yr.length === 4 && !isNaN(yr)) set.add(yr);
    };
    (candidates || []).forEach(c => { addDate(c.joining_date); addDate(c.registration_date); addDate(c.created_at); });
    (milestones || []).forEach(m => { addDate(m.due_date); addDate(m.target_date); addDate(m.created_at); });
    (claims || []).forEach(cl => { addDate(cl.claim_date); addDate(cl.created_at); });
    (payments || []).forEach(p => { addDate(p.payment_date); addDate(p.created_at); });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [candidates, milestones, claims, payments]);

  // Months List
  const MONTHS = [
    { val: 'all', label: 'All Months' },
    { val: '01', label: '01 - Jan' },
    { val: '02', label: '02 - Feb' },
    { val: '03', label: '03 - Mar' },
    { val: '04', label: '04 - Apr' },
    { val: '05', label: '05 - May' },
    { val: '06', label: '06 - Jun' },
    { val: '07', label: '07 - Jul' },
    { val: '08', label: '08 - Aug' },
    { val: '09', label: '09 - Sep' },
    { val: '10', label: '10 - Oct' },
    { val: '11', label: '11 - Nov' },
    { val: '12', label: '12 - Dec' },
  ];

  // ---------------------------------------------------------------------------
  // 3. FILTERING PREDICATES
  // ---------------------------------------------------------------------------
  const matchesCM = (cmName) => {
    if (selectedCM === 'all') return true;
    return String(cmName || '').trim().toLowerCase() === String(selectedCM).trim().toLowerCase();
  };

  const matchesDate = (dateVal) => {
    if (!dateVal) return selectedYear === 'all' && selectedMonth === 'all';
    const clean = String(dateVal).trim();
    const parts = clean.split(/[-T :]/);
    const yr = parts[0];
    const mo = parts[1];

    if (selectedYear !== 'all' && yr !== selectedYear) return false;
    if (selectedMonth !== 'all' && mo !== selectedMonth) return false;
    return true;
  };

  // ---------------------------------------------------------------------------
  // 4. COMPUTED DATA PIPELINE & RESOLUTION
  // ---------------------------------------------------------------------------
  const todayMidnight = new Date().setHours(0, 0, 0, 0);

  // Fast candidate lookup
  const candidateMap = useMemo(() => {
    const map = {};
    (candidates || []).forEach(c => { map[c.id] = c; });
    return map;
  }, [candidates]);

  // Fast claim lookup by milestone and candidate
  const claimByMilestoneId = useMemo(() => {
    const map = {};
    (claims || []).forEach(cl => {
      if (cl.milestone_id) map[cl.milestone_id] = cl;
    });
    return map;
  }, [claims]);

  // Process all milestones with synchronized dynamic lifecycle statuses
  const processedMilestones = useMemo(() => {
    return (milestones || []).map(m => {
      const cand = candidateMap[m.candidate_id] || {};
      const target = m.due_date || m.target_date;
      let days = m.days_remaining;
      if ((days === undefined || days === null) && target) {
        const targetMidnight = new Date(target).setHours(0, 0, 0, 0);
        days = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
      }

      // Link Claim
      const linkedClaim = (m.claim_id ? (claims || []).find(c => Number(c.id) === Number(m.claim_id)) : null)
        || claimByMilestoneId[m.id]
        || (claims || []).find(c => Number(c.candidate_id) === Number(m.candidate_id) && c.claim_type === m.milestone_type)
        || null;

      const claimStatus = linkedClaim?.status || m.claim_status || null;
      let dynStatus = m.status;

      if (claimStatus === 'disputed' || m.status === 'disputed') {
        dynStatus = 'disputed';
      } else if (claimStatus === 'settled') {
        dynStatus = 'settled';
      } else if (claimStatus === 'claimed' || claimStatus === 'submitted' || claimStatus === 'approved' || m.status === 'claimed') {
        dynStatus = 'claimed';
      } else if (days !== null && days !== undefined) {
        if (days < -30) dynStatus = 'overdue';
        else if (days <= 0) dynStatus = 'due';
        else dynStatus = 'upcoming';
      }

      const claimAmount = linkedClaim?.claim_amount_bhd !== undefined && linkedClaim?.claim_amount_bhd !== null
        ? parseFloat(linkedClaim.claim_amount_bhd)
        : (m.claim_amount_bhd !== undefined && m.claim_amount_bhd !== null ? parseFloat(m.claim_amount_bhd) : 500);

      const collected = linkedClaim?.amount_collected_bhd !== undefined
        ? parseFloat(linkedClaim.amount_collected_bhd || 0)
        : (linkedClaim?.total_paid_bhd !== undefined ? parseFloat(linkedClaim.total_paid_bhd || 0) : 0);

      const balance = linkedClaim?.balance_bhd !== undefined
        ? parseFloat(linkedClaim.balance_bhd)
        : Math.max(0, claimAmount - collected);

      return {
        ...m,
        computedStatus: dynStatus,
        daysRemaining: days,
        claimAmount,
        collected,
        balance,
        linkedClaim,
        candidateName: cand.full_name || m.candidate_name || 'Candidate',
        candidateCpr: cand.cpr_no || m.candidate_cpr || '',
        companyName: cand.company_name || m.company_name || 'Employer',
        employerCr: cand.employer_cr || m.employer_cr || '',
        caseManagerName: cand.case_manager_name || m.case_manager_name || 'System',
        effectiveDate: target || m.created_at
      };
    });
  }, [milestones, claims, candidateMap, claimByMilestoneId, todayMidnight]);

  // ---------------------------------------------------------------------------
  // 5. FILTERED DATASETS
  // ---------------------------------------------------------------------------
  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return (candidates || []).filter(c => {
      const cmMatch = matchesCM(c.case_manager_name);
      const dateMatch = matchesDate(c.joining_date || c.registration_date || c.created_at);
      return cmMatch && dateMatch;
    });
  }, [candidates, selectedCM, selectedYear, selectedMonth]);

  // Filtered Milestones
  const filteredMilestones = useMemo(() => {
    return processedMilestones.filter(m => {
      const cmMatch = matchesCM(m.caseManagerName);
      const dateMatch = matchesDate(m.effectiveDate);
      return cmMatch && dateMatch;
    });
  }, [processedMilestones, selectedCM, selectedYear, selectedMonth]);

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    return (claims || []).filter(cl => {
      const cmMatch = matchesCM(cl.case_manager_name || candidateMap[cl.candidate_id]?.case_manager_name);
      const dateMatch = matchesDate(cl.claim_date || cl.created_at);
      return cmMatch && dateMatch;
    });
  }, [claims, candidateMap, selectedCM, selectedYear, selectedMonth]);

  // Filtered Disputes
  const filteredDisputes = useMemo(() => {
    return (disputes || []).filter(d => {
      const cand = candidateMap[d.candidate_id] || {};
      const cmMatch = matchesCM(d.case_manager_name || cand.case_manager_name);
      const dateMatch = matchesDate(d.dispute_date || d.created_at);
      return cmMatch && dateMatch;
    });
  }, [disputes, candidateMap, selectedCM, selectedYear, selectedMonth]);

  // ---------------------------------------------------------------------------
  // 6. 9 KEY STATISTICS (COUNTS & FINANCIAL VALUES)
  // ---------------------------------------------------------------------------
  // 1. Total Candidates
  const totalCandidates = filteredCandidates.length;

  // 2. Placed Count
  const placedCandidates = filteredCandidates.filter(c =>
    c.placement_status === 'active' || c.status === 'placed' || c.is_placed
  );
  const totalPlaced = placedCandidates.length;
  const placementRate = totalCandidates > 0 ? ((totalPlaced / totalCandidates) * 100).toFixed(1) : '0.0';

  // 3. Claims Claimed Count (All claims registered / claimed)
  const claimsClaimedCount = filteredClaims.filter(c => c.status !== 'terminated').length;

  // 4. Disputes Count
  const disputesCount = filteredDisputes.length;

  // 5. Settled Claims Value
  const settledClaimsValue = filteredClaims.reduce((sum, cl) => {
    const paid = parseFloat(cl.amount_collected_bhd || cl.total_paid_bhd || (cl.status === 'settled' ? cl.claim_amount_bhd : 0)) || 0;
    return sum + paid;
  }, 0);

  // 6. Outstanding Balance Amount
  const balanceAmount = filteredClaims.reduce((sum, cl) => {
    const bal = parseFloat(cl.balance_bhd !== undefined && cl.balance_bhd !== null ? cl.balance_bhd : (cl.status !== 'settled' ? cl.claim_amount_bhd : 0)) || 0;
    return sum + bal;
  }, 0);

  // Total Submitted Claim Value
  const totalSubmittedValue = filteredClaims.reduce((sum, cl) => sum + (parseFloat(cl.claim_amount_bhd) || 0), 0);
  const collectionRate = totalSubmittedValue > 0 ? ((settledClaimsValue / totalSubmittedValue) * 100).toFixed(1) : '0.0';

  // 7. Due Claims which are not claimed
  const dueUnclaimedMilestones = filteredMilestones.filter(m => m.computedStatus === 'due');
  const dueUnclaimedCount = dueUnclaimedMilestones.length;

  // 8. Overdue Claims which are not claimed
  const overdueUnclaimedMilestones = filteredMilestones.filter(m => m.computedStatus === 'overdue');
  const overdueUnclaimedCount = overdueUnclaimedMilestones.length;

  // 9. Actions Required (Due + Overdue)
  const actionRequiredCount = overdueUnclaimedCount + dueUnclaimedCount;

  // Disputed Value Frozen
  const disputedFrozenValue = filteredClaims
    .filter(c => c.status === 'disputed')
    .reduce((sum, c) => sum + (parseFloat(c.claim_amount_bhd) || 0), 0);

  // Operational Count Metrics for Liquidity & Settlement Breakdown
  const settledClaimsCount = filteredClaims.filter(c =>
    c.status === 'settled' ||
    (parseFloat(c.amount_collected_bhd || c.total_paid_bhd || 0) >= parseFloat(c.claim_amount_bhd || 0) && parseFloat(c.claim_amount_bhd || 0) > 0)
  ).length;

  const pendingClaimsCount = filteredClaims.filter(c =>
    c.status !== 'settled' && c.status !== 'disputed' && c.status !== 'terminated' && c.status !== 'rejected'
  ).length;

  const upcomingMilestonesCount = filteredMilestones.filter(m => m.computedStatus === 'upcoming').length;

  const retentionGateCounts = useMemo(() => {
    let day0 = 0, day180 = 0, day365 = 0;
    filteredMilestones.forEach(m => {
      const type = String(m.milestone_type || '').toLowerCase();
      if (type.includes('365') || type.includes('year') || type.includes('final')) day365++;
      else if (type.includes('180') || type.includes('6 month') || type.includes('half')) day180++;
      else if (type.includes('0') || type.includes('placement') || type.includes('initial')) day0++;
      else day0++;
    });
    return { day0, day180, day365 };
  }, [filteredMilestones]);

  // ---------------------------------------------------------------------------
  // 7. CHART DATA AGGREGATIONS
  // ---------------------------------------------------------------------------
  // Graph 1: Lifecycle & Status Pipeline
  const lifecycleBreakdown = useMemo(() => {
    let overdueCount = 0, dueCount = 0, inProcessCount = 0, settledCount = 0, disputedCount = 0;
    let overdueVal = 0, dueVal = 0, inProcessVal = 0, settledVal = 0, disputedVal = 0;

    filteredMilestones.forEach(m => {
      const amt = m.claimAmount || 0;
      if (m.computedStatus === 'overdue') { overdueCount++; overdueVal += amt; }
      else if (m.computedStatus === 'due') { dueCount++; dueVal += amt; }
      else if (m.computedStatus === 'claimed') { inProcessCount++; inProcessVal += amt; }
      else if (m.computedStatus === 'settled') { settledCount++; settledVal += amt; }
      else if (m.computedStatus === 'disputed') { disputedCount++; disputedVal += amt; }
    });

    return [
      { key: 'overdue', label: 'Overdue (Urgent)', count: overdueCount, value: overdueVal, color: '#ef4444' },
      { key: 'due', label: 'Due (Action Needed)', count: dueCount, value: dueVal, color: '#f59e0b' },
      { key: 'claimed', label: 'Claims In Process', count: inProcessCount, value: inProcessVal, color: '#3b82f6' },
      { key: 'settled', label: 'Settled & Paid', count: settledCount, value: settledVal, color: '#10b981' },
      { key: 'disputed', label: 'Disputes Held', count: disputedCount, value: disputedVal, color: '#dc2626' }
    ];
  }, [filteredMilestones]);

  // Graph 2: Monthly Timeline Trajectory (12 Months)
  const monthlyTrajectory = useMemo(() => {
    const targetYr = selectedYear !== 'all' ? selectedYear : new Date().getFullYear().toString();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return monthNames.map((name, idx) => {
      const mStr = String(idx + 1).padStart(2, '0');

      // Placements in this month
      const placed = (candidates || []).filter(c => {
        if (!matchesCM(c.case_manager_name)) return false;
        const d = c.joining_date || c.registration_date || c.created_at;
        if (!d) return false;
        const parts = String(d).split(/[-T :]/);
        return parts[0] === targetYr && parts[1] === mStr;
      }).length;

      // Claims registered in this month
      const monthlyClaims = (claims || []).filter(cl => {
        if (!matchesCM(cl.case_manager_name || candidateMap[cl.candidate_id]?.case_manager_name)) return false;
        const d = cl.claim_date || cl.created_at;
        if (!d) return false;
        const parts = String(d).split(/[-T :]/);
        return parts[0] === targetYr && parts[1] === mStr;
      });
      const claimsCount = monthlyClaims.length;
      const settledVal = monthlyClaims.reduce((sum, cl) => sum + (parseFloat(cl.amount_collected_bhd || (cl.status === 'settled' ? cl.claim_amount_bhd : 0)) || 0), 0);

      // Actions required in this month
      const actionsCount = processedMilestones.filter(m => {
        if (!matchesCM(m.caseManagerName)) return false;
        if (m.computedStatus !== 'due' && m.computedStatus !== 'overdue') return false;
        const d = m.effectiveDate;
        if (!d) return false;
        const parts = String(d).split(/[-T :]/);
        return parts[0] === targetYr && parts[1] === mStr;
      }).length;

      return {
        month: name,
        monthNum: mStr,
        placed,
        claims: claimsCount,
        settled: settledVal,
        actions: actionsCount
      };
    });
  }, [selectedYear, candidates, claims, processedMilestones, candidateMap, selectedCM]);

  // Graph 3: Case Manager Comparison (Consolidated View)
  const caseManagerComparison = useMemo(() => {
    return caseManagersList.map(cmName => {
      const cmCands = (candidates || []).filter(c => matchesCM(cmName) && String(c.case_manager_name || '').trim().toLowerCase() === cmName.toLowerCase());
      const cmPlaced = cmCands.filter(c => c.placement_status === 'active' || c.status === 'placed').length;

      const cmClaims = (claims || []).filter(cl => {
        const cOwner = cl.case_manager_name || candidateMap[cl.candidate_id]?.case_manager_name;
        return String(cOwner || '').trim().toLowerCase() === cmName.toLowerCase();
      });
      const cmClaimCount = cmClaims.length;
      const cmSettledVal = cmClaims.reduce((s, cl) => s + (parseFloat(cl.amount_collected_bhd || (cl.status === 'settled' ? cl.claim_amount_bhd : 0)) || 0), 0);

      const cmActions = processedMilestones.filter(m => {
        return String(m.caseManagerName || '').trim().toLowerCase() === cmName.toLowerCase() &&
          (m.computedStatus === 'due' || m.computedStatus === 'overdue');
      }).length;

      return {
        name: cmName,
        placed: cmPlaced,
        claims: cmClaimCount,
        settled: cmSettledVal,
        actions: cmActions
      };
    });
  }, [caseManagersList, candidates, claims, processedMilestones, candidateMap]);

  // Graph 4: Retention Funnel by Gates (When specific CM is inspected)
  const gateFunnelBreakdown = useMemo(() => {
    const gates = [
      { key: 'placement', label: 'Day 0 Placement Claim' },
      { key: '180_days', label: 'Day 180 Retention Gate' },
      { key: '365_days', label: 'Day 365 Retention Gate' }
    ];

    return gates.map(g => {
      const gateMilestones = filteredMilestones.filter(m => m.milestone_type === g.key);
      const total = gateMilestones.length;
      const settled = gateMilestones.filter(m => m.computedStatus === 'settled').length;
      const claimed = gateMilestones.filter(m => m.computedStatus === 'claimed').length;
      const due = gateMilestones.filter(m => m.computedStatus === 'due').length;
      const overdue = gateMilestones.filter(m => m.computedStatus === 'overdue').length;
      const disputed = gateMilestones.filter(m => m.computedStatus === 'disputed').length;

      return {
        ...g,
        total,
        settled,
        claimed,
        due,
        overdue,
        disputed,
        completionRate: total > 0 ? (((settled + claimed) / total) * 100).toFixed(0) : 0
      };
    });
  }, [filteredMilestones]);

  // Graph 5: Top Enterprise Employers & Corporate Distribution
  const topEmployers = useMemo(() => {
    const map = {};
    filteredCandidates.forEach(c => {
      const comp = c.company_name?.trim() || 'General Enterprise';
      if (!map[comp]) {
        map[comp] = {
          name: comp,
          cr: c.employer_cr || '',
          placements: 0,
          claimsCount: 0,
          settledAmount: 0,
          disputesCount: 0
        };
      }
      if (c.placement_status === 'active' || c.status === 'placed' || c.is_placed) {
        map[comp].placements++;
      }
    });

    filteredClaims.forEach(cl => {
      const cand = candidateMap[cl.candidate_id];
      const comp = cl.company_name?.trim() || cand?.company_name?.trim() || 'General Enterprise';
      if (map[comp]) {
        map[comp].claimsCount++;
        const paid = parseFloat(cl.amount_collected_bhd || (cl.status === 'settled' ? cl.claim_amount_bhd : 0)) || 0;
        map[comp].settledAmount += paid;
        if (cl.status === 'disputed') map[comp].disputesCount++;
      }
    });

    return Object.values(map)
      .sort((a, b) => (b.placements * 1000 + b.settledAmount) - (a.placements * 1000 + a.settledAmount))
      .slice(0, 6);
  }, [filteredCandidates, filteredClaims, candidateMap]);

  // Graph 6: Retention Milestone Maturation Horizon & Cashflow Forecast
  const maturationHorizon = useMemo(() => {
    const buckets = [
      { key: 'overdue', label: 'Overdue Backlog', range: '< 0 Days', color: '#ef4444', count: 0, amount: 0, sub: 'Immediate revenue recovery' },
      { key: 'next_30', label: 'Imminent (Next 30d)', range: '1 - 30 Days', color: '#f59e0b', count: 0, amount: 0, sub: 'Current claims cycle' },
      { key: 'next_90', label: 'Quarterly Horizon', range: '31 - 90 Days', color: '#3b82f6', count: 0, amount: 0, sub: 'Q1 upcoming gates' },
      { key: 'next_180', label: '6-Month Retention', range: '91 - 180 Days', color: '#6366f1', count: 0, amount: 0, sub: 'Mid-term Tamkeen gates' },
      { key: 'next_365', label: '1-Year Completion', range: '181 - 365 Days', color: '#10b981', count: 0, amount: 0, sub: 'Annual retention gates' }
    ];

    filteredMilestones.forEach(m => {
      // Exclude settled milestones from future forecasting
      if (m.computedStatus === 'settled') return;

      const days = m.daysRemaining;
      const amt = m.claimAmount || 500;

      if (days !== null && days !== undefined) {
        if (days < 0) {
          buckets[0].count++;
          buckets[0].amount += amt;
        } else if (days <= 30) {
          buckets[1].count++;
          buckets[1].amount += amt;
        } else if (days <= 90) {
          buckets[2].count++;
          buckets[2].amount += amt;
        } else if (days <= 180) {
          buckets[3].count++;
          buckets[3].amount += amt;
        } else {
          buckets[4].count++;
          buckets[4].amount += amt;
        }
      }
    });

    return buckets;
  }, [filteredMilestones]);

  const handleResetFilters = () => {
    setSelectedCM('all');
    setSelectedYear('all');
    setSelectedMonth('all');
  };

  // ===========================================================================
  // RENDER INTERACTION
  // ===========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* -------------------------------------------------------------------- */}
      {/* 1. FILTER TOOLBAR & EXECUTIVE CONTROL BAR                            */}
      {/* -------------------------------------------------------------------- */}
      <div className="dash-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 800,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}>
            📊
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Executive Placement & Claims Intelligence
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Real-time Tamkeen retention gates, liquidity realization, and case manager operational analytics
            </div>
          </div>
        </div>

        {/* Dynamic Filters Group */}
        <div className="dash-filter-group">
          {/* Case Manager / Scope Selector */}
          <div className="dash-filter-item">
            <span className="dash-filter-label">Perspective / Scope</span>
            <select
              className="dash-select"
              value={selectedCM}
              onChange={e => setSelectedCM(e.target.value)}
              title="Select consolidated view or filter by individual case manager"
            >
              <option value="all">🌐 Consolidated (All Managers)</option>
              {caseManagersList.map(cm => (
                <option key={cm} value={cm}>👤 {cm}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="dash-filter-item">
            <span className="dash-filter-label">Year</span>
            <select
              className="dash-select"
              style={{ minWidth: '110px' }}
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              title="Filter statistics and graphs by year"
            >
              <option value="all">📅 All Years</option>
              {yearsList.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="dash-filter-item">
            <span className="dash-filter-label">Month</span>
            <select
              className="dash-select"
              style={{ minWidth: '120px' }}
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              title="Filter statistics and graphs by month"
            >
              {MONTHS.map(m => (
                <option key={m.val} value={m.val}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          {(selectedCM !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all') && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleResetFilters}
              style={{ marginTop: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.78rem', borderColor: 'var(--border-medium)' }}
              title="Reset all filters back to consolidated view"
            >
              ✕ Reset
            </button>
          )}

          {/* Refresh Data */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => window.AppStore.refreshData()}
            style={{ marginTop: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
            title="Reload latest records from database"
          >
            🔄 Refresh
          </button>

          {/* Grid Layout Switcher (2-Columns vs 3-Columns) */}
          <div className="dash-filter-item" style={{ marginLeft: 'auto' }}>
            <span className="dash-filter-label">Layout</span>
            <div style={{ display: 'inline-flex', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '2px', gap: '2px' }}>
              <button
                type="button"
                className={`btn btn-sm ${gridColumns === '2' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem', borderRadius: 'calc(var(--radius-md) - 2px)' }}
                onClick={() => handleSetGridColumns('2')}
                title="Balanced 2-Column layout (Recommended - completely fills screen with 0 blank spaces)"
              >
                ▦ 2 Columns
              </button>
              <button
                type="button"
                className={`btn btn-sm ${gridColumns === '3' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem', borderRadius: 'calc(var(--radius-md) - 2px)' }}
                onClick={() => handleSetGridColumns('3')}
                title="Compact 3-Column layout (High density across ultra-wide monitors)"
              >
                ☷ 3 Columns
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. URGENT ACTIONS REQUIRED ALERT STRIP (IF ANY PENDING)               */}
      {/* -------------------------------------------------------------------- */}
      {actionRequiredCount > 0 ? (
        <div className="dash-alert-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--danger)', display: 'block' }}>
                Action Required: {actionRequiredCount} Retention Milestone Claims Need Attention
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {overdueUnclaimedCount > 0 && <span style={{ fontWeight: 700, color: 'var(--danger)' }}>🚨 {overdueUnclaimedCount} Overdue Claims (Past Deadline)&nbsp;&bull;&nbsp;</span>}
                {dueUnclaimedCount > 0 && <span style={{ fontWeight: 600, color: 'var(--warning)' }}>⏱️ {dueUnclaimedCount} Due Claims (Ready for Submission)</span>}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => window.AppStore.setActiveTab('milestones')}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 700 }}
            title="Open Milestones retention tracker"
          >
            Review in Milestones Tracker →
          </button>
        </div>
      ) : (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.7rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.82rem',
          color: 'var(--success)'
        }}>
          <span>✓</span>
          <span><strong>All Caught Up:</strong> No pending overdue or due claims in the current scope. All milestone claims have been submitted or are on schedule.</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 3. CORE STATISTICS GRID (9 REQUESTED KPIS IN HARMONIOUS TILES)       */}
      {/* -------------------------------------------------------------------- */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
          Operational Placement & Retention Drivers
        </div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>

          {/* 1. Total Candidates */}
          <div className="kpi-card" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Candidates</span>
              <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>👥</div>
            </div>
            <div className="kpi-value">{totalCandidates}</div>
            <div className="dash-kpi-subtext">
              <span>Total registered</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>Enrollment</span>
            </div>
          </div>

          {/* 2. Placed Count */}
          <div className="kpi-card success" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Placed Count</span>
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>🎯</div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>{totalPlaced}</div>
            <div className="dash-kpi-subtext">
              <span>Active placements</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>{placementRate}% Rate</span>
            </div>
          </div>

          {/* 3. Due Claims (Not Claimed) */}
          <div className="kpi-card warning" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Due Unclaimed</span>
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>⏱️</div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--warning)' }}>{dueUnclaimedCount}</div>
            <div className="dash-kpi-subtext">
              <span>Reached retention gate</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>Ready</span>
            </div>
          </div>

          {/* 4. Overdue Claims */}
          <div className="kpi-card danger" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Overdue Claims</span>
              <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' }}>🚨</div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>{overdueUnclaimedCount}</div>
            <div className="dash-kpi-subtext">
              <span>Past deadline window</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>Urgent</span>
            </div>
          </div>

          {/* 5. Actions Required (Due + Overdue) */}
          <div
            className="kpi-card danger"
            style={{
              padding: '1.15rem 1.25rem',
              background: actionRequiredCount > 0 ? 'linear-gradient(135deg, var(--bg-card), rgba(239, 68, 68, 0.05))' : 'var(--bg-card)',
              cursor: 'pointer'
            }}
            onClick={() => window.AppStore.setActiveTab('milestones')}
            title="Click to view all action items in Milestones Tracker"
          >
            <div className="kpi-header">
              <span className="kpi-title" style={{ color: 'var(--danger)' }}>Actions Required</span>
              <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>⚡</div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>{actionRequiredCount}</div>
            <div className="dash-kpi-subtext">
              <span>Due + Overdue total</span>
              <span className="dash-kpi-badge" style={{ background: actionRequiredCount > 0 ? '#ef4444' : '#10b981', color: '#fff' }}>
                {actionRequiredCount > 0 ? 'Needs Action' : 'Cleared'}
              </span>
            </div>
          </div>

        </div>

        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
          Financial Settlement & Claims Liquidity
        </div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>

          {/* 6. Claims Claimed Count */}
          <div className="kpi-card" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Claims Claimed</span>
              <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>📋</div>
            </div>
            <div className="kpi-value">{claimsClaimedCount}</div>
            <div className="dash-kpi-subtext">
              <span>Submitted / In-process</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
                {currency} {Number(totalSubmittedValue).toLocaleString('en-US', { minimumFractionDigits: 1 })}
              </span>
            </div>
          </div>

          {/* 7. Settled Claims Value */}
          <div className="kpi-card success" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Settled Claims Value</span>
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>💰</div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--success)', fontSize: '1.65rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>{currency}</span>
              {Number(settledClaimsValue).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
            </div>
            <div className="dash-kpi-subtext">
              <span>Disbursed & collected</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                {collectionRate}% Realized
              </span>
            </div>
          </div>

          {/* 8. Balance Amount */}
          <div className="kpi-card warning" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Balance Amount</span>
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>📉</div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--warning)', fontSize: '1.65rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>{currency}</span>
              {Number(balanceAmount).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
            </div>
            <div className="dash-kpi-subtext">
              <span>Outstanding ministry release</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                Pending
              </span>
            </div>
          </div>

          {/* 9. Disputes Count */}
          <div className="kpi-card danger" style={{ padding: '1.15rem 1.25rem' }}>
            <div className="kpi-header">
              <span className="kpi-title">Disputes Flagged</span>
              <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' }}>⚠️</div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>{disputesCount}</div>
            <div className="dash-kpi-subtext">
              <span>Claims placed on hold</span>
              <span className="dash-kpi-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>
                {currency} {Number(disputedFrozenValue).toFixed(1)} Frozen
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. EXECUTIVE ANALYTICAL GRAPHS (ALL 6 GRAPHS IN ONE HARMONIOUS GRID)  */}
      {/* -------------------------------------------------------------------- */}
      <div className={`dash-charts-grid ${gridColumns === '3' ? 'cols-3' : ''}`}>

        {/* ------------------------------------------------------------------ */}
        {/* GRAPH 1: LIFECYCLE & RETENTION PIPELINE (DONUT & SEGMENT BARS)      */}
        {/* ------------------------------------------------------------------ */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div>
              <div className="dash-chart-title">
                <span>🔄</span>
                <span>Claims & Retention Milestone Pipeline</span>
              </div>
              <div className="dash-chart-subtitle">
                Proportional breakdown of active gates by operational status ({selectedCM === 'all' ? 'Consolidated' : selectedCM})
              </div>
            </div>
            <div className="dash-chart-tabs">
              <button
                type="button"
                className={`dash-chart-tab-btn ${chartMetricMode === 'count' ? 'active' : ''}`}
                onClick={() => setChartMetricMode('count')}
              >
                Volume (Counts)
              </button>
              <button
                type="button"
                className={`dash-chart-tab-btn ${chartMetricMode === 'value' ? 'active' : ''}`}
                onClick={() => setChartMetricMode('value')}
              >
                Value ({currency})
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
            {/* SVG Donut Ring */}
            <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0, margin: '0 auto' }}>
              <svg viewBox="0 0 180 180" width="180" height="180">
                <circle cx="90" cy="90" r="70" fill="none" stroke="var(--border-light)" strokeWidth="18" />
                {(() => {
                  const total = lifecycleBreakdown.reduce((s, it) => s + (chartMetricMode === 'count' ? it.count : it.value), 0);
                  if (total <= 0) {
                    return <circle cx="90" cy="90" r="70" fill="none" stroke="var(--border-medium)" strokeWidth="18" strokeDasharray="439.82" />;
                  }
                  let cumulativePercent = 0;
                  const C = 2 * Math.PI * 70; // ~439.82
                  return lifecycleBreakdown.map((item) => {
                    const val = chartMetricMode === 'count' ? item.count : item.value;
                    const percent = val / total;
                    const strokeDash = percent * C;
                    const strokeOffset = -cumulativePercent * C;
                    cumulativePercent += percent;

                    return (
                      <circle
                        key={item.key}
                        cx="90"
                        cy="90"
                        r="70"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="18"
                        strokeDasharray={`${strokeDash} ${C - strokeDash}`}
                        strokeDashoffset={strokeOffset}
                        transform="rotate(-90 90 90)"
                        style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }}
                      />
                    );
                  });
                })()}
              </svg>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {chartMetricMode === 'count'
                    ? filteredMilestones.length
                    : `${currency} ${Number(filteredMilestones.reduce((s, m) => s + (m.claimAmount || 0), 0)).toFixed(0)}`
                  }
                </span>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {chartMetricMode === 'count' ? 'Total Gates' : 'Total Pipeline'}
                </span>
              </div>
            </div>

            {/* Segment Breakdown Legend */}
            <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {lifecycleBreakdown.map(item => {
                const total = lifecycleBreakdown.reduce((s, it) => s + (chartMetricMode === 'count' ? it.count : it.value), 0);
                const val = chartMetricMode === 'count' ? item.count : item.value;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';

                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color, display: 'inline-block' }}></span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {chartMetricMode === 'count' ? item.count : `${currency} ${Number(item.value).toFixed(1)}`}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'right' }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* GRAPH 2: MONTHLY TRENDS & TIMELINE ANALYSIS                        */}
        {/* ------------------------------------------------------------------ */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div>
              <div className="dash-chart-title">
                <span>📈</span>
                <span>Monthly Trends & Trajectory ({selectedYear !== 'all' ? selectedYear : new Date().getFullYear()})</span>
              </div>
              <div className="dash-chart-subtitle">
                Month-by-month trajectory of placements, claims, actions required, and revenue
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.74rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }}></span> Placed
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#6366f1' }}></span> Claims
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }}></span> Action Req
              </span>
            </div>
          </div>

          {/* SVG 12-Month Multi-Bar Chart */}
          <div style={{ position: 'relative', height: '210px', width: '100%' }}>
            <svg viewBox="0 0 520 200" width="100%" height="200" preserveAspectRatio="none">
              {/* Background Grid Lines */}
              <line x1="30" y1="30" x2="510" y2="30" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="30" y1="80" x2="510" y2="80" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="30" y1="130" x2="510" y2="130" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="30" y1="170" x2="510" y2="170" stroke="var(--border-medium)" strokeWidth="1" />

              {/* Monthly Group Bars */}
              {(() => {
                const maxVal = Math.max(1, ...monthlyTrajectory.map(m => Math.max(m.placed, m.claims, m.actions)));
                const barGroupWidth = 36;
                const subBarWidth = 8;

                return monthlyTrajectory.map((item, idx) => {
                  const groupX = 35 + idx * 39;
                  const placedH = (item.placed / maxVal) * 130;
                  const claimsH = (item.claims / maxVal) * 130;
                  const actionsH = (item.actions / maxVal) * 130;

                  const isSelected = selectedMonth === item.monthNum;

                  return (
                    <g
                      key={item.month}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedMonth(selectedMonth === item.monthNum ? 'all' : item.monthNum)}
                      onMouseEnter={() => setActiveHoverTooltip(item)}
                      onMouseLeave={() => setActiveHoverTooltip(null)}
                    >
                      {/* Highlight Column Backing */}
                      {isSelected && (
                        <rect x={groupX - 3} y="15" width={barGroupWidth + 4} height="155" fill="rgba(59, 130, 246, 0.08)" rx="4" />
                      )}

                      {/* Bar 1: Placed (Blue) */}
                      <rect
                        x={groupX + 2}
                        y={170 - placedH}
                        width={subBarWidth}
                        height={Math.max(2, placedH)}
                        fill="#3b82f6"
                        rx="2"
                        opacity={isSelected ? 1 : 0.85}
                      />

                      {/* Bar 2: Claims (Indigo) */}
                      <rect
                        x={groupX + 12}
                        y={170 - claimsH}
                        width={subBarWidth}
                        height={Math.max(2, claimsH)}
                        fill="#6366f1"
                        rx="2"
                        opacity={isSelected ? 1 : 0.85}
                      />

                      {/* Bar 3: Actions Required (Red/Amber) */}
                      <rect
                        x={groupX + 22}
                        y={170 - actionsH}
                        width={subBarWidth}
                        height={Math.max(2, actionsH)}
                        fill="#ef4444"
                        rx="2"
                        opacity={isSelected ? 1 : 0.85}
                      />

                      {/* Month Label */}
                      <text
                        x={groupX + 17}
                        y="186"
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight={isSelected ? '800' : '600'}
                        fill={isSelected ? 'var(--primary)' : 'var(--text-muted)'}
                      >
                        {item.month}
                      </text>
                    </g>
                  );
                });
              })()}
            </svg>

            {/* Active Tooltip Popover */}
            {activeHoverTooltip && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '15px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '0.45rem 0.75rem',
                fontSize: '0.75rem',
                boxShadow: 'var(--shadow-md)',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '2px' }}>
                  {activeHoverTooltip.month} {selectedYear !== 'all' ? selectedYear : ''} Summary
                </strong>
                <div>Placed: <strong>{activeHoverTooltip.placed}</strong></div>
                <div>Claims: <strong>{activeHoverTooltip.claims}</strong></div>
                <div>Settled: <strong>{currency} {Number(activeHoverTooltip.settled).toFixed(1)}</strong></div>
                <div>Actions Required: <strong style={{ color: 'var(--danger)' }}>{activeHoverTooltip.actions}</strong></div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* GRAPH 3: FINANCIAL SETTLEMENT & REALIZATION GAUGE                  */}
        {/* ------------------------------------------------------------------ */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div>
              <div className="dash-chart-title">
                <span>💰</span>
                <span>Liquidity Settlement & Collection Velocity</span>
              </div>
              <div className="dash-chart-subtitle">
                Cash realization vs outstanding ministry escrow balances
              </div>
            </div>
            <span className="badge badge-success" style={{ fontSize: '0.74rem', fontWeight: 700 }}>
              {collectionRate}% Realized
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Visual Realization Gauge Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Progress towards full collection</span>
                <strong style={{ color: 'var(--success)' }}>
                  {currency} {Number(settledClaimsValue).toLocaleString('en-US', { minimumFractionDigits: 1 })} of {currency} {Number(totalSubmittedValue).toLocaleString('en-US', { minimumFractionDigits: 1 })}
                </strong>
              </div>
              <div style={{
                height: '14px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
                display: 'flex',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, parseFloat(collectionRate)))}%`,
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    transition: 'width 0.6s ease'
                  }}
                  title={`Settled & Paid: ${currency} ${Number(settledClaimsValue).toFixed(1)}`}
                />
                <div
                  style={{
                    width: `${Math.min(100 - parseFloat(collectionRate), totalSubmittedValue > 0 ? (balanceAmount / totalSubmittedValue) * 100 : 0)}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                    transition: 'width 0.6s ease'
                  }}
                  title={`Pending Balance: ${currency} ${Number(balanceAmount).toFixed(1)}`}
                />
                <div
                  style={{
                    width: `${totalSubmittedValue > 0 ? (disputedFrozenValue / totalSubmittedValue) * 100 : 0}%`,
                    background: '#ef4444',
                    transition: 'width 0.6s ease'
                  }}
                  title={`Disputed Held: ${currency} ${Number(disputedFrozenValue).toFixed(1)}`}
                />
              </div>
            </div>

            {/* 3-Way Financial Cards Split */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--success)', fontWeight: 700, display: 'block' }}>
                  ✓ Settled / Collected
                </span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--success)', display: 'block', marginTop: '2px' }}>
                  {currency} {Number(settledClaimsValue).toFixed(1)}
                </strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{collectionRate}% of total</span>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--warning)', fontWeight: 700, display: 'block' }}>
                  ⏱️ Pending Balance
                </span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--warning)', display: 'block', marginTop: '2px' }}>
                  {currency} {Number(balanceAmount).toFixed(1)}
                </strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pending clearance</span>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--danger)', fontWeight: 700, display: 'block' }}>
                  ⚠️ Frozen / Disputed
                </span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--danger)', display: 'block', marginTop: '2px' }}>
                  {currency} {Number(disputedFrozenValue).toFixed(1)}
                </strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{disputesCount} held claims</span>
              </div>
            </div>

            {/* Operational Settlement & Retention Gate Volume Counts */}
            <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Operational Claims & Gate Volume Counts
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                  {filteredClaims.length} Claims Total
                </span>
              </div>

              {/* 6 Informational Count Metric Blocks in 3x2 Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                {/* Block 1: Settled Claims Count */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.22)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.69rem', textTransform: 'uppercase', color: 'var(--success)', fontWeight: 700 }}>
                      ✓ Settled Claims
                    </span>
                    <span style={{ fontSize: '0.8rem' }}>✅</span>
                  </div>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--success)', display: 'block', lineHeight: 1.2 }}>
                    {settledClaimsCount}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Fully paid & cleared
                  </span>
                </div>

                {/* Block 2: In-Process Claims Count */}
                <div style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.22)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.69rem', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 700 }}>
                      📋 In-Process
                    </span>
                    <span style={{ fontSize: '0.8rem' }}>⏳</span>
                  </div>
                  <strong style={{ fontSize: '1.25rem', color: '#3b82f6', display: 'block', lineHeight: 1.2 }}>
                    {pendingClaimsCount}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Pending payout
                  </span>
                </div>

                {/* Block 3: Disputes Count */}
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.22)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.69rem', textTransform: 'uppercase', color: 'var(--danger)', fontWeight: 700 }}>
                      ⚠️ On Hold
                    </span>
                    <span style={{ fontSize: '0.8rem' }}>🛑</span>
                  </div>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--danger)', display: 'block', lineHeight: 1.2 }}>
                    {disputesCount}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Disputed claims
                  </span>
                </div>

                {/* Block 4: Due Claims Count */}
                <div style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.22)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.69rem', textTransform: 'uppercase', color: 'var(--warning)', fontWeight: 700 }}>
                      ⏱️ Due Claims
                    </span>
                    <span style={{ fontSize: '0.8rem' }}>📌</span>
                  </div>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--warning)', display: 'block', lineHeight: 1.2 }}>
                    {dueUnclaimedCount}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Ready for claim filing
                  </span>
                </div>

                {/* Block 5: Overdue Backlog Count */}
                <div style={{
                  background: 'rgba(220, 38, 38, 0.06)',
                  border: '1px solid rgba(220, 38, 38, 0.22)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.69rem', textTransform: 'uppercase', color: 'var(--danger)', fontWeight: 700 }}>
                      🚨 Overdue
                    </span>
                    <span style={{ fontSize: '0.8rem' }}>⚡</span>
                  </div>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--danger)', display: 'block', lineHeight: 1.2 }}>
                    {overdueUnclaimedCount}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Past SLA window
                  </span>
                </div>

                {/* Block 6: Upcoming Scheduled Gates Count */}
                <div style={{
                  background: 'rgba(139, 92, 246, 0.06)',
                  border: '1px solid rgba(139, 92, 246, 0.22)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.69rem', textTransform: 'uppercase', color: '#8b5cf6', fontWeight: 700 }}>
                      🎯 Upcoming Gates
                    </span>
                    <span style={{ fontSize: '0.8rem' }}>🗓️</span>
                  </div>
                  <strong style={{ fontSize: '1.25rem', color: '#8b5cf6', display: 'block', lineHeight: 1.2 }}>
                    {upcomingMilestonesCount}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Maturing on schedule
                  </span>
                </div>
              </div>

              {/* Tamkeen Retention Gates Distribution Banner */}
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                  🏛️ Gates Monitored:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <span>Day 0: <strong style={{ color: 'var(--primary)' }}>{retentionGateCounts.day0}</strong></span>
                  <span style={{ color: 'var(--border-medium)' }}>&bull;</span>
                  <span>Day 180: <strong style={{ color: '#8b5cf6' }}>{retentionGateCounts.day180}</strong></span>
                  <span style={{ color: 'var(--border-medium)' }}>&bull;</span>
                  <span>Day 365: <strong style={{ color: 'var(--success)' }}>{retentionGateCounts.day365}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* GRAPH 4: CASE MANAGER BENCHMARK OR RETENTION FUNNEL                */}
        {/* ------------------------------------------------------------------ */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div>
              <div className="dash-chart-title">
                <span>{selectedCM === 'all' ? '👥' : '🎯'}</span>
                <span>
                  {selectedCM === 'all'
                    ? 'Case Manager Comparative Benchmark'
                    : `Retention Gate Conversion (${selectedCM})`
                  }
                </span>
              </div>
              <div className="dash-chart-subtitle">
                {selectedCM === 'all'
                  ? 'Comparative volume, collections, and action items by case manager'
                  : 'Stage-by-stage conversion from Day 0 placement to 365-day retention'
                }
              </div>
            </div>
            {selectedCM !== 'all' && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedCM('all')}
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
              >
                Back to Consolidated
              </button>
            )}
          </div>

          {selectedCM === 'all' ? (
            /* Consolidated Case Manager Leaderboard */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {caseManagerComparison.map(cm => {
                const maxPlaced = Math.max(1, ...caseManagerComparison.map(c => c.placed));
                const pct = (cm.placed / maxPlaced) * 100;

                return (
                  <div
                    key={cm.name}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.65rem 0.85rem',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                    onClick={() => setSelectedCM(cm.name)}
                    title={`Click to filter dashboard for ${cm.name}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        👤 {cm.name}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                        <span>Placed: <strong>{cm.placed}</strong></span>
                        <span>Claims: <strong>{cm.claims}</strong></span>
                        <span style={{ color: 'var(--success)' }}>{currency} {Number(cm.settled).toFixed(0)}</span>
                        {cm.actions > 0 ? (
                          <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            ⚡ {cm.actions} Action Req
                          </span>
                        ) : (
                          <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>✓ Clean</span>
                        )}
                      </div>
                    </div>
                    {/* Performance Progress Track */}
                    <div style={{ height: '6px', background: 'var(--border-medium)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #3b82f6)', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                );
              })}
              {caseManagerComparison.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No case managers found.</div>
              )}
            </div>
          ) : (
            /* Specific Case Manager Retention Funnel */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {gateFunnelBreakdown.map((gate, i) => (
                <div
                  key={gate.key}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 800 }}>Gate {i + 1}</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{gate.label}</strong>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                      {gate.completionRate}% Claimed/Settled
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.75rem' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Total</span>
                      <strong>{gate.total}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ color: 'var(--success)', display: 'block', fontSize: '0.68rem' }}>Settled</span>
                      <strong style={{ color: 'var(--success)' }}>{gate.settled}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ color: 'var(--primary)', display: 'block', fontSize: '0.68rem' }}>Claimed</span>
                      <strong>{gate.claimed}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ color: 'var(--warning)', display: 'block', fontSize: '0.68rem' }}>Due</span>
                      <strong style={{ color: 'var(--warning)' }}>{gate.due}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ color: 'var(--danger)', display: 'block', fontSize: '0.68rem' }}>Overdue</span>
                      <strong style={{ color: 'var(--danger)' }}>{gate.overdue}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* GRAPH 5: TOP EMPLOYERS & ENTERPRISE CONCENTRATION                  */}
        {/* ------------------------------------------------------------------ */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div>
              <div className="dash-chart-title">
                <span>🏢</span>
                <span>Top Employers & Placement Concentration</span>
              </div>
              <div className="dash-chart-subtitle">
                Corporate partner hiring volume, claims activity, and retention performance ({selectedCM === 'all' ? 'All Enterprises' : selectedCM})
              </div>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '0.74rem' }}>
              {topEmployers.length} Key Partners
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {topEmployers.map((emp, idx) => {
              const maxPlacements = Math.max(1, ...topEmployers.map(e => e.placements));
              const pct = (emp.placements / maxPlacements) * 100;

              return (
                <div
                  key={emp.name}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 0.95rem',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800
                      }}>
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{emp.name}</strong>
                      {emp.cr && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                          {emp.cr}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.76rem' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                        🎯 {emp.placements} Placed
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        📋 {emp.claimsCount} Claims
                      </span>
                      <strong style={{ color: 'var(--success)' }}>
                        {currency} {Number(emp.settledAmount).toFixed(1)}
                      </strong>
                      {emp.disputesCount > 0 ? (
                        <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                          ⚠️ {emp.disputesCount} Dispute
                        </span>
                      ) : (
                        <span style={{ color: 'var(--success)', fontSize: '0.72rem', fontWeight: 600 }}>
                          ✓ 100% Retained
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Employer Relative Share Bar */}
                  <div style={{ height: '5px', background: 'var(--border-medium)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                        borderRadius: '3px'
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {topEmployers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No employer placement data available for current filter selection.
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* GRAPH 6: MILESTONE DUE HORIZON & CASHFLOW FORECAST                 */}
        {/* ------------------------------------------------------------------ */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <div>
              <div className="dash-chart-title">
                <span>📅</span>
                <span>Retention Due Horizon & Cashflow Maturation Forecast</span>
              </div>
              <div className="dash-chart-subtitle">
                Forward-looking timeline of upcoming claims and projected subsidy cashflow
              </div>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--primary)', fontWeight: 700 }}>
              Forecast: {currency} {Number(maturationHorizon.reduce((s, h) => s + h.amount, 0)).toLocaleString('en-US', { minimumFractionDigits: 1 })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {maturationHorizon.map(item => {
              const maxAmt = Math.max(1, ...maturationHorizon.map(h => h.amount));
              const pct = (item.amount / maxAmt) * 100;

              return (
                <div
                  key={item.key}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 0.95rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color }}></span>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{item.label}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({item.range})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.count} Milestone{item.count !== 1 ? 's' : ''}
                      </span>
                      <strong style={{ color: item.color, fontFamily: 'var(--font-mono)' }}>
                        {currency} {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </strong>
                    </div>
                  </div>

                  {/* Horizon Timeline Bar */}
                  <div style={{ height: '6px', background: 'var(--border-medium)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: item.color,
                        borderRadius: '3px',
                        transition: 'width 0.5s ease'
                      }}
                    />
                  </div>

                  <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                    {item.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}

window.DashboardView = DashboardView;
