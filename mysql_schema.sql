-- =============================================================================
-- AE INSIGHT - Academic Excellence Intelligence & Insights Platform
-- Complete MySQL Database Schema Definition
-- Compatible with: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+, AWS RDS, Google Cloud SQL
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci | Storage Engine: InnoDB
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `afae_aeinsight`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `afae_aeinsight`;

-- -----------------------------------------------------------------------------
-- 1. Table: uploads
-- Stores spreadsheet upload metadata, processing status, and validation metrics.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `uploads` (
  `id` VARCHAR(255) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `sheet_name` VARCHAR(255) NOT NULL,
  `uploaded_by` VARCHAR(255) NOT NULL,
  `uploaded_at` VARCHAR(100) NOT NULL,
  `row_count` INT NOT NULL DEFAULT 0,
  `valid_row_count` INT NOT NULL DEFAULT 0,
  `invalid_row_count` INT NOT NULL DEFAULT 0,
  `duplicate_count` INT NOT NULL DEFAULT 0,
  `processing_status` VARCHAR(50) NOT NULL DEFAULT 'completed',
  `processing_duration_ms` INT NOT NULL DEFAULT 0,
  `source_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_uploads_uploaded_at` (`uploaded_at`),
  INDEX `idx_uploads_uploaded_by` (`uploaded_by`),
  INDEX `idx_uploads_status` (`processing_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Table: raw_records
-- Master operational dataset storing 30-column academic data and computed flags.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `raw_records` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `center_code` VARCHAR(100) NULL,
  `funder_name` VARCHAR(255) NULL,
  `program_name` VARCHAR(255) NULL,
  `assigned_trainers` VARCHAR(255) NULL,
  `assigned_ae` VARCHAR(255) NULL,
  `rm_sh_zh` VARCHAR(255) NULL,
  `batch_code` VARCHAR(100) NULL,
  `course_code` VARCHAR(100) NULL,
  `batch_start_date` DATE NULL,
  `batch_initial_start_date` DATE NULL,
  `batch_initial_end_date` DATE NULL,
  `batch_end_date` DATE NULL,
  `batch_actual_end_date` DATE NULL,
  `batch_status` VARCHAR(100) NULL,
  `batch_validation_status` VARCHAR(100) NULL DEFAULT 'Not Yet Validated',
  `student_code` VARCHAR(100) NULL,
  `enrollment_status` VARCHAR(100) NULL,
  `dropout_type` VARCHAR(100) NULL,
  `email_verification_status` VARCHAR(50) NULL DEFAULT 'y',
  `final_exam_marks` DOUBLE NULL,
  `placement_type` VARCHAR(100) NULL,
  `exam_schedule_date` DATE NULL,
  `ilt_completion` DOUBLE NULL,
  `ilt_as_on_joining_date` DOUBLE NULL,
  `fm_class_completion` DOUBLE NULL,
  `running_attendance` DOUBLE NULL,
  `beneficiary_class_attendance` DOUBLE NULL,
  `incomplete_attendance_exception` TINYINT(1) NOT NULL DEFAULT 0,
  `incomplete_module_exception` TINYINT(1) NOT NULL DEFAULT 0,
  `special_case` VARCHAR(50) NULL COMMENT 'Special Case flag (1 = exempt from exceptions)',
  `joining_date` DATE NULL,
  `validation_status` VARCHAR(100) NULL DEFAULT 'Not Available',
  `validation_done_by` VARCHAR(255) NULL,
  `upload_id` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_records_center_code` (`center_code`),
  INDEX `idx_records_batch_code` (`batch_code`),
  INDEX `idx_records_student_code` (`student_code`),
  INDEX `idx_records_student_batch` (`student_code`, `batch_code`),
  INDEX `idx_records_program_name` (`program_name`(100)),
  INDEX `idx_records_funder_name` (`funder_name`(100)),
  INDEX `idx_records_rm_sh_zh` (`rm_sh_zh`(100)),
  INDEX `idx_records_assigned_trainers` (`assigned_trainers`(100)),
  INDEX `idx_records_assigned_ae` (`assigned_ae`(100)),
  INDEX `idx_records_batch_status` (`batch_status`),
  INDEX `idx_records_enrollment_status` (`enrollment_status`),
  INDEX `idx_records_dropout_type` (`dropout_type`),
  INDEX `idx_records_validation_status` (`validation_status`),
  INDEX `idx_records_exceptions` (`incomplete_attendance_exception`, `incomplete_module_exception`),
  INDEX `idx_records_start_date` (`batch_start_date`),
  INDEX `idx_records_upload_id` (`upload_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Table: audit_logs
-- Immutable governance activity trail for imports, thresholds, and administrative actions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(255) NOT NULL,
  `user_email` VARCHAR(255) NOT NULL,
  `user_role` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `timestamp` VARCHAR(100) NOT NULL,
  `upload_id` VARCHAR(255) NULL,
  `details` TEXT NOT NULL,
  `result` VARCHAR(50) NOT NULL DEFAULT 'success',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_timestamp` (`timestamp`),
  INDEX `idx_audit_user` (`user_email`),
  INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Table: operational_settings
-- Configurable organizational KPI thresholds.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operational_settings` (
  `id` INT NOT NULL DEFAULT 1,
  `attendance_threshold` DOUBLE NOT NULL DEFAULT 0.75,
  `completion_threshold` DOUBLE NOT NULL DEFAULT 0.80,
  `batch_delay_threshold_days` INT NOT NULL DEFAULT 0,
  `dropout_alert_threshold` DOUBLE NOT NULL DEFAULT 0.15,
  `enable_faculty_deployment_index` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default settings if not exists
INSERT INTO `operational_settings` (`id`, `attendance_threshold`, `completion_threshold`, `batch_delay_threshold_days`, `dropout_alert_threshold`, `enable_faculty_deployment_index`)
VALUES (1, 0.75, 0.80, 0, 0.15, 1)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- -----------------------------------------------------------------------------
-- 5. Table: restore_points
-- Metadata tracking point-in-time system backups and snapshots.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `restore_points` (
  `id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `created_at` VARCHAR(100) NOT NULL,
  `file_size` BIGINT NOT NULL DEFAULT 0,
  `file_size_formatted` VARCHAR(50) NOT NULL,
  `record_count` INT NOT NULL DEFAULT 0,
  `batch_count` INT NOT NULL DEFAULT 0,
  `upload_count` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(255) NOT NULL,
  `is_baseline` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_restore_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Table: users
-- User profiles, access roles, and permissions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `permissions` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Table: scheduled_vs_conducted
-- Tracks scheduled online sessions vs actual conducted classes, FM attendance, and G-meet data.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `scheduled_vs_conducted` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `slot_date` VARCHAR(100) NULL,
  `fm_email_id` VARCHAR(255) NULL,
  `batch_code` VARCHAR(100) NULL,
  `actual_center_code` VARCHAR(100) NULL,
  `program_name` VARCHAR(255) NULL,
  `gmeet_id` VARCHAR(255) NULL,
  `batch_status` VARCHAR(100) NULL,
  `actual_status` VARCHAR(100) NULL,
  `schedule_class_start_time` VARCHAR(100) NULL,
  `actual_class_started` VARCHAR(100) NULL,
  `schedule_class_end_time` VARCHAR(100) NULL,
  `actual_class_ended` VARCHAR(100) NULL,
  `class_link` TEXT NULL,
  `form_status` VARCHAR(100) NULL,
  `upload_id` VARCHAR(255) NULL,
  `uploaded_by` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_svc_slot_date` (`slot_date`),
  INDEX `idx_svc_fm_email` (`fm_email_id`),
  INDEX `idx_svc_batch_code` (`batch_code`),
  INDEX `idx_svc_actual_center` (`actual_center_code`),
  INDEX `idx_svc_program_name` (`program_name`(100)),
  INDEX `idx_svc_actual_status` (`actual_status`),
  INDEX `idx_svc_upload_id` (`upload_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Table: slot_replacement
-- Tracks trainer slot replacement requests, rescheduling dates, approvals, and reasons.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `slot_replacement` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `emp_code` VARCHAR(100) NULL,
  `trainer_name` VARCHAR(255) NULL,
  `batch_code` VARCHAR(100) NULL,
  `alias` VARCHAR(255) NULL,
  `actual_class_date` VARCHAR(100) NULL,
  `replacement_class_date` VARCHAR(100) NULL,
  `center_code` VARCHAR(100) NULL,
  `center_name` VARCHAR(255) NULL,
  `approved_rejected_by` VARCHAR(255) NULL,
  `approval_rejected_date` VARCHAR(100) NULL,
  `requested_date` VARCHAR(100) NULL,
  `request_status` VARCHAR(100) NULL,
  `reason` TEXT NULL,
  `upload_id` VARCHAR(255) NULL,
  `uploaded_by` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sr_emp_code` (`emp_code`),
  INDEX `idx_sr_batch_code` (`batch_code`),
  INDEX `idx_sr_center_code` (`center_code`),
  INDEX `idx_sr_request_status` (`request_status`),
  INDEX `idx_sr_upload_id` (`upload_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

