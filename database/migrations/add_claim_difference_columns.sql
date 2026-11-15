-- =========================================================================
-- Candidate Placement & Claims Management System (JCP-CMS)
-- Database Migration: Add company_claim_amount_bhd & difference_amount_bhd to claims table
-- Purpose: Track company claimed amount vs Tamkeen portal approved amount and variance
-- =========================================================================

SET NAMES utf8mb4;

-- 1. Add company_claim_amount_bhd and difference_amount_bhd columns to claims table
ALTER TABLE `claims`
    ADD COLUMN `company_claim_amount_bhd` DECIMAL(10, 3) NULL DEFAULT NULL AFTER `claim_amount_bhd`,
    ADD COLUMN `difference_amount_bhd` DECIMAL(10, 3) NULL DEFAULT 0.000 AFTER `company_claim_amount_bhd`;
