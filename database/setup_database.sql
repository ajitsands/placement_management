-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- All-in-One Database Setup Script (Schema + Seeds)
-- Target: teamtoob_hr_db (or any selected database in phpMyAdmin)
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. System Settings Table (Bahrain Default & GCC Options)
CREATE TABLE IF NOT EXISTS `settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `setting_key` VARCHAR(64) NOT NULL UNIQUE,
    `setting_value` TEXT NOT NULL,
    `category` VARCHAR(32) DEFAULT 'general',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Users & RBAC Table (Superadmin, Admin, Case Manager)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(64) NOT NULL UNIQUE,
    `email` VARCHAR(128) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(128) NOT NULL,
    `role` ENUM('superadmin', 'admin', 'case_manager') NOT NULL DEFAULT 'case_manager',
    `case_manager_code` VARCHAR(32) NULL,
    `phone` VARCHAR(32) NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_cm_code` (`case_manager_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Candidates & Placements Table (With 12-Month Renewal History & Checklist Criteria)
CREATE TABLE IF NOT EXISTS `candidates` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ref_no` VARCHAR(64) NOT NULL UNIQUE,
    `full_name` VARCHAR(191) NOT NULL,
    `cpr_no` VARCHAR(32) NOT NULL,
    `phone` VARCHAR(64) NULL,
    `email` VARCHAR(191) NULL,
    `gender` ENUM('Male', 'Female', 'Unspecified') DEFAULT 'Unspecified',
    `education` VARCHAR(64) DEFAULT 'High School',
    `date_of_birth` DATE NULL,
    `salary_bhd` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    `position_title` VARCHAR(128) NULL,
    `employee_type` VARCHAR(64) DEFAULT 'Full-Time',
    `company_name` VARCHAR(191) NULL,
    `employer_cr` VARCHAR(64) NULL,
    `mol_certified` VARCHAR(16) DEFAULT 'Yes',
    `long_mol` VARCHAR(16) DEFAULT 'No',
    `registration_date` DATE NULL,
    `last_renewal_date` DATE NULL,
    `renewals_count` INT NOT NULL DEFAULT 0,
    `renewal_history` LONGTEXT NULL,
    `status` VARCHAR(64) NOT NULL DEFAULT 'registered',
    `joining_date` DATE NULL,
    `case_manager_id` INT NULL,
    `case_manager_name` VARCHAR(64) NOT NULL,
    `notes` TEXT NULL,
    `comments` TEXT NULL,
    `remarks` TEXT NULL,
    `documents` JSON NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `job_id` INT NULL,
    `job_code` VARCHAR(64) NULL,
    `checklist_completion_pct` INT NOT NULL DEFAULT 0,
    `checklist_items` LONGTEXT NULL,
    FOREIGN KEY (`case_manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_candidates_cpr` (`cpr_no`),
    INDEX `idx_candidates_cm` (`case_manager_name`),
    INDEX `idx_candidates_status` (`status`),
    INDEX `idx_candidates_reg` (`registration_date`),
    INDEX `idx_candidates_renewal` (`last_renewal_date`),
    INDEX `idx_candidates_joining` (`joining_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Employer Jobs & Vacancies Table
CREATE TABLE IF NOT EXISTS `jobs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `job_code` VARCHAR(64) NOT NULL UNIQUE,
    `job_title` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NOT NULL,
    `employer_cr` VARCHAR(64) DEFAULT NULL,
    `department` VARCHAR(128) DEFAULT NULL,
    `salary_offered_bhd` DECIMAL(10, 3) NOT NULL DEFAULT 500.000,
    `vacancies_count` INT NOT NULL DEFAULT 1,
    `status` ENUM('active', 'filled', 'closed') NOT NULL DEFAULT 'active',
    `requirements` TEXT NULL,
    `description` TEXT NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_jobs_company` (`company_name`),
    INDEX `idx_jobs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Candidate Registration Compliance Checklist Master Table
CREATE TABLE IF NOT EXISTS `checklist_masters` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(64) NOT NULL UNIQUE,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(64) NOT NULL DEFAULT 'Identity & Legal',
    `weight` INT NOT NULL DEFAULT 15,
    `is_mandatory` TINYINT(1) NOT NULL DEFAULT 1,
    `display_order` INT NOT NULL DEFAULT 1,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_checklist_code` (`code`),
    INDEX `idx_checklist_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5b. Candidate Document Category Master Table
CREATE TABLE IF NOT EXISTS `document_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(64) NOT NULL UNIQUE,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(32) NOT NULL DEFAULT '📄',
    `description` TEXT NULL,
    `is_mandatory` TINYINT(1) NOT NULL DEFAULT 0,
    `display_order` INT NOT NULL DEFAULT 1,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_doc_cat_code` (`code`),
    INDEX `idx_doc_cat_order` (`display_order`),
    INDEX `idx_doc_cat_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Milestone Triggers Table
CREATE TABLE IF NOT EXISTS `milestones` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `candidate_id` INT NOT NULL,
    `milestone_type` ENUM('placement', '180_days', '365_days') NOT NULL,
    `milestone_title` VARCHAR(64) NOT NULL,
    `due_date` DATE NOT NULL,
    `status` ENUM('upcoming', 'due', 'overdue', 'claimed', 'disputed') NOT NULL DEFAULT 'upcoming',
    `alert_dispatched` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_cand_milestone` (`candidate_id`, `milestone_type`),
    INDEX `idx_milestones_status` (`status`),
    INDEX `idx_milestones_due` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Claims Table
CREATE TABLE IF NOT EXISTS `claims` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `claim_ref` VARCHAR(64) NOT NULL UNIQUE,
    `candidate_id` INT NOT NULL,
    `milestone_id` INT NULL,
    `claim_type` ENUM('placement', '180_days', '365_days') NOT NULL,
    `claim_amount_bhd` DECIMAL(10, 3) NOT NULL,
    `status` ENUM('claimable', 'undisputed', 'disputed', 'terminated', 'settled') NOT NULL DEFAULT 'undisputed',
    `claim_date` DATE NOT NULL,
    `case_manager_id` INT NULL,
    `case_manager_name` VARCHAR(64) NOT NULL,
    `remarks` TEXT NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON DELETE CASCADE,
    INDEX `idx_claims_cm` (`case_manager_name`),
    INDEX `idx_claims_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Dispute Resolution Table
CREATE TABLE IF NOT EXISTS `disputes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `claim_id` INT NOT NULL,
    `dispute_category` VARCHAR(64) NOT NULL,
    `dispute_reason` TEXT NOT NULL,
    `dispute_date` DATE NOT NULL,
    `status` ENUM('active_dispute', 'reinstated', 'terminated') NOT NULL DEFAULT 'active_dispute',
    `resolution_notes` TEXT NULL,
    `reinstated_date` DATE NULL,
    `terminated_date` DATE NULL,
    `handled_by_user_id` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON DELETE CASCADE,
    INDEX `idx_disputes_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Payment Ledger Table
CREATE TABLE IF NOT EXISTS `payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `receipt_no` VARCHAR(64) NOT NULL UNIQUE,
    `claim_id` INT NOT NULL,
    `payment_date` DATE NOT NULL,
    `amount_paid_bhd` DECIMAL(10, 3) NOT NULL,
    `payment_method` ENUM('Bank Transfer', 'Cheque', 'BenefitPay', 'Cash') DEFAULT 'Bank Transfer',
    `reference_doc_no` VARCHAR(64) NULL,
    `cashier_notes` VARCHAR(255) NULL,
    `attachments` LONGTEXT NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON DELETE CASCADE,
    INDEX `idx_payments_claim` (`claim_id`),
    INDEX `idx_payments_date` (`payment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `username` VARCHAR(64) NOT NULL,
    `role` VARCHAR(32) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `entity_type` VARCHAR(64) NOT NULL,
    `entity_id` INT NULL,
    `details` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_action` (`action`),
    INDEX `idx_audit_user` (`user_id`),
    INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- SEED INITIAL DATA
-- =========================================================================

-- 1. Default Settings
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
(11, 'lead_days_alert_365', '21', 'cron'),
(12, 'standard_tier_amount_bhd', '500', 'general')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- 2. Default Users (password123 for all demo accounts)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`, `case_manager_code`, `phone`, `is_active`) VALUES
(1, 'superadmin', 'superadmin@sandslab.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super Administrator', 'superadmin', NULL, '+973 35078079', 1),
(2, 'admin', 'admin@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin', NULL, '+973 77931123', 1),
(3, 'cm_husain', 'husain@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Husain Al-Mulla', 'case_manager', 'Husain', '+973 39123451', 1),
(4, 'cm_meaad', 'meaad@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Meaad Al-Alawi', 'case_manager', 'Meaad', '+973 39123452', 1),
(5, 'cm_dina', 'dina@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dina Aldoseri', 'case_manager', 'Dina', '+973 39123453', 1),
(6, 'cm_malak', 'malak@placement.gov.bh', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Malak Al-Sayed', 'case_manager', 'Malak', '+973 39123454', 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- 3. Default Compliance Checklist Masters
INSERT INTO `checklist_masters` (`id`, `code`, `title`, `description`, `category`, `weight`, `is_mandatory`, `display_order`, `is_active`) VALUES
(1, 'CPR_VERIF', 'CPR Identity & Smart Card Verification', 'Valid Kingdom of Bahrain CPR Smart Card copy uploaded and identity confirmed against National Population Registry.', 'Identity & Legal', 25, 1, 1, 1),
(2, 'CV_RESUME', 'Curriculum Vitae (CV / Resume) Vetted', 'Current professional resume submitted, verified, and tagged with candidate specializations and skills.', 'Profile & Qualifications', 20, 1, 2, 1),
(3, 'EDU_CERT', 'Educational Certificate / Attested Degree', 'Verified graduation degree or diploma certificate from accredited university/institution.', 'Profile & Qualifications', 20, 1, 3, 1),
(4, 'BANK_IBAN', 'Bank Account IBAN Certificate', 'Official bank account verification letter / IBAN certificate in candidate name for wage disbursement compliance.', 'Banking & Compliance', 15, 1, 4, 1),
(5, 'GOSI_RECORD', 'GOSI Employment History / Status Record', 'Social insurance contribution clearance confirming candidate eligibility under Tamkeen subsidy guidelines.', 'Compliance & Verification', 10, 0, 5, 1),
(6, 'MOL_AGREE', 'MOL & Placement Retention Consent', 'Signed candidate acknowledgment of Ministry of Labour employment terms and Tamkeen retention milestones.', 'Compliance & Verification', 10, 1, 6, 1)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `weight` = VALUES(`weight`), `is_mandatory` = VALUES(`is_mandatory`);

-- 3b. Default Candidate Document Categories
INSERT INTO `document_categories` (`id`, `code`, `name`, `icon`, `description`, `is_mandatory`, `display_order`, `is_active`) VALUES
(1, 'CPR', 'CPR / Smart Card Copy', '🆔', 'Valid Kingdom of Bahrain CPR Smart Card front/back copy or National ID proof.', 1, 1, 1),
(2, 'RESUME', 'Resume / CV', '📄', 'Current professional curriculum vitae detailing education and employment background.', 1, 2, 1),
(3, 'DEGREE', 'Educational Degree / Certificate', '🎓', 'Graduation diploma or accredited academic qualification certificate.', 1, 3, 1),
(4, 'IBAN', 'Bank Account IBAN Certificate', '🏦', 'Official bank letter or statement confirming candidate IBAN for wage disbursement.', 1, 4, 1),
(5, 'GOSI', 'GOSI Employment History / Certificate', '📑', 'Official Social Insurance (GOSI) record demonstrating employment and contribution history.', 0, 5, 1),
(6, 'MOL_CONSENT', 'MOL & Tamkeen Consent Form', '⚖️', 'Signed agreement acknowledging national employment and wage subsidy terms.', 1, 6, 1),
(7, 'CONTRACT', 'Employment Offer / Contract', '📝', 'Formal tripartite or bilateral employment agreement signed with sponsoring employer.', 0, 7, 1),
(8, 'EXIT_LETTER', 'Resignation / Exit Clearance Letter', '📜', 'Official release or resignation acceptance letter from previous employer.', 0, 8, 1),
(9, 'PHOTO', 'Passport Size Photo', '🖼️', 'Recent biometric passport photograph with clear white background.', 0, 9, 1),
(10, 'OTHER', 'Other Supporting Document', '📎', 'Supplementary certificates, licenses, or professional credentials.', 0, 10, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `icon` = VALUES(`icon`), `is_mandatory` = VALUES(`is_mandatory`);

-- 4. Default Jobs / Vacancies
INSERT INTO `jobs` (`id`, `job_code`, `job_title`, `company_name`, `employer_cr`, `department`, `salary_offered_bhd`, `vacancies_count`, `status`, `requirements`, `description`) VALUES
(1, 'JOB-2026-001', 'Quality Assurance Analyst', 'BAHRAIN PHARMA', 'CR-45892-1', 'Quality Assurance', 500.000, 2, 'active', 'Bachelor in Chemistry/Biology, fluent English, QA laboratory experience', 'Support pharmaceutical manufacturing quality assurance compliance and audit documentation.'),
(2, 'JOB-2026-002', 'Senior Retail Sales Representative', 'CENTRE POINT COLOUR', 'CR-12048-2', 'Sales & Retail', 350.000, 3, 'active', 'High school diploma or above, retail customer service skills', 'Manage showroom customer interactions, inventory verification, and sales closure.'),
(3, 'JOB-2026-003', 'Software Quality Engineer', 'Konexus IT Solutions', 'CR-90412-1', 'Technology & Systems', 550.000, 1, 'active', 'Bachelor in CS/IT, QA automation tools knowledge', 'Execute test plans and automated testing for government enterprise platforms.')
ON DUPLICATE KEY UPDATE `job_title` = VALUES(`job_title`);

-- 5. Candidates
INSERT INTO `candidates` (`id`, `ref_no`, `full_name`, `cpr_no`, `gender`, `education`, `salary_bhd`, `position_title`, `company_name`, `employer_cr`, `mol_certified`, `joining_date`, `case_manager_id`, `case_manager_name`, `status`, `checklist_completion_pct`) VALUES
(1, 'JCP/26/268524', 'LULWA EZZ EBRAHIM ALBANKI', '990408710', 'Female', 'Bachelors +', 500.000, 'Quality Analyst', 'BAHRAIN PHARMA', 'CR-45892-1', 'Yes', '2025-10-15', 4, 'Meaad', 'active', 100),
(2, 'JCP/25/172042', 'WALEED ABDULWAHID J ABDULAZIZ', '040710890', 'Male', 'High School', 350.000, 'Sales Representative', 'CENTRE POINT COLOUR', 'CR-12048-2', 'Yes', '2025-08-01', 3, 'Husain', 'active', 100),
(3, 'JCP/24/057296', 'ASMA MOHAMMAD ASHFAQMO DIN', '010706941', 'Female', 'Bachelors +', 500.000, 'QA Specialist', 'Konexus IT Solutions', 'CR-90412-1', 'Yes', '2025-09-10', 4, 'Meaad', 'active', 100),
(4, 'JCP/25/218398', 'ZIYAD TAREQ MAJEDA ALTHAWADI', '980309620', 'Male', 'Bachelors +', 508.000, 'Sales Executive', 'Bahrain Duty Free', 'CR-00215-4', 'Yes', '2025-07-20', 6, 'Malak', 'active', 100),
(5, 'JCP/25/215389', 'DINA MOHAMED YUSUF ALDOSERI', '010408520', 'Female', 'Bachelors +', 620.000, 'Clinical Administrator', 'KOREAN MEDICAL CENTER', 'CR-88201-1', 'Yes', '2025-06-15', 5, 'Dina', 'active', 100)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- 6. Milestones
INSERT INTO `milestones` (`id`, `candidate_id`, `milestone_type`, `milestone_title`, `due_date`, `status`, `alert_dispatched`) VALUES
(1, 1, 'placement', 'Placement Claim (Day 0)', '2025-10-15', 'claimed', 1),
(2, 2, 'placement', 'Placement Claim (Day 0)', '2025-08-01', 'claimed', 1),
(3, 3, '180_days', '6-Month Claim (+180d)', '2026-03-09', 'disputed', 1),
(4, 4, 'placement', 'Placement Claim (Day 0)', '2025-07-20', 'claimed', 1),
(5, 5, '365_days', '12-Month Claim (+365d)', '2026-06-15', 'due', 1)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 7. Claims
INSERT INTO `claims` (`id`, `claim_ref`, `candidate_id`, `milestone_id`, `claim_type`, `claim_amount_bhd`, `status`, `claim_date`, `case_manager_id`, `case_manager_name`, `remarks`) VALUES
(1, 'CLM-2025-001', 1, 1, 'placement', 797.500, 'settled', '2025-10-20', 4, 'Meaad', 'Approved standard placement claim for Bahrain Pharma'),
(2, 'CLM-2025-002', 2, 2, 'placement', 605.000, 'settled', '2025-08-05', 3, 'Husain', 'Initial placement agreed contract amount'),
(3, 'CLM-2026-003', 3, 3, '180_days', 797.500, 'disputed', '2026-03-12', 4, 'Meaad', 'Employer reported resignation notice during month 5'),
(4, 'CLM-2025-004', 4, 4, 'placement', 660.000, 'settled', '2025-07-25', 6, 'Malak', 'Placement agreed for Duty Free'),
(5, 'CLM-2026-005', 5, 5, '365_days', 880.000, 'undisputed', '2026-06-20', 5, 'Dina', '12-month retention milestone claim awaiting full ministry clearance')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 8. Disputes
INSERT INTO `disputes` (`id`, `claim_id`, `dispute_category`, `dispute_reason`, `dispute_date`, `status`, `resolution_notes`, `handled_by_user_id`) VALUES
(1, 3, 'Employer Disagreement', 'Employer claims candidate tendered resignation before completing 180 days.', '2026-03-15', 'active_dispute', 'Case manager reviewing GOSI exit records with Ministry', 4),
(2, 1, 'Wage Discrepancy', 'Initial wage subsidy gate variance flagged during automated payroll audit.', '2025-11-01', 'reinstated', 'Salary bank transfer slip verified against Tamkeen subsidy guidelines', 4),
(3, 2, 'Probation Review', 'Probation evaluation document submission delayed by employer HR department.', '2025-08-20', 'reinstated', 'Clarified with Ministry inspector, candidate active on GOSI', 3),
(4, 4, 'Documentation Gap', 'GOSI contribution receipt requested for corporate registration.', '2025-08-01', 'reinstated', 'Official receipt uploaded and verified with Ministry', 6),
(5, 5, 'Attendance Discrepancy', 'Biometric attendance verification variance in retention record.', '2026-06-25', 'active_dispute', 'Case manager reviewing official company timesheet', 5)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 9. Payments
INSERT INTO `payments` (`id`, `receipt_no`, `claim_id`, `payment_date`, `amount_paid_bhd`, `payment_method`, `reference_doc_no`, `cashier_notes`) VALUES
(1, 'RCPT-2025-0142', 1, '2025-11-10', 797.500, 'Bank Transfer', 'BBK-TRF-994102', 'Full payment settled via BBK wire'),
(2, 'RCPT-2025-0108', 2, '2025-08-25', 605.000, 'Cheque', 'NBB-CHQ-44810', 'Cheque cleared NBB'),
(3, 'RCPT-2025-0091', 4, '2025-08-12', 660.000, 'Cheque', 'BIB-CHQ-00219', 'Settled in full for Duty Free placement claim'),
(4, 'RCPT-2026-0045', 5, '2026-07-05', 440.000, 'Bank Transfer', 'NBB-TRF-66104', 'First installment 50% paid for 12-month claim'),
(5, 'RCPT-2026-0082', 5, '2026-08-10', 440.000, 'Bank Transfer', 'BISB-TRF-77192', 'Second installment final settlement completed')
ON DUPLICATE KEY UPDATE `amount_paid_bhd` = VALUES(`amount_paid_bhd`);

SET FOREIGN_KEY_CHECKS = 1;
