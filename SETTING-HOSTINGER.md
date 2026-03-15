# Settingan Hostinger untuk Memastikan Versi Terbaru Selalu Dimuat

## ✅ Yang Sudah Dikonfigurasi di .htaccess

File `.htaccess` sudah dikonfigurasi dengan:
- ✅ Cache Control headers untuk mencegah browser cache
- ✅ Disable ETag untuk mencegah caching issues
- ✅ Expires headers untuk force revalidation
- ✅ Meta tags di semua file HTML

## 🔧 Settingan Tambahan di Hostinger Panel

### 1. **Disable Server-Side Caching (Jika Ada)**

Di Hostinger Control Panel (hPanel):

1. Login ke **hPanel**
2. Masuk ke **Advanced** → **Caching**
3. **Disable** atau **Clear** semua cache:
   - Browser Cache: **OFF**
   - CDN Cache (jika ada): **OFF** atau **Clear Cache**
   - OpCache (PHP): Bisa tetap ON untuk performa, tapi pastikan file terbaru di-upload

### 2. **PHP Settings**

Di hPanel → **Advanced** → **PHP Configuration**:

- Pastikan **PHP Version** sesuai (PHP 8.x)
- **OpCache**: Bisa tetap ON, tapi pastikan file terbaru di-upload
- Jika ada masalah, bisa **Disable OpCache** sementara

### 3. **CDN Settings (Jika Menggunakan CDN)**

Jika menggunakan CDN di Hostinger:

1. Masuk ke **CDN Settings**
2. **Disable Cache** untuk:
   - File HTML (*.html)
   - File CSS (*.css)
   - File JavaScript (*.js)
3. Atau set **Cache TTL** ke **0 seconds**

### 4. **File Manager - Pastikan File Terbaru**

Saat upload file:

1. **Hapus file lama** sebelum upload file baru
2. Atau gunakan **Overwrite** saat upload
3. Pastikan **timestamp file** terbaru

### 5. **Browser Cache - Testing**

Setelah upload, test di browser:

1. **Hard Refresh**: `Ctrl + F5` (Windows) atau `Cmd + Shift + R` (Mac)
2. Atau buka **Developer Tools** (F12) → **Network Tab** → **Disable Cache**
3. Atau gunakan **Incognito/Private Mode**

## 🧪 Cara Test Apakah Versi Terbaru Terload

### Method 1: Check Network Tab
1. Buka browser → **F12** → **Network Tab**
2. Refresh halaman
3. Lihat file CSS/JS → pastikan parameter `?v=202503151200` ada
4. Lihat **Response Headers** → pastikan `Cache-Control: no-cache`

### Method 2: Check Version di Console
1. Buka browser → **F12** → **Console Tab**
2. Ketik: `localStorage.getItem('__APP_VERSION__')`
3. Harus menampilkan versi terbaru: `202503151200`

### Method 3: Check File Timestamp
1. Di Hostinger File Manager, cek **Last Modified** file
2. Pastikan timestamp sesuai dengan waktu upload terakhir

## ⚠️ Troubleshooting

### Jika Browser Masih Load Versi Lama:

1. **Clear Browser Cache**:
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy → Clear Data → Cached Web Content

2. **Check .htaccess**:
   - Pastikan file `.htaccess` sudah ter-upload
   - Pastikan mod_headers dan mod_expires enabled di server

3. **Check Server Logs**:
   - Di hPanel → **Logs** → cek error log
   - Pastikan tidak ada error terkait .htaccess

4. **Test dengan curl**:
   ```bash
   curl -I https://yourdomain.com/index.html
   ```
   - Lihat header `Cache-Control` → harus `no-cache`

## 📝 Checklist Sebelum Deploy

- [ ] Update `VERSION.txt` dengan versi baru
- [ ] Jalankan `php update-version.php`
- [ ] Pastikan semua file HTML menggunakan `?v=VERSI_TERBARU`
- [ ] Pastikan `version.js` menggunakan `APP_VERSION = 'VERSI_TERBARU'`
- [ ] Upload semua file ke Hostinger
- [ ] Upload file `.htaccess`
- [ ] Clear cache di hPanel (jika ada)
- [ ] Test di browser dengan Hard Refresh (Ctrl+F5)

## 🎯 Kesimpulan

Dengan konfigurasi ini:
- ✅ Browser tidak akan cache file HTML
- ✅ Browser akan revalidate file CSS/JS setiap kali
- ✅ Query parameter `?v=` memastikan file baru terdeteksi
- ✅ `version.js` akan auto-reload jika versi berbeda

**Pengguna akan SELALU mendapatkan versi terbaru!** 🚀
