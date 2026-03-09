# Alur Sistem Permintaan Pembukaan Backdate

## 📋 Ringkasan
Sistem ini mengelola workflow permintaan pembukaan backdate dengan 3 peran utama: **User**, **Approver**, dan **Petugas**. Setiap peran memiliki akses dan fungsi yang berbeda dalam proses workflow.

---

## 🔄 Alur Workflow Lengkap

### **1. Tahap Submit (User)**
**Aktor:** User  
**Halaman:** `/backdate/form-permintaan.html`

#### Proses:
1. User mengisi form permintaan dengan data:
   - **Auto-fill (readonly):** NPK, Nama Lengkap, Nomor Telepon, Unit Kerja (dari session)
   - **Input user:**
     - Nama Pegawai yang Dibukakan Backdate
     - NPK Pegawai
     - Jumlah Surat yang Akan Dibackdate
     - Alasan Permintaan
     - Petugas (dropdown - hanya petugas aktif)

2. Validasi form:
   - Semua field wajib diisi
   - Jumlah surat harus > 0
   - Petugas harus dipilih

3. Submit ke API: `submitPermintaanBackdate`
   - Generate nomor permintaan otomatis: `BD-YYYY-XXXX` (contoh: `BD-2026-0001`)
   - Simpan ke tabel `permintaan_backdate` dengan status: **`Open`**
   - Log aktivitas ke `permintaan_backdate_logs`

4. **Hasil:**
   - Modal sukses muncul dengan nomor permintaan
   - Tombol "Hubungi Petugas via WhatsApp" tersedia
   - User bisa langsung menghubungi petugas via WhatsApp

---

### **2. Tahap Approval (Approver)**
**Aktor:** Approver / Admin / Super Admin  
**Halaman:** `/backdate/dashboard-approver-backdate.html`

#### Proses:
1. Approver melihat daftar permintaan dengan status **`Open`**

2. Approver dapat melakukan 2 aksi:

   **A. APPROVE:**
   - Approver memilih petugas yang akan menangani
   - Status berubah menjadi: **`Approved`**
   - `petugas_id` dan `petugas_no_wa` di-assign
   - Log aktivitas: "Permintaan disetujui"
   - Permintaan sekarang muncul di dashboard petugas

   **B. REJECT:**
   - Status berubah menjadi: **`Rejected`**
   - Log aktivitas: "Permintaan ditolak"
   - Workflow berakhir (tidak bisa dilanjutkan)

---

### **3. Tahap Pelaksanaan (Petugas)**
**Aktor:** Petugas (ditunjuk oleh Approver)  
**Halaman:** `/backdate/dashboard-petugas-backdate.html`  
**Akses:** Hanya Admin / Super Admin (untuk monitoring)

#### Proses:
1. Petugas melihat daftar permintaan dengan status:
   - **`Approved`** (baru ditugaskan)
   - **`In Progress`** (sedang dikerjakan)
   - **`Closed`** (sudah selesai)

2. Petugas dapat melakukan update:

   **A. Update Status ke "In Progress":**
   - Petugas mulai mengerjakan tugas
   - Status berubah menjadi: **`In Progress`**
   - Petugas dapat menambahkan `keterangan_petugas` (catatan pelaksanaan)
   - Log aktivitas: "Status diubah ke In Progress"

   **B. Update Status ke "Closed":**
   - Petugas menyelesaikan tugas
   - Status berubah menjadi: **`Closed`**
   - Petugas wajib mengisi `keterangan_petugas`
   - Log aktivitas: "Status diubah ke Closed"
   - **Notifikasi otomatis dikirim ke Approver** (dicatat di log)

---

### **4. Tahap Monitoring (User)**
**Aktor:** User (pemohon)  
**Halaman:** `/backdate/dashboard-user-backdate.html`

#### Proses:
1. User melihat semua permintaan yang pernah dibuat
2. Status yang bisa dilihat:
   - **`Open`** - Menunggu approval
   - **`Approved`** - Sudah disetujui, menunggu petugas
   - **`In Progress`** - Sedang dikerjakan petugas
   - **`Closed`** - Sudah selesai
   - **`Rejected`** - Ditolak oleh approver

3. Fitur:
   - **Detail Permintaan:** Melihat detail lengkap termasuk nama petugas
   - **Hubungi Petugas:** Tombol WhatsApp untuk menghubungi petugas yang ditugaskan
   - **Log Aktivitas:** Melihat riwayat perubahan status

---

## 📊 Status Workflow

```
┌─────────┐
│  Open   │  ← User submit permintaan
└────┬────┘
     │
     ├──────────────┐
     │              │
     ▼              ▼
┌──────────┐   ┌──────────┐
│ Approved │   │ Rejected │  ← Approver approve/reject
└────┬─────┘   └──────────┘
     │
     ▼
┌─────────────┐
│ In Progress │  ← Petugas mulai kerja
└──────┬──────┘
       │
       ▼
   ┌────────┐
   │ Closed │  ← Petugas selesai
   └────────┘
```

---

## 👥 Peran dan Akses

### **1. User (Role: `user`)**
**Akses:**
- ✅ Form Permintaan Backdate (`form-permintaan.html`)
- ✅ Status Permintaan Saya (`dashboard-user-backdate.html`)

