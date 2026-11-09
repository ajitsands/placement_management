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

  profile = {
    get: () => this.request('/profile'),
    update: (profileData) => this.request('/profile', { method: 'POST', body: profileData }),
    resetPassword: (passwordData) => this.request('/profile/password', { method: 'POST', body: passwordData })
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
    batchPlacement: (data) => this.request('/candidates/batch-placement', { method: 'POST', body: data }),
    updateStatus: (id, status, remarks) => this.request(`/candidates/${id}/status`, { method: 'POST', body: { status, remarks } }),
    uploadDocument: (data) => this.request('/candidates/upload', { method: 'POST', body: data }),
    addDocument: (id, doc) => this.request(`/candidates/${id}/documents`, { method: 'POST', body: doc }),
    deleteDocument: (id, docId) => this.request(`/candidates/${id}/documents/${docId}`, { method: 'DELETE' }),
    updateChecklist: (id, checked) => this.request(`/candidates/${id}/checklist`, { method: 'POST', body: { checked } }),
    renew: (id, data) => this.request(`/candidates/${id}/renew`, { method: 'POST', body: data }),
    getActivities: (id) => this.request(`/candidates/${id}/activities`)
  };

  jobs = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/jobs${qs ? '?' + qs : ''}`);
    },
    getNextCode: () => this.request('/jobs/next-code'),
    getOne: (id) => this.request(`/jobs/${id}`),
    create: (data) => this.request('/jobs', { method: 'POST', body: data }),
    update: (id, data) => this.request(`/jobs/${id}`, { method: 'PUT', body: data }),
    delete: (id) => this.request(`/jobs/${id}`, { method: 'DELETE' })
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
    update: (id, disputeData) => this.request(`/disputes/${id}`, { method: 'PUT', body: disputeData }),
    uploadAttachment: (data) => this.request('/disputes/upload', { method: 'POST', body: data }),
    reinstate: (id, payload) => {
      const body = typeof payload === 'object' ? payload : { notes: payload };
      return this.request(`/disputes/${id}/reinstate`, { method: 'POST', body });
    },
    terminate: (id, payload) => {
      const body = typeof payload === 'object' ? payload : { notes: payload };
      return this.request(`/disputes/${id}/terminate`, { method: 'POST', body });
    }
  };

  payments = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/payments${qs ? '?' + qs : ''}`);
    },
    getNextRef: () => this.request('/payments/next-ref'),
    uploadAttachment: (data) => this.request('/payments/upload', { method: 'POST', body: data }),
    create: (paymentData) => this.request('/payments', { method: 'POST', body: paymentData }),
    recordPayment: (paymentData) => this.request('/payments', { method: 'POST', body: paymentData })
  };

  checklistMaster = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/checklist-master${qs ? '?' + qs : ''}`);
    },
    getOne: (id) => this.request(`/checklist-master/${id}`),
    create: (data) => this.request('/checklist-master', { method: 'POST', body: data }),
    update: (id, data) => this.request(`/checklist-master/${id}`, { method: 'PUT', body: data }),
    delete: (id) => this.request(`/checklist-master/${id}`, { method: 'DELETE' }),
    evaluate: (checked) => this.request('/checklist-master/evaluate', { method: 'POST', body: { checked } })
  };

  documentCategories = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/document-categories${qs ? '?' + qs : ''}`);
    },
    getOne: (id) => this.request(`/document-categories/${id}`),
    create: (data) => this.request('/document-categories', { method: 'POST', body: data }),
    update: (id, data) => this.request(`/document-categories/${id}`, { method: 'PUT', body: data }),
    delete: (id) => this.request(`/document-categories/${id}`, { method: 'DELETE' })
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

  activities = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/activities${qs ? '?' + qs : ''}`);
    },
    getByCaseManager: (caseManager, params = {}) => {
      const qs = new URLSearchParams({ case_manager: caseManager, ...params }).toString();
      return this.request(`/activities?${qs}`);
    }
  };

  events = {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/events${qs ? '?' + qs : ''}`);
    },
    getNextCode: (moduleType = 'training') => this.request(`/events/next-code?module_type=${encodeURIComponent(moduleType)}`),
    getOne: (id) => this.request(`/events/${id}`),
    create: (data) => this.request('/events', { method: 'POST', body: data }),
    update: (id, data) => this.request(`/events/${id}`, { method: 'PUT', body: data }),
    delete: (id) => this.request(`/events/${id}`, { method: 'DELETE' }),
    getAttendees: (id) => this.request(`/events/${id}/attendees`),
    addAttendee: (eventId, data) => this.request(`/events/${eventId}/attendees`, { method: 'POST', body: data }),
    removeAttendee: (eventId, candidateId) => this.request(`/events/${eventId}/attendees/${candidateId}`, { method: 'DELETE' }),
    updateAttendee: (eventId, candidateId, data) => this.request(`/events/${eventId}/attendees/${candidateId}`, { method: 'PUT', body: data })
  };
}

window.api = new ApiService();
