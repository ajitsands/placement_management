-- =========================================================================
-- Initial Seed Data for Claims Management System (JCP-CMS)
-- Includes Bahrain / GCC Settings, Role-Based Accounts & Real Placements
-- Server Seed: Super Administrator, Administrator, 4 Case Managers
-- Exactly 5 Records per Table: Candidates, Milestones, Claims, Disputes, Payments
-- =========================================================================

-- Database target: teamtoob_hr_db (or current selected DB)
-- USE `teamtoob_hr_db`;

-- Disable Foreign Key checks for clean reset
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `disputes`;
TRUNCATE TABLE `payments`;
TRUNCATE TABLE `claims`;
TRUNCATE TABLE `milestones`;
TRUNCATE TABLE `candidates`;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `settings`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Default Settings (Bahrain Default with GCC Support)
INSERT INTO `settings` (`id`, `setting_key`, `setting_value`, `category`) VALUES
(1, 'app_name', 'Candidate Placement & Claims Management System', 'general'),
(2, 'timezone', 'Asia/Bahrain', 'localization'),
(3, 'currency', 'BHD', 'localization'),
(4, 'currency_symbol', 'BD', 'localization'),
(5, 'currency_decimals', '3', 'localization'),
(6, 'date_format', 'DD/MM/YYYY', 'localization'),
(7, 'time_format', '12h', 'localization'),
(8, 'country', 'Bahrain', 'localization'),
(9, 'theme_default', 'light', 'ui'),
(10, 'lead_days_alert_180', '14', 'cron'),
(11, 'lead_days_alert_365', '21', 'cron');