**Fungsi:**
- Membuat permintaan baru
- Melihat status permintaan sendiri
- Menghubungi petugas via WhatsApp

---

### **2. Approver (Role: `approver`, `admin`, `super_admin`)**
**Akses:**
- ✅ Approval Backdate (`dashboard-approver-backdate.html`)

**Fungsi:**
- Melihat semua permintaan dengan status `Open`
- Approve permintaan (dengan memilih petugas)
- Reject permintaan
- Melihat detail permintaan

---

### **3. Petugas (Role: `petugas` - ditunjuk saat approval)**
**Catatan:** Dashboard petugas hanya bisa diakses oleh **Admin / Super Admin** untuk monitoring

**Akses:**
- ✅ Tugas Backdate (`dashboard-petugas-backdate.html`) - **Hanya Admin**

**Fungsi:**
- Melihat permintaan yang ditugaskan kepadanya
- Update status ke `In Progress`
- Update status ke `Closed` dengan catatan
- Melihat detail permintaan

---

## 🗄️ Struktur Database

### **Tabel: `permintaan_backdate`**
```sql
- id (PK)
- row_number (BD-YYYY-XXXX)
- user_id (FK ke users)
- npk_user, nama_user, unit_kerja
- nama_pegawai_backdate
- npk_pegawai_backdate
- jumlah_surat
- alasan
- petugas_id (FK ke petugas)
- petugas_no_wa
- status (Open, Approved, Rejected, In Progress, Closed)
- keterangan_petugas
- created_at, updated_at
```

### **Tabel: `permintaan_backdate_logs`**
```sql
- id (PK)
- permintaan_id (FK)
- user_id (FK)
- action (Submit, Approve, Reject, Update, Notification)
- description
- old_status, new_status
- created_at
```

### **Tabel: `petugas`**
```sql
- id (PK)
- nama
- npk
- no_wa
- is_active
- created_at, updated_at
```

---

## 🔗 Integrasi WhatsApp

### **Format Pesan WhatsApp:**
```
Halo [Nama Petugas],

Saya telah mengajukan permintaan pembukaan Backdate dengan nomor:

#[Nomor Permintaan]

Mohon untuk dapat direview melalui link berikut:
[Link Detail Permintaan]

Terima kasih.
```

### **Format Nomor WhatsApp:**
- Input: `081234567890` atau `0812-3456-7890`
- Output: `6281234567890` (format internasional)

---

## 📝 Log Aktivitas

Setiap perubahan status dicatat dengan detail:
- **Action:** Submit, Approve, Reject, Update, Notification
- **User:** Siapa yang melakukan
- **Timestamp:** Kapan dilakukan
- **Status:** Status sebelum dan sesudah

---

## 🔐 Keamanan

1. **Authentication:** Semua endpoint memerlukan token
2. **Authorization:** Role-based access control
3. **Validation:** Server-side validation untuk semua input
4. **Sanitization:** Input di-sanitize untuk mencegah SQL injection
5. **Audit Log:** Semua aktivitas dicatat

---

## 🎯 Fitur Utama

1. ✅ **Auto-generate Nomor Permintaan:** Format `BD-YYYY-XXXX`
2. ✅ **WhatsApp Integration:** Langsung hubungi petugas
3. ✅ **Real-time Status Tracking:** User bisa lihat status kapan saja
4. ✅ **Activity Logs:** Riwayat lengkap semua perubahan
5. ✅ **Role-based Dashboard:** Setiap role punya dashboard sendiri
6. ✅ **Notification System:** Notifikasi ke approver saat petugas selesai

---

## 📍 Lokasi File

### **Frontend:**
- Form: `/backdate/form-permintaan.html`
- Dashboard User: `/backdate/dashboard-user-backdate.html`
- Dashboard Approver: `/backdate/dashboard-approver-backdate.html`
- Dashboard Petugas: `/backdate/dashboard-petugas-backdate.html`
- Detail: `/backdate/detail.html`

### **Backend:**
- API: `/api.php`
- Sidebar: `/sidebar.js`
- Auth: `/auth.js`

---

## 🚀 Cara Menggunakan

### **Untuk User:**
1. Login sebagai user
2. Buka "Form Permintaan Backdate"
3. Isi form dan submit
4. Hubungi petugas via WhatsApp (opsional)
5. Cek status di "Status Permintaan Saya"

### **Untuk Approver:**
1. Login sebagai approver/admin
2. Buka "Approval Backdate"
3. Review permintaan dengan status `Open`
4. Approve (pilih petugas) atau Reject

### **Untuk Admin (Monitoring Petugas):**
1. Login sebagai admin
2. Buka "Tugas Backdate"
3. Lihat semua permintaan yang ditugaskan ke petugas
4. Monitor progress dan status

---

## ⚠️ Catatan Penting

1. **Status `Open`** hanya bisa di-approve atau di-reject oleh approver
2. **Status `Approved`** akan muncul di dashboard petugas
3. **Status `Closed`** tidak bisa diubah lagi
4. **Status `Rejected`** mengakhiri workflow
5. Petugas harus mengisi `keterangan_petugas` saat menutup permintaan
6. Notifikasi ke approver hanya dikirim saat status menjadi `Closed`

---

**Dokumen ini dibuat untuk membantu memahami alur sistem Permintaan Pembukaan Backdate.**
