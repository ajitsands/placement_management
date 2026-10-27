/**
 * Claims View - Manual Claim Amount Entry & Transaction Ledger
 * Powered by DataTable with sorting, search, pagination, and CSV export.
 */

const { useState, useMemo } = React;

function ClaimsView({ state }) {
  const [statusFilter, setStatusFilter] = useState(() => {
    return sessionStorage.getItem('sands_claims_claim_status') || '';
  });
  const { claims, currentUser, settings } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const currency = settings.currency || 'BHD';

  const handleStatusFilterChange = (id) => {
    setStatusFilter(id);
    sessionStorage.setItem('sands_claims_claim_status', id);
  };

  const displayData = useMemo(() => {
    if (!statusFilter) return claims;
    return claims.filter(c => c.status === statusFilter);
  }, [claims, statusFilter]);

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
      key: 'claim_ref',
      label: 'Claim Ref',
      sortable: true,
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
          {val}
        </span>
      )
    },
    {
      key: 'candidate_name',
      label: 'Candidate / CPR',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{val}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            CPR: {row.candidate_cpr} • {row.company_name}
          </div>
        </div>
      )
    },
    {
      key: 'milestone_title',
      label: 'Claim Type',
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
      render: (val) => (
        <span style={{ color: 'var(--success)', fontWeight: 700 }}>
          {currency} {Number(val || 0).toFixed(3)}
        </span>
      )
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
      render: (val) => window.formatAppDate(val)
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => <span className="badge badge-neutral">{val}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => {
        const isSettled = val === 'settled';
        const isDisputed = val === 'disputed';
        const isTerminated = val === 'terminated';
        return (
          <span
            className={`badge ${
              isSettled ? 'badge-success' : 
              (isDisputed ? 'badge-danger' : 
              (isTerminated ? 'badge-neutral' : 'badge-warning'))
            }`}
            style={isDisputed ? { cursor: 'pointer', fontWeight: 700 } : {}}
            onClick={isDisputed ? () => window.AppStore.openModal('DISPUTE_DETAILS', { claim: row, claim_id: row.id, candidate_id: row.candidate_id }) : undefined}
            title={isDisputed ? "Click to view dispute details" : undefined}
          >
            {isDisputed ? '⚠️ Disputed' : val}
          </span>
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

            {!isSettled && !isTerminated && (
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
                onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { claim: row, claim_id: row.id, candidate_id: row.candidate_id })}
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

  const filterTabs = (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {[
        { id: '', label: 'All' },
        { id: 'submitted', label: 'Submitted' },
        { id: 'undisputed', label: 'Undisputed' },
        { id: 'settled', label: 'Settled' },
        { id: 'disputed', label: 'Disputed' },
        { id: 'terminated', label: 'Terminated' }
      ].map(tab => (
        <button
          key={tab.id}
          className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => handleStatusFilterChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Claims Management & Settlements</h1>
          <p className="page-subtitle">
            User-directed claim amounts with automated balance tracking against payments
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => window.AppStore.openModal('NEW_CLAIM')}>
            ➕ Enter Manual Claim
          </button>
        </div>
      </div>

      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          searchPlaceholder="🔍 Search Claim Ref, Candidate, CPR..."
          customFilter={filterTabs}
          exportFilename="Claims_Ledger_SaNDS.csv"
          emptyMessage="No claims found matching your filter criteria."
        />
      </div>
    </div>
  );
}

window.ClaimsView = ClaimsView;