-- 2. Default Users: Super Administrator, Administrator, and 4 Case Managers (Total 6 Users)
-- Passwords default to password123 (bcrypt hash: $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`, `case_manager_code`, `phone`, `is_active`) VALUES
(1, 'superadmin', 'superadmin@sandslab.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super Administrator', 'superadmin', NULL, '+973 35078079', 1),
(2, 'admin', 'admin@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin', NULL, '+973 77931123', 1),
(3, 'cm_husain', 'husain@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Husain Al-Mulla', 'case_manager', 'Husain', '+973 39123451', 1),
(4, 'cm_meaad', 'meaad@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Meaad Al-Alawi', 'case_manager', 'Meaad', '+973 39123452', 1),
(5, 'cm_dina', 'dina@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dina Aldoseri', 'case_manager', 'Dina', '+973 39123453', 1),
(6, 'cm_malak', 'malak@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Malak Al-Sayed', 'case_manager', 'Malak', '+973 39123454', 1);

-- 3. Candidates: Exactly 5 Records
INSERT INTO `candidates` (`id`, `ref_no`, `full_name`, `cpr_no`, `gender`, `education`, `salary_bhd`, `position_title`, `company_name`, `employer_cr`, `mol_certified`, `joining_date`, `case_manager_id`, `case_manager_name`, `status`) VALUES
(1, 'JCP/26/268524', 'LULWA EZZ EBRAHIM ALBANKI', '990408710', 'Female', 'Bachelors +', 500.000, 'Quality Analyst', 'BAHRAIN PHARMA', 'CR-45892-1', 'Yes', '2025-10-15', 4, 'Meaad', 'active'),
(2, 'JCP/25/172042', 'WALEED ABDULWAHID J ABDULAZIZ', '040710890', 'Male', 'High School', 350.000, 'Sales Representative', 'CENTRE POINT COLOUR', 'CR-12048-2', 'Yes', '2025-08-01', 3, 'Husain', 'active'),
(3, 'JCP/24/057296', 'ASMA MOHAMMAD ASHFAQMO DIN', '010706941', 'Female', 'Bachelors +', 500.000, 'QA Specialist', 'Konexus IT Solutions', 'CR-90412-1', 'Yes', '2025-09-10', 4, 'Meaad', 'active'),
(4, 'JCP/25/218398', 'ZIYAD TAREQ MAJEDA ALTHAWADI', '980309620', 'Male', 'Bachelors +', 508.000, 'Sales Executive', 'Bahrain Duty Free', 'CR-00215-4', 'Yes', '2025-07-20', 6, 'Malak', 'active'),
(5, 'JCP/25/215389', 'DINA MOHAMED YUSUF ALDOSERI', '010408520', 'Female', 'Bachelors +', 620.000, 'Clinical Administrator', 'KOREAN MEDICAL CENTER', 'CR-88201-1', 'Yes', '2025-06-15', 5, 'Dina', 'active');

-- 4. Milestones: Exactly 5 Records (Mapped to Candidates)
INSERT INTO `milestones` (`id`, `candidate_id`, `milestone_type`, `milestone_title`, `due_date`, `status`, `alert_dispatched`) VALUES
(1, 1, 'placement', 'Placement Claim (Day 0)', '2025-10-15', 'claimed', 1),
(2, 2, 'placement', 'Placement Claim (Day 0)', '2025-08-01', 'claimed', 1),
(3, 3, '180_days', '6-Month Claim (+180d)', '2026-03-09', 'disputed', 1),
(4, 4, 'placement', 'Placement Claim (Day 0)', '2025-07-20', 'claimed', 1),
(5, 5, '365_days', '12-Month Claim (+365d)', '2026-06-15', 'due', 1);

-- 5. Claims: Exactly 5 Records
INSERT INTO `claims` (`id`, `claim_ref`, `candidate_id`, `milestone_id`, `claim_type`, `claim_amount_bhd`, `status`, `claim_date`, `case_manager_id`, `case_manager_name`, `remarks`) VALUES
(1, 'CLM-2025-001', 1, 1, 'placement', 797.500, 'settled', '2025-10-20', 4, 'Meaad', 'Approved standard placement claim for Bahrain Pharma'),
(2, 'CLM-2025-002', 2, 2, 'placement', 605.000, 'settled', '2025-08-05', 3, 'Husain', 'Initial placement agreed contract amount'),
(3, 'CLM-2026-003', 3, 3, '180_days', 797.500, 'disputed', '2026-03-12', 4, 'Meaad', 'Employer reported resignation notice during month 5'),
(4, 'CLM-2025-004', 4, 4, 'placement', 660.000, 'settled', '2025-07-25', 6, 'Malak', 'Placement agreed for Duty Free'),
(5, 'CLM-2026-005', 5, 5, '365_days', 880.000, 'undisputed', '2026-06-20', 5, 'Dina', '12-month retention milestone claim awaiting full ministry clearance');

-- 6. Disputes: Exactly 5 Records
INSERT INTO `disputes` (`id`, `claim_id`, `dispute_category`, `dispute_reason`, `dispute_date`, `status`, `resolution_notes`, `handled_by_user_id`) VALUES
(1, 3, 'Employer Disagreement', 'Employer claims candidate tendered resignation before completing 180 days.', '2026-03-15', 'active_dispute', 'Case manager reviewing GOSI exit records with Ministry', 4),
(2, 1, 'Wage Discrepancy', 'Initial wage subsidy gate variance flagged during automated payroll audit.', '2025-11-01', 'reinstated', 'Salary bank transfer slip verified against Tamkeen subsidy guidelines', 4),
(3, 2, 'Probation Review', 'Probation evaluation document submission delayed by employer HR department.', '2025-08-20', 'reinstated', 'Clarified with Ministry inspector, candidate active on GOSI', 3),
(4, 4, 'Documentation Gap', 'GOSI contribution receipt requested for corporate registration.', '2025-08-01', 'reinstated', 'Official receipt uploaded and verified with Ministry', 6),
(5, 5, 'Attendance Discrepancy', 'Biometric attendance verification variance in retention record.', '2026-06-25', 'active_dispute', 'Case manager reviewing official company timesheet', 5);

-- 7. Payments: Exactly 5 Records
INSERT INTO `payments` (`id`, `receipt_no`, `claim_id`, `payment_date`, `amount_paid_bhd`, `payment_method`, `reference_doc_no`, `cashier_notes`) VALUES
(1, 'RCPT-2025-0142', 1, '2025-11-10', 797.500, 'Bank Transfer', 'BBK-TRF-994102', 'Full payment settled via BBK wire'),
(2, 'RCPT-2025-0108', 2, '2025-08-25', 605.000, 'Cheque', 'NBB-CHQ-44810', 'Cheque cleared NBB'),
(3, 'RCPT-2025-0091', 4, '2025-08-12', 660.000, 'Cheque', 'BIB-CHQ-00219', 'Settled in full for Duty Free placement claim'),
(4, 'RCPT-2026-0045', 5, '2026-07-05', 440.000, 'Bank Transfer', 'NBB-TRF-66104', 'First installment 50% paid for 12-month claim'),
(5, 'RCPT-2026-0082', 5, '2026-08-10', 440.000, 'Bank Transfer', 'BISB-TRF-77192', 'Second installment final settlement completed');
