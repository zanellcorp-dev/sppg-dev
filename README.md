# SPPG Monitoring — Deploy Safe

## Penyimpanan aman saat update ZIP
Aplikasi memisahkan **release/code** dari **data persisten**.

- Database MySQL tetap berada di database server dan tidak disimpan di ZIP.
- Semua file upload disimpan di `DATA_DIR/UPLOAD_DIR`, di luar folder release aplikasi.
- ZIP release tidak berisi folder `uploads`.
- Saat aplikasi pertama kali dijalankan, file lama dari `./uploads` akan dicopy ke storage persisten jika masih tersedia.
- File lama tidak dihapus otomatis saat migrasi.

### Environment
Set `DATA_DIR` ke folder di luar folder aplikasi, misalnya:

`/home/USERNAME/sppg-monitoring-data`

Jika `UPLOAD_DIR=uploads`, maka upload disimpan di:

`/home/USERNAME/sppg-monitoring-data/uploads`

### Deploy berikutnya
1. Jangan hapus storage persisten.
2. Ganti source aplikasi dengan ZIP release baru.
3. Pertahankan `.env` production.
4. Restart Node.js.
5. Cek `/health` dan pastikan `storage: ok` serta `storage_mode: persistent-outside-release`.

### Penting
Jika file upload sudah terhapus sebelum versi deploy-safe pertama kali dijalankan, aplikasi tidak dapat mengembalikan byte file yang sudah hilang tanpa backup.


## v1.8.31
- Pengaturan identitas & branding: nama aplikasi, nama SPPG, lokasi, tagline, logo utama, favicon, logo login, warna tema/sidebar.
- Menu akun di topbar: Profil Saya, Pengaturan, Pusat Bantuan, Logout.
- Branding tersimpan di MySQL; file logo tersimpan pada persistent DATA_DIR.

## v1.8.33 — Backup & Data
- Added SYSTEM > Backup & Data.
- Added Full Backup snapshot to persistent storage outside the release directory.
- Full backup contains operational database data (password hashes and sessions excluded), persistent uploaded files, and templates.
- Added backup history, download, manifest, file inventory, and safe-change guidance.
- Added dashboard shortcut for Hostinger daily backup and manual backup.
- Hostinger daily backup remains an infrastructure feature managed by Hostinger; the application does not pretend to control or inspect Hostinger backup status.
- Backup creation is non-destructive: it does not modify operational source data.


## v1.8.34 — BASELINE Team Work Dashboards
- Added five operational team dashboards: Persiapan, Pengolahan, Pemorsian, Distribusi, Pencucian.
- Added KaSPPG/team role values to access model.
- Added operational_task_events as append-only work confirmation history.
- Added team dashboard date filter and direct navigation tabs.
- Added cluster-level task actions and KPM-level Distribusi Serah Terima/Pengambilan actions.
- Added Pencucian workflow per KPM.
- Added main Dashboard overview for all five teams.
- Existing schedule/master data remains the source; team dashboards derive work units from Jadwal Distribusi.


## v1.8.36.1 BASELINE storage compatibility fix
- Preserves v1.8.34 team dashboards.
- Adds backward-compatible upload resolution for historical paths.
- Upload serving accepts nested historical `/uploads/...` paths safely.
- Staff document links are normalized to the stored basename.
- No uploaded file is deleted or migrated destructively.
- Intended to prevent photos/documents from appearing broken after deployment.


## v1.8.36.1 — Role & Permission Foundation
- Added `permissions` and `role_permissions` tables.
- Seeded permission catalog and safe default role permissions during migration.
- Added ADMIN-only Role & Pengguna management.
- Added user creation/edit and password change (minimum 12 characters).
- Added role permission matrix with activity logging.
- Added permission middleware for core modules; unauthorized access returns HTTP 403.
- Backup manifest version now uses the application version constant.
- Persistent storage behavior from v1.8.35 is retained; uploads/data are not included in deployment ZIP.


