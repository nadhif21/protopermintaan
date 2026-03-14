# Cara Update Version untuk Cache Busting

## Masalah
Browser cache membuat update CSS/JS tidak langsung terload di Hostinger.

## Solusi
Version parameter (`?v=202412011200`) sudah ditambahkan langsung di semua file HTML.

## Cara Update Version

### Langkah 1: Update Version Number
1. Buka file `VERSION.txt`
2. Update nomor version dengan format: `YYYYMMDDHHMM`
   - Contoh: `202412151430` = 15 Desember 2024, jam 14:30

### Langkah 2: Update di Semua File HTML
Gunakan salah satu cara berikut:

#### Cara A: Manual (Jika hanya beberapa file)
1. Buka setiap file HTML
2. Cari semua `?v=202412011200` (version lama)
3. Ganti dengan `?v=202412151430` (version baru)
4. Simpan

#### Cara B: Otomatis dengan Find & Replace
1. Buka editor dengan Find & Replace (Ctrl+H)
2. Find: `?v=202412011200` (version lama)
3. Replace: `?v=202412151430` (version baru)
4. Replace All di semua file HTML

#### Cara C: Menggunakan Script PHP (Jika ada PHP CLI)
```bash
php update-version.php
```
Jangan lupa update version di file `update-version.php` juga.

### Langkah 3: Update version.js
1. Buka file `version.js`
2. Update `const APP_VERSION = '202412011200';` menjadi version baru
3. Simpan

### Langkah 4: Upload ke Hostinger
Upload semua file yang sudah diupdate ke Hostinger.

## Catatan Penting
- Update version SETIAP KALI ada perubahan pada file CSS atau JS
- Gunakan timestamp yang unik untuk setiap deploy
- Version di HTML harus sama dengan version di `version.js`

## Format Version
Format: `YYYYMMDDHHMM`
- YYYY = Tahun (4 digit)
- MM = Bulan (2 digit, 01-12)
- DD = Tanggal (2 digit, 01-31)
- HH = Jam (2 digit, 00-23)
- MM = Menit (2 digit, 00-59)

Contoh:
- `202412011200` = 1 Desember 2024, jam 12:00
- `202412151430` = 15 Desember 2024, jam 14:30
- `202501010000` = 1 Januari 2025, jam 00:00
