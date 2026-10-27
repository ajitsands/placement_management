/**
 * Users & RBAC Administration View
 * Strictly guarded: ONLY Superadmin and Admin can access this view or govern users.
 */

const { useState, useMemo } = React;

function UsersView({ state }) {
  const { currentUser, users = [] } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  // State for user creation form
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    role: 'case_manager',
    case_manager_code: '',
    email: '',
    phone: '',
    password: '',
    is_active: 1
  });
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Activate / Deactivate Handler with SweetAlert2 confirmation
  const handleToggleUser = async (user, newStatus) => {
    const isDeactivating = newStatus === 0;

    const result = await (window.swal || window.Swal).fire({
      title: isDeactivating ? 'Deactivate User Account?' : 'Activate User Account?',
      html: isDeactivating
        ? `Are you sure you want to deactivate <strong>${user.full_name}</strong> (<code>@${user.username}</code>)?<br><br><span style="color:var(--text-muted);font-size:0.85rem;">This user will be prevented from logging into the portal and performing transactions.</span>`
        : `Activate user <strong>${user.full_name}</strong> (<code>@${user.username}</code>)?<br><br><span style="color:var(--text-muted);font-size:0.85rem;">Portal login access and transaction handling permissions will be restored immediately.</span>`,
      icon: isDeactivating ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: isDeactivating ? 'Yes, Deactivate User' : 'Yes, Activate User',
      confirmButtonColor: isDeactivating ? '#ef4444' : '#10b981',
      cancelButtonText: 'Cancel',
      focusCancel: isDeactivating
    });

    if (!result.isConfirmed) return;

    setTogglingId(user.id);
    try {
      await window.api.users.toggleStatus(user.id, newStatus);
      window.AppStore.showNotification(
        `User '${user.full_name}' (@${user.username}) has been ${isDeactivating ? 'deactivated' : 'activated'} successfully!`,
        'success'
      );
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error updating user status: ' + err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // DataTable column definitions for Users
  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)' }}>
          #{val}
        </span>
      )
    },
    {
      key: 'full_name',
      label: 'Full Name / Username',
      sortable: true,
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{val}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            @{row.username}
          </div>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role Category',
      sortable: true,
      render: (val) => (
        <span className={`badge ${
          val === 'superadmin' ? 'badge-danger' : 
          (val === 'admin' ? 'badge-warning' : 'badge-info')
        }`}>
          {val ? val.replace('_', ' ') : 'user'}
        </span>
      )
    },
    {
      key: 'case_manager_code',
      label: 'Scope / Code',
      sortable: true,
      render: (val) => (
        val ? (
          <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{val}</span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Global</span>
        )
      )
    },
    {
      key: 'email',
      label: 'Contact Info',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontSize: '0.82rem' }}>{val || '—'}</div>
          {row.phone && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              📞 +973 {row.phone}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Account Status',
      sortable: true,
      render: (val, row) => {
        const isActive = (val ?? row.is_active ?? 1) !== 0;
        return (
          <span
            className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
            {isActive ? 'Active' : 'Deactivated'}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => {
        const isActive = (row.is_active ?? 1) !== 0;
        const isSelf = currentUser.id === row.id;
        const isProtectedSuper = row.role === 'superadmin' && currentUser.role !== 'superadmin';

        if (isProtectedSuper) {
          return (
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title="Only Superadmin can modify Superadmin accounts">
              Protected
            </span>
          );
        }

        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => window.AppStore.openModal('EDIT_USER', { user: row })}
              title="Edit user details, role permissions, or password"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Edit</span>
            </button>

            {isSelf ? (
              <span className="badge badge-neutral" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title="You cannot deactivate your own logged-in account">
                Current User
              </span>
            ) : (
              <button
                type="button"
                className={`btn btn-sm ${isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => handleToggleUser(row, isActive ? 0 : 1)}
                disabled={togglingId === row.id}
                title={isActive ? 'Deactivate this user account' : 'Activate this user account'}
              >
                {togglingId === row.id ? (
                  'Updating...'
                ) : isActive ? (
                  <>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>Deactivate</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Activate</span>
                  </>
                )}
              </button>
            )}
          </div>
        );
      }
    }
  ], [currentUser, togglingId]);

  // If unauthorized role attempts access
  if (!isAdminOrSuper) {
    return (
      <div className="card" style={{ marginTop: '2rem', textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>Access Restricted: RBAC Policy</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0.5rem auto 1.5rem' }}>
          Under system security specifications, <strong>only Superadmin and Admin</strong> can manage or create users.
          Case Managers operate with strict transaction-level scoping.
        </p>
        <button className="btn btn-primary" onClick={() => window.AppStore.setActiveTab('dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.full_name) {
      window.AppStore.showNotification('Username and Full Name are mandatory', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await window.api.users.create(formData);
      window.AppStore.showNotification(`User '${formData.username}' created successfully!`, 'success');
      setFormData({
        username: '',
        full_name: '',
        role: 'case_manager',
        case_manager_code: '',
        email: '',
        phone: '',
        password: '',
        is_active: 1
      });
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Failed to create user: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Users & Role-Based Access Control (RBAC)</h1>
          <p className="page-subtitle">
            Administrative governance module. Superadmins and Admins can create, activate, and deactivate user accounts.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Create User Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">➕ Create Authorized User</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="input-control"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username (System Login) *</label>
                <input
                  type="text"
                  className="input-control"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role Category *</label>
                <select
                  className="select-control"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="case_manager">Case Manager (Scoped to assigned candidates)</option>
                  <option value="admin">Admin (Handles all transactions & creates users)</option>
                  {currentUser.role === 'superadmin' && (
                    <option value="superadmin">Superadmin (Master access & configurations)</option>
                  )}
                </select>
              </div>

              {formData.role === 'case_manager' && (
                <div className="form-group">
                  <label className="form-label">Case Manager Code / Short Name</label>
                  <input
                    type="text"
                    className="input-control"
                    value={formData.case_manager_code}
                    onChange={e => setFormData({ ...formData, case_manager_code: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="input-control"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone (Bahrain)</label>
                <input
                  type="text"
                  className="input-control"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Account Status</label>
                <select
                  className="select-control"
                  value={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
                >
                  <option value={1}>Active (Permitted to log in)</option>
                  <option value={0}>Deactivated (Hold login access)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <input
                  type="password"
                  className="input-control"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={submitting}>
                {submitting ? 'Creating User...' : 'Create User Account'}
              </button>
            </form>
          </div>
        </div>

        {/* Existing Users DataTable */}
        <div className="card">
          <window.DataTable
            columns={columns}
            data={users}
            searchPlaceholder="🔍 Search users, username, role, or status..."
            exportFilename="Registered_System_Users.csv"
            emptyMessage="No system users found."
          />
        </div>
      </div>
    </div>
  );
}

window.UsersView = UsersView;
