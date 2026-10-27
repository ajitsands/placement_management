/**
 * Modal System Component
 * Handles interactive dialogs for Candidate Registration, Placement Linking, Status Management,
 * Multiple Document Uploads, Manual Claim Entry, Payment Receipts, Disputes, and Candidate Timelines
 */

const { useState, useEffect, useMemo } = React;

function Modals({ state }) {
  const { modal, candidates, claims, caseManagers, currentUser, settings } = state;
  if (!modal) return null;

  const { type, props } = modal;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) window.AppStore.closeModal(); }}>
      {type === 'NEW_CANDIDATE' && <NewCandidateModal state={state} />}
      {type === 'LINK_PLACEMENT' && <LinkPlacementModal state={state} candidate={props?.candidate} />}
      {type === 'UPDATE_STATUS' && <UpdateStatusModal state={state} candidate={props?.candidate} />}
      {type === 'CANDIDATE_DOCUMENTS' && <CandidateDocumentsModal state={state} candidate={props?.candidate} />}
      {type === 'CANDIDATE_DETAIL' && <CandidateDetailModal state={state} candidate={props?.candidate} />}
      {type === 'NEW_CLAIM' && <NewClaimModal state={state} initialProps={props} />}
      {type === 'NEW_PAYMENT' && <NewPaymentModal state={state} initialProps={props} />}
      {type === 'NEW_DISPUTE' && <NewDisputeModal state={state} initialProps={props} />}
      {type === 'DISPUTE_DETAILS' && <DisputeDetailsModal state={state} initialProps={props} />}
      {type === 'EDIT_USER' && <EditUserModal state={state} user={props?.user} />}
      {type === 'EDIT_CLAIM_AMOUNT' && <EditClaimAmountModal state={state} milestone={props?.milestone} claim={props?.claim} />}
      {(type === 'SANDS_PROFILE' || type === 'PRODUCTS_SHOWCASE') && <SandsCompanyProfileModal state={state} />}
    </div>
  );
}

