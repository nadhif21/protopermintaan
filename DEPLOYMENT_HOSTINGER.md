# Panduan Deployment ke Hostinger

## Persiapan

### 1. Database Setup
Pastikan database MySQL sudah dibuat di Hostinger dengan konfigurasi berikut:
- **Host**: `auth-db1637.hstgr.io` (atau sesuai dengan host database Anda)
- **Username**: `u207689956_andaladkorpkt` (atau sesuai dengan username database Anda)
- **Password**: `Permintaandof2025!` (atau sesuai dengan password database Anda)
- **Database Name**: `u207689956_permintaandof` (atau sesuai dengan nama database Anda)

### 2. File Upload
Upload semua file aplikasi ke folder `public_html` di Hostinger melalui:
- **File Manager** di hPanel Hostinger, atau
- **FTP Client** (FileZilla, WinSCP, dll)

### 3. Struktur Folder
Pastikan struktur folder di server sama dengan struktur lokal:
```
public_html/
├── admin/
├── backdate/
├── permintaan/
├── api.php
├── config.php
├── index.html
├── .htaccess
└── ... (file lainnya)
```

## Konfigurasi

### 1. Update config.php
Pastikan konfigurasi database di `config.php` sudah sesuai dengan database Hostinger Anda:
```php
define('DB_HOST', 'auth-db1637.hstgr.io');
define('DB_USER', 'u207689956_andaladkorpkt');
define('DB_PASS', 'Permintaandof2025!');
define('DB_NAME', 'u207689956_permintaandof');
```

### 2. File .htaccess
File `.htaccess` sudah dikonfigurasi untuk:
- CORS support
- Security headers
- PHP settings untuk Hostinger
- Protection untuk file sensitif

### 3. PHP Version
Pastikan PHP version di Hostinger adalah **PHP 8.0 atau lebih tinggi**:
1. Login ke hPanel Hostinger
2. Pilih domain Anda
3. Buka **PHP Configuration**
4. Pilih **PHP 8.0** atau lebih tinggi
5. Klik **Save**

### 4. Database Import
Jika Anda memiliki file SQL untuk import:
1. Login ke hPanel Hostinger
2. Buka **phpMyAdmin**
3. Pilih database Anda
4. Klik tab **Import**
5. Pilih file SQL Anda
6. Klik **Go**

## Testing

### 1. Test Koneksi Database
Akses aplikasi melalui browser dan coba login untuk memastikan koneksi database berfungsi.

### 2. Test API
Pastikan file `api.php` dapat diakses dan merespons dengan benar.

### 3. Test CORS
Jika aplikasi diakses dari domain berbeda, pastikan CORS berfungsi dengan baik.

## Troubleshooting

### Error: "Koneksi database gagal"
- Periksa kredensial database di `config.php`
- Pastikan database sudah dibuat di Hostinger
- Pastikan username dan password database benar
- Periksa apakah host database benar (biasanya `localhost` untuk shared hosting, atau host khusus untuk database terpisah)

### Error: "500 Internal Server Error"
- Periksa file `.htaccess` apakah ada syntax error
- Periksa log error di hPanel Hostinger
- Pastikan PHP version sudah sesuai (8.0+)
- Pastikan semua file permission sudah benar (644 untuk file, 755 untuk folder)

### Error: "File not found" atau "404 Not Found"
- Pastikan semua file sudah diupload dengan benar
- Periksa struktur folder di server
- Pastikan file `index.html` ada di root folder

### CORS Error
- Pastikan file `.htaccess` sudah diupload
- Periksa apakah mod_headers enabled di server
- Pastikan header CORS sudah dikonfigurasi dengan benar

## Security Checklist

- [ ] File `config.php` sudah dilindungi oleh `.htaccess`
- [ ] Password database sudah kuat dan unik
- [ ] File `.htaccess` sudah dikonfigurasi dengan security headers
- [ ] SSL/HTTPS sudah diaktifkan (jika tersedia)
- [ ] File permission sudah benar (644 untuk file, 755 untuk folder)

## SSL/HTTPS Setup (Opsional)

Jika Anda memiliki SSL certificate:
1. Login ke hPanel Hostinger
2. Buka **SSL/TLS Status**
3. Aktifkan SSL untuk domain Anda
4. Uncomment baris di `.htaccess` untuk force HTTPS:
```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

## Support

Jika mengalami masalah, hubungi:
- **Hostinger Support**: https://www.hostinger.co.id/contact
- **Documentation**: https://support.hostinger.com/
