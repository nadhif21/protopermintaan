-- Script Import Users dari CSV
-- Pastikan file CSV sudah di-upload ke server MySQL atau gunakan LOAD DATA

-- Step 1: Buat temporary table untuk menyimpan data dari CSV
DROP TEMPORARY TABLE IF EXISTS temp_users_import;

CREATE TEMPORARY TABLE temp_users_import (
    npk VARCHAR(50),
    name VARCHAR(120),
    unit_kerja VARCHAR(255),
    nomor_telepon VARCHAR(20),
    email VARCHAR(255),
    username VARCHAR(50),
    password_hash VARCHAR(255),
    row_num INT AUTO_INCREMENT PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Load data dari CSV (sesuaikan path file CSV Anda)
-- UNCOMMENT baris di bawah ini dan sesuaikan path file CSV Anda
/*
LOAD DATA LOCAL INFILE 'C:/Users/USER HP/Downloads/user - Sheet1 (1).csv'
INTO TABLE temp_users_import
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(npk, name, unit_kerja, nomor_telepon, email, username, password_hash);
*/

-- ALTERNATIF: Jika LOAD DATA tidak bisa digunakan, gunakan INSERT manual
-- Copy data dari CSV dan paste di sini, atau gunakan script PHP/Python untuk generate INSERT statements

-- Step 3: Bersihkan data - hapus duplikasi NPK (ambil yang pertama berdasarkan row_num)
DROP TEMPORARY TABLE IF EXISTS temp_users_dedup;

CREATE TEMPORARY TABLE temp_users_dedup AS
SELECT 
    t1.npk,
    t1.name,
    t1.unit_kerja,
    t1.nomor_telepon,
    t1.email,
    t1.username,
    t1.password_hash
FROM temp_users_import t1
INNER JOIN (
    SELECT npk, MIN(row_num) as min_row
    FROM temp_users_import
    WHERE npk IS NOT NULL AND npk != ''
    GROUP BY npk
) t2 ON t1.npk = t2.npk AND t1.row_num = t2.min_row;

-- Step 4: Validasi dan insert ke tabel users
-- Unit kerja akan disamakan dengan yang ada di tabel unit_kerja
-- Jika tidak ada yang sesuai, unit_kerja akan dikosongkan (NULL)

INSERT INTO users (
    username,
    name,
    npk,
    nomor_telepon,
    email,
    unit_kerja,
    role,
    password_hash,
    password,
    is_active,
    created_at,
    updated_at
)
SELECT 
    t.username,
    t.name,
    t.npk,
    NULLIF(TRIM(t.nomor_telepon), '') as nomor_telepon,
    NULLIF(TRIM(t.email), '') as email,
    -- Validasi unit_kerja: hanya ambil jika ada di tabel unit_kerja
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM unit_kerja uk 
            WHERE uk.nama_unit = TRIM(t.unit_kerja) 
            AND uk.is_active = 1
        ) THEN TRIM(t.unit_kerja)
        ELSE NULL
    END as unit_kerja,
    'user' as role,
    t.password_hash,
    NULL as password, -- password field bisa dikosongkan atau diisi dengan password_hash jika perlu
    1 as is_active,
    NOW() as created_at,
    NOW() as updated_at
FROM temp_users_dedup t
WHERE 
    -- Skip jika username sudah ada
    NOT EXISTS (SELECT 1 FROM users u WHERE u.username = t.username)
    -- Skip jika NPK sudah ada
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.npk = t.npk AND u.npk IS NOT NULL AND u.npk != '')
    -- Pastikan username tidak kosong
    AND t.username IS NOT NULL 
    AND TRIM(t.username) != ''
    -- Pastikan name tidak kosong
    AND t.name IS NOT NULL 
    AND TRIM(t.name) != ''
    -- Pastikan password_hash tidak kosong
    AND t.password_hash IS NOT NULL 
    AND TRIM(t.password_hash) != '';

-- Step 5: Tampilkan hasil
SELECT 
    COUNT(*) as total_imported,
    'Users berhasil diimport' as message
FROM users 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE);

-- Step 6: Tampilkan data yang gagal diimport (duplikasi atau data tidak valid)
SELECT 
    t.npk,
    t.username,
    t.name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users u WHERE u.username = t.username) THEN 'Username sudah ada'
        WHEN EXISTS (SELECT 1 FROM users u WHERE u.npk = t.npk AND u.npk IS NOT NULL AND u.npk != '') THEN 'NPK sudah ada'
        WHEN t.username IS NULL OR TRIM(t.username) = '' THEN 'Username kosong'
        WHEN t.name IS NULL OR TRIM(t.name) = '' THEN 'Name kosong'
        WHEN t.password_hash IS NULL OR TRIM(t.password_hash) = '' THEN 'Password hash kosong'
        ELSE 'Unknown error'
    END as reason
FROM temp_users_dedup t
WHERE NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE (u.username = t.username OR (u.npk = t.npk AND u.npk IS NOT NULL AND u.npk != ''))
    AND u.created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
);

-- Cleanup
DROP TEMPORARY TABLE IF EXISTS temp_users_import;
DROP TEMPORARY TABLE IF EXISTS temp_users_dedup;
