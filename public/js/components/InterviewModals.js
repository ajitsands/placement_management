/**
 * Interview Modals Component
 * ScheduleInterviewModal & JobInterviewsModal
 * Handles interview scheduling, candidate preset matching, attendance, outcome evaluations, and audit logs.
 */

const { useState, useEffect, useMemo, useCallback } = React;

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

  // Job options for SearchableSelect (Searchable by Employer, Position, Department, Job Code, or CR)
  const jobOptions = useMemo(() => {
    const list = (availableJobs || []).map(j => {
      const rem = typeof j.vacancies_remaining !== 'undefined'
        ? parseInt(j.vacancies_remaining, 10)
        : Math.max(0, (parseInt(j.vacancies_count, 10) || 1) - (parseInt(j.placed_count, 10) || 0));
      const pos = j.position_title || j.job_title || 'Position';
      const sal = parseFloat(j.salary_offered_bhd || j.salary_bhd || 500).toFixed(3);
      const dept = j.department || 'Operations';
      const code = j.job_code || `JOB-${j.id}`;
      return {
        value: String(j.id),
        label: `${j.company_name} — ${pos}`,
        subLabel: `${code} • Dept: ${dept} • ${rem} open of ${j.vacancies_count || 1} • ${currency} ${sal}`,
        searchKeywords: `${j.company_name} ${pos} ${dept} ${code} ${j.employer_cr || ''}`,
        job: j,
        remaining: rem
      };
    });
    return [
      { value: '', label: `-- Choose Job Opening (${list.length} Available) --`, subLabel: 'Search by employer, position, department, or job code' },
      ...list
    ];
  }, [availableJobs, currency]);

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

            <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1.5fr 1fr' : '1fr', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', minWidth: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.3rem', fontWeight: 600 }}>Job Vacancy Opening *</label>
                {SearchableSelect ? (
                  <SearchableSelect
                    options={jobOptions}
                    value={selectedJobId}
                    onChange={val => setSelectedJobId(val ? String(val) : '')}
                    placeholder="Search employer, position, department, or job code..."
                    searchPlaceholder="Type employer, position, or job code to search..."
                    icon="🏢"
                  />
                ) : (
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
                )}
              </div>

              {selectedJob && (
                <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.65rem 0.85rem', fontSize: '0.78rem' }}>
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
  const SearchableSelect = window.SearchableSelect;

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

  // Options for SearchableSelect in Global View
  const interviewJobOptions = useMemo(() => {
    const list = (jobs || []).map(j => {
      const count = (state.interviews || []).filter(i => Number(i.job_id) === Number(j.id)).length;
      const code = j.job_code || `JOB-${j.id}`;
      return {
        value: String(j.id),
        label: `${j.company_name} — ${j.job_title}`,
        subLabel: `${code} • ${count} session(s) scheduled • Dept: ${j.department || 'Operations'}`,
        searchKeywords: `${j.company_name} ${j.job_title} ${code} ${j.department || ''} ${j.employer_cr || ''}`
      };
    });
    return [
      { value: '', label: `-- All Job Openings (${(state.interviews || []).length} Scheduled Sessions) --`, subLabel: 'View sessions across all employer jobs' },
      ...list
    ];
  }, [jobs, state.interviews]);

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
              <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🏢 Filter by Job Opening:
                  </span>
                </div>
                {SearchableSelect ? (
                  <SearchableSelect
                    options={interviewJobOptions}
                    value={currentJobId}
                    onChange={val => {
                      setCurrentJobId(val ? String(val) : '');
                      setSelectedInterviewId('');
                    }}
                    placeholder="Search by employer, job title, department, or job code..."
                    searchPlaceholder="Type employer name or position to filter..."
                    icon="🏢"
                  />
                ) : (
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
                )}
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




window.ScheduleInterviewModal = ScheduleInterviewModal;
window.JobInterviewsModal = JobInterviewsModal;
