/**
 * Universal Date Formatter for Application:
 * Formats dates into "dd MM yyyy" format (e.g., "15 Aug 2026")
 */
const APP_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatAppDate(dateVal) {
  if (!dateVal || dateVal === '0000-00-00') return '—';
  
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed || trimmed === '—' || trimmed === '-') return '—';
    // If already in "15 Aug 2026"
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    const cleanStr = trimmed.split('T')[0].split(' ')[0];
    
    // YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(cleanStr)) {
      const parts = cleanStr.split(/[-/]/);
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (y && m >= 0 && m <= 11 && d) {
        return `${String(d).padStart(2, '0')} ${APP_MONTH_NAMES[m]} ${y}`;
      }
    }

    // DD-MM-YYYY or DD/MM/YYYY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(cleanStr)) {
      const parts = cleanStr.split(/[-/]/);
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      if (y && m >= 0 && m <= 11 && d) {
        return `${String(d).padStart(2, '0')} ${APP_MONTH_NAMES[m]} ${y}`;
      }
    }
  }

  const dt = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
  if (!isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, '0');
    const m = APP_MONTH_NAMES[dt.getMonth()];
    const y = dt.getFullYear();
    return `${d} ${m} ${y}`;
  }

  return String(dateVal);
}

window.formatAppDate = formatAppDate;

class AppStoreClass {
  constructor() {
    this.formatDate = formatAppDate;
    const savedTheme = localStorage.getItem('sands_claims_theme') || 'light';
    const savedAuth = localStorage.getItem('sands_claims_auth') === 'true';

    // Resolve initial active tab from URL hash, fallback to localStorage, fallback to 'dashboard'
    const validTabs = ['dashboard', 'candidates', 'milestones', 'claims', 'disputes', 'payments', 'reports', 'users', 'settings', 'profile'];
    const tabAliases = {
      'placements': 'candidates',
      'placement': 'candidates',
      'candidate': 'candidates',
      'candidates-and-placements': 'candidates',
      'profile': 'profile',
      'my-profile': 'profile',
      'account': 'profile'
    };

    let initialTab = 'dashboard';
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
    const resolvedHash = tabAliases[rawHash] || rawHash;

    if (validTabs.includes(resolvedHash)) {
      initialTab = resolvedHash;
    } else {
      const savedTab = localStorage.getItem('sands_claims_active_tab');
      if (validTabs.includes(savedTab)) {
        initialTab = savedTab;
      }
    }

    this.state = {
      isAuthenticated: savedAuth,
      currentUser: {
        id: 1,
        username: 'superadmin',
        full_name: 'Dr. Salman (Super Admin)',
        role: 'superadmin',
        case_manager_code: null
      },
      activeTab: initialTab,
      theme: savedTheme,
      settings: {
        app_name: 'Candidate Placement & Claims Management System',
        timezone: 'Asia/Bahrain',
        currency: 'BHD',
        currency_symbol: 'BD',
        date_format: 'DD MMM YYYY',
        time_format: '12h',
        default_country: 'Bahrain',
        auto_calc_enabled: '0'
      },
      supportedTimezones: [],
      supportedCurrencies: [],
      dateFormats: [],
      timeFormats: [],
      kpis: {},
      candidates: [],
      milestones: [],
      claims: [],
      disputes: [],
      payments: [],
      users: [],
      caseManagers: [],
      loading: false,
      notifications: [],
      modal: null // { type, props }
    };

    // Keep URL hash in sync with active tab
    if (this.state.isAuthenticated && initialTab !== 'dashboard') {
      window.location.hash = '#' + initialTab;
    }

    // Listen to browser Back / Forward buttons and manual hash changes
    window.addEventListener('hashchange', () => {
      const currentHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
      const targetTab = tabAliases[currentHash] || currentHash;
      if (validTabs.includes(targetTab) && targetTab !== this.state.activeTab) {
        this.setActiveTab(targetTab, false);
      }
    });

    this.listeners = new Set();
    this.applyTheme(this.state.theme);
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sands_claims_theme', theme);
  }

  toggleTheme() {
    const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
    this.setState({ theme: newTheme });
  }

  showNotification(message, type = 'success') {
    const id = Date.now();
    const newNotif = { id, message, type };
    this.setState({ notifications: [...this.state.notifications, newNotif] });
    setTimeout(() => {
      this.setState({
        notifications: this.state.notifications.filter(n => n.id !== id)
      });
    }, 4000);
  }

