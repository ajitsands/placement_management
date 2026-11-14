/**
 * Modal System Component
 * Handles interactive dialogs for Candidate Registration, Placement Linking, Status Management,
 * Multiple Document Uploads, Manual Claim Entry, Payment Receipts, Disputes, and Candidate Timelines
 */

const { useState, useEffect, useMemo, useCallback } = React;

// Shared dispute helpers (used across Claims, Milestones, Disputes pages and the details modal)
window.getDisputeForRow = function (disputes, { claim_id, milestone_id } = {}) {
  const matches = (disputes || []).filter(d =>
    (claim_id && Number(d.claim_id) === Number(claim_id)) ||
    (milestone_id && d.milestone_id && Number(d.milestone_id) === Number(milestone_id))
  );
  if (!matches.length) return null;
  const latest = (list) => list.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a));
  const active = matches.filter(d => d.status === 'active_dispute');
  return latest(active.length ? active : matches);
};

window.getDisputeRef = function (dispute) {
  return dispute && dispute.id ? `DSP-${String(dispute.id).padStart(4, '0')}` : null;
};

window.disputeFileUrl = function (url) {
  if (!url) return '#';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('/') || url.startsWith('data:')) return url;
  const base = window.location.pathname.includes('/Claims') ? '/Claims/' : '/';
  return base + url.replace(/^\.?\//, '');
};

function Modals({ state }) {
  const { modal, candidates, claims, caseManagers, currentUser, settings } = state;
  if (!modal) return null;

  const { type, props } = modal;

  return (
    <div className="modal-overlay">
      {type === 'NEW_CANDIDATE' && <NewCandidateModal state={state} initialCenter={props?.initialCenter || props?.center} eventId={props?.eventId} onCandidateCreated={props?.onCandidateCreated} />}
      {type === 'LINK_PLACEMENT' && <LinkPlacementModal state={state} candidate={props?.candidate} job={props?.job} />}
      {type === 'BATCH_PLACEMENT' && <BatchPlacementModal state={state} initialJobId={props?.jobId || props?.job?.id} />}
      {type === 'NEW_JOB' && <JobModal state={state} />}
      {type === 'EDIT_JOB' && <JobModal state={state} job={props?.job} />}
      {type === 'SCHEDULE_INTERVIEW' && <ScheduleInterviewModal state={state} initialJob={props?.job} initialJobId={props?.jobId || props?.job?.id} />}
      {type === 'JOB_INTERVIEWS' && <JobInterviewsModal state={state} job={props?.job} jobId={props?.jobId || props?.job?.id} initialInterviewId={props?.interviewId} />}
      {type === 'PLACEMENT_DOSSIER' && <PlacementDossierModal state={state} candidate={props?.candidate} />}
      {type === 'UPDATE_STATUS' && <UpdateStatusModal state={state} candidate={props?.candidate} />}
      {type === 'CANDIDATE_DOCUMENTS' && <CandidateDocumentsModal state={state} candidate={props?.candidate} />}
      {type === 'CANDIDATE_CHECKLIST' && <CandidateChecklistModal state={state} candidate={props?.candidate} />}
      {type === 'CANDIDATE_DETAIL' && <CandidateDetailModal state={state} candidate={props?.candidate} />}
      {type === 'NEW_CLAIM' && <NewClaimModal state={state} initialProps={props} />}
      {type === 'NEW_PAYMENT' && <NewPaymentModal state={state} initialProps={props} />}
      {type === 'CLAIM_PAYMENTS' && <ClaimPaymentsModal state={state} claim={props?.claim} />}
      {type === 'NEW_DISPUTE' && <NewDisputeModal state={state} initialProps={props} />}
      {type === 'DISPUTE_DETAILS' && <DisputeDetailsModal state={state} initialProps={props} />}
      {type === 'EDIT_USER' && <EditUserModal state={state} user={props?.user} />}
      {type === 'EDIT_CLAIM_AMOUNT' && <EditClaimAmountModal state={state} milestone={props?.milestone} claim={props?.claim} />}
      {type === 'RENEW_CANDIDATE' && <RenewCandidateModal state={state} candidate={props?.candidate} fromPlaced={props?.fromPlaced} />}
      {type === 'TAMKEEN_APPROVAL' && <TamkeenApprovalModal state={state} candidate={props?.candidate} />}
      {type === 'CANDIDATE_ACTIVITY_LOG' && <CandidateActivityLogModal state={state} initialCandidateId={props?.candidateId || props?.candidate?.id} />}
      {type === 'CASE_MANAGER_ACTIVITIES' && <CaseManagerActivitiesModal state={state} targetCM={props?.caseManager || props?.cmName} />}
      {(type === 'SANDS_PROFILE' || type === 'PRODUCTS_SHOWCASE') && <SandsCompanyProfileModal state={state} />}
    </div>
  );
}

