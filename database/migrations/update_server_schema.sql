-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- Database Server Update & Migration Script
-- Target Database: MySQL 8.0+ / MariaDB (e.g., teamtoob_hr_db / claims_db)
-- Purpose: Apply all recent schema changes, table additions, and column updates
-- Run this script via phpMyAdmin, MySQL CLI, or Workbench on your live server.
-- =========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------------------
-- 1. CANDIDATES TABLE UPDATES (Job Center & Tamkeen Approvals, Center, etc.)
-- -------------------------------------------------------------------------

-- 1.1 Center & Registration Metadata
ALTER TABLE `candidates`
    ADD COLUMN IF NOT EXISTS `center` VARCHAR(100) NOT NULL DEFAULT 'Enma Mall' AFTER `case_manager_name`,
    ADD COLUMN IF NOT EXISTS `date_of_birth` DATE NULL AFTER `education`,
    ADD COLUMN IF NOT EXISTS `phone` VARCHAR(64) NULL AFTER `cpr_no`,
    ADD COLUMN IF NOT EXISTS `email` VARCHAR(191) NULL AFTER `phone`;

-- 1.2 Linked Job Vacancy
ALTER TABLE `candidates`
    ADD COLUMN IF NOT EXISTS `job_id` INT NULL,
    ADD COLUMN IF NOT EXISTS `job_code` VARCHAR(64) NULL;

-- 1.3 Registration Checklist & Verification
ALTER TABLE `candidates`
    ADD COLUMN IF NOT EXISTS `checklist_completion_pct` INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `checklist_items` LONGTEXT NULL;

-- 1.4 12-Month Validity & Renewal Tracking
ALTER TABLE `candidates`
    ADD COLUMN IF NOT EXISTS `last_renewal_date` DATE NULL AFTER `registration_date`,
    ADD COLUMN IF NOT EXISTS `renewals_count` INT NOT NULL DEFAULT 0 AFTER `last_renewal_date`,
    ADD COLUMN IF NOT EXISTS `renewal_history` LONGTEXT NULL AFTER `renewals_count`;

-- 1.5 Ministry Job Center & Tamkeen Scheme Approvals
ALTER TABLE `candidates`
    ADD COLUMN IF NOT EXISTS `approved_by_job_center` VARCHAR(16) NOT NULL DEFAULT 'Yes',
    ADD COLUMN IF NOT EXISTS `job_center_approved_at` DATETIME NULL,
    ADD COLUMN IF NOT EXISTS `job_center_approved_by` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `approved_by_tamkeen` VARCHAR(16) NOT NULL DEFAULT 'No',
    ADD COLUMN IF NOT EXISTS `tamkeen_approval_date` DATE NULL,
    ADD COLUMN IF NOT EXISTS `tamkeen_approval_notes` TEXT NULL,
    ADD COLUMN IF NOT EXISTS `tamkeen_approved_by` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `tamkeen_approved_at` DATETIME NULL;

-- 1.6 Ensure Status Column Length
ALTER TABLE `candidates`
    MODIFY COLUMN `status` VARCHAR(64) NOT NULL DEFAULT 'registered';

-- -------------------------------------------------------------------------
-- 2. DISPUTES TABLE UPDATES (Attachments, Remarks, Reinstatement/Termination)
-- -------------------------------------------------------------------------
ALTER TABLE `disputes`
    ADD COLUMN IF NOT EXISTS `candidate_id` INT NULL AFTER `claim_id`,
    ADD COLUMN IF NOT EXISTS `milestone_id` INT NULL AFTER `candidate_id`,
    ADD COLUMN IF NOT EXISTS `remarks` TEXT NULL AFTER `resolution_notes`,
    ADD COLUMN IF NOT EXISTS `attachments` LONGTEXT NULL AFTER `remarks`,
    ADD COLUMN IF NOT EXISTS `reinstated_date` DATE NULL AFTER `attachments`,
    ADD COLUMN IF NOT EXISTS `terminated_date` DATE NULL AFTER `reinstated_date`;

-- -------------------------------------------------------------------------
-- 3. AUDIT LOGS TABLE UPDATES (Officer Name & Entity Reference)
-- -------------------------------------------------------------------------
ALTER TABLE `audit_logs`
    ADD COLUMN IF NOT EXISTS `user_full_name` VARCHAR(128) NULL AFTER `username`,
    ADD COLUMN IF NOT EXISTS `entity_ref` VARCHAR(64) NULL AFTER `entity_id`;

-- -------------------------------------------------------------------------
-- 4. NEW TABLES CREATION (If not already present on server)
-- -------------------------------------------------------------------------

-- 4.1 Employer Jobs & Vacancies Table
CREATE TABLE IF NOT EXISTS `jobs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `job_code` VARCHAR(64) NOT NULL UNIQUE,
    `job_title` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NOT NULL,
    `employer_cr` VARCHAR(64) NULL,
    `department` VARCHAR(128) NULL,
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

-- 4.2 Candidate Registration Compliance Checklist Master
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

-- 4.3 Candidate Document Category Master
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

-- 4.4 Training & Career Fair Events Table
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

-- 4.5 Event Candidate Attendees Table
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

-- 4.6 Audit Logs Table (Full Traceability for PDPL Compliance)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `username` VARCHAR(64) NOT NULL,
    `user_full_name` VARCHAR(128) NULL,
    `role` VARCHAR(32) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
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

SET FOREIGN_KEY_CHECKS = 1;
