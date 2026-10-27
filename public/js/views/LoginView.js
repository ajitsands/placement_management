/**
 * Modern Trending Login View Component
 * Clean, image-free, high-end SaaS authentication interface with interactive role switching
 */

const { useState } = React;

function LoginView({ state, onLoginSuccess }) {
  const [selectedRoleKey, setSelectedRoleKey] = useState('superadmin');
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const demoAccounts = {
    superadmin: {
      user: 'superadmin',
      pass: 'password123',
      label: 'Super Admin',
      icon: '👑',
      name: 'Dr. Salman',
      role: 'Superadmin • Full Global Access',
      initials: 'DS',
      badgeClass: 'badge-danger'
    },
    admin: {
      user: 'directorate_admin',
      pass: 'password123',
      label: 'Admin',
      icon: '🛡️',
      name: 'Zahra Ahmed',
      role: 'Operations Admin • All Transactions',
      initials: 'ZA',
      badgeClass: 'badge-warning'
    },
    cm_husain: {
      user: 'cm_husain',
      pass: 'password123',
      label: 'CM Husain',
      icon: '🧑‍💼',
      name: 'Husain Salman',
      role: 'Case Manager • 3 Placements',
      initials: 'HS',
      badgeClass: 'badge-info'
    },
    cm_meaad: {
      user: 'cm_meaad',
      pass: 'password123',
      label: 'CM Meaad',
      icon: '👩‍💼',
      name: 'Meaad Ali',
      role: 'Case Manager • 3 Placements',
      initials: 'MA',
      badgeClass: 'badge-info'
    }
  };

  const activeDemo = demoAccounts[selectedRoleKey];

  const handleSelectRole = (key) => {
    setSelectedRoleKey(key);
    const acc = demoAccounts[key];
    if (acc) {
      setUsername(acc.user);
      setPassword(acc.pass);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await window.api.auth.login(username.trim(), password);
      if (response && response.user) {
        window.AppStore.setAuthenticatedUser(response.user);
        window.AppStore.showNotification(`Welcome back, ${response.user.full_name}!`, 'success');
        if (onLoginSuccess) onLoginSuccess(response.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your username and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trend-login-wrapper">
      {/* Atmospheric ambient glows */}
      <div className="trend-glow-top"></div>
      <div className="trend-glow-bottom"></div>

      <div className="trend-login-card">
        {/* Theme Switcher Toggle (Top Right) */}
        <button
          type="button"
          className="trend-theme-toggle"
          onClick={() => window.AppStore.toggleTheme()}
          title="Toggle Light / Dark mode"
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}
        >
          {state?.theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Centered Bigger Logo */}
        <div className="trend-login-header" style={{ justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div className="trend-logo-group" style={{ justifyContent: 'center', margin: '0 auto' }}>
            <img
              src="logo/propel_logo.jpeg"
              alt="Propel Logo"
              className="trend-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                const fb = document.getElementById('trend-fallback-logo');
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div id="trend-fallback-logo" className="trend-fallback-logo" style={{ display: 'none' }}>
              PROPEL
            </div>
          </div>
        </div>

        {/* Centered & Balanced Portal Titles */}
        <div className="trend-title-block" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 className="trend-main-title" style={{ textAlign: 'center', margin: '0 auto 0.4rem', maxWidth: '95%' }}>
            Candidate Placement & Claims Management Portal
          </h1>
          <p className="trend-subtitle" style={{ textAlign: 'center', margin: '0 auto' }}>
            Sign in to manage candidate placements, milestone claims & settlements
          </p>
        </div>

        {/* Modern Segmented Role Selector */}
        <div className="trend-segmented-control">
          {Object.entries(demoAccounts).map(([key, acc]) => (
            <button
              key={key}
              type="button"
              className={`trend-segment-btn ${selectedRoleKey === key ? 'active' : ''}`}
              onClick={() => handleSelectRole(key)}
            >
              <span>{acc.icon}</span>
              <span>{acc.label}</span>
            </button>
          ))}
        </div>

        {/* Active Profile Preview Card */}
        {activeDemo && (
          <div className="trend-profile-preview">
            <div className="trend-profile-avatar">{activeDemo.initials}</div>
            <div className="trend-profile-info">
              <div className="trend-profile-name">{activeDemo.name}</div>
              <div className="trend-profile-role">{activeDemo.role}</div>
            </div>
            <span className={`badge ${activeDemo.badgeClass}`} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>
              Quick Demo
            </span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="trend-login-form">
          {error && (
            <div className="trend-error-banner">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="trend-label">Username / Account ID</label>
            <div className="trend-input-wrap">
              <span className="trend-input-icon">👤</span>
              <input
                type="text"
                className="trend-input"
                placeholder="Enter username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSelectedRoleKey('');
                }}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="trend-label" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                className="trend-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide 🙈' : 'Show 👁️'}
              </button>
            </div>
            <div className="trend-input-wrap" style={{ marginTop: '0.35rem' }}>
              <span className="trend-input-icon">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="trend-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSelectedRoleKey('');
                }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="trend-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span>⏳ Authenticating with Micro-API...</span>
            ) : (
              <span>🔐 Sign In to Portal →</span>
            )}
          </button>
        </form>

        {/* Bottom Trust Bento Strip */}
        <div className="trend-trust-strip">
          <div className="trend-trust-item">
            <span className="trend-dot-live"></span>
            <span>REST API Active</span>
          </div>
          <div className="trend-trust-item">
            <span>🛡️ RBAC Scoped</span>
          </div>
          <div className="trend-trust-item">
            <span>🇧🇭 Bahrain (BHD)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.LoginView = LoginView;
