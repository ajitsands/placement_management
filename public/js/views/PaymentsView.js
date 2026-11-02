/**
 * Payments View - Financial Collections Ledger & Receipts
 * Powered by DataTable with multi-column sorting, search, pagination, child rows, and CSV export.
 */

function PaymentsView({ state }) {
  const { payments = [], kpis = {}, settings = {}, candidates = [], claims = [], milestones = [], users = [] } = state;
  const currency = settings.currency || 'BHD';
  const { useState, useMemo } = React;
  const SearchableSelect = window.SearchableSelect;

  // Session storage filter persistence
  const readSaved = (k, d = '') => {
    const v = sessionStorage.getItem('sands_payments_filter_' + k);
    return v !== null ? v : d;
  };

  const [selectedCandidate, setSelectedCandidate] = useState(() => readSaved('candidate'));
  const [selectedCaseManager, setSelectedCaseManager] = useState(() => readSaved('case_manager'));
  const [selectedMilestone, setSelectedMilestone] = useState(() => readSaved('milestone'));
  const [dateFrom, setDateFrom] = useState(() => readSaved('date_from'));
  const [dateTo, setDateTo] = useState(() => readSaved('date_to'));

  const persist = (setter, key) => (val) => {
    setter(val);
    sessionStorage.setItem('sands_payments_filter_' + key, val);
  };
  const handleCandidateChange = persist(setSelectedCandidate, 'candidate');
  const handleCaseManagerChange = persist(setSelectedCaseManager, 'case_manager');
  const handleMilestoneChange = persist(setSelectedMilestone, 'milestone');
  const handleDateFromChange = persist(setDateFrom, 'date_from');
  const handleDateToChange = persist(setDateTo, 'date_to');
  const handleClearDates = () => { handleDateFromChange(''); handleDateToChange(''); };
  const handleResetAll = () => {
    handleCandidateChange('');
    handleCaseManagerChange('');
    handleMilestoneChange('');
    handleClearDates();
  };

  const activeFiltersCount = (selectedCandidate ? 1 : 0) + (selectedCaseManager ? 1 : 0) + (selectedMilestone ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  // Lookups
  const candidateLookup = useMemo(() => {
    const m = new Map();
    (candidates || []).forEach(c => { if (c && c.id) m.set(String(c.id), c); });
    return m;
  }, [candidates]);

  const claimsLookup = useMemo(() => {
    const m = new Map();
    (claims || []).forEach(cl => { if (cl && cl.id) m.set(String(cl.id), cl); });
    return m;
  }, [claims]);

  const milestonesLookup = useMemo(() => {
    const m = new Map();
    (milestones || []).forEach(ms => { if (ms && ms.id) m.set(String(ms.id), ms); });
    return m;
  }, [milestones]);

  // Candidate Filter Options
  const candidateOptions = useMemo(() => {
    const map = new Map();
    (payments || []).forEach(p => {
      const candId = p.candidate_id;
      const cand = candId ? candidateLookup.get(String(candId)) : null;
      const name = p.candidate_name || cand?.full_name;
      const cpr = p.candidate_cpr || cand?.cpr_no;
      const ref = p.candidate_ref || cand?.ref_no;
      if (candId && name && !map.has(String(candId))) {
        map.set(String(candId), {
          value: String(candId),
          label: name,
          subLabel: `CPR: ${cpr || '—'} • ${ref || 'CR-' + candId}`,
          searchKeywords: `${name} ${cpr} ${ref}`
        });
      }
    });
    (candidates || []).forEach(c => {
      if (c && c.id && !map.has(String(c.id))) {
        map.set(String(c.id), {
          value: String(c.id),
          label: c.full_name || `Candidate #${c.id}`,
          subLabel: `CPR: ${c.cpr_no || '—'} • ${c.ref_no || 'CR-' + c.id}`,
          searchKeywords: `${c.full_name} ${c.cpr_no} ${c.ref_no}`
        });
      }
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: `All Candidates (${list.length})`, subLabel: 'Filter receipts across all candidates' }, ...list];
  }, [payments, candidates, candidateLookup]);

  // Case Manager Filter Options
  const caseManagerOptions = useMemo(() => {
    const set = new Set();
    (payments || []).forEach(p => {
      const cm = (p.case_manager_name || '').trim();
      if (cm && cm !== 'N/A' && cm !== 'System') set.add(cm);
    });
    (users || []).filter(u => u.role === 'case_manager' || u.role === 'admin').forEach(u => {
      const name = (u.case_manager_code || u.full_name || '').trim();
      if (name) set.add(name);
    });
    const list = Array.from(set).sort().map(cm => ({
      value: cm,
      label: cm,
      subLabel: 'Assigned Case Manager'
    }));
    return [{ value: '', label: `All Case Managers (${list.length})`, subLabel: 'Filter receipts by assigned case manager' }, ...list];
  }, [payments, users]);

  // Milestone Filter Options
  const milestoneOptions = [
    { value: '', label: 'All Milestones', subLabel: 'Show receipts across all retention gates' },
    { value: 'placement', label: 'Day 0 - Placement Claim', subLabel: 'Initial contract signing & placement subsidy' },
    { value: '180_days', label: 'Day 180 - 6-Month Retention', subLabel: '6-Month retention gate (+180d)' },
    { value: '365_days', label: 'Day 365 - 12-Month Retention', subLabel: 'Annual 12-Month retention gate (+365d)' }
  ];

  // Display Data with Filtering
  const displayData = useMemo(() => {
    return (payments || []).filter(p => {
      if (selectedCandidate && String(p.candidate_id) !== String(selectedCandidate)) return false;
      if (selectedCaseManager) {
        const cm = String(p.case_manager_name || '').toLowerCase().trim();
        if (cm !== String(selectedCaseManager).toLowerCase().trim()) return false;
      }
      if (selectedMilestone) {
        const msCode = String(p.milestone_code || '').toLowerCase();
        const msTitle = String(p.milestone_title || '').toLowerCase();
        const claimType = String(p.claim_type || '').toLowerCase();
        const sel = String(selectedMilestone).toLowerCase();
        if (!msCode.includes(sel) && !msTitle.includes(sel) && !claimType.includes(sel)) return false;
      }
      if (dateFrom) {
        const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
        if (pDate && pDate < dateFrom) return false;
      }
      if (dateTo) {
        const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
        if (pDate && pDate > dateTo) return false;
      }
      return true;
    });
  }, [payments, selectedCandidate, selectedCaseManager, selectedMilestone, dateFrom, dateTo]);

  // Print Receipt PDF Generator
  const generateReceiptHtml = (payment, appSettings = {}) => {
    const cur = appSettings.currency || 'BHD';
    const appName = appSettings.app_name || 'Candidate Placement & Claims Management Portal';
    const country = appSettings.country || 'Kingdom of Bahrain';
    const candName = payment.candidate_name || 'N/A';
    const candCpr = payment.candidate_cpr || 'N/A';
    const candRef = payment.candidate_ref || (payment.candidate_id ? `CR-${payment.candidate_id}` : 'N/A');
    const compName = payment.company_name || 'N/A';
    const compCr = payment.employer_cr || 'N/A';
    const claimRef = payment.claim_ref || (payment.claim_id ? `CLM-${String(payment.claim_id).padStart(4, '0')}` : 'N/A');
    const receiptNo = payment.receipt_no || `RCPT-${payment.id}`;
    const milestoneTitle = payment.milestone_title || 'Placement Claim (Day 0)';
    const amountPaid = Number(payment.amount_paid_bhd || 0).toFixed(3);
    const totalClaim = Number(payment.total_claim_amount_bhd || payment.amount_paid_bhd || 0).toFixed(3);
    const paymentDate = payment.payment_date ? (window.formatAppDate ? window.formatAppDate(payment.payment_date) : payment.payment_date) : new Date().toLocaleDateString();
    const paymentMethod = payment.payment_method || 'Bank Transfer';
    const refDoc = payment.reference_doc_no || 'Direct Settlement Advice';
    const cashierNotes = payment.cashier_notes || payment.notes || 'Disbursement verified against ministry quota and Tamkeen retention milestones.';
    const caseManager = payment.case_manager_name || 'System';
    const printTimestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Official Payment Receipt - ${receiptNo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .no-print {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      background: #0f172a;
      color: #ffffff;
      border-bottom: 2px solid #0284c7;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
    .receipt-container {
      max-width: 820px;
      margin: 0 auto;
      padding: 24px 32px;
      position: relative;
    }
    .watermark {
      position: absolute;
      top: 48%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 85px;
      font-weight: 900;
      color: rgba(16, 185, 129, 0.05);
      pointer-events: none;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      white-space: nowrap;
      z-index: 0;
    }
    .receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 18px;
      position: relative;
      z-index: 1;
    }
    .brand-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo {
      height: 58px;
      max-width: 140px;
      object-fit: contain;
    }
    .brand-info h1 {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .brand-info p {
      margin: 2px 0 0;
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }
    .receipt-meta-box {
      text-align: right;
    }
    .doc-pill {
      display: inline-block;
      background: #0284c7;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 3px 10px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .receipt-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 800;
      color: #0369a1;
      margin: 0;
    }
    .receipt-date {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 3px;
    }
    .amount-highlight {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1.5px solid #86efac;
      border-radius: 8px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
    }
    .amount-label {
      font-size: 11.5px;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .amount-num {
      font-size: 26px;
      font-weight: 900;
      color: #15803d;
      font-family: 'JetBrains Mono', monospace;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #15803d;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .info-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
      position: relative;
      z-index: 1;
    }
    .info-card-header {
      background: #f8fafc;
      padding: 8px 14px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 10px 14px;
      gap: 10px 20px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .info-item-label {
      font-size: 10.5px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .info-item-val {
      font-size: 12.5px;
      color: #0f172a;
      font-weight: 600;
    }
    .mono-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
    }
    .blue-pill { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .green-pill { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .neutral-pill { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

    .notes-box {
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      font-size: 12px;
      color: #334155;
      line-height: 1.45;
      margin-top: 4px;
    }
    .receipt-footer-bar {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      margin-top: 22px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-weight: 700; font-size: 14px;">🧾 Payment Receipt: ${receiptNo}</span>
      <span style="font-size: 12px; opacity: 0.8;">Select "Save as PDF" to download official PDF copy</span>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 7px 16px; border-radius: 5px; font-weight: 700; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
        🖨️ Print / Save as PDF
      </button>
      <button onclick="window.close()" style="background: #475569; color: white; border: none; padding: 7px 14px; border-radius: 5px; font-size: 13px; cursor: pointer;">
        ✕ Close
      </button>
    </div>
  </div>

  <div class="receipt-container">
    <div class="watermark">OFFICIALLY SETTLED</div>

    <!-- Official Header -->
    <div class="receipt-header">
      <div class="brand-group">
        <img src="/logo/propel_logo.jpeg" alt="Propel Logo" class="brand-logo" onerror="this.src='/logo/sands_logo_1.png'" />
        <div class="brand-info">
          <h1>${appName}</h1>
        </div>
      </div>
      <div class="receipt-meta-box">
        <span class="doc-pill">Official Disbursement Voucher</span>
        <div class="receipt-num">${receiptNo}</div>
        <div class="receipt-date">Payment Date: <strong>${paymentDate}</strong></div>
      </div>
    </div>

    <!-- Financial Amount Banner -->
    <div class="amount-highlight">
      <div>
        <div class="amount-label">Total Amount Disbursed & Received</div>
        <div class="amount-num">${cur} ${amountPaid}</div>
      </div>
      <div class="status-badge">
        <span>✓</span> Paid & Reconciled
      </div>
    </div>

    <!-- Card 1: Placement & Candidate Context -->
    <div class="info-card">
      <div class="info-card-header">
        <span>👤 Candidate & Placement Particulars</span>
        <span class="mono-pill neutral-pill">Candidate Ref: ${candRef}</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-item-label">Candidate Name</span>
          <span class="info-item-val" style="font-size: 13px; color: #0284c7;">${candName}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">CPR Identity Number</span>
          <span class="info-item-val" style="font-family: 'JetBrains Mono', monospace;">${candCpr}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Employer Name</span>
          <span class="info-item-val">${compName}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Commercial Registration (CR)</span>
          <span class="info-item-val">
            <span class="mono-pill neutral-pill">CR: ${compCr}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Card 2: Claim & Retention Milestone Audit -->
    <div class="info-card">
      <div class="info-card-header">
        <span>📑 Claim Subsidy & Gate Breakdown</span>
        <span class="mono-pill blue-pill">Claim Ref: ${claimRef}</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-item-label">Milestone Gate</span>
          <span class="info-item-val">${milestoneTitle}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Total Claim Approved Amount</span>
          <span class="info-item-val" style="font-family: 'JetBrains Mono', monospace;">${cur} ${totalClaim}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Payment Method</span>
          <span class="info-item-val">
            <span class="mono-pill green-pill">${paymentMethod}</span>
          </span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Payment / Transaction Ref</span>
          <span class="info-item-val" style="font-family: 'JetBrains Mono', monospace;">${refDoc}</span>
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <span class="info-item-label">Assigned Case Manager</span>
          <span class="info-item-val">${caseManager} &bull; Placement Retention Division</span>
        </div>
      </div>
    </div>

    <!-- Card 3: Cashier Audit Remarks -->
    <div class="info-card">
      <div class="info-card-header">
        <span>💬 Cashier Remarks & Audit Trail</span>
        <span style="font-size: 10px; color: #64748b;">Electronic Ledger Hash: #${payment.id}</span>
      </div>
      <div style="padding: 10px 14px;">
        <div class="notes-box">
          ${cashierNotes}
        </div>
      </div>
    </div>

    <!-- Official Document Footer -->
    <div class="receipt-footer-bar">
      <div>Kingdom of Bahrain &bull; General Placement Registry &bull; National Employment Ledger</div>
      <div style="margin-top: 3px; font-size: 9.5px;">Generated automatically on ${printTimestamp} &bull; Document Reference: ${receiptNo} &bull; All Rights Reserved</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  <\/script>
</body>
</html>`;
  };

  const handlePrintReceipt = (payment) => {
    const cand = candidateLookup.get(String(payment.candidate_id));
    const claim = claimsLookup.get(String(payment.claim_id));
    const ms = milestonesLookup.get(String(payment.milestone_id || claim?.milestone_id));

    const enriched = {
      ...payment,
      candidate_name: payment.candidate_name || cand?.full_name || 'N/A',
      candidate_cpr: payment.candidate_cpr || cand?.cpr_no || 'N/A',
      candidate_ref: payment.candidate_ref || cand?.ref_no || (cand?.id ? `CR-${String(cand.id).padStart(4, '0')}` : 'N/A'),
      company_name: payment.company_name || cand?.company_name || 'N/A',
      employer_cr: payment.employer_cr || cand?.employer_cr || claim?.employer_cr || '',
      claim_ref: payment.claim_ref || claim?.claim_ref || (payment.claim_id ? `CLM-${String(payment.claim_id).padStart(4, '0')}` : 'N/A'),
      milestone_title: payment.milestone_title || ms?.milestone_title || claim?.milestone_title || 'Placement Claim (Day 0)',
      total_claim_amount_bhd: payment.total_claim_amount_bhd || claim?.claim_amount_bhd || payment.amount_paid_bhd,
      case_manager_name: payment.case_manager_name || cand?.case_manager_name || claim?.case_manager_name || 'System'
    };

    const printWin = window.open('', '_blank', 'width=880,height=960,menubar=no,toolbar=no,location=no,status=no');
    if (!printWin) {
      window.AppStore.showNotification('Please allow popups in your browser to print receipt.', 'warning');
      return;
    }

    printWin.document.open();
    printWin.document.write(generateReceiptHtml(enriched, settings));
    printWin.document.close();
  };

  // Expandable Child Row
  const renderPaymentChildRow = (row) => {
    const cand = candidateLookup.get(String(row.candidate_id));
    const claim = claimsLookup.get(String(row.claim_id));
    const ms = milestonesLookup.get(String(row.milestone_id || claim?.milestone_id));
    const atts = row.attachments || [];
    const notes = row.cashier_notes || row.notes || '';

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.85rem',
        padding: '0.35rem 0'
      }}>
        {/* Box 1: Cashier Notes & Wire Advice */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>💬</span> Cashier Notes & Bank Reference
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45, background: 'var(--bg-tertiary, #f8fafc)', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
            {notes || 'No cashier notes recorded for this transaction.'}
          </div>
          {row.reference_doc_no && (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Bank Wire / Cheque Reference: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{row.reference_doc_no}</strong>
            </div>
          )}
        </div>

        {/* Box 2: Retention Gate & Financial Audit */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>📑</span> Milestone & Claim Audit Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Milestone Gate:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.milestone_title || ms?.milestone_title || 'Placement Claim (Day 0)'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Claim Value:</span>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                {currency} {Number(row.total_claim_amount_bhd || claim?.claim_amount_bhd || row.amount_paid_bhd || 0).toFixed(3)}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Case Manager:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.case_manager_name || 'System'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Disbursement Status:</span>
              <div style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Settled & Reconciled</div>
            </div>
          </div>
        </div>

        {/* Box 3: Attachments & Direct Quick Print */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>📎</span> Attachments & Proofs ({atts.length})
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', fontWeight: 600, color: 'var(--primary)', borderColor: 'var(--primary)' }}
              onClick={() => handlePrintReceipt(row)}
            >
              🖨️ Print PDF Receipt
            </button>
          </div>

          {atts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '110px', overflowY: 'auto' }}>
              {atts.map((a, idx) => (
                <a
                  key={a.id || idx}
                  href={a.file_url ? (a.file_url.startsWith('http') || a.file_url.startsWith('/') ? a.file_url : '/' + a.file_url) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="attachment-link"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    padding: '0.3rem 0.5rem',
                    background: 'var(--bg-tertiary, #f8fafc)',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    textDecoration: 'none',
                    color: 'var(--primary)'
                  }}
                  title={a.file_name}
                >
                  <span>📎</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name || a.file_name || `Attachment #${idx + 1}`}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.4rem 0' }}>
              No bank slips or supporting attachments uploaded.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Datatable Columns
  const columns = [
    {
      key: 'candidate_name',
      label: 'Candidate / References',
      sortable: true,
      render: (val, row) => {
        const cand = candidateLookup.get(String(row.candidate_id));
        const candName = row.candidate_name || cand?.full_name || val || '—';
        const candRef = row.candidate_ref || cand?.ref_no || (row.candidate_id ? `CR-${row.candidate_id}` : 'N/A');
        const candCpr = row.candidate_cpr || cand?.cpr_no || '—';
        const receiptNo = row.receipt_no || (row.id ? `RCPT-${row.id}` : '—');
        const claimRef = row.claim_ref || (row.claim_id ? `CLM-${String(row.claim_id).padStart(4, '0')}` : '—');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              {candName}
            </strong>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>CPR: {candCpr}</span>
              <span>&bull;</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{candRef}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
              <span
                className="badge badge-success"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  padding: '0.12rem 0.48rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  textTransform: 'none'
                }}
                title="Payment Receipt Number"
              >
                {receiptNo}
              </span>
              {claimRef && claimRef !== '—' && (
                <span
                  className="badge badge-info"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    padding: '0.12rem 0.48rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    textTransform: 'none'
                  }}
                  title="Claim Reference Number"
                >
                  {claimRef}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'company_name',
      label: 'Employer',
      sortable: true,
      render: (val, row) => {
        const cand = candidateLookup.get(String(row.candidate_id));
        const cr = (row.employer_cr && row.employer_cr !== 'N/A') ? row.employer_cr : (cand?.employer_cr || '');
        return (
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {val || row.company_name || '—'}
            </div>
            {cr ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '0.2rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '3px',
                  padding: '0.05rem 0.35rem',
                  whiteSpace: 'nowrap'
                }}
                title="Employer Commercial Registration (CR) Number"
              >
                <span style={{ opacity: 0.75 }}>CR:</span> <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{cr}</span>
              </span>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'payment_date',
      label: 'Payment Date',
      sortable: true,
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}>
          {window.formatAppDate ? window.formatAppDate(val) : val}
        </span>
      )
    },
    {
      key: 'milestone_title',
      label: 'Milestone Gate',
      sortable: true,
      render: (val, row) => {
        const ms = milestonesLookup.get(String(row.milestone_id));
        return (
          <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {val || ms?.milestone_title || 'Placement Claim (Day 0)'}
          </span>
        );
      }
    },
    {
      key: 'amount_paid_bhd',
      label: 'Amount Paid',
      sortable: true,
      render: (val) => (
        <strong style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>
          {currency} {Number(val || 0).toFixed(3)}
        </strong>
      )
    },
    {
      key: 'payment_method',
      label: 'Payment Method',
      sortable: true,
      render: (val, row) => (
        <div>
          <span className="badge badge-neutral" style={{ fontSize: '0.74rem' }}>
            {val || 'Bank Transfer'}
          </span>
          {row.reference_doc_no && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
              {row.reference_doc_no}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'case_manager_name',
      label: 'Case Manager',
      sortable: true,
      render: (val) => <span className="badge badge-neutral" style={{ fontSize: '0.74rem' }}>{val || 'System'}</span>
    },
    {
      key: 'actions',
      label: 'Print Voucher',
      sortable: false,
      render: (_, row) => (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.76rem',
            padding: '0.25rem 0.6rem',
            fontWeight: 600,
            color: 'var(--primary)',
            borderColor: 'var(--primary)'
          }}
          title="Print official payment receipt voucher or save as PDF"
          onClick={() => handlePrintReceipt(row)}
        >
          <span>🖨️</span> Print PDF
        </button>
      )
    }
  ];

  const labelStyle = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' };
  const filterBox = (flex, min) => ({ display: 'flex', alignItems: 'center', gap: '0.45rem', flex, minWidth: min });

  const totalFilteredCollected = useMemo(() => {
    return displayData.reduce((sum, p) => sum + Number(p.amount_paid_bhd || 0), 0);
  }, [displayData]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Financial Collections Ledger</h1>
          <p className="page-subtitle">
            Tamkeen and Directorate disbursement receipt tracking with real-time balance reconciliation
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card success">
          <div className="kpi-header">
            <span className="kpi-title">Total Collected</span>
            <div className="kpi-icon">💰</div>
          </div>
          <div className="kpi-value">
            {currency} {Number(hasActiveFilters ? totalFilteredCollected : (kpis.total_collected_bhd || totalFilteredCollected)).toLocaleString('en-US', { minimumFractionDigits: 3 })}
          </div>
          <div className="kpi-subtext">
            {hasActiveFilters ? `Filtered across ${displayData.length} receipts` : 'Realized revenue across all receipts'}
          </div>
        </div>

        <div className="kpi-card danger">
          <div className="kpi-header">
            <span className="kpi-title">Uncollected Balance</span>
            <div className="kpi-icon">📉</div>
          </div>
          <div className="kpi-value">
            {currency} {Number(kpis.total_outstanding_bhd || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}
          </div>
          <div className="kpi-subtext">Pending payment from ministry / treasury</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Receipts Issued</span>
            <div className="kpi-icon">🧾</div>
          </div>
          <div className="kpi-value">
            {displayData.length}
            {hasActiveFilters && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.35rem' }}>
                of {payments.length}
              </span>
            )}
          </div>
          <div className="kpi-subtext">Audited financial transactions</div>
        </div>
      </div>

      {/* Top Filter Bar */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          overflow: 'visible',
          position: 'relative',
          zIndex: 20
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          {/* Candidate Filter */}
          <div style={filterBox('1 1 230px', '210px')}>
            <label style={labelStyle}><span>👤</span> Candidate:</label>
            <div style={{ flex: 1, minWidth: '150px' }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={candidateOptions}
                  value={selectedCandidate}
                  onChange={handleCandidateChange}
                  placeholder={candidateOptions[0]?.label || 'All Candidates'}
                  searchPlaceholder="Search candidate, CPR, ref..."
                />
              ) : (
                <select className="select-control" value={selectedCandidate} onChange={e => handleCandidateChange(e.target.value)}>
                  {candidateOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Case Manager Filter */}
          <div style={filterBox('1 1 200px', '180px')}>
            <label style={labelStyle}><span>👔</span> Case Manager:</label>
            <div style={{ flex: 1, minWidth: '130px' }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={caseManagerOptions}
                  value={selectedCaseManager}
                  onChange={handleCaseManagerChange}
                  placeholder="All Case Managers"
                  searchPlaceholder="Search case manager..."
                />
              ) : (
                <select className="select-control" value={selectedCaseManager} onChange={e => handleCaseManagerChange(e.target.value)}>
                  {caseManagerOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Milestone Gate Filter */}
          <div style={filterBox('1 1 200px', '180px')}>
            <label style={labelStyle}><span>🎯</span> Milestone:</label>
            <div style={{ flex: 1, minWidth: '130px' }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={milestoneOptions}
                  value={selectedMilestone}
                  onChange={handleMilestoneChange}
                  placeholder="All Milestones"
                  searchPlaceholder="Search gate..."
                />
              ) : (
                <select className="select-control" value={selectedMilestone} onChange={e => handleMilestoneChange(e.target.value)}>
                  {milestoneOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Receipt Date Range Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
            <label style={labelStyle}><span>📅</span> Receipt Date:</label>
            <input
              type="date"
              className="input-control"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
              value={dateFrom}
              onChange={e => handleDateFromChange(e.target.value)}
              title="Receipt Date From"
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="input-control"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: '130px' }}
              value={dateTo}
              onChange={e => handleDateToChange(e.target.value)}
              title="Receipt Date To"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handleClearDates}
                title="Clear Receipt Date filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  padding: '0 0.25rem',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.76rem', color: 'var(--danger)', borderColor: 'var(--danger)', padding: '0.25rem 0.65rem' }}
              onClick={handleResetAll}
              title="Reset all active filters"
            >
              ✕ Clear All Filters ({activeFiltersCount})
            </button>
          </div>
        )}
      </div>

      {/* DataTable */}
      <div className="card">
        <window.DataTable
          columns={columns}
          data={displayData}
          expandable={true}
          renderChildRow={renderPaymentChildRow}
          searchPlaceholder="🔍 Search Candidate, Ref, CPR, Receipt No, Claim Ref, Employer, Case Manager..."
          searchKeys={[
            'receipt_no',
            'claim_ref',
            'candidate_name',
            'candidate_cpr',
            'candidate_ref',
            'company_name',
            'employer_cr',
            'payment_method',
            'reference_doc_no',
            'case_manager_name',
            'milestone_title',
            'cashier_notes',
            'notes'
          ]}
          exportFilename="Payment_Collections_SaNDS.csv"
          emptyMessage="No payment receipt records found matching your filters."
        />
      </div>
    </div>
  );
}

window.PaymentsView = PaymentsView;
