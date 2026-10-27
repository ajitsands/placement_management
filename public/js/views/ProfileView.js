/**
 * ProfileView Component
 * User profile inspection, editable contact details, and password reset security management.
 * Available to every authenticated role (Superadmin, Admin, Case Manager).
 */

const { useState, useEffect } = React;

function ProfileView({ state }) {
  const { currentUser, settings, users } = state;
  const currency = settings.currency || 'BHD';

  // Personal Info Form State
  const [fullName, setFullName] = useState(currentUser.full_name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [username, setUsername] = useState(currentUser.username || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Reset Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isResettingPwd, setIsResettingPwd] = useState(false);

  // Keep local form in sync when active user switches
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setUsername(currentUser.username || '');
    }
  }, [currentUser]);

  // Load fresh details from backend
  useEffect(() => {
    let isMounted = true;
    window.api.profile.get().then(res => {
      if (isMounted && res?.user) {
        setFullName(res.user.full_name || '');
        setEmail(res.user.email || '');
        setPhone(res.user.phone || '');
        setUsername(res.user.username || '');
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const isSuperadmin = currentUser.role === 'superadmin';

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      window.AppStore.showNotification('Full Name is required.', 'error');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      window.AppStore.showNotification('Please enter a valid email address.', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim()
      };
      if (isAdminOrSuper && username.trim() !== currentUser.username) {
        payload.username = username.trim();
      }

      await window.AppStore.updateProfile(payload);
    } catch (err) {
      // Error handled by store
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!newPassword) {
      window.AppStore.showNotification('Please enter a new password.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      window.AppStore.showNotification('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      window.AppStore.showNotification('New password and confirmation password do not match.', 'error');
      return;
    }

    setIsResettingPwd(true);
    try {
      await window.AppStore.resetPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      // Clear fields upon successful password update
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      const swal = window.Swal || window.swal;
      if (swal) {
        swal.fire({
          icon: 'success',
          title: 'Password Updated!',
          text: 'Your account password has been successfully reset. You can now use your new password for future logins.',
          confirmButtonColor: '#2563eb'
        });
      }
    } catch (err) {
      // Handled by store notification
    } finally {
      setIsResettingPwd(false);
    }
  };

  // Role display helpers
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'superadmin':
        return { background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' };
      case 'admin':
        return { background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', border: '1px solid rgba(59, 130, 246, 0.3)' };
      default:
        return { background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' };
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'superadmin': return 'Super Administrator (Full System Authority)';
      case 'admin': return 'Directorate Administrator (Global Operational Access)';
      case 'case_manager': return 'Case Manager (Scoped Candidate & Retention Gate Access)';
      default: return role;
    }
  };

  // Case Manager placement count
  const myCandidateCount = (state.candidates || []).filter(c => {
    if (isAdminOrSuper) return true;
    return String(c.case_manager_name || '').trim().toLowerCase() === String(currentUser.full_name || '').trim().toLowerCase();
  }).length;

  return (
    <div className="profile-container">
      {/* 1. HERO PROFILE BANNER */}
      <div className="profile-hero">
        <div className="profile-hero-content">
          <div className="profile-hero-user">
            <div className="profile-big-avatar">
              {currentUser.full_name?.charAt(0) || 'U'}
            </div>
            <div className="profile-hero-titles">
              <h2>
                <span>{currentUser.full_name}</span>
                <span className="profile-role-pill" style={getRoleBadgeStyle(currentUser.role)}>
                  {currentUser.role === 'superadmin' ? '🛡️ Super Admin' : (currentUser.role === 'admin' ? '👔 Admin' : '👤 Case Manager')}
                </span>
              </h2>
              <div className="profile-hero-subtitle">
                <span>@{currentUser.username}</span>
                <span>&bull;</span>
                <span>{currentUser.email || `${currentUser.username}@sandslab.bh`}</span>
                <span>&bull;</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--success)', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }}></span>
                  Active Account
                </span>
                <span>&bull;</span>
                <span>User ID: #{currentUser.id}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                const el = document.getElementById('pwd-reset-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              🔒 Reset Password
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => window.AppStore.refreshData()}
            >
              🔄 Refresh Profile
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN GRID: PERSONAL DETAILS & SECURITY */}
      <div className="profile-grid-2col">
        {/* CARD A: PERSONAL & ACCOUNT DETAILS */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-card-title">
              <span>👤</span>
              <span>Personal & Account Details</span>
            </div>
            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
              Editable Info
            </span>
          </div>

          <form onSubmit={handleSaveProfile}>
            {/* Full Name */}
            <div className="profile-field-group">
              <label className="profile-field-label">Full Name *</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon">👤</span>
                <input
                  type="text"
                  className="profile-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Husain Al-Haddad"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="profile-field-group">
              <label className="profile-field-label">Email Address *</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon">✉️</span>
                <input
                  type="email"
                  className="profile-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@sandslab.bh"
                  required
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="profile-field-group">
              <label className="profile-field-label">Mobile Phone Number</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon">📞</span>
                <input
                  type="tel"
                  className="profile-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +973 3999 1234"
                />
              </div>
            </div>

            {/* Username */}
            <div className="profile-field-group">
              <label className="profile-field-label">
                Username {isAdminOrSuper ? '(Admin Modifiable)' : '(System Assigned)'}
              </label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon">🏷️</span>
                <input
                  type="text"
                  className="profile-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={!isAdminOrSuper}
                  title={isAdminOrSuper ? 'Administrator can edit username' : 'Username is locked to system credential'}
                />
              </div>
              <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                Used for system authentication and audit activity tracing.
              </small>
            </div>

            {/* Role & Scoping (Read-only) */}
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Assigned Authority Level
                </span>
                <span className="profile-role-pill" style={getRoleBadgeStyle(currentUser.role)}>
                  {currentUser.role}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {getRoleLabel(currentUser.role)}
              </div>
              {currentUser.role === 'case_manager' && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  📍 Scoped to: <strong>{currentUser.case_manager_code || currentUser.full_name}</strong> ({myCandidateCount} assigned candidates)
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingProfile}
              style={{ width: '100%', padding: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {isSavingProfile ? <span>⏳ Saving Details...</span> : <span>💾 Save Profile Changes</span>}
            </button>
          </form>
        </div>

        {/* CARD B: PASSWORD SECURITY & RESET */}
        <div id="pwd-reset-card" className="profile-card">
          <div className="profile-card-header">
            <div className="profile-card-title">
              <span>🔒</span>
              <span>Security & Password Reset</span>
            </div>
            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
              Credential Reset
            </span>
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Reset your secret login password. You will need your current password to confirm the change.
          </div>

          <form onSubmit={handleResetPassword}>
            {/* Current Password */}
            <div className="profile-field-group">
              <label className="profile-field-label">Current Password *</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon">🔑</span>
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  className="profile-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
                <button
                  type="button"
                  className="profile-pwd-toggle"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  tabIndex="-1"
                >
                  {showCurrentPwd ? '👁️' : '🙈'}
                </button>
              </div>
              <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                (For demo evaluation accounts: default is <code style={{ color: 'var(--primary)' }}>password123</code> or <code style={{ color: 'var(--primary)' }}>admin123</code>)
              </small>
            </div>

            {/* New Password */}
            <div className="profile-field-group">
              <label className="profile-field-label">New Password *</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon">🔒</span>
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  className="profile-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  required
                  minLength="6"
                />
                <button
                  type="button"
                  className="profile-pwd-toggle"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  tabIndex="-1"
                >
                  {showNewPwd ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="profile-field-group">
              <label className="profile-field-label">Confirm New Password *</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon">🛡️</span>
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  className="profile-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  minLength="6"
                />
                <button
                  type="button"
                  className="profile-pwd-toggle"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  tabIndex="-1"
                >
                  {showConfirmPwd ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            {/* Password Validation Checklist */}
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 0.95rem',
              marginBottom: '1.25rem',
              fontSize: '0.76rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                Password Security Requirements:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: newPassword.length >= 6 ? 'var(--success)' : 'var(--text-muted)' }}>
                <span>{newPassword.length >= 6 ? '✓' : '○'}</span>
                <span>Minimum 6 characters in length ({newPassword.length}/6 entered)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: newPassword && confirmPassword && newPassword === confirmPassword ? 'var(--success)' : 'var(--text-muted)' }}>
                <span>{newPassword && confirmPassword && newPassword === confirmPassword ? '✓' : '○'}</span>
                <span>New passwords match</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isResettingPwd || newPassword.length < 6 || newPassword !== confirmPassword}
              style={{ width: '100%', padding: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {isResettingPwd ? <span>⏳ Resetting Password...</span> : <span>🔑 Reset & Update Password</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

window.ProfileView = ProfileView;
