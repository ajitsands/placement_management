-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- Day Before Yesterday's Database Schema Changes (2026-11-09)
-- Purpose: Training & Career Fair Modules, Event Attendance, Candidate Center Selection
-- =========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add Center column to Candidates Table (Enma Mall, Career Fair, Training, etc.)
ALTER TABLE `candidates`
    ADD COLUMN IF NOT EXISTS `center` VARCHAR(100) NOT NULL DEFAULT 'Enma Mall' AFTER `case_manager_name`;

-- 2. Create Training & Career Fair Events Table
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

-- 3. Create Event Candidate Attendees Table
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

SET FOREIGN_KEY_CHECKS = 1;

