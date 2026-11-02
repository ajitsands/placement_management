/**
 * Settings View - GCC Localization & Regional Configurations
 * Bahrain by default, with full GCC regional compatibility (Timezone, Currency, Date/Time Format)
 */

const { useState, useEffect, useMemo } = React;

function SettingsView({ state }) {
  const settings = state?.settings || {};
  const supportedTimezones = state?.supportedTimezones || {};
  const supportedCurrencies = state?.supportedCurrencies || {};
  const dateFormats = state?.dateFormats || {};
  const timeFormats = state?.timeFormats || {};
  const currentUser = state?.currentUser || {};
  const databaseStatus = state?.databaseStatus || null;
  const checklistMasters = state?.checklistMasters || [];

  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  // Checklist Master Management State
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [criterionSaving, setCriterionSaving] = useState(false);

  // Compute Total Checklist Weight & Status Summary
  const { totalActiveWeight, activeCriteriaCount, mandatoryCriteriaCount } = useMemo(() => {
    let totWeight = 0;
    let activeCount = 0;
    let mandCount = 0;
    (checklistMasters || []).forEach(item => {
      if (item.is_active !== 0 && item.is_active !== false) {
        totWeight += parseInt(item.weight, 10) || 0;
        activeCount++;
        if (item.is_mandatory) mandCount++;
      }
    });
    return { totalActiveWeight: totWeight, activeCriteriaCount: activeCount, mandatoryCriteriaCount: mandCount };
  }, [checklistMasters]);

  // Normalize Timezones list
  const tzList = useMemo(() => {
    if (Array.isArray(supportedTimezones) && supportedTimezones.length > 0) return supportedTimezones;
    if (supportedTimezones && typeof supportedTimezones === 'object') {
      const entries = Object.entries(supportedTimezones);
      if (entries.length > 0) {
        return entries.map(([zone, info]) => ({
          zone,
          label: (typeof info === 'object' && info?.name) ? info.name : zone,
          offset: (typeof info === 'object' && info?.offset) ? info.offset : ''
        }));
      }
    }
    return [
      { zone: 'Asia/Bahrain', label: 'Bahrain (GMT+3)', offset: '+03:00' },
      { zone: 'Asia/Riyadh', label: 'Saudi Arabia - Riyadh (GMT+3)', offset: '+03:00' },
      { zone: 'Asia/Dubai', label: 'United Arab Emirates - Dubai (GMT+4)', offset: '+04:00' },
      { zone: 'Asia/Qatar', label: 'Qatar - Doha (GMT+3)', offset: '+03:00' },
      { zone: 'Asia/Kuwait', label: 'Kuwait (GMT+3)', offset: '+03:00' },
      { zone: 'Asia/Muscat', label: 'Oman - Muscat (GMT+4)', offset: '+04:00' }
    ];
  }, [supportedTimezones]);

  // Normalize Currencies list
  const currencyList = useMemo(() => {
    if (Array.isArray(supportedCurrencies) && supportedCurrencies.length > 0) return supportedCurrencies;
    if (supportedCurrencies && typeof supportedCurrencies === 'object') {
      const entries = Object.entries(supportedCurrencies);
      if (entries.length > 0) {
        return entries.map(([code, info]) => ({
          code,
          name: (typeof info === 'object' && info?.name) ? info.name : code,
          symbol: (typeof info === 'object' && info?.symbol) ? info.symbol : code,
          decimals: (typeof info === 'object' && info?.decimals) ? info.decimals : 3
        }));
      }
    }
    return [
      { code: 'BHD', name: 'Bahraini Dinar (BHD)', symbol: 'BD', decimals: 3 },
      { code: 'SAR', name: 'Saudi Riyal (SAR)', symbol: 'SR', decimals: 2 },
      { code: 'AED', name: 'UAE Dirham (AED)', symbol: 'AED', decimals: 2 },
      { code: 'QAR', name: 'Qatari Riyal (QAR)', symbol: 'QR', decimals: 2 },
      { code: 'KWD', name: 'Kuwaiti Dinar (KWD)', symbol: 'KD', decimals: 3 },
      { code: 'OMR', name: 'Omani Rial (OMR)', symbol: 'RO', decimals: 3 }
    ];
  }, [supportedCurrencies]);

  // Normalize Date Formats list
  const dateFormatList = useMemo(() => {
    if (Array.isArray(dateFormats) && dateFormats.length > 0) return dateFormats;
    if (dateFormats && typeof dateFormats === 'object') {
      const entries = Object.entries(dateFormats);
      if (entries.length > 0) {
        return entries.map(([format, label]) => ({
          format,
          label: typeof label === 'string' ? label : format
        }));
      }
    }
    return [
      { format: 'DD MMM YYYY', label: 'd M Y (e.g. 15 Aug 2026)' },
      { format: 'DD/MM/YYYY', label: 'd/m/Y (e.g. 25/10/2026)' },
      { format: 'YYYY-MM-DD', label: 'Y-m-d (e.g. 2026-10-25)' },
      { format: 'DD-MMM-YYYY', label: 'd-M-Y (e.g. 25-Oct-2026)' },
      { format: 'MM/DD/YYYY', label: 'm/d/Y (e.g. 10/25/2026)' }
    ];
  }, [dateFormats]);

  // Normalize Time Formats list
  const timeFormatList = useMemo(() => {
    if (Array.isArray(timeFormats) && timeFormats.length > 0) return timeFormats;
    if (timeFormats && typeof timeFormats === 'object') {
      const entries = Object.entries(timeFormats);
      if (entries.length > 0) {
        return entries.map(([format, label]) => ({
          format,
          label: typeof label === 'string' ? label : format
        }));
      }
    }
    return [
      { format: '12h', label: '12-Hour (02:30 PM)' },
      { format: '24h', label: '24-Hour (14:30)' }
    ];
  }, [timeFormats]);

  const [form, setForm] = useState({
    app_name: settings.app_name || 'Candidate Placement & Claims Management System',
    timezone: settings.timezone || 'Asia/Bahrain',
    currency: settings.currency || 'BHD',
    currency_symbol: settings.currency_symbol || 'BD',
    date_format: settings.date_format || 'DD/MM/YYYY',
    time_format: settings.time_format || '12h',
    default_country: settings.default_country || 'Bahrain',
    notification_email: settings.notification_email || 'claims-ops@sandslab.bh',
    standard_tier_amount_bhd: settings.standard_tier_amount_bhd !== undefined && settings.standard_tier_amount_bhd !== null ? settings.standard_tier_amount_bhd : 500
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
      notification_email: settings.notification_email || 'claims-ops@sandslab.bh',
      standard_tier_amount_bhd: settings.standard_tier_amount_bhd !== undefined && settings.standard_tier_amount_bhd !== null ? settings.standard_tier_amount_bhd : 500
    });
  }, [settings]);

  const handleCurrencyChange = (e) => {
    const curr = e.target.value;
    const match = currencyList.find(c => c.code === curr);
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

  // Checklist Master Handlers
  const handleOpenAddCriterion = () => {
    const nextOrder = (checklistMasters || []).length + 1;
    setEditingCriterion({
      isNew: true,
      code: '',
      title: '',
      description: '',
      category: 'Profile & Qualifications',
      weight: 15,
      is_mandatory: 1,
      display_order: nextOrder,
      is_active: 1
    });
  };

  const handleOpenEditCriterion = (item) => {
    setEditingCriterion({
      isNew: false,
      id: item.id,
      code: item.code || '',
      title: item.title || '',
      description: item.description || '',
      category: item.category || 'General Verification',
      weight: item.weight || 10,
      is_mandatory: item.is_mandatory ? 1 : 0,
      display_order: item.display_order || 1,
      is_active: item.is_active !== undefined ? (item.is_active ? 1 : 0) : 1
    });
  };

  const handleSaveCriterion = async (e) => {
    e.preventDefault();
    if (!isAdminOrSuper) {
      window.AppStore.showNotification('Only Administrators can modify checklist criteria', 'error');
      return;
    }
    if (!editingCriterion.title.trim()) {
      window.AppStore.showNotification('Criterion title is required', 'warning');
      return;
    }

    setCriterionSaving(true);
    try {
      const payload = {
        code: editingCriterion.code.trim().toUpperCase(),
        title: editingCriterion.title.trim(),
        description: editingCriterion.description.trim(),
        category: editingCriterion.category.trim(),
        weight: parseInt(editingCriterion.weight, 10) || 10,
        is_mandatory: editingCriterion.is_mandatory ? 1 : 0,
        display_order: parseInt(editingCriterion.display_order, 10) || 1,
        is_active: editingCriterion.is_active ? 1 : 0
      };

      if (editingCriterion.isNew) {
        await window.api.checklistMaster.create(payload);
        window.AppStore.showNotification('New checklist criterion created successfully!', 'success');
      } else {
        await window.api.checklistMaster.update(editingCriterion.id, payload);
        window.AppStore.showNotification('Checklist criterion updated successfully!', 'success');
      }
      setEditingCriterion(null);
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Failed to save criterion: ' + (err.message || 'Server error'), 'error');
    } finally {
      setCriterionSaving(false);
    }
  };

  const handleToggleCriterionStatus = async (item) => {
    if (!isAdminOrSuper) {
      window.AppStore.showNotification('Only Administrators can toggle checklist criteria', 'error');
      return;
    }
    const newStatus = (item.is_active === 0 || item.is_active === false) ? 1 : 0;
    try {
      await window.api.checklistMaster.update(item.id, { is_active: newStatus });
      window.AppStore.showNotification(`Criterion "${item.title}" ${newStatus ? 'activated' : 'deactivated'}`, 'info');
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Failed to update status: ' + err.message, 'error');
    }
  };

  const handleDeleteCriterion = async (item) => {
    if (!isAdminOrSuper) {
      window.AppStore.showNotification('Only Administrators can remove checklist criteria', 'error');
      return;
    }
    const confirmed = await window.AppStore.confirm({
      title: 'Remove Checklist Criterion?',
      text: `Are you sure you want to permanently delete criterion "${item.title}" (${item.code})? This may affect candidates relying on this criterion.`,
      icon: 'warning',
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444'
    });
    if (!confirmed.isConfirmed) return;

    try {
      await window.api.checklistMaster.delete(item.id);
      window.AppStore.showNotification('Checklist criterion removed successfully!', 'success');
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Failed to delete criterion: ' + err.message, 'error');
    }
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
                  {tzList.map(tz => (
                    <option key={tz.zone} value={tz.zone}>
                      {tz.label} {tz.offset ? `(${tz.offset})` : ''}
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
                    {currencyList.map(c => (
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
                    {dateFormatList.map(df => (
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
                    {timeFormatList.map(tf => (
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

              {/* Standard Tamkeen Tier Value */}
              <div className="form-group" style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>🏛️ Standard Tamkeen Tier Value ({form.currency}) *</span>
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Forecast Benchmark</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{form.currency}</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    className="input-control"
                    style={{ fontWeight: 700, fontSize: '1rem' }}
                    value={form.standard_tier_amount_bhd}
                    onChange={e => setForm({ ...form, standard_tier_amount_bhd: e.target.value })}
                    disabled={!isAdminOrSuper}
                    required
                  />
                </div>
                <span className="form-help">
                  Default benchmark subsidy claim value applied to retention milestones and forward cashflow maturation forecasts (Retention Due Horizon) whenever an individual claim has not specified an agreed amount. Default: 500.000 BHD.
                </span>
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

                <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>STANDARD TAMKEEN TIER FORECAST BENCHMARK</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {form.currency} {Number(form.standard_tier_amount_bhd || 500).toLocaleString('en-US', { minimumFractionDigits: 3 })}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Applied to forward cashflow maturation forecast & unlinked retention milestones.
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

      {/* SECTION: CANDIDATE REGISTRATION CHECKLIST MASTER */}
      <div className="card" style={{ marginTop: '1.75rem' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📋</span>
              <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>Candidate Registration Checklist Master</span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Configure mandatory criteria, verification weights, and compliance gates required for candidate registration.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className={`badge ${totalActiveWeight === 100 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', fontWeight: 700 }}>
              {totalActiveWeight === 100 ? '✓ Balanced' : '⚠️ Warning'}: Total Active Weight: {totalActiveWeight}%
            </span>
            {isAdminOrSuper && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={handleOpenAddCriterion}
              >
                <span>➕</span> Add New Criterion
              </button>
            )}
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {/* Quick Metrics Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            padding: '1rem 1.25rem',
            background: 'var(--bg-subtle, #f8fafc)',
            borderBottom: '1px solid var(--border-color, #e2e8f0)'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Active Criteria</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeCriteriaCount} Items</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Mandatory Gates</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger, #ef4444)' }}>{mandatoryCriteriaCount} Mandatory</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Active Weight</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: totalActiveWeight === 100 ? 'var(--success, #10b981)' : 'var(--warning, #f59e0b)' }}>
                {totalActiveWeight}% {totalActiveWeight === 100 ? '(Ideal)' : '(Requires 100%)'}
              </div>
            </div>
          </div>

          {/* Criteria Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)' }}>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, width: '50px' }}>#</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, width: '130px' }}>Code</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700 }}>Criterion & Requirements</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontSize: '0.74rem', fontWeight: 700, width: '160px' }}>Category</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, width: '90px' }}>Weight</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, width: '110px' }}>Obligation</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, width: '100px' }}>Status</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontSize: '0.74rem', fontWeight: 700, width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {checklistMasters && checklistMasters.length > 0 ? (
                  checklistMasters.map((item, idx) => {
                    const isActive = item.is_active !== 0 && item.is_active !== false;
                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border-light)', opacity: isActive ? 1 : 0.6 }}>
                        <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {item.display_order || (idx + 1)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <span className="mono-pill neutral-pill" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                            {item.code}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                            {item.title}
                          </div>
                          {item.description && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                          <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 700 }}>
                            {item.weight}%
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                          {item.is_mandatory ? (
                            <span className="badge badge-danger" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                              * Mandatory
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              Optional
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleCriterionStatus(item)}
                            disabled={!isAdminOrSuper}
                            className={`badge ${isActive ? 'badge-success' : 'badge-neutral'}`}
                            style={{
                              border: 'none',
                              cursor: isAdminOrSuper ? 'pointer' : 'default',
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.55rem'
                            }}
                            title={isAdminOrSuper ? 'Click to toggle Active/Inactive' : ''}
                          >
                            {isActive ? '✓ Active' : '○ Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                          {isAdminOrSuper ? (
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                                title="Edit Criterion"
                                onClick={() => handleOpenEditCriterion(item)}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem', color: 'var(--danger)' }}
                                title="Delete Criterion"
                                onClick={() => handleDeleteCriterion(item)}
                              >
                                🗑️
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Read-only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No checklist criteria defined yet. Click "Add New Criterion" to configure.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: ADD / EDIT CHECKLIST CRITERION */}
      {editingCriterion && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="modal-content" style={{
            maxWidth: '560px',
            width: '100%',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div className="modal-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{editingCriterion.isNew ? '➕' : '✏️'}</span>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  {editingCriterion.isNew ? 'Add Registration Checklist Criterion' : 'Edit Checklist Criterion'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setEditingCriterion(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCriterion}>
              <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Title */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Criterion Title *</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. CPR Identity & Smart Card Verification"
                    value={editingCriterion.title}
                    onChange={e => setEditingCriterion({ ...editingCriterion, title: e.target.value })}
                    required
                  />
                </div>

                {/* Code & Category */}
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: 0 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Unique Code (Uppercase)</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. CPR_VERIF"
                      value={editingCriterion.code}
                      onChange={e => setEditingCriterion({ ...editingCriterion, code: e.target.value.toUpperCase() })}
                    />
                    <span className="form-help" style={{ fontSize: '0.7rem' }}>Leave blank to auto-generate</span>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Category *</label>
                    <select
                      className="select-control"
                      value={editingCriterion.category}
                      onChange={e => setEditingCriterion({ ...editingCriterion, category: e.target.value })}
                    >
                      <option value="Identity & Legal">Identity & Legal</option>
                      <option value="Profile & Qualifications">Profile & Qualifications</option>
                      <option value="Banking & Compliance">Banking & Compliance</option>
                      <option value="Compliance & Verification">Compliance & Verification</option>
                      <option value="Employment & Contract">Employment & Contract</option>
                      <option value="General Verification">General Verification</option>
                    </select>
                  </div>
                </div>

                {/* Weight, Display Order & Obligation */}
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', margin: 0 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Weight (%) *</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="input-control"
                      value={editingCriterion.weight}
                      onChange={e => setEditingCriterion({ ...editingCriterion, weight: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Display Order</label>
                    <input
                      type="number"
                      min="1"
                      className="input-control"
                      value={editingCriterion.display_order}
                      onChange={e => setEditingCriterion({ ...editingCriterion, display_order: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Obligation</label>
                    <select
                      className="select-control"
                      value={editingCriterion.is_mandatory ? '1' : '0'}
                      onChange={e => setEditingCriterion({ ...editingCriterion, is_mandatory: parseInt(e.target.value, 10) })}
                    >
                      <option value="1">Mandatory (* Required)</option>
                      <option value="0">Optional</option>
                    </select>
                  </div>
                </div>

                {/* Active Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-tertiary)', padding: '0.65rem 0.85rem', borderRadius: '6px' }}>
                  <input
                    type="checkbox"
                    id="criterionActiveCheck"
                    checked={editingCriterion.is_active === 1 || editingCriterion.is_active === true}
                    onChange={e => setEditingCriterion({ ...editingCriterion, is_active: e.target.checked ? 1 : 0 })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="criterionActiveCheck" style={{ fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                    Active Criterion (Evaluated during candidate registration & dossier audit)
                  </label>
                </div>

                {/* Description */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Operational Description & Guidance</label>
                  <textarea
                    className="input-control"
                    rows="3"
                    placeholder="Instructions for case manager verifying this criterion..."
                    value={editingCriterion.description}
                    onChange={e => setEditingCriterion({ ...editingCriterion, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                background: 'var(--bg-subtle, #f8fafc)'
              }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingCriterion(null)}
                  disabled={criterionSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={criterionSaving}
                >
                  {criterionSaving ? 'Saving...' : (editingCriterion.isNew ? '➕ Create Criterion' : '💾 Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

window.SettingsView = SettingsView;
