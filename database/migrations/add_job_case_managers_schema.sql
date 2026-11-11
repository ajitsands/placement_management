-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- Database Migration: Add assigned_case_managers to jobs table
-- Purpose: Enable multiple select Case Manager assignment to jobs
-- =========================================================================

SET NAMES utf8mb4;

-- 1. Add assigned_case_managers column to jobs table
ALTER TABLE `jobs`
    ADD COLUMN IF NOT EXISTS `assigned_case_managers` TEXT NULL;
