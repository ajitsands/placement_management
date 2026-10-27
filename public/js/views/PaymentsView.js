/**
 * Payments View - Financial Collections Ledger & Receipts
 * Powered by DataTable with multi-column sorting, search, pagination, and CSV export.
 */

function PaymentsView({ state }) {
  const { payments, kpis, settings } = state;
  const currency = settings.currency || 'BHD';

  const columns = [
    {
      key: 'receipt_no',
      label: 'Receipt No',
      sortable: true,
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
          {val}
        </span>
      )
    },
    {
      key: 'payment_date',
      label: 'Payment Date',
      sortable: true,
      render: (val) => window.formatAppDate(val)
    },
    {
      key: 'claim_ref',
      label: 'Claim Ref',
      sortable: true,
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}</span>
      )
    },
    {
      key: 'candidate_name',
      label: 'Candidate / CPR',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{val}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CPR: {row.candidate_cpr}</div>
        </div>
      )
    },
    {
      key: 'company_name',
      label: 'Employer',
      sortable: true,
      render: (val) => val || '—'
    },
    {
      key: 'amount_paid_bhd',
      label: 'Amount Paid',
      sortable: true,
      render: (val) => (
        <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.92rem' }}>
          {currency} {Number(val || 0).toFixed(3)}
        </span>
      )
    },
    {
      key: 'payment_method',
      label: 'Payment Method',
      sortable: true,
      render: (val) => <span className="badge badge-neutral">{val}</span>
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => <span className="badge badge-neutral">{val}</span>
    },
    {
      key: 'notes',
      label: 'Cashier Notes',
      sortable: true,
      render: (val, row) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {val || row.cashier_notes || '—'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Financial Collections Ledger</h1>
          <p className="page-subtitle">
            Tamkeen and Directorate disbursement receipt tracking with real-time balance reconciliation
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => window.AppStore.openModal('NEW_PAYMENT')}>
            💳 Record Payment Receipt
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card success">
          <div className="kpi-header">
            <span className="kpi-title">Total Collected</span>
            <div className="kpi-icon">💰</div>
          </div>
          <div className="kpi-value">
            {currency} {Number(kpis.total_collected_bhd || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}
          </div>
          <div className="kpi-subtext">Realized revenue across all receipts</div>
        </div>

        <div className="kpi-card danger">
          <div className="kpi-header">
            <span className="kpi-title">Uncollected Balance</span>
            <div className="kpi-icon">📉</div>
          </div>
          <div className="kpi-value">
            {currency} {Number(kpis.total_outstanding_bhd || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}
          </div>
          <div className="kpi-subtext">Pending payment from ministry / treasury</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Receipts Issued</span>
            <div className="kpi-icon">🧾</div>
          </div>
          <div className="kpi-value">{payments.length}</div>
          <div className="kpi-subtext">Audited financial transactions</div>
        </div>
      </div>

      {/* DataTable */}
      <div className="card">
        <window.DataTable
          columns={columns}
          data={payments}
          searchPlaceholder="🔍 Search Receipt No, Claim Ref, Candidate, Employer..."
          exportFilename="Payment_Collections_SaNDS.csv"
          emptyMessage="No payment receipt records found."
        />
      </div>
    </div>
  );
}

window.PaymentsView = PaymentsView;
