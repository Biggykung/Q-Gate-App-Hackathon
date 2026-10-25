CREATE DATABASE IF NOT EXISTS health_gate
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE health_gate;

CREATE TABLE IF NOT EXISTS patients (
  Patient_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  Patient_name VARCHAR(100) NOT NULL,
  Patient_age INT UNSIGNED NOT NULL,
  Patient_weight FLOAT UNSIGNED NULL,
  underlying_disease VARCHAR(100) NULL,
  health_fund VARCHAR(100) NULL,
  portal_code_hash CHAR(64) NULL,
  portal_code_expires_at DATETIME NULL,
  PRIMARY KEY (Patient_id),
  KEY idx_patient_portal_code_hash (portal_code_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS health_screening (
  Health_Screening_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id INT UNSIGNED NOT NULL,
  blood_sugar FLOAT UNSIGNED NULL,
  blood_pressure VARCHAR(100) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  qcard_uacr_risk VARCHAR(100) NULL,
  PRIMARY KEY (Health_Screening_id),
  KEY idx_screening_patient_created (patient_id, created_at),
  CONSTRAINT fk_patient
    FOREIGN KEY (patient_id) REFERENCES patients (Patient_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_recommendations (
  Ai_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id INT UNSIGNED NOT NULL,
  ai_module VARCHAR(100) NOT NULL,
  ai_response_text TEXT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Ai_id),
  KEY idx_ai_patient (patient_id),
  CONSTRAINT fk_patient_ai
    FOREIGN KEY (patient_id) REFERENCES patients (Patient_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'clinician', 'viewer', 'patient') NOT NULL DEFAULT 'clinician',
  patient_id INT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_patient (patient_id),
  CONSTRAINT fk_user_patient FOREIGN KEY (patient_id) REFERENCES patients (Patient_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
