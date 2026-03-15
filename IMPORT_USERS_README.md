# Panduan Import Users dari CSV

Script ini digunakan untuk mengimport data users dari file CSV ke tabel `users` dengan ketentuan:
- Role otomatis diset sebagai `user`
- Unit kerja divalidasi dengan tabel `unit_kerja` (jika tidak sesuai, akan dikosongkan)
- Tidak ada duplikasi NPK (1 NPK = 1 User)
- Username harus unik

## File yang Tersedia

1. **import_users.php** - Script PHP (RECOMMENDED)
   - Lebih mudah digunakan
   - Validasi otomatis
   - Laporan hasil import yang detail

2. **import_users.sql** - Script SQL
   - Menggunakan LOAD DATA (jika didukung)
   - Atau bisa digunakan dengan temporary table

## Cara Menggunakan Script PHP (RECOMMENDED)

### Langkah 1: Siapkan File CSV
- **Pindahkan file CSV ke folder `import/`** di dalam project
- Lokasi: `permintaandof/import/user - Sheet1 (1).csv`
- Format CSV harus sesuai: `npk,name,unit_kerja,nomor_telepon,email,username,password_hash`

### Langkah 2: Pastikan File CSV di Folder Import
Script akan otomatis membaca file dari folder `import/`. 
Jika nama file berbeda, edit di `import_users.php`:
```php
$csvFile = __DIR__ . '/import/nama-file-anda.csv';
```

### Langkah 3: Jalankan Script
**Via Browser:**
- Akses: `http://localhost/permintaandof/import_users.php`
- Atau sesuaikan dengan URL server Anda

**Via Command Line:**
```bash
php import_users.php
```

### Langkah 4: Lihat Hasil
Script akan menampilkan:
- Total baris di CSV
- Jumlah data berhasil diimport
- Jumlah data yang di-skip beserta alasannya

## Cara Menggunakan Script SQL

### Opsi 1: Menggunakan LOAD DATA (jika didukung)

1. Buka phpMyAdmin atau MySQL client
2. Sesuaikan path file CSV di script SQL
3. Uncomment bagian LOAD DATA:
```sql
LOAD DATA LOCAL INFILE 'C:/Users/USER HP/Downloads/user - Sheet1 (1).csv'
INTO TABLE temp_users_import
...
```
4. Jalankan script SQL

**Catatan:** LOAD DATA mungkin tidak didukung di semua server. Jika error, gunakan Opsi 2 atau script PHP.

### Opsi 2: Menggunakan Temporary Table Manual

1. Buka `import_users.sql`
2. Comment bagian LOAD DATA
3. Insert data secara manual ke temporary table atau gunakan script PHP untuk generate INSERT statements

## Validasi yang Dilakukan

1. **Unit Kerja:**
   - Unit kerja dari CSV akan dicocokkan dengan tabel `unit_kerja`
   - Hanya unit kerja yang ada di tabel `unit_kerja` (dan `is_active = 1`) yang akan disimpan
   - Jika tidak ditemukan, field `unit_kerja` akan dikosongkan (NULL)

2. **Duplikasi NPK:**
   - Jika ada beberapa baris dengan NPK yang sama di CSV, hanya baris pertama yang akan diambil
   - Jika NPK sudah ada di database, data akan di-skip

3. **Duplikasi Username:**
   - Jika username sudah ada di database, data akan di-skip

4. **Data Wajib:**
   - Username, name, dan password_hash harus ada
   - Jika tidak ada, data akan di-skip

## Troubleshooting

### Error: File CSV tidak ditemukan
- Pastikan path file CSV benar
- Pastikan file ada di lokasi yang ditentukan

### Error: Connection failed
- Pastikan kredensial database di `config.php` benar
- Pastikan database server berjalan

### Tidak ada data yang terimport
- Periksa apakah semua data sudah ada di database (username atau NPK duplikat)
- Periksa apakah unit kerja sudah ada di tabel `unit_kerja`
- Periksa log error untuk detail lebih lanjut

### Unit kerja tidak tersimpan
- Pastikan unit kerja di CSV sama persis dengan yang ada di tabel `unit_kerja`
- Perhatikan huruf besar/kecil dan spasi
- Unit kerja yang tidak ditemukan akan dikosongkan (NULL)

## Catatan Penting

- **Backup database** sebelum melakukan import
- Script menggunakan transaction, jika ada error semua perubahan akan di-rollback
- Pastikan tabel `unit_kerja` sudah berisi data sebelum import
- Script akan skip data yang sudah ada (berdasarkan username atau NPK)
