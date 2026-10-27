/**
 * Reports View - 10 Enterprise Analytical & Audit Reports
 */

const { useState, useEffect } = React;

function ReportsView({ state }) {
  const [reportType, setReportType] = useState('candidate_placement');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { settings, currentUser } = state;
  const currency = settings.currency || 'BHD';

  const reportOptions = [
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

  const loadReport = async (type) => {
    setLoading(true);
    try {
      const res = await window.api.reports.generate(type);
      setReportData(res);
    } catch (err) {
      window.AppStore.showNotification('Failed to generate report: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(reportType);
  }, [reportType, currentUser.id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Enterprise Reports & Audit Center</h1>
          <p className="page-subtitle">
            10 specialized regulatory, financial, and retention reports compliant with Ministry and Tamkeen audits
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={handlePrint}>
            🖨️ Print / Export PDF
          </button>
        </div>
      </div>

      {/* Report Selector Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>Select Analytical Report:</label>
          <div style={{ flex: 1, minWidth: '320px' }}>
            <select
              className="select-control"
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              {reportOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.title}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => loadReport(reportType)} disabled={loading}>
            {loading ? 'Generating...' : '🔄 Refresh Report'}
          </button>
        </div>
      </div>

      {/* Report Results */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">{reportData?.title || 'Report Results'}</span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Total records: {reportData?.count ?? 0} | Scope: {reportData?.scoped_case_manager || 'Global / All Case Managers'}
            </div>
          </div>
        </div>

        <div className="table-responsive">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              <p>Aggregating report data via Micro-API...</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
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
                {reportType === 'employer_retention' && (
                  <tr>
                    <th>Employer Company</th>
                    <th>Total Placements</th>
                    <th>Active</th>
                    <th>Disputes</th>
                    <th>Retention Rate</th>
                  </tr>
                )}
                {reportType === 'executive_kpis' && (
                  <tr>
                    <th>Metric Key</th>
                    <th>Description</th>
                    <th>Current Value</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {/* 1. Candidate Placement */}
                {reportType === 'candidate_placement' && reportData?.data?.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.ref_no}</td>
                    <td><strong>{c.full_name}</strong></td>
                    <td>{c.cpr_no}</td>
                    <td>{c.company_name}</td>
                    <td>{c.position_title}</td>
                    <td style={{ fontWeight: 700 }}>{Number(c.salary_bhd).toFixed(3)}</td>
                    <td>{window.formatAppDate(c.placement_date)}</td>
                    <td><span className="badge badge-neutral">{c.case_manager_name}</span></td>
                    <td><span className={`badge ${c.placement_status === 'active' ? 'badge-success' : 'badge-danger'}`}>{c.placement_status}</span></td>
                  </tr>
                ))}

                {/* 2. Milestones */}
                {reportType === 'claim_milestones' && reportData?.data?.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{m.candidate_ref}</td>
                    <td><strong>{m.candidate_name}</strong></td>
                    <td>{m.company_name}</td>
                    <td><span className="badge badge-info">{m.milestone_title}</span></td>
                    <td>{window.formatAppDate(m.target_date)}</td>
                    <td>{m.days_remaining}d</td>
                    <td><span className="badge badge-neutral">{m.status}</span></td>
                    <td>{m.case_manager_name}</td>
                  </tr>
                ))}

                {/* 4. Claim Ledger */}
                {reportType === 'claim_ledger' && reportData?.data?.map(cl => (
                  <tr key={cl.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{cl.claim_ref}</td>
                    <td><strong>{cl.candidate_name}</strong></td>
                    <td>{cl.company_name}</td>
                    <td style={{ fontWeight: 700 }}>{currency} {Number(cl.claim_amount_bhd).toFixed(3)}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>{currency} {Number(cl.total_paid_bhd).toFixed(3)}</td>
                    <td style={{ color: cl.balance_bhd > 0 ? 'var(--danger)' : 'inherit', fontWeight: 700 }}>{currency} {Number(cl.balance_bhd).toFixed(3)}</td>
                    <td>{window.formatAppDate(cl.submission_date)}</td>
                    <td><span className="badge badge-neutral">{cl.status}</span></td>
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
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No data records found for this report.</td></tr>
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
