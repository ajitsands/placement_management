# Candidate-Job Matching Engine
## Technical Specification & Architecture Note

**Status:** Planned / Documented for Future Implementation  
**Module:** Jobs & Vacancy Management / Candidate Placement  
**Target Environment:** GCC / Kingdom of Bahrain  

---

### 1. Overview & Objective
The **Candidate-Job Matching Engine** is designed to automatically match and rank available candidates from the national talent pool (`status === 'registered'`) against open employer job vacancies (`jobs.status === 'active'`). 

It provides Case Managers and Administrators with an instant, intelligent recommendation system to accelerate placements, prevent mismatched job allocations, and maximize candidate retention across the mandatory 12-month subsidy lifecycle.

---

### 2. Matching Engine Scoring Matrix (0% – 100%)

The algorithm computes a weighted compatibility score between a selected **Job Vacancy** and each **Candidate** in the available pool:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CANDIDATE MATCHING ENGINE                         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Position & Title Similarity (Weight: 45%)                           │
│    • Exact title match (e.g. "Accountant" == "Accountant") → 45 pts     │
│    • Keyword / Token overlap (e.g. "Mechanical Engineer"    → 30-40 pts │
│      vs "Mechanical Technician")                                       │
│    • Related departmental field (e.g. "Finance" Dept)       → 15 pts    │
│                                                                        │
│ 2. Salary Compatibility (Weight: 25%)                                  │
│    • Candidate expected salary within ±10% of offered salary → 25 pts  │
│    • Within ±20% of offered salary                          → 15 pts   │
│    • Exceeds ±20% delta                                     → 5 pts    │
│                                                                        │
│ 3. Profile Readiness & Checklist Compliance (Weight: 15%)               │
│    • 100% Checklist complete (All mandatory docs uploaded)  → 15 pts   │
│    • Partial checklist completion (pro-rated)               → 5-10 pts │
│                                                                        │
│ 4. Regulatory & Ministry Certification (Weight: 15%)                   │
│    • Ministry of Labour (MOL) Certified ('Yes')             → 10 pts   │
│    • Identity Verification (Valid CPR + Smart Card copy)    → 5 pts    │
└────────────────────────────────────────────────────────────────────────┘
```

#### Match Tiers & UI Visuals
- 🟢 **Strong Match (80% – 100%):** Prime recommendation ready for immediate employer contract issuance.
- 🔵 **Good Match (60% – 79%):** High compatibility with minor differences in expected salary or sub-specialization.
- 🟡 **Potential Match (40% – 59%):** Candidate possesses adjacent skills or requires salary negotiation.

---

### 3. Eligibility Filters (Hard Constraints)
Before calculating compatibility scores, candidates must satisfy all hard constraints:
1. **Pool Availability:** Candidate status must be `registered` (unplaced). Placed candidates (`placed`) or archived profiles are excluded.
2. **Registration Validity:** Candidate must not be awaiting 12-month renewal (`!isAwaitingRenewal`). Candidates with expired registrations must be renewed first.
3. **No Active Disputes:** Candidates with pending dispute or termination flags are filtered out.

---

### 4. Proposed User Interface & User Experience (UI/UX)

#### Entry Point A: Jobs Page (`JobsView.js`)
- On each active job row with `vacancies_remaining > 0`, provide an allocation action button:
  - **`🎯 Match Candidates`** (with a counter badge, e.g., `🎯 4 Matches Ready`).
- Clicking opens the **Candidate Matching Drawer / Modal**.

#### Entry Point B: Candidate-Job Matching Modal (`JobMatchingModal`)
- **Header:** Job summary showing Employer Name, CR, Position Title, Department, Monthly Salary Offered, and Remaining Vacancies.
- **Top Bar:** Total eligible candidates in pool vs. qualified matches found, with a match threshold filter (All, 70%+, 80%+).
- **Candidate Cards:**
  - Candidate Full Name, CPR No, Reference Code, Contact Phone, Assigned Case Manager.
  - Large color-coded Match Percentage Pill (e.g., `92% Match`).
  - Compatibility Tags:
    - `🎯 Exact Title Match`
    - `💰 Salary Fit: BHD 450 (Matches Offered BHD 450)`
    - `✅ 100% Checklist Complete`
    - `🏛️ MOL Certified`
  - Action Button: **`⚡ Quick Assign`** — immediately opens `LinkPlacementModal` pre-populated with this candidate and job.

#### Entry Point C: Enhanced Placement Modal (`LinkPlacementModal`)
- When an employer job is selected in `LinkPlacementModal`, the candidate dropdown automatically sorts the highest-matched candidates to the top, designated with a `⭐ Recommended` icon.

---

### 5. Technical Architecture & File Map

| Component / Layer | Target File | Role & Implementation |
|---|---|---|
| **Matching Algorithm** | `public/js/services/matchingEngine.js` | Pure client-side function `matchJobWithCandidates(job, candidates, options)` calculating real-time scores with zero network latency. |
| **Matching Modal** | `public/js/components/Modals.js` (`JobMatchingModal`) | Interactive visual drawer presenting ranked matches, score breakdowns, and quick-assignment launchers. |
| **Jobs Integration** | `public/js/views/JobsView.js` | Action column trigger button (`🎯 Match Candidates`) and match counter pills. |
| **Placement Wiring** | `public/js/components/Modals.js` (`LinkPlacementModal`) | Auto-sorting candidate selector prioritizing top-scoring matches. |
| **Backend Endpoint (Optional)** | `api/controllers/JobController.php` (`/jobs/{id}/matches`) | Server-side matching endpoint for automated reporting and scheduled notification digests. |

---

### 6. Implementation Checklist (When Resuming)
- [ ] Create `public/js/services/matchingEngine.js` with string similarity tokenization & weighted formula.
- [ ] Implement `JobMatchingModal` in `public/js/components/Modals.js`.
- [ ] Add `🎯 Match Candidates` button to `Allocation Actions` in `public/js/views/JobsView.js`.
- [ ] Connect `⚡ Quick Assign` button to launch `LinkPlacementModal` with pre-filled candidate & job IDs.
- [ ] Add unit tests or verification script to validate scoring edge cases (e.g. case insensitivity, partial titles, salary limits).
