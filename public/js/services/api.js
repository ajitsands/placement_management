/**
 * Micro API Client Service
 * High-efficiency RESTful communication with load-balancing headers (X-User-Id, X-User-Role)
 */

const API_BASE = '/Claims/api'; // Or '/api' depending on deployment route

class ApiService {
  constructor() {
    this.baseUrl = window.location.pathname.includes('/Claims') ? '/Claims/api' : '/api';
  }

  getHeaders() {
    const user = window.AppStore ? window.AppStore.getState().currentUser : null;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (user) {
      headers['X-User-Id'] = user.id;
      headers['X-User-Role'] = user.role;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || `HTTP Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      return data?.data !== undefined ? data.data : data;
    } catch (err) {
      console.error(`[MicroAPI Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // Micro API Modules
  auth = {
    login: (username, password) => this.request('/auth/login', { method: 'POST', body: { username, password } }),
    me: () => this.request('/auth/me'),
    switchRole: (params) => this.request('/auth/switch', { method: 'POST', body: params }),
    logout: () => this.request('/auth/logout', { method: 'POST' })
  };

  users = {
    getAll: () => this.request('/users'),
    getOne: (id) => this.request(`/users/${id}`),
    create: (userData) => this.request('/users', { method: 'POST', body: userData }),
    update: (id, userData) => this.request(`/users/${id}`, { method: 'PUT', body: userData }),
    toggleStatus: (id, is_active) => this.request(`/users/${id}/toggle-status`, { method: 'POST', body: { is_active } }),
    getCaseManagers: () => this.request('/case-managers')
  };

  candidates = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/candidates${qs ? '?' + qs : ''}`);
    },
    getOne: (id) => this.request(`/candidates/${id}`),
    getNextRef: () => this.request('/candidates/next-ref'),
    create: (data) => this.request('/candidates', { method: 'POST', body: data }),
    update: (id, data) => this.request(`/candidates/${id}`, { method: 'PUT', body: data }),
    linkPlacement: (id, data) => this.request(`/candidates/${id}/placement`, { method: 'POST', body: data }),
    updateStatus: (id, status, remarks) => this.request(`/candidates/${id}/status`, { method: 'POST', body: { status, remarks } }),
    uploadDocument: (data) => this.request('/candidates/upload', { method: 'POST', body: data }),
    addDocument: (id, doc) => this.request(`/candidates/${id}/documents`, { method: 'POST', body: doc }),
    deleteDocument: (id, docId) => this.request(`/candidates/${id}/documents/${docId}`, { method: 'DELETE' })
  };

  milestones = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/milestones${qs ? '?' + qs : ''}`);
    },
    getDue: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/milestones/due${qs ? '?' + qs : ''}`);
    },
    update: (id, data) => this.request(`/milestones/${id}`, { method: 'PUT', body: data })
  };

  claims = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/claims${qs ? '?' + qs : ''}`);
    },
    getOne: (id) => this.request(`/claims/${id}`),
    create: (claimData) => this.request('/claims', { method: 'POST', body: claimData }),
    update: (id, claimData) => this.request(`/claims/${id}`, { method: 'PUT', body: claimData }),
    approve: (id, remarks) => this.request(`/claims/${id}/approve`, { method: 'POST', body: { remarks } })
  };

  disputes = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/disputes${qs ? '?' + qs : ''}`);
    },
    getReasons: () => this.request('/dispute-reasons'),
    addReason: (reason) => this.request('/dispute-reasons', { method: 'POST', body: { reason } }),
    create: (disputeData) => this.request('/disputes', { method: 'POST', body: disputeData }),
    reinstate: (id, notes) => this.request(`/disputes/${id}/reinstate`, { method: 'POST', body: { notes } }),
    terminate: (id, notes) => this.request(`/disputes/${id}/terminate`, { method: 'POST', body: { notes } })
  };

  payments = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/payments${qs ? '?' + qs : ''}`);
    },
    recordPayment: (paymentData) => this.request('/payments', { method: 'POST', body: paymentData })
  };

  settings = {
    get: () => this.request('/settings'),
    update: (newSettings) => this.request('/settings', { method: 'PUT', body: newSettings })
  };

  reports = {
    getKPIs: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/reports/kpis${qs ? '?' + qs : ''}`);
    },
    generate: (type, params = {}) => {
      const qs = new URLSearchParams({ type, ...params }).toString();
      return this.request(`/reports${qs ? '?' + qs : ''}`);
    }
  };
}

window.api = new ApiService();
