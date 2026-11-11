-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- Database: MySQL 8.0+
-- Prepared for: Enterprise Placement & Claims Operations (Bahrain & GCC)
-- Architecture: Strictly Relational ACID Schema with Foreign Keys & Indexes
-- =========================================================================

-- Database initialization: Default target teamtoob_hr_db (or selected database in phpMyAdmin)
-- CREATE DATABASE IF NOT EXISTS `teamtoob_hr_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `teamtoob_hr_db`;

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
    `case_manager_code` VARCHAR(32) NULL, -- e.g. 'Husain', 'Meaad', 'Dina', 'Malak'
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
    `ref_no` VARCHAR(64) NOT NULL UNIQUE, -- e.g. JCP/26/268524
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
    `mol_certified` VARCHAR(16) DEFAULT 'Yes', -- 'Yes', 'No', 'N/A'
    `long_mol` VARCHAR(16) DEFAULT 'No', -- 'Yes', 'No', 'N/A'
    `registration_date` DATE NULL,
    `last_renewal_date` DATE NULL, -- Date of most recent 12-month registration renewal
    `renewals_count` INT NOT NULL DEFAULT 0, -- Total renewals performed
    `renewal_history` LONGTEXT NULL, -- JSON array of renewal events, previous dates, overdue days & remarks
    `status` VARCHAR(64) NOT NULL DEFAULT 'registered',
    `joining_date` DATE NULL,
    `case_manager_id` INT NULL,
    `case_manager_name` VARCHAR(64) NOT NULL, -- Denormalized for rapid filtering
    `center` VARCHAR(100) NOT NULL DEFAULT 'Enma Mall', -- 'Enma Mall', 'Career Fair', 'Training', 'Other Job Center'
    `notes` TEXT NULL,
    `comments` TEXT NULL, -- Placement comments
    `remarks` TEXT NULL,
    `documents` JSON NULL, -- Array of uploaded documents metadata
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `job_id` INT NULL,
    `job_code` VARCHAR(64) NULL,
    `checklist_completion_pct` INT NOT NULL DEFAULT 0,
    `checklist_items` LONGTEXT NULL,
    `approved_by_job_center` VARCHAR(16) NOT NULL DEFAULT 'Yes',
    `job_center_approved_at` DATETIME NULL,
    `job_center_approved_by` VARCHAR(191) NULL,
    `approved_by_tamkeen` VARCHAR(16) NOT NULL DEFAULT 'No',
    `tamkeen_approval_date` DATE NULL,
    `tamkeen_approval_notes` TEXT NULL,
    `tamkeen_approved_by` VARCHAR(191) NULL,
    `tamkeen_approved_at` DATETIME NULL,
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
    `assigned_case_managers` TEXT NULL,
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

-- 6. Candidate Document Category Master Table
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

-- 4. Milestone Triggers Table (Placement, 180-Day, 365-Day)
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

-- 5. Claims Table (Manual Claim Amount Entry)
CREATE TABLE IF NOT EXISTS `claims` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `claim_ref` VARCHAR(64) NOT NULL UNIQUE, -- e.g. CLM-2026-0001
    `candidate_id` INT NOT NULL,
    `milestone_id` INT NULL,
    `claim_type` ENUM('placement', '180_days', '365_days') NOT NULL,
    `claim_amount_bhd` DECIMAL(10, 3) NOT NULL, -- Manually entered by user
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

-- 6. Dispute Resolution & Termination Table
CREATE TABLE IF NOT EXISTS `disputes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `claim_id` INT NOT NULL,
    `candidate_id` INT NULL,
    `milestone_id` INT NULL,
    `dispute_category` VARCHAR(64) NOT NULL, -- 'Probation Termination', 'Employer Disagreement', 'Resignation', 'Wage Discrepancy'
    `dispute_reason` TEXT NOT NULL,
    `dispute_date` DATE NOT NULL,
    `status` ENUM('active_dispute', 'reinstated', 'terminated') NOT NULL DEFAULT 'active_dispute',
    `resolution_notes` TEXT NULL,
    `remarks` TEXT NULL,
    `attachments` LONGTEXT NULL,
    `reinstated_date` DATE NULL,
    `terminated_date` DATE NULL,
    `handled_by_user_id` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON DELETE CASCADE,
    INDEX `idx_disputes_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Payment Collections & Reconciliation Ledger Table
CREATE TABLE IF NOT EXISTS `payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `receipt_no` VARCHAR(64) NOT NULL UNIQUE, -- e.g. RCPT-2026-0082
    `claim_id` INT NOT NULL,
    `payment_date` DATE NOT NULL,
    `amount_paid_bhd` DECIMAL(10, 3) NOT NULL,
    `payment_method` ENUM('Bank Transfer', 'Cheque', 'BenefitPay', 'Cash') DEFAULT 'Bank Transfer',
    `reference_doc_no` VARCHAR(64) NULL, -- Cheque number or bank transfer reference
    `cashier_notes` VARCHAR(255) NULL,
    `attachments` LONGTEXT NULL, -- JSON array of receipt vouchers, wire slips, bank proofs
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON DELETE CASCADE,
    INDEX `idx_payments_claim` (`claim_id`),
    INDEX `idx_payments_date` (`payment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Audit Logs Table (Full Traceability for PDPL Compliance)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `username` VARCHAR(64) NOT NULL,
    `user_full_name` VARCHAR(128) NULL,
    `role` VARCHAR(32) NOT NULL,
    `action` VARCHAR(64) NOT NULL, -- e.g. 'CLAIM_CREATED', 'DISPUTE_LOGGED', 'PAYMENT_RECORDED', 'USER_CREATED'
    `entity_type` VARCHAR(64) NOT NULL,
    `entity_id` INT NULL,
    `entity_ref` VARCHAR(64) NULL,
    `details` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_action` (`action`),
    INDEX `idx_audit_user` (`user_id`),
    INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Training & Career Fair Events Table
CREATE TABLE IF NOT EXISTS `events` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `event_code` VARCHAR(64) NOT NULL UNIQUE,
    `module_type` ENUM('training', 'career_fair') NOT NULL DEFAULT 'training',
    `title` VARCHAR(255) NOT NULL,
    `event_date` DATE NOT NULL,
    `event_time` VARCHAR(64) NULL,
    `location` VARCHAR(255) NOT NULL,
    `remarks` TEXT NULL,
    `status` ENUM('upcoming', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'upcoming',
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_events_module` (`module_type`),
    INDEX `idx_events_date` (`event_date`),
    INDEX `idx_events_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Event Candidate Attendees Table
CREATE TABLE IF NOT EXISTS `event_attendees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `event_id` INT NOT NULL,
    `candidate_id` INT NOT NULL,
    `status` ENUM('registered', 'attended', 'absent', 'cancelled') NOT NULL DEFAULT 'attended',
    `attended_at` DATETIME NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_event_candidate` (`event_id`, `candidate_id`),
    FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE,
    INDEX `idx_ea_event` (`event_id`),
    INDEX `idx_ea_candidate` (`candidate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
