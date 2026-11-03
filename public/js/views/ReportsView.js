/**
 * Reports View - Enterprise Analytical & Case Managers Audit Log Reports
 */

const { useState, useEffect, useMemo } = React;

function ReportsView({ state }) {
  const [reportType, setReportType] = useState('case_manager_audit_log');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCaseManager, setSelectedCaseManager] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { settings = {}, currentUser = {}, caseManagers = [], users = [] } = state;
  const currency = settings.currency || 'BHD';

  // Build list of unique Case Managers
  const cmList = useMemo(() => {
    const list = [];
    const seen = new Set();
    (caseManagers || []).forEach(cm => {
      const name = cm.full_name || cm.username;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({ id: cm.id, name, code: cm.case_manager_code || 'CM' });
      }
    });
    (users || []).filter(u => u.role === 'case_manager').forEach(u => {
      const name = u.full_name || u.username;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({ id: u.id, name, code: u.case_manager_code || 'CM' });
      }
    });
    return list;
  }, [caseManagers, users]);

  const reportOptions = [
    { id: 'case_manager_audit_log', title: '📋 Case Managers Audit Log Report (Who, When & All Activities)' },
    { id: 'candidate_placement', title: '1. Candidate Placement Master Report' },
    { id: 'claim_milestones', title: '2. Claim Milestones (+0d, +180d, +365d) Retention Gates' },
    { id: 'unclaimed_milestones', title: '3. Unclaimed Milestones Overdue Report' },
    { id: 'claim_ledger', title: '4. Claim Ledger & Aging Report' },
    { id: 'categorized_disputes', title: '5. Categorized Disputes & Terminations Analysis' },
    { id: 'financial_collections', title: '6. Financial Collections Ledger & Receipts' },
    { id: 'case_manager_performance', title: '7. Case Manager Performance & Allocation Audit' },
    { id: 'termination_audit', title: '8. Termination & Reinstatement Audit' },
    { id: 'employer_retention', title: '9. Employer Retention League & Placement Density' },
    { id: 'executive_kpis', title: '10. Executive KPI Summary Report' }
  ];

  const loadReport = async (type = reportType) => {
    setLoading(true);
    try {
      const params = {
        case_manager: selectedCaseManager !== 'all' ? selectedCaseManager : '',
        date_from: dateFrom || '',
        date_to: dateTo || ''
      };
      const res = await window.api.reports.generate(type, params);
      setReportData(res);
    } catch (err) {
      window.AppStore.showNotification('Failed to generate report: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(reportType);
  }, [reportType, selectedCaseManager, dateFrom, dateTo]);

  const handleResetFilters = () => {
    setSelectedCaseManager('all');
    setDateFrom('');
    setDateTo('');
  };

  const handlePrint = () => {
    window.print();
  };

  // Export current report dataset to Excel-ready CSV
  const handleExportCSV = () => {
    if (!reportData?.data || reportData.data.length === 0) {
      window.AppStore.showNotification('No data to export', 'warning');
      return;
    }

    let headers = [];
    let rows = [];

    if (reportType === 'case_manager_audit_log') {
      headers = ['ID', 'Date & Time', 'Case Manager / User', 'Role', 'Action', 'Category', 'Entity Reference', 'Audit Details', 'IP Address'];
      rows = reportData.data.map(r => [
        r.id,
        `"${r.created_at || ''}"`,
        `"${(r.user_full_name || r.username || '').replace(/"/g, '""')}"`,
        `"${r.role || ''}"`,
        `"${r.action || ''}"`,
        `"${r.category || ''}"`,
        `"${(r.entity_ref || '').replace(/"/g, '""')}"`,
        `"${(r.details || '').replace(/"/g, '""')}"`,
        `"${r.ip_address || ''}"`
      ]);
    } else {
      // General dynamic export
      const sample = reportData.data[0];
      headers = Object.keys(sample).filter(k => typeof sample[k] !== 'object');
      rows = reportData.data.map(item => headers.map(h => `"${String(item[h] ?? '').replace(/"/g, '""')}"`));
    }

    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Audit summary metrics (for case_manager_audit_log)
  const auditStats = useMemo(() => {
    if (reportType !== 'case_manager_audit_log' || !reportData?.data) return null;
    let placements = 0;
    let claims = 0;
    let payments = 0;
    let registrations = 0;
    reportData.data.forEach(r => {
      const cat = (r.category || '').toLowerCase();
      const act = (r.action || '').toUpperCase();
      if (cat === 'placement' || act.includes('PLACE')) placements++;
      if (cat === 'claim' || act.includes('CLAIM')) claims++;
      if (cat === 'payment' || act.includes('PAY')) payments++;
      if (cat === 'registration' || act.includes('REG')) registrations++;
    });
    return { total: reportData.data.length, placements, claims, payments, registrations };
  }, [reportType, reportData]);

  const getActionBadge = (action, category) => {
    const act = (action || '').toUpperCase();
    const cat = (category || '').toLowerCase();
    if (act.includes('REG') || cat === 'registration') {
      return { bg: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', label: 'Candidate Registered' };
    }
    if (act.includes('PLACE') || cat === 'placement') {
      return { bg: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', label: act.includes('BATCH') ? 'Batch Placement' : 'Placement Contract' };
    }
    if (act.includes('CLAIM') || cat === 'claim') {
      return { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', label: 'Claim Filed' };
    }
    if (act.includes('PAY') || cat === 'payment') {
      return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', label: 'Payment Recorded' };
    }
    if (act.includes('RENEW') || cat === 'renewal') {
      return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', label: 'Registration Renewed' };
    }
    if (act.includes('DOC') || cat === 'document') {
      return { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748b', label: 'Document Uploaded' };
    }
    if (act.includes('DISP') || cat === 'dispute') {
      return { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', label: 'Dispute Logged' };
    }
    return { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748b', label: action || 'Audit Event' };
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📊</span> Enterprise Reports & Audit Center
          </h1>
          <p className="page-subtitle">
            Regulatory, financial, and case manager operational audit trail reports compliant with Ministry and Tamkeen verification
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleExportCSV}
            title="Download report data as Excel CSV file"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>📥</span> Export to Excel (CSV)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🖨️</span> Print / PDF
          </button>
        </div>
      </div>

      {/* Filter and Configuration Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'flex-end' }}>
          {/* Report Type Selector */}
          <div style={{ flex: '2', minWidth: '280px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
              Select Analytical Report:
            </label>
            <select
              className="select-control"
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              style={{ fontWeight: 700, fontSize: '0.85rem' }}
            >
              {reportOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.title}</option>
              ))}
            </select>
          </div>

          {/* Case Manager Filter */}
          <div style={{ flex: '1.2', minWidth: '180px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
              Case Manager:
            </label>
            <select
              className="select-control"
              value={selectedCaseManager}
              onChange={e => setSelectedCaseManager(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            >
              <option value="all">🌐 All Case Managers</option>
              {cmList.map(cm => (
                <option key={cm.id || cm.name} value={cm.name}>
                  👤 {cm.name} ({cm.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div style={{ minWidth: '140px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
              Date From:
            </label>
            <input
              type="date"
              className="input-control"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
            />
          </div>

          {/* Date To */}
          <div style={{ minWidth: '140px' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
              Date To:
            </label>
            <input
              type="date"
              className="input-control"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
            {(selectedCaseManager !== 'all' || dateFrom || dateTo) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleResetFilters}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                title="Reset filters back to defaults"
              >
                ✕ Reset
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => loadReport(reportType)}
              disabled={loading}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>{loading ? '⏳' : '🔄'}</span>
              <span>{loading ? 'Generating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats strip for Case Managers Audit Log */}
      {auditStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Logged Actions</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>{auditStats.total}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Candidate Registrations</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>{auditStats.registrations}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Placements Linked</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0ea5e9', marginTop: '2px' }}>{auditStats.placements}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Subsidy Claims Filed</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#8b5cf6', marginTop: '2px' }}>{auditStats.claims}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Payment Receipts</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{auditStats.payments}</div>
          </div>
        </div>
      )}

      {/* Report Results Container */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem' }}>
          <div>
            <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              {reportData?.title || 'Report Results'}
            </span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Total records: <strong>{reportData?.count ?? 0}</strong>
              {reportData?.scoped_case_manager && <span> • Case Manager: <strong>{reportData.scoped_case_manager}</strong></span>}
              {(dateFrom || dateTo) && (
                <span> • Period: <strong>{dateFrom || 'Earliest'}</strong> to <strong>{dateTo || 'Latest'}</strong></span>
              )}
            </div>
          </div>
        </div>

        <div className="table-responsive">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⏳</div>
              <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Aggregating report records from audit log repository...</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                {/* Case Managers Audit Log */}
                {reportType === 'case_manager_audit_log' && (
                  <tr>
                    <th style={{ width: '150px' }}>Date & Time</th>
                    <th>Case Manager / Actor</th>
                    <th>Role</th>
                    <th>Action</th>
                    <th>Reference</th>
                    <th>Audit Details</th>
                    <th>IP Address</th>
                  </tr>
                )}

                {/* 1. Candidate Placement */}
                {reportType === 'candidate_placement' && (
                  <tr>
                    <th>Ref No</th>
                    <th>Full Name</th>
                    <th>CPR No</th>
                    <th>Employer</th>
                    <th>Position</th>
                    <th>Salary ({currency})</th>
                    <th>Placement Date</th>
                    <th>Case Manager</th>
                    <th>Status</th>
                  </tr>
                )}

                {/* 2. Milestones */}
                {reportType === 'claim_milestones' && (
                  <tr>
                    <th>Candidate Ref</th>
                    <th>Candidate Name</th>
                    <th>Employer</th>
                    <th>Milestone</th>
                    <th>Target Date</th>
                    <th>Days Remaining</th>
                    <th>Status</th>
                    <th>Case Manager</th>
                  </tr>
                )}

                {/* 3. Unclaimed Milestones */}
                {reportType === 'unclaimed_milestones' && (
                  <tr>
                    <th>Candidate Ref</th>
                    <th>Candidate Name</th>
                    <th>Employer</th>
                    <th>Milestone</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Case Manager</th>
                  </tr>
                )}

                {/* 4. Claim Ledger */}
                {reportType === 'claim_ledger' && (
                  <tr>
                    <th>Claim Ref</th>
                    <th>Candidate</th>
                    <th>Employer</th>
                    <th>Claim Amount</th>
                    <th>Total Paid</th>
                    <th>Balance</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                  </tr>
                )}

                {/* 5. Disputes */}
                {reportType === 'categorized_disputes' && (
                  <tr>
                    <th>Dispute ID</th>
                    <th>Candidate</th>
                    <th>Employer</th>
                    <th>Category</th>
                    <th>Reason</th>
                    <th>Filed Date</th>
                    <th>Status</th>
                  </tr>
                )}

                {/* 6. Financial Collections */}
                {reportType === 'financial_collections' && (
                  <tr>
                    <th>Receipt No</th>
                    <th>Payment Date</th>
                    <th>Claim Ref</th>
                    <th>Candidate</th>
                    <th>Employer</th>
                    <th>Amount Paid</th>
                    <th>Method</th>
                  </tr>
                )}

                {/* 7. Case Manager Performance */}
                {reportType === 'case_manager_performance' && (
                  <tr>
                    <th>Case Manager</th>
                    <th>Total Placements</th>
                    <th>Total Claims</th>
                    <th>Total Claimed ({currency})</th>
                    <th>Total Collected ({currency})</th>
                    <th>Collection Rate</th>
                    <th>Active Disputes</th>
                  </tr>
                )}

                {/* 8. Termination Audit */}
                {reportType === 'termination_audit' && (
                  <tr>
                    <th>Candidate Ref</th>
                    <th>Candidate Name</th>
                    <th>Employer</th>
                    <th>Status</th>
                    <th>Placement Date</th>
                    <th>Case Manager</th>
                  </tr>
                )}

                {/* 9. Employer Retention */}
                {reportType === 'employer_retention' && (
                  <tr>
                    <th>Employer Company</th>
                    <th>Total Placements</th>
                    <th>Active</th>
                    <th>Disputes</th>
                    <th>Retention Rate</th>
                  </tr>
                )}

                {/* 10. Executive KPIs */}
                {reportType === 'executive_kpis' && (
                  <tr>
                    <th>Metric Key</th>
                    <th>Description</th>
                    <th>Current Value</th>
                  </tr>
                )}
              </thead>

              <tbody>
                {/* Case Managers Audit Log Rows */}
                {reportType === 'case_manager_audit_log' && reportData?.data?.map(r => {
                  const badge = getActionBadge(r.action, r.category);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        <div><strong>{window.formatAppDate(r.created_at || r.date)}</strong></div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {r.created_at ? r.created_at.split(' ')[1] : ''}
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{r.user_full_name || r.username}</strong>
                        {r.username && r.user_full_name && r.username !== r.user_full_name && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>@{r.username}</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>
                          {r.role || 'user'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          display: 'inline-block'
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>
                        {r.entity_ref || `${r.entity_type}#${r.entity_id || ''}`}
                      </td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '380px', lineHeight: 1.45 }}>
                        {r.details}
                      </td>
                      <td style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {r.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  );
                })}

                {/* 1. Candidate Placement */}
                {reportType === 'candidate_placement' && reportData?.data?.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.ref_no}</td>
                    <td><strong>{c.full_name}</strong></td>
                    <td>{c.cpr_no}</td>
                    <td>{c.company_name}</td>
                    <td>{c.position_title}</td>
                    <td style={{ fontWeight: 700 }}>{Number(c.salary_bhd).toFixed(3)}</td>
                    <td>{window.formatAppDate(c.placement_date || c.joining_date)}</td>
                    <td><span className="badge badge-neutral">{c.case_manager_name || 'System'}</span></td>
                    <td><span className={`badge ${c.placement_status === 'active' || c.status === 'placed' ? 'badge-success' : 'badge-danger'}`}>{c.placement_status || c.status}</span></td>
                  </tr>
                ))}

                {/* 2. Milestones */}
                {reportType === 'claim_milestones' && reportData?.data?.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{m.candidate_ref}</td>
                    <td><strong>{m.candidate_name}</strong></td>
                    <td>{m.company_name}</td>
                    <td><span className="badge badge-info">{m.milestone_title}</span></td>
                    <td>{window.formatAppDate(m.target_date || m.due_date)}</td>
                    <td>{m.days_remaining}d</td>
                    <td><span className="badge badge-neutral">{m.status}</span></td>
                    <td>{m.case_manager_name || 'System'}</td>
                  </tr>
                ))}

                {/* 3. Unclaimed Milestones */}
                {reportType === 'unclaimed_milestones' && reportData?.data?.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{m.candidate_ref}</td>
                    <td><strong>{m.candidate_name}</strong></td>
                    <td>{m.company_name}</td>
                    <td><span className="badge badge-warning">{m.milestone_title}</span></td>
                    <td>{window.formatAppDate(m.due_date || m.target_date)}</td>
                    <td><span className="badge badge-danger">{m.status || 'overdue'}</span></td>
                    <td>{m.case_manager_name || 'System'}</td>
                  </tr>
                ))}

                {/* 4. Claim Ledger */}
                {reportType === 'claim_ledger' && reportData?.data?.map(cl => (
                  <tr key={cl.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{cl.claim_ref}</td>
                    <td><strong>{cl.candidate_name}</strong></td>
                    <td>{cl.company_name}</td>
                    <td style={{ fontWeight: 700 }}>{currency} {Number(cl.claim_amount_bhd).toFixed(3)}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>{currency} {Number(cl.total_paid_bhd || 0).toFixed(3)}</td>
                    <td style={{ color: cl.balance_bhd > 0 ? 'var(--danger)' : 'inherit', fontWeight: 700 }}>{currency} {Number(cl.balance_bhd || 0).toFixed(3)}</td>
                    <td>{window.formatAppDate(cl.submission_date || cl.claim_date)}</td>
                    <td><span className="badge badge-neutral">{cl.status}</span></td>
                  </tr>
                ))}

                {/* 5. Categorized Disputes */}
                {reportType === 'categorized_disputes' && reportData?.data?.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{d.dispute_ref || `DISP-${d.id}`}</td>
                    <td><strong>{d.candidate_name}</strong></td>
                    <td>{d.company_name}</td>
                    <td><span className="badge badge-warning">{d.dispute_category}</span></td>
                    <td style={{ maxWidth: '300px' }}>{d.dispute_reason}</td>
                    <td>{window.formatAppDate(d.dispute_date)}</td>
                    <td><span className="badge badge-danger">{d.status}</span></td>
                  </tr>
                ))}

                {/* 6. Financial Collections */}
                {reportType === 'financial_collections' && reportData?.data?.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.receipt_no}</td>
                    <td>{window.formatAppDate(p.payment_date)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.claim_ref || `CLM-${p.claim_id}`}</td>
                    <td>{p.candidate_name}</td>
                    <td>{p.company_name}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{currency} {Number(p.amount_paid_bhd).toFixed(3)}</td>
                    <td><span className="badge badge-neutral">{p.payment_method}</span></td>
                  </tr>
                ))}

                {/* 7. Case Manager Performance */}
                {reportType === 'case_manager_performance' && reportData?.data?.map(cm => (
                  <tr key={cm.case_manager_name}>
                    <td><strong>{cm.case_manager_name}</strong></td>
                    <td style={{ fontWeight: 700 }}>{cm.placements_count}</td>
                    <td>{cm.claims_count}</td>
                    <td style={{ fontWeight: 700 }}>{currency} {Number(cm.total_claimed_bhd).toFixed(3)}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>{currency} {Number(cm.total_collected_bhd).toFixed(3)}</td>
                    <td><span className="badge badge-success">{cm.collection_rate_percent}%</span></td>
                    <td><span className="badge badge-warning">{cm.disputes_count}</span></td>
                  </tr>
                ))}

                {/* 8. Termination Audit */}
                {reportType === 'termination_audit' && reportData?.data?.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{c.ref_no}</td>
                    <td><strong>{c.full_name}</strong></td>
                    <td>{c.company_name}</td>
                    <td><span className="badge badge-danger">{c.status}</span></td>
                    <td>{window.formatAppDate(c.joining_date || c.registration_date)}</td>
                    <td>{c.case_manager_name || 'System'}</td>
                  </tr>
                ))}

                {/* 9. Employer Retention */}
                {reportType === 'employer_retention' && reportData?.data?.map(emp => (
                  <tr key={emp.employer_name || emp.id}>
                    <td><strong>{emp.employer_name}</strong></td>
                    <td style={{ fontWeight: 700 }}>{emp.total_placements}</td>
                    <td>{emp.active_placements}</td>
                    <td>{emp.disputes_count}</td>
                    <td><span className="badge badge-success">{emp.retention_rate}%</span></td>
                  </tr>
                ))}

                {/* 10. Executive KPIs */}
                {reportType === 'executive_kpis' && [
                  { key: 'Total Placements', desc: 'Registered active candidates', val: state.kpis.total_placements },
                  { key: 'Due Milestones', desc: 'Retention checkpoints awaiting claim', val: state.kpis.due_milestones },
                  { key: 'Total Claimed', desc: 'Sum of all manually submitted claims', val: `${currency} ${Number(state.kpis.total_claimed_bhd || 0).toFixed(3)}` },
                  { key: 'Total Collected', desc: 'Disbursements received from treasury', val: `${currency} ${Number(state.kpis.total_collected_bhd || 0).toFixed(3)}` },
                  { key: 'Outstanding Balance', desc: 'Net balance awaiting payment', val: `${currency} ${Number(state.kpis.total_outstanding_bhd || 0).toFixed(3)}` },
                  { key: 'Active Disputes', desc: 'Contested placements undergoing review', val: state.kpis.active_disputes }
                ].map(item => (
                  <tr key={item.key}>
                    <td><strong>{item.key}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.desc}</td>
                    <td style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{item.val}</td>
                  </tr>
                ))}

                {(!reportData?.data || reportData.data.length === 0) && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No data records found matching your specified filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

window.ReportsView = ReportsView;