## v1.8.36.4 — User, Team, Attendance & Audit Hardening
- Satu role dapat dimiliki banyak pengguna.
- Menambahkan `sppg_teams` untuk lima tim operasional.
- Menambahkan `team_members` agar satu tim dapat memiliki banyak anggota aktif.
- Menambahkan `users.staff_id` untuk menghubungkan akun sistem dengan satu data staf tanpa menggandakan identitas.
- Menambahkan `operational_task_assignments` untuk assignment banyak pengguna ke satu task tanpa membuat role baru.
- Assignment task mendukung unit KLOTER atau KPM dan tanggal kerja.
- Keanggotaan tim divalidasi agar role tim sesuai dengan tim operasional.
- Pengeluaran anggota tim bersifat non-destruktif (`is_active=0`, `left_at`).
- Perubahan membership dan keterkaitan akun-staf dicatat pada Activity Log.
- Storage persistent dan compatibility v1.8.35 tetap dipertahankan.

## Role BASELINE
- ADMIN: pengelolaan sistem tingkat penuh.
- KASP: pengendalian dan pengawasan operasional SPPG.
- ASLAP: pengawasan dan koordinasi lapangan.
- PENGAWAS_GIZI: pengawasan aspek gizi.
- PENGAWAS_KEUANGAN: pengawasan keuangan.
- PERSIAPAN/PENGOLAHAN/PEMORSIAN/DISTRIBUSI/PENCUCIAN: role tim operasional.
- Satu role dapat memiliki banyak akun/user.
- ASLAP: pengawasan lapangan.
- PENGAWAS_GIZI: review dan feedback aspek gizi.
- PENGAWAS_KEUANGAN: akses dan pengelolaan fungsi keuangan yang akan dikembangkan.
- PERSIAPAN/PENGOLAHAN/PEMORSIAN/DISTRIBUSI/PENCUCIAN: eksekusi pekerjaan tim masing-masing.

KaSPPG yang juga mengelola sistem menggunakan **dua akun terpisah**: akun KASP untuk operasional harian dan akun ADMIN untuk administrasi teknis sistem.


## v1.8.36.4 — Jadwal, Absensi, Penggantian, Rekap
- Jadwal staf per tanggal, tim, shift, dan jam kerja.
- Absensi harian: Hadir, Izin, Sakit, Alpa, Cuti, Dinas; BELUM DIISI tidak dihitung hadir.
- Penggantian petugas per tanggal/tim/pekerjaan tanpa mengubah anggota tim permanen.
- Rekap bulanan berbasis hari yang dijadwalkan, termasuk histori penggantian.
- Pengawas Keuangan dapat export rekap absensi ke Excel.
- Perubahan penting dicatat di Activity Log.


## v1.8.36.4 — BASELINE DB compatibility hardening
This build hardens startup migration for legacy permissions schemas so an existing production database is normalized before permission seed queries run. No production uploads/storage are bundled.

## NEXT11 — UAT + Backup Integrity Hardening
- Backup FULL menghasilkan `tar.gz` yang konsisten dengan metadata `backup_runs`.
- Backup diverifikasi sebelum ditandai `SUCCESS`.
- SHA-256 checksum disimpan dan dapat diverifikasi ulang tanpa melakukan restore/destructive action.
- Recovery pada tahap ini bersifat **verification/dry-run**; tidak ada endpoint restore langsung ke database produksi.
- Ditambahkan histori update untuk Kendala dan Feedback.
- UAT static gate: `node scripts/uat-baseline.js`.

## NEXT14 — Dashboard KPM UI
- Dashboard KPM redesigned as a clean Google-Forms-inspired portal with configurable banner/header.
- Configurable Portal KPM banner, dashboard title, and subtitle from Pengaturan.
- SPPG identity (logo, SPPG name, dashboard title) displayed in the portal header.
- KPM identity and contact cards.
- PM summary cards: Total PM, Porsi Kecil, Porsi Besar.
- Satuan Pendidikan tables: Pendidik, Tenaga Kependidikan, Peserta Didik; class column for Peserta Didik.
- Posyandu tables: Balita, Bumil, Busui; no school-class column.
- Edit action is a proposal to DATA KPM PM; it never directly overwrites Master PM.
- Internal preview uses the same portal dashboard UI.
