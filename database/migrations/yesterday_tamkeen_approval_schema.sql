-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- Yesterday's Database Schema Changes (2026-11-10)
-- Target: candidates table
-- Purpose: Ministry Job Center & Tamkeen Scheme Approvals
-- =========================================================================

SET NAMES utf8mb4;

-- 1. Add Ministry Job Center & Tamkeen Scheme Approval Columns
ALTER TABLE `candidates`
    ADD COLUMN IF NOT EXISTS `approved_by_job_center` VARCHAR(16) NOT NULL DEFAULT 'Yes',
    ADD COLUMN IF NOT EXISTS `job_center_approved_at` DATETIME NULL,
    ADD COLUMN IF NOT EXISTS `job_center_approved_by` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `approved_by_tamkeen` VARCHAR(16) NOT NULL DEFAULT 'No',
    ADD COLUMN IF NOT EXISTS `tamkeen_approval_date` DATE NULL,
    ADD COLUMN IF NOT EXISTS `tamkeen_approval_notes` TEXT NULL,
    ADD COLUMN IF NOT EXISTS `tamkeen_approved_by` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `tamkeen_approved_at` DATETIME NULL;

-- 2. Optional: Initialize existing records so all currently registered candidates have default approvals
UPDATE `candidates`
SET `approved_by_job_center` = 'Yes'
WHERE `approved_by_job_center` IS NULL OR `approved_by_job_center` = '';

UPDATE `candidates`
SET `approved_by_tamkeen` = 'No'
WHERE `approved_by_tamkeen` IS NULL OR `approved_by_tamkeen` = '';
