-- =========================================================================
-- Initial Seed Data for Claims Management System (JCP-CMS)
-- Includes Bahrain / GCC Settings, Role-Based Accounts & Real Placements
-- =========================================================================

USE `claims_db`;

-- 1. Default Settings (Bahrain Default with GCC Support)
INSERT INTO `settings` (`setting_key`, `setting_value`, `category`) VALUES
('app_name', 'Candidate Placement & Claims Management System', 'general'),
('timezone', 'Asia/Bahrain', 'localization'),
('currency', 'BHD', 'localization'),
('currency_symbol', 'BD', 'localization'),
('currency_decimals', '3', 'localization'),
('date_format', 'DD/MM/YYYY', 'localization'),
('time_format', '12h', 'localization'),
('country', 'Bahrain', 'localization'),
('theme_default', 'light', 'ui'),
('lead_days_alert_180', '14', 'cron'),
('lead_days_alert_365', '21', 'cron')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- 2. Default Users (Superadmin, Admin, Case Managers)
-- Passwords default to password123 (bcrypt hash)
INSERT INTO `users` (`username`, `email`, `password_hash`, `full_name`, `role`, `case_manager_code`, `phone`) VALUES
('superadmin', 'superadmin@sandslab.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. Salman (Super Admin)', 'superadmin', NULL, '+973 35078079'),
('directorate_admin', 'admin@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Directorate Operations Admin', 'admin', NULL, '+973 77931123'),
('cm_husain', 'husain@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Husain Al-Mulla', 'case_manager', 'Husain', '+973 39123451'),
('cm_meaad', 'meaad@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Meaad Al-Alawi', 'case_manager', 'Meaad', '+973 39123452'),
('cm_dina', 'dina@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dina Aldoseri', 'case_manager', 'Dina', '+973 39123453'),
('cm_malak', 'malak@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Malak Al-Sayed', 'case_manager', 'Malak', '+973 39123454'),
('cm_zainab', 'zainab@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Zainab Mattar', 'case_manager', 'Zainab Mattar', '+973 39123455'),
('cm_mahdi', 'mahdi@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mahdi Habib', 'case_manager', 'Mahdi', '+973 39123456')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- 3. Realistic Bahrain Candidate Placements (from Excel records)
INSERT INTO `candidates` (`id`, `ref_no`, `full_name`, `cpr_no`, `gender`, `education`, `salary_bhd`, `position_title`, `company_name`, `employer_cr`, `mol_certified`, `joining_date`, `case_manager_id`, `case_manager_name`) VALUES
(1, 'JCP/26/268524', 'LULWA EZZ EBRAHIM ALBANKI', '990408710', 'Female', 'Bachelors +', 500.000, 'Quality Analyst', 'BAHRAIN PHARMA', 'CR-45892-1', 'Yes', '2025-10-15', 4, 'Meaad'),
(2, 'JCP/25/172042', 'WALEED ABDULWAHID J ABDULAZIZ', '040710890', 'Male', 'High School', 350.000, 'Sales Representative', 'CENTRE POINT COLOUR', 'CR-12048-2', 'Yes', '2025-08-01', 3, 'Husain'),
(3, 'JCP/24/057296', 'ASMA MOHAMMAD ASHFAQMO DIN', '010706941', 'Female', 'Bachelors +', 500.000, 'QA Specialist', 'Konexus IT Solutions', 'CR-90412-1', 'Yes', '2025-09-10', 4, 'Meaad'),
(4, 'JCP/25/218398', 'ZIYAD TAREQ MAJEDA ALTHAWADI', '980309620', 'Male', 'Bachelors +', 508.000, 'Sales Executive', 'Bahrain Duty Free', 'CR-00215-4', 'Yes', '2025-07-20', 6, 'Malak'),
(5, 'JCP/25/183340', 'AYSHA OMAR SALEH AL ALYAZEEDI', '031103103', 'Female', 'Diploma', 482.000, 'Retail Associate', 'Bahrain Duty Free', 'CR-00215-4', 'Yes', '2025-08-15', 7, 'Zainab Mattar'),
(6, 'JCP/25/210558', 'ALI ABDULAMEER ALI ALI MOHAMED', '990805476', 'Male', 'High School', 450.000, 'Operations Assistant', 'ALMOAYYED CLEANING', 'CR-33019-1', 'Yes', '2025-11-01', 4, 'Meaad'),
(7, 'JCP/25/267702', 'ABBAS AHMED A ALHANNAN', '000508920', 'Male', 'High School', 400.000, 'Ground Support Officer', 'BAHRAIN AIRPORT SERVICES', 'CR-00104-1', 'Yes', '2025-11-12', 4, 'Meaad'),
(8, 'JCP/25/267727', 'MAYTHAM MOHAMED JAAFAR ALI', '970204730', 'Male', 'High School', 450.000, 'Flight Dispatch Trainee', 'GULF AIR ACADEMY', 'CR-78219-3', 'No', '2025-12-01', 4, 'Meaad'),
(9, 'JCP/25/204298', 'ABDULLA MOHAMED HOORAN ALENEZI', '020309481', 'Male', 'Bachelors +', 550.000, 'Project Coordinator', 'ALMOAYYED CONTRACTING', 'CR-33019-2', 'Yes', '2025-09-01', 7, 'Zainab Mattar'),
(10, 'JCP/26/268505', 'YUSUF ALI YUSUF HABIB DAGHER', '010903820', 'Male', 'Diploma', 450.000, 'Maintenance Technician', 'KHALID SERVICES', 'CR-54128-1', 'No', '2026-01-10', 8, 'Mahdi'),
(11, 'JCP/25/219615', 'HUSAIN ABDULMONEM HU MOTHANNA', '010207910', 'Male', 'High School', 450.000, 'Facility Inspector', 'ALMOAYYED CLEANING', 'CR-33019-1', 'Yes', '2025-10-01', 3, 'Husain'),
(12, 'JCP/25/212208', 'WALAA ISA A. HASAN', '990900045', 'Female', 'Bachelors +', 700.000, 'Senior Recruiter', 'STUDENT PLATFORM', 'CR-62910-1', 'Yes', '2025-07-01', 3, 'Husain'),
(13, 'JCP/25/215389', 'DINA MOHAMED YUSUF ALDOSERI', '010408520', 'Female', 'Bachelors +', 620.000, 'Clinical Administrator', 'KOREAN MEDICAL CENTER', 'CR-88201-1', 'Yes', '2025-06-15', 5, 'Dina')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- 4. Initial Milestones (Placement, +180 Days, +365 Days)
INSERT INTO `milestones` (`id`, `candidate_id`, `milestone_type`, `milestone_title`, `due_date`, `status`, `alert_dispatched`) VALUES
(1, 1, 'placement', 'Placement Claim (Day 0)', '2025-10-15', 'claimed', 1),
(2, 1, '180_days', '6-Month Claim (+180d)', '2026-04-13', 'due', 1),
(3, 1, '365_days', '12-Month Claim (+365d)', '2026-10-15', 'upcoming', 0),
(4, 2, 'placement', 'Placement Claim (Day 0)', '2025-08-01', 'claimed', 1),
(5, 2, '180_days', '6-Month Claim (+180d)', '2026-01-28', 'claimed', 1),
(6, 2, '365_days', '12-Month Claim (+365d)', '2026-08-01', 'upcoming', 0),
(7, 3, 'placement', 'Placement Claim (Day 0)', '2025-09-10', 'claimed', 1),
(8, 3, '180_days', '6-Month Claim (+180d)', '2026-03-09', 'disputed', 1),
(9, 4, 'placement', 'Placement Claim (Day 0)', '2025-07-20', 'claimed', 1),
(10, 4, '180_days', '6-Month Claim (+180d)', '2026-01-16', 'claimed', 1),
(11, 12, 'placement', 'Placement Claim (Day 0)', '2025-07-01', 'claimed', 1),
(12, 12, '180_days', '6-Month Claim (+180d)', '2025-12-28', 'claimed', 1),
(13, 12, '365_days', '12-Month Claim (+365d)', '2026-07-01', 'due', 1),
(14, 13, 'placement', 'Placement Claim (Day 0)', '2025-06-15', 'claimed', 1),
(15, 13, '180_days', '6-Month Claim (+180d)', '2025-12-12', 'claimed', 1),
(16, 13, '365_days', '12-Month Claim (+365d)', '2026-06-15', 'overdue', 1)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 5. Claims (Manual Amounts Logged in BHD)
INSERT INTO `claims` (`id`, `claim_ref`, `candidate_id`, `milestone_id`, `claim_type`, `claim_amount_bhd`, `status`, `claim_date`, `case_manager_id`, `case_manager_name`, `remarks`) VALUES
(1, 'CLM-2025-001', 1, 1, 'placement', 797.500, 'settled', '2025-10-20', 4, 'Meaad', 'Approved standard placement claim for Bahrain Pharma'),
(2, 'CLM-2025-002', 2, 4, 'placement', 605.000, 'settled', '2025-08-05', 3, 'Husain', 'Initial placement agreed contract amount'),
(3, 'CLM-2026-003', 2, 5, '180_days', 605.000, 'undisputed', '2026-02-02', 3, 'Husain', '6-Month attendance verified and agreed'),
(4, 'CLM-2025-004', 3, 7, 'placement', 797.500, 'settled', '2025-09-15', 4, 'Meaad', 'Placement confirmed with Konexus'),
(5, 'CLM-2026-005', 3, 8, '180_days', 797.500, 'disputed', '2026-03-12', 4, 'Meaad', 'Employer reported resignation notice during month 5'),
(6, 'CLM-2025-006', 4, 9, 'placement', 660.000, 'settled', '2025-07-25', 6, 'Malak', 'Placement agreed for Duty Free'),
(7, 'CLM-2026-007', 4, 10, '180_days', 660.000, 'undisputed', '2026-01-20', 6, 'Malak', 'Approved 6-month claim for Duty Free'),
(8, 'CLM-2025-008', 12, 11, 'placement', 880.000, 'settled', '2025-07-05', 3, 'Husain', 'Placement confirmed Student Platform'),
(9, 'CLM-2026-009', 12, 12, '180_days', 880.000, 'settled', '2026-01-05', 3, 'Husain', '6M employment milestone completed'),
(10, 'CLM-2025-010', 13, 14, 'placement', 880.000, 'settled', '2025-06-20', 5, 'Dina', 'Clinical placement approved'),
(11, 'CLM-2026-011', 13, 15, '180_days', 880.000, 'undisputed', '2025-12-18', 5, 'Dina', 'Awaiting full settlement from ministry')
ON DUPLICATE KEY UPDATE `claim_amount_bhd` = VALUES(`claim_amount_bhd`);

