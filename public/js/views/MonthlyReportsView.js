/**
 * Monthly Reports View - Dedicated Page for:
 * 1. Outstanding Due Active Claims (Candidate-wise by Candidate Ref No.)
 * 2. Claims Claimed for the Month (with Case Manager filter & point-in-time status)
 */

function MonthlyReportsView({ state }) {
  const { useState, useEffect, useMemo } = React;
  const { settings = {}, candidates = [], payments = [], caseManagers = [], users = [] } = state;
  const currency = settings.currency || 'BHD';
  const SearchableSelect = window.SearchableSelect;

  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const defaultMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const defaultMonthStart = `${defaultMonth}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const defaultMonthEnd = `${defaultMonth}-${pad2(lastDay)}`;

  // Active Report Tab: 'outstanding' | 'monthly_claims'
  const [activeReport, setActiveReport] = useState('outstanding');

  // Shared Period Filters (Month & Year or From/To Date)
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [dateFrom, setDateFrom] = useState(defaultMonthStart);
  const [dateTo, setDateTo] = useState(defaultMonthEnd);

  // Report 1 Filter: Candidate (default All)
  const [selectedCandidate, setSelectedCandidate] = useState('');

  // Report 2 Filter: Case Manager (default All)
  const [selectedCaseManager, setSelectedCaseManager] = useState('all');

  const [loading, setLoading] = useState(false);
  const [outstandingClaimsRaw, setOutstandingClaimsRaw] = useState([]);
  const [monthlyClaimsRaw, setMonthlyClaimsRaw] = useState([]);

  const handleMonthChange = (ym) => {
    setSelectedMonth(ym);
    if (!ym) return;
    const [yStr, mStr] = ym.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (!y || !m) return;
    const endDay = new Date(y, m, 0).getDate();
    setDateFrom(`${ym}-01`);
    setDateTo(`${ym}-${pad2(endDay)}`);
  };

  const handleResetFilters = () => {
    setSelectedMonth(defaultMonth);
    setDateFrom(defaultMonthStart);
    setDateTo(defaultMonthEnd);
    setSelectedCandidate('');
    setSelectedCaseManager('all');
  };

  // Candidate lookup & SearchableSelect options (Report 1)
  const candidateLookup = useMemo(() => {
    const map = new Map();
    (candidates || []).forEach(c => {
      if (c && c.id) map.set(String(c.id), c);
    });
    return map;
  }, [candidates]);

  const candidateOptions = useMemo(() => {
    const map = new Map();
    (candidates || []).forEach(c => {
      if (c && c.id) {
        map.set(String(c.id), {
          value: String(c.id),
          label: `${c.ref_no || `CR-${c.id}`} — ${c.full_name}`,
          subLabel: `CPR: ${c.cpr_no || 'N/A'} • ${c.company_name || 'Employer'}`,
          searchKeywords: `${c.ref_no || ''} ${c.full_name || ''} ${c.cpr_no || ''} ${c.company_name || ''} ${c.employer_cr || ''}`
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Candidates (${list.length})`, subLabel: 'Show outstanding due across all candidates' }, ...list];
  }, [candidates]);

  // Case Manager options (Report 2)
  const caseManagerOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    (caseManagers || []).forEach(cm => {
      const name = cm.full_name || cm.username;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({
          value: name,
          label: name,
          subLabel: cm.case_manager_code || 'Case Manager',
          searchKeywords: `${name} ${cm.case_manager_code || ''}`
        });
      }
    });
    (users || []).filter(u => u.role === 'case_manager').forEach(u => {
      const name = u.full_name || u.username;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({
          value: name,
          label: name,
          subLabel: u.case_manager_code || 'Case Manager',
          searchKeywords: `${name} ${u.case_manager_code || ''}`
        });
      }
    });
    list.sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: 'all', label: `All Case Managers (${list.length})`, subLabel: 'Show claims across all case managers' }, ...list];
  }, [caseManagers, users]);

  // Fetch point-in-time data whenever period or case manager changes
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [outRes, monthlyRes] = await Promise.all([
          window.api.reports.generate('outstanding_balance', {
            date_from: dateFrom || '',
            date_to: dateTo || ''
          }),
          window.api.reports.generate('claim_ledger', {
            case_manager: selectedCaseManager !== 'all' ? selectedCaseManager : '',
            date_from: dateFrom || '',
            date_to: dateTo || ''
          })
        ]);
        if (!mounted) return;
        setOutstandingClaimsRaw(Array.isArray(outRes?.data) ? outRes.data : []);
        setMonthlyClaimsRaw(Array.isArray(monthlyRes?.data) ? monthlyRes.data : []);
      } catch (err) {
        if (mounted) {
          window.AppStore.showNotification('Failed to load monthly reports: ' + err.message, 'error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [dateFrom, dateTo, selectedCaseManager]);

  // Collection Ledger payments summed per candidate up to dateTo (and from dateFrom if needed)
  const collectionPaidByCandidate = useMemo(() => {
    const paidMap = {};
    (payments || []).forEach(p => {
      const pDate = String(p.payment_date || p.created_at || '').split('T')[0].split(' ')[0];
      if (dateTo && (!pDate || pDate > dateTo)) return;
      const amt = Number(p.amount_paid_bhd || 0);
      if (p.candidate_id) {
        const key = String(p.candidate_id);
        paidMap[key] = (paidMap[key] || 0) + amt;
      } else if (p.candidate_ref && p.candidate_ref !== 'N/A') {
        const key = String(p.candidate_ref);
        paidMap[key] = (paidMap[key] || 0) + amt;
      }
    });
    return paidMap;
  }, [payments, dateTo]);

  // Report 1: Group Active Outstanding Claims by Candidate Reference Number
  const outstandingByCandidate = useMemo(() => {
    const filtered = selectedCandidate
      ? outstandingClaimsRaw.filter(cl => String(cl.candidate_id) === String(selectedCandidate))
      : outstandingClaimsRaw;

    const map = new Map();
    filtered.forEach(cl => {
      const cid = String(cl.candidate_id || cl.candidate_ref || cl.id);
      const cand = cl.candidate_id ? candidateLookup.get(String(cl.candidate_id)) : null;
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          candidate_id: cl.candidate_id,
          candidate_ref: cl.candidate_ref || cand?.ref_no || (cl.candidate_id ? `CR-${cl.candidate_id}` : 'N/A'),
          candidate_name: cl.candidate_name || cand?.full_name || 'N/A',
          candidate_cpr: cl.candidate_cpr || cand?.cpr_no || 'N/A',
          company_name: cl.company_name || cand?.company_name || 'N/A',
          employer_cr: cl.employer_cr || cand?.employer_cr || '',
          case_manager_name: cl.case_manager_name || cand?.case_manager_name || 'System',
          active_claims_count: 0,
          total_claimed_bhd: 0,
          total_paid_bhd: 0,
          outstanding_bhd: 0,
          claims_list: []
        });
      }
      const entry = map.get(cid);
      entry.active_claims_count += 1;
      entry.total_claimed_bhd += Number(cl.claim_amount_bhd || 0);
      entry.claims_list.push(cl);
    });

    return Array.from(map.values())
      .map(row => {
        const candKey = row.candidate_id ? String(row.candidate_id) : String(row.candidate_ref || '');
        const paidFromLedger = Number((collectionPaidByCandidate[candKey] || 0).toFixed(3));
        const totalClaimed = Number(row.total_claimed_bhd.toFixed(3));
        const outstanding = Math.max(0, Number((totalClaimed - paidFromLedger).toFixed(3)));
        return {
          ...row,
          total_claimed_bhd: totalClaimed,
          total_paid_bhd: paidFromLedger,
          outstanding_bhd: outstanding,
          claims_summary_text: row.claims_list
            .map(c => `${c.claim_ref} (${c.milestone_title || c.claim_type}): ${currency} ${Number(c.claim_amount_bhd || 0).toFixed(3)}`)
            .join(' | ')
        };
      })
      .filter(row => row.outstanding_bhd > 0.001)
      .sort((a, b) => b.outstanding_bhd - a.outstanding_bhd);
  }, [outstandingClaimsRaw, selectedCandidate, candidateLookup, collectionPaidByCandidate, currency]);

  const outstandingTotals = useMemo(() => {
    return outstandingByCandidate.reduce(
      (acc, r) => ({
        candidates: acc.candidates + 1,
        claims: acc.claims + r.active_claims_count,
        claimed: acc.claimed + r.total_claimed_bhd,
        paid: acc.paid + r.total_paid_bhd,
        outstanding: acc.outstanding + r.outstanding_bhd
      }),
      { candidates: 0, claims: 0, claimed: 0, paid: 0, outstanding: 0 }
    );
  }, [outstandingByCandidate]);

  // Report 2: Claims Claimed for the Month (with point-in-time status)
  const monthlyClaimsData = useMemo(() => {
    return monthlyClaimsRaw.map(cl => {
      const cand = cl.candidate_id ? candidateLookup.get(String(cl.candidate_id)) : null;
      return {
        ...cl,
        candidate_ref: cl.candidate_ref || cand?.ref_no || (cl.candidate_id ? `CR-${cl.candidate_id}` : 'N/A'),
        candidate_name: cl.candidate_name || cand?.full_name || 'N/A',
        company_name: cl.company_name || cand?.company_name || 'N/A'
      };
    });
  }, [monthlyClaimsRaw, candidateLookup]);

  const monthlyTotals = useMemo(() => {
    return monthlyClaimsData.reduce(
      (acc, cl) => {
        const st = String(cl.status || '').toLowerCase();
        return {
          count: acc.count + 1,
          approved: acc.approved + Number(cl.claim_amount_bhd || 0),
          paid: acc.paid + Number(cl.total_paid_bhd || 0),
          balance: acc.balance + (st === 'disputed' || st === 'terminated' ? 0 : Number(cl.balance_bhd || 0)),
          disputedCount: acc.disputedCount + (st === 'disputed' ? 1 : 0)
        };
      },
      { count: 0, approved: 0, paid: 0, balance: 0, disputedCount: 0 }
    );
  }, [monthlyClaimsData]);

  // Columns for Report 1: Outstanding Due Active Claims
  const outstandingColumns = [
    {
      key: 'candidate_ref',
      label: 'Candidate Ref No.',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)', fontSize: '0.88rem' }}>
            {val}
          </span>
          <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{row.candidate_name}</strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CPR: {row.candidate_cpr}</span>
        </div>
      )
    },
    {
      key: 'company_name',
      label: 'Employer / Placement',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong style={{ fontSize: '0.84rem' }}>{val}</strong>
          {row.employer_cr && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              CR: {row.employer_cr}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => <span className="badge badge-neutral">{val || 'System'}</span>
    },
    {
      key: 'active_claims_count',
      label: 'Active Claims',
      sortable: true,
      render: (val) => <span className="badge badge-info">{val}</span>
    },
    {
      key: 'total_claimed_bhd',
      label: `Active Claimed (${currency})`,
      sortable: true,
      render: (val) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{Number(val || 0).toFixed(3)}</span>
    },
    {
      key: 'total_paid_bhd',
      label: `Paid As Of Period (${currency})`,
      sortable: true,
      render: (val) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--success)' }}>{Number(val || 0).toFixed(3)}</span>
    },
    {
      key: 'outstanding_bhd',
      label: `Outstanding Due (${currency})`,
      sortable: true,
      render: (val) => (
        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.94rem', color: 'var(--danger)' }}>
          {currency} {Number(val || 0).toFixed(3)}
        </strong>
      )
    },
    {
      key: 'claims_summary_text',
      label: 'Active Claim Breakdown',
      sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '280px' }}>
          {(row.claims_list || []).map(c => (
            <div key={c.id} style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              <strong>{c.claim_ref}</strong> ({c.milestone_title || c.claim_type}): <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{currency} {Number(c.balance_bhd || 0).toFixed(3)}</span>
            </div>
          ))}
        </div>
      )
    }
  ];

  // Columns for Report 2: Claims Claimed for the Month
  const monthlyColumns = [
    {
      key: 'claim_ref',
      label: 'Claim Ref',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{val}</strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {row.candidate_ref}
          </span>
        </div>
      )
    },
    {
      key: 'candidate_name',
      label: 'Candidate & Employer',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong>{val}</strong>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{row.company_name}</div>
        </div>
      )
    },
    {
      key: 'milestone_title',
      label: 'Milestone Gate',
      sortable: true,
      render: (val, row) => (
        <span className={`badge ${row.claim_type === 'additional' ? 'badge-primary' : 'badge-info'}`}>
          {row.claim_type === 'additional' ? '✨ Additional Gate' : (val || row.claim_type)}
        </span>
      )
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => <span className="badge badge-neutral">{val || 'System'}</span>
    },
    {
      key: 'claim_amount_bhd',
      label: `Approved (${currency})`,
      sortable: true,
      render: (val) => <strong style={{ fontFamily: 'var(--font-mono)' }}>{Number(val || 0).toFixed(3)}</strong>
    },
    {
      key: 'total_paid_bhd',
      label: `Paid (${currency})`,
      sortable: true,
      render: (val) => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 600 }}>{Number(val || 0).toFixed(3)}</span>
    },
    {
      key: 'balance_bhd',
      label: `Balance (${currency})`,
      sortable: true,
      render: (val, row) => {
        const st = String(row.status || '').toLowerCase();
        return (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: (st === 'disputed' || st === 'terminated') ? 'var(--text-muted)' : (Number(val) > 0.0001 ? 'var(--danger)' : 'var(--success)') }}>
            {(st === 'disputed' || st === 'terminated') ? '—' : Number(val || 0).toFixed(3)}
          </span>
        );
      }
    },
    {
      key: 'claim_date',
      label: 'Claim Date',
      sortable: true,
      render: (val, row) => window.formatAppDate(val || row.submission_date || row.created_at)
    },
    {
      key: 'status',
      label: 'Period Status',
      sortable: true,
      render: (val) => {
        const st = String(val || '').toLowerCase();
        const badgeCls = st === 'disputed' ? 'badge-danger' : (st === 'settled' ? 'badge-success' : (st === 'terminated' ? 'badge-neutral' : 'badge-warning'));
        const label = st === 'disputed' ? '⚠️ Disputed' : (st === 'settled' ? '✓ Settled' : (st === 'terminated' ? '⛔ Terminated' : 'Unsettled'));
        return <span className={`badge ${badgeCls}`}>{label}</span>;
      }
    }
  ];

  const handleExportExcel = () => {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const periodLabel = `${dateFrom || 'Start'} to ${dateTo || 'Latest'}`;
    let title = '';
    let headers = [];
    let rowsHtml = '';

    if (activeReport === 'outstanding') {
      if (outstandingByCandidate.length === 0) {
        window.AppStore.showNotification('No outstanding active claims to export', 'warning');
        return;
      }
      title = `Outstanding Due Active Claims (${periodLabel})`;
      headers = ['Candidate Ref', 'Candidate Name', 'CPR', 'Employer', 'Employer CR', 'Case Manager', 'Active Claims', `Active Claimed (${currency})`, `Paid (${currency})`, `Outstanding Due (${currency})`, 'Breakdown'];
      rowsHtml = outstandingByCandidate.map(r => `
        <tr>
          <td>${esc(r.candidate_ref)}</td>
          <td>${esc(r.candidate_name)}</td>
          <td>${esc(r.candidate_cpr)}</td>
          <td>${esc(r.company_name)}</td>
          <td>${esc(r.employer_cr)}</td>
          <td>${esc(r.case_manager_name)}</td>
          <td>${r.active_claims_count}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${r.total_claimed_bhd.toFixed(3)}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${r.total_paid_bhd.toFixed(3)}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${r.outstanding_bhd.toFixed(3)}</td>
          <td>${esc(r.claims_summary_text)}</td>
        </tr>
      `).join('') + `
        <tr style="background:#f1f5f9;font-weight:bold;">
          <td colspan="7" style="text-align:right;">TOTAL:</td>
          <td style="text-align:right;mso-number-format:'0.000';">${outstandingTotals.claimed.toFixed(3)}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${outstandingTotals.paid.toFixed(3)}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${outstandingTotals.outstanding.toFixed(3)}</td>
          <td></td>
        </tr>
      `;
    } else {
      if (monthlyClaimsData.length === 0) {
        window.AppStore.showNotification('No claims found for this period to export', 'warning');
        return;
      }
      title = `Claims Claimed for Period (${periodLabel})`;
      headers = ['Claim Ref', 'Candidate Ref', 'Candidate Name', 'Employer', 'Milestone Gate', 'Case Manager', `Approved (${currency})`, `Paid (${currency})`, `Balance (${currency})`, 'Claim Date', 'Period Status'];
      rowsHtml = monthlyClaimsData.map(cl => `
        <tr>
          <td>${esc(cl.claim_ref)}</td>
          <td>${esc(cl.candidate_ref)}</td>
          <td>${esc(cl.candidate_name)}</td>
          <td>${esc(cl.company_name)}</td>
          <td>${esc(cl.claim_type === 'additional' ? 'Additional Gate' : (cl.milestone_title || cl.claim_type))}</td>
          <td>${esc(cl.case_manager_name)}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${Number(cl.claim_amount_bhd || 0).toFixed(3)}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${Number(cl.total_paid_bhd || 0).toFixed(3)}</td>
          <td style="text-align:right;mso-number-format:'0.000';">${Number(cl.balance_bhd || 0).toFixed(3)}</td>
          <td>${esc(cl.claim_date || cl.submission_date)}</td>
          <td>${esc(cl.status)}</td>
        </tr>
      `).join('');
    }

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /></head>
      <body>
        <h3>${esc(title)}</h3>
        <table border="1" cellspacing="0" cellpadding="4">
          <thead><tr style="background:#e2e8f0;font-weight:bold;">${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeReport === 'outstanding' ? 'Outstanding_Active_Claims' : 'Monthly_Claims_Report'}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Monthly Claims &amp; Outstanding Due Reports</h1>
          <p className="page-subtitle">
            Point-in-time historical monthly reporting for Active Outstanding Claims (Candidate-wise) and Monthly Claims Status
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={handleExportExcel}>
            📥 Export Excel
          </button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            🖨️ Print / PDF
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${activeReport === 'outstanding' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontWeight: 700, fontSize: '0.85rem' }}
          onClick={() => setActiveReport('outstanding')}
        >
          1️⃣ Outstanding Due Active Claims (Candidate-Wise)
        </button>
        <button
          type="button"
          className={`btn ${activeReport === 'monthly_claims' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontWeight: 700, fontSize: '0.85rem' }}
          onClick={() => setActiveReport('monthly_claims')}
        >
          2️⃣ Claims Claimed for the Month
        </button>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '1.25rem', overflow: 'visible', position: 'relative', zIndex: 20 }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.9rem', alignItems: 'flex-end' }}>
          {/* Month & Year Picker */}
          <div style={{ minWidth: '165px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
              📅 Month &amp; Year:
            </label>
            <input
              type="month"
              className="input-control"
              value={selectedMonth}
              onChange={e => handleMonthChange(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
            />
          </div>

          {/* Date From */}
          <div style={{ minWidth: '145px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
              From Date:
            </label>
            <input
              type="date"
              className="input-control"
              value={dateFrom}
              onChange={e => { setSelectedMonth(''); setDateFrom(e.target.value); }}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
            />
          </div>

          {/* Date To */}
          <div style={{ minWidth: '145px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
              To Date:
            </label>
            <input
              type="date"
              className="input-control"
              value={dateTo}
              onChange={e => { setSelectedMonth(''); setDateTo(e.target.value); }}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
            />
          </div>

          {/* Report-Specific Searchable Dropdown */}
          {activeReport === 'outstanding' ? (
            <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
                👤 Filter by Candidate (Ref No. / Name):
              </label>
              {SearchableSelect ? (
                <SearchableSelect
                  options={candidateOptions}
                  value={selectedCandidate}
                  onChange={val => setSelectedCandidate(val)}
                  placeholder={candidateOptions[0]?.label || 'All Candidates'}
                  searchPlaceholder="Search Candidate Ref (CR-...), Name, CPR..."
                />
              ) : (
                <select className="select-control" value={selectedCandidate} onChange={e => setSelectedCandidate(e.target.value)}>
                  {candidateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          ) : (
            <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
                🧑‍💼 Filter by Case Manager:
              </label>
              {SearchableSelect ? (
                <SearchableSelect
                  options={caseManagerOptions}
                  value={selectedCaseManager}
                  onChange={val => setSelectedCaseManager(val)}
                  placeholder="All Case Managers"
                  searchPlaceholder="Search Case Manager..."
                />
              ) : (
                <select className="select-control" value={selectedCaseManager} onChange={e => setSelectedCaseManager(e.target.value)}>
                  {caseManagerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          )}

          <button type="button" className="btn btn-outline btn-sm" onClick={handleResetFilters} style={{ padding: '0.42rem 0.85rem' }}>
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      {activeReport === 'outstanding' ? (
        <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span>Candidates with Due: <strong>{outstandingTotals.candidates}</strong></span>
            <span>Active Unpaid Claims: <strong>{outstandingTotals.claims}</strong></span>
            <span>Active Claimed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{currency} {outstandingTotals.claimed.toFixed(3)}</strong></span>
            <span>Paid (Up to {dateTo || 'Latest'}): <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{currency} {outstandingTotals.paid.toFixed(3)}</strong></span>
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
            Total Outstanding Due: {currency} {outstandingTotals.outstanding.toFixed(3)}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span>Total Claims in Period: <strong>{monthlyTotals.count}</strong></span>
            <span>Disputed in Period: <strong style={{ color: 'var(--danger)' }}>{monthlyTotals.disputedCount}</strong></span>
            <span>Approved Total: <strong style={{ fontFamily: 'var(--font-mono)' }}>{currency} {monthlyTotals.approved.toFixed(3)}</strong></span>
            <span>Paid (Up to {dateTo || 'Latest'}): <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{currency} {monthlyTotals.paid.toFixed(3)}</strong></span>
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
            Active Period Balance: {currency} {monthlyTotals.balance.toFixed(3)}
          </div>
        </div>
      )}

      {/* DataTable */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--primary)', fontWeight: 700 }}>
            ⏳ Generating point-in-time report...
          </div>
        ) : activeReport === 'outstanding' ? (
          <window.DataTable
            columns={outstandingColumns}
            data={outstandingByCandidate}
            searchPlaceholder="🔍 Search Candidate Ref, Name, CPR, Employer, Case Manager..."
            searchKeys={['candidate_ref', 'candidate_name', 'candidate_cpr', 'company_name', 'employer_cr', 'case_manager_name', 'claims_summary_text']}
            exportFilename="Outstanding_Due_Active_Claims.csv"
            emptyMessage="No active outstanding claims found for the selected period."
          />
        ) : (
          <window.DataTable
            columns={monthlyColumns}
            data={monthlyClaimsData}
            searchPlaceholder="🔍 Search Claim Ref, Candidate Ref, Name, Employer, Milestone, Case Manager, Status..."
            searchKeys={['claim_ref', 'candidate_ref', 'candidate_name', 'company_name', 'milestone_title', 'claim_type', 'case_manager_name', 'status']}
            exportFilename="Claims_Claimed_For_Month.csv"
            emptyMessage="No claims found for the selected period."
          />
        )}
      </div>
    </div>
  );
}

window.MonthlyReportsView = MonthlyReportsView;

