/**
 * Disputes View - Categorized Dispute Resolution & Placement State Machine
 * Powered by DataTable with sorting, search, pagination, and CSV export.
 */

function DisputesView({ state }) {
  const { disputes, currentUser } = state;

  const handleReinstate = async (disputeId) => {
    const swal = window.Swal || window.swal;
    let notes = '';
    if (swal) {
      const { value: text, isConfirmed } = await swal.fire({
        title: 'Reinstate Placement',
        input: 'textarea',
        inputLabel: 'Reinstatement Remarks',
        inputPlaceholder: 'Enter remarks (e.g. Employer provided updated GOSI / CPR documentation)...',
        showCancelButton: true,
        confirmButtonText: 'Confirm Reinstatement',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        inputValidator: (val) => {
          if (!val || !val.trim()) return 'Remarks are required for reinstatement audit logs';
        }
      });
      if (!isConfirmed) return;
      notes = text;
    } else {
      notes = prompt('Enter Reinstatement Remarks (e.g. Employer provided updated GOSI / CPR documentation):');
      if (!notes) return;
    }

    try {
      await window.api.disputes.reinstate(disputeId, notes);
      if (window.Swal) {
        window.Swal.fire({
          title: 'Reinstated!',
          text: 'Candidate placement reinstated successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        window.AppStore.showNotification('Candidate placement reinstated successfully', 'success');
      }
      await window.AppStore.refreshData();
    } catch (err) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Error',
          text: 'Failed to reinstate: ' + err.message,
          icon: 'error'
        });
      } else {
        window.AppStore.showNotification('Failed to reinstate: ' + err.message, 'error');
      }
    }
  };

  const handleTerminate = async (disputeId) => {
    const swal = window.Swal || window.swal;
    let notes = '';
    if (swal) {
      const { value: text, isConfirmed } = await swal.fire({
        title: 'Terminate Placement',
        input: 'textarea',
        inputLabel: 'Termination Reason (Audit Preserved)',
        inputPlaceholder: 'Enter reason for termination under program guidelines...',
        showCancelButton: true,
        confirmButtonText: 'Confirm Termination',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        inputValidator: (val) => {
          if (!val || !val.trim()) return 'Termination reason is required for audit logs';
        }
      });
      if (!isConfirmed) return;
      notes = text;
    } else {
      notes = prompt('Enter Termination Reason (Non-destructive: Candidate audit history is preserved):');
      if (!notes) return;
    }

    try {
      await window.api.disputes.terminate(disputeId, notes);
      if (window.Swal) {
        window.Swal.fire({
          title: 'Terminated',
          text: 'Placement marked as terminated under audit logs.',
          icon: 'info',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        window.AppStore.showNotification('Placement marked as terminated under audit logs', 'info');
      }
      await window.AppStore.refreshData();
    } catch (err) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Error',
          text: 'Failed to terminate: ' + err.message,
          icon: 'error'
        });
      } else {
        window.AppStore.showNotification('Failed to terminate: ' + err.message, 'error');
      }
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'Dispute Ref',
      sortable: true,
      render: (val, row) => (
        <button
          type="button"
          onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { dispute: row, dispute_id: val })}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--danger)',
            textDecoration: 'underline'
          }}
          title="Click to view full dispute details"
        >
          DSP-{String(val).padStart(4, '0')}
        </button>
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
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (val) => (
        <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>
          {String(val || '').replace(/_/g, ' ')}
        </span>
      )
    },
    {
      key: 'reason',
      label: 'Dispute Reason & Notes',
      sortable: true,
      render: (val, row) => (
        <div style={{ maxWidth: '300px' }}>
          <span style={{ fontSize: '0.84rem' }}>{val || row.dispute_reason}</span>
          {(row.resolution_notes) && (
            <div style={{ fontSize: '0.74rem', color: 'var(--success)', marginTop: '0.2rem' }}>
              ✓ Resolved: {row.resolution_notes}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'filed_date',
      label: 'Filed Date',
      sortable: true,
      render: (val, row) => window.formatAppDate(val || row.dispute_date)
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
      render: (val) => {
        const isActive = val === 'active_dispute';
        return (
          <span className={`badge ${isActive ? 'badge-danger' : 'badge-success'}`}>
            {String(val || '').replace(/_/g, ' ')}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Resolution Actions',
      sortable: false,
      render: (_, row) => {
        const isActive = row.status === 'active_dispute';
        return (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button
              className="btn btn-sm btn-outline"
              title="View Full Dispute Record"
              onClick={() => window.AppStore.openModal('DISPUTE_DETAILS', { dispute: row, dispute_id: row.id })}
            >
              👁️ View
            </button>
            {isActive ? (
              <>
                <button
                  className="btn btn-sm btn-outline"
                  title="Reinstate to Active Placement"
                  onClick={() => handleReinstate(row.id)}
                >
                  🔄 Reinstate
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  title="Mark as Terminated"
                  onClick={() => handleTerminate(row.id)}
                >
                  ⛔ Terminate
                </button>
              </>
            ) : (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Resolved</span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Disputes & Termination Management</h1>
          <p className="page-subtitle">
            Lifecycle tracking of employer retention failures, CPR resignations, and wage discrepancy audits
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => window.AppStore.openModal('NEW_DISPUTE')}>
            ⚠️ File Categorized Dispute
          </button>
        </div>
      </div>

      <div className="card">
        <window.DataTable
          columns={columns}
          data={disputes}
          searchPlaceholder="🔍 Search Dispute Ref, Candidate, CPR, Employer..."
          exportFilename="Disputes_Audit_SaNDS.csv"
          emptyMessage="No dispute records found."
        />
      </div>
    </div>
  );
}

window.DisputesView = DisputesView;
