-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- Database Schema Migration: Job Interviews & Candidate Evaluation (2026-11-12)
-- Purpose: Interview Scheduling against Job Openings, Candidate Rosters, 
--          Evaluation Outcomes, and Candidate Audit Trail Integration
-- =========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create Job Interviews Table
CREATE TABLE IF NOT EXISTS `job_interviews` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `interview_code` VARCHAR(64) NOT NULL UNIQUE,
    `job_id` INT NOT NULL,
    `interview_date` DATE NOT NULL,
    `interview_time` VARCHAR(64) NULL,
    `location` VARCHAR(255) NOT NULL,
    `remarks` TEXT NULL,
    `status` ENUM('scheduled', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `created_by` INT NULL,
    `created_by_name` VARCHAR(150) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE,
    INDEX `idx_ji_job` (`job_id`),
    INDEX `idx_ji_date` (`interview_date`),
    INDEX `idx_ji_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Create Job Interview Candidate Rosters & Outcomes Table
CREATE TABLE IF NOT EXISTS `job_interview_candidates` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `interview_id` INT NOT NULL,
    `candidate_id` INT NOT NULL,
    `status` ENUM('scheduled', 'attended', 'passed', 'rejected', 'absent', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `remarks` TEXT NULL,
    `attended_at` DATETIME NULL,
    `updated_by_name` VARCHAR(150) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_interview_candidate` (`interview_id`, `candidate_id`),
    FOREIGN KEY (`interview_id`) REFERENCES `job_interviews`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON DELETE CASCADE,
    INDEX `idx_jic_interview` (`interview_id`),
    INDEX `idx_jic_candidate` (`candidate_id`),
    INDEX `idx_jic_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