// 1. New Candidate Registration Modal with Multiple Document Upload & Optional Placement Linker
function NewCandidateModal({ state }) {
  const { currentUser, caseManagers, settings } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const currency = settings.currency || 'BHD';

  // Candidate Registration Parameters
  const [form, setForm] = useState({
    ref_no: '',
    full_name: '',
    cpr_no: '',
    gender: 'Male',
    education: 'Bachelor Degree',
    registration_date: new Date().toISOString().split('T')[0],
    remarks: '',
    status: 'registered',
    case_manager_name: currentUser.role === 'case_manager' 
      ? (currentUser.case_manager_code || currentUser.full_name) 
      : (caseManagers[0]?.case_manager_code || 'Husain')
  });

  const [autoRefHint, setAutoRefHint] = useState('');

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

  // Multiple Document Upload Area State
  const [documents, setDocuments] = useState([]);
  const [uploadDocType, setUploadDocType] = useState('CPR / Smart Card Copy');
  const [uploadDocName, setUploadDocName] = useState('');

  // Placement Linker Toggle State
  const [linkPlacementNow, setLinkPlacementNow] = useState(false);
  const [placementForm, setPlacementForm] = useState({
    company_name: '',
    employer_cr: '',
    employee_type: 'Full-Time',
    position_title: 'Specialist',
    salary_bhd: '450.000',
    joining_date: new Date().toISOString().split('T')[0],
    mol_certified: 'Yes',
    long_mol: 'No',
    comments: '',
    case_manager_name: currentUser.role === 'case_manager' 
      ? (currentUser.case_manager_code || currentUser.full_name) 
      : (caseManagers[0]?.case_manager_code || 'Husain')
  });

  const [saving, setSaving] = useState(false);

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
        setUploadDocName('');
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

    if (linkPlacementNow && (!placementForm.company_name.trim() || !placementForm.joining_date)) {
      window.AppStore.showNotification('Employer Company and Joining Date are required when linking a placement', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        ref_no: form.ref_no.trim(), // Custom ref if provided, otherwise empty string allows backend to auto-generate
        documents: documents.map(d => ({
          name: d.name,
          type: d.type,
          file_name: d.file_name,
          file_size: d.file_size,
          file_data: d.file_data
        }))
      };

      if (linkPlacementNow) {
        payload.company_name = placementForm.company_name;
        payload.employer_cr = placementForm.employer_cr;
        payload.employee_type = placementForm.employee_type;
        payload.position_title = placementForm.position_title;
        payload.salary_bhd = parseFloat(placementForm.salary_bhd) || 0;
        payload.joining_date = placementForm.joining_date;
        payload.mol_certified = placementForm.mol_certified;
        payload.long_mol = placementForm.long_mol;
        payload.comments = placementForm.comments;
        payload.case_manager_name = placementForm.case_manager_name;
        payload.status = 'placed';
      }

      const created = await window.api.candidates.create(payload);
      window.AppStore.showNotification(
        linkPlacementNow 
          ? `Candidate registered as ${created.ref_no} and linked to placement with automated milestones!` 
          : `Candidate registered successfully with Ref ${created.ref_no}!`, 
        'success'
      );
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
            Register candidate personal profile, attach multiple verification documents & link employment placement
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
                <label className="form-label">CPR Number *</label>
                <input
                  type="text"
                  className="input-control"
                  value={form.cpr_no}
                  onChange={e => setForm({ ...form, cpr_no: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Row 2: Candidate Reference Number & Registration Date */}
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

            {/* Row 3: Gender & Education Level */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Gender *</label>
                <select className="select-control" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Unspecified">Unspecified</option>
                </select>
              </div>

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
            </div>

            {/* Row 4: Status & Assigned Case Manager */}
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Status *</label>
                <select
                  className="select-control"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  <option value="registered">Registered (Available for Placement)</option>
                  <option value="placed">Placed (Under Employment Contract)</option>
                  <option value="on_hold">On Hold / Verification</option>
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

          {/* SECTION 2: MULTIPLE DOCUMENT UPLOAD AREA */}
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
                  onChange={e => setUploadDocType(e.target.value)}
                >
                  <option value="CPR / Smart Card Copy">CPR / Smart Card Copy</option>
                  <option value="Resume / CV">Resume / CV</option>
                  <option value="Educational Degree / Certificate">Educational Degree / Certificate</option>
                  <option value="Employment Offer / Contract">Employment Offer / Contract</option>
                  <option value="GOSI Certificate">GOSI Certificate</option>
                  <option value="Other Supporting Document">Other Supporting Document</option>
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

          {/* SECTION 3: OPTIONAL IMMEDIATE PLACEMENT LINKER */}
          <div style={{ background: linkPlacementNow ? 'rgba(30, 64, 175, 0.04)' : 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: linkPlacementNow ? '1px solid var(--primary-light)' : '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: linkPlacementNow ? '1rem' : '0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={linkPlacementNow}
                  onChange={e => {
                    setLinkPlacementNow(e.target.checked);
                    if (e.target.checked) setForm(prev => ({ ...prev, status: 'placed' }));
                  }}
                  style={{ width: '18px', height: '18px' }}
                />
                <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  🔗 Link Employer Placement to Candidate Now
                </strong>
              </label>
              <span className={`badge ${linkPlacementNow ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                {linkPlacementNow ? 'Placement Linker Active' : 'Available Registry (Link Later)'}
              </span>
            </div>

            {linkPlacementNow && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-light)' }}>
                {/* Row 1: Employer Company Name & CR Number */}
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Employer Company Name *</label>
                    <input
                      type="text"
                      className="input-control"
                      value={placementForm.company_name}
                      onChange={e => setPlacementForm({ ...placementForm, company_name: e.target.value })}
                      required={linkPlacementNow}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">CR Number</label>
                    <input
                      type="text"
                      className="input-control"
                      value={placementForm.employer_cr}
                      onChange={e => setPlacementForm({ ...placementForm, employer_cr: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 2: Employee Type & Position */}
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Employee Type *</label>
                    <select
                      className="select-control"
                      value={placementForm.employee_type}
                      onChange={e => setPlacementForm({ ...placementForm, employee_type: e.target.value })}
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
                      value={placementForm.position_title}
                      onChange={e => setPlacementForm({ ...placementForm, position_title: e.target.value })}
                      required={linkPlacementNow}
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
                      value={placementForm.salary_bhd}
                      onChange={e => setPlacementForm({ ...placementForm, salary_bhd: e.target.value })}
                      required={linkPlacementNow}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Joining / Placement Date *</label>
                    <input
                      type="date"
                      className="input-control"
                      value={placementForm.joining_date}
                      onChange={e => setPlacementForm({ ...placementForm, joining_date: e.target.value })}
                      required={linkPlacementNow}
                    />
                  </div>
                </div>

                {/* Row 4: MOL & Long MOL */}
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">MOL</label>
                    <select
                      className="select-control"
                      value={placementForm.mol_certified}
                      onChange={e => setPlacementForm({ ...placementForm, mol_certified: e.target.value })}
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
                      value={placementForm.long_mol}
                      onChange={e => setPlacementForm({ ...placementForm, long_mol: e.target.value })}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                </div>

                {/* Row 5: Comments */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Comments</label>
                  <textarea
                    className="input-control"
                    rows="2"
                    value={placementForm.comments}
                    onChange={e => setPlacementForm({ ...placementForm, comments: e.target.value })}
                  ></textarea>
                </div>

                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚡</span>
                  <span>Automated Day 0, Day 180, and Day 365 retention milestones will be created automatically upon registration.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={() => window.AppStore.closeModal()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Registering Candidate...' : 'Complete Candidate Registration'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 2. Link Employer Placement Modal
function LinkPlacementModal({ state, candidate }) {
  if (!candidate) return null;
  const { currentUser, caseManagers, settings } = state;
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';
  const currency = settings.currency || 'BHD';

  const [form, setForm] = useState({
    company_name: candidate.company_name || '',
    employer_cr: candidate.employer_cr || '',
    employee_type: candidate.employee_type || 'Full-Time',
    position_title: candidate.position_title || 'Specialist',
    salary_bhd: candidate.salary_bhd > 0 ? candidate.salary_bhd : '450.000',
    joining_date: candidate.joining_date || new Date().toISOString().split('T')[0],
    mol_certified: candidate.mol_certified || 'Yes',
    long_mol: candidate.long_mol || 'No',
    comments: candidate.comments || '',
    case_manager_name: candidate.case_manager_name || (caseManagers[0]?.case_manager_code || 'Husain')
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.joining_date) {
      window.AppStore.showNotification('Employer Company Name and Joining Date are required', 'error');
      return;
    }

    setSaving(true);
    try {
      await window.api.candidates.linkPlacement(candidate.id, {
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
    <div className="modal-content" style={{ maxWidth: '680px' }}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">🔗 Link Employer Placement</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Candidate: <strong>{candidate.full_name}</strong> (CPR: {candidate.cpr_no})
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Row 1: Employer Company Name & CR Number */}
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Employer Company Name *</label>
              <input
                type="text"
                className="input-control"
                value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">CR Number</label>
              <input
                type="text"
                className="input-control"
                value={form.employer_cr}
                onChange={e => setForm({ ...form, employer_cr: e.target.value })}
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
              <label className="form-label">MOL</label>
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

          {/* Row 6: Comments */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Comments</label>
            <textarea
              className="input-control"
              rows="2"
              value={form.comments}
              onChange={e => setForm({ ...form, comments: e.target.value })}
            ></textarea>
          </div>

          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚡</span>
            <span>Automated Day 0, Day 180, and Day 365 retention milestones will be generated upon linking this placement.</span>
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
              <option value="registered">📋 Registered (In Talent Pool / Available)</option>
              <option value="placed">💼 Placed (Under Placement Contract)</option>
              <option value="completed">🎓 Completed (365 Days Program Finished)</option>
              <option value="resigned">⚠️ Resigned / Voluntary Exit</option>
              <option value="on_hold">⏸️ On Hold / Verification Required</option>
            </select>
          </div>

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
  const [uploadDocType, setUploadDocType] = useState('🆔 CPR / Smart Card Copy');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploading, setUploading] = useState(false);

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
          setUploadDocName('');
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
                onChange={e => setUploadDocType(e.target.value)}
              >
                <option value="🆔 CPR / Smart Card Copy">🆔 CPR / Smart Card Copy</option>
                <option value="📄 Resume / CV">📄 Resume / CV</option>
                <option value="🎓 Educational Degree / Certificate">🎓 Educational Degree</option>
                <option value="📝 Employment Offer / Contract">📝 Employment Contract</option>
                <option value="📑 GOSI Certificate">📑 GOSI Certificate</option>
                <option value="📎 Other Supporting Document">📎 Other Document</option>
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
            Ref: {candidate.ref_no} | CPR: {candidate.cpr_no} | Status: <strong style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>{candidate.status || 'placed'}</strong>
          </span>
        </div>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Candidate Profile Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GENDER & EDUCATION</div>
            <strong style={{ fontSize: '0.85rem' }}>{candidate.gender} • {candidate.education}</strong>
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
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ATTACHED DOCUMENTS</div>
            <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>📎 {docs.length} Files</strong>
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

  // Default claim amount: placement salary if set, otherwise 500.000
  const defaultAmount = candidateSalary > 0 ? candidateSalary.toFixed(3) : '500.000';

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
  const undisputedClaims = claims.filter(c => c.status !== 'settled');

  const [form, setForm] = useState({
    claim_id: initialProps.claim?.id || initialProps.claim_id || undisputedClaims[0]?.id || '',
    amount_paid_bhd: initialProps.claim?.claim_amount_bhd || '700.000',
    receipt_reference: 'RCPT-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    notes: 'Direct EFT Ministry/Tamkeen Settlement'
  });
  const [saving, setSaving] = useState(false);

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
        notes: form.notes
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
    <div className="modal-content">
      <div className="modal-header">
        <h2 className="modal-title">💰 Record Payment Receipt</h2>
        <button className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Link to Claim *</label>
            <select
              className="select-control"
              value={form.claim_id}
              onChange={e => setForm({ ...form, claim_id: e.target.value })}
              required
            >
              {undisputedClaims.map(c => (
                <option key={c.id} value={c.id}>
                  {c.claim_ref} - {c.candidate_name || `Candidate #${c.candidate_id}`} ({currency} {Number(c.claim_amount_bhd).toFixed(3)})
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
      const resolvedReason = form.reason.trim() || form.dispute_reason;
      await window.api.disputes.create({
        claim_id: resolvedClaimId ? parseInt(resolvedClaimId) : null,
        milestone_id: resolvedMilestoneId ? parseInt(resolvedMilestoneId) : null,
        candidate_id: form.candidate_id ? parseInt(form.candidate_id) : null,
        dispute_category: form.dispute_reason,
        dispute_reason: form.dispute_reason,
        reason: resolvedReason,
        remarks: form.remarks.trim()
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

  // 1. Locate Target Dispute Record
  const dispute = initialProps.dispute 
    || disputes.find(d => 
         (initialProps.dispute_id && Number(d.id) === Number(initialProps.dispute_id)) ||
         (initialProps.claim_id && Number(d.claim_id) === Number(initialProps.claim_id)) ||
         (initialProps.claim?.id && Number(d.claim_id) === Number(initialProps.claim.id)) ||
         (initialProps.milestone?.claim_id && Number(d.claim_id) === Number(initialProps.milestone.claim_id)) ||
         (initialProps.milestone?.id && d.milestone_id && Number(d.milestone_id) === Number(initialProps.milestone.id)) ||
         (initialProps.candidate_id && d.candidate_id && Number(d.candidate_id) === Number(initialProps.candidate_id)) ||
         (initialProps.candidate?.id && d.candidate_id && Number(d.candidate_id) === Number(initialProps.candidate.id))
       )
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
  const disputeCategory = dispute?.dispute_category || dispute?.category || 'Employment / Milestone Variance';
  const disputeReason = dispute?.dispute_reason || dispute?.reason || 'Dispute registered during retention milestone verification';
  const claimRemarks = claim?.remarks || dispute?.claim_remarks || dispute?.remarks || milestone?.remarks || '';
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

  return (
    <div className="modal-content" style={{ maxWidth: '620px', width: '92vw' }}>
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: isActive ? 'var(--danger)' : 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            fontWeight: 700
          }}>
            {isActive ? '⚠️' : '✓'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.2rem' }}>Dispute Details</h2>
              <span className={`badge ${isActive ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.72rem' }}>
                {isActive ? 'Active Dispute' : String(disputeStatus).replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Ref: <strong style={{ fontFamily: 'var(--font-mono)' }}>{disputeRef}</strong>
              {disputeDate && <span> &bull; Filed: {window.formatAppDate ? window.formatAppDate(disputeDate) : disputeDate}</span>}
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={() => window.AppStore.closeModal()}>✕</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '76vh', overflowY: 'auto' }}>
        
        {/* Status Callout Banner */}
        <div style={{
          background: isActive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          border: `1px solid ${isActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.82rem',
          color: isActive ? 'var(--danger)' : 'var(--success)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>{isActive ? '🔒' : '✓'}</span>
          <div>
            <strong style={{ display: 'block', fontSize: '0.86rem' }}>
              {isActive ? 'Dispute Active — Subsidies & Disbursements Frozen' : 'Dispute Resolved'}
            </strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              {isActive 
                ? 'Automatic Tamkeen/Ministry claim release is currently on hold pending dispute investigation and verification.'
                : 'This dispute record has been resolved and audit logs are permanently preserved.'}
            </span>
          </div>
        </div>

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
            <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 600 }}>
              {isActive ? '● Payment Frozen' : '● Cleared'}
            </div>
          </div>
        </div>

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
              {disputeReason || 'No detailed grounds specified.'}
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
            color: claimRemarks ? 'var(--text-primary)' : 'var(--text-muted)',
            fontStyle: claimRemarks ? 'normal' : 'italic'
          }}>
            {claimRemarks || 'No remarks recorded for this claim.'}
          </div>
        </div>

        {/* Resolution Notes (if resolved) */}
        {dispute?.resolution_notes && !isActive && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.8rem 1rem'
          }}>
            <span style={{ color: 'var(--success)', fontSize: '0.74rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
              ✓ Resolution Remarks & Audit Summary
            </span>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
              {dispute.resolution_notes}
            </div>
          </div>
        )}

      </div>

      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.AppStore.closeModal()}
        >
          Close
        </button>
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
    return '500.000';
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

window.Modals = Modals;
