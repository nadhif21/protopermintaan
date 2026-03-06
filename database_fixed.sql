-- Database structure untuk migrasi dari spreadsheet ke MySQL

CREATE DATABASE IF NOT EXISTS protopermintaan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE protopermintaan;

-- Tabel untuk data permintaan
CREATE TABLE IF NOT EXISTS `permintaan` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `row_number` INT NOT NULL,
    `col_a` TEXT,
    `col_b` TEXT,
    `col_c` TEXT,
    `col_d` TEXT,
    `col_e` TEXT,
    `col_f` TEXT,
    `col_g` TEXT,
    `col_h` TEXT,
    `col_i` TEXT,
    `col_j` TEXT,
    `col_k` TEXT,
    `col_l` TEXT,
    `pilih_permintaan` VARCHAR(255),
    `timestamp` DATETIME,
    `status` VARCHAR(50) DEFAULT 'Open',
    `flag` VARCHAR(50),
    `petugas` VARCHAR(255),
    `waktu_selesai` DATETIME,
    `keterangan` TEXT,
    `persetujuan` TEXT,
    `alasan_permintaan` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_status` (`status`),
    INDEX `idx_flag` (`flag`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_row_number` (`row_number`),
    INDEX `idx_pilih_permintaan` (`pilih_permintaan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel untuk data backdate
CREATE TABLE IF NOT EXISTS `backdate` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `row_number` INT NOT NULL,
    `col_a` TEXT,
    `col_b` TEXT,
    `col_c` TEXT,
    `col_d` TEXT,
    `col_e` TEXT,
    `col_f` TEXT,
    `col_g` TEXT,
    `col_h` TEXT,
    `col_i` TEXT,
    `col_j` TEXT,
    `nomor_surat_key` TEXT,
    `timestamp` DATETIME,
    `status` VARCHAR(50) DEFAULT 'Open',
    `flag` VARCHAR(50),
    `timestamp_selesai` DATETIME,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_status` (`status`),
    INDEX `idx_flag` (`flag`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_row_number` (`row_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel untuk data perjanjian backdate
CREATE TABLE IF NOT EXISTS `perjanjian` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `row_number` INT NOT NULL,
    `unit_kerja` VARCHAR(255) NOT NULL,
    `no_sp` VARCHAR(255) NOT NULL,
    `perihal` TEXT NOT NULL,
    `key_nomor_surat` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_key` (`key_nomor_surat`),
    INDEX `idx_row_number` (`row_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