// 1. New Candidate Registration Modal with Multiple Document Upload & Optional Placement Linker
function NewCandidateModal({ state, initialCenter, eventId, onCandidateCreated }) {
  const { currentUser, caseManagers, settings } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const currency = settings.currency || 'BHD';

  // Candidate Registration Parameters
  const [form, setForm] = useState({
    ref_no: '',
    full_name: '',
    cpr_no: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: 'Male',
    education: 'Bachelor Degree',
    registration_date: new Date().toISOString().split('T')[0],
    remarks: '',
    status: 'registered',
    center: initialCenter || 'Enma Mall',
    case_manager_name: currentUser.role === 'case_manager' 
      ? (currentUser.case_manager_code || currentUser.full_name) 
      : (caseManagers[0]?.case_manager_code || 'Husain')
  });

  const [autoRefHint, setAutoRefHint] = useState('');

  // Auto-derive Date of Birth from Bahrain CPR (YYMMDD format)
  const handleCprChange = (val) => {
    const next = { ...form, cpr_no: val };
    const clean = val.replace(/\D/g, '');
    if (clean.length >= 6 && !form.date_of_birth) {
      const yy = parseInt(clean.substring(0, 2), 10);
      const mm = clean.substring(2, 4);
      const dd = clean.substring(4, 6);
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        const fullYear = yy <= 30 ? 2000 + yy : 1900 + yy;
        next.date_of_birth = `${fullYear}-${mm}-${dd}`;
      }
    }
    setForm(next);
  };

  // Fetch next available reference preview on load
  useEffect(() => {
    let active = true;
    window.api.candidates.getNextRef()
      .then(res => {
        if (active && res?.next_ref) {
          setAutoRefHint(res.next_ref);
        }
      })
      .catch(() => {
        if (active) setAutoRefHint('JCP/26/268525');
      });
    return () => { active = false; };
  }, []);

  // Candidate Registration Checklist Master & Real-Time Percentage
  const checklistMasters = state?.checklistMasters || [];
  const documentCategories = state?.documentCategories || [];
  const activeDocCategories = useMemo(() => {
    const list = (documentCategories || []).filter(c => c.is_active !== 0 && c.is_active !== false);
    if (list.length > 0) return list;
    return [
      { id: 1, code: 'CPR', name: 'CPR / Smart Card Copy', icon: '🆔', description: 'Valid Kingdom of Bahrain CPR Smart Card front/back copy or National ID proof.' },
      { id: 2, code: 'RESUME', name: 'Resume / CV', icon: '📄', description: 'Current professional curriculum vitae detailing education and employment background.' },
      { id: 3, code: 'DEGREE', name: 'Educational Degree / Certificate', icon: '🎓', description: 'Graduation diploma or accredited academic qualification certificate.' },
      { id: 4, code: 'CONTRACT', name: 'Employment Offer / Contract', icon: '📝', description: 'Formal tripartite or bilateral employment agreement signed with sponsoring employer.' },
      { id: 5, code: 'GOSI', name: 'GOSI Certificate', icon: '📑', description: 'Official Social Insurance (GOSI) record demonstrating employment and contribution history.' },
      { id: 6, code: 'OTHER', name: 'Other Supporting Document', icon: '📎', description: 'Supplementary certificates, licenses, or professional credentials.' }
    ];
  }, [documentCategories]);

  // Multiple Document Upload Area State
  const [documents, setDocuments] = useState([]);
  const [uploadDocType, setUploadDocType] = useState(() => activeDocCategories[0]?.name || 'CPR / Smart Card Copy');
  const [uploadDocName, setUploadDocName] = useState(() => activeDocCategories[0]?.name || 'CPR / Smart Card Copy');
  const [saving, setSaving] = useState(false);

  const selectedDocCategory = activeDocCategories.find(c => 
    c.name === uploadDocType || 
    c.code === uploadDocType ||
    String(c.name).trim().toLowerCase() === String(uploadDocType).trim().toLowerCase()
  ) || activeDocCategories[0] || null;

  const [checkedItems, setCheckedItems] = useState(() => new Set());

  const activeChecklistMasters = useMemo(() => {
    if (Array.isArray(checklistMasters) && checklistMasters.length > 0) {
      return checklistMasters.filter(m => m.is_active !== 0);
    }
    return [
      { id: 1, code: 'CPR_VERIF', title: 'CPR Identity & Smart Card Verification', weight: 25, is_mandatory: 1, category: 'Identity & Legal', description: 'Valid Bahrain CPR Smart Card copy uploaded and identity confirmed against National Population Registry.' },
      { id: 2, code: 'CV_RESUME', title: 'Curriculum Vitae (CV / Resume) Vetted', weight: 20, is_mandatory: 1, category: 'Profile & Qualifications', description: 'Current professional resume submitted, verified, and tagged with candidate specializations.' },
      { id: 3, code: 'EDU_CERT', title: 'Educational Certificate / Attested Degree', weight: 20, is_mandatory: 1, category: 'Profile & Qualifications', description: 'Verified graduation degree or diploma certificate from accredited institution.' },
      { id: 4, code: 'BANK_IBAN', title: 'Bank Account IBAN Certificate', weight: 15, is_mandatory: 1, category: 'Banking & Compliance', description: 'Official bank account verification letter / IBAN certificate in candidate name.' },
      { id: 5, code: 'GOSI_RECORD', title: 'GOSI Employment History / Status Record', weight: 10, is_mandatory: 0, category: 'Compliance & Verification', description: 'Social insurance contribution clearance confirming candidate eligibility.' },
      { id: 6, code: 'MOL_AGREE', title: 'MOL & Placement Retention Consent', weight: 10, is_mandatory: 1, category: 'Compliance & Verification', description: 'Signed candidate acknowledgment of Ministry of Labour employment terms.' }
    ];
  }, [checklistMasters]);

  const checklistEval = useMemo(() => {
    let totalWeight = 0;
    let earnedWeight = 0;
    const missingMandatory = [];

    activeChecklistMasters.forEach(item => {
      const w = parseInt(item.weight, 10) || 10;
      totalWeight += w;
      const isChecked = checkedItems.has(item.code) || checkedItems.has(String(item.id)) || checkedItems.has(Number(item.id));
      if (isChecked) {
        earnedWeight += w;
      } else if (item.is_mandatory) {
        missingMandatory.push(item);
      }
    });

    const percentage = totalWeight > 0 ? Math.min(100, Math.round((earnedWeight / totalWeight) * 100)) : 0;
    const canProceed = missingMandatory.length === 0;

    return {
      totalWeight,
      earnedWeight,
      percentage,
      canProceed,
      missingMandatory,
      items: activeChecklistMasters
    };
  }, [activeChecklistMasters, checkedItems]);

  const toggleChecklist = (codeOrId) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(codeOrId)) next.delete(codeOrId);
      else next.add(codeOrId);
      return next;
    });
  };

  const handleSelectAllChecklist = () => {
    const next = new Set();
    activeChecklistMasters.forEach(m => {
      next.add(m.code);
      next.add(String(m.id));
    });
    setCheckedItems(next);
  };

  const handleClearAllChecklist = () => {
    setCheckedItems(new Set());
  };

  const autoCheckFromDocType = (docType) => {
    const dt = String(docType || '').toLowerCase();
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (dt.includes('cpr') || dt.includes('smart card')) next.add('CPR_VERIF');
      if (dt.includes('cv') || dt.includes('resume')) next.add('CV_RESUME');
      if (dt.includes('degree') || dt.includes('educat') || dt.includes('graduat')) next.add('EDU_CERT');
      if (dt.includes('iban') || dt.includes('bank')) next.add('BANK_IBAN');
      if (dt.includes('gosi')) next.add('GOSI_RECORD');
      if (dt.includes('contract') || dt.includes('offer') || dt.includes('mol') || dt.includes('consent')) next.add('MOL_AGREE');
      return next;
    });
  };

  // Handle local file selection for multiple document uploads
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target.result;
        const newDoc = {
          id: 'TEMP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          name: uploadDocName.trim() || file.name.replace(/\.[^/.]+$/, ""),
          type: uploadDocType,
          file_name: file.name,
          file_size: file.size,
          file_data: base64Data,
          uploaded_at: new Date().toISOString()
        };
        setDocuments(prev => [...prev, newDoc]);
        autoCheckFromDocType(uploadDocType);
        setUploadDocName(uploadDocType);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeDocument = (id) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.cpr_no.trim()) {
      window.AppStore.showNotification('Full name and CPR Number are mandatory', 'error');
      return;
    }

    // If mandatory criteria are missing, classify as registration_incomplete (allow saving)
    const isIncomplete = !checklistEval.canProceed;

    setSaving(true);
    try {
      const payload = {
        ...form,
        center: form.center || initialCenter || 'Enma Mall',
        event_id: eventId || null,
        ref_no: form.ref_no.trim(), // Custom ref if provided, otherwise empty string allows backend to auto-generate
        phone: form.phone.trim(),
        email: form.email.trim(),
        status: isIncomplete ? 'registration_incomplete' : (form.status || 'registered'),
        checklist_items: Array.from(checkedItems),
        documents: documents.map(d => ({
          name: d.name,
          type: d.type,
          file_name: d.file_name,
          file_size: d.file_size,
          file_data: d.file_data
        }))
      };

      const created = await window.api.candidates.create(payload);
      if (typeof onCandidateCreated === 'function') {
        try { onCandidateCreated(created); } catch (e) {}
      }
      if (isIncomplete) {
        sessionStorage.setItem('sands_claims_cand_status_v2', 'registration_incomplete');
        sessionStorage.setItem('sands_claims_cand_status', 'registration_incomplete');
        window.dispatchEvent(new CustomEvent('cand_filter_status_change', { detail: 'registration_incomplete' }));
        window.AppStore.showNotification(
          `Candidate saved in 'Incomplete Profile' list (${checklistEval.percentage}% complete) with Ref ${created.ref_no}`,
          'warning'
        );
      } else {
        sessionStorage.setItem('sands_claims_cand_status_v2', 'registered');
        sessionStorage.setItem('sands_claims_cand_status', 'registered');
        window.dispatchEvent(new CustomEvent('cand_filter_status_change', { detail: 'registered' }));
        window.AppStore.showNotification(
          `Candidate registered successfully with Ref ${created.ref_no}!`, 
          'success'
        );
      }
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error registering candidate: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">➕ Candidate Registration Module</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Register candidate personal profile, attach verification documents & verify compliance checklist
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* SECTION 1: CANDIDATE PERSONAL PARAMETERS (BALANCED 2-COLUMN GRID) */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👤</span> Candidate Personal Parameters
            </h3>

            {/* Row 1: Full Name & CPR Number */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="input-control"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>CPR Number *</label>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Auto-fills Date of Birth</span>
                </div>
                <input
                  type="text"
                  className="input-control"
                  value={form.cpr_no}
                  onChange={e => handleCprChange(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Row 2: Contact Phone & Email */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contact Phone No.</label>
                <input
                  type="tel"
                  className="input-control"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contact Email Address</label>
                <input
                  type="email"
                  className="input-control"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Date of Birth & Gender */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Date of Birth</label>
                  {form.date_of_birth && window.calculateAge && window.calculateAge(form.date_of_birth) !== null && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                      🎂 {window.calculateAge(form.date_of_birth)} yrs old
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  className="input-control"
                  value={form.date_of_birth}
                  onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Gender *</label>
                <select className="select-control" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Unspecified">Unspecified</option>
                </select>
              </div>
            </div>

            {/* Row 3: Education Level & Registration Date */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Education Level *</label>
                <select className="select-control" value={form.education} onChange={e => setForm({ ...form, education: e.target.value })}>
                  <option value="High School">High School (Thaniwya)</option>
                  <option value="Diploma">Diploma / Associate Degree</option>
                  <option value="Bachelor Degree">Bachelor Degree (BSc / BA)</option>
                  <option value="Master Degree">Master Degree (MSc / MBA)</option>
                  <option value="Doctorate / PhD">Doctorate / PhD</option>
                  <option value="Vocational / Technical">Vocational / Technical Certification</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Registration Date *</label>
                <input
                  type="date"
                  className="input-control"
                  value={form.registration_date}
                  onChange={e => setForm({ ...form, registration_date: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Row 4: Candidate Reference Number & Status */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Candidate Reference No.</label>
                  <span style={{ fontSize: '0.7rem', color: form.ref_no ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {form.ref_no.trim() ? 'Custom Ref' : (autoRefHint ? `Auto: ${autoRefHint}` : 'Auto-generating...')}
                  </span>
                </div>
                <input
                  type="text"
                  className="input-control"
                  placeholder={autoRefHint ? `Leave blank to auto-generate (${autoRefHint})` : 'Leave blank to auto-generate'}
                  value={form.ref_no}
                  onChange={e => setForm({ ...form, ref_no: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Talent Pool Status *</label>
                {checklistEval.canProceed ? (
                  <select
                    className="select-control"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="registered">Registered (Available for Placement)</option>
                    <option value="on_hold">On Hold / Verification</option>
                  </select>
                ) : (
                  <div
                    style={{
                      padding: '0.45rem 0.75rem',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--danger)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      minHeight: '38px'
                    }}
                    title="Mandatory checklist items not satisfied. Candidate will be saved under Incomplete Profile list."
                  >
                    <span>⚠️</span>
                    <span>Incomplete Profile ({checklistEval.percentage}%)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 5: Registration Center & Assigned Case Manager */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Center *</label>
                <select
                  className="select-control"
                  value={form.center}
                  onChange={e => setForm({ ...form, center: e.target.value })}
                  required
                >
                  <option value="Enma Mall">Enma Mall</option>
                  <option value="Career Fair">Career Fair</option>
                  <option value="Training">Training</option>
                  <option value="Other Job Center">Other Job Center</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Assigned Case Manager</label>
                {isAdminOrSuper ? (
                  <select
                    className="select-control"
                    value={form.case_manager_name}
                    onChange={e => setForm({ ...form, case_manager_name: e.target.value })}
                  >
                    {caseManagers.map(cm => (
                      <option key={cm.id} value={cm.case_manager_code || cm.full_name}>
                        {cm.full_name} ({cm.case_manager_code || 'CM'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-control"
                    value={form.case_manager_name}
                    disabled
                  />
                )}
              </div>
            </div>

            {/* Row 5: Remarks */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Remarks</label>
              <textarea
                className="input-control"
                rows="2"
                value={form.remarks}
                onChange={e => setForm({ ...form, remarks: e.target.value })}
              ></textarea>
            </div>
          </div>

          {/* SECTION 2: CANDIDATE REGISTRATION COMPLIANCE CHECKLIST */}
          <div style={{ background: 'var(--bg-card, #ffffff)', padding: '1.25rem', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '0.94rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📋</span> Candidate Registration Compliance Checklist
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  All mandatory criteria must be verified to complete candidate registration
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: checklistEval.percentage === 100 
                    ? 'var(--success, #10b981)' 
                    : (checklistEval.canProceed ? 'var(--primary, #0ea5e9)' : 'var(--warning, #f59e0b)')
                }}>
                  {checklistEval.percentage}%
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Score</span>
              </div>
            </div>

            {/* Dynamic Real-Time Progress Bar */}
            <div style={{ width: '100%', height: '10px', background: 'var(--bg-tertiary, #e2e8f0)', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.75rem' }}>
              <div style={{
                width: `${checklistEval.percentage}%`,
                height: '100%',
                background: checklistEval.percentage === 100 
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : (checklistEval.canProceed ? 'linear-gradient(90deg, #0284c7, #0ea5e9)' : 'linear-gradient(90deg, #f59e0b, #ef4444)'),
                transition: 'width 0.3s ease, background 0.3s ease'
              }} />
            </div>

            {/* Compliance Status Banner & Action Buttons */}
            <div style={{
              background: checklistEval.canProceed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${checklistEval.canProceed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '6px',
              padding: '0.55rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.65rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.78rem', color: checklistEval.canProceed ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>{checklistEval.canProceed ? '✓' : '⚠️'}</span>
                <span>
                  {checklistEval.canProceed
                    ? `All Mandatory Criteria Satisfied (${checklistEval.percentage}%) — Candidate Profile Fully Verified`
                    : `${checklistEval.missingMandatory.length} Mandatory Criteria Pending (${checklistEval.percentage}%) — Candidate will be saved under 'Incomplete Profile'`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                  onClick={handleSelectAllChecklist}
                >
                  ✓ Select All
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                  onClick={handleClearAllChecklist}
                >
                  ✕ Clear All
                </button>
              </div>
            </div>

            {/* Checklist Items Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.65rem' }}>
              {checklistEval.items.map(item => {
                const isChecked = checkedItems.has(item.code) || checkedItems.has(String(item.id)) || checkedItems.has(Number(item.id));
                return (
                  <div
                    key={item.code || item.id}
                    onClick={() => toggleChecklist(item.code || String(item.id))}
                    style={{
                      border: `1px solid ${isChecked ? 'var(--success, #10b981)' : 'var(--border-color, #e2e8f0)'}`,
                      background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-subtle, #f8fafc)',
                      borderRadius: '6px',
                      padding: '0.65rem 0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by container click
                      style={{ marginTop: '3px', width: '17px', height: '17px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{item.title}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                          {item.is_mandatory ? (
                            <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                              * Mandatory
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                              Optional
                            </span>
                          )}
                          <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                            +{item.weight}%
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: MULTIPLE DOCUMENT UPLOAD AREA */}
          <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📁</span> Multiple Document Upload Area ({documents.length} attached)
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                PDF, DOCX, PNG, JPG accepted
              </span>
            </h3>

            {/* Document Uploader Tool Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Category</label>
                <select
                  className="select-control"
                  value={uploadDocType}
                  onChange={e => {
                    const newCat = e.target.value;
                    setUploadDocType(newCat);
                    setUploadDocName(newCat);
                  }}
                >
                  {activeDocCategories.map(cat => (
                    <option key={cat.code || cat.id} value={cat.name}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Document Title</label>
                <input
                  type="text"
                  className="input-control"
                  value={uploadDocName}
                  onChange={e => setUploadDocName(e.target.value)}
                />
              </div>

              <div>
                <label className="btn btn-outline" style={{ display: 'inline-block', textAlign: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  📤 Select File(s)
                  <input
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFilesSelected}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                  />
                </label>
              </div>
            </div>

            {selectedDocCategory?.description && (
              <div style={{
                marginBottom: '0.85rem',
                fontSize: '0.74rem',
                color: 'var(--text-secondary, #475569)',
                background: 'rgba(59, 130, 246, 0.07)',
                borderLeft: '3px solid #3b82f6',
                padding: '0.4rem 0.65rem',
                borderRadius: '0 4px 4px 0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.45rem',
                lineHeight: 1.4
              }}>
                <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>💡</span>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedDocCategory.name}: </strong>
                  <span>{selectedDocCategory.description}</span>
                </div>
              </div>
            )}

            {/* Documents List */}
            {documents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
                {documents.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-tertiary)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className="badge badge-info">{doc.type}</span>
                      <strong>{doc.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ({doc.file_name} • {(doc.file_size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocument(doc.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 800 }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No documents attached yet.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving Candidate...' : (checklistEval.canProceed ? 'Complete Candidate Registration' : `💾 Save to Incomplete Profile (${checklistEval.percentage}%)`)}
          </button>
        </div>
      </form>
    </div>
  );
}

// 2. Link Employer Placement Modal (Integrated with Jobs & Vacancies)
function LinkPlacementModal({ state, candidate: initialCandidate, job: initialJob }) {
  const { currentUser, caseManagers = [], settings = {}, jobs = [], candidates = [] } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const currency = settings.currency || 'BHD';

  // Candidate selection if not pre-passed
  const [selectedCandId, setSelectedCandId] = useState(initialCandidate ? String(initialCandidate.id) : '');
  const activeCandidate = initialCandidate || candidates.find(c => String(c.id) === String(selectedCandId));

  // Job selection if pre-passed or chosen
  const [selectedJobCode, setSelectedJobCode] = useState(() => {
    if (initialJob) return initialJob.job_code || String(initialJob.id);
    if (initialCandidate?.job_code) return initialCandidate.job_code;
    if (initialCandidate?.job_id) return String(initialCandidate.job_id);
    return '';
  });

  const [form, setForm] = useState(() => {
    const baseCand = initialCandidate || {};
    const baseJob = initialJob || (jobs.find(j => j.job_code === selectedJobCode || String(j.id) === selectedJobCode));

    return {
      job_id: baseJob?.id || baseCand.job_id || null,
      job_code: baseJob?.job_code || baseCand.job_code || '',
      company_name: baseJob?.company_name || baseCand.company_name || '',
      employer_cr: baseJob?.employer_cr || baseCand.employer_cr || '',
      employee_type: baseCand.employee_type || 'Full-Time',
      position_title: baseJob?.position_title || baseCand.position_title || 'Specialist',
      salary_bhd: baseJob?.salary_bhd || (baseCand.salary_bhd > 0 ? baseCand.salary_bhd : '450.000'),
      joining_date: baseCand.joining_date || new Date().toISOString().split('T')[0],
      mol_certified: baseCand.mol_certified || 'Yes',
      long_mol: baseCand.long_mol || 'No',
      comments: baseCand.comments || '',
      case_manager_name: baseCand.case_manager_name || (caseManagers[0]?.case_manager_code || 'Husain')
    };
  });

  const [saving, setSaving] = useState(false);

  // Handle Job selection dropdown change
  const handleJobSelect = (e) => {
    const val = e.target.value;
    setSelectedJobCode(val);

    if (!val) {
      setForm(prev => ({
        ...prev,
        job_id: null,
        job_code: ''
      }));
      return;
    }

    const matchedJob = jobs.find(j => j.job_code === val || String(j.id) === val);
    if (matchedJob) {
      setForm(prev => ({
        ...prev,
        job_id: matchedJob.id,
        job_code: matchedJob.job_code,
        company_name: matchedJob.company_name || prev.company_name,
        employer_cr: matchedJob.employer_cr || prev.employer_cr,
        position_title: matchedJob.position_title || prev.position_title,
        salary_bhd: matchedJob.salary_bhd || prev.salary_bhd
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeCandidate) {
      window.AppStore.showNotification('Please select a candidate to link this placement', 'error');
      return;
    }
    if (!form.company_name.trim() || !form.joining_date) {
      window.AppStore.showNotification('Employer Company Name and Joining Date are required', 'error');
      return;
    }

    setSaving(true);
    try {
      await window.api.candidates.linkPlacement(activeCandidate.id, {
        ...form,
        salary_bhd: parseFloat(form.salary_bhd) || 0
      });
      window.AppStore.showNotification(`Placement linked to ${form.company_name} with automated milestones!`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error linking placement: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '720px' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">🔗 Link Employer Placement & Job</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {activeCandidate ? (
              <>Candidate: <strong>{activeCandidate.full_name}</strong> (Ref: {activeCandidate.ref_no} • CPR: {activeCandidate.cpr_no})</>
            ) : (
              'Link an eligible candidate to an employer job opening'
            )}
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Candidate Selection (if not pre-passed) */}
          {!initialCandidate && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Select Candidate *</label>
              <select
                className="select-control"
                value={selectedCandId}
                onChange={e => setSelectedCandId(e.target.value)}
                required
              >
                <option value="">-- Choose Candidate from Registry --</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.ref_no} • {c.full_name} (CPR: {c.cpr_no}) {c.company_name ? `[Current: ${c.company_name}]` : '[Available]'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Job Vacancy Selector Box */}
          <div style={{ background: 'var(--bg-subtle, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', padding: '0.85rem 1rem', borderRadius: '8px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>🏢 Select Employer Job Vacancy (Auto-fills details)</span>
              {jobs.length > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{jobs.length} jobs available</span>}
            </label>
            <select
              className="select-control"
              value={selectedJobCode}
              onChange={handleJobSelect}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="">-- Manual / Direct Placement (No Job Linked) --</option>
              {jobs.map(j => {
                const rem = j.vacancies_remaining ?? j.vacancies_count ?? 1;
                return (
                  <option key={j.id || j.job_code} value={j.job_code || String(j.id)}>
                    {j.job_code} • {j.position_title} at {j.company_name} ({currency} {Number(j.salary_bhd || 0).toFixed(3)} • {rem} Open)
                  </option>
                );
              })}
            </select>
            {form.job_code && (
              <div style={{ fontSize: '0.74rem', color: 'var(--success)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>✓</span> Mapped to Job Code: <strong>{form.job_code}</strong>
              </div>
            )}
          </div>

          {/* Row 1: Employer Company Name & CR Number */}
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Employer Company Name *</label>
              <input
                type="text"
                className="input-control"
                value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })}
                placeholder="e.g. Aluminum Bahrain (Alba)"
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Commercial Registration (CR)</label>
              <input
                type="text"
                className="input-control"
                value={form.employer_cr}
                onChange={e => setForm({ ...form, employer_cr: e.target.value })}
                placeholder="e.g. 123456-1"
              />
            </div>
          </div>

          {/* Row 2: Employee Type & Position */}
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Employee Type *</label>
              <select
                className="select-control"
                value={form.employee_type}
                onChange={e => setForm({ ...form, employee_type: e.target.value })}
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
                <option value="Permanent">Permanent</option>
                <option value="Trainee / Intern">Trainee / Intern</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Position / Job Title *</label>
              <input
                type="text"
                className="input-control"
                value={form.position_title}
                onChange={e => setForm({ ...form, position_title: e.target.value })}
                placeholder="e.g. Senior Mechanical Specialist"
                required
              />
            </div>
          </div>

          {/* Row 3: Salary & Joining Date */}
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Monthly Salary ({currency}) *</label>
              <input
                type="number"
                step="0.001"
                className="input-control"
                value={form.salary_bhd}
                onChange={e => setForm({ ...form, salary_bhd: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Joining / Placement Date *</label>
              <input
                type="date"
                className="input-control"
                value={form.joining_date}
                onChange={e => setForm({ ...form, joining_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Row 4: MOL & Long MOL */}
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">MOL Certified</label>
              <select
                className="select-control"
                value={form.mol_certified}
                onChange={e => setForm({ ...form, mol_certified: e.target.value })}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Long MOL</label>
              <select
                className="select-control"
                value={form.long_mol}
                onChange={e => setForm({ ...form, long_mol: e.target.value })}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
          </div>

          {/* Row 5: Assigned Case Manager (if admin) */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Assigned Case Manager</label>
            {isAdminOrSuper ? (
              <select
                className="select-control"
                value={form.case_manager_name}
                onChange={e => setForm({ ...form, case_manager_name: e.target.value })}
              >
                {caseManagers.map(cm => (
                  <option key={cm.id || cm.username} value={cm.case_manager_code || cm.full_name}>
                    {cm.full_name} ({cm.case_manager_code || 'CM'})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input-control"
                value={form.case_manager_name}
                disabled
              />
            )}
          </div>

          {/* Row 6: Comments */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Placement Comments / Notes</label>
            <textarea
              className="input-control"
              rows="2"
              value={form.comments}
              onChange={e => setForm({ ...form, comments: e.target.value })}
              placeholder="Enter contract terms, probation notes, or MOL file reference..."
            ></textarea>
          </div>

          <div style={{ background: 'var(--success-bg, rgba(16,185,129,0.1))', border: '1px solid var(--success-border, rgba(16,185,129,0.3))', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.78rem', color: 'var(--success, #10b981)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚡</span>
            <span>Automated Day 0, Day 180, and Day 365 retention milestones will be automatically synced upon linking.</span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Linking...' : 'Confirm Placement & Generate Milestones'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 2a. Talent Pool & Job Placement Allocation Studio Modal
function BatchPlacementModal({ state, initialJobId }) {
  const { candidates = [], jobs = [], settings = {} } = state;
  const currency = settings.currency || 'BHD';
  const SearchableSelect = window.SearchableSelect;

  const [selectedJobId, setSelectedJobId] = useState(initialJobId ? String(initialJobId) : '');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [batchJoiningDate, setBatchJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchNotes, setBatchNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Available Talent Pool candidates (Strictly unplaced pool candidates)
  const availablePoolCandidates = useMemo(() => {
    return (candidates || []).filter(c => {
      const st = (c.status || 'registered').toLowerCase();
      // Exclude placed, active, completed, or resigned candidates
      if (st === 'placed' || st === 'active' || st === 'completed' || st === 'resigned') return false;
      // Exclude if already linked to an employer or job opening
      if (c.company_name && c.company_name.trim()) return false;
      if (c.job_id) return false;
      return st === 'registered' || st === 'registration_incomplete' || !c.status;
    });
  }, [candidates]);

  // Open Employer Job Vacancies (Strictly active jobs with vacancies remaining > 0)
  const openJobsList = useMemo(() => {
    return (jobs || []).filter(j => {
      const st = (j.status || 'active').toLowerCase();
      if (st === 'closed') return false;
      const remaining = typeof j.vacancies_remaining !== 'undefined'
        ? parseInt(j.vacancies_remaining, 10)
        : Math.max(0, (parseInt(j.vacancies_count, 10) || 1) - (parseInt(j.placed_count, 10) || 0));
      return remaining > 0;
    });
  }, [jobs]);

  // Job options for SearchableSelect (Searchable by Employer, Position, Department, Job Code, or CR)
  const jobOptions = useMemo(() => {
    const list = openJobsList.map(j => {
      const remaining = typeof j.vacancies_remaining !== 'undefined'
        ? parseInt(j.vacancies_remaining, 10)
        : Math.max(0, (parseInt(j.vacancies_count, 10) || 1) - (parseInt(j.placed_count, 10) || 0));
      const pos = j.position_title || j.job_title || 'Position';
      const sal = parseFloat(j.salary_offered_bhd || j.salary_bhd || 0).toFixed(3);
      const dept = j.department || 'Operations';
      const code = j.job_code || `JOB-${j.id}`;
      return {
        value: String(j.id),
        label: `${j.company_name} — ${pos}`,
        subLabel: `${code} • Dept: ${dept} • ${remaining} open of ${j.vacancies_count || 1} • ${currency} ${sal}`,
        searchKeywords: `${j.company_name} ${pos} ${dept} ${code} ${j.employer_cr || ''}`,
        job: j,
        remaining
      };
    });
    return [{ value: '', label: `-- Choose an Employer Job Opening (${list.length} available) --`, subLabel: 'Search by employer, position, department, or job code' }, ...list];
  }, [openJobsList, currency]);

  // Selected Job Details
  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return (jobs || []).find(j => String(j.id) === String(selectedJobId)) || null;
  }, [selectedJobId, jobs]);

  const maxVacancies = useMemo(() => {
    if (!selectedJob) return 0;
    return typeof selectedJob.vacancies_remaining !== 'undefined'
      ? parseInt(selectedJob.vacancies_remaining, 10)
      : Math.max(0, (parseInt(selectedJob.vacancies_count, 10) || 1) - (parseInt(selectedJob.placed_count, 10) || 0));
  }, [selectedJob]);

  const jobDefaultSalary = useMemo(() => {
    if (!selectedJob) return 450.0;
    const s = parseFloat(selectedJob.salary_offered_bhd || selectedJob.salary_bhd);
    return isNaN(s) || s <= 0 ? 450.0 : s;
  }, [selectedJob]);

  // Filter Pool Candidates with live search
  const filteredPool = useMemo(() => {
    if (!candidateSearch.trim()) return availablePoolCandidates;
    const q = candidateSearch.toLowerCase().trim();
    return availablePoolCandidates.filter(c => {
      const name = (c.candidate_name || c.full_name || '').toLowerCase();
      const cpr = (c.cpr_no || '').toLowerCase();
      const ref = (c.ref_no || '').toLowerCase();
      const skills = (c.skills || '').toLowerCase();
      const phone = (c.phone_number || c.phone || '').toLowerCase();
      const edu = (c.highest_education || c.education || '').toLowerCase();
      return name.includes(q) || cpr.includes(q) || ref.includes(q) || skills.includes(q) || phone.includes(q) || edu.includes(q);
    });
  }, [availablePoolCandidates, candidateSearch]);

  const totalAllocatedSalary = useMemo(() => {
    return allocations.reduce((acc, cur) => acc + (parseFloat(cur.salary_bhd) || 0), 0);
  }, [allocations]);

  // Selection & Allocation Handlers
  const handleSelectJob = (jobId) => {
    setSelectedJobId(jobId);
    if (!jobId) {
      setAllocations([]);
      return;
    }
    const job = (jobs || []).find(j => String(j.id) === String(jobId));
    if (!job) return;
    const rem = typeof job.vacancies_remaining !== 'undefined'
      ? parseInt(job.vacancies_remaining, 10)
      : Math.max(0, (parseInt(job.vacancies_count, 10) || 1) - (parseInt(job.placed_count, 10) || 0));
    const newSalary = parseFloat(job.salary_offered_bhd || job.salary_bhd) || 450.0;
    const newTitle = job.position_title || job.job_title || 'Specialist';

    // If existing allocations exceed remaining vacancies, trim them
    setAllocations(prev => {
      const trimmed = prev.slice(0, rem);
      return trimmed.map(a => ({
        ...a,
        position_title: newTitle,
        salary_bhd: newSalary
      }));
    });
  };

  const handleToggleCandidate = (cand) => {
    if (!selectedJob) {
      window.AppStore.showNotification('Please select an employer job opening first.', 'warning');
      return;
    }
    const exists = allocations.some(a => a.candidate_id === cand.id);
    if (exists) {
      setAllocations(prev => prev.filter(a => a.candidate_id !== cand.id));
    } else {
      if (allocations.length >= maxVacancies) {
        window.AppStore.showNotification(`Cannot allocate more than ${maxVacancies} candidate(s). This job opening only has ${maxVacancies} available vacancy slot(s).`, 'warning');
        return;
      }
      const newAllocation = {
        candidate_id: cand.id,
        full_name: cand.candidate_name || cand.full_name,
        cpr_no: cand.cpr_no || '',
        ref_no: cand.ref_no || '',
        position_title: selectedJob.position_title || selectedJob.job_title || 'Specialist',
        salary_bhd: jobDefaultSalary,
        joining_date: batchJoiningDate || new Date().toISOString().split('T')[0],
        employee_type: 'Full-Time',
        mol_certified: 'Yes',
        long_mol: 'No',
        comments: batchNotes || ''
      };
      setAllocations(prev => [...prev, newAllocation]);
    }
  };

  const handleUpdateAllocation = (candidateId, field, val) => {
    setAllocations(prev => prev.map(a => {
      if (a.candidate_id === candidateId) {
        return { ...a, [field]: val };
      }
      return a;
    }));
  };

  const handleRemoveAllocation = (candidateId) => {
    setAllocations(prev => prev.filter(a => a.candidate_id !== candidateId));
  };

  const handleApplyDateToAll = () => {
    if (!batchJoiningDate) {
      window.AppStore.showNotification('Please choose a valid joining date first.', 'warning');
      return;
    }
    if (allocations.length === 0) {
      window.AppStore.showNotification('No candidates currently allocated to apply date to.', 'info');
      return;
    }
    setAllocations(prev => prev.map(a => ({ ...a, joining_date: batchJoiningDate })));
    window.AppStore.showNotification(`Applied joining date (${batchJoiningDate}) to all ${allocations.length} allocated candidates!`, 'success');
  };

  const handleApplyNotesToAll = () => {
    if (allocations.length === 0) {
      window.AppStore.showNotification('No candidates currently allocated to apply notes to.', 'info');
      return;
    }
    setAllocations(prev => prev.map(a => ({ ...a, comments: batchNotes })));
    window.AppStore.showNotification(`Applied notes to all ${allocations.length} allocated candidates!`, 'success');
  };

  const handleResetAllSalary = () => {
    if (!selectedJob) return;
    if (allocations.length === 0) return;
    setAllocations(prev => prev.map(a => ({ ...a, salary_bhd: jobDefaultSalary })));
    window.AppStore.showNotification(`Reset all salaries to job default (${currency} ${jobDefaultSalary.toFixed(3)})!`, 'info');
  };

  const handleConfirmBatchPlacement = async () => {
    if (!selectedJob) {
      window.AppStore.showNotification('Please select an employer job opening first.', 'warning');
      return;
    }
    if (allocations.length === 0) {
      window.AppStore.showNotification('Please select at least one candidate from the pool.', 'warning');
      return;
    }
    if (allocations.length > maxVacancies) {
      window.AppStore.showNotification(`Cannot place ${allocations.length} candidates. Maximum remaining vacancies is ${maxVacancies}.`, 'error');
      return;
    }

    for (const a of allocations) {
      const s = parseFloat(a.salary_bhd);
      if (isNaN(s) || s <= 0) {
        window.AppStore.showNotification(`Please specify a valid salary (> 0) for candidate ${a.full_name}.`, 'warning');
        return;
      }
      if (!a.joining_date) {
        window.AppStore.showNotification(`Please specify a valid joining date for candidate ${a.full_name}.`, 'warning');
        return;
      }
    }

    const jobTitle = selectedJob.position_title || selectedJob.job_title || 'Position';
    const confirmMsg = `Are you sure you want to place ${allocations.length} candidate(s) at ${selectedJob.company_name} for position "${jobTitle}"?\n\nAutomated Day 0, Day 180, and Day 365 retention milestone gates will be created for each candidate.`;

    let userConfirmed = false;
    if (window.swal) {
      const result = await window.swal.fire({
        title: 'Confirm Placements',
        text: confirmMsg,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Yes, Confirm Placements (${allocations.length})`,
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#10b981'
      });
      userConfirmed = result.isConfirmed;
    } else if (window.confirm) {
      userConfirmed = window.confirm(confirmMsg);
    }

    if (!userConfirmed) return;

    setSubmitting(true);
    try {
      const payload = {
        job_id: selectedJob.id,
        job_code: selectedJob.job_code,
        company_name: selectedJob.company_name,
        employer_cr: selectedJob.employer_cr,
        department: selectedJob.department || 'Operations',
        position_title: jobTitle,
        placements: allocations.map(a => ({
          candidate_id: a.candidate_id,
          position_title: a.position_title || jobTitle,
          salary_bhd: parseFloat(a.salary_bhd),
          joining_date: a.joining_date,
          employee_type: a.employee_type || 'Full-Time',
          mol_certified: a.mol_certified || 'Yes',
          long_mol: a.long_mol || 'No',
          comments: a.comments || ''
        }))
      };

      if (window.api && window.api.candidates && typeof window.api.candidates.batchPlacement === 'function') {
        await window.api.candidates.batchPlacement(payload);
      } else {
        for (const p of payload.placements) {
          await window.api.candidates.linkPlacement(p.candidate_id, {
            job_id: payload.job_id,
            job_code: payload.job_code,
            company_name: payload.company_name,
            employer_cr: payload.employer_cr,
            department: payload.department,
            position_title: p.position_title,
            salary_bhd: p.salary_bhd,
            joining_date: p.joining_date,
            employee_type: p.employee_type,
            mol_certified: p.mol_certified,
            long_mol: p.long_mol,
            comments: p.comments
          });
        }
      }

      window.AppStore.showNotification(`Successfully placed ${allocations.length} candidate(s) to ${selectedJob.company_name}! Automated milestone gates created.`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      console.error('Batch placement error:', err);
      window.AppStore.showNotification('Error creating batch placements: ' + (err.message || 'Server error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'CD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className="modal-content"
      style={{
        maxWidth: '1420px',
        width: '96vw',
        height: '92vh',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
        borderRadius: 'var(--radius-lg, 12px)'
      }}
    >
      {/* Modal Header */}
      <div
        className="modal-header"
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-light, #e2e8f0)',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Talent Pool & Job Placement Allocation Studio
              </h2>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--success, #10b981)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                {availablePoolCandidates.length} Available in Pool
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(14, 165, 233, 0.15)',
                  color: 'var(--primary, #0ea5e9)',
                  border: '1px solid rgba(14, 165, 233, 0.3)'
                }}
              >
                {openJobsList.length} Open Vacancies
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Allocate candidates from the available pool into open employer job openings with capacity validation, custom salaries, and milestone generation.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="modal-close-btn"
          onClick={() => window.AppStore.closeModal()}
          title="Close Studio Modal"
          style={{ fontSize: '1.3rem', padding: '0.25rem 0.5rem' }}
        >
          ✕
        </button>
      </div>

      {/* Modal Body */}
      <div
        className="modal-body"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '1rem 1.5rem',
          gap: '1rem',
          minHeight: 0
        }}
      >
        {/* Step 1: Select Employer Job Opening (Searchable by Employer, Position, Dept, or Job Code) */}
        <div
          style={{
            background: 'var(--bg-secondary, #f8fafc)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '0.85rem 1rem',
            flexShrink: 0,
            position: 'relative',
            zIndex: 60,
            overflow: 'visible'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>1</span>
              Select Employer Job Opening ({openJobsList.length} Active Vacancies Available)
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Searchable by <strong>Employer</strong>, <strong>Position</strong>, <strong>Department</strong>, or <strong>Job Code</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1.4fr 1fr' : '1fr', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: 0 }}>
              {SearchableSelect ? (
                <SearchableSelect
                  options={jobOptions}
                  value={selectedJobId}
                  onChange={handleSelectJob}
                  placeholder="Type employer, position, department, or job code..."
                  searchPlaceholder="Search by Employer, Position, Department, or Job Code..."
                />
              ) : (
                <select
                  className="select-control"
                  style={{ width: '100%', fontSize: '0.88rem', fontWeight: 600, padding: '0.55rem 0.75rem' }}
                  value={selectedJobId}
                  onChange={e => handleSelectJob(e.target.value)}
                >
                  <option value="">-- Choose Employer Vacancy Opening --</option>
                  {openJobsList.map(j => {
                    const rem = typeof j.vacancies_remaining !== 'undefined'
                      ? parseInt(j.vacancies_remaining, 10)
                      : Math.max(0, (parseInt(j.vacancies_count, 10) || 1) - (parseInt(j.placed_count, 10) || 0));
                    return (
                      <option key={j.id} value={j.id}>
                        {j.company_name} — {j.position_title || j.job_title} ({j.job_code || `JOB-${j.id}`} • {rem} open / {j.vacancies_count || 1} total • {currency} {parseFloat(j.salary_offered_bhd || j.salary_bhd || 0).toFixed(3)})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {selectedJob && (
              <div
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {selectedJob.company_name}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {selectedJob.job_code || `JOB-${selectedJob.id}`}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedJob.position_title || selectedJob.job_title} &bull; Dept: <strong>{selectedJob.department || 'Operations'}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      className={`badge ${allocations.length >= maxVacancies ? 'badge-success' : 'badge-warning'}`}
                      style={{ fontSize: '0.78rem', fontWeight: 800, padding: '0.25rem 0.6rem' }}
                    >
                      {allocations.length} / {maxVacancies} slots filled
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Salary: <strong style={{ color: 'var(--primary)' }}>{currency} {jobDefaultSalary.toFixed(3)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Steps 2 & 3: Two-Column Studio Layout utilizing remaining height */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1.35fr',
            gap: '1.25rem',
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
          {/* Left Column: Step 2 Available Talent Pool */}
          <div
            style={{
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--bg-card, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            {/* Pool Header */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-secondary, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>2</span>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Available Talent Pool
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                {filteredPool.length} of {availablePoolCandidates.length}
              </span>
            </div>

            {/* Professional Candidate Search Box */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontSize: '0.9rem', pointerEvents: 'none' }}>
                  🔍
                </span>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Search pool candidates by name, CPR, ref, skills, education..."
                  value={candidateSearch}
                  onChange={e => setCandidateSearch(e.target.value)}
                  style={{
                    paddingLeft: '2.3rem',
                    paddingRight: candidateSearch ? '2.4rem' : '0.85rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.82rem',
                    height: '36px',
                    background: 'var(--bg-secondary, #f8fafc)',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    width: '100%'
                  }}
                />
                {candidateSearch && (
                  <button
                    type="button"
                    onClick={() => setCandidateSearch('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      padding: '2px 4px'
                    }}
                    title="Clear candidate search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {selectedJob && allocations.length >= maxVacancies && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.73rem',
                    color: 'var(--warning, #b45309)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span>⚠️</span>
                  <span>Job capacity reached ({maxVacancies} max openings). Uncheck an allocated candidate to pick another.</span>
                </div>
              )}
            </div>

            {/* Candidate Pool Scrollable Cards List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
                minHeight: 0
              }}
            >
              {filteredPool.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {availablePoolCandidates.length === 0
                    ? 'No unplaced candidates in the available pool. All registered candidates are placed.'
                    : 'No candidates matched your search criteria.'}
                </div>
              ) : (
                filteredPool.map(cand => {
                  const isAllocated = allocations.some(a => a.candidate_id === cand.id);
                  const isMaxReached = selectedJob && allocations.length >= maxVacancies;
                  const candName = cand.candidate_name || cand.full_name || 'Candidate';
                  const initials = getInitials(candName);

                  return (
                    <div
                      key={cand.id}
                      style={{
                        border: `1px solid ${isAllocated ? 'var(--primary, #0ea5e9)' : 'var(--border-color, #e2e8f0)'}`,
                        background: isAllocated ? 'rgba(14, 165, 233, 0.06)' : 'var(--bg-card, #ffffff)',
                        borderRadius: 'var(--radius-md, 8px)',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.65rem',
                        transition: 'all 0.15s ease',
                        boxShadow: isAllocated ? '0 0 0 1px var(--primary)' : '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: isAllocated ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: isAllocated ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {initials}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                              {candName}
                            </span>
                            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                              CPR: {cand.cpr_no || 'N/A'}
                            </span>
                            {cand.ref_no && (
                              <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                {cand.ref_no}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {cand.skills && <span>🛠️ <strong>{cand.skills}</strong></span>}
                            {cand.highest_education && <span>&bull; 🎓 {cand.highest_education}</span>}
                            {cand.phone_number && <span>&bull; 📞 {cand.phone_number}</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`btn btn-sm ${isAllocated ? 'btn-primary' : 'btn-outline'}`}
                        disabled={!selectedJob || (!isAllocated && isMaxReached)}
                        title={!selectedJob ? 'Choose a job vacancy in Step 1 first' : (!isAllocated && isMaxReached ? `Capacity reached (${maxVacancies} max openings)` : isAllocated ? 'Remove from placement' : 'Allocate to this opening')}
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.65rem',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                        onClick={() => handleToggleCandidate(cand)}
                      >
                        {isAllocated ? '✓ Selected' : '+ Allocate'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Step 3 Allocations, Individual Salary & Notes, Confirmation */}
          <div
            style={{
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--bg-card, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            {/* Allocations Header */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-secondary, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>3</span>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Placement Allocations & Terms
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', background: 'rgba(14, 165, 233, 0.15)', color: 'var(--primary)' }}>
                  {allocations.length} Selected
                </span>
              </div>

              {allocations.length > 0 && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={() => setAllocations([])}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {allocations.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>👥</div>
                <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                  No Candidates Allocated Yet
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.4rem auto 0 auto', maxWidth: '360px' }}>
                  {selectedJob
                    ? `Select up to ${maxVacancies} candidate(s) from the available talent pool on the left to configure custom salaries, joining dates, and individual remarks.`
                    : 'Select an employer vacancy opening in Step 1, then allocate candidates from the available pool.'}
                </p>
              </div>
            ) : (
              <>
                {/* Batch Quick-Apply Actions Toolbar */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    background: 'var(--bg-secondary, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    flexShrink: 0
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      ⚡ Batch Quick-Apply Actions
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                      onClick={handleResetAllSalary}
                      title={`Reset all allocated salaries to default job salary (${currency} ${jobDefaultSalary.toFixed(3)})`}
                    >
                      Reset All to Job Salary ({currency} {jobDefaultSalary.toFixed(3)})
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '0.6rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input
                        type="date"
                        className="input-control"
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.45rem', flex: 1 }}
                        value={batchJoiningDate}
                        onChange={e => setBatchJoiningDate(e.target.value)}
                        title="Uniform joining date"
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', padding: '0.3rem 0.5rem' }}
                        onClick={handleApplyDateToAll}
                        title="Apply this joining date to all candidates"
                      >
                        Apply Date
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="Global Placement notes"
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', flex: 1 }}
                        value={batchNotes}
                        onChange={e => setBatchNotes(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', padding: '0.3rem 0.5rem' }}
                        onClick={handleApplyNotesToAll}
                        title="Apply these remarks to all candidates"
                      >
                        Apply Notes
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scrollable Allocations List with All Placement Fields */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minHeight: 0
                  }}
                >
                  {allocations.map((item, idx) => (
                    <div
                      key={item.candidate_id}
                      style={{
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: 'var(--radius-md, 8px)',
                        padding: '0.85rem 1rem',
                        background: 'var(--bg-card, #ffffff)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Row 1: Candidate Header + Remove Button */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light, #f1f5f9)', paddingBottom: '0.45rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.74rem', fontWeight: 800 }}>
                            {idx + 1}
                          </span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {item.full_name}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: '4px' }}>
                            CPR: {item.cpr_no || 'N/A'}
                          </span>
                          {item.ref_no && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)', background: 'rgba(14, 165, 233, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                              {item.ref_no}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}
                          onClick={() => handleRemoveAllocation(item.candidate_id)}
                          title="Remove from allocation"
                        >
                          ✕ Remove
                        </button>
                      </div>

                      {/* Row 2: Employee Type & Position / Job Title */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            Employee Type *
                          </label>
                          <select
                            className="input-control"
                            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem', width: '100%' }}
                            value={item.employee_type || 'Full-Time'}
                            onChange={e => handleUpdateAllocation(item.candidate_id, 'employee_type', e.target.value)}
                          >
                            <option value="Full-Time">Full-Time</option>
                            <option value="Part-Time">Part-Time</option>
                            <option value="Contract">Contract</option>
                            <option value="Internship">Internship</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            Position / Job Title *
                          </label>
                          <input
                            type="text"
                            className="input-control"
                            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem', width: '100%' }}
                            value={item.position_title || ''}
                            placeholder="e.g. Specialist"
                            onChange={e => handleUpdateAllocation(item.candidate_id, 'position_title', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 3: Monthly Salary (BHD) & Joining / Placement Date */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            Monthly Salary ({currency}) *
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="1"
                            className="input-control"
                            style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '0.35rem 0.5rem', width: '100%' }}
                            value={item.salary_bhd}
                            onChange={e => handleUpdateAllocation(item.candidate_id, 'salary_bhd', e.target.value)}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            Joining / Placement Date *
                          </label>
                          <input
                            type="date"
                            className="input-control"
                            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem', width: '100%' }}
                            value={item.joining_date}
                            onChange={e => handleUpdateAllocation(item.candidate_id, 'joining_date', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 4: MOL Certified & Long MOL */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            MOL Certified
                          </label>
                          <select
                            className="input-control"
                            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem', width: '100%' }}
                            value={item.mol_certified || 'Yes'}
                            onChange={e => handleUpdateAllocation(item.candidate_id, 'mol_certified', e.target.value)}
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            Long MOL
                          </label>
                          <select
                            className="input-control"
                            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem', width: '100%' }}
                            value={item.long_mol || 'No'}
                            onChange={e => handleUpdateAllocation(item.candidate_id, 'long_mol', e.target.value)}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 5: Placement Notes */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                          Placement Notes
                        </label>
                        <input
                          type="text"
                          placeholder="Specific placement notes / terms for this candidate..."
                          className="input-control"
                          style={{ fontSize: '0.82rem', padding: '0.35rem 0.55rem', width: '100%' }}
                          value={item.comments || ''}
                          onChange={e => handleUpdateAllocation(item.candidate_id, 'comments', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Footer */}
      <div
        className="modal-footer"
        style={{
          borderTop: '1px solid var(--border-light, #e2e8f0)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          background: 'var(--bg-secondary, #f8fafc)'
        }}
      >
        <div>
          {selectedJob ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              <span>Allocating <strong>{allocations.length}</strong> of <strong>{maxVacancies}</strong> openings to <strong>{selectedJob.company_name}</strong></span>
              <span style={{ margin: '0 0.5rem', color: 'var(--border-color)' }}>|</span>
              <span>Total Monthly Commitment: <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{currency} {totalAllocatedSalary.toFixed(3)}</strong></span>
              <span style={{ margin: '0 0.5rem', color: 'var(--border-color)' }}>|</span>
              <span>Remaining Openings: <strong>{maxVacancies - allocations.length}</strong></span>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Choose an active employer job opening above to start candidate placement allocations.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.AppStore.closeModal()}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-success"
            disabled={submitting || allocations.length === 0 || allocations.length > maxVacancies}
            onClick={handleConfirmBatchPlacement}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 800,
              padding: '0.55rem 1.25rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
            }}
          >
            <span>{submitting ? '⏳ Creating Placements...' : '✓ Confirm & Create Placements'}</span>
            {!submitting && (
              <span
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  borderRadius: 'var(--radius-full)',
                  padding: '1px 7px',
                  fontSize: '0.74rem'
                }}
              >
                {allocations.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// 2b. Job Modal (Create & Edit Job Postings)
function JobModal({ state, job }) {
  const { settings = {} } = state;
  const currency = settings.currency || 'BHD';
  const isEditing = Boolean(job && job.id);

  // Extract unique existing data to provide autocomplete popups and avoid filter duplications
  const { existingEmployers, existingCRs, existingPositions, existingDepartments } = useMemo(() => {
    const empMap = new Map();
    const crSet = new Set();
    const posSet = new Set();
    const deptSet = new Set();

    (state.jobs || []).forEach(j => {
      const comp = (j.company_name || '').trim();
      const cr = (j.employer_cr || '').trim();
      const pos = (j.position_title || j.job_title || '').trim();
      const dept = (j.department || '').trim();

      if (comp && !empMap.has(comp.toLowerCase())) {
        empMap.set(comp.toLowerCase(), { name: comp, cr: cr || '' });
      }
      if (cr) crSet.add(cr);
      if (pos) posSet.add(pos);
      if (dept) deptSet.add(dept);
    });

    (state.candidates || []).forEach(c => {
      const comp = (c.company_name || '').trim();
      const cr = (c.employer_cr || '').trim();
      const pos = (c.position_title || '').trim();

      if (comp && !empMap.has(comp.toLowerCase())) {
        empMap.set(comp.toLowerCase(), { name: comp, cr: cr || '' });
      }
      if (cr) crSet.add(cr);
      if (pos) posSet.add(pos);
    });

    return {
      existingEmployers: Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      existingCRs: Array.from(crSet).sort(),
      existingPositions: Array.from(posSet).sort((a, b) => a.localeCompare(b)),
      existingDepartments: Array.from(deptSet).sort((a, b) => a.localeCompare(b))
    };
  }, [state.jobs, state.candidates]);

  const availableCaseManagers = useMemo(() => {
    const list = (state.caseManagers && state.caseManagers.length > 0)
      ? state.caseManagers
      : (state.users || []).filter(u => u.role === 'case_manager');
    const map = new Map();
    list.forEach(cm => {
      const key = cm.id || cm.username || cm.full_name;
      if (key && !map.has(key)) {
        map.set(key, cm);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.full_name || a.username || '').localeCompare(b.full_name || b.username || ''));
  }, [state.caseManagers, state.users]);

  const initialAssignedCms = useMemo(() => {
    const raw = job?.assigned_case_managers;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [job]);

  const [form, setForm] = useState({
    job_code: job?.job_code || '',
    company_name: job?.company_name || '',
    employer_cr: job?.employer_cr || '',
    position_title: job?.position_title || job?.job_title || '',
    department: job?.department || '',
    salary_bhd: job?.salary_bhd || job?.salary_offered_bhd || '450.000',
    vacancies_count: job?.vacancies_count || 1,
    status: (job?.status === 'closed' ? 'closed' : 'active'),
    work_location: job?.work_location || 'Kingdom of Bahrain',
    requirements: job?.requirements || '',
    description: job?.description || '',
    assigned_case_managers: initialAssignedCms
  });

  const toggleCaseManager = (cm) => {
    setForm(prev => {
      const current = prev.assigned_case_managers || [];
      const matchIndex = current.findIndex(a =>
        (a.id !== undefined && a.id !== null && cm.id !== undefined && cm.id !== null && String(a.id) === String(cm.id)) ||
        (a.username && cm.username && String(a.username).toLowerCase() === String(cm.username).toLowerCase()) ||
        (a.name && cm.full_name && String(a.name).toLowerCase() === String(cm.full_name).toLowerCase())
      );

      if (matchIndex >= 0) {
        const updated = [...current];
        updated.splice(matchIndex, 1);
        return { ...prev, assigned_case_managers: updated };
      } else {
        const newEntry = {
          id: cm.id || null,
          name: cm.full_name || cm.username || 'Case Manager',
          username: cm.username || '',
          code: cm.case_manager_code || ''
        };
        return { ...prev, assigned_case_managers: [...current, newEntry] };
      }
    });
  };

  const handleSelectAllCaseManagers = () => {
    const all = availableCaseManagers.map(cm => ({
      id: cm.id || null,
      name: cm.full_name || cm.username || 'Case Manager',
      username: cm.username || '',
      code: cm.case_manager_code || ''
    }));
    setForm(prev => ({ ...prev, assigned_case_managers: all }));
  };

  const handleClearAllCaseManagers = () => {
    setForm(prev => ({ ...prev, assigned_case_managers: [] }));
  };

  const [saving, setSaving] = useState(false);

  const handleCompanyChange = (val) => {
    const match = existingEmployers.find(e => e.name.toLowerCase() === val.trim().toLowerCase());
    setForm(prev => ({
      ...prev,
      company_name: val,
      employer_cr: (match && match.cr && !prev.employer_cr) ? match.cr : prev.employer_cr
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.position_title.trim()) {
      window.AppStore.showNotification('Company Name and Position Title are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        job_title: form.position_title.trim(),
        position_title: form.position_title.trim(),
        salary_offered_bhd: parseFloat(form.salary_bhd) || 0,
        salary_bhd: parseFloat(form.salary_bhd) || 0,
        vacancies_count: parseInt(form.vacancies_count, 10) || 1
      };

      if (isEditing) {
        const updated = await window.api.jobs.update(job.id, payload);
        if (updated && window.AppStore) {
          const curJobs = window.AppStore.getState().jobs || [];
          window.AppStore.setState({
            jobs: curJobs.map(j => (j.id === job.id ? { ...j, ...updated, ...payload } : j))
          });
        }
        window.AppStore.showNotification(`Job opening '${form.position_title}' updated successfully!`, 'success');
      } else {
        const created = await window.api.jobs.create(payload);
        if (created && window.AppStore) {
          const curJobs = window.AppStore.getState().jobs || [];
          const exists = curJobs.some(j => j.id === created.id || (created.job_code && j.job_code === created.job_code));
          if (!exists) {
            window.AppStore.setState({ jobs: [created, ...curJobs] });
          }
        }
        // Clear any leftover filter in sessionStorage that might hide this new job
        sessionStorage.removeItem('sands_jobs_filter_employer');
        sessionStorage.removeItem('sands_jobs_filter_department');
        sessionStorage.removeItem('sands_jobs_filter_position');
        sessionStorage.setItem('sands_jobs_filter_status', 'active');
        window.AppStore.showNotification(`Job opening '${form.position_title}' posted successfully!`, 'success');
      }

      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error saving job: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '880px', width: '92%', maxHeight: '92vh', overflowY: 'auto' }}>
      <div className="modal-header" style={{ padding: '1.1rem 1.4rem' }}>
        <div>
          <h2 className="modal-title" style={{ fontSize: '1.25rem' }}>{isEditing ? '✏️ Edit Job Vacancy' : '➕ Post New Employer Job Vacancy'}</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isEditing ? `Job Code: ${job.job_code}` : 'Define an employer job position to link with national candidates'}
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', padding: '1.25rem 1.4rem' }}>
          
          {/* Row 1: Employer Company Name & CR */}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Employer Company Name *</label>
              <input
                type="text"
                className="input-control"
                style={{ height: '40px', fontSize: '0.88rem' }}
                value={form.company_name}
                onChange={e => handleCompanyChange(e.target.value)}
                list="existing-job-employers-list"
                autoComplete="off"
                required
              />
              <datalist id="existing-job-employers-list">
                {existingEmployers.map((emp, idx) => (
                  <option key={idx} value={emp.name}>{emp.cr ? `CR: ${emp.cr}` : ''}</option>
                ))}
              </datalist>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Commercial Registration (CR)</label>
              <input
                type="text"
                className="input-control"
                style={{ height: '40px', fontSize: '0.88rem' }}
                value={form.employer_cr}
                onChange={e => setForm({ ...form, employer_cr: e.target.value })}
                list="existing-job-crs-list"
                autoComplete="off"
              />
              <datalist id="existing-job-crs-list">
                {existingCRs.map((cr, idx) => (
                  <option key={idx} value={cr} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 2: Position Title & Department */}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Position / Job Title *</label>
              <input
                type="text"
                className="input-control"
                style={{ height: '40px', fontSize: '0.88rem' }}
                value={form.position_title}
                onChange={e => setForm({ ...form, position_title: e.target.value })}
                list="existing-job-positions-list"
                autoComplete="off"
                required
              />
              <datalist id="existing-job-positions-list">
                {existingPositions.map((pos, idx) => (
                  <option key={idx} value={pos} />
                ))}
              </datalist>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Department / Division</label>
              <input
                type="text"
                className="input-control"
                style={{ height: '40px', fontSize: '0.88rem' }}
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                list="existing-job-departments-list"
                autoComplete="off"
              />
              <datalist id="existing-job-departments-list">
                {existingDepartments.map((dept, idx) => (
                  <option key={idx} value={dept} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 3: Salary, Vacancies & Status */}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Salary Offered ({currency}) *</label>
              <input
                type="number"
                step="0.001"
                className="input-control"
                style={{ height: '40px', fontSize: '0.88rem' }}
                value={form.salary_bhd}
                onChange={e => setForm({ ...form, salary_bhd: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Total Vacancies *</label>
              <input
                type="number"
                min="1"
                className="input-control"
                style={{ height: '40px', fontSize: '0.88rem' }}
                value={form.vacancies_count}
                onChange={e => setForm({ ...form, vacancies_count: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Vacancy Status</label>
              <select
                className="select-control"
                style={{ height: '40px', fontSize: '0.88rem', fontWeight: 600 }}
                value={form.status === 'closed' ? 'closed' : 'active'}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active (Open for Placement)</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Row 3b: Assigned Case Managers (Multi-Select) */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label className="form-label" style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>👔</span> Assign Case Managers
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  (Select case managers responsible for matching & placing candidates)
                </span>
                {form.assigned_case_managers && form.assigned_case_managers.length > 0 && (
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                    {form.assigned_case_managers.length} Assigned
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.72rem', padding: '0.18rem 0.5rem' }}
                  onClick={handleSelectAllCaseManagers}
                >
                  ✓ Select All
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.72rem', padding: '0.18rem 0.5rem' }}
                  onClick={handleClearAllCaseManagers}
                >
                  ✕ Clear All
                </button>
              </div>
            </div>

            {availableCaseManagers.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '0.5rem',
                maxHeight: '160px',
                overflowY: 'auto',
                padding: '0.65rem',
                background: 'var(--bg-tertiary, #f8fafc)',
                border: '1px solid var(--border-light, #e2e8f0)',
                borderRadius: '8px'
              }}>
                {availableCaseManagers.map(cm => {
                  const isSelected = (form.assigned_case_managers || []).some(a => 
                    (a.id !== undefined && a.id !== null && cm.id !== undefined && cm.id !== null && String(a.id) === String(cm.id)) ||
                    (a.username && cm.username && String(a.username).toLowerCase() === String(cm.username).toLowerCase()) ||
                    (a.name && cm.full_name && String(a.name).toLowerCase() === String(cm.full_name).toLowerCase())
                  );

                  return (
                    <label
                      key={cm.id || cm.username || cm.full_name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card, #ffffff)',
                        border: isSelected ? '1.5px solid var(--primary, #2563eb)' : '1px solid var(--border-light, #e2e8f0)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCaseManager(cm)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary, #2563eb)', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <strong style={{ fontSize: '0.82rem', color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {cm.full_name || cm.username}
                        </strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {cm.case_manager_code ? `${cm.case_manager_code} • ` : ''}{cm.center || 'Job Center'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                No active Case Managers registered in the system.
              </div>
            )}
          </div>

          {/* Row 4: Job Requirements */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Candidate Requirements / Qualifications</label>
            <textarea
              className="input-control"
              rows="3"
              style={{ fontSize: '0.86rem', resize: 'vertical', minHeight: '75px', padding: '0.55rem 0.75rem' }}
              value={form.requirements}
              onChange={e => setForm({ ...form, requirements: e.target.value })}
              placeholder="e.g. Minimum education level, technical skills, years of experience, certifications..."
            ></textarea>
          </div>

          {/* Row 5: Job Description */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Job Overview & Responsibilities</label>
            <textarea
              className="input-control"
              rows="4"
              style={{ fontSize: '0.86rem', resize: 'vertical', minHeight: '95px', padding: '0.55rem 0.75rem' }}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Scope of work, key responsibilities, daily duties, reporting lines..."
            ></textarea>
          </div>

        </div>

        <div className="modal-footer" style={{ padding: '0.9rem 1.4rem' }}>
          <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Cancel</button>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontWeight: 700 }} disabled={saving}>
            {saving ? 'Saving Job...' : (isEditing ? 'Save Changes' : 'Post Job Vacancy')}
          </button>
        </div>
      </form>
    </div>
  );
}

// 2c. Placement Dossier Modal (Dedicated Contract & Placement Breakdown)
function PlacementDossierModal({ state, candidate }) {
  if (!candidate) return null;
  const { milestones = [], settings = {} } = state;
  const currency = settings.currency || 'BHD';

  const cMilestones = (milestones || []).filter(m => String(m.candidate_id) === String(candidate.id));

  return (
    <div className="modal-content" style={{ maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(14, 165, 233, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            📜
          </div>
          <div>
            <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              Placement & Contract Dossier
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Candidate: <strong>{candidate.full_name}</strong> &bull; Ref: <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.ref_no}</span>
            </div>
          </div>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Banner with Employer & Status */}
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85 }}>Official Employer Placement</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{candidate.company_name || 'N/A'}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {candidate.position_title} {candidate.job_code ? `• Job Code: ${candidate.job_code}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>Monthly Base Salary</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              {currency} {Number(candidate.salary_bhd || 0).toFixed(3)}
            </div>
            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
              Joined: {window.formatAppDate(candidate.joining_date)}
            </span>
          </div>
        </div>

        {/* 2-Column Specs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
          {/* Candidate Card */}
          <div style={{ background: 'var(--bg-subtle, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>👤</span> Candidate Particulars
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div><strong>CPR:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.cpr_no}</span></div>
              <div><strong>Gender & Education:</strong> {candidate.gender} &bull; {candidate.education}</div>
              <div><strong>Registration Date:</strong> {window.formatAppDate(candidate.registration_date || candidate.created_at)}</div>
              <div><strong>Case Manager:</strong> {candidate.case_manager_name || 'System'}</div>
            </div>
          </div>

          {/* Employer & Compliance Card */}
          <div style={{ background: 'var(--bg-subtle, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🏢</span> Corporate & MOL Terms
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div><strong>Employer CR:</strong> {candidate.employer_cr || 'Not Stated'}</div>
              <div><strong>Employee Type:</strong> {candidate.employee_type || 'Full-Time Standard'}</div>
              <div><strong>MOL Certified:</strong> {candidate.mol_certified || 'Yes'}</div>
              <div><strong>Long MOL:</strong> {candidate.long_mol || 'No'}</div>
            </div>
          </div>

        </div>

        {/* Milestone Gates Ledger */}
        <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🎯</span> Retention Milestone Gates ({cMilestones.length})
          </div>
          {cMilestones.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {cMilestones.map(m => (
                <div key={m.id || m.milestone_title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '0.45rem 0.65rem', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div>
                    <strong>{m.milestone_title}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      Target: {window.formatAppDate(m.target_date)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{currency} {Number(m.claim_amount_bhd || m.amount || 0).toFixed(3)}</span>
                    <span className={`badge ${m.status === 'paid' ? 'badge-success' : (m.status === 'claimed' ? 'badge-info' : 'badge-neutral')}`} style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No milestones found for this candidate.
            </div>
          )}
        </div>

      </div>

      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              window.AppStore.closeModal();
              window.AppStore.openModal('LINK_PLACEMENT', { candidate });
            }}
          >
            ✏️ Edit Placement Details
          </button>
          <button
            type="button"
            className="btn btn-warning"
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
            title="If candidate exited or resigned, renew their registration and return them to the talent pool"
            onClick={() => {
              window.AppStore.closeModal();
              setTimeout(() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate, fromPlaced: true }), 100);
            }}
          >
            <span>🔄</span> Record Exit & Renew to Pool
          </button>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.AppStore.closeModal()}>
          Close Dossier
        </button>
      </div>
    </div>
  );
}

// 3. Update Candidate Status Modal
function UpdateStatusModal({ state, candidate }) {
  if (!candidate) return null;
  const [status, setStatus] = useState(candidate.status || 'placed');
  const [remarks, setRemarks] = useState(candidate.remarks || candidate.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await window.api.candidates.updateStatus(candidate.id, status, remarks);
      window.AppStore.showNotification(`Candidate status updated to '${status.toUpperCase()}'!`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error updating status: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '520px' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">🔄 Maintain Candidate Status</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Candidate: <strong>{candidate.full_name}</strong> (CPR: {candidate.cpr_no})
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Lifecycle Status *</label>
            <select
              className="select-control"
              value={status}
              onChange={e => setStatus(e.target.value)}
              required
            >
              <option value="registered">📋 Available in Pool (Checklist Verified)</option>
              <option value="placed">💼 Placed in Employment</option>
              <option value="registration_incomplete">⚠️ Incomplete Profile (Checklist Pending)</option>
              <option value="resigned">⚠️ Resigned / Exited (Can Renew to Pool)</option>
            </select>
          </div>

          {(status === 'resigned' || candidate.company_name) && (
            <div style={{ padding: '0.75rem 0.85rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 700, color: 'var(--warning, #d97706)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🔄</span> Need to return candidate to Talent Pool?
              </div>
              <div style={{ lineHeight: 1.4 }}>
                If candidate exited or resigned, you can directly <strong>Renew</strong> them to archive this placement and make them available in the talent pool with a fresh 12-month validity period (preserving Ref: <strong>{candidate.ref_no}</strong>).
              </div>
              <button
                type="button"
                className="btn btn-warning btn-sm"
                style={{ marginTop: '0.5rem', fontSize: '0.74rem', padding: '0.25rem 0.6rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  window.AppStore.closeModal();
                  setTimeout(() => window.AppStore.openModal('RENEW_CANDIDATE', { candidate, fromPlaced: true }), 120);
                }}
              >
                <span>🔄</span> Exit & Renew to Pool &rarr;
              </button>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Status Change Reason / Remarks</label>
            <textarea
              className="input-control"
              rows="3"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 4. Candidate Documents Manager Modal
function CandidateDocumentsModal({ state, candidate: initialCandidate }) {
  if (!initialCandidate) return null;
  const liveCandidate = state.candidates?.find(c => c.id === initialCandidate.id || c.ref_no === initialCandidate.ref_no) || initialCandidate;
  const [docs, setDocs] = useState(liveCandidate.documents || []);
  const documentCategories = state?.documentCategories || [];
  const activeDocCategories = useMemo(() => {
    const list = (documentCategories || []).filter(c => c.is_active !== 0 && c.is_active !== false);
    if (list.length > 0) return list;
    return [
      { id: 1, code: 'CPR', name: 'CPR / Smart Card Copy', icon: '🆔', description: 'Valid Kingdom of Bahrain CPR Smart Card front/back copy or National ID proof.' },
      { id: 2, code: 'RESUME', name: 'Resume / CV', icon: '📄', description: 'Current professional curriculum vitae detailing education and employment background.' },
      { id: 3, code: 'DEGREE', name: 'Educational Degree / Certificate', icon: '🎓', description: 'Graduation diploma or accredited academic qualification certificate.' },
      { id: 4, code: 'CONTRACT', name: 'Employment Offer / Contract', icon: '📝', description: 'Formal tripartite or bilateral employment agreement signed with sponsoring employer.' },
      { id: 5, code: 'GOSI', name: 'GOSI Certificate', icon: '📑', description: 'Official Social Insurance (GOSI) record demonstrating employment and contribution history.' },
      { id: 6, code: 'OTHER', name: 'Other Supporting Document', icon: '📎', description: 'Supplementary certificates, licenses, or professional credentials.' }
    ];
  }, [documentCategories]);

  const [uploadDocType, setUploadDocType] = useState(() => activeDocCategories[0]?.name || 'CPR / Smart Card Copy');
  const [uploadDocName, setUploadDocName] = useState(() => activeDocCategories[0]?.name || 'CPR / Smart Card Copy');
  const [uploading, setUploading] = useState(false);

  const selectedDocCategory = activeDocCategories.find(c => 
    c.name === uploadDocType || 
    c.code === uploadDocType ||
    String(c.name).trim().toLowerCase() === String(uploadDocType).trim().toLowerCase()
  ) || activeDocCategories[0] || null;

  useEffect(() => {
    if (liveCandidate && liveCandidate.documents) {
      setDocs(liveCandidate.documents);
    }
  }, [liveCandidate?.documents]);

  const handleUploadFile = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (uploadEvent) => {
        setUploading(true);
        try {
          const base64Data = uploadEvent.target.result;
          const res = await window.api.candidates.uploadDocument({
            candidate_id: liveCandidate.id,
            name: uploadDocName.trim() || file.name.replace(/\.[^/.]+$/, ""),
            type: uploadDocType,
            file_name: file.name,
            file_data: base64Data
          });

          // Immediately update list below without requiring modal close/reopen
          if (res && res.data) {
            if (Array.isArray(res.data.documents)) {
              setDocs(res.data.documents);
            } else if (res.data.file_url || res.data.file_name) {
              setDocs(prev => [...prev, res.data]);
            }
          }

          if (window.Swal) {
            window.Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: `Document '${file.name}' attached!`,
              showConfirmButton: false,
              timer: 2500
            });
          } else {
            window.AppStore.showNotification(`Document '${file.name}' uploaded successfully!`, 'success');
          }
          setUploadDocName(uploadDocType);
          await window.AppStore.refreshData();
        } catch (err) {
          if (window.Swal) {
            window.Swal.fire({
              title: 'Upload Failed',
              text: err.message,
              icon: 'error'
            });
          } else {
            window.AppStore.showNotification('Failed to upload document: ' + err.message, 'error');
          }
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDeleteDoc = async (docId, docName = '') => {
    const swal = window.Swal || window.swal;
    if (swal) {
      const result = await swal.fire({
        title: 'Remove Document?',
        text: docName 
          ? `Are you sure you want to remove "${docName}" from this candidate's vault?` 
          : 'Are you sure you want to remove this document?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Remove It',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        focusCancel: true
      });

      if (!result.isConfirmed) return;
    } else if (!confirm('Are you sure you want to remove this document?')) {
      return;
    }

    // Immediately remove from list below
    setDocs(prev => prev.filter(d => d.id !== docId));

    try {
      await window.api.candidates.deleteDocument(liveCandidate.id, docId);
      if (window.Swal) {
        window.Swal.fire({
          title: 'Removed!',
          text: 'Document has been removed successfully.',
          icon: 'success',
          timer: 1800,
          showConfirmButton: false
        });
      } else {
        window.AppStore.showNotification('Document removed successfully', 'success');
      }
      await window.AppStore.refreshData();
    } catch (err) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Error',
          text: 'Error removing document: ' + err.message,
          icon: 'error'
        });
      } else {
        window.AppStore.showNotification('Error removing document: ' + err.message, 'error');
      }
      await window.AppStore.refreshData();
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '680px' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">📁 Candidate Document Vault</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Candidate: <strong>{liveCandidate.full_name}</strong> | Ref: {liveCandidate.ref_no}
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body">
        {/* Upload New Document Box */}
        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--border-light)' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary)' }}>
            📤 Upload Verification Document
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.65rem', alignItems: 'end' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Category</label>
              <select
                className="select-control"
                style={{ fontSize: '0.82rem' }}
                value={uploadDocType}
                onChange={e => {
                  const newCat = e.target.value;
                  setUploadDocType(newCat);
                  setUploadDocName(newCat);
                }}
              >
                {activeDocCategories.map(cat => (
                  <option key={cat.code || cat.id} value={cat.name}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Label / Title</label>
              <input
                type="text"
                className="input-control"
                style={{ fontSize: '0.82rem' }}
                value={uploadDocName}
                onChange={e => setUploadDocName(e.target.value)}
              />
            </div>
            <div>
              <label
                className="btn btn-primary"
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.75 : 1,
                  whiteSpace: 'nowrap'
                }}
              >
                {uploading ? '⏳ Uploading...' : 'Browse & Upload'}
                <input
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleUploadFile}
                  disabled={uploading}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                />
              </label>
            </div>
          </div>

          {selectedDocCategory?.description && (
            <div style={{
              marginTop: '0.65rem',
              fontSize: '0.74rem',
              color: 'var(--text-secondary, #475569)',
              background: 'rgba(59, 130, 246, 0.07)',
              borderLeft: '3px solid #3b82f6',
              padding: '0.4rem 0.65rem',
              borderRadius: '0 4px 4px 0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.45rem',
              lineHeight: 1.4
            }}>
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>💡</span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedDocCategory.name}: </strong>
                <span>{selectedDocCategory.description}</span>
              </div>
            </div>
          )}
        </div>

        {/* Existing Documents List */}
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.65rem' }}>
          Attached Documents ({docs.length})
        </h4>

        {docs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '250px', overflowY: 'auto' }}>
            {docs.map(doc => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.9rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{doc.type}</span>
                    <strong style={{ fontSize: '0.88rem' }}>{doc.name}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {doc.file_name} • {(doc.file_size / 1024).toFixed(1)} KB • Uploaded: {window.formatAppDate(doc.uploaded_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {doc.file_url ? (
                    <>
                      <a
                        href={doc.file_url.startsWith('http') || doc.file_url.startsWith('/') ? doc.file_url : '/' + doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{ textDecoration: 'none' }}
                        title="View document in new tab"
                      >
                        👁️ View
                      </a>
                      <a
                        href={doc.file_url.startsWith('http') || doc.file_url.startsWith('/') ? doc.file_url : '/' + doc.file_url}
                        download={doc.file_name || true}
                        className="btn btn-outline btn-sm"
                        style={{ textDecoration: 'none' }}
                        title="Download file directly"
                      >
                        ⬇️ Download
                      </a>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No file link</span>
                  )}
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                    onClick={() => handleDeleteDoc(doc.id, doc.name || doc.file_name)}
                    title="Delete document"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
            <p>No documents uploaded yet for this candidate.</p>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Close</button>
      </div>
    </div>
  );
}

// 4b. Candidate Registration Checklist Verification Modal
function CandidateChecklistModal({ state, candidate: initialCandidate }) {
  if (!initialCandidate) return null;
  const liveCandidate = state.candidates?.find(c => c.id === initialCandidate.id || c.ref_no === initialCandidate.ref_no) || initialCandidate;
  const checklistMasters = state.checklistMasters || [];

  const activeChecklistMasters = useMemo(() => {
    if (Array.isArray(checklistMasters) && checklistMasters.length > 0) {
      return checklistMasters.filter(m => m.is_active !== 0);
    }
    return [
      { id: 1, code: 'CPR_VERIF', title: 'CPR Identity & Smart Card Verification', weight: 25, is_mandatory: 1, category: 'Identity & Legal', description: 'Valid Bahrain CPR Smart Card copy uploaded and identity confirmed against National Population Registry.' },
      { id: 2, code: 'CV_RESUME', title: 'Curriculum Vitae (CV / Resume) Vetted', weight: 20, is_mandatory: 1, category: 'Profile & Qualifications', description: 'Current professional resume submitted, verified, and tagged with candidate specializations.' },
      { id: 3, code: 'EDU_CERT', title: 'Educational Certificate / Attested Degree', weight: 20, is_mandatory: 1, category: 'Profile & Qualifications', description: 'Verified graduation degree or diploma certificate from accredited institution.' },
      { id: 4, code: 'BANK_IBAN', title: 'Bank Account IBAN Certificate', weight: 15, is_mandatory: 1, category: 'Banking & Compliance', description: 'Official bank account verification letter / IBAN certificate in candidate name.' },
      { id: 5, code: 'GOSI_RECORD', title: 'GOSI Employment History / Status Record', weight: 10, is_mandatory: 0, category: 'Compliance & Verification', description: 'Social insurance contribution clearance confirming candidate eligibility.' },
      { id: 6, code: 'MOL_AGREE', title: 'MOL & Placement Retention Consent', weight: 10, is_mandatory: 1, category: 'Compliance & Verification', description: 'Signed candidate acknowledgment of Ministry of Labour employment terms.' }
    ];
  }, [checklistMasters]);

  // Initial checked state from live candidate
  const [checkedItems, setCheckedItems] = useState(() => {
    const s = new Set();
    const candItems = liveCandidate.checklist_items || [];
    if (Array.isArray(candItems)) {
      candItems.forEach(ci => {
        if (typeof ci === 'string') s.add(ci);
        else if (ci && (ci.completed || ci.is_checked)) s.add(ci.code || String(ci.id));
      });
    }
    return s;
  });

  const [saving, setSaving] = useState(false);

  const checklistEval = useMemo(() => {
    let totalWeight = 0;
    let earnedWeight = 0;
    const missingMandatory = [];

    activeChecklistMasters.forEach(item => {
      const w = parseInt(item.weight, 10) || 10;
      totalWeight += w;
      const isChecked = checkedItems.has(item.code) || checkedItems.has(String(item.id)) || checkedItems.has(Number(item.id));
      if (isChecked) {
        earnedWeight += w;
      } else if (item.is_mandatory) {
        missingMandatory.push(item);
      }
    });

    const percentage = totalWeight > 0 ? Math.min(100, Math.round((earnedWeight / totalWeight) * 100)) : 0;
    const canProceed = missingMandatory.length === 0;

    return {
      totalWeight,
      earnedWeight,
      percentage,
      canProceed,
      missingMandatory,
      items: activeChecklistMasters
    };
  }, [activeChecklistMasters, checkedItems]);

  const toggleChecklist = (codeOrId) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(codeOrId)) next.delete(codeOrId);
      else next.add(codeOrId);
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set();
    activeChecklistMasters.forEach(m => {
      next.add(m.code);
      next.add(String(m.id));
    });
    setCheckedItems(next);
  };

  const handleClearAll = () => {
    setCheckedItems(new Set());
  };

  const handleSaveChecklist = async () => {
    setSaving(true);
    try {
      await window.api.candidates.updateChecklist(liveCandidate.id, Array.from(checkedItems));
      window.AppStore.showNotification(`Checklist updated: ${liveCandidate.full_name} is now ${checklistEval.percentage}% compliant!`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Failed to update checklist: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '740px', maxHeight: '92vh', overflowY: 'auto' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(14, 165, 233, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            📋
          </div>
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>Candidate Compliance & Registration Checklist</h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Candidate: <strong>{liveCandidate.full_name}</strong> &bull; Ref: <span style={{ fontFamily: 'var(--font-mono)' }}>{liveCandidate.ref_no}</span> &bull; CPR: <span style={{ fontFamily: 'var(--font-mono)' }}>{liveCandidate.cpr_no}</span>
            </span>
          </div>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Progress & Summary Banner */}
        <div style={{ background: 'var(--bg-subtle, #f8fafc)', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Registration Compliance Score</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {checklistEval.canProceed
                  ? 'All mandatory onboarding requirements verified'
                  : `${checklistEval.missingMandatory.length} mandatory item(s) pending completion`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: checklistEval.percentage === 100 
                  ? 'var(--success, #10b981)' 
                  : (checklistEval.canProceed ? 'var(--primary, #0ea5e9)' : 'var(--warning, #f59e0b)')
              }}>
                {checklistEval.percentage}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '10px', background: 'var(--bg-tertiary, #e2e8f0)', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.65rem' }}>
            <div style={{
              width: `${checklistEval.percentage}%`,
              height: '100%',
              background: checklistEval.percentage === 100 
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : (checklistEval.canProceed ? 'linear-gradient(90deg, #0284c7, #0ea5e9)' : 'linear-gradient(90deg, #f59e0b, #ef4444)'),
              transition: 'width 0.3s ease, background 0.3s ease'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className={`badge ${checklistEval.canProceed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.74rem' }}>
              {checklistEval.canProceed ? '✓ Mandatory Compliance Satisfied' : '⚠️ Missing Mandatory Criteria'}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }} onClick={handleSelectAll}>
                ✓ Select All
              </button>
              <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }} onClick={handleClearAll}>
                ✕ Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Criteria List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {checklistEval.items.map(item => {
            const isChecked = checkedItems.has(item.code) || checkedItems.has(String(item.id)) || checkedItems.has(Number(item.id));
            return (
              <div
                key={item.code || item.id}
                onClick={() => toggleChecklist(item.code || String(item.id))}
                style={{
                  border: `1px solid ${isChecked ? 'var(--success, #10b981)' : 'var(--border-color, #e2e8f0)'}`,
                  background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-subtle, #f8fafc)',
                  borderRadius: '6px',
                  padding: '0.75rem 0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{item.title}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {item.is_mandatory ? (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>* Mandatory</span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>Optional</span>
                      )}
                      <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>+{item.weight}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSaveChecklist} disabled={saving}>
          {saving ? 'Saving...' : `Save Verification (${checklistEval.percentage}%)`}
        </button>
      </div>
    </div>
  );
}

// 5. Candidate Comprehensive Dossier & Milestones Timeline Modal
function CandidateDetailModal({ state, candidate }) {
  if (!candidate) return null;
  const { milestones, settings } = state;
  const candMilestones = milestones.filter(m => m.candidate_id === candidate.id);
  const currency = settings.currency || 'BHD';
  const docs = candidate.documents || [];

  return (
    <div className="modal-content" style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">{candidate.full_name}</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Ref: {candidate.ref_no} | CPR: {candidate.cpr_no}{candidate.phone ? ` | 📞 ${candidate.phone}` : ''}{candidate.email ? ` | ✉️ ${candidate.email}` : ''} | Status: <strong style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>{candidate.status || 'placed'}</strong>
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Candidate Profile Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GENDER & EDUCATION</div>
            <strong style={{ fontSize: '0.85rem' }}>{candidate.gender} • {candidate.education}</strong>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CONTACT DETAILS</div>
            <strong style={{ fontSize: '0.85rem' }}>{candidate.phone || 'No phone'}</strong>
            {candidate.email && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {candidate.email}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DATE OF BIRTH & AGE</div>
            <strong style={{ fontSize: '0.85rem' }}>
              {candidate.date_of_birth ? (
                <span>
                  {window.formatAppDate(candidate.date_of_birth)}
                  {window.calculateAge && window.calculateAge(candidate.date_of_birth) !== null ? ` (${window.calculateAge(candidate.date_of_birth)}y)` : ''}
                </span>
              ) : 'Not specified'}
            </strong>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>REGISTRATION DATE</div>
            <strong style={{ fontSize: '0.85rem' }}>{window.formatAppDate(candidate.registration_date || candidate.created_at)}</strong>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CASE MANAGER</div>
            <strong style={{ fontSize: '0.85rem' }}>{candidate.case_manager_name}</strong>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>REGISTRATION CENTER</div>
            <strong style={{ fontSize: '0.85rem', color: '#4f46e5' }}>🏬 {candidate.center || 'Enma Mall'}</strong>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ATTACHED DOCUMENTS</div>
            <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>📎 {docs.length} Files</strong>
          </div>
        </div>

        {/* Government & Tamkeen Approvals Status */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              🏬 Ministry Job Center Approval
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span className="badge badge-success" style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                ✓ Approved (Yes)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {window.formatAppDate(candidate.job_center_approved_at || candidate.registration_date || candidate.created_at)}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              🏛️ Tamkeen Scheme Approval
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {(candidate.approved_by_tamkeen === true || String(candidate.approved_by_tamkeen || '').toLowerCase() === 'yes') ? (
                <span className="badge badge-success" style={{ fontSize: '0.74rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.18)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                  ✓ Approved (Yes) {candidate.tamkeen_approval_date ? `• ${window.formatAppDate(candidate.tamkeen_approval_date)}` : ''}
                </span>
              ) : (
                <span className="badge badge-warning" style={{ fontSize: '0.74rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.18)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                  ⏳ Pending Tamkeen Approval (No)
                </span>
              )}
              {candidate.tamkeen_approval_notes && (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  ({candidate.tamkeen_approval_notes})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Linked Employer Placement Box */}
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              🏢 Linked Employer Placement
            </h3>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                window.AppStore.closeModal();
                window.AppStore.openModal('LINK_PLACEMENT', { candidate });
              }}
            >
              ✏️ Edit / Re-link Placement
            </button>
          </div>

          {candidate.company_name ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: candidate.comments ? '0.75rem' : 0 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>EMPLOYER</div>
                  <strong style={{ fontSize: '0.88rem' }}>{candidate.company_name}</strong>
                  {candidate.employer_cr && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CR: {candidate.employer_cr}</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>POSITION & TYPE</div>
                  <strong style={{ fontSize: '0.88rem' }}>{candidate.position_title}</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{candidate.employee_type || 'Full-Time'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SALARY & JOINING</div>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                    {currency} {Number(candidate.salary_bhd || 0).toFixed(3)}
                  </strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Joined: {window.formatAppDate(candidate.joining_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MOL / LONG MOL</div>
                  <strong style={{ fontSize: '0.85rem' }}>MOL: {candidate.mol_certified || 'Yes'}</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Long MOL: {candidate.long_mol || 'No'}</div>
                </div>
              </div>

              {candidate.comments && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong>Placement Comments:</strong> {candidate.comments}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: '0 0 0.5rem' }}>No employer placement currently linked to this candidate.</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  window.AppStore.closeModal();
                  window.AppStore.openModal('LINK_PLACEMENT', { candidate });
                }}
              >
                🔗 Link Placement Now
              </button>
            </div>
          )}
        </div>

        {/* Remarks / Notes */}
        {candidate.remarks || candidate.notes ? (
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>REMARKS & CAREER NOTES</div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{candidate.remarks || candidate.notes}</p>
          </div>
        ) : null}

        {/* Registration Compliance Checklist Box */}
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📋</span> Registration Compliance Checklist
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`badge ${(candidate.checklist_completion_pct || 0) >= 100 ? 'badge-success' : ((candidate.checklist_completion_pct || 0) >= 70 ? 'badge-info' : 'badge-warning')}`} style={{ fontSize: '0.78rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {candidate.checklist_completion_pct || 0}% Compliant
              </span>
              <button
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
                onClick={() => {
                  window.AppStore.closeModal();
                  window.AppStore.openModal('CANDIDATE_CHECKLIST', { candidate });
                }}
              >
                ✏️ Manage Checklist &rarr;
              </button>
            </div>
          </div>
          {/* Micro Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary, #e2e8f0)', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div style={{
              width: `${candidate.checklist_completion_pct || 0}%`,
              height: '100%',
              background: (candidate.checklist_completion_pct || 0) >= 100 ? 'var(--success, #10b981)' : ((candidate.checklist_completion_pct || 0) >= 70 ? 'var(--primary, #0ea5e9)' : 'var(--warning, #f59e0b)'),
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {(candidate.checklist_completion_pct || 0) >= 100 
              ? '✓ All mandatory identity, educational, banking, and retainment compliance criteria verified.'
              : 'Criteria verification in progress. Click Manage Checklist to update verified criteria and certificates.'}
          </div>
        </div>

        {/* Retention Milestones Timeline */}
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            ⏱️ Retention Milestones Timeline (Day 0, Day 180, Day 365)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {candMilestones.map(m => (
              <div
                key={m.id}
                style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-info">{m.milestone_title}</span>
                    <strong style={{ fontSize: '0.85rem' }}>{m.milestone_type}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Target Due Date: <strong>{window.formatAppDate(m.due_date)}</strong>
                  </div>
                </div>
                <div>
                  <span className={`badge ${
                    m.status === 'claimed' ? 'badge-success' : 
                    (m.status === 'due' ? 'badge-warning' : 'badge-neutral')
                  }`}>
                    {m.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
            {candMilestones.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Milestones will be generated automatically once an employer placement is linked.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            window.AppStore.closeModal();
            window.AppStore.openModal('CANDIDATE_DOCUMENTS', { candidate });
          }}
        >
          📁 View / Manage Documents ({docs.length})
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.AppStore.closeModal()}>Close</button>
      </div>
    </div>
  );
}

// Tamkeen Scheme Manual Approval Modal
function TamkeenApprovalModal({ state, candidate }) {
  if (!candidate) return null;
  const { useState } = React;
  const [approvalDate, setApprovalDate] = useState(() => candidate.tamkeen_approval_date || new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(() => candidate.tamkeen_approval_notes || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const payload = {
        approval_date: approvalDate || new Date().toISOString().split('T')[0],
        notes: notes || ''
      };

      // 1. Invoke API method or fallback direct fetch
      let updatedCandidate = null;
      if (window.api && window.api.candidates && typeof window.api.candidates.approveTamkeen === 'function') {
        updatedCandidate = await window.api.candidates.approveTamkeen(candidate.id, payload);
      } else {
        const base = window.location.pathname.includes('/Claims') ? '/Claims/api' : '/api';
        const res = await fetch(`${base}/candidates/${candidate.id}/tamkeen-approval`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(window.AppStore?.getState()?.currentUser ? {
              'X-User-Id': window.AppStore.getState().currentUser.id,
              'X-User-Role': window.AppStore.getState().currentUser.role
            } : {})
          },
          body: JSON.stringify(payload)
        });
        const resJson = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(resJson?.message || `HTTP Error ${res.status}`);
        }
        updatedCandidate = resJson?.data || resJson;
      }

      // 2. Immediately close the modal overlay
      if (window.AppStore && window.AppStore.closeModal) {
        window.AppStore.closeModal();
      }

      // 3. Instant optimistic update to store state so UI reflects changes immediately
      if (window.AppStore) {
        const appState = window.AppStore.getState();
        const effectiveApprovalDate = payload.approval_date;
        const effectiveNotes = payload.notes;
        const currentOfficer = appState.currentUser?.full_name || 'Tamkeen Officer';

        const updatedCandidates = (appState.candidates || []).map(c => {
          if (c.id === candidate.id || c.ref_no === candidate.ref_no) {
            return {
              ...c,
              ...(updatedCandidate && typeof updatedCandidate === 'object' ? updatedCandidate : {}),
              approved_by_tamkeen: 'Yes',
              tamkeen_approval_date: effectiveApprovalDate,
              tamkeen_approval_notes: effectiveNotes,
              tamkeen_approved_by: currentOfficer,
              tamkeen_approved_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
            };
          }
          return c;
        });

        window.AppStore.setState({ candidates: updatedCandidates });
      }

      // 4. Instant user notification
      if (window.AppStore && window.AppStore.showNotification) {
        window.AppStore.showNotification(`Candidate '${candidate.full_name}' approved by Tamkeen successfully!`, 'success');
      }

      if (window.swal) {
        window.swal.fire({
          icon: 'success',
          title: 'Tamkeen Approved!',
          text: `Candidate '${candidate.full_name}' has been successfully approved for Tamkeen scheme.`,
          timer: 2200,
          showConfirmButton: false
        });
      }

      // 5. Background re-fetch to sync KPIs, audit logs and relational data
      if (window.AppStore && window.AppStore.refreshData) {
        window.AppStore.refreshData().catch(err => console.warn('Background refreshData error:', err));
      }
    } catch (err) {
      console.error('Tamkeen approval failed:', err);
      const errMsg = err.message || 'Could not record Tamkeen approval.';
      if (window.AppStore && window.AppStore.showNotification) {
        window.AppStore.showNotification('Approval Failed: ' + errMsg, 'error');
      }
      if (window.swal) {
        window.swal.fire({
          icon: 'error',
          title: 'Approval Failed',
          text: errMsg
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '560px', width: '100%' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
            <span>🏛️</span> Tamkeen Scheme Approval
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Record official Tamkeen placement & wage subsidy scheme approval
          </span>
        </div>
        <button type="button" className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>&times;</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
          {/* Candidate Profile Summary Box */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {candidate.full_name}
              </strong>
              <span className="badge badge-success" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                🏬 Job Center: Approved
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
              <div><strong>CPR:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.cpr_no}</span></div>
              <div><strong>Ref:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.ref_no}</span></div>
              <div><strong>Center:</strong> 🏬 {candidate.center || 'Enma Mall'}</div>
              <div><strong>Education:</strong> {candidate.education || 'High School / Diploma'}</div>
            </div>
          </div>

          {/* Form Input 1: Approval Date */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Approval Date *
            </label>
            <input
              type="date"
              className="input-control"
              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
              value={approvalDate}
              onChange={e => setApprovalDate(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
              Defaults to current date. Adjust if backdating official Tamkeen decisions.
            </span>
          </div>

          {/* Form Input 2: Approval Notes & Remarks */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Approval Notes / Remarks (Optional)
            </label>
            <textarea
              className="input-control"
              rows="3"
              style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.82rem', resize: 'vertical' }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.AppStore.closeModal()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary"
            style={{ background: '#059669', borderColor: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: submitting ? 'not-allowed' : 'pointer' }}
            disabled={submitting}
          >
            {submitting ? 'Recording Approval...' : '✓ Confirm Tamkeen Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 6. New Claim Modal (User enters the claim amount manually)
// 6. New Claim Modal (User sets claim amount for the selected employee)
function NewClaimModal({ state, initialProps = {} }) {
  const { candidates = [], milestones = [], currentUser, settings = {} } = state;
  const currency = settings.currency || 'BHD';

  // Determine pre-selected candidate
  const initialCandidate = initialProps.candidate || candidates.find(c => c.id === (initialProps.candidate_id || initialProps.candidate?.id));
  const candidateSalary = Number(initialCandidate?.salary_bhd || 0);

  // Normalize initial claim type / milestone stage
  const rawType = initialProps.claim_type || initialProps.milestone_type || '';
  const rawStage = initialProps.milestone_stage;
  let resolvedClaimType = 'placement';
  if (rawStage === 180 || rawType === '180_days' || rawType === 'probation_completion' || rawType === 'retention_6m') {
    resolvedClaimType = '180_days';
  } else if (rawStage === 365 || rawType === '365_days' || rawType === 'year_completion' || rawType === 'retention_12m') {
    resolvedClaimType = '365_days';
  } else if (rawStage === 0 || rawType === 'placement' || rawType === 'initial_placement') {
    resolvedClaimType = 'placement';
  }

  // Pre-selected milestone ID
  const initialMilestoneId = initialProps.milestone_id || initialProps.milestone?.id || '';

  // Default claim amount: placement salary if set, otherwise standard tier value from settings
  const standardTierVal = state.settings?.standard_tier_amount_bhd ? Number(state.settings.standard_tier_amount_bhd).toFixed(3) : '500.000';
  const defaultAmount = candidateSalary > 0 ? candidateSalary.toFixed(3) : standardTierVal;

  const [form, setForm] = useState({
    candidate_id: initialCandidate?.id || candidates[0]?.id || '',
    milestone_id: initialMilestoneId ? String(initialMilestoneId) : '',
    claim_type: resolvedClaimType,
    claim_amount_bhd: defaultAmount,
    remarks: initialCandidate 
      ? `Placement subsidy claim for ${initialCandidate.full_name} (${initialCandidate.company_name || 'Placement'})` 
      : 'Standard retention claim under program guidelines'
  });
  const [saving, setSaving] = useState(false);

  // Active candidate object for display
  const activeCandidate = initialCandidate || candidates.find(c => c.id === form.candidate_id);
  const activeSalary = Number(activeCandidate?.salary_bhd || 0);

  // Filter milestones belonging to currently selected candidate
  const candidateMilestones = useMemo(() => {
    if (!form.candidate_id) return [];
    return (milestones || []).filter(m => String(m.candidate_id) === String(form.candidate_id));
  }, [milestones, form.candidate_id]);

  const handleCandidateChange = (candId) => {
    const selected = candidates.find(c => c.id === candId);
    const sal = Number(selected?.salary_bhd || 0);
    const relatedMs = (milestones || []).filter(m => String(m.candidate_id) === String(candId));
    const firstUnclaimed = relatedMs.find(m => m.status !== 'claimed') || relatedMs[0];

    setForm({
      ...form,
      candidate_id: candId,
      milestone_id: firstUnclaimed ? String(firstUnclaimed.id) : '',
      claim_type: firstUnclaimed ? (firstUnclaimed.milestone_type || 'placement') : form.claim_type,
      claim_amount_bhd: sal > 0 ? sal.toFixed(3) : form.claim_amount_bhd,
      remarks: selected ? `Placement subsidy claim for ${selected.full_name} (${selected.company_name || 'Placement'})` : form.remarks
    });
  };

  const setAmountPreset = (amt) => {
    setForm(prev => ({ ...prev, claim_amount_bhd: Number(amt).toFixed(3) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.candidate_id || form.claim_amount_bhd === '') {
      window.AppStore.showNotification('Candidate and Claim Amount are required', 'error');
      return;
    }

    setSaving(true);
    try {
      await window.api.claims.create({
        candidate_id: form.candidate_id,
        milestone_id: form.milestone_id || null,
        claim_type: form.claim_type,
        claim_amount_bhd: parseFloat(form.claim_amount_bhd),
        remarks: form.remarks
      });
      window.AppStore.showNotification(`Claim for ${currency} ${Number(form.claim_amount_bhd).toFixed(3)} registered!`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error filing claim: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '640px' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">
            {initialCandidate ? `📝 Register Claim: ${initialCandidate.full_name}` : '📝 Register Placement Claim'}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Specify the claim amount and milestone stage to be registered for this employee
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 1. EMPLOYEE CONTEXT: Show locked card if pre-selected, otherwise show dropdown */}
          {initialCandidate ? (
            <div
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Target Employee / Candidate
                  </div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {initialCandidate.full_name}
                  </strong>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    Ref: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>{initialCandidate.ref_no}</span> • CPR: {initialCandidate.cpr_no}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Monthly Salary
                  </div>
                  <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                    {currency} {Number(initialCandidate.salary_bhd || 0).toFixed(3)}
                  </strong>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    Joined: {window.formatAppDate(initialCandidate.joining_date)}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>🏢 <strong>{initialCandidate.company_name || 'Employer Pending'}</strong> {initialCandidate.employer_cr ? `(CR: ${initialCandidate.employer_cr})` : ''}</span>
                <span>💼 {initialCandidate.position_title || 'Position'} • {initialCandidate.employee_type || 'Full-Time'}</span>
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Select Employee Placement *</label>
              <select
                className="select-control"
                value={form.candidate_id}
                onChange={e => handleCandidateChange(parseInt(e.target.value))}
                required
              >
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.ref_no}) - {c.company_name || 'No Company'} ({currency} {Number(c.salary_bhd || 0).toFixed(3)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. CLAIM AMOUNT INPUT & SMART PRESETS */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                💰 Claim Amount ({currency}) *
              </label>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Agreed reimbursement amount to be claimed
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                {currency}
              </span>
              <input
                type="number"
                step="0.001"
                min="0"
                className="input-control"
                style={{ fontSize: '1.15rem', fontWeight: 800, padding: '0.45rem 0.75rem' }}
                value={form.claim_amount_bhd}
                onChange={e => setForm({ ...form, claim_amount_bhd: e.target.value })}
                placeholder="0.000"
                required
              />
            </div>

            {/* Quick Presets based on employee's salary */}
            {activeSalary > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}
                  onClick={() => setAmountPreset(activeSalary)}
                  title="Set claim amount equal to 1 month salary"
                >
                  100% Salary ({currency} {activeSalary.toFixed(3)})
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}
                  onClick={() => setAmountPreset(activeSalary * 0.7)}
                  title="Set claim amount to 70% of salary"
                >
                  70% ({currency} {(activeSalary * 0.7).toFixed(3)})
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}
                  onClick={() => setAmountPreset(activeSalary * 0.5)}
                  title="Set claim amount to 50% of salary"
                >
                  50% ({currency} {(activeSalary * 0.5).toFixed(3)})
                </button>
              </div>
            )}
          </div>

          {/* 3. CLAIM TYPE / MILESTONE STAGE SELECTION */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Claim Milestone Stage *</span>
              {form.milestone_id && (
                <span style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 600 }}>
                  Gate Ref: #{form.milestone_id}
                </span>
              )}
            </label>
            <select
              className="select-control"
              value={form.milestone_id ? String(form.milestone_id) : form.claim_type}
              onChange={e => {
                const selectedVal = e.target.value;
                const ms = candidateMilestones.find(m => String(m.id) === String(selectedVal));
                if (ms) {
                  setForm(prev => ({
                    ...prev,
                    milestone_id: String(ms.id),
                    claim_type: ms.milestone_type || 'placement'
                  }));
                } else {
                  let cType = selectedVal;
                  if (selectedVal === 'initial_placement') cType = 'placement';
                  if (selectedVal === 'probation_completion' || selectedVal === 'retention_6m') cType = '180_days';
                  if (selectedVal === 'year_completion' || selectedVal === 'retention_12m') cType = '365_days';
                  const matchMs = candidateMilestones.find(m => m.milestone_type === cType);
                  setForm(prev => ({
                    ...prev,
                    milestone_id: matchMs ? String(matchMs.id) : '',
                    claim_type: cType
                  }));
                }
              }}
              required
            >
              {candidateMilestones.length > 0 ? (
                candidateMilestones.map(m => {
                  const stageLabel = m.milestone_stage === 0 ? 'Day 0 Gate' : (m.milestone_stage === 180 ? 'Day 180 Gate (+6m)' : 'Day 365 Gate (+12m)');
                  const targetStr = m.target_date || m.due_date ? ` • Target: ${window.formatAppDate(m.target_date || m.due_date)}` : '';
                  const statusStr = m.status === 'claimed' ? ' [Already Claimed]' : (m.status === 'due' || m.status === 'overdue' ? ' [Action Required]' : '');
                  return (
                    <option key={m.id} value={String(m.id)}>
                      {m.milestone_title || `Retention Milestone (${stageLabel})`} ({stageLabel}){targetStr}{statusStr}
                    </option>
                  );
                })
              ) : (
                <>
                  <option value="placement">Placement Claim (Day 0 / Initial Placement Gate)</option>
                  <option value="180_days">6-Month Retention Claim (+180 Days / Month 6)</option>
                  <option value="365_days">12-Month Retention Claim (+365 Days / Month 12)</option>
                </>
              )}
            </select>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Select the specific retention milestone gate being claimed for wage subsidy disbursement.
            </div>
          </div>

          {/* 4. CLAIM REMARKS */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Claim Remarks / Justification</label>
            <textarea
              className="input-control"
              rows="2"
              value={form.remarks}
              onChange={e => setForm({ ...form, remarks: e.target.value })}
              placeholder="e.g. Approved standard placement subsidy under program terms"
            ></textarea>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Submitting...' : `Submit Claim (${currency} ${Number(form.claim_amount_bhd || 0).toFixed(3)})`}
          </button>
        </div>
      </form>
    </div>
  );
}


// 7. New Payment Receipt Modal
function NewPaymentModal({ state, initialProps = {} }) {
  const { claims, settings } = state;
  const currency = settings.currency || 'BHD';
  const undisputedClaims = (claims || []).filter(c => c.status !== 'settled');
  const availableClaims = [...undisputedClaims];
  if (initialProps.claim && !availableClaims.some(c => String(c.id) === String(initialProps.claim.id))) {
    availableClaims.unshift(initialProps.claim);
  }

  const initialClaim = initialProps.claim || availableClaims.find(c => String(c.id) === String(initialProps.claim_id)) || availableClaims[0];
  const initialAmount = (initialClaim?.balance_bhd !== undefined && initialClaim?.balance_bhd !== null)
    ? initialClaim.balance_bhd
    : (initialClaim?.claim_amount_bhd || '700.000');

  // Sequential receipt generation: RCPT-YYYY-NNNN
  const computeNextReceipt = () => {
    const year = new Date().getFullYear();
    let maxNum = 0;
    (state.payments || []).forEach(p => {
      const match = (p.receipt_no || '').match(new RegExp(`^RCPT-${year}-(\\d+)$`, 'i'));
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    if (maxNum === 0) {
      maxNum = (state.payments || []).length;
    }
    return `RCPT-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const [form, setForm] = useState({
    claim_id: initialClaim?.id || '',
    amount_paid_bhd: initialAmount,
    receipt_reference: computeNextReceipt(),
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    reference_doc_no: '',
    notes: 'Direct EFT Ministry/Tamkeen Settlement'
  });
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (window.api?.payments?.getNextRef) {
      window.api.payments.getNextRef().then(res => {
        if (isMounted && res?.next_receipt_no) {
          setForm(prev => ({ ...prev, receipt_reference: res.next_receipt_no }));
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, []);

  const handleAddFiles = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newAtt = {
          id: 'ATT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          file_name: file.name,
          file_size: file.size,
          file_data: ev.target.result,
          name: file.name.replace(/\.[^/.]+$/, ""),
          notes: ''
        };
        setAttachments(prev => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleUpdateAttNote = (id, notes) => {
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, notes } : a));
  };

  const handleUpdateAttName = (id, name) => {
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, name } : a));
  };

  const handleRemoveAtt = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await window.api.payments.create({
        claim_id: parseInt(form.claim_id),
        amount_paid_bhd: parseFloat(form.amount_paid_bhd),
        receipt_reference: form.receipt_reference,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        reference_doc_no: form.reference_doc_no,
        notes: form.notes,
        attachments: attachments
      });
      window.AppStore.showNotification(`Payment of ${currency} ${Number(form.amount_paid_bhd).toFixed(3)} recorded!`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error recording payment: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '720px', width: '94vw' }}>
      <div className="modal-header">
        <h2 className="modal-title">💰 Record Payment Receipt</h2>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          <div className="form-group">
            <label className="form-label">Link to Claim *</label>
            <select
              className="select-control"
              value={form.claim_id}
              onChange={e => {
                const targetId = e.target.value;
                const found = availableClaims.find(c => String(c.id) === String(targetId));
                setForm(prev => ({
                  ...prev,
                  claim_id: targetId,
                  amount_paid_bhd: (found?.balance_bhd !== undefined && found?.balance_bhd !== null) ? found.balance_bhd : (found?.claim_amount_bhd ?? prev.amount_paid_bhd)
                }));
              }}
              required
            >
              {availableClaims.map(c => (
                <option key={c.id} value={c.id}>
                  {c.claim_ref} - {c.candidate_name || `Candidate #${c.candidate_id}`} ({currency} {Number(c.balance_bhd !== undefined ? c.balance_bhd : c.claim_amount_bhd).toFixed(3)} balance)
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount Paid ({currency}) *</label>
              <input
                type="number"
                step="0.001"
                className="input-control"
                value={form.amount_paid_bhd}
                onChange={e => setForm({ ...form, amount_paid_bhd: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Receipt / Voucher Ref *</label>
              <input
                type="text"
                className="input-control"
                value={form.receipt_reference}
                onChange={e => setForm({ ...form, receipt_reference: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="select-control" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                <option value="bank_transfer">Fawri+ / Bank Transfer</option>
                <option value="check">Cheque</option>
                <option value="online_portal">Tamkeen E-Portal</option>
                <option value="benefitpay">BenefitPay</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input
                type="date"
                className="input-control"
                value={form.payment_date}
                onChange={e => setForm({ ...form, payment_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cheque / Bank Wire Ref No</label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. BBK-TRF-994102 or Cheque #44810"
                value={form.reference_doc_no}
                onChange={e => setForm({ ...form, reference_doc_no: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cashier / Settlement Notes</label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. Direct EFT Ministry Settlement"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {/* Multiple Attachments with Notes Section */}
          <div style={{
            marginTop: '1.25rem',
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <span>📎</span>
                  <span>Receipt Attachments & Vouchers</span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{attachments.length} attached</span>
                </label>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Attach bank transfer confirmations, cheque slips, or official stamped receipts. Add specific notes for each.
                </div>
              </div>
              <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
                <span>+ Add Files</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.csv,.xlsx"
                  style={{ display: 'none' }}
                  onChange={handleAddFiles}
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <label style={{
                display: 'block',
                border: '1px dashed var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '1.25rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-card)'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📂</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Click to select multiple receipt attachments (PDF, PNG, JPG, DOCX, XLSX)
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  You can attach wire slips, stamped receipts, or deposit acknowledgments with notes
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.csv,.xlsx"
                  style={{ display: 'none' }}
                  onChange={handleAddFiles}
                />
              </label>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {attachments.map((att, idx) => (
                  <div
                    key={att.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        <span style={{ fontSize: '1.2rem' }}>
                          {att.file_name.toLowerCase().endsWith('.pdf') ? '📄' : (att.file_name.match(/\.(png|jpg|jpeg)$/i) ? '🖼️' : '📎')}
                        </span>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{att.file_name}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                            ({formatFileSize(att.file_size)})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAtt(att.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--danger)',
                          fontSize: '0.9rem',
                          padding: '0.2rem 0.4rem',
                          lineHeight: 1
                        }}
                        title="Remove attachment"
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                          Document Label
                        </label>
                        <input
                          type="text"
                          className="input-control"
                          style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem' }}
                          placeholder="e.g. Bank Advice"
                          value={att.name}
                          onChange={e => handleUpdateAttName(att.id, e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                          Specific Note for this Receipt Attachment
                        </label>
                        <input
                          type="text"
                          className="input-control"
                          style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem' }}
                          placeholder="e.g. Wire transfer confirmation from Ministry batch #4"
                          value={att.notes}
                          onChange={e => handleUpdateAttNote(att.id, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 7b. Claim Payment Receipts Modal - View breakdown of all payments received for a claim
function ClaimPaymentsModal({ state, claim: initialClaim }) {
  const { claims = [], candidates = [], payments = [], settings = {} } = state;
  const currency = settings.currency || 'BHD';

  // Keep fresh claim object from store
  const claim = (claims || []).find(c => Number(c.id) === Number(initialClaim?.id)) || initialClaim;
  if (!claim) return null;

  // Find linked candidate
  const candidate = (candidates || []).find(c => Number(c.id) === Number(claim.candidate_id));

  // Find all payments linked to this claim
  const claimPayments = useMemo(() => {
    return (payments || [])
      .filter(p => Number(p.claim_id) === Number(claim.id))
      .sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
  }, [payments, claim.id]);

  const claimAmount = parseFloat(claim.claim_amount_bhd || 0);
  const totalPaid = claimPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid_bhd || 0), 0);
  const balance = Math.max(0, claimAmount - totalPaid);
  const percentPaid = claimAmount > 0 ? Math.min(100, Math.round((totalPaid / claimAmount) * 100)) : 100;
  const isSettled = claim.status === 'settled' || (balance <= 0.0001 && claimAmount > 0);
  const isDisputed = claim.status === 'disputed';
  const isTerminated = claim.status === 'terminated';

  const candidateName = claim.candidate_name || candidate?.full_name || 'N/A';
  const candidateCpr = claim.candidate_cpr || candidate?.cpr_no || 'N/A';
  const candidateRef = claim.candidate_ref || candidate?.ref_no || `Cand #${claim.candidate_id}`;
  const employerName = claim.company_name || candidate?.company_name || 'N/A';
  const employerCr = claim.employer_cr || candidate?.employer_cr || '';
  const milestoneTitle = claim.milestone_title || claim.claim_type || 'Retention Gate';

  const handlePayRemaining = () => {
    window.AppStore.closeModal();
    setTimeout(() => {
      window.AppStore.openModal('NEW_PAYMENT', { claim });
    }, 120);
  };

  return (
    <div className="modal-content" style={{ maxWidth: '1100px', width: '96vw' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(56, 189, 248, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🧾
          </div>
          <div>
            <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              Payment Receipts Breakdown
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Claim Ref: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{claim.claim_ref}</strong>
              <span style={{ margin: '0 0.5rem' }}>•</span>
              Gate: <strong>{milestoneTitle}</strong>
            </div>
          </div>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Candidate & Claim Summary Header */}
        <div style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.82rem'
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>CANDIDATE</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{candidateName}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>CPR: {candidateCpr} • {candidateRef}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>EMPLOYER</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{employerName}</div>
            {employerCr && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>CR: {employerCr}</div>}
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>CASE MANAGER / DATE</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{claim.case_manager_name || 'Unassigned'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Claimed: {window.formatAppDate(claim.claim_date || claim.created_at)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>STATUS</div>
            <span className={`badge ${isSettled ? 'badge-success' : (isDisputed ? 'badge-danger' : (isTerminated ? 'badge-neutral' : 'badge-warning'))}`} style={{ marginTop: '0.2rem', display: 'inline-block' }}>
              {isDisputed ? '⚠️ Disputed' : (isSettled ? '✓ Settled' : (isTerminated ? 'Terminated' : 'Unsettled'))}
            </span>
          </div>
        </div>

        {/* Financial KPI Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Total Claimed</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{currency} {claimAmount.toFixed(3)}</strong>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--success)', display: 'block', fontWeight: 600 }}>Total Collected</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--success)' }}>{currency} {totalPaid.toFixed(3)}</strong>
          </div>
          <div style={{ background: balance > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: balance > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.72rem', color: balance > 0 ? 'var(--danger)' : 'var(--text-muted)', display: 'block', fontWeight: balance > 0 ? 600 : 400 }}>Remaining Balance</span>
            <strong style={{ fontSize: '1.05rem', color: balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{currency} {balance.toFixed(3)}</strong>
          </div>
        </div>

        {/* Collection Progress Bar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Collection Progress</span>
            <span style={{ fontWeight: 700, color: isSettled ? 'var(--success)' : 'var(--primary)' }}>
              {percentPaid}% Settled ({claimPayments.length} {claimPayments.length === 1 ? 'receipt' : 'receipts'})
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${percentPaid}%`, background: isSettled ? 'var(--success)' : 'var(--primary)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Payments Ledger Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>💰</span>
              <span>Payment Receipts Recorded</span>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{claimPayments.length}</span>
            </h3>
            {balance > 0 && !isDisputed && !isTerminated && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                onClick={handlePayRemaining}
              >
                + Record Payment
              </button>
            )}
          </div>

          {claimPayments.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-light)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏳</div>
              <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem' }}>No Payments Received Yet</h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', marginInline: 'auto' }}>
                No disbursement receipts have been recorded for claim <strong>{claim.claim_ref}</strong>.
                The full amount of <strong>{currency} {claimAmount.toFixed(3)}</strong> is currently awaiting collection.
              </p>
              {!isDisputed && !isTerminated && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '1rem' }}
                  onClick={handlePayRemaining}
                >
                  💳 Record First Payment Receipt
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Receipt Ref</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Date</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Method</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Cheque / Wire Ref</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Cashier Notes</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Attachments & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {claimPayments.map((p, idx) => (
                    <tr
                      key={p.id || idx}
                      style={{
                        borderBottom: idx < claimPayments.length - 1 ? '1px solid var(--border-light)' : 'none',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)'
                      }}
                    >
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        {p.receipt_no || p.receipt_reference || `RCPT-#${p.id}`}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                        {window.formatAppDate(p.payment_date || p.created_at)}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                        {currency} {Number(p.amount_paid_bhd || 0).toFixed(3)}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                          {p.payment_method || 'Bank Transfer'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {p.reference_doc_no || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '160px' }}>
                        {p.cashier_notes || p.notes || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        {p.attachments && p.attachments.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px' }}>
                            {p.attachments.map((att, aIdx) => (
                              <div
                                key={att.id || aIdx}
                                style={{
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '0.76rem'
                                }}
                              >
                                <a
                                  href={att.file_url ? (att.file_url.startsWith('http') || att.file_url.startsWith('/') ? att.file_url : '/' + att.file_url) : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: 'var(--primary)',
                                    fontWeight: 700,
                                    textDecoration: 'none'
                                  }}
                                  title={`Click to view/download ${att.file_name}`}
                                >
                                  <span>📎</span>
                                  <span style={{ textDecoration: 'underline' }}>{att.name || att.file_name}</span>
                                </a>
                                {att.notes && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                                    💬 {att.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {balance > 0 && !isDisputed && !isTerminated ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePayRemaining}
            >
              💳 Pay Remaining Balance ({currency} {balance.toFixed(3)})
            </button>
          ) : (
            <span style={{ fontSize: '0.8rem', color: isSettled ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
              {isSettled ? '✓ Claim is fully settled' : (isDisputed ? '⚠️ Payments are frozen due to active dispute' : '')}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>
          Close
        </button>
      </div>
    </div>
  );
}

// 8. New Dispute Modal (Flag Claim as Disputed with Master Reasons & Remarks)
function NewDisputeModal({ state, initialProps = {} }) {
  const { claims = [], milestones = [], candidates = [], settings = {} } = state;
  const currency = settings.currency || 'BHD';

  // 1. Resolve target claim, milestone, and candidate context
  const targetClaimId = initialProps.claim_id || initialProps.claim?.id || initialProps.milestone?.claim_id;
  const initialClaim = (claims || []).find(c => Number(c.id) === Number(targetClaimId)) || initialProps.claim || null;
  const initialMilestone = initialProps.milestone 
    || (initialClaim ? (milestones || []).find(m => Number(m.id) === Number(initialClaim.milestone_id)) : null);
  const initialCandidate = initialProps.candidate 
    || (initialMilestone ? (candidates || []).find(c => Number(c.id) === Number(initialMilestone.candidate_id)) : null)
    || (initialClaim ? (candidates || []).find(c => Number(c.id) === Number(initialClaim.candidate_id)) : null);

  const eligibleClaims = (claims || []).filter(c => c.status !== 'disputed');

  // 2. Master Dispute Reasons List (with Bahrain/GCC industry defaults)
  const DEFAULT_MASTER_REASONS = [
    'CPR Resignation / Voluntary Exit',
    'Employer Termination / Non-Cure',
    'Wage Discrepancy / GOSI Variance',
    'Retention Failure (Prior to 180 Days)',
    'Contractual Breach by Employer',
    'Absconding / Absenteeism',
    'Disciplinary Dismissal',
    'Other Administrative Exception'
  ];

  const [masterReasons, setMasterReasons] = useState(DEFAULT_MASTER_REASONS);
  const [showAddMaster, setShowAddMaster] = useState(false);
  const [newMasterReason, setNewMasterReason] = useState('');
  const [savingReason, setSavingReason] = useState(false);

  // Load master reasons from API
  useEffect(() => {
    if (window.api?.disputes?.getReasons) {
      window.api.disputes.getReasons()
        .then(res => {
          if (res?.reasons && Array.isArray(res.reasons) && res.reasons.length > 0) {
            setMasterReasons(Array.from(new Set([...DEFAULT_MASTER_REASONS, ...res.reasons])));
          }
        })
        .catch(() => {});
    }
  }, []);

  const candidateName = initialCandidate?.full_name || initialMilestone?.candidate_name || initialClaim?.candidate_name || 'Candidate';
  const candidateCpr = initialCandidate?.cpr_no || initialMilestone?.candidate_cpr || initialClaim?.candidate_cpr || '';
  const employerName = initialCandidate?.company_name || initialMilestone?.company_name || initialClaim?.company_name || 'Employer';
  const employerCr = initialCandidate?.employer_cr || initialMilestone?.employer_cr || '';
  const milestoneTitle = initialMilestone?.milestone_title || initialClaim?.milestone_title || 'Retention Gate';
  const claimRef = initialClaim?.claim_ref || initialMilestone?.claim_ref || 'Pending';
  const claimAmount = initialClaim?.claim_amount_bhd || initialMilestone?.claim_amount_bhd;

  const [form, setForm] = useState({
    claim_id: initialClaim?.id || targetClaimId || eligibleClaims[0]?.id || '',
    milestone_id: initialMilestone?.id || '',
    candidate_id: initialCandidate?.id || initialMilestone?.candidate_id || initialClaim?.candidate_id || '',
    dispute_reason: DEFAULT_MASTER_REASONS[0],
    reason: '',
    remarks: initialClaim?.remarks || initialMilestone?.remarks || ''
  });
  const [saving, setSaving] = useState(false);

  // Attachments (multiple, each with notes)
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleAttachFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const att = await window.api.disputes.uploadAttachment({
          name: file.name.replace(/\.[^/.]+$/, ''),
          file_name: file.name,
          file_data: base64
        });
        setAttachments(prev => [...prev, { ...att, notes: '' }]);
      } catch (err) {
        window.AppStore.showNotification(`Upload failed for ${file.name}: ${err.message}`, 'error');
      }
    }
    setUploading(false);
  };

  // Handle saving new reason to master
  const handleSaveMasterReason = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newMasterReason.trim();
    if (!trimmed) {
      window.AppStore.showNotification('Please enter a valid reason title', 'error');
      return;
    }

    setSavingReason(true);
    try {
      const res = await window.api.disputes.addReason(trimmed);
      const updatedList = res?.reasons || Array.from(new Set([...masterReasons, trimmed]));
      setMasterReasons(updatedList);
      setForm(prev => ({ ...prev, dispute_reason: trimmed }));
      setNewMasterReason('');
      setShowAddMaster(false);
      window.AppStore.showNotification(`"${trimmed}" added to Master Dispute Reasons!`, 'success');
    } catch (err) {
      window.AppStore.showNotification('Error adding to master: ' + err.message, 'error');
    } finally {
      setSavingReason(false);
    }
  };

  const handleReasonChange = (val) => {
    if (val === '__ADD_NEW__') {
      setShowAddMaster(true);
    } else {
      setForm({ ...form, dispute_reason: val });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const resolvedClaimId = form.claim_id || initialClaim?.id || targetClaimId;
    const resolvedMilestoneId = form.milestone_id || initialMilestone?.id;

    if (!resolvedClaimId && !resolvedMilestoneId) {
      window.AppStore.showNotification('Target claim or milestone is required to log dispute', 'error');
      return;
    }

    if (!form.dispute_reason) {
      window.AppStore.showNotification('Please select a dispute reason', 'error');
      return;
    }

    setSaving(true);
    try {
      const selectedCategory = form.dispute_reason;
      const detailedGrounds = form.reason.trim();
      const claimRemarks = form.remarks.trim();
      await window.api.disputes.create({
        claim_id: resolvedClaimId ? parseInt(resolvedClaimId) : null,
        milestone_id: resolvedMilestoneId ? parseInt(resolvedMilestoneId) : null,
        candidate_id: form.candidate_id ? parseInt(form.candidate_id) : null,
        dispute_category: selectedCategory,
        category: selectedCategory,
        dispute_reason: detailedGrounds,
        reason: detailedGrounds,
        remarks: claimRemarks,
        attachments
      });

      window.AppStore.showNotification(
        `Dispute registered for ${candidateName}! Claim and retention gate marked as disputed.`,
        'warning'
      );
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error filing dispute: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '580px' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 700
          }}>
            ⚠️
          </div>
          <div>
            <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>Mark Claim as Disputed</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Freeze subsidy disbursement and flag retention milestone for dispute review
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          
          {/* Target Milestone / Claim Context Card */}
          {(initialClaim || initialMilestone) ? (
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem 1rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              fontSize: '0.85rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Candidate</span>
                <strong style={{ color: 'var(--text-primary)' }}>{candidateName}</strong>
                {candidateCpr && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    CPR: {candidateCpr}
                  </div>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Employer</span>
                <strong style={{ color: 'var(--text-primary)' }}>{employerName}</strong>
                {employerCr && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--primary)' }}>
                    {employerCr}
                  </div>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Milestone Gate</span>
                <strong style={{ color: 'var(--text-primary)' }}>{milestoneTitle}</strong>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Ref: {claimRef}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Claim Amount</span>
                <strong style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                  {claimAmount !== undefined && claimAmount !== null ? `${currency} ${Number(claimAmount).toFixed(3)}` : '—'}
                </strong>
                <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 600 }}>
                  Payment will be frozen
                </div>
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Target Claim *</label>
              <select
                className="select-control"
                value={form.claim_id}
                onChange={e => setForm({ ...form, claim_id: e.target.value })}
                required
              >
                {eligibleClaims.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.claim_ref} - {c.candidate_name || `Candidate #${c.candidate_id}`} ({currency} {Number(c.claim_amount_bhd).toFixed(3)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dispute Reason Dropdown with Master Adder */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                Dispute Reason / Category *
              </label>
              <button
                type="button"
                onClick={() => setShowAddMaster(!showAddMaster)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <span>{showAddMaster ? '✕ Cancel' : '➕ Add to Master'}</span>
              </button>
            </div>

            <select
              className="select-control"
              value={form.dispute_reason}
              onChange={e => handleReasonChange(e.target.value)}
              required
            >
              {masterReasons.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
              <option value="__ADD_NEW__">➕ Add New Reason to Master...</option>
            </select>

            {/* Inline Add to Master Box */}
            {showAddMaster && (
              <div style={{
                marginTop: '0.55rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Add New Reason to Master List (Saved to System Settings):
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="input-control"
                    value={newMasterReason}
                    onChange={e => setNewMasterReason(e.target.value)}
                    style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveMasterReason(); } }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveMasterReason}
                    disabled={savingReason || !newMasterReason.trim()}
                    style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
                  >
                    {savingReason ? 'Saving...' : '💾 Save to Master'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Remarks for the Claim */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                Claim Remarks <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                Saved directly to Claim record
              </span>
            </div>
            <textarea
              className="input-control"
              rows="2"
              value={form.remarks}
              onChange={e => setForm({ ...form, remarks: e.target.value })}
              style={{ fontSize: '0.84rem' }}
            ></textarea>
          </div>

          {/* Detailed Grounds for Dispute */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Detailed Grounds for Dispute <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <textarea
              className="input-control"
              rows="3"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              style={{ fontSize: '0.84rem' }}
            ></textarea>
          </div>

          {/* Attachments with notes */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', gap: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                📎 Attachments <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional, multiple files)</span>
              </label>
              <label className="btn btn-sm btn-outline" style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
                {uploading ? 'Uploading...' : '➕ Add Files'}
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={handleAttachFiles}
                />
              </label>
            </div>
            {attachments.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No files attached. Add supporting documents and a note for each.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {attachments.map(att => (
                  <div key={att.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.7rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.file_name}>
                        📄 {att.file_name || att.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                        title="Remove attachment"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.9rem', lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input-control"
                      style={{ fontSize: '0.8rem', width: '100%' }}
                      placeholder="Notes for this attachment..."
                      value={att.notes || ''}
                      onChange={e => setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, notes: e.target.value } : a))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>🔒</span>
            <span>Flagging this claim will freeze payment release and record an audit entry. Reinstatement requires administrative verification.</span>
          </div>

        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.AppStore.closeModal()}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-danger"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            disabled={saving}
          >
            {saving ? (
              <span>Filing Dispute...</span>
            ) : (
              <>
                <span>⚠️</span>
                <span>Confirm & Mark as Disputed</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// 9. Dispute Details Modal (Investigation details, grounds, category, remarks, and resolution actions)
function DisputeDetailsModal({ state, initialProps = {} }) {
  const { disputes = [], claims = [], milestones = [], candidates = [], currentUser, settings = {} } = state;
  const currency = settings.currency || 'BHD';
  const isAdminOrSuper = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  // 1. Locate Target Dispute Record (prefer the live record from state so edits/attachments are current;
  //    when opened from Claims/Milestones, match by claim/milestone first and pick the most recent dispute)
  const pickLatest = (list) => list.length ? list.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a)) : null;
  const claimIdHint = initialProps.claim_id || initialProps.claim?.id || initialProps.milestone?.claim_id;
  const milestoneIdHint = initialProps.milestone?.id || initialProps.milestone_id;
  const candidateIdHint = initialProps.candidate_id || initialProps.candidate?.id;
  const requestedDisputeId = initialProps.dispute_id || initialProps.dispute?.id;

  const dispute =
    (requestedDisputeId ? disputes.find(d => Number(d.id) === Number(requestedDisputeId)) : null)
    || (claimIdHint ? pickLatest(disputes.filter(d => Number(d.claim_id) === Number(claimIdHint))) : null)
    || (milestoneIdHint ? pickLatest(disputes.filter(d => d.milestone_id && Number(d.milestone_id) === Number(milestoneIdHint))) : null)
    || initialProps.dispute
    || (candidateIdHint ? pickLatest(disputes.filter(d => d.candidate_id && Number(d.candidate_id) === Number(candidateIdHint))) : null)
    || null;

  // 2. Locate Linked Claim, Milestone, and Candidate
  const claim = initialProps.claim
    || (dispute?.claim_id ? claims.find(c => Number(c.id) === Number(dispute.claim_id)) : null)
    || (initialProps.milestone?.claim_id ? claims.find(c => Number(c.id) === Number(initialProps.milestone.claim_id)) : null)
    || (initialProps.claim_id ? claims.find(c => Number(c.id) === Number(initialProps.claim_id)) : null);

  const milestone = initialProps.milestone
    || (claim?.milestone_id ? milestones.find(m => Number(m.id) === Number(claim.milestone_id)) : null)
    || (dispute?.milestone_id ? milestones.find(m => Number(m.id) === Number(dispute.milestone_id)) : null)
    || (initialProps.milestone_id ? milestones.find(m => Number(m.id) === Number(initialProps.milestone_id)) : null);

  const candidate = initialProps.candidate
    || (claim?.candidate_id ? candidates.find(c => Number(c.id) === Number(claim.candidate_id)) : null)
    || (milestone?.candidate_id ? candidates.find(c => Number(c.id) === Number(milestone.candidate_id)) : null)
    || (dispute?.candidate_id ? candidates.find(c => Number(c.id) === Number(dispute.candidate_id)) : null);

  // 3. Resolve Display Attributes
  const disputeRef = dispute?.id ? `DSP-${String(dispute.id).padStart(4, '0')}` : 'DSP-ACTIVE';
  const disputeCategory = dispute?.dispute_category || dispute?.category || '';
  const disputeReason = dispute?.dispute_reason !== undefined && dispute?.dispute_reason !== null
    ? dispute.dispute_reason
    : (dispute?.reason || '');
  const claimRemarks = dispute?.remarks !== undefined && dispute?.remarks !== null
    ? dispute.remarks
    : (claim?.remarks || dispute?.claim_remarks || milestone?.remarks || '');
  const disputeDate = dispute?.dispute_date || dispute?.filed_date || dispute?.created_at?.split(' ')[0] || '';
  const caseManager = dispute?.case_manager_name || claim?.case_manager_name || candidate?.case_manager_name || 'System';
  const disputeStatus = dispute?.status || 'active_dispute';
  const isActive = disputeStatus === 'active_dispute';

  const candidateName = dispute?.candidate_name || candidate?.full_name || milestone?.candidate_name || claim?.candidate_name || 'Candidate';
  const candidateCpr = dispute?.candidate_cpr || candidate?.cpr_no || milestone?.candidate_cpr || claim?.candidate_cpr || '';
  const employerName = dispute?.company_name || candidate?.company_name || milestone?.company_name || claim?.company_name || 'Employer';
  const employerCr = dispute?.employer_cr || candidate?.employer_cr || milestone?.employer_cr || '';
  const milestoneTitle = dispute?.milestone_title || milestone?.milestone_title || claim?.milestone_title || 'Retention Milestone';
  const claimRef = dispute?.claim_ref || claim?.claim_ref || milestone?.claim_ref || 'Pending';
  const claimAmount = dispute?.claim_amount_bhd || claim?.claim_amount_bhd || milestone?.claim_amount_bhd;

  // 4. Edit mode & attachments state - strictly enabled ONLY for Active disputes from Dispute Management page
  const canEdit = isActive && !!dispute?.id && (initialProps?.from === 'disputes' || initialProps?.source === 'disputes' || initialProps?.canEdit === true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState(Array.isArray(dispute?.attachments) ? dispute.attachments : []);
  const [editForm, setEditForm] = useState({
    reason: disputeReason,
    remarks: claimRemarks
  });

  useEffect(() => {
    setEditForm({
      reason: disputeReason,
      remarks: claimRemarks
    });
    setAttachments(Array.isArray(dispute?.attachments) ? dispute.attachments : []);
  }, [dispute?.id, dispute?.dispute_reason, dispute?.remarks, dispute?.attachments]);

  const formatFileSize = (bytes) => {
    const n = Number(bytes || 0);
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  };

  const handleAttachFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const att = await window.api.disputes.uploadAttachment({
          name: file.name.replace(/\.[^/.]+$/, ''),
          file_name: file.name,
          file_data: base64
        });
        setAttachments(prev => [...prev, att]);
      } catch (err) {
        window.AppStore.showNotification(`Upload failed for ${file.name}: ${err.message}`, 'error');
      }
    }
    setUploading(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setAttachments(Array.isArray(dispute?.attachments) ? dispute.attachments : []);
    setEditForm({
      reason: disputeReason,
      remarks: claimRemarks
    });
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await window.api.disputes.update(dispute.id, {
        dispute_reason: editForm.reason.trim(),
        reason: editForm.reason.trim(),
        remarks: editForm.remarks.trim(),
        attachments
      });
      window.AppStore.showNotification('Dispute details updated successfully', 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Failed to update dispute: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '760px', width: '94vw' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: isActive
              ? 'rgba(239, 68, 68, 0.12)'
              : (disputeStatus === 'reinstated' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
            color: isActive
              ? 'var(--danger)'
              : (disputeStatus === 'reinstated' ? 'var(--success)' : 'var(--danger)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            fontWeight: 700
          }}>
            {isActive ? '⚠️' : (disputeStatus === 'reinstated' ? '✓' : '⛔')}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.2rem' }}>Dispute Details</h2>
              <span className={`badge ${isActive ? 'badge-danger' : (disputeStatus === 'reinstated' ? 'badge-success' : 'badge-danger')}`} style={{ fontSize: '0.72rem' }}>
                {isActive ? 'Active Dispute' : String(disputeStatus).replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Ref: <strong style={{ fontFamily: 'var(--font-mono)' }}>{disputeRef}</strong>
              {disputeDate && <span> &bull; Filed: {window.formatAppDate ? window.formatAppDate(disputeDate) : disputeDate}</span>}
              {dispute?.reinstated_date && dispute.reinstated_date !== '0000-00-00' && (
                <span style={{ color: 'var(--success)' }}> &bull; Reinstated: {window.formatAppDate ? window.formatAppDate(dispute.reinstated_date) : dispute.reinstated_date}</span>
              )}
              {dispute?.terminated_date && dispute.terminated_date !== '0000-00-00' && (
                <span style={{ color: 'var(--danger)' }}> &bull; Terminated: {window.formatAppDate ? window.formatAppDate(dispute.terminated_date) : dispute.terminated_date}</span>
              )}
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '76vh', overflowY: 'auto' }}>
        
        {/* Candidate, Employer, and Claim Overview Card */}
        <div style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem 1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.85rem',
          fontSize: '0.85rem'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', display: 'block' }}>Candidate</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{candidateName}</strong>
            {candidateCpr && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                CPR: {candidateCpr}
              </div>
            )}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', display: 'block' }}>Employer</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{employerName}</strong>
            {employerCr && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary)' }}>
                CR: {employerCr}
              </div>
            )}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', display: 'block' }}>Milestone Gate</span>
            <strong style={{ color: 'var(--text-primary)' }}>{milestoneTitle}</strong>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Claim Ref: {claimRef}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', display: 'block' }}>Submitted Amount</span>
            <strong style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
              {claimAmount !== undefined && claimAmount !== null ? `${currency} ${Number(claimAmount).toFixed(3)}` : '—'}
            </strong>
            <div style={{
              fontSize: '0.72rem',
              color: isActive ? 'var(--danger)' : (disputeStatus === 'reinstated' ? 'var(--success)' : 'var(--danger)'),
              fontWeight: 600
            }}>
              {isActive
                ? '● Payment Frozen'
                : (disputeStatus === 'reinstated' ? '● Payment Released / Active' : '● Permanently Terminated')}
            </div>
          </div>
        </div>

        {/* Reinstatement or Termination Status & Notes Card */}
        {!isActive && (
          <div style={{
            background: disputeStatus === 'reinstated' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${disputeStatus === 'reinstated' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.9rem 1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>
                  {disputeStatus === 'reinstated' ? '✓' : '⛔'}
                </span>
                <strong style={{
                  fontSize: '0.96rem',
                  color: disputeStatus === 'reinstated' ? 'var(--success)' : 'var(--danger)',
                  textTransform: 'capitalize'
                }}>
                  {disputeStatus === 'reinstated' ? 'Placement Reinstated' : 'Placement Terminated'}
                </strong>
                <span className={`badge ${disputeStatus === 'reinstated' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.72rem' }}>
                  {disputeStatus === 'reinstated' ? 'Active / Undisputed' : 'Audit Preserved'}
                </span>
              </div>
              {(dispute?.reinstated_date || dispute?.terminated_date) && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: disputeStatus === 'reinstated' ? 'var(--success)' : 'var(--danger)',
                  background: 'var(--bg-primary)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)'
                }}>
                  {disputeStatus === 'reinstated' ? 'Reinstated Date: ' : 'Terminated Date: '}
                  {window.formatAppDate ? window.formatAppDate(dispute.reinstated_date || dispute.terminated_date) : (dispute.reinstated_date || dispute.terminated_date)}
                </div>
              )}
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                {disputeStatus === 'reinstated' ? 'Reinstatement Remarks / Notes:' : 'Termination Reason / Notes:'}
              </span>
              <div style={{
                fontSize: '0.86rem',
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap'
              }}>
                {dispute?.resolution_notes || 'No resolution notes recorded.'}
              </div>
            </div>
          </div>
        )}

        {/* Dispute Category & Reason Box */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', display: 'block', marginBottom: '0.2rem' }}>
              Dispute Category / Master Reason
            </span>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.86rem'
            }}>
              <span>⚠️</span>
              <span>{disputeCategory}</span>
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', display: 'block', marginBottom: '0.2rem' }}>
              Detailed Grounds / Investigation Context
            </span>
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.85rem',
              fontSize: '0.85rem',
              lineHeight: 1.45,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap'
            }}>
              {editing ? (
                <textarea
                  className="input-control"
                  rows="3"
                  style={{ fontSize: '0.84rem', width: '100%' }}
                  placeholder="Enter detailed grounds or investigation notes (optional)..."
                  value={editForm.reason}
                  onChange={e => setEditForm({ ...editForm, reason: e.target.value })}
                />
              ) : (
                disputeReason ? (
                  disputeReason
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No detailed grounds specified.
                  </span>
                )
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
            <span>Case Manager: <strong style={{ color: 'var(--text-secondary)' }}>{caseManager}</strong></span>
            {dispute?.created_at && (
              <span>Logged At: <span style={{ fontFamily: 'var(--font-mono)' }}>{dispute.created_at}</span></span>
            )}
          </div>
        </div>

        {/* Claim Remarks Section */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem 1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', fontWeight: 700 }}>
              Remarks on Claim Record
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
              Ref: {claimRef}
            </span>
          </div>
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.85rem',
            fontSize: '0.85rem',
            lineHeight: 1.45,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap'
          }}>
            {editing ? (
              <textarea
                className="input-control"
                rows="2"
                style={{ fontSize: '0.84rem', width: '100%' }}
                placeholder="Enter remarks for the claim record (optional)..."
                value={editForm.remarks}
                onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
              />
            ) : (
              claimRemarks ? (
                claimRemarks
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No remarks recorded for this claim.
                </span>
              )
            )}
          </div>
        </div>

        {/* Attachments */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem', fontWeight: 700 }}>
              📎 Attachments ({attachments.length})
            </span>
            {editing && (
              <label className="btn btn-sm btn-outline" style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
                {uploading ? 'Uploading...' : '➕ Add Files'}
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={handleAttachFiles}
                />
              </label>
            )}
          </div>
          {attachments.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No attachments{editing ? ' yet. Click "Add Files" to upload one or more documents.' : '.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {attachments.map(att => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.45rem 0.7rem',
                    fontSize: '0.82rem'
                  }}
                >
                  <a
                    href={window.disputeFileUrl(att.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                    title={att.file_name}
                  >
                    📄 {att.file_name || att.name}
                  </a>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                    {formatFileSize(att.file_size)}
                  </span>
                  {editing ? (
                    <input
                      type="text"
                      className="input-control"
                      style={{ fontSize: '0.78rem', flex: 1, minWidth: '140px' }}
                      placeholder="Notes..."
                      value={att.notes || ''}
                      onChange={e => setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, notes: e.target.value } : a))}
                    />
                  ) : (att.notes ? (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontStyle: 'italic', flex: 1 }}>
                      💬 {att.notes}
                    </span>
                  ) : null)}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                      title="Remove attachment"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.9rem', lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
        {editing ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving || uploading}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={saving || uploading}>
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </>
        ) : (
          <>
            {canEdit && (
              <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.AppStore.closeModal()}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// 10. SaNDS Lab Company Profile & WhatsApp Support Modal
function SandsCompanyProfileModal({ state }) {
  return (
    <div className="modal-content" style={{ maxWidth: '780px', width: '92vw' }}>
      <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <img
            src={state.theme === 'dark' ? 'logo/sands_logo_white.png' : 'logo/sands_logo_2.png'}
            alt="SaNDS Lab"
            style={{ height: '34px', width: 'auto', maxWidth: '150px', objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h3 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>SaNDS Lab Middle East W.L.L.</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Company Profile & 24/7 Technical Support
            </span>
          </div>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>&times;</button>
      </div>

      <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '74vh', overflowY: 'auto' }}>
        
        {/* Support Callout Banner (WhatsApp Support: 35078079 & 36533695, No Email) */}
        <div style={{
          background: state.theme === 'dark' ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
          border: '1px solid #10b981',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.3rem' }}>💬</span>
              <strong style={{ fontSize: '1rem', color: '#065f46' }}>
                Need Help or Support? We Are Active on WhatsApp
              </strong>
            </div>
            <div style={{ fontSize: '0.84rem', color: state.theme === 'dark' ? '#a7f3d0' : '#047857', marginTop: '0.25rem' }}>
              Direct Technical Support Lines (Bahrain): <strong>+973 35078079</strong> &bull; <strong>+973 36533695</strong> | Tel: +973 77931123
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/97335078079?text=Hello%20SaNDS%20Lab%20Support%2C%20I%20am%20inquiring%20about%20the%20Candidate%20Placement%20and%20Claims%20Portal"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#25D366',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '0.55rem 1.15rem',
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.35)',
                transition: 'transform 0.15s ease'
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.65 7.89 8.02 8.48 8.02 9.71C8.02 10.94 8.91 12.12 9.04 12.29C9.17 12.46 10.79 14.96 13.26 16.03C13.85 16.29 14.31 16.44 14.67 16.55C15.26 16.74 15.79 16.71 16.22 16.65C16.7 16.58 17.69 16.05 17.9 15.46C18.11 14.88 18.11 14.38 18.05 14.28C17.98 14.18 17.82 14.11 17.57 13.99C17.33 13.86 16.12 13.27 15.9 13.19C15.67 13.1 15.51 13.06 15.35 13.3C15.19 13.55 14.73 14.08 14.59 14.24C14.45 14.41 14.31 14.43 14.06 14.31C13.82 14.18 13.04 13.93 12.11 13.1C11.39 12.46 10.9 11.66 10.76 11.42C10.62 11.17 10.75 11.04 10.87 10.92C10.98 10.81 11.12 10.63 11.24 10.48C11.37 10.34 11.41 10.23 11.49 10.07C11.57 9.9 11.53 9.76 11.47 9.64C11.41 9.51 10.92 8.31 10.71 7.82C10.52 7.34 10.31 7.4 10.16 7.39C10.02 7.39 9.85 7.34 9.69 7.34H9.53Z" />
              </svg>
              <span>WhatsApp: 35078079</span>
            </a>

            <a
              href="https://wa.me/97336533695?text=Hello%20SaNDS%20Lab%20Support%2C%20I%20am%20inquiring%20about%20the%20Candidate%20Placement%20and%20Claims%20Portal"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#25D366',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '0.55rem 1.15rem',
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.35)',
                transition: 'transform 0.15s ease'
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.65 7.89 8.02 8.48 8.02 9.71C8.02 10.94 8.91 12.12 9.04 12.29C9.17 12.46 10.79 14.96 13.26 16.03C13.85 16.29 14.31 16.44 14.67 16.55C15.26 16.74 15.79 16.71 16.22 16.65C16.7 16.58 17.69 16.05 17.9 15.46C18.11 14.88 18.11 14.38 18.05 14.28C17.98 14.18 17.82 14.11 17.57 13.99C17.33 13.86 16.12 13.27 15.9 13.19C15.67 13.1 15.51 13.06 15.35 13.3C15.19 13.55 14.73 14.08 14.59 14.24C14.45 14.41 14.31 14.43 14.06 14.31C13.82 14.18 13.04 13.93 12.11 13.1C11.39 12.46 10.9 11.66 10.76 11.42C10.62 11.17 10.75 11.04 10.87 10.92C10.98 10.81 11.12 10.63 11.24 10.48C11.37 10.34 11.41 10.23 11.49 10.07C11.57 9.9 11.53 9.76 11.47 9.64C11.41 9.51 10.92 8.31 10.71 7.82C10.52 7.34 10.31 7.4 10.16 7.39C10.02 7.39 9.85 7.34 9.69 7.34H9.53Z" />
              </svg>
              <span>WhatsApp: 36533695</span>
            </a>
          </div>
        </div>

        {/* Company Overview Narrative */}
        <div style={{ marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          <p style={{ margin: '0 0 0.75rem 0' }}>
            Founded in <strong>2008</strong>, <strong>SaNDS Lab</strong> is a premier technology & software engineering consultancy with over <strong>17 years of excellence</strong> delivering mission-critical enterprise applications, Artificial Intelligence platforms, hardware security systems, and smart workflow automation across the Middle East and Asia.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ padding: '0.3rem 0.7rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem' }}>
              🏢 Bahrain Commercial Registration: <strong>CR: 181123-1</strong>
            </span>
            <span style={{ padding: '0.3rem 0.7rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem' }}>
              📍 Tech Hub: Infopark Thrissur, Kerala
            </span>
            <span style={{ padding: '0.3rem 0.7rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem' }}>
              🛡️ ISO & Bahrain PDPL Data Privacy Compliant
            </span>
          </div>
        </div>

        {/* Recent Products Link Only (No listing of products) */}
        <div style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🚀</span>
              <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                Our Recent Enterprise Products & Innovations
              </strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Explore our full suite of enterprise software platforms at{' '}
              <a
                href="https://sandslab.com/products/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}
              >
                https://sandslab.com/products/
              </a>
            </div>
          </div>
          <a
            href="https://sandslab.com/products/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              fontSize: '0.84rem',
              padding: '0.55rem 1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none'
            }}
          >
            <span>Visit Products Page</span>
            <span>&rarr;</span>
          </a>
        </div>
      </div>

      <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <a
            href="https://wa.me/97335078079?text=Hello%20SaNDS%20Lab%20Support"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            💬 WhatsApp: 35078079
          </a>
          <span style={{ opacity: 0.35 }}>|</span>
          <a
            href="https://wa.me/97336533695?text=Hello%20SaNDS%20Lab%20Support"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            💬 WhatsApp: 36533695
          </a>
          <span style={{ opacity: 0.35 }}>|</span>
          <a
            href="https://sandslab.com/products/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
          >
            🚀 sandslab.com/products/
          </a>
          <span style={{ opacity: 0.35 }}>|</span>
          <a
            href="https://www.sandslab.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.82rem', color: '#7cb342', fontWeight: 700, textDecoration: 'none' }}
          >
            🌐 www.sandslab.com
          </a>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => window.AppStore.closeModal()}>
          Close Profile
        </button>
      </div>
    </div>
  );
}

// 10. Edit User & RBAC Permissions Modal (Superadmin & Admin Governance)
function EditUserModal({ state, user }) {
  if (!user) return null;

  const { currentUser } = state;
  const isSuperadmin = currentUser.role === 'superadmin';
  const isSelf = currentUser.id === user.id;

  const [formData, setFormData] = useState({
    username: user.username || '',
    full_name: user.full_name || '',
    role: user.role || 'case_manager',
    case_manager_code: user.case_manager_code || (user.role === 'case_manager' ? user.full_name : ''),
    email: user.email || '',
    phone: user.phone ? user.phone.replace(/^\+973\s*/, '') : '',
    is_active: user.is_active !== undefined ? parseInt(user.is_active) : 1,
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.full_name.trim()) {
      window.AppStore.showNotification('Username and Full Name are mandatory', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: formData.username.trim(),
        full_name: formData.full_name.trim(),
        role: formData.role,
        case_manager_code: formData.role === 'case_manager' 
          ? (formData.case_manager_code.trim() || formData.full_name.trim())
          : null,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        is_active: formData.is_active
      };

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const updated = await window.api.users.update(user.id, payload);

      // If current user updated their own profile, keep session state in sync
      if (isSelf) {
        window.AppStore.setState({
          currentUser: {
            ...currentUser,
            full_name: updated.full_name,
            username: updated.username,
            role: updated.role,
            email: updated.email,
            phone: updated.phone
          }
        });
      }

      window.AppStore.showNotification(`User '${updated.full_name}' (@${updated.username}) updated successfully!`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error updating user: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '620px' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--primary-subtle, rgba(37, 99, 235, 0.1))',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 700
          }}>
            ✏️
          </div>
          <div>
            <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>Edit User Account</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Update permissions, identity, and access for <strong>@{user.username}</strong>
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Identity Pill Banner */}
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}>
                User ID #{user.id}
              </span>
              <span className={`badge ${
                user.role === 'superadmin' ? 'badge-danger' :
                (user.role === 'admin' ? 'badge-warning' : 'badge-info')
              }`}>
                {user.role ? user.role.replace('_', ' ') : 'user'}
              </span>
              {isSelf && (
                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Current User</span>
              )}
            </div>
            <div>
              <span className={`badge ${(user.is_active ?? 1) ? 'badge-success' : 'badge-danger'}`}>
                {(user.is_active ?? 1) ? '● Active' : '○ Deactivated'}
              </span>
            </div>
          </div>

          {/* Form Fields: Grid Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="input-control"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Username (System Login) *</label>
              <input
                type="text"
                className="input-control"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Role Category *</label>
              <select
                className="select-control"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                disabled={isSelf && user.role === 'superadmin'}
              >
                <option value="case_manager">Case Manager (Scoped)</option>
                <option value="admin">Admin (Global operations)</option>
                {isSuperadmin && (
                  <option value="superadmin">Superadmin (Master control)</option>
                )}
              </select>
              {isSelf && user.role === 'superadmin' && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Superadmin role cannot be removed from active session
                </div>
              )}
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Account Status *</label>
              <select
                className="select-control"
                value={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
                disabled={isSelf}
              >
                <option value={1}>Active (Permitted to log in)</option>
                <option value={0}>Deactivated (Hold login access)</option>
              </select>
              {isSelf && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  You cannot deactivate your own account
                </div>
              )}
            </div>
          </div>

          {formData.role === 'case_manager' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Case Manager Code / Short Name</label>
              <input
                type="text"
                className="input-control"
                value={formData.case_manager_code}
                placeholder="e.g. Husain, Meaad, Dina"
                onChange={e => setFormData({ ...formData, case_manager_code: e.target.value })}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Used to link candidate placements and milestones to this case manager.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="input-control"
                value={formData.email}
                placeholder="name@placement.gov.bh"
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Phone (Bahrain)</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-light)',
                  borderRight: 'none',
                  borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600
                }}>
                  +973
                </span>
                <input
                  type="text"
                  className="input-control"
                  style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                  value={formData.phone}
                  placeholder="39123456"
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Password Reset Section */}
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                🔑 Reset Password <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showPassword ? 'Hide Password' : 'Show Password'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-control"
              placeholder="Leave blank to keep existing password..."
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              autoComplete="new-password"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>
              Only fill this in if you wish to reset or change the user's portal password.
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.AppStore.closeModal()}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            disabled={saving}
          >
            {saving ? (
              <>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// 11. Edit Claim Amount Modal (Adjust manual claim amount for claimed milestone)
function EditClaimAmountModal({ state, milestone, claim }) {
  if (!milestone && !claim) return null;

  const { settings, claims = [] } = state;
  const currency = settings.currency || 'BHD';

  // 1. Resolve active claim reliably
  const activeClaim = useMemo(() => {
    if (claim) return claim;
    if (milestone?.claim_id) {
      const found = (claims || []).find(c => Number(c.id) === Number(milestone.claim_id));
      if (found) return found;
    }
    if (milestone?.id) {
      const msClaims = (claims || []).filter(c => Number(c.milestone_id) === Number(milestone.id));
      if (msClaims.length > 0) return msClaims[msClaims.length - 1];
    }
    if (milestone?.candidate_id) {
      const targetType = milestone.milestone_type;
      const matched = (claims || []).filter(c => {
        if (Number(c.candidate_id) !== Number(milestone.candidate_id)) return false;
        let cType = c.claim_type;
        if (cType === 'initial_placement') cType = 'placement';
        if (cType === 'probation_completion' || cType === 'retention_6m') cType = '180_days';
        if (cType === 'year_completion' || cType === 'retention_12m') cType = '365_days';
        return cType === targetType;
      });
      if (matched.length > 0) return matched[matched.length - 1];
    }
    return null;
  }, [claim, milestone?.id, milestone?.claim_id, milestone?.candidate_id, milestone?.milestone_type, claims]);

  // 2. Pre-populate initial amount: prioritizing the current displayed milestone claim amount
  const getInitialAmount = () => {
    if (milestone?.claim_amount_bhd !== undefined && milestone?.claim_amount_bhd !== null && !isNaN(milestone.claim_amount_bhd)) {
      return parseFloat(milestone.claim_amount_bhd).toFixed(3);
    }
    if (activeClaim?.claim_amount_bhd !== undefined && activeClaim?.claim_amount_bhd !== null && !isNaN(activeClaim.claim_amount_bhd)) {
      return parseFloat(activeClaim.claim_amount_bhd).toFixed(3);
    }
    const fallbackVal = state.settings?.standard_tier_amount_bhd ? Number(state.settings.standard_tier_amount_bhd).toFixed(3) : '500.000';
    return fallbackVal;
  };

  const [amount, setAmount] = useState(getInitialAmount());
  const [remarks, setRemarks] = useState(activeClaim?.remarks || 'Adjusted agreed claim amount');
  const [saving, setSaving] = useState(false);

  // 3. Keep modal amount and remarks strictly in sync whenever modal props or claims update
  useEffect(() => {
    setAmount(getInitialAmount());
    if (activeClaim?.remarks) {
      setRemarks(activeClaim.remarks);
    }
  }, [milestone?.id, milestone?.claim_amount_bhd, milestone?.claim_id, activeClaim?.id, activeClaim?.claim_amount_bhd]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      window.AppStore.showNotification('Please enter a valid non-negative claim amount', 'error');
      return;
    }

    setSaving(true);
    try {
      const targetClaimId = activeClaim?.id || milestone?.claim_id;
      const claimPayload = {
        claim_amount_bhd: parsedAmount,
        remarks: remarks.trim(),
        candidate_id: milestone?.candidate_id || activeClaim?.candidate_id,
        milestone_id: milestone?.id || activeClaim?.milestone_id || null,
        claim_type: milestone?.milestone_type || activeClaim?.claim_type || 'placement'
      };

      if (targetClaimId) {
        await window.api.claims.update(targetClaimId, claimPayload);
      } else {
        await window.api.claims.create(claimPayload);
      }

      window.AppStore.showNotification(`Claim amount updated to ${currency} ${parsedAmount.toFixed(3)} successfully!`, 'success');
      window.AppStore.closeModal();
      await window.AppStore.refreshData();
    } catch (err) {
      window.AppStore.showNotification('Error updating claim amount: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const candidateName = milestone?.candidate_name || activeClaim?.candidate_name || 'Candidate';
  const candidateRef = milestone?.candidate_ref || activeClaim?.candidate_ref || '';
  const milestoneTitle = milestone?.milestone_title || activeClaim?.milestone_title || 'Retention Gate';
  const claimRef = activeClaim?.claim_ref || milestone?.claim_ref || 'Pending';

  return (
    <div className="modal-content" style={{ maxWidth: '540px' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--primary-subtle, rgba(37, 99, 235, 0.1))',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 700
          }}>
            💰
          </div>
          <div>
            <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>Adjust Claim Amount</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Modify the claimed BHD amount for <strong>{candidateName}</strong>
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Milestone Details Card */}
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            fontSize: '0.85rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Candidate</span>
              <strong style={{ color: 'var(--text-primary)' }}>{candidateName}</strong>
              {candidateRef && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary)' }}>
                  {candidateRef}
                </div>
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Milestone Gate</span>
              <strong style={{ color: 'var(--text-primary)' }}>{milestoneTitle}</strong>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Ref: {claimRef}
              </div>
            </div>
          </div>

          {/* Claim Amount Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Revised Claim Amount ({currency}) *</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{
                padding: '0.55rem 0.85rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRight: 'none',
                borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}>
                {currency}
              </span>
              <input
                type="number"
                step="0.001"
                min="0"
                className="input-control"
                style={{
                  borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)'
                }}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Standard Bahrain 3-decimal currency precision. Enter the updated manual subsidy claim amount.
            </div>
          </div>

          {/* Adjustment Reason */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Adjustment Reason / Notes</label>
            <input
              type="text"
              className="input-control"
              value={remarks}
              placeholder="e.g. Contract subsidy adjustment, Ministry re-attestation"
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.AppStore.closeModal()}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            disabled={saving}
          >
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>Update Claim Amount</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// =========================================================================
// RENEW CANDIDATE REGISTRATION MODAL
// Preserves Candidate Reference Number (ref_no), calculates days past 12m,
// permits updating contact, education, case manager & attaching renewal documents.
// =========================================================================
function RenewCandidateModal({ state, candidate: initialCandidate, fromPlaced: initialFromPlaced }) {
  const documentCategories = state?.documentCategories || [];
  const activeDocCategories = useMemo(() => {
    const list = (documentCategories || []).filter(c => c.is_active !== 0 && c.is_active !== false);
    if (list.length > 0) return list;
    return [
      { id: 1, code: 'CPR', name: 'Renewed CPR / Smart Card Copy', icon: '🪪', description: 'Valid renewed CPR front/back copy or smart card verification certificate.' },
      { id: 2, code: 'RESUME', name: 'Updated CV / Resume', icon: '📄', description: 'Latest updated curriculum vitae reflecting candidate employment history and current skills.' },
      { id: 3, code: 'DEGREE', name: 'Degree / Graduation Certificate', icon: '🎓', description: 'Attested degree certificate or new post-graduate credentials.' },
      { id: 4, code: 'CONTRACT', name: 'Resignation Letter / Exit Settlement', icon: '📝', description: 'Official employer release, exit settlement, or resignation clearance letter.' },
      { id: 5, code: 'CONSENT', name: 'Renewal Consent Form', icon: '📑', description: 'Signed renewal agreement and Ministry placement consent form.' },
      { id: 6, code: 'OTHER', name: 'Other Supporting Document', icon: '📎', description: 'Additional certifications, training credentials, or endorsement letters.' }
    ];
  }, [documentCategories]);

  if (!initialCandidate) return null;
  const { currentUser, caseManagers = [], settings = {} } = state;
  const liveCandidate = state.candidates?.find(c => c.id === initialCandidate.id || c.ref_no === initialCandidate.ref_no) || initialCandidate;

  // Compute 12-month lifecycle baseline & overdue days
  const baselineDate = liveCandidate.last_renewal_date || liveCandidate.registration_date || (liveCandidate.created_at ? liveCandidate.created_at.substring(0, 10) : new Date().toISOString().split('T')[0]);
  const daysElapsed = Math.max(0, Math.floor((new Date().setHours(0,0,0,0) - new Date(baselineDate).getTime()) / 86400000));
  const isPast12m = daysElapsed > 365;
  const daysPast12m = isPast12m ? daysElapsed - 365 : 0;

  // Check if candidate is currently in placed status or has active employer linkage
  const wasPlaced = initialFromPlaced || ['placed', 'active'].includes(String(liveCandidate.status || '').toLowerCase()) || Boolean(liveCandidate.company_name);

  const [exitType, setExitType] = useState('resigned');
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [exitReason, setExitReason] = useState(
    wasPlaced 
      ? `Candidate exited placement with ${liveCandidate.company_name || 'employer'}. Renewed registration and returned to Available in Pool.`
      : ''
  );
  const [clearPlacement, setClearPlacement] = useState(true);

  const [phone, setPhone] = useState(liveCandidate.phone || '');
  const [email, setEmail] = useState(liveCandidate.email || '');
  const [education, setEducation] = useState(liveCandidate.education || 'Bachelor Degree');
  const [caseManager, setCaseManager] = useState(liveCandidate.case_manager_name || (caseManagers[0]?.case_manager_code || 'Husain'));
  const [renewalDate, setRenewalDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState(
    wasPlaced
      ? `Placement with ${liveCandidate.company_name || 'employer'} ended (Exit/Resigned). Registration renewed and candidate moved back to Available in Pool.`
      : `12-month registration cycle renewal. Candidate profile active in national talent pool.`
  );
  const [newDocuments, setNewDocuments] = useState([]);
  const initialRenewalDoc = wasPlaced ? 'Resignation Letter / Exit Settlement' : (activeDocCategories[0]?.name || 'CPR / Smart Card Copy');
  const [uploadDocType, setUploadDocType] = useState(initialRenewalDoc);
  const [uploadDocName, setUploadDocName] = useState(initialRenewalDoc);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedDocCategory = activeDocCategories.find(c => 
    c.name === uploadDocType || 
    c.code === uploadDocType ||
    String(c.name).trim().toLowerCase() === String(uploadDocType).trim().toLowerCase()
  ) || activeDocCategories[0] || null;

  // Handle uploading renewal supporting documents (e.g. renewed CPR, updated CV)
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target.result;
        const newDoc = {
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: uploadDocName || file.name,
          type: uploadDocType,
          file_name: file.name,
          file_size: file.size,
          file_data: base64Data,
          uploaded_at: new Date().toISOString()
        };
        setNewDocuments(prev => [...prev, newDoc]);
        setUploadDocName(uploadDocType);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveDoc = (index) => {
    setNewDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        phone: phone.trim(),
        email: email.trim(),
        education,
        case_manager_name: caseManager,
        renewal_date: renewalDate,
        remarks: remarks.trim(),
        documents: newDocuments,
        clear_placement: wasPlaced ? clearPlacement : false,
        exit_type: wasPlaced ? exitType : null,
        exit_date: wasPlaced ? exitDate : null,
        exit_reason: wasPlaced ? (exitReason || remarks.trim()) : null
      };

      const res = await window.api.candidates.renew(liveCandidate.id, payload);

      if (window.swal) {
        window.swal.fire({
          icon: 'success',
          title: wasPlaced ? 'Placement Exited & Candidate Renewed!' : 'Candidate Registration Renewed!',
          html: `<div style="text-align: left; font-size: 0.9rem; line-height: 1.5;">
            <div><strong>Candidate:</strong> ${liveCandidate.full_name}</div>
            <div><strong>Reference Number:</strong> <span style="font-family: var(--font-mono); font-weight: 700; color: var(--primary);">${liveCandidate.ref_no}</span> (Preserved)</div>
            ${wasPlaced && liveCandidate.company_name ? `<div><strong>Previous Employer:</strong> ${liveCandidate.company_name} (Archived)</div>` : ''}
            ${wasPlaced ? `<div><strong>Exit Type:</strong> <span style="text-transform: capitalize;">${exitType.replace('_', ' ')}</span></div>` : ''}
            <div><strong>Renewal Date:</strong> ${renewalDate}</div>
            <div style="margin-top: 6px; color: var(--success); font-weight: 600;">✓ Successfully moved back to "Available in Pool" with reset 12-month validity.</div>
          </div>`,
          confirmButtonColor: 'var(--primary)'
        });
      }

      await window.AppStore.loadInitialData();
      window.AppStore.closeModal();

      // Switch view filter to "registered" (Available in Pool)
      window.dispatchEvent(new CustomEvent('cand_filter_status_change', { detail: 'registered' }));
    } catch (err) {
      console.error('Error renewing candidate:', err);
      if (window.swal) {
        window.swal.fire({
          icon: 'error',
          title: 'Renewal Failed',
          text: err.message || 'An error occurred while renewing candidate registration.',
          confirmButtonColor: 'var(--danger)'
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto' }}>
      <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <span>🔄</span> {wasPlaced ? 'Record Placement Exit & Renew to Pool' : 'Renew Candidate Registration'}
          </h2>
          <p className="page-subtitle" style={{ margin: '0.25rem 0 0' }}>
            {wasPlaced
              ? 'Archive employer placement, preserve candidate reference number, and renew talent pool validity for 12 months.'
              : 'Preserve candidate reference number and extend national talent pool placement validity for 12 months.'}
          </p>
        </div>
        <button
          type="button"
          className="modal-close"
          onClick={() => window.AppStore.closeModal()}
          style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', padding: '1.25rem' }}>

          {/* Placement Exit Banner if candidate was placed */}
          {wasPlaced && (
            <div
              style={{
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(14, 165, 233, 0.35)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>💼</span> Placement Exit & Return to Talent Pool
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.74rem' }}>
                  Currently Placed
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Candidate is currently linked to <strong>{liveCandidate.company_name || 'Employer'}</strong> as <strong>{liveCandidate.position_title || 'Placed Specialist'}</strong>.
                Completing this renewal will archive their placement and exit details in candidate logs, reset the 12-month registration validity, and move the candidate back to <strong>Available in Pool</strong>.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>Exit / Resignation Type *</label>
                  <select
                    className="select-control"
                    value={exitType}
                    onChange={e => setExitType(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="resigned">⚠️ Voluntary Resignation (Candidate Resigned)</option>
                    <option value="terminated">⚠️ Employer Contract Ended / Terminated</option>
                    <option value="probation_exit">⚠️ Probation Period Exit</option>
                    <option value="completed_365">🎓 365-Day Program Completed (Re-enrolling in Pool)</option>
                    <option value="general_renewal">🔄 Cycle Renewal</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>Exit Effective Date *</label>
                  <input
                    type="date"
                    className="input-control"
                    value={exitDate}
                    onChange={e => setExitDate(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>Exit Reason / Clearance Note</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Candidate tendered resignation / contract completed / mutually separated"
                  value={exitReason}
                  onChange={e => setExitReason(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>
            </div>
          )}

          {/* Banner: Preserved Reference Number & 12-Month Overdue Info */}
          <div
            style={{
              background: isPast12m ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 106, 148, 0.06)',
              border: `1px solid ${isPast12m ? 'rgba(245, 158, 11, 0.35)' : 'rgba(0, 106, 148, 0.25)'}`,
              borderRadius: 'var(--radius-md, 8px)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Preserved Registration Reference (Locked)
                </span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🔒</span> {liveCandidate.ref_no}
                </div>
              </div>

              <div>
                {isPast12m ? (
                  <span
                    className="badge badge-warning"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.3rem 0.65rem',
                      fontWeight: 800,
                      background: 'rgba(245, 158, 11, 0.18)',
                      color: 'var(--warning, #d97706)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>⚠️</span> Expired (+{daysPast12m} days past 12 months)
                  </span>
                ) : (
                  <span
                    className="badge badge-success"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.3rem 0.65rem',
                      fontWeight: 800,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--success, #059669)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>✓</span> Within Active Cycle ({daysElapsed}/365 days)
                  </span>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.45rem', marginTop: '0.25rem' }}>
              <div><strong>Candidate:</strong> {liveCandidate.full_name}</div>
              <div><strong>CPR:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{liveCandidate.cpr_no}</span></div>
              <div><strong>Initial Registration:</strong> {window.formatAppDate(liveCandidate.registration_date || liveCandidate.created_at)}</div>
              <div><strong>Previous Renewals:</strong> {liveCandidate.renewals_count || 0} time(s)</div>
              {liveCandidate.last_renewal_date && <div><strong>Last Renewal:</strong> {window.formatAppDate(liveCandidate.last_renewal_date)}</div>}
              <div><strong>Current Status:</strong> <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{liveCandidate.status}</span></div>
            </div>
          </div>

          {/* Section 1: Renewal Effective Date & Assigned Case Manager */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Renewal Effective Date *
              </label>
              <input
                type="date"
                className="input-control"
                value={renewalDate}
                onChange={e => setRenewalDate(e.target.value)}
                required
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Resets the 12-month validity timer starting from this date.
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Assigned Case Manager *
              </label>
              <select
                className="input-control"
                value={caseManager}
                onChange={e => setCaseManager(e.target.value)}
                required
              >
                {caseManagers.map(cm => (
                  <option key={cm.id || cm.case_manager_code} value={cm.case_manager_code || cm.full_name}>
                    {cm.full_name || cm.case_manager_code} ({cm.case_manager_code})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Case Manager overseeing placement matching & retention gates.
              </div>
            </div>
          </div>

          {/* Section 2: Editable Contact Info & Education Upgrade */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Contact Phone Number
              </label>
              <input
                type="text"
                className="input-control"
                value={phone}
                placeholder="e.g. 39991234 or +973 39991234"
                onChange={e => setPhone(e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Update if candidate changed their contact telephone.
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Contact Email Address
              </label>
              <input
                type="email"
                className="input-control"
                value={email}
                placeholder="candidate@example.bh"
                onChange={e => setEmail(e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Primary email for job notifications and interviews.
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Education Level (Qualification Upgrade)
              </label>
              <select
                className="input-control"
                value={education}
                onChange={e => setEducation(e.target.value)}
              >
                <option value="High School / Secondary">High School / Secondary</option>
                <option value="Diploma">Diploma (Associate Degree)</option>
                <option value="Higher Diploma">Higher Diploma</option>
                <option value="Bachelor Degree">Bachelor Degree</option>
                <option value="Master Degree">Master Degree</option>
                <option value="Doctorate / PhD">Doctorate / PhD</option>
                <option value="Professional Certification">Professional Certification</option>
              </select>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Update if candidate achieved a higher educational degree.
              </div>
            </div>
          </div>

          {/* Section 3: Renewal Supporting Attachments */}
          <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', background: 'var(--bg-subtle, #f8fafc)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📎</span> Attach Renewal Documents (Optional)
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                {newDocuments.length} New File(s)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Document Category</label>
                <select
                  className="input-control"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem' }}
                  value={uploadDocType}
                  onChange={e => {
                    const newCat = e.target.value;
                    setUploadDocType(newCat);
                    setUploadDocName(newCat);
                  }}
                >
                  {activeDocCategories.map(cat => (
                    <option key={cat.code || cat.id} value={cat.name}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Custom Title / Label</label>
                <input
                  type="text"
                  className="input-control"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem' }}
                  placeholder="e.g. CPR Valid 2028, Updated CV 2026"
                  value={uploadDocName}
                  onChange={e => setUploadDocName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label
                  className="btn btn-outline btn-sm"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    fontSize: '0.8rem',
                    padding: '0.45rem 0.75rem',
                    background: 'var(--bg-card)'
                  }}
                >
                  <span>📁</span> Select & Attach File
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                </label>
              </div>
            </div>

            {selectedDocCategory?.description && (
              <div style={{
                marginBottom: '0.75rem',
                fontSize: '0.74rem',
                color: 'var(--text-secondary, #475569)',
                background: 'rgba(59, 130, 246, 0.07)',
                borderLeft: '3px solid #3b82f6',
                padding: '0.4rem 0.65rem',
                borderRadius: '0 4px 4px 0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.45rem',
                lineHeight: 1.4
              }}>
                <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>💡</span>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedDocCategory.name}: </strong>
                  <span>{selectedDocCategory.description}</span>
                </div>
              </div>
            )}

            {/* List of New Attachments Added */}
            {newDocuments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                {newDocuments.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                        {doc.type}
                      </span>
                      <strong style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '300px' }}>
                        {doc.name || doc.file_name}
                      </strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        ({Math.round(doc.file_size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
                      onClick={() => handleRemoveDoc(idx)}
                      title="Remove attachment"
                    >
                      &times; Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Renewal Remarks / Justification */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
              Renewal Remarks & Notes *
            </label>
            <textarea
              className="input-control"
              rows="3"
              style={{ fontSize: '0.85rem' }}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Enter remarks for audit and history tracking..."
              required
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Recorded in candidate renewal history and permanent audit ledger.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Ref <strong>{liveCandidate.ref_no}</strong> will be preserved. Candidate status resets to <strong>Available</strong>.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.AppStore.closeModal()}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
              disabled={saving}
            >
              {saving ? (
                <span>Renewing...</span>
              ) : (
                <>
                  <span>🔄</span> Confirm Renewal (Keep {liveCandidate.ref_no})
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// =========================================================================
// CANDIDATE ACTIVITY LOG & AUDIT TIMELINE MODAL
// Aggregates candidate lifecycle history: registration, renewals, checklist,
// documents, placements, milestones, claims, payments, disputes, audit events.
// Includes full export to Excel (CSV).
// =========================================================================
// =========================================================================
// CANDIDATE SEARCHABLE SELECT COMBOBOX
// Real-time keyboard-navigable combobox searchable by Candidate Name,
// Registration Reference Number (e.g. JCP/...), or CPR Identification Number.
// =========================================================================
function CandidateSearchSelect({ candidates = [], selectedId, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

  const selectedCandidate = useMemo(() => {
    return candidates.find(c => String(c.id) === String(selectedId)) || candidates[0] || null;
  }, [candidates, selectedId]);

  // Real-time filtering by Candidate Name, Ref Number, or CPR
  const filteredCandidates = useMemo(() => {
    if (!searchTerm.trim()) return candidates;
    const q = searchTerm.toLowerCase().trim();
    return candidates.filter(c => {
      const name = String(c.full_name || '').toLowerCase();
      const ref = String(c.ref_no || '').toLowerCase();
      const cpr = String(c.cpr_no || '').toLowerCase();
      const caseMgr = String(c.case_manager_name || '').toLowerCase();
      return name.includes(q) || ref.includes(q) || cpr.includes(q) || caseMgr.includes(q);
    });
  }, [candidates, searchTerm]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: '320px', flex: 1 }}>
      {/* Trigger Box displaying Selected Candidate */}
      <div
        className="input-control"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '0.45rem 0.75rem',
          fontSize: '0.86rem',
          minHeight: '38px',
          background: 'var(--bg-card)',
          borderColor: isOpen ? 'var(--primary)' : 'var(--border-light)',
          boxShadow: isOpen ? '0 0 0 3px var(--primary-glow)' : 'none',
          userSelect: 'none'
        }}
        title="Click to search candidates by Name, CPR, or Reference Number"
      >
        {selectedCandidate ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', flex: 1, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {selectedCandidate.full_name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'var(--bg-tertiary)',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
                border: '1px solid var(--border-light)',
                whiteSpace: 'nowrap'
              }}
            >
              {selectedCandidate.ref_no}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              CPR: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{selectedCandidate.cpr_no}</strong>
            </span>
            <span className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', textTransform: 'capitalize' }}>
              {selectedCandidate.status || 'registered'}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Select candidate...</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
          <span>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Popover Searchable Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.22), 0 8px 12px -6px rgba(0, 0, 0, 0.12)',
            padding: '0.55rem',
            animation: 'fadeIn 0.12s ease-out',
            minWidth: '380px'
          }}
        >
          {/* Live Search Input Box */}
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="input-control"
              style={{ paddingLeft: '2.2rem', paddingRight: searchTerm ? '2rem' : '0.75rem', fontSize: '0.84rem' }}
              placeholder="Search candidate name, CPR number, or ref (e.g. JCP/26/...)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {searchTerm && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
                title="Clear search"
              >
                ✕
              </span>
            )}
          </div>

          {/* Search Results Summary Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.4rem 0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', marginBottom: '0.35rem' }}>
            <span>
              {searchTerm ? `Found ${filteredCandidates.length} matching candidate(s)` : `All Candidates (${candidates.length})`}
            </span>
            <span>Click to select & view history</span>
          </div>

          {/* Candidate Items Scrollable List */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px'
            }}
          >
            {filteredCandidates.length === 0 ? (
              <div style={{ padding: '1.25rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>🔍</div>
                <div>No candidates match "<strong>{searchTerm}</strong>"</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>Try searching by candidate name, 9-digit CPR, or reference code.</div>
              </div>
            ) : (
              filteredCandidates.map(c => {
                const isSelected = String(c.id) === String(selectedCandidate?.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelect(String(c.id));
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm, 6px)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      background: isSelected ? 'var(--primary-subtle, rgba(0, 106, 148, 0.12))' : 'transparent',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                      transition: 'background 0.1s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-subtle, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Top Row: Full Name + Ref Badge + Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                        <strong style={{ fontSize: '0.86rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.full_name}
                        </strong>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            background: 'var(--bg-tertiary)',
                            padding: '0.05rem 0.35rem',
                            borderRadius: '3px'
                          }}
                        >
                          {c.ref_no}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', textTransform: 'capitalize' }}>
                          {c.status || 'registered'}
                        </span>
                        {isSelected && (
                          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>✓</span>
                        )}
                      </div>
                    </div>

                    {/* Subtitle Row: CPR + Registration Date + Case Manager */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      <span>CPR: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{c.cpr_no}</strong></span>
                      <span>•</span>
                      <span>Reg: {window.formatAppDate ? window.formatAppDate(c.registration_date) : c.registration_date}</span>
                      <span>•</span>
                      <span>Mgr: {c.case_manager_name || 'System'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateActivityLogModal({ state, initialCandidateId }) {
  const { candidates = [], settings = {} } = state;
  const currency = settings.currency || 'BHD';

  // State
  const [selectedId, setSelectedId] = useState(() => {
    if (initialCandidateId) return String(initialCandidateId);
    return candidates[0] ? String(candidates[0].id) : '';
  });
  const [activities, setActivities] = useState([]);
  const [candidateInfo, setCandidateInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch candidate activities
  const fetchActivities = async (candId) => {
    if (!candId) return;
    setLoading(true);
    try {
      const res = await window.api.candidates.getActivities(candId);
      setActivities(res.activities || []);
      setCandidateInfo(res.candidate || null);
    } catch (err) {
      console.error('Error fetching candidate activities:', err);
      if (window.swal) {
        window.swal.fire({
          icon: 'error',
          title: 'Failed to Load Activity Log',
          text: err.message || 'Could not retrieve candidate history.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      fetchActivities(selectedId);
    }
  }, [selectedId]);

  // Active candidate object
  const currentCandidate = useMemo(() => {
    return candidateInfo || candidates.find(c => String(c.id) === String(selectedId)) || null;
  }, [candidateInfo, candidates, selectedId]);

  // Filter activities by category and search keyword
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      if (categoryFilter !== 'all' && act.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const str = `${act.title || ''} ${act.ref || ''} ${act.details || ''} ${act.actor || ''} ${act.status || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [activities, categoryFilter, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: activities.length };
    activities.forEach(a => {
      const cat = a.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [activities]);

  // Export Complete Activity Log to Excel (CSV with UTF-8 BOM)
  const handleExportCSV = () => {
    if (!activities.length || !currentCandidate) {
      if (window.swal) window.swal.fire({ icon: 'warning', title: 'No Activities', text: 'There are no activities to export for this candidate.' });
      return;
    }

    const headers = [
      'Activity ID',
      'Date & Time',
      'Date',
      'Category',
      'Activity Title',
      'Reference / Code',
      `Financial Amount (${currency})`,
      'Status',
      'Details / Description',
      'Action Taken By / Actor'
    ];

    const escapeCsv = (val) => {
      const s = String(val ?? '').replace(new RegExp('"', 'g'), '""');
      return `"${s}"`;
    };

    const rows = activities.map(act => [
      act.id,
      (window.formatAppDate ? window.formatAppDate(act.date || act.timestamp) : act.date) + (act.timestamp && act.timestamp.includes(' ') ? ' ' + act.timestamp.split(' ')[1].substring(0, 5) : ''),
      window.formatAppDate ? window.formatAppDate(act.date) : act.date,
      (act.category || '').toUpperCase(),
      act.title,
      act.ref || '',
      act.amount !== null && act.amount !== undefined ? Number(act.amount).toFixed(3) : '',
      act.status || '',
      act.details || '',
      act.actor || ''
    ]);

    const csvContent = '\uFEFF' + [
      headers.map(escapeCsv).join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeRef = (currentCandidate.ref_no || 'CAND').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Activity_Log_${safeRef}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (window.swal) {
      window.swal.fire({
        icon: 'success',
        title: 'Export Successful!',
        text: `Activity log downloaded as ${fileName}`,
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  // Category Icon & Styling Helper
  const getCategoryMeta = (cat) => {
    switch (cat) {
      case 'approval':     return { icon: '🏛️', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', label: 'Government Approval' };
      case 'interview':    return { icon: '🤝', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', label: 'Job Interview' };
      case 'registration': return { icon: '👤', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', label: 'Registration' };
      case 'event':        return { icon: '🎓', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', label: 'Training / Career Fair' };
      case 'training':     return { icon: '🎓', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', label: 'Training Session' };
      case 'career_fair':  return { icon: '🎪', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', label: 'Career Fair' };
      case 'renewal':      return { icon: '🔄', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)', label: 'Renewal' };
      case 'checklist':    return { icon: '📋', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', label: 'Checklist' };
      case 'document':     return { icon: '📄', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', label: 'Document' };
      case 'placement':    return { icon: '💼', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', label: 'Placement' };
      case 'milestone':    return { icon: '🎯', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', label: 'Retention Gate' };
      case 'claim':        return { icon: '📑', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)', label: 'Subsidy Claim' };
      case 'payment':      return { icon: '💵', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Disbursement' };
      case 'dispute':      return { icon: '⚠️', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'Dispute' };
      case 'audit':        return { icon: '🛡️', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', label: 'Audit Log' };
      default:             return { icon: '📌', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', label: 'Event' };
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '960px', maxHeight: '92vh', overflowY: 'auto' }}>
      {/* Header */}
      <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <span>📜</span> Candidate Activity Log & Lifecycle Audit
          </h2>
          <p className="page-subtitle" style={{ margin: '0.25rem 0 0' }}>
            Unified chronological audit trail across registrations, training sessions & career fairs attended, renewals, placements, retention milestones, subsidy claims, disbursements, and disputes.
          </p>
        </div>
        <button
          type="button"
          className="modal-close"
          onClick={() => window.AppStore.closeModal()}
          style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          &times;
        </button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>

        {/* Top Control Bar: Candidate Selector & Excel Export Button */}
        <div
          style={{
            background: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '320px', position: 'relative', zIndex: 110 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>👤</span> Candidate:
            </label>
            <CandidateSearchSelect
              candidates={candidates}
              selectedId={selectedId}
              onSelect={id => setSelectedId(id)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
              onClick={() => fetchActivities(selectedId)}
              disabled={loading}
              title="Refresh timeline data"
            >
              <span>🔄</span> Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700 }}
              onClick={handleExportCSV}
              disabled={loading || !activities.length}
              title="Download full candidate history as Excel-compatible CSV file"
            >
              <span>📥</span> Export Activity Log to Excel (CSV)
            </button>
          </div>
        </div>

        {/* Candidate Profile Summary Header */}
        {currentCandidate && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              fontSize: '0.8rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Candidate Name & CPR
              </div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{currentCandidate.full_name}</strong>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>CPR: {currentCandidate.cpr_no}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Registration Ref
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)', fontSize: '0.92rem' }}>
                {currentCandidate.ref_no}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                Reg: {window.formatAppDate(currentCandidate.registration_date)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Talent Pool Status
              </div>
              <span className="badge badge-info" style={{ fontWeight: 700, fontSize: '0.74rem' }}>
                {currentCandidate.status}
              </span>
              {currentCandidate.renewals_count > 0 && (
                <div style={{ marginTop: '2px', color: 'var(--success)', fontWeight: 600, fontSize: '0.72rem' }}>
                  🔄 Renewed {currentCandidate.renewals_count} time(s)
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Government Scheme Approvals
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '3px', flexWrap: 'wrap' }}>
                <span className="badge badge-success" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                  🏬 Job Center: Yes
                </span>
                {(currentCandidate.approved_by_tamkeen === true || String(currentCandidate.approved_by_tamkeen || '').toLowerCase() === 'yes') ? (
                  <span className="badge badge-success" style={{ fontSize: '0.68rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.18)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.4)' }} title={`Approved by Tamkeen on ${currentCandidate.tamkeen_approval_date || ''}`}>
                    🏛️ Tamkeen: Yes {currentCandidate.tamkeen_approval_date ? `(${currentCandidate.tamkeen_approval_date})` : ''}
                  </span>
                ) : (
                  <span className="badge badge-warning" style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.18)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                    🏛️ Tamkeen: Pending
                  </span>
                )}
              </div>
              {currentCandidate.tamkeen_approval_notes && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                  "{currentCandidate.tamkeen_approval_notes}"
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Case Manager
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentCandidate.case_manager_name || 'System Assigned'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Edu: {currentCandidate.education || 'N/A'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                History Events
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {activities.length} <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>total logged</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter Pills Bar & Search Box - Responsive Wrapping with ZERO Horizontal Scroll */}
        <div
          style={{
            background: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}
        >
          {/* Top Row: Section Label + Keyword Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <span>🏷️</span> Filter Activities by Category:
            </div>

            {/* Keyword Search Input */}
            <div style={{ flex: '0 1 320px', minWidth: '240px' }}>
              <input
                type="text"
                className="input-control"
                style={{ fontSize: '0.8rem', padding: '0.38rem 0.65rem' }}
                placeholder="🔍 Search candidate log..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Category Filter Pills - Flex Wrapped with NO Horizontal Scroll */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
            {[
              { key: 'all', label: 'All Activities' },
              { key: 'interview', label: '🤝 Job Interviews' },
              { key: 'event', label: '🎓 Training & Career Fairs' },
              { key: 'approval', label: '🏛️ Approvals' },
              { key: 'registration', label: 'Registration' },
              { key: 'renewal', label: 'Renewals' },
              { key: 'checklist', label: 'Checklist' },
              { key: 'document', label: 'Documents' },
              { key: 'placement', label: 'Placements' },
              { key: 'milestone', label: 'Retention Gates' },
              { key: 'claim', label: 'Claims' },
              { key: 'payment', label: 'Disbursements' },
              { key: 'dispute', label: 'Disputes' },
              { key: 'audit', label: 'Audit Logs' }
            ].map(tab => {
              const count = categoryCounts[tab.key] || 0;
              const isSelected = categoryFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    borderRadius: 'var(--radius-full)',
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.74rem',
                    whiteSpace: 'nowrap',
                    background: isSelected ? undefined : 'var(--bg-card)'
                  }}
                  onClick={() => setCategoryFilter(tab.key)}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      marginLeft: '0.35rem',
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
                      padding: '0.05rem 0.35rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline Activities Feed */}
        <div style={{ position: 'relative', marginTop: '0.5rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⏳</div>
              <div>Retrieving comprehensive candidate activity history...</div>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-subtle, #f8fafc)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>📭</div>
              <div style={{ fontWeight: 600 }}>No activity records match your current filters.</div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Try clearing the search query or selecting "All Activities".</div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                position: 'relative',
                paddingLeft: '1.5rem',
                borderLeft: '2px solid var(--border-light)'
              }}
            >
              {filteredActivities.map((act, index) => {
                const meta = getCategoryMeta(act.category);
                return (
                  <div
                    key={act.id || index}
                    style={{
                      position: 'relative',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.03))'
                    }}
                  >
                    {/* Timeline Node Icon */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-2.15rem',
                        top: '0.85rem',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: meta.color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        boxShadow: '0 0 0 3px var(--bg-card)'
                      }}
                      title={meta.label}
                    >
                      {meta.icon}
                    </div>

                    {/* Top Row: Category Pill, Ref Code, Amount & Timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.color}40`,
                            textTransform: 'uppercase'
                          }}
                        >
                          {meta.label}
                        </span>

                        {act.ref && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--bg-tertiary)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                            {act.ref}
                          </span>
                        )}

                        {act.amount !== null && act.amount !== undefined && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--success, #059669)', background: 'rgba(5, 150, 105, 0.1)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                            {currency} {Number(act.amount).toFixed(3)}
                          </span>
                        )}

                        {act.status && (() => {
                          const st = String(act.status).toLowerCase();
                          const isSuccess = st === 'attended' || st === 'present' || st === 'passed' || st === 'selected' || st === 'approved' || st === 'settled';
                          const isPending = st === 'registered' || st === 'scheduled' || st === 'pending';
                          const isDanger = st === 'absent' || st === 'rejected' || st === 'disputed' || st === 'terminated';
                          let badgeBg = 'var(--bg-tertiary)';
                          let badgeColor = 'var(--text-secondary)';
                          if (isSuccess) {
                            badgeBg = 'rgba(16, 185, 129, 0.15)';
                            badgeColor = '#059669';
                          } else if (isPending) {
                            badgeBg = 'rgba(2, 132, 199, 0.15)';
                            badgeColor = '#0284c7';
                          } else if (isDanger) {
                            badgeBg = 'rgba(239, 68, 68, 0.15)';
                            badgeColor = '#dc2626';
                          }
                          return (
                            <span className="badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', textTransform: 'capitalize', background: badgeBg, color: badgeColor, fontWeight: 700 }}>
                              {act.status}
                            </span>
                          );
                        })()}
                      </div>

                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>📅</span>
                        <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                          {window.formatAppDate ? window.formatAppDate(act.date || act.timestamp) : act.date}
                        </strong>
                        {act.timestamp && act.timestamp.includes(' ') && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            • {act.timestamp.split(' ')[1].substring(0, 5)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {act.title}
                    </div>

                    {/* Details / Narrative */}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {act.details}
                    </div>

                    {/* Footer Row: Action Performed By */}
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <div>
                        Action taken by: <strong style={{ color: 'var(--text-primary)' }}>{act.actor || 'System'}</strong>
                      </div>
                      <div>
                        Event #{act.id}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredActivities.length}</strong> of <strong>{activities.length}</strong> candidate timeline entries.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleExportCSV}
            disabled={!activities.length}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <span>📥</span> Export to Excel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.AppStore.closeModal()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// CASE MANAGER ACTIVITIES & AUDIT TRAIL MODAL
// =========================================================================
function CaseManagerActivitiesModal({ state, targetCM }) {
  const { caseManagers = [], currentUser = {}, settings = {} } = state;
  const currency = settings.currency || 'BHD';

  // Determine active case manager name
  const [selectedCM, setSelectedCM] = useState(() => {
    if (typeof targetCM === 'string' && targetCM) return targetCM;
    if (targetCM?.full_name) return targetCM.full_name;
    if (currentUser?.role === 'case_manager') return currentUser.case_manager_code || currentUser.full_name;
    return caseManagers[0]?.case_manager_code || caseManagers[0]?.full_name || 'Husain Al-Mulla';
  });

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch activities when selectedCM changes
  const fetchActivities = async (cm) => {
    if (!cm) return;
    setLoading(true);
    try {
      const res = await window.api.activities.getByCaseManager(cm);
      setActivities(res.activities || []);
    } catch (err) {
      console.error('Error fetching case manager activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCM) {
      fetchActivities(selectedCM);
    }
  }, [selectedCM]);

  // Filter activities by search and category
  const filteredActivities = useMemo(() => {
    return (activities || []).filter(act => {
      if (categoryFilter !== 'all' && (act.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${act.title} ${act.ref} ${act.details} ${act.actor} ${act.candidate_name || ''} ${act.employer_name || ''}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [activities, categoryFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    let placements = 0;
    let claims = 0;
    let payments = 0;
    let paidAmount = 0;
    (activities || []).forEach(a => {
      const cat = (a.category || '').toLowerCase();
      if (cat === 'placement') placements++;
      if (cat === 'claim') claims++;
      if (cat === 'payment') {
        payments++;
        paidAmount += Number(a.amount || 0);
      }
    });
    return { total: activities.length, placements, claims, payments, paidAmount };
  }, [activities]);

  const getCategoryMeta = (cat) => {
    switch ((cat || '').toLowerCase()) {
      case 'placement': return { icon: '💼', label: 'Placement', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)' };
      case 'claim': return { icon: '📋', label: 'Claim', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' };
      case 'payment': return { icon: '💳', label: 'Payment', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'registration': return { icon: '👤', label: 'Registration', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' };
      case 'renewal': return { icon: '🔄', label: 'Renewal', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'milestone': return { icon: '🎯', label: 'Milestone', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' };
      case 'document': return { icon: '📄', label: 'Document', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' };
      default: return { icon: '🛡️', label: 'Audit Log', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' };
    }
  };

  const handleExportCSV = () => {
    if (!filteredActivities.length) return;
    const headers = ['Activity ID', 'Timestamp', 'Date', 'Category', 'Action Title', 'Reference', 'Details', 'Actor', 'Amount (BHD)', 'Status'];
    const rows = filteredActivities.map(a => [
      a.id,
      a.timestamp,
      a.date,
      a.category,
      `"${(a.title || '').replace(/"/g, '""')}"`,
      `"${(a.ref || '').replace(/"/g, '""')}"`,
      `"${(a.details || '').replace(/"/g, '""')}"`,
      `"${(a.actor || '').replace(/"/g, '""')}"`,
      a.amount !== null && a.amount !== undefined ? Number(a.amount).toFixed(3) : '',
      a.status || ''
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Case_Manager_Activities_${selectedCM.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal" style={{ maxWidth: '1050px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <span>📋</span>
            <span>Case Manager Activity Ledger & Associated Actions</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Audit trail of candidate registrations, placements, subsidy claims, and payment collections for Case Manager <strong>{selectedCM}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => window.AppStore.closeModal()}
          style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem' }}
        >
          ✕
        </button>
      </div>

      {/* Controls Bar: CM Switcher + Summary Stats */}
      <div style={{ padding: '0.85rem 1.5rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Case Manager Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Case Manager:</span>
          <select
            className="select-control"
            value={selectedCM}
            onChange={e => setSelectedCM(e.target.value)}
            style={{ minWidth: '220px', padding: '0.35rem 0.65rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            {caseManagers.map(cm => (
              <option key={cm.id || cm.username} value={cm.full_name}>
                👤 {cm.full_name} ({cm.case_manager_code || 'CM'})
              </option>
            ))}
          </select>
        </div>

        {/* Quick KPI stats */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Activities: </span>
            <strong style={{ color: 'var(--primary)' }}>{stats.total}</strong>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Placements: </span>
            <strong style={{ color: '#0ea5e9' }}>{stats.placements}</strong>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Claims: </span>
            <strong style={{ color: '#8b5cf6' }}>{stats.claims}</strong>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Payments: </span>
            <strong style={{ color: '#10b981' }}>{stats.payments} ({currency} {stats.paidAmount.toFixed(3)})</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All', icon: '🌐' },
            { key: 'placement', label: 'Placements', icon: '💼' },
            { key: 'claim', label: 'Claims', icon: '📋' },
            { key: 'payment', label: 'Payments', icon: '💳' },
            { key: 'registration', label: 'Registrations', icon: '👤' },
            { key: 'milestone', label: 'Milestones', icon: '🎯' },
            { key: 'renewal', label: 'Renewals', icon: '🔄' },
            { key: 'audit', label: 'Audit Trail', icon: '🛡️' }
          ].map(c => {
            const active = categoryFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoryFilter(c.key)}
                className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 'var(--radius-full, 9999px)' }}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ minWidth: '220px', flex: '1', maxWidth: '320px' }}>
          <input
            type="text"
            className="input-control"
            placeholder="Search activities, refs, candidates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
          />
        </div>
      </div>

      {/* Activities Timeline & Table Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⏳</div>
            <div>Loading activities for {selectedCM}...</div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>No activities recorded for {selectedCM}</div>
            <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
              Activities appear here as registrations, placements, claims, and payment collections are performed.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {filteredActivities.map((act) => {
              const meta = getCategoryMeta(act.category);
              return (
                <div
                  key={act.id}
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    transition: 'var(--transition)'
                  }}
                >
                  {/* Category Icon Pill */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: meta.bg,
                    color: meta.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    flexShrink: 0
                  }}>
                    {meta.icon}
                  </div>

                  {/* Activity Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          background: meta.bg,
                          color: meta.color,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '1px 7px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {meta.label}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {act.title}
                        </strong>
                        {act.ref && (
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                            {act.ref}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        ⏱️ {window.formatAppDate(act.timestamp || act.date)} {act.timestamp ? act.timestamp.split(' ')[1] : ''}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '0.2rem' }}>
                      {act.details}
                    </div>

                    {/* Footer tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>👤 <strong>Performed By:</strong> {act.actor}</span>
                      {act.amount !== null && act.amount !== undefined && (
                        <span>💰 <strong>Value:</strong> {currency} {Number(act.amount).toFixed(3)}</span>
                      )}
                      {act.status && (
                        <span style={{ textTransform: 'capitalize' }}>
                          🏷️ Status: <strong style={{ color: 'var(--text-primary)' }}>{act.status}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="modal-footer" style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredActivities.length}</strong> of <strong>{activities.length}</strong> activities associated with {selectedCM}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportCSV}
            disabled={!filteredActivities.length}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
          >
            <span>📥</span> Export to CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => window.AppStore.closeModal()}
            style={{ fontSize: '0.8rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}



// ScheduleInterviewModal component
function ScheduleInterviewModal({ state, initialJob, initialJobId }) {
  const { candidates = [], jobs = [], settings = {} } = state;
  const currency = settings.currency || 'BHD';
  const SearchableSelect = window.SearchableSelect;

  // Detect if modal was opened for a specific job
  const isJobLocked = Boolean(initialJobId || (initialJob && initialJob.id));

  // Selected Job ID
  const [selectedJobId, setSelectedJobId] = useState(() => {
    if (initialJobId) return String(initialJobId);
    if (initialJob && initialJob.id) return String(initialJob.id);
    return '';
  });

  // Interview Session Details
  const [interviewDate, setInterviewDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [interviewTime, setInterviewTime] = useState('10:00');
  const [interviewLocation, setInterviewLocation] = useState('Head Office - Interview Room 1');
  const [remarks, setRemarks] = useState('');

  // Preset Filters
  const [qualificationFilter, setQualificationFilter] = useState('ALL');
  const [ageRangePreset, setAgeRangePreset] = useState('ALL');
  const [customMinAge, setCustomMinAge] = useState('');
  const [customMaxAge, setCustomMaxAge] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [talentPoolScope, setTalentPoolScope] = useState('unplaced'); // 'unplaced' | 'all'
  const [searchKeyword, setSearchKeyword] = useState('');

  // Selected Candidate IDs
  const [selectedCandidateIds, setSelectedCandidateIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Available Job Openings for selector
  const availableJobs = useMemo(() => {
    return (jobs || []).filter(j => (j.status || 'active').toLowerCase() !== 'closed');
  }, [jobs]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return initialJob || null;
    return (jobs || []).find(j => String(j.id) === String(selectedJobId)) || initialJob || null;
  }, [selectedJobId, jobs, initialJob]);

  // Helper for age
  const getCandidateAge = (dob) => {
    if (window.calculateAge) {
      const a = window.calculateAge(dob);
      if (a !== null && !isNaN(a)) return a;
    }
    if (!dob) return null;
    try {
      const birth = new Date(dob);
      if (isNaN(birth.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age >= 0 ? age : null;
    } catch (e) {
      return null;
    }
  };

  // Qualification matching
  const matchesQualification = (c, filter) => {
    if (!filter || filter === 'ALL') return true;
    const str = `${c.education || ''} ${c.highest_education || ''} ${c.attested_degree || ''} ${c.qualification || ''}`.toLowerCase();
    switch (filter.toLowerCase()) {
      case 'bachelor':
        return str.includes('bachelor') || str.includes('bsc') || str.includes('ba') || str.includes('b.sc') || str.includes('b.tech') || str.includes('undergraduate');
      case 'master':
        return str.includes('master') || str.includes('msc') || str.includes('ma') || str.includes('mba') || str.includes('m.sc') || str.includes('postgraduate');
      case 'diploma':
        return str.includes('diploma') || str.includes('associate') || str.includes('hnd');
      case 'secondary':
        return str.includes('high school') || str.includes('secondary') || str.includes('thaniwya') || str.includes('school');
      case 'doctorate':
        return str.includes('phd') || str.includes('doctorate') || str.includes('doctor');
      case 'vocational':
        return str.includes('vocational') || str.includes('technical') || str.includes('trade') || str.includes('certificate');
      default:
        return str.includes(filter.toLowerCase());
    }
  };

  // Age matching
  const matchesAge = (c, preset, minA, maxA) => {
    const age = getCandidateAge(c.date_of_birth);
    if (preset === 'ALL' && !minA && !maxA) return true;
    if (age === null) return false;
    if (minA && !isNaN(parseInt(minA, 10)) && age < parseInt(minA, 10)) return false;
    if (maxA && !isNaN(parseInt(maxA, 10)) && age > parseInt(maxA, 10)) return false;

    if (preset === '18-25') return age >= 18 && age <= 25;
    if (preset === '25-35') return age >= 25 && age <= 35;
    if (preset === '35-50') return age >= 35 && age <= 50;
    if (preset === '50+') return age >= 50;
    return true;
  };

  // Gender matching
  const matchesGender = (c, filter) => {
    if (!filter || filter === 'ALL') return true;
    const g = (c.gender || '').toLowerCase().trim();
    if (filter.toLowerCase() === 'male') return g === 'male' || g === 'm';
    if (filter.toLowerCase() === 'female') return g === 'female' || g === 'f';
    return g === filter.toLowerCase();
  };

  // Scope matching
  const matchesScope = (c, scope) => {
    if (scope === 'all') return true;
    const st = (c.status || '').toLowerCase();
    if (st === 'placed' || st === 'active' || st === 'completed' || st === 'resigned') return false;
    if (c.job_id) return false;
    return true;
  };

  // Keyword matching
  const matchesKeyword = (c, kw) => {
    if (!kw || !kw.trim()) return true;
    const q = kw.toLowerCase().trim();
    const str = `${c.full_name || ''} ${c.cpr_no || ''} ${c.ref_no || ''} ${c.phone || ''} ${c.center || ''} ${c.education || ''} ${c.specialization || ''}`.toLowerCase();
    return str.includes(q);
  };

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    return (candidates || []).filter(c => {
      if (!matchesScope(c, talentPoolScope)) return false;
      if (!matchesQualification(c, qualificationFilter)) return false;
      if (!matchesAge(c, ageRangePreset, customMinAge, customMaxAge)) return false;
      if (!matchesGender(c, genderFilter)) return false;
      if (!matchesKeyword(c, searchKeyword)) return false;
      return true;
    });
  }, [candidates, talentPoolScope, qualificationFilter, ageRangePreset, customMinAge, customMaxAge, genderFilter, searchKeyword]);

  // Toggle selection
  const handleToggleCandidate = (id) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllMatching = () => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      filteredCandidates.forEach(c => next.add(c.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedCandidateIds(new Set());
  };

  const handleRemoveCandidate = (id) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Submit
  const handleSchedule = async (e) => {
    if (e) e.preventDefault();
    if (!selectedJobId) {
      if (window.AppStore?.showToast) window.AppStore.showToast('Please select a job opening for the interview.', 'error');
      return;
    }
    if (!interviewDate || !interviewTime) {
      if (window.AppStore?.showToast) window.AppStore.showToast('Please specify the interview date and time.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        job_id: parseInt(selectedJobId, 10),
        interview_date: interviewDate,
        interview_time: interviewTime,
        location: interviewLocation || 'Main Office',
        remarks: remarks || '',
        candidate_ids: Array.from(selectedCandidateIds)
      };

      const res = await window.api.interviews.create(payload);
      if (res && res.success !== false) {
        const createdInt = res?.data || res;
        const intId = createdInt?.id || res?.id;
        const intCode = createdInt?.interview_code || res?.interview_code || '';
        if (window.AppStore?.showToast) {
          window.AppStore.showToast(`🎉 Interview session ${intCode} scheduled successfully with ${selectedCandidateIds.size} candidate(s)!`, 'success');
        }
        await window.AppStore.refreshData();
        // Switch to the Job Interviews Modal locked to this job so the user sees the session immediately
        window.AppStore.openModal('JOB_INTERVIEWS', {
          job: selectedJob,
          jobId: selectedJobId,
          interviewId: intId
        });
      } else {
        throw new Error(res?.message || 'Failed to schedule interview');
      }
    } catch (err) {
      console.error('Error scheduling interview:', err);
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`Error scheduling interview: ${err.message}`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Map selected candidate objects for summary chips
  const selectedCandidatesList = useMemo(() => {
    const set = selectedCandidateIds;
    return (candidates || []).filter(c => set.has(c.id));
  }, [candidates, selectedCandidateIds]);

  return (
    <div className="modal-content" style={{ maxWidth: '960px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
      {/* Modal Header */}
      <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🤝</span> Schedule Job Interview
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Schedule an interview session against an employer job opening and select candidates using qualification, age, and gender presets.
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={() => window.AppStore.closeModal()}
          style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          &times;
        </button>
      </div>

      {/* Modal Body */}
      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        
        {/* Section 1: Job Opening Selection */}
        {isJobLocked ? (
          /* Locked Job Opening Banner */
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(59, 130, 246, 0.03) 100%)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: '8px',
            padding: '0.85rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                🏢
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    Target Job Opening:
                  </span>
                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: '0.68rem', fontWeight: 700 }}>
                    🔒 Locked for this Job
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{selectedJob?.company_name || 'Employer'}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedJob?.job_title || 'Position'}</span>
                  <span className="badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7' }}>
                    {selectedJob?.job_code || `JOB-${selectedJob?.id || selectedJobId}`}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.76rem', background: 'var(--bg-card, #ffffff)', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <span>Wage: <strong style={{ color: '#059669' }}>{currency} {Number(selectedJob?.salary_offered_bhd || 500).toFixed(3)}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
              <span>Open: <strong style={{ color: '#0284c7' }}>{selectedJob?.vacancies_remaining ?? selectedJob?.vacancies_count ?? 1}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
              <span>Dept: <strong>{selectedJob?.department || 'Operations'}</strong></span>
            </div>
          </div>
        ) : (
          /* Global: Select Target Job Opening */
          <div style={{ background: 'var(--bg-tertiary, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🏢</span> 1. Select Target Job Opening *
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '2fr 1.2fr' : '1fr', gap: '1rem', alignItems: 'center' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.3rem' }}>Job Vacancy Opening</label>
                <select
                  className="select-control"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  value={selectedJobId}
                  onChange={e => setSelectedJobId(e.target.value)}
                >
                  <option value="">-- Choose Job Opening ({availableJobs.length} Available) --</option>
                  {availableJobs.map(j => {
                    const rem = typeof j.vacancies_remaining !== 'undefined' ? j.vacancies_remaining : j.vacancies_count;
                    return (
                      <option key={j.id} value={String(j.id)}>
                        {j.company_name} — {j.job_title} ({j.job_code || `JOB-${j.id}`}) • {rem} Open Vacancy • {currency} {Number(j.salary_offered_bhd || 500).toFixed(3)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedJob && (
                <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedJob.company_name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                    {selectedJob.job_title} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedJob.job_code || `JOB-${selectedJob.id}`}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                      {currency} {Number(selectedJob.salary_offered_bhd || 500).toFixed(3)}
                    </span>
                    <span>&bull;</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {selectedJob.vacancies_remaining || selectedJob.vacancies_count || 1} open
                    </span>
                    <span>&bull;</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {selectedJob.department || 'Operations'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 2: Date, Time, Location & Remarks */}
        <div style={{ background: 'var(--bg-tertiary, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>📅</span> 2. Interview Date, Time, Location & Instructions *
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
            {/* Interview Date */}
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Interview Date *</label>
              <input
                type="date"
                className="input-control"
                value={interviewDate}
                onChange={e => setInterviewDate(e.target.value)}
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                required
              />
            </div>

            {/* Interview Time & Quick Chips */}
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Interview Time *</label>
              <input
                type="time"
                className="input-control"
                value={interviewTime}
                onChange={e => setInterviewTime(e.target.value)}
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                required
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
                {['09:00', '10:00', '11:30', '14:00', '15:30'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInterviewTime(t)}
                    style={{
                      background: interviewTime === t ? 'var(--primary, #0284c7)' : 'var(--bg-card, #fff)',
                      color: interviewTime === t ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid ' + (interviewTime === t ? 'var(--primary, #0284c7)' : 'var(--border-light)'),
                      borderRadius: '4px',
                      padding: '0.12rem 0.45rem',
                      fontSize: '0.68rem',
                      fontWeight: interviewTime === t ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {t === '14:00' ? '02:00 PM' : (t === '15:30' ? '03:30 PM' : `${t} AM`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Location / Venue *</label>
              <input
                type="text"
                className="input-control"
                value={interviewLocation}
                onChange={e => setInterviewLocation(e.target.value)}
                placeholder="e.g. Main Training Center - Room A or MS Teams Link"
                style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                required
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                {[
                  'Main Office - Room A',
                  'Employer Site / HQ',
                  'Virtual / MS Teams',
                  'Job Center Enma Mall'
                ].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setInterviewLocation(loc)}
                    style={{
                      background: interviewLocation === loc ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-card, #fff)',
                      color: interviewLocation === loc ? '#0284c7' : 'var(--text-secondary)',
                      border: '1px solid ' + (interviewLocation === loc ? '#0284c7' : 'var(--border-light)'),
                      borderRadius: '4px',
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: interviewLocation === loc ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    📍 {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Remarks */}
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Remarks & Candidate Instructions</label>
              <textarea
                className="input-control"
                rows="2"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Notes for interviewers, dress code, documents candidates should bring, panel names..."
                style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Candidate Search & Preset Matching Panel */}
        <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-light, #e2e8f0)', borderRadius: '8px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🎯</span> 3. Candidate Search Presets (Qualification, Age & Gender)
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Matching Candidates: <strong style={{ color: 'var(--primary)' }}>{filteredCandidates.length}</strong> | Selected: <strong style={{ color: '#059669' }}>{selectedCandidateIds.size}</strong>
            </div>
          </div>

          {/* Preset Filters Grid */}
          <div style={{ background: 'var(--bg-tertiary, #f8fafc)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Filter Row 1: Qualification & Gender */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              
              {/* Qualification Filter */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  🎓 Qualification / Education Level:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {[
                    { key: 'ALL', label: 'All Qualifications' },
                    { key: 'bachelor', label: 'Bachelor Degree' },
                    { key: 'master', label: 'Master Degree' },
                    { key: 'diploma', label: 'Diploma' },
                    { key: 'secondary', label: 'High School' },
                    { key: 'vocational', label: 'Vocational' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setQualificationFilter(opt.key)}
                      style={{
                        background: qualificationFilter === opt.key ? 'var(--primary)' : 'var(--bg-card)',
                        color: qualificationFilter === opt.key ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid ' + (qualificationFilter === opt.key ? 'var(--primary)' : 'var(--border-light)'),
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: qualificationFilter === opt.key ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender Filter */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  ⚥ Gender Preset:
                </label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[
                    { key: 'ALL', label: 'All Genders' },
                    { key: 'Male', label: '♂ Male Only' },
                    { key: 'Female', label: '♀ Female Only' }
                  ].map(g => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGenderFilter(g.key)}
                      style={{
                        flex: 1,
                        background: genderFilter === g.key ? '#0284c7' : 'var(--bg-card)',
                        color: genderFilter === g.key ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid ' + (genderFilter === g.key ? '#0284c7' : 'var(--border-light)'),
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: genderFilter === g.key ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Row 2: Age Range & Keyword Search */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem', alignItems: 'center' }}>
              
              {/* Age Range Preset & Custom inputs */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    🎂 Candidate Age Range:
                  </label>
                  {(customMinAge || customMaxAge) && (
                    <button
                      type="button"
                      onClick={() => { setCustomMinAge(''); setCustomMaxAge(''); }}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.68rem', cursor: 'pointer' }}
                    >
                      Clear Custom Age
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                  {[
                    { key: 'ALL', label: 'All Ages' },
                    { key: '18-25', label: '18 - 25' },
                    { key: '25-35', label: '25 - 35' },
                    { key: '35-50', label: '35 - 50' },
                    { key: '50+', label: '50+' }
                  ].map(a => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => { setAgeRangePreset(a.key); setCustomMinAge(''); setCustomMaxAge(''); }}
                      style={{
                        background: (ageRangePreset === a.key && !customMinAge && !customMaxAge) ? '#059669' : 'var(--bg-card)',
                        color: (ageRangePreset === a.key && !customMinAge && !customMaxAge) ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid ' + ((ageRangePreset === a.key && !customMinAge && !customMaxAge) ? '#059669' : 'var(--border-light)'),
                        borderRadius: '4px',
                        padding: '0.2rem 0.45rem',
                        fontSize: '0.72rem',
                        fontWeight: ageRangePreset === a.key ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {a.label}
                    </button>
                  ))}

                  {/* Custom Min/Max Age */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: 'auto' }}>
                    <input
                      type="number"
                      placeholder="Min"
                      value={customMinAge}
                      onChange={e => { setCustomMinAge(e.target.value); setAgeRangePreset('custom'); }}
                      style={{ width: '48px', padding: '0.15rem 0.25rem', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={customMaxAge}
                      onChange={e => { setCustomMaxAge(e.target.value); setAgeRangePreset('custom'); }}
                      style={{ width: '48px', padding: '0.15rem 0.25rem', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>yrs</span>
                  </div>
                </div>
              </div>

              {/* Keyword Search & Pool Scope */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  🔍 Search Candidate Name / CPR / Skills:
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Search candidate name, CPR, ref..."
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                  />
                  <select
                    className="select-control"
                    value={talentPoolScope}
                    onChange={e => setTalentPoolScope(e.target.value)}
                    style={{ width: '130px', fontSize: '0.72rem', padding: '0.3rem' }}
                  >
                    <option value="unplaced">Unplaced Pool</option>
                    <option value="all">All Talent</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Results Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.75rem 0 0.5rem 0' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Showing {filteredCandidates.length} matching candidate(s)
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={handleSelectAllMatching}
                disabled={filteredCandidates.length === 0}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
              >
                ✓ Select All Matching ({filteredCandidates.length})
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={handleClearSelection}
                disabled={selectedCandidateIds.size === 0}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                ✕ Clear Selection
              </button>
            </div>
          </div>

          {/* Candidates List */}
          <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px', background: 'var(--bg-tertiary, #f8fafc)' }}>
            {filteredCandidates.length > 0 ? (
              filteredCandidates.map(c => {
                const isSelected = selectedCandidateIds.has(c.id);
                const age = getCandidateAge(c.date_of_birth);
                const edu = c.education || c.highest_education || c.attested_degree || 'Unspecified';

                return (
                  <div
                    key={c.id}
                    onClick={() => handleToggleCandidate(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid var(--border-light)',
                      background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{c.full_name}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {c.cpr_no ? `CPR: ${c.cpr_no}` : c.ref_no}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                          <span className="badge" style={{ fontSize: '0.66rem', padding: '0.05rem 0.35rem', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
                            {c.gender === 'Female' ? '♀ Female' : '♂ Male'}
                          </span>
                          {age !== null && (
                            <span className="badge" style={{ fontSize: '0.66rem', padding: '0.05rem 0.35rem', background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
                              🎂 {age} yrs
                            </span>
                          )}
                          <span className="badge" style={{ fontSize: '0.66rem', padding: '0.05rem 0.35rem', background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' }}>
                            🎓 {edu}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ fontSize: '0.68rem', background: isSelected ? '#0284c7' : 'var(--bg-tertiary)', color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                        {isSelected ? '✓ Selected' : '+ Add'}
                      </span>
                      {c.center && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          📍 {c.center}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No candidates match the selected qualification, age, and gender presets. Try adjusting the filter criteria above.
              </div>
            )}
          </div>

          {/* Selected Candidates Summary Bar */}
          {selectedCandidatesList.length > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: 'rgba(2, 132, 199, 0.05)', border: '1px solid rgba(2, 132, 199, 0.2)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0284c7', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>👥 Selected Candidates for Interview ({selectedCandidatesList.length}):</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Click × to remove</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '70px', overflowY: 'auto' }}>
                {selectedCandidatesList.map(c => (
                  <span
                    key={c.id}
                    className="badge"
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>{c.full_name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCandidate(c.id)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, fontSize: '0.85rem', lineHeight: 1 }}
                      title="Remove candidate from interview roster"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          {selectedJob ? (
            <span>Target: <strong>{selectedJob.company_name}</strong> &bull; {selectedCandidateIds.size} Candidate(s) Assigned</span>
          ) : (
            <span style={{ color: '#dc2626' }}>* Please select a job opening</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => window.AppStore.closeModal()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSchedule}
            disabled={submitting || !selectedJobId}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📅</span> {submitting ? 'Scheduling...' : `Schedule Interview (${selectedCandidateIds.size} Candidates)`}
          </button>
        </div>
      </div>
    </div>
  );
}
// JobInterviewsModal component
function JobInterviewsModal({ state, job: initialJob, jobId: initialJobId, initialInterviewId }) {
  const { candidates = [], jobs = [], settings = {} } = state;
  const currency = settings.currency || 'BHD';

  // Detect if modal was opened for a specific job
  const isJobLocked = Boolean(initialJobId || (initialJob && initialJob.id));

  // Current Target Job (locked to specific job if opened from job, or selectable if opened globally)
  const [currentJobId, setCurrentJobId] = useState(() => {
    if (initialJobId) return String(initialJobId);
    if (initialJob?.id) return String(initialJob.id);
    return '';
  });

  const targetJob = useMemo(() => {
    if (currentJobId) {
      return (jobs || []).find(j => String(j.id) === String(currentJobId)) || initialJob || null;
    }
    return initialJob || null;
  }, [currentJobId, jobs, initialJob]);

  // Read immediately from global state store so there's zero blank screen
  const getInitialList = () => {
    const all = state.interviews || [];
    if (currentJobId) {
      return all.filter(i => Number(i.job_id) === Number(currentJobId));
    }
    return all;
  };

  const [interviews, setInterviews] = useState(getInitialList);
  const [loading, setLoading] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState(initialInterviewId ? String(initialInterviewId) : '');
  
  // Pending candidate outcomes map: { [candidateId]: { status, remarks } }
  const [candidateOutcomes, setCandidateOutcomes] = useState({});
  const [dirtyCandidateIds, setDirtyCandidateIds] = useState(new Set());
  const [savingOutcomes, setSavingOutcomes] = useState(false);

  // Toggle for inline candidate picker
  const [showAddCandidates, setShowAddCandidates] = useState(false);
  const [addQualification, setAddQualification] = useState('ALL');
  const [addAgePreset, setAddAgePreset] = useState('ALL');
  const [addGender, setAddGender] = useState('ALL');
  const [addKeyword, setAddKeyword] = useState('');
  const [selectedAddIds, setSelectedAddIds] = useState(new Set());
  const [addingCandidates, setAddingCandidates] = useState(false);

  // Fetch interviews for this job
  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    try {
      if (window.api?.interviews?.getAll) {
        const jId = currentJobId ? parseInt(currentJobId, 10) : null;
        const res = await window.api.interviews.getAll(jId ? { job_id: jId } : {});
        const list = Array.isArray(res?.interviews)
          ? res.interviews
          : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        
        // Filter by currentJobId if one is selected
        const filteredList = jId ? list.filter(i => Number(i.job_id) === Number(jId)) : list;
        setInterviews(filteredList);

        // Select the active interview
        if (filteredList.length > 0) {
          if (selectedInterviewId && filteredList.some(i => String(i.id) === String(selectedInterviewId))) {
            // Keep current
          } else if (initialInterviewId && filteredList.some(i => String(i.id) === String(initialInterviewId))) {
            setSelectedInterviewId(String(initialInterviewId));
          } else {
            setSelectedInterviewId(String(filteredList[0].id));
          }
        } else {
          setSelectedInterviewId('');
        }
      }
    } catch (err) {
      console.error('Error loading interviews:', err);
    } finally {
      setLoading(false);
    }
  }, [currentJobId, selectedInterviewId, initialInterviewId]);

  useEffect(() => {
    fetchInterviews();
  }, [currentJobId]);

  useEffect(() => {
    if (interviews.length > 0) {
      if (!selectedInterviewId || !interviews.some(i => String(i.id) === String(selectedInterviewId))) {
        if (initialInterviewId && interviews.some(i => String(i.id) === String(initialInterviewId))) {
          setSelectedInterviewId(String(initialInterviewId));
        } else {
          setSelectedInterviewId(String(interviews[0].id));
        }
      }
    } else {
      setSelectedInterviewId('');
    }
  }, [interviews, initialInterviewId]);

  // Active Interview Session
  const activeSession = useMemo(() => {
    if (!selectedInterviewId) return interviews[0] || null;
    return interviews.find(i => String(i.id) === String(selectedInterviewId)) || interviews[0] || null;
  }, [interviews, selectedInterviewId]);

  // Candidates in active session
  const sessionCandidates = useMemo(() => {
    return activeSession?.candidates || [];
  }, [activeSession]);

  // Initialize outcomes map when session changes
  useEffect(() => {
    if (sessionCandidates && sessionCandidates.length > 0) {
      const map = {};
      sessionCandidates.forEach(c => {
        const cId = c.candidate_id || c.id;
        map[cId] = {
          status: c.candidate_status || c.status || 'scheduled',
          remarks: c.candidate_remarks || c.remarks || ''
        };
      });
      setCandidateOutcomes(map);
      setDirtyCandidateIds(new Set());
    } else {
      setCandidateOutcomes({});
      setDirtyCandidateIds(new Set());
    }
  }, [activeSession?.id, sessionCandidates]);

  // Helper for age
  const getCandidateAge = (dob) => {
    if (window.calculateAge) {
      const a = window.calculateAge(dob);
      if (a !== null && !isNaN(a)) return a;
    }
    if (!dob) return null;
    try {
      const birth = new Date(dob);
      if (isNaN(birth.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age >= 0 ? age : null;
    } catch (e) {
      return null;
    }
  };

  // Status badge styling helper
  const getStatusBadge = (st) => {
    const s = String(st || 'scheduled').toLowerCase();
    switch (s) {
      case 'passed':
      case 'selected':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#059669', label: '⭐ Passed (Selected)' };
      case 'attended':
      case 'present':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', label: '✓ Attended' };
      case 'rejected':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', label: '✕ Rejected' };
      case 'absent':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706', label: '⚠️ Absent' };
      case 'scheduled':
      default:
        return { bg: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', label: '📅 Scheduled' };
    }
  };

  // Recommended evaluation remarks presets based on outcome status
  const getRemarkPresets = (st) => {
    const s = String(st || 'scheduled').toLowerCase();
    switch (s) {
      case 'passed':
      case 'selected':
        return [
          'Candidate demonstrated strong technical competency and recommended for job placement.',
          'Strong domain knowledge, great communication skills, and relevant experience.',
          'Candidate selected based on qualification, interview performance, and role fit.'
        ];
      case 'rejected':
        return [
          'Candidate does not meet required experience / qualifications for this position.',
          'Lacks required domain knowledge and core technical competencies.',
          'Unsuccessful in interview assessment; retained in general talent pool.'
        ];
      case 'attended':
      case 'present':
        return [
          'Candidate attended interview on time; panel evaluation under final review.',
          'Initial interview screening completed; awaiting secondary assessment decision.',
          'Attended interview session; submitted credentials and certificates for verification.'
        ];
      case 'absent':
        return [
          'Candidate failed to attend scheduled interview session without prior notice (No Show).',
          'Candidate requested reschedule due to emergency / personal circumstances.',
          'Candidate unreachable by phone and email during scheduled interview window.'
        ];
      case 'scheduled':
      default:
        return [
          'Candidate scheduled for interview session; instructions and venue details confirmed.',
          'Interview scheduled; pending candidate attendance.'
        ];
    }
  };

  // Prompt dialog for mandatory evaluation remarks when changing candidate status
  const promptForEvaluationRemarks = async (candidate, targetStatus, currentRemarks) => {
    const cName = candidate.full_name || 'Candidate';
    const cpr = candidate.cpr_no ? `CPR: ${candidate.cpr_no}` : (candidate.ref_no || '');
    const badge = getStatusBadge(targetStatus);
    const presets = getRemarkPresets(targetStatus);
    const defaultText = (currentRemarks && currentRemarks.trim()) ? currentRemarks : (presets[0] || '');

    const swal = window.Swal || window.swal;
    if (!swal) {
      const entered = window.prompt(
        `Please enter the evaluation remarks for ${cName} [Outcome: ${badge.label}]:`,
        defaultText
      );
      if (entered === null) return null; // Cancelled
      const trimmed = entered.trim();
      return trimmed || defaultText;
    }

    const htmlContent = `
      <div style="text-align: left; font-size: 0.85rem; color: #334155;">
        <div style="margin-bottom: 12px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #0f172a; font-size: 0.95rem;">${cName}</strong>
            <span style="font-family: monospace; font-size: 0.78rem; color: #64748b;">${cpr}</span>
          </div>
          <div style="font-size: 0.8rem; color: #64748b;">
            Outcome Status: <strong style="color: ${badge.color};">${badge.label}</strong>
          </div>
        </div>

        <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.82rem; color: #1e293b;">
          Evaluation Remarks / Interview Feedback: <span style="color: #dc2626;">*</span>
        </label>
        <textarea id="swal-eval-remarks" class="swal2-textarea" 
          style="width: 100%; min-height: 85px; margin: 0; padding: 8px 10px; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; box-sizing: border-box;"
          placeholder="Enter interview feedback, score, reason for outcome decision..."
        >${defaultText}</textarea>

        <div style="margin-top: 10px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em;">
            💡 Quick Remark Presets (Click to Insert):
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${presets.map((p) => `
              <button type="button" 
                class="swal-preset-btn"
                data-preset="${p.replace(/"/g, '&quot;')}"
                style="text-align: left; background: #ffffff; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 5px; font-size: 0.76rem; color: #334155; cursor: pointer; transition: all 0.15s ease;"
                onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#94a3b8';"
                onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1';"
              >
                • ${p}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const result = await swal.fire({
      title: `<span style="font-size: 1.15rem; font-weight: 800;">Candidate Evaluation Remarks</span>`,
      html: htmlContent,
      showCancelButton: true,
      confirmButtonText: '✓ Save Outcome & Remarks',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#64748b',
      width: '560px',
      didOpen: () => {
        const textarea = document.getElementById('swal-eval-remarks');
        if (textarea) {
          textarea.focus();
        }
        const presetBtns = document.querySelectorAll('.swal-preset-btn');
        presetBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-preset');
            if (textarea && val) {
              textarea.value = val;
              textarea.focus();
            }
          });
        });
      },
      preConfirm: () => {
        const textarea = document.getElementById('swal-eval-remarks');
        const val = textarea ? textarea.value.trim() : '';
        if (!val) {
          swal.showValidationMessage('Evaluation remarks are required when updating candidate outcome status');
          return false;
        }
        return val;
      }
    });

    if (result.isConfirmed) {
      return result.value;
    }
    return null; // Cancelled
  };

  // Outcome status change: prompt for mandatory evaluation remarks and auto-save
  const handleStatusChange = async (candidateId, newStatus) => {
    const cand = sessionCandidates.find(c => String(c.candidate_id || c.id) === String(candidateId)) || {};
    const oldOutcome = candidateOutcomes[candidateId] || {
      status: cand.candidate_status || cand.status || 'scheduled',
      remarks: cand.candidate_remarks || cand.remarks || ''
    };

    // If same status, do nothing
    if (oldOutcome.status === newStatus && oldOutcome.remarks) return;

    // Prompt for evaluation remarks with presets
    const enteredRemarks = await promptForEvaluationRemarks(cand, newStatus, oldOutcome.remarks);

    // If cancelled, keep old status (do NOT change status without evaluation remarks)
    if (enteredRemarks === null) {
      return;
    }

    // Update outcome with new status and remarks
    setCandidateOutcomes(prev => ({
      ...prev,
      [candidateId]: {
        status: newStatus,
        remarks: enteredRemarks
      }
    }));

    // Auto-save immediately to server for immediate persistence
    if (activeSession?.id && window.api?.interviews?.updateCandidateOutcome) {
      try {
        await window.api.interviews.updateCandidateOutcome(activeSession.id, candidateId, {
          status: newStatus,
          remarks: enteredRemarks
        });
        if (window.AppStore?.showToast) {
          window.AppStore.showToast(`✓ Evaluation saved for ${cand.full_name || 'Candidate'}: ${getStatusBadge(newStatus).label}`, 'success');
        }
        setDirtyCandidateIds(prev => {
          const next = new Set(prev);
          next.delete(candidateId);
          return next;
        });
        await fetchInterviews();
        await window.AppStore.refreshData();
      } catch (err) {
        console.error('Error auto-saving outcome:', err);
        setDirtyCandidateIds(prev => new Set(prev).add(candidateId));
      }
    } else {
      setDirtyCandidateIds(prev => new Set(prev).add(candidateId));
    }
  };

  // Open dialog to edit remarks directly
  const handleOpenRemarksDialog = async (candidate) => {
    const cId = candidate.candidate_id || candidate.id;
    const currentOutcome = candidateOutcomes[cId] || {
      status: candidate.candidate_status || candidate.status || 'scheduled',
      remarks: candidate.candidate_remarks || candidate.remarks || ''
    };

    const enteredRemarks = await promptForEvaluationRemarks(candidate, currentOutcome.status, currentOutcome.remarks);
    if (enteredRemarks === null) return;

    setCandidateOutcomes(prev => ({
      ...prev,
      [cId]: {
        status: currentOutcome.status,
        remarks: enteredRemarks
      }
    }));

    if (activeSession?.id && window.api?.interviews?.updateCandidateOutcome) {
      try {
        await window.api.interviews.updateCandidateOutcome(activeSession.id, cId, {
          status: currentOutcome.status,
          remarks: enteredRemarks
        });
        if (window.AppStore?.showToast) {
          window.AppStore.showToast(`✓ Evaluation remarks updated for ${candidate.full_name || 'Candidate'}`, 'success');
        }
        setDirtyCandidateIds(prev => {
          const next = new Set(prev);
          next.delete(cId);
          return next;
        });
        await fetchInterviews();
        await window.AppStore.refreshData();
      } catch (err) {
        console.error('Error saving remarks:', err);
        setDirtyCandidateIds(prev => new Set(prev).add(cId));
      }
    } else {
      setDirtyCandidateIds(prev => new Set(prev).add(cId));
    }
  };

  const handleRemarksChange = (candidateId, newRemarks) => {
    setCandidateOutcomes(prev => ({
      ...prev,
      [candidateId]: {
        ...(prev[candidateId] || {}),
        remarks: newRemarks
      }
    }));
    setDirtyCandidateIds(prev => new Set(prev).add(candidateId));
  };

  // Save all changed outcomes with mandatory remarks check
  const handleSaveOutcomes = async () => {
    if (dirtyCandidateIds.size === 0) return;

    // Validate that evaluation remarks are provided
    for (const cId of Array.from(dirtyCandidateIds)) {
      const item = candidateOutcomes[cId];
      if (item && (!item.remarks || !item.remarks.trim())) {
        const cand = sessionCandidates.find(c => String(c.candidate_id || c.id) === String(cId));
        if (window.AppStore?.showToast) {
          window.AppStore.showToast(`Evaluation remarks are required for ${cand?.full_name || 'candidate'}`, 'error');
        }
        return;
      }
    }

    setSavingOutcomes(true);
    try {
      const interviewId = activeSession?.id;
      for (const cId of Array.from(dirtyCandidateIds)) {
        const item = candidateOutcomes[cId];
        if (item) {
          await window.api.interviews.updateCandidateOutcome(interviewId, cId, {
            status: item.status,
            remarks: item.remarks
          });
        }
      }
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`✓ Evaluation outcomes updated for ${dirtyCandidateIds.size} candidate(s)!`, 'success');
      }
      setDirtyCandidateIds(new Set());
      await fetchInterviews();
      await window.AppStore.refreshData();
    } catch (err) {
      console.error('Error saving outcomes:', err);
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`Error saving outcomes: ${err.message}`, 'error');
      }
    } finally {
      setSavingOutcomes(false);
    }
  };

  // Direct Placement initiated from interview
  const handlePlaceCandidate = async (candidate) => {
    const cId = candidate.candidate_id || candidate.id;
    const cName = candidate.full_name || 'Candidate';
    const jTitle = targetJob?.job_title || 'Position';
    const cCompany = targetJob?.company_name || 'Employer';

    if (!window.confirm(`Initiate official placement for ${cName} as "${jTitle}" at ${cCompany}? This will link the candidate to this job and record the placement.`)) {
      return;
    }

    try {
      const outcome = candidateOutcomes[cId] || {};
      const res = await window.api.interviews.placeCandidate(activeSession.id, cId, {
        remarks: outcome.remarks || 'Selected and placed following interview'
      });
      if (res && res.success !== false) {
        if (window.AppStore?.showToast) {
          window.AppStore.showToast(`🎉 ${cName} successfully placed in ${cCompany}!`, 'success');
        }
        await fetchInterviews();
        await window.AppStore.refreshData();
      }
    } catch (err) {
      console.error('Error placing candidate:', err);
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`Error placing candidate: ${err.message}`, 'error');
      }
    }
  };

  // Remove candidate from session
  const handleRemoveCandidate = async (candidateId, candidateName) => {
    if (!window.confirm(`Remove ${candidateName || 'candidate'} from this interview session roster?`)) return;
    try {
      await window.api.interviews.removeCandidate(activeSession.id, candidateId);
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`Candidate removed from interview session.`, 'info');
      }
      await fetchInterviews();
      await window.AppStore.refreshData();
    } catch (err) {
      console.error('Error removing candidate:', err);
    }
  };

  // Update session status (e.g. mark completed)
  const handleUpdateSessionStatus = async (newStatus) => {
    if (!activeSession) return;
    try {
      await window.api.interviews.update(activeSession.id, {
        status: newStatus
      });
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`Interview session marked as ${newStatus}`, 'success');
      }
      await fetchInterviews();
      await window.AppStore.refreshData();
    } catch (err) {
      console.error('Error updating session status:', err);
    }
  };

  // Candidates available to add to this session (excluding already rostered)
  const rosteredCandidateIds = useMemo(() => {
    return new Set(sessionCandidates.map(c => c.candidate_id || c.id));
  }, [sessionCandidates]);

  const candidatesAvailableToAdd = useMemo(() => {
    return (candidates || []).filter(c => {
      if (rosteredCandidateIds.has(c.id)) return false;
      
      // Qualification matching
      if (addQualification !== 'ALL') {
        const str = `${c.education || ''} ${c.highest_education || ''} ${c.attested_degree || ''}`.toLowerCase();
        if (addQualification === 'bachelor' && !str.includes('bachelor') && !str.includes('bsc') && !str.includes('ba')) return false;
        if (addQualification === 'master' && !str.includes('master') && !str.includes('msc') && !str.includes('mba')) return false;
        if (addQualification === 'diploma' && !str.includes('diploma') && !str.includes('associate')) return false;
        if (addQualification === 'secondary' && !str.includes('high school') && !str.includes('secondary')) return false;
      }

      // Gender matching
      if (addGender !== 'ALL') {
        const g = (c.gender || '').toLowerCase();
        if (addGender.toLowerCase() === 'male' && g !== 'male' && g !== 'm') return false;
        if (addGender.toLowerCase() === 'female' && g !== 'female' && g !== 'f') return false;
      }

      // Age matching
      if (addAgePreset !== 'ALL') {
        const age = getCandidateAge(c.date_of_birth);
        if (age === null) return false;
        if (addAgePreset === '18-25' && (age < 18 || age > 25)) return false;
        if (addAgePreset === '25-35' && (age < 25 || age > 35)) return false;
        if (addAgePreset === '35-50' && (age < 35 || age > 50)) return false;
        if (addAgePreset === '50+' && age < 50) return false;
      }

      // Keyword matching
      if (addKeyword.trim()) {
        const q = addKeyword.toLowerCase().trim();
        const str = `${c.full_name || ''} ${c.cpr_no || ''} ${c.ref_no || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [candidates, rosteredCandidateIds, addQualification, addGender, addAgePreset, addKeyword]);

  // Batch add candidates
  const handleBatchAddCandidates = async () => {
    if (selectedAddIds.size === 0) return;
    setAddingCandidates(true);
    try {
      await window.api.interviews.addCandidatesBatch(activeSession.id, Array.from(selectedAddIds));
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`✓ Added ${selectedAddIds.size} candidate(s) to this interview session!`, 'success');
      }
      setSelectedAddIds(new Set());
      setShowAddCandidates(false);
      await fetchInterviews();
      await window.AppStore.refreshData();
    } catch (err) {
      console.error('Error adding candidates to interview:', err);
      if (window.AppStore?.showToast) {
        window.AppStore.showToast(`Error adding candidates: ${err.message}`, 'error');
      }
    } finally {
      setAddingCandidates(false);
    }
  };

  return (
    <div className="modal-content" style={{ maxWidth: '1060px', width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🤝</span> Job Interviews & Evaluation
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Track scheduled interview sessions, evaluate candidate outcomes (Attended, Passed, Rejected, Absent), and initiate direct placements.
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={() => window.AppStore.closeModal()}
          style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Target Job Header Card (Single, locked when clicked from a job; or dropdown switcher when opened globally) */}
        {isJobLocked ? (
          /* Locked Job Summary Card - Clean, unified, NO dropdown */
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(59, 130, 246, 0.02) 100%)',
            border: '1px solid rgba(2, 132, 199, 0.22)',
            borderRadius: '10px',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
              }}>
                🏢
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {targetJob?.company_name || 'Employer'}
                  </span>
                  <span className="badge" style={{
                    background: 'rgba(2, 132, 199, 0.12)',
                    color: '#0284c7',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px'
                  }}>
                    {targetJob?.job_code || `JOB-${targetJob?.id || currentJobId}`}
                  </span>
                  <span className="badge" style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#059669',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px'
                  }}>
                    🔒 Target Job Opening
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.86rem' }}>{targetJob?.job_title || 'Position'}</strong>
                  <span>&bull;</span>
                  <span>Wage: <strong style={{ color: '#059669' }}>{currency} {Number(targetJob?.salary_offered_bhd || 500).toFixed(3)}</strong></span>
                  <span>&bull;</span>
                  <span>Open: <strong style={{ color: '#0284c7' }}>{targetJob?.vacancies_remaining ?? targetJob?.vacancies_count ?? 1} Vacanc{((targetJob?.vacancies_remaining ?? targetJob?.vacancies_count ?? 1) === 1) ? 'y' : 'ies'}</strong></span>
                  <span>&bull;</span>
                  <span>Dept: <strong>{targetJob?.department || 'Operations'}</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  padding: '0.4rem 0.85rem',
                  fontWeight: 600,
                  boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)'
                }}
                onClick={() => window.AppStore.openModal('SCHEDULE_INTERVIEW', { job: targetJob, jobId: currentJobId })}
              >
                <span>➕</span> Schedule Another Session
              </button>
            </div>
          </div>
        ) : (
          /* Global View: Job Selection / Switcher Bar */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🏢 Filter by Job Opening:
                  </span>
                </div>
                <select
                  className="select-control"
                  style={{ width: '100%', fontSize: '0.84rem', fontWeight: 600 }}
                  value={currentJobId}
                  onChange={e => {
                    setCurrentJobId(e.target.value);
                    setSelectedInterviewId('');
                  }}
                >
                  <option value="">-- All Job Openings ({(state.interviews || []).length} Scheduled Sessions) --</option>
                  {(jobs || []).map(j => {
                    const count = (state.interviews || []).filter(i => Number(i.job_id) === Number(j.id)).length;
                    return (
                      <option key={j.id} value={String(j.id)}>
                        {j.company_name} — {j.job_title} ({j.job_code || `JOB-${j.id}`}) • {count} session(s)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: '#0284c7', color: '#0284c7' }}
                  onClick={() => window.AppStore.openModal('SCHEDULE_INTERVIEW', { job: targetJob, jobId: currentJobId })}
                >
                  <span>➕</span> Schedule Another Session
                </button>
              </div>
            </div>

            {targetJob && (
              <div style={{ background: 'var(--bg-tertiary, #f8fafc)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.65rem 0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{targetJob.company_name}</strong> &bull; {targetJob.job_title} &bull; <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{targetJob.job_code || `JOB-${targetJob.id}`}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                  <span>Wage: <strong style={{ color: 'var(--success)' }}>{currency} {Number(targetJob.salary_offered_bhd || 500).toFixed(3)}</strong></span>
                  <span>Open: <strong style={{ color: 'var(--primary)' }}>{targetJob.vacancies_remaining || targetJob.vacancies_count || 1}</strong></span>
                  <span>Dept: <strong>{targetJob.department || 'Operations'}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sessions Tab / Selector */}
        {interviews.length > 0 ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.45rem', borderBottom: '1px solid var(--border-light)' }}>
              {interviews.map((session, idx) => {
                const isSelected = activeSession && String(activeSession.id) === String(session.id);
                const candCount = session.candidates_count || (session.candidates ? session.candidates.length : 0);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => { setSelectedInterviewId(String(session.id)); setShowAddCandidates(false); }}
                    style={{
                      background: isSelected ? 'var(--primary, #0284c7)' : 'var(--bg-card, #ffffff)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      border: '1px solid ' + (isSelected ? 'var(--primary, #0284c7)' : 'var(--border-light)'),
                      borderRadius: '6px',
                      padding: '0.42rem 0.8rem',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: isSelected ? '0 1px 3px rgba(2, 132, 199, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🤝</span>
                    <span>{session.interview_code || `INT-${idx + 1}`}</span>
                    {!currentJobId && session.company_name && (
                      <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>• {session.company_name}</span>
                    )}
                    <span style={{ fontSize: '0.7rem', opacity: isSelected ? 0.9 : 0.75 }}>
                      ({window.formatAppDate ? window.formatAppDate(session.interview_date) : session.interview_date})
                    </span>
                    <span className="badge" style={{
                      fontSize: '0.66rem',
                      padding: '0.08rem 0.4rem',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
                      color: isSelected ? '#ffffff' : 'var(--text-primary)',
                      fontWeight: 700
                    }}>
                      {candCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Session Card */}
            {activeSession && (
              <div style={{ marginTop: '0.75rem', background: 'var(--bg-tertiary, #f8fafc)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.9rem 1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 800, padding: '0.2rem 0.55rem' }}>
                      {activeSession.interview_code}
                    </span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      📅 {window.formatAppDate ? window.formatAppDate(activeSession.interview_date) : activeSession.interview_date} at {activeSession.interview_time || '10:00 AM'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      &bull; 📍 {activeSession.location || 'Main Office'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <select
                      className="select-control"
                      value={activeSession.status || 'scheduled'}
                      onChange={e => handleUpdateSessionStatus(e.target.value)}
                      style={{ fontSize: '0.76rem', padding: '0.2rem 0.55rem', height: '32px', fontWeight: 600, borderRadius: '6px' }}
                    >
                      <option value="scheduled">Status: Scheduled</option>
                      <option value="in_progress">Status: In Progress</option>
                      <option value="completed">Status: Completed</option>
                      <option value="cancelled">Status: Cancelled</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setShowAddCandidates(!showAddCandidates)}
                      style={{ fontSize: '0.76rem', padding: '0.2rem 0.65rem', height: '32px', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, borderRadius: '6px' }}
                    >
                      <span>{showAddCandidates ? '✕ Close Panel' : '➕ Add Candidates'}</span>
                    </button>
                  </div>
                </div>

                {/* Session Remarks / Instructions Callout */}
                {activeSession.remarks && (
                  <div style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-card, #ffffff)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    marginBottom: '0.65rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.45rem',
                    lineHeight: 1.4
                  }}>
                    <span>📝</span>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>Instructions / Remarks:</strong>{' '}
                      <span>{activeSession.remarks}</span>
                    </div>
                  </div>
                )}

                {/* Metric Summary Counters - Uniform 6-Column Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: '0.5rem',
                  marginTop: '0.75rem'
                }}>
                  {/* Total Roster */}
                  <div style={{
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #64748b',
                    borderRadius: '6px',
                    padding: '0.5rem 0.4rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                      Total Roster
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem', lineHeight: 1.15 }}>
                      {sessionCandidates.length}
                    </div>
                  </div>

                  {/* Passed */}
                  <div style={{
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #059669',
                    borderRadius: '6px',
                    padding: '0.5rem 0.4rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.66rem', color: '#059669', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                      ⭐ Passed
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '0.15rem', lineHeight: 1.15 }}>
                      {sessionCandidates.filter(c => (candidateOutcomes[c.candidate_id || c.id]?.status || c.candidate_status) === 'passed').length}
                    </div>
                  </div>

                  {/* Attended */}
                  <div style={{
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #2563eb',
                    borderRadius: '6px',
                    padding: '0.5rem 0.4rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.66rem', color: '#2563eb', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                      ✓ Attended
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', marginTop: '0.15rem', lineHeight: 1.15 }}>
                      {sessionCandidates.filter(c => (candidateOutcomes[c.candidate_id || c.id]?.status || c.candidate_status) === 'attended').length}
                    </div>
                  </div>

                  {/* Rejected */}
                  <div style={{
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #dc2626',
                    borderRadius: '6px',
                    padding: '0.5rem 0.4rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.66rem', color: '#dc2626', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                      ✕ Rejected
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626', marginTop: '0.15rem', lineHeight: 1.15 }}>
                      {sessionCandidates.filter(c => (candidateOutcomes[c.candidate_id || c.id]?.status || c.candidate_status) === 'rejected').length}
                    </div>
                  </div>

                  {/* Absent */}
                  <div style={{
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #d97706',
                    borderRadius: '6px',
                    padding: '0.5rem 0.4rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.66rem', color: '#d97706', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                      ⚠️ Absent
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '0.15rem', lineHeight: 1.15 }}>
                      {sessionCandidates.filter(c => (candidateOutcomes[c.candidate_id || c.id]?.status || c.candidate_status) === 'absent').length}
                    </div>
                  </div>

                  {/* Scheduled */}
                  <div style={{
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #0284c7',
                    borderRadius: '6px',
                    padding: '0.5rem 0.4rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.66rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                      📅 Scheduled
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '0.15rem', lineHeight: 1.15 }}>
                      {sessionCandidates.filter(c => {
                        const st = candidateOutcomes[c.candidate_id || c.id]?.status || c.candidate_status || 'scheduled';
                        return st === 'scheduled' || !st;
                      }).length}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Add Candidates Panel (If opened) */}
            {showAddCandidates && (
              <div style={{ background: 'var(--bg-card)', border: '2px dashed var(--primary)', borderRadius: '8px', padding: '1rem', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>➕</span> Add More Candidates via Qualification, Age & Gender Presets
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCandidates(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Filter controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Qualification:</label>
                    <select
                      className="select-control"
                      value={addQualification}
                      onChange={e => setAddQualification(e.target.value)}
                      style={{ width: '100%', fontSize: '0.75rem' }}
                    >
                      <option value="ALL">All Qualifications</option>
                      <option value="bachelor">Bachelor Degree</option>
                      <option value="master">Master Degree</option>
                      <option value="diploma">Diploma</option>
                      <option value="secondary">High School</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Age Preset:</label>
                    <select
                      className="select-control"
                      value={addAgePreset}
                      onChange={e => setAddAgePreset(e.target.value)}
                      style={{ width: '100%', fontSize: '0.75rem' }}
                    >
                      <option value="ALL">All Ages</option>
                      <option value="18-25">18 - 25 yrs</option>
                      <option value="25-35">25 - 35 yrs</option>
                      <option value="35-50">35 - 50 yrs</option>
                      <option value="50+">50+ yrs</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Gender:</label>
                    <select
                      className="select-control"
                      value={addGender}
                      onChange={e => setAddGender(e.target.value)}
                      style={{ width: '100%', fontSize: '0.75rem' }}
                    >
                      <option value="ALL">All Genders</option>
                      <option value="Male">Male Only</option>
                      <option value="Female">Female Only</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Search Name / CPR:</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Search name, CPR..."
                      value={addKeyword}
                      onChange={e => setAddKeyword(e.target.value)}
                      style={{ width: '100%', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                    />
                  </div>
                </div>

                {/* Candidate list to pick */}
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px', background: 'var(--bg-tertiary)' }}>
                  {candidatesAvailableToAdd.length > 0 ? (
                    candidatesAvailableToAdd.map(c => {
                      const isSel = selectedAddIds.has(c.id);
                      const age = getCandidateAge(c.date_of_birth);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedAddIds(prev => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.75rem',
                            borderBottom: '1px solid var(--border-light)',
                            background: isSel ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-card)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <input type="checkbox" checked={isSel} onChange={() => {}} style={{ cursor: 'pointer' }} />
                            <div>
                              <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.full_name}</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.4rem', fontFamily: 'var(--font-mono)' }}>CPR: {c.cpr_no || c.ref_no}</span>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                                {c.gender} &bull; {age !== null ? `${age} yrs` : 'Age N/A'} &bull; {c.education || 'High School'}
                              </div>
                            </div>
                          </div>
                          <span className="badge" style={{ fontSize: '0.7rem', background: isSel ? '#0284c7' : 'var(--bg-tertiary)', color: isSel ? '#fff' : 'var(--text-secondary)' }}>
                            {isSel ? '✓ Selected' : '+ Add'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                      No un-rostered candidates match criteria.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowAddCandidates(false)}
                    style={{ fontSize: '0.74rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleBatchAddCandidates}
                    disabled={addingCandidates || selectedAddIds.size === 0}
                    style={{ fontSize: '0.74rem' }}
                  >
                    {addingCandidates ? 'Adding...' : `Add Selected (${selectedAddIds.size}) to Interview`}
                  </button>
                </div>
              </div>
            )}

            {/* Candidate Roster Table */}
            <div style={{ marginTop: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>📋</span> Candidate Evaluation & Outcomes ({sessionCandidates.length})
                </div>

                {dirtyCandidateIds.size > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleSaveOutcomes}
                    disabled={savingOutcomes}
                    style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '32px' }}
                  >
                    <span>💾</span> {savingOutcomes ? 'Saving...' : `Save ${dirtyCandidateIds.size} Changes`}
                  </button>
                )}
              </div>

              <div className="table-responsive" style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table" style={{ margin: 0, fontSize: '0.8rem', width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                      <th style={{ width: '42px', padding: '0.65rem 0.5rem', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '0.65rem 0.75rem', minWidth: '175px' }}>Candidate</th>
                      <th style={{ padding: '0.65rem 0.75rem', minWidth: '175px' }}>Demographics & Education</th>
                      <th style={{ padding: '0.65rem 0.75rem', width: '195px' }}>Interview Status / Outcome</th>
                      <th style={{ padding: '0.65rem 0.75rem', minWidth: '200px' }}>Evaluation Remarks / Feedback</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '130px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionCandidates.length > 0 ? (
                      sessionCandidates.map((c, idx) => {
                        const cId = c.candidate_id || c.id;
                        const outcome = candidateOutcomes[cId] || {
                          status: c.candidate_status || c.status || 'scheduled',
                          remarks: c.candidate_remarks || c.remarks || ''
                        };
                        const isDirty = dirtyCandidateIds.has(cId);
                        const age = getCandidateAge(c.date_of_birth);
                        const edu = c.education || c.highest_education || c.attested_degree || 'Unspecified';
                        const isPassed = outcome.status === 'passed';
                        
                        // Check if candidate is already placed in this job or another job
                        const candidateObj = (candidates || []).find(cand => Number(cand.id) === Number(cId)) || c;
                        const isCandidatePlaced = candidateObj?.status === 'placed' || (candidateObj?.job_id && Number(candidateObj.job_id) === Number(targetJob?.id));

                        return (
                          <tr key={cId || idx} style={{ background: isDirty ? 'rgba(254, 243, 199, 0.25)' : undefined }}>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                              {idx + 1}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.full_name}</strong>
                                {isCandidatePlaced && (
                                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontSize: '0.66rem', fontWeight: 700, padding: '0.1rem 0.35rem' }}>
                                    ✓ Placed
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                                {c.cpr_no ? `CPR: ${c.cpr_no}` : (c.ref_no || '')}
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                  {c.gender === 'Female' ? '♀ Female' : '♂ Male'} &bull; {age !== null ? `🎂 ${age} yrs` : 'Age N/A'}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span>🎓</span>
                                  <span style={{ fontWeight: 600 }}>{edu}</span>
                                </span>
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <select
                                className="select-control"
                                value={outcome.status}
                                onChange={e => handleStatusChange(cId, e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '34px',
                                  fontSize: '0.78rem',
                                  padding: '0.2rem 0.5rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  background: getStatusBadge(outcome.status).bg,
                                  color: getStatusBadge(outcome.status).color,
                                  borderColor: getStatusBadge(outcome.status).color
                                }}
                              >
                                <option value="scheduled">📅 Scheduled</option>
                                <option value="attended">✓ Attended</option>
                                <option value="passed">⭐ Passed (Selected)</option>
                                <option value="rejected">✕ Rejected</option>
                                <option value="absent">⚠️ Absent / No Show</option>
                              </select>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <input
                                  type="text"
                                  className="input-control"
                                  placeholder="Click 📝 or enter evaluation feedback..."
                                  value={outcome.remarks}
                                  onChange={e => handleRemarksChange(cId, e.target.value)}
                                  style={{ flex: 1, height: '34px', fontSize: '0.8rem', padding: '0 0.65rem', borderRadius: '6px' }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline"
                                  onClick={() => handleOpenRemarksDialog(c)}
                                  title="Open Evaluation Remarks Presets & Editor"
                                  style={{
                                    height: '34px',
                                    padding: '0 0.55rem',
                                    fontSize: '0.78rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#0284c7',
                                    borderColor: 'var(--border-light)',
                                    borderRadius: '6px',
                                    flexShrink: 0
                                  }}
                                >
                                  <span>📝</span>
                                </button>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                {isPassed && (
                                  isCandidatePlaced ? (
                                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                      ✓ Placed
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handlePlaceCandidate(c)}
                                      title="Directly Place Candidate in this Job Opening"
                                      style={{
                                        fontSize: '0.72rem',
                                        height: '30px',
                                        padding: '0 0.55rem',
                                        background: '#059669',
                                        borderColor: '#059669',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontWeight: 700,
                                        borderRadius: '5px'
                                      }}
                                    >
                                      <span>💼</span> Place
                                    </button>
                                  )
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline"
                                  onClick={() => handleRemoveCandidate(cId, c.full_name)}
                                  title="Remove candidate from interview session"
                                  style={{
                                    fontSize: '0.75rem',
                                    height: '30px',
                                    width: '30px',
                                    padding: 0,
                                    color: '#dc2626',
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '5px'
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                          No candidates added to this interview session yet. Click <strong>➕ Add Candidates</strong> above to add candidates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px dashed var(--border-light)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🤝</div>
            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>No Interview Sessions Yet</h4>
            <p style={{ margin: '0.3rem 0 1rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              There are no interviews scheduled for this job vacancy opening yet.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => window.AppStore.openModal('SCHEDULE_INTERVIEW', { job: targetJob, jobId: currentJobId })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>📅</span> Schedule First Interview Session
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {dirtyCandidateIds.size > 0 ? (
            <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ {dirtyCandidateIds.size} unsaved outcome changes</span>
          ) : (
            <span style={{ color: '#059669', fontWeight: 500 }}>✓ All interview outcomes synchronized</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {dirtyCandidateIds.size > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveOutcomes}
              disabled={savingOutcomes}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>💾</span> {savingOutcomes ? 'Saving...' : `Save All Outcomes (${dirtyCandidateIds.size})`}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => window.AppStore.closeModal()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


window.Modals = Modals;