  confirm(options = {}) {
    const swal = window.Swal || window.swal;
    if (swal) {
      return swal.fire({
        title: options.title || 'Are you sure?',
        text: options.text || '',
        icon: options.icon || 'warning',
        showCancelButton: true,
        confirmButtonColor: options.confirmButtonColor || '#2563eb',
        cancelButtonColor: options.cancelButtonColor || '#64748b',
        confirmButtonText: options.confirmButtonText || 'Confirm',
        cancelButtonText: options.cancelButtonText || 'Cancel',
        reverseButtons: true,
        ...options
      });
    }
    return Promise.resolve({ isConfirmed: confirm(options.text || options.title) });
  }

  alert(title, text = '', icon = 'info') {
    const swal = window.Swal || window.swal;
    if (swal) {
      return swal.fire({ title, text, icon });
    }
    alert(text ? `${title}\n${text}` : title);
    return Promise.resolve();
  }

  openModal(type, props = {}) {
    this.setState({ modal: { type, props } });
  }

  closeModal() {
    this.setState({ modal: null });
  }

  setActiveTab(tab, updateHash = true) {
    const validTabs = ['dashboard', 'candidates', 'milestones', 'claims', 'disputes', 'payments', 'reports', 'users', 'settings', 'profile'];
    const tabAliases = {
      'placements': 'candidates',
      'placement': 'candidates',
      'candidate': 'candidates',
      'candidates-and-placements': 'candidates',
      'profile': 'profile',
      'my-profile': 'profile',
      'account': 'profile'
    };
    const resolvedTab = tabAliases[tab] || tab;
    if (!validTabs.includes(resolvedTab)) return;

    localStorage.setItem('sands_claims_active_tab', resolvedTab);

    if (updateHash && window.location.hash.replace(/^#\/?/, '') !== resolvedTab) {
      window.location.hash = '#' + resolvedTab;
    }

    this.setState({ activeTab: resolvedTab });
  }

  setAuthenticatedUser(user) {
    localStorage.setItem('sands_claims_auth', 'true');
    this.state.currentUser = user;
    this.state.isAuthenticated = true;

    const validTabs = ['dashboard', 'candidates', 'milestones', 'claims', 'disputes', 'payments', 'reports', 'users', 'settings', 'profile'];
    const tabAliases = {
      'placements': 'candidates',
      'placement': 'candidates',
      'candidate': 'candidates',
      'candidates-and-placements': 'candidates',
      'profile': 'profile',
      'my-profile': 'profile',
      'account': 'profile'
    };
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
    const resolvedHash = tabAliases[rawHash] || rawHash;
    const targetTab = validTabs.includes(resolvedHash)
      ? resolvedHash
      : (localStorage.getItem('sands_claims_active_tab') || 'dashboard');

    this.setActiveTab(targetTab);
    this.refreshData();
  }

  async logout() {
    try {
      await window.api.auth.logout();
    } catch (e) {
      // ignore network errors on logout
    }
    localStorage.removeItem('sands_claims_auth');
    localStorage.removeItem('sands_claims_active_tab');
    window.location.hash = '';
    this.setState({
      isAuthenticated: false,
      activeTab: 'dashboard'
    });
    this.showNotification('Signed out from portal successfully.', 'info');
  }

  // Micro API Orchestration
  async init() {
    this.setState({ loading: true });
    try {
      const savedAuth = localStorage.getItem('sands_claims_auth');

      // 1. Fetch current profile
      const authData = await window.api.auth.me().catch(() => null);
      if (authData?.user) {
        this.state.currentUser = authData.user;
        // If auth was explicitly set or active session exists
        if (savedAuth !== 'false') {
          this.state.isAuthenticated = true;
          localStorage.setItem('sands_claims_auth', 'true');
        }
      }

      // 2. Load Settings & GCC specs
      const settingsData = await window.api.settings.get().catch(() => null);
      if (settingsData) {
        this.state.settings = settingsData.values || this.state.settings;
        this.state.supportedTimezones = settingsData.supportedTimezones || [];
        this.state.supportedCurrencies = settingsData.supportedCurrencies || [];
        this.state.dateFormats = settingsData.dateFormats || [];
        this.state.timeFormats = settingsData.timeFormats || [];
        this.state.databaseStatus = settingsData.databaseStatus || null;
      }

      // 3. Load Case Managers list
      const cms = await window.api.users.getCaseManagers().catch(() => []);
      this.state.caseManagers = cms || [];

      // 4. Load all transactions scoped to current user if authenticated
      if (this.state.isAuthenticated) {
        const validTabs = ['dashboard', 'candidates', 'milestones', 'claims', 'disputes', 'payments', 'reports', 'users', 'settings', 'profile'];
        const tabAliases = {
          'placements': 'candidates',
          'placement': 'candidates',
          'candidate': 'candidates',
          'candidates-and-placements': 'candidates',
          'profile': 'profile',
          'my-profile': 'profile',
          'account': 'profile'
        };
        const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
        const resolvedHash = tabAliases[rawHash] || rawHash;

        let targetTab = this.state.activeTab;
        if (validTabs.includes(resolvedHash)) {
          targetTab = resolvedHash;
        } else {
          const savedTab = localStorage.getItem('sands_claims_active_tab');
          if (validTabs.includes(savedTab)) {
            targetTab = savedTab;
          }
        }
        this.state.activeTab = targetTab;
        if (targetTab !== 'dashboard' && window.location.hash.replace(/^#\/?/, '') !== targetTab) {
          window.location.hash = '#' + targetTab;
        }

        await this.refreshData();
      }
    } catch (err) {
      console.error('Initialization error:', err);
      this.showNotification('Error initializing application data: ' + err.message, 'error');
    } finally {
      this.setState({ loading: false });
    }
  }

  async refreshData() {
    try {
      const [kpisRes, candRes, msRes, claimsRes, dispRes, payRes] = await Promise.all([
        window.api.reports.getKPIs(),
        window.api.candidates.getAll(),
        window.api.milestones.getAll(),
        window.api.claims.getAll(),
        window.api.disputes.getAll(),
        window.api.payments.getAll()
      ]);

      let usersList = this.state.users;
      if (this.state.currentUser.role === 'superadmin' || this.state.currentUser.role === 'admin') {
        usersList = await window.api.users.getAll().catch(() => []);
      }

      this.setState({
        kpis: kpisRes?.kpis || {},
        candidates: candRes?.candidates || [],
        milestones: msRes?.milestones || [],
        claims: claimsRes?.claims || [],
        disputes: dispRes?.disputes || [],
        payments: payRes?.payments || [],
        users: usersList || []
      });
    } catch (err) {
      console.error('Data refresh error:', err);
    }
  }

  async switchRole(userId) {
    this.setState({ loading: true });
    try {
      const res = await window.api.auth.switchRole({ user_id: userId });
      this.state.currentUser = res.user;
      this.showNotification(`Switched identity to ${res.user.full_name} (${res.user.role})`, 'info');
      
      // If user switched to case_manager, and was on users tab, move to dashboard
      if (res.user.role === 'case_manager' && this.state.activeTab === 'users') {
        this.state.activeTab = 'dashboard';
      }

      await this.refreshData();
    } catch (err) {
      this.showNotification('Failed to switch role: ' + err.message, 'error');
    } finally {
      this.setState({ loading: false });
    }
  }

  async saveSettings(newSettings) {
    this.setState({ loading: true });
    try {
      const res = await window.api.settings.update(newSettings);
      this.state.settings = res.values;
      this.showNotification('GCC settings and localization saved successfully!', 'success');
      this.notify();
    } catch (err) {
      this.showNotification('Failed to update settings: ' + err.message, 'error');
    } finally {
      this.setState({ loading: false });
    }
  }

  async updateProfile(profileData) {
    this.setState({ loading: true });
    try {
      const updated = await window.api.profile.update(profileData);
      this.state.currentUser = { ...this.state.currentUser, ...updated };
      this.showNotification('Profile details updated successfully!', 'success');
      this.notify();
      return updated;
    } catch (err) {
      this.showNotification('Failed to update profile: ' + err.message, 'error');
      throw err;
    } finally {
      this.setState({ loading: false });
    }
  }

  async resetPassword(passwordData) {
    this.setState({ loading: true });
    try {
      const res = await window.api.profile.resetPassword(passwordData);
      this.showNotification('Password successfully reset and updated!', 'success');
      return res;
    } catch (err) {
      this.showNotification('Password reset failed: ' + err.message, 'error');
      throw err;
    } finally {
      this.setState({ loading: false });
    }
  }
}

window.AppStore = new AppStoreClass();
