/**
 * Main Application Orchestrator & View Switcher
 * Subscribes to Central State Store and coordinates Micro-API calls
 */

const { useState, useEffect } = React;

function App() {
  const [state, setState] = useState(window.AppStore.getState());

  useEffect(() => {
    const unsubscribe = window.AppStore.subscribe((newState) => {
      setState({ ...newState });
    });

    // Initialize state from Micro API
    window.AppStore.init();

    return unsubscribe;
  }, []);

  const renderActiveView = () => {
    switch (state.activeTab) {
      case 'dashboard':
        return <window.DashboardView state={state} />;
      case 'candidates':
        return <window.CandidatesView state={state} />;
      case 'milestones':
        return <window.MilestonesView state={state} />;
      case 'claims':
        return <window.ClaimsView state={state} />;
      case 'disputes':
        return <window.DisputesView state={state} />;
      case 'payments':
        return <window.PaymentsView state={state} />;
      case 'reports':
        return <window.ReportsView state={state} />;
      case 'users':
        return <window.UsersView state={state} />;
      case 'settings':
        return <window.SettingsView state={state} />;
      default:
        return <window.DashboardView state={state} />;
    }
  };

  // 1. If not authenticated, render Portal Login Screen
  if (!state.isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <window.LoginView state={state} onLoginSuccess={() => window.AppStore.refreshData()} />
        <div className="toast-container">
          {state.notifications.map(n => (
            <div key={n.id} className={`toast toast-${n.type}`}>
              <span>{n.type === 'success' ? '✓' : (n.type === 'error' ? '⚠️' : 'ℹ️')}</span>
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Two-Tier Navigation Header (Thin Top Header with Propel Logo + Horizontal Menu Bar) */}
      <window.Navbar state={state} />

      {/* Main Content Area (Full-Width Responsive) */}
      <main className="main-wrapper">
        {state.loading && (
          <div style={{
            position: 'fixed', top: '96px', right: '24px', zIndex: 1500,
            background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            padding: '0.45rem 0.95rem', borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-md)', fontSize: '0.78rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)'
          }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            Syncing Micro-API...
          </div>
        )}

        {renderActiveView()}
      </main>

      {/* Modals Container */}
      <window.Modals state={state} />

      {/* Toast Notifications */}
      <div className="toast-container">
        {state.notifications.map(n => (
          <div key={n.id} className={`toast toast-${n.type}`}>
            <span>{n.type === 'success' ? '✓' : (n.type === 'error' ? '⚠️' : 'ℹ️')}</span>
            <span>{n.message}</span>
          </div>
        ))}
      </div>

      {/* Footer (Full-Length Edge-to-Edge with SaNDS Lab Branding & Recent Products) */}
      <footer className="portal-footer">
        <div className="portal-footer-container">
          {/* Col 1: Portal System Info */}
          <div className="footer-col-system">
            <div className="footer-system-brand">
              <span className="footer-system-icon">💼</span>
              <span className="footer-system-title">
                {state.settings?.app_name || 'Candidate Placement & Claims Management Portal'}
              </span>
            </div>
            <div className="footer-system-meta">
              <span>&copy; {new Date().getFullYear()} All Rights Reserved</span>
            </div>
          </div>

          {/* Col 2: Developed by SaNDS Lab */}
          <div className="footer-col-developer">
            <div
              className="footer-developer-card"
              onClick={() => window.AppStore.openModal('SANDS_PROFILE')}
              role="button"
              tabIndex={0}
              title="Click to view SaNDS Lab Company Profile & Support"
            >
              <img
                src={state.theme === 'dark' ? 'logo/sands_logo_white.png' : 'logo/sands_logo_2.png'}
                alt="SaNDS Lab"
                className="footer-developer-logo"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="footer-developer-info">
                <div className="footer-developed-by">
                  Developed by <strong className="footer-sands-name">SaNDS Lab</strong>
                  <span className="footer-profile-badge">Company Profile</span>
                </div>
                <div className="footer-site-link">
                  <a
                    href="https://www.sandslab.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="footer-site-anchor"
                    title="Visit www.sandslab.com"
                  >
                    www.sandslab.com
                  </a>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Mount React Root
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
