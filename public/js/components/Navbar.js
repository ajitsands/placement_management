/**
 * Two-Tier Header Navigation System:
 * 1. Thin Top Header: Propel logo, portal title, DB status, ACT AS role switcher, theme toggle, and Sign Out.
 * 2. Dedicated Horizontal Menu Bar: Full-width navigation links directly underneath the top header.
 */

const { useState } = React;

function NavIcon({ type }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'menu-svg-icon'
  };

  switch (type) {
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case 'candidates':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'milestones':
      return (
        <svg {...props}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5" />
          <path d="M5 3L2 6" />
          <path d="M22 6l-3-3" />
          <path d="M12 2v3" />
        </svg>
      );
    case 'claims':
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'disputes':
      return (
        <svg {...props}>
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
    case 'payments':
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    default:
      return null;
  }
}

function Navbar({ state }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentUser, activeTab, theme, settings, databaseStatus } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'candidates', label: 'Candidates and Placements' },
    { id: 'milestones', label: 'Retention Milestones' },
    // Hidden for git push: Claims Ledger, Dispute Management, Payment Receipts, Enterprise Reports
    // { id: 'claims', label: 'Claims Ledger' },
    // { id: 'disputes', label: 'Dispute Management' },
    // { id: 'payments', label: 'Payment Receipts' },
    // { id: 'reports', label: 'Enterprise Reports' },
    ...(isAdminOrSuper ? [{ id: 'users', label: 'Users & RBAC' }] : [])
  ];

  const handleNavClick = (tabId) => {
    window.AppStore.setActiveTab(tabId);
    setMobileOpen(false);
  };

  const handleRoleChange = (e) => {
    const selectedUserId = parseInt(e.target.value);
    window.AppStore.switchRole(selectedUserId);
  };

  const handleLogout = async () => {
    const swal = window.Swal || window.swal;
    if (swal) {
      const res = await swal.fire({
        title: 'Sign Out?',
        text: 'Are you sure you want to sign out from the portal?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Sign Out',
        cancelButtonText: 'Stay Logged In',
        reverseButtons: true
      });
      if (res.isConfirmed) {
        await window.AppStore.logout();
      }
    } else if (confirm('Are you sure you want to sign out from the portal?')) {
      await window.AppStore.logout();
    }
  };

  return (
    <header className="portal-header-wrapper">
      {/* 1. THIN TOP HEADER */}
      <div className="top-header">
        <div className="top-header-container">
          {/* Left: Logo & Portal Branding */}
          <div className="top-header-left" onClick={() => handleNavClick('dashboard')} style={{ cursor: 'pointer' }}>
            <img
              src="logo/propel_logo.jpeg"
              alt="Propel SaNDS Lab Logo"
              className="top-header-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                document.getElementById('top-fallback-logo').style.display = 'flex';
              }}
            />
            <div id="top-fallback-logo" className="top-header-logo-fallback" style={{ display: 'none' }}>
              PROPEL
            </div>

            <div className="top-header-title-group">
              <span className="top-header-app-name">
                {settings.app_name || 'Candidate Placement & Claims Management Portal'}
              </span>
            </div>

            <span className="top-header-country-badge">
              🇧🇭 {settings.default_country || 'BAHRAIN'}
            </span>
          </div>

          {/* Right: ACT AS Switcher, Theme Toggle, User Profile, Sign Out */}
          <div className="top-header-right">

            {/* Quick ACT AS Role Switcher */}
            <div className="top-role-switcher-group hide-mobile">
              <span className="top-role-label">ACT AS:</span>
              <select
                className="top-role-select"
                value={currentUser.id}
                onChange={handleRoleChange}
                title="Switch active user to test RBAC and Case Manager transaction scoping"
              >
                <optgroup label="Administrators (Global All Placements)">
                  {(state.users && state.users.length > 0
                    ? state.users.filter(u => u.role === 'superadmin' || u.role === 'admin')
                    : [
                        { id: 1, full_name: 'Dr. Salman', role: 'superadmin', is_active: 1 },
                        { id: 2, full_name: 'Directorate Admin', role: 'admin', is_active: 1 }
                      ]
                  ).map(u => (
                    <option key={u.id} value={u.id} disabled={(u.is_active ?? 1) === 0}>
                      {u.full_name} ({u.role === 'superadmin' ? 'Super Admin' : 'Admin'}){(u.is_active ?? 1) === 0 ? ' [Deactivated]' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Case Managers (Strictly Scoped Placements)">
                  {(state.users && state.users.length > 0
                    ? state.users.filter(u => u.role === 'case_manager')
                    : [
                        { id: 3, full_name: 'Husain', role: 'case_manager', is_active: 1 },
                        { id: 4, full_name: 'Meaad', role: 'case_manager', is_active: 1 },
                        { id: 5, full_name: 'Dina', role: 'case_manager', is_active: 1 },
                        { id: 6, full_name: 'Malak', role: 'case_manager', is_active: 1 },
                        { id: 7, full_name: 'Zainab Mattar', role: 'case_manager', is_active: 1 },
                        { id: 8, full_name: 'Mahdi', role: 'case_manager', is_active: 1 }
                      ]
                  ).map(u => (
                    <option key={u.id} value={u.id} disabled={(u.is_active ?? 1) === 0}>
                      {u.full_name} (Case Manager){(u.is_active ?? 1) === 0 ? ' [Deactivated]' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Dark/Light Mode Toggle */}
            <button
              className="top-theme-btn"
              onClick={() => window.AppStore.toggleTheme()}
              title={`Switch to ${theme === 'light' ? 'Dark Mode' : 'Light Mode'}`}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}>
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>

            {/* User Profile Capsule */}
            <div className="top-user-capsule hide-mobile">
              <div className="top-user-avatar">
                {currentUser.full_name?.charAt(0) || 'U'}
              </div>
              <div className="top-user-details">
                <span className="top-user-name">{currentUser.full_name}</span>
                <span className="top-user-role">{currentUser.role}</span>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              className="top-logout-btn"
              onClick={handleLogout}
              title="Sign Out of Portal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hide-mobile">Sign Out</span>
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              className="top-mobile-toggle-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              title="Toggle Navigation Menu"
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED HORIZONTAL MENU BAR */}
      <nav className={`horizontal-menu-bar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="horizontal-menu-container">
          <ul className="horizontal-menu-list">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li
                  key={item.id}
                  className={`horizontal-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <span className="menu-icon">
                    <NavIcon type={item.id} />
                  </span>
                  <span className="menu-label">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}

window.Navbar = Navbar;
