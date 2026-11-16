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
      case 'jobs':
        return <window.JobsView state={state} />;
      case 'training':
        return <window.EventsView key="training" state={state} moduleType="training" />;
      case 'career_fair':
        return <window.EventsView key="career_fair" state={state} moduleType="career_fair" />;
      case 'placements':
        return <window.PlacementsView state={state} />;
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
      case 'profile':
        return <window.ProfileView state={state} />;
      default:
        return <window.DashboardView state={state} />;
    }
  };

  // 1. If initial auth check is still loading, show centered loader instead of flashing LoginView
  if (!state.isAuthenticated && state.loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'var(--bg-primary, #f8fafc)',
        color: 'var(--text-primary, #0f172a)'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '4px solid rgba(37, 99, 235, 0.18)',
          borderTopColor: 'var(--primary, #2563eb)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary, #2563eb)' }}>
          Loading Portal &amp; Verifying Session...
        </div>
      </div>
    );
  }

  // 2. If not authenticated, render Portal Login Screen
  if (!state.isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <window.LoginView state={state} onLoginSuccess={() => window.AppStore.refreshData()} />
        <div className="toast-container" aria-live="polite">
          {state.notifications.map(n => {
            let icon = 'ℹ️';
            if (n.type === 'success') icon = '✓';
            else if (n.type === 'error') icon = '✕';
            else if (n.type === 'warning') icon = '⚠️';

            return (
              <div
                key={n.id}
                className={`toast toast-${n.type || 'info'}`}
                onClick={() => window.AppStore.dismissNotification(n.id)}
                title="Click to dismiss"
              >
                <div className="toast-icon">{icon}</div>
                <div className="toast-content">{n.message}</div>
                <button
                  type="button"
                  className="toast-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.AppStore.dismissNotification(n.id);
                  }}
                  aria-label="Close notification"
                >
                  ×
                </button>
              </div>
            );
          })}
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
          <>
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              zIndex: 2000,
              background: 'linear-gradient(90deg, var(--primary, #2563eb), #38bdf8, var(--primary, #2563eb))',
              backgroundSize: '200% 100%',
              animation: 'pulse 1.2s ease-in-out infinite'
            }} />
            <div style={{
              position: 'fixed', top: '96px', right: '24px', zIndex: 1500,
              background: 'var(--bg-card)', border: '1px solid var(--border-light)',
              padding: '0.45rem 0.95rem', borderRadius: 'var(--radius-full)',
              boxShadow: 'var(--shadow-md)', fontSize: '0.78rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)'
            }}>
              <span style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(37, 99, 235, 0.2)',
                borderTopColor: 'var(--primary, #2563eb)',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.75s linear infinite'
              }} />
              Loading Data...
            </div>
          </>
        )}

        {(state.loading && (state.candidates || []).length === 0 && (state.claims || []).length === 0 && (state.milestones || []).length === 0) ? (
          <div className="card" style={{
            padding: '3rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.85rem',
            textAlign: 'center',
            marginTop: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(37, 99, 235, 0.18)',
              borderTopColor: 'var(--primary, #2563eb)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Loading Placements, Milestones &amp; Claims...
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Please wait while data is synchronized.
            </div>
          </div>
        ) : (
          renderActiveView()
        )}
      </main>

      {/* Modals Container */}
      <window.Modals state={state} />

      {/* Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {state.notifications.map(n => {
          let icon = 'ℹ️';
          if (n.type === 'success') icon = '✓';
          else if (n.type === 'error') icon = '✕';
          else if (n.type === 'warning') icon = '⚠️';

          return (
            <div
              key={n.id}
              className={`toast toast-${n.type || 'info'}`}
              onClick={() => window.AppStore.dismissNotification(n.id)}
              title="Click to dismiss"
            >
              <div className="toast-icon">{icon}</div>
              <div className="toast-content">{n.message}</div>
              <button
                type="button"
                className="toast-close"
                onClick={(e) => {
                  e.stopPropagation();
                  window.AppStore.dismissNotification(n.id);
                }}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          );
        })}
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
