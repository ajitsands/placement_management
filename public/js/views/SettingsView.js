/**
 * Settings View - GCC Localization & Regional Configurations
 * Bahrain by default, with full GCC regional compatibility (Timezone, Currency, Date/Time Format)
 */

const { useState, useEffect } = React;

function SettingsView({ state }) {
  const { settings, supportedTimezones, supportedCurrencies, dateFormats, timeFormats, currentUser, databaseStatus } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const [form, setForm] = useState({
    app_name: settings.app_name || 'Candidate Placement & Claims Management System',
    timezone: settings.timezone || 'Asia/Bahrain',
    currency: settings.currency || 'BHD',
    currency_symbol: settings.currency_symbol || 'BD',
    date_format: settings.date_format || 'DD/MM/YYYY',
    time_format: settings.time_format || '12h',
    default_country: settings.default_country || 'Bahrain',
    notification_email: settings.notification_email || 'claims-ops@sandslab.bh'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      app_name: settings.app_name || 'Candidate Placement & Claims Management System',
      timezone: settings.timezone || 'Asia/Bahrain',
      currency: settings.currency || 'BHD',
      currency_symbol: settings.currency_symbol || 'BD',
      date_format: settings.date_format || 'DD/MM/YYYY',
      time_format: settings.time_format || '12h',
      default_country: settings.default_country || 'Bahrain',
      notification_email: settings.notification_email || 'claims-ops@sandslab.bh'
    });
  }, [settings]);

  const handleCurrencyChange = (e) => {
    const curr = e.target.value;
    const match = supportedCurrencies.find(c => c.code === curr);
    setForm({
      ...form,
      currency: curr,
      currency_symbol: match ? match.symbol : curr
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdminOrSuper) {
      window.AppStore.showNotification('Only Administrators can modify system localization settings', 'error');
      return;
    }

    setSaving(true);
    await window.AppStore.saveSettings(form);
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>System Settings & GCC Regional Localization</h1>
          <p className="page-subtitle">
            Configured for the Kingdom of Bahrain by default, with GCC operational standards
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Settings Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚙️ Regional Configuration</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Application Title</label>
                <input
                  type="text"
                  className="input-control"
                  value={form.app_name}
                  onChange={e => setForm({ ...form, app_name: e.target.value })}
                  disabled={!isAdminOrSuper}
                />
              </div>

              {/* Time Zone */}
              <div className="form-group">
                <label className="form-label">Time Zone (Bahrain / GCC Standard) *</label>
                <select
                  className="select-control"
                  value={form.timezone}
                  onChange={e => setForm({ ...form, timezone: e.target.value })}
                  disabled={!isAdminOrSuper}
                >
                  {supportedTimezones.map(tz => (
                    <option key={tz.zone} value={tz.zone}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
                <span className="form-help">Sets the server and audit timestamp conversion zone. Default: Asia/Bahrain (GMT+3).</span>
              </div>

              {/* Currency */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">System Currency *</label>
                  <select
                    className="select-control"
                    value={form.currency}
                    onChange={handleCurrencyChange}
                    disabled={!isAdminOrSuper}
                  >
                    {supportedCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Currency Symbol</label>
                  <input
                    type="text"
                    className="input-control"
                    value={form.currency_symbol}
                    onChange={e => setForm({ ...form, currency_symbol: e.target.value })}
                    disabled={!isAdminOrSuper}
                  />
                </div>
              </div>

              {/* Date & Time Formats */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date Format *</label>
                  <select
                    className="select-control"
                    value={form.date_format}
                    onChange={e => setForm({ ...form, date_format: e.target.value })}
                    disabled={!isAdminOrSuper}
                  >
                    {dateFormats.map(df => (
                      <option key={df.format} value={df.format}>{df.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Time Format *</label>
                  <select
                    className="select-control"
                    value={form.time_format}
                    onChange={e => setForm({ ...form, time_format: e.target.value })}
                    disabled={!isAdminOrSuper}
                  >
                    {timeFormats.map(tf => (
                      <option key={tf.format} value={tf.format}>{tf.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Default GCC Territory</label>
                <select
                  className="select-control"
                  value={form.default_country}
                  onChange={e => setForm({ ...form, default_country: e.target.value })}
                  disabled={!isAdminOrSuper}
                >
                  <option value="Bahrain">Kingdom of Bahrain (Default)</option>
                  <option value="Saudi Arabia">Kingdom of Saudi Arabia</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Qatar">State of Qatar</option>
                  <option value="Kuwait">State of Kuwait</option>
                  <option value="Oman">Sultanate of Oman</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Operations Alert Notification Email</label>
                <input
                  type="email"
                  className="input-control"
                  value={form.notification_email}
                  onChange={e => setForm({ ...form, notification_email: e.target.value })}
                  disabled={!isAdminOrSuper}
                />
              </div>

              {isAdminOrSuper ? (
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '0.5rem' }}>
                  {saving ? 'Saving Changes...' : '💾 Save GCC Settings'}
                </button>
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  ℹ️ Read-only: Settings modification requires Administrator or Superadmin role privileges.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Live Preview Card */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">👁️ Live GCC Formatting Preview</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Preview of how currency values and timestamps render across tables, PDF reports, and candidate milestone screens:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SAMPLE MONETARY AMOUNT</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                    {form.currency} {Number(1550).toLocaleString('en-US', { minimumFractionDigits: 3 })}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Symbol: {form.currency_symbol} 1,550.000
                  </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>FORMATTED RETENTION DATE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {form.date_format === 'DD/MM/YYYY' ? '25/10/2026' : (form.date_format === 'YYYY-MM-DD' ? '2026-10-25' : '25-Oct-2026')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Time: {form.time_format === '12h' ? '05:15 PM' : '17:15'} ({form.timezone})
                  </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SYSTEM LOCALIZATION STATUS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <span className="badge badge-success">ACTIVE IN BAHRAIN</span>
                    <span className="badge badge-neutral">GCC READY</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Database Connection & Deployment Architecture Card */}
          <div className="card" style={{ marginTop: '1.25rem' }}>
            <div className="card-header">
              <span className="card-title">🗄️ Database & Environment Architecture</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Engine Driver:</span>
                  <span className={`badge ${databaseStatus?.is_mysql ? 'badge-success' : 'badge-warning'}`} style={{ fontWeight: 700 }}>
                    {databaseStatus?.driver || 'MySQL Live ACID Storage'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Target Host & Port:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', fontWeight: 600 }}>
                    {databaseStatus?.host || '127.0.0.1'}:{databaseStatus?.port || '3306'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Database Name:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {databaseStatus?.database || 'claims_db'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Environment Scope:</span>
                  <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                    {databaseStatus?.environment || 'local'} / SERVER READY
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Config Source:</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    .env File & Server Env
                  </span>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  💡 <strong>Dual-Layer High Availability:</strong> Reads and writes execute live against MySQL. An atomic JSON cache is automatically updated as an offline fallback safeguard.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SettingsView = SettingsView;
