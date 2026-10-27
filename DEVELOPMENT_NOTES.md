# Candidate Placement & Claims Management System
## Developer Handover & Technical Development Notes

**Client / Project:** SaNDS Lab W.L.L. (CR: 152174-1 | ISO 9001:2015)  
**Target Territory:** Kingdom of Bahrain (Default) & GCC  
**Current Date:** October 2026  
**Status:** Architecture, Database, Middleware (PHP MVC), Frontend (React.js), and Micro-APIs fully implemented and verified. Ready for Phase 2 feature expansion.

---

### 1. Project Directory Structure & Organization

```
d:\Projects\Claims\
├── Workings\                              # Archived original files & proposal assets
│   ├── Candidate_Placement_Claims_Management_Proposal_SaNDSLab.pdf
│   ├── proposal.html
│   ├── Placements 25.xlsx, Placements 26.xlsx, Claims 26.xlsx
│   └── Word docs, helper extraction scripts, and logos
│
├── database\
│   ├── schema.sql                         # Production MySQL DDL (8 relational tables, FKs, indexes)
│   └── seeds.sql                          # GCC settings, RBAC accounts, and placement seed records
│
├── api\                                   # Middleware (PHP strictly following MVC Architecture)
│   ├── config\
│   │   ├── Config.php                     # GCC Timezones, Currencies, Date/Time formats, Roles
│   │   └── Database.php                   # MySQL PDO connection + atomic JSON store fallback
│   ├── core\
│   │   ├── Auth.php                       # RBAC engine, session validation, Case Manager scoping
│   │   ├── Response.php                   # Standardized JSON response handler with CORS headers
│   │   └── Router.php                     # Lightweight RESTful Micro-API router
│   ├── models\
│   │   ├── User.php                       # RBAC users & case manager accounts
│   │   ├── Candidate.php                  # Candidate placements & auto Day 0/180/365 milestones
│   │   ├── Milestone.php                  # Retention milestones engine (+0d, +180d, +365d)
│   │   ├── Claim.php                      # Manual BHD claim entry, balance calculation
│   │   ├── Dispute.php                    # Categorized disputes, reinstatement & termination
│   │   ├── Payment.php                    # Financial collections ledger & receipts
│   │   ├── Setting.php                    # Bahrain default & GCC system settings
│   │   └── Report.php                     # Executive KPIs and 10 specialized reports
│   ├── controllers\
│   │   ├── AuthController.php             # Authentication, session, and role switching
│   │   ├── UserController.php             # User management (Guarded: Admin/Superadmin only)
│   │   ├── CandidateController.php        # Placement transactions (Scoped to Case Manager)
│   │   ├── MilestoneController.php        # Milestone triggers and due tracking
│   │   ├── ClaimController.php            # Manual claim registration & approval workflow
│   │   ├── DisputeController.php          # Dispute filing, reinstatement, and termination
│   │   ├── PaymentController.php          # Financial collection receipt recording
│   │   ├── SettingController.php          # Localization & system configuration
│   │   └── ReportController.php           # 10 enterprise analytical reports
│   ├── data\
│   │   └── store.json                     # Atomic fallback data store for zero-config startup
│   ├── index.php                          # Micro-API gateway dispatcher
│   └── test_api.ps1                       # Automated PowerShell test suite (8 tests)
│
├── public\                                # Frontend (React.js Single Page Application)
│   ├── css\
│   │   └── app.css                        # Modern CSS tokens, Light Mode default, sleek Dark Mode
│   ├── js\
│   │   ├── state\
│   │   │   └── store.js                   # Centralized State Management Store (Pub/Sub pattern)
│   │   ├── services\
│   │   │   └── api.js                     # Micro-API REST client with load-balancing headers
│   │   ├── components\
│   │   │   ├── Navbar.js                  # Horizontal menu, theme toggle, quick role switcher
│   │   │   └── Modals.js                  # Accessible dialogs (Placement, Claim, Payment, Dispute)
│   │   ├── views\
│   │   │   ├── DashboardView.js           # KPIs, scoping alert banner, quick action launchers
│   │   │   ├── CandidatesView.js          # Placements registry, search, Case Manager filters
│   │   │   ├── MilestonesView.js          # Retention gates tracker (+0d, +180d, +365d)
│   │   │   ├── ClaimsView.js              # Claims ledger with manual BHD amounts & balances
│   │   │   ├── DisputesView.js            # Categorized disputes & termination state machine
│   │   │   ├── PaymentsView.js            # Financial receipts & treasury ledger
│   │   │   ├── ReportsView.js             # 10 Enterprise regulatory/audit reports
│   │   │   ├── UsersView.js               # User management (Admin/Superadmin only)
│   │   │   └── SettingsView.js            # Bahrain & GCC localization settings
│   │   └── app.js                         # React application orchestrator
│   └── index.html                         # Responsive HTML5 shell with React 18 runtime
│
├── index.php                              # Root gateway (Routes API requests & serves SPA)
├── .htaccess                              # Apache URL rewriting rules
└── DEVELOPMENT_NOTES.md                   # This handover documentation
```

---

### 2. Core Business Rules & System Constraints

