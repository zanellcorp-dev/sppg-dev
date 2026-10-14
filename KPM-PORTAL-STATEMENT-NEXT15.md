# NEXT15 — KPM Portal Surat Pernyataan

BLUE PRINT SPPG — BASELINE v1.8.36.4

## Perubahan
- Setiap KPM memiliki section **Surat Pernyataan KPM** pada dashboard yang sama dengan portal KPM.
- KPM dapat mengunggah surat pernyataan dalam format PDF atau DOCX.
- File disimpan di persistent storage, bukan di folder release aplikasi.
- Penggantian surat tidak menghapus file lama; record lama menjadi non-current sehingga histori tetap tersedia.
- Akses file dibatasi berdasarkan `kpm_id` dan token portal.
- Preview Internal menampilkan dokumen KPM yang sama dan menyediakan akses lihat melalui jalur internal yang terotorisasi.
- Upload dicatat ke Activity Log dengan konteks KPM dan portal token.
- Batas ukuran file mengikuti `MAX_UPLOAD_MB` (default 5 MB).
