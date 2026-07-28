# MPE Hub

Aplikasi web mudah alih untuk tiga modul operasi makmal:

1. Buku Log Makmal — kehadiran, aktiviti, status dan lampiran.
2. KEW.PA-9 — permohonan pergerakan/pinjaman aset alih.
3. MCCB Test Report — opening under overload test berdasarkan F-CREaTE-ERL-TP02-01 dan MS IEC 60947-2.

## Pratonton tempatan

Jalankan pelayan statik daripada folder projek:

```bash
python3 -m http.server 4173
```

Kemudian buka `http://localhost:4173`.

## Sambung ke Google Drive

1. Pergi ke [Google Apps Script](https://script.google.com) dan cipta projek baharu.
2. Salin seluruh kandungan `apps-script/Code.gs` ke editor Apps Script.
3. Pilih **Deploy → New deployment → Web app**.
4. Tetapkan **Execute as: Me** dan **Who has access: Anyone**.
5. Benarkan akses Google Sheets dan Google Drive apabila diminta.
6. Salin URL deployment yang berakhir dengan `/exec`.
7. Tampal URL tersebut ke `GOOGLE_SCRIPT_URL` dalam `config.js`.

Pada permintaan pertama, Apps Script akan mencipta secara automatik:

- Google Sheets `MPE Hub - Pangkalan Data` dengan tab `logbook`, `asset`, dan `mccb`.
- Folder Drive `MPE Hub - Lampiran` untuk gambar/PDF Buku Log.

Untuk melihat pautan storan, jalankan fungsi `getStorageLinks()` sekali dalam editor Apps Script dan semak **Execution log**.

## Terbit ke GitHub Pages

1. Cipta repositori GitHub dan push semua fail projek.
2. Dalam repositori, buka **Settings → Pages**.
3. Pilih **Deploy from a branch**, kemudian `main` dan folder `/ (root)`.
4. Simpan. GitHub akan memaparkan URL laman selepas deployment siap.

Fail ini ialah aplikasi statik dan tidak memerlukan proses build.

## Dokumentasi latihan

- [Dokumentasi web](https://drmurtadha.github.io/mpe-hub/docs.html)
- [Nota latihan PDF](https://drmurtadha.github.io/mpe-hub/downloads/Nota_Latihan_MPE_Hub.pdf)
- [Slaid latihan PPTX](https://drmurtadha.github.io/mpe-hub/downloads/Slaid_Latihan_MPE_Hub.pptx)

Bahan ini disediakan sebagai kajian kes praktikal untuk Bengkel Transformasi Digital dan Pemerkasaan Operasi Pintar Makmal Penyelidikan Elektrik (MPE), CREaTE JKR, 28–29 Julai 2026.

## Privasi

URL Apps Script membenarkan penghantaran daripada aplikasi GitHub Pages. Gunakan URL hanya dalam repositori yang sesuai untuk organisasi anda. Jika aplikasi perlu dihadkan kepada akaun organisasi sahaja, tukar akses deployment kepada domain Google Workspace dan tambah aliran log masuk yang diluluskan pentadbir.
Perubahan ini dilakukan oleh Zaini