1. **Role-Based Access Control (RBAC):**
   - Major user categories: `superadmin`, `admin`, and `case_manager`.
   - **User Creation:** Strictly restricted to `admin` and `superadmin`. Case Managers attempting to create users or access `POST /api/users` are blocked with `HTTP 403 Forbidden`.
   - **Transaction Scoping:** Case Managers see and operate strictly on their assigned candidates, retention milestones, claims, and disputes. Superadmins and Admins handle all transactions across all case managers by default.
2. **Manual Claim Amount Entry:**
   - Automated additive calculation was removed per client requirement.
   - Users manually specify the exact claim amount in BHD (`claim_amount_bhd`).
   - The system automatically reconciles recorded payment receipts against the claimed amount to track live remaining balances.
3. **Retention Gates Engine:**
   - Automatically initializes Day 0 (Initial Placement), Day 180 (6-Month Retention), and Day 365 (12-Month Retention) milestones upon candidate placement creation.
4. **GCC Localization Defaults:**
   - **Default Country:** Kingdom of Bahrain
   - **Default Timezone:** `Asia/Bahrain` (GMT+3)
   - **Default Currency:** `BHD` (Bahraini Dinar)
   - **Default Date Format:** `DD/MM/YYYY`
   - **Default Time Format:** `12h` (hh:mm A)
   - Full GCC options available in Settings: `SAR`, `AED`, `QAR`, `KWD`, `OMR`.
5. **UI & Layout Specifications:**
   - **Horizontal Menu:** Sticky top navbar.
   - **Light Mode Default:** Crisp modern slate/blue styling.
   - **Dark Mode Option:** One-click toggle (`🌙`/`☀️`) via `[data-theme="dark"]`.
   - **Role Impersonation Dropdown (`ACT AS`):** Allows immediate live testing of Superadmin vs. Case Manager transaction views in the browser.
   - **Responsiveness:** Fluid grid and mobile drawer navigation supporting phones, tablets, laptops, and ultra-wide desktops.
6. **Micro-API Load Balancing Architecture:**
   - All client calls pass custom headers `X-User-Id` and `X-User-Role` allowing stateless execution and seamless upstream load balancing across multiple PHP worker instances.

---

### 3. How to Run and Test the Application

#### A. Starting the Development Server
From the project root (`d:\Projects\Claims\`), run:
```powershell
C:\AppServ\php8\php.exe -S 127.0.0.1:8000 -t d:\Projects\Claims index.php
```
Open your browser to:
```
http://127.0.0.1:8000/
```
*(Alternatively, deploy directly under Apache on `http://localhost/Claims/`).*

#### B. Running the Automated Test Suite
A PowerShell automated test suite is provided to verify all core APIs, scoping rules, and RBAC restrictions:
```powershell
powershell -ExecutionPolicy Bypass -File d:\Projects\Claims\api\test_api.ps1
```
**Tests Covered:**
1. Authentication profile (`/auth/me`).
2. Global candidate access for Superadmin (returns all 13 candidate records).
3. Strict scoping for Case Manager Husain (returns strictly his 3 assigned candidates).
4. RBAC security enforcement: Case Manager attempting to create a user receives `HTTP 403 Forbidden`.
5. Superadmin creating a new user account.
6. Manual claim registration in BHD (`CLM-2026-XXX`).
7. Payment collection receipt issuance and real-time balance reduction (`RCPT-2026-XXXX`).
8. System GCC settings persistence.

#### C. Database Deployment (Localhost & Production Server)
The system uses dynamic environment configuration supporting both **localhost** and **remote/production servers** via [.env](file:///d:/Projects/Claims/.env):
1. **Localhost MySQL (Configured & Live):**
   - Host: `127.0.0.1` / `localhost:3306`
   - Database: `claims_db`
   - User: `root`
   - Password: `S@nds1@b`
2. **Server Deployment:**
   - Copy [.env.example](file:///d:/Projects/Claims/.env.example) to `.env` on your server and update `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`.
   - Alternatively, pass credentials via server environment variables (e.g. Apache `SetEnv`, cPanel, or Docker).
   - Import `database/schema.sql` and `database/seeds.sql` if setting up a fresh server database.
3. **High Availability & Fallback:**
   - All transactions execute live against MySQL with full ACID transactions.
   - If MySQL is ever unreachable or offline, the system automatically falls back to [api/data/store.json](file:///d:/Projects/Claims/api/data/store.json) without disrupting users.

---

### 4. Roadmap & Future Expansion Items (When Ready to Resume)

When you are ready to resume development, consider these planned enhancements:
1. **Document Attachments:** Add file upload support (PDF/JPG) for candidate CPR copies, employment contracts, and employer GOSI certificates in [api/controllers/CandidateController.php](file:///d:/Projects/Claims/api/controllers/CandidateController.php).
2. **Excel Importer / Exporter:** Build a client-side or server-side bulk import module to read future Excel placement batches directly into `Candidate::create()`.
3. **SMS / Email Alerts:** Integrate Bahrain SMS gateway / SMTP email notifications for milestone alerts (triggered at 170 days and 355 days).
4. **PDF Invoice / Claim Generator:** Generate official branded claim letters with SaNDS Lab header and CR/ISO footer for physical submission to Tamkeen.