-- 6. Disputes
INSERT INTO `disputes` (`id`, `claim_id`, `dispute_category`, `dispute_reason`, `dispute_date`, `status`, `resolution_notes`, `handled_by_user_id`) VALUES
(1, 5, 'Employer Disagreement', 'Employer claims candidate tendered resignation before completing 180 days.', '2026-03-15', 'active_dispute', 'Case manager reviewing GOSI exit records with Ministry', 4)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 7. Payment Collections (Ledger with Multi-Receipt Tracking)
INSERT INTO `payments` (`id`, `receipt_no`, `claim_id`, `payment_date`, `amount_paid_bhd`, `payment_method`, `reference_doc_no`, `cashier_notes`) VALUES
(1, 'RCPT-2025-0142', 1, '2025-11-10', 797.500, 'Bank Transfer', 'BBK-TRF-994102', 'Full payment settled via BBK wire'),
(2, 'RCPT-2025-0108', 2, '2025-08-25', 605.000, 'Cheque', 'NBB-CHQ-44810', 'Cheque cleared NBB'),
(3, 'RCPT-2026-0033', 3, '2026-02-15', 300.000, 'Bank Transfer', 'AUB-TRF-11029', 'First installment partial payment received'),
(4, 'RCPT-2025-0129', 4, '2025-10-02', 797.500, 'Bank Transfer', 'BISB-TRF-88102', 'Settled in full'),
(5, 'RCPT-2025-0091', 6, '2025-08-12', 660.000, 'Cheque', 'BIB-CHQ-00219', 'Settled'),
(6, 'RCPT-2026-0045', 7, '2026-02-01', 400.000, 'Bank Transfer', 'NBB-TRF-66104', 'Partial receipt for Duty Free claim'),
(7, 'RCPT-2025-0082', 8, '2025-07-20', 880.000, 'Bank Transfer', 'BBK-TRF-55102', 'Full settlement'),
(8, 'RCPT-2026-0012', 9, '2026-01-18', 880.000, 'Bank Transfer', 'BBK-TRF-77291', 'Full settlement 6M'),
(9, 'RCPT-2025-0065', 10, '2025-07-02', 880.000, 'Cheque', 'AUB-CHQ-10492', 'Cleared'),
(10, 'RCPT-2026-0005', 11, '2026-01-10', 500.000, 'Bank Transfer', 'NBB-TRF-33019', 'Partial collection 500 BHD, balance 380 BHD remaining')
ON DUPLICATE KEY UPDATE `amount_paid_bhd` = VALUES(`amount_paid_bhd`);
