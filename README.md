# 📖 Pena Indonesia - Web Pembaca Novel Karya Anak Bangsa

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
![React 19](https://img.shields.io/badge/React-19.0.0-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4.0-38BDF8?logo=tailwindcss)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFA611?logo=firebase)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**Pena Indonesia** adalah platform web modern untuk membaca karya-karya novel anak bangsa secara nyaman, interaktif, dan responsif di semua perangkat (Desktop, Laptop, Tablet, maupun Smartphone).

Proyek ini telah dioptimalkan secara khusus sebagai **Standalone Modern Website** yang siap diunggah ke **GitHub** dan dideploy secara instan ke **Vercel** dengan konfigurasi zero-config.

---

## ✨ Fitur Utama

- 🎨 **3 Pilihan Tema Membaca:** Terang (Light), Hangat (Sepia/Paper), dan Malam (Dark Mode) untuk kenyamanan mata.
- 📱 **Desain Web Responsif & PWA:** Mendukung Web App Manifest (`manifest.webmanifest`) sehingga dapat di-install langsung di layar utama (Add to Home Screen) pada Android, iOS, Windows, dan macOS.
- ⚡ **Performa Kilat dengan Vite & Tailwind CSS v4:** Waktu muat ultra cepat dengan bundling aset yang teroptimasi.
- 🔗 **Deep-linking & Riwayat Browser (Web History):** Navigasi mulus dengan tombol *Back/Forward* browser, serta dukungan URL hash untuk membagikan tautan novel atau bab langsung ke teman.
- 📚 **Koleksi Seri & Novel Tunggal:** Pengelompokan buku berdasarkan seri semesta novel dengan tata letak visual rak buku yang estetik.
- 🎭 **Galeri Karakter Interaktif:** Eksplorasi profil karakter, biodata, dan ilustrasi visual dari setiap buku.
- 📖 **Reader Nyaman & Lengkap:**
  - Pengaturan ukuran teks bacaan.
  - Dukungan format teks Markdown dan kutipan dialog yang rapi.
  - Laci navigasi daftar bab cepat.
  - Reaksi emotikon pembaca dan sistem rating bintang.
- 🔄 **Real-Time Firebase Firestore:** Data tersinkronisasi otomatis secara langsung dari server cloud dengan *offline cache resilience*.

---

## 🚀 Panduan Deploy ke Vercel

Proyek ini sudah dilengkapi dengan file konfigurasi resmi `vercel.json` yang mendukung *Single Page Application (SPA) routing*, caching aset statis, serta header keamanan.

### Opsi A: Deploy Langsung Lewat GitHub (Sangat Disarankan)

1. Pastikan kode sudah di-push ke repositori **GitHub** Anda (lihat panduan GitHub di bawah).
2. Buka dashboard [Vercel](https://vercel.com) dan login dengan akun GitHub Anda.
3. Klik tombol **"Add New..."** -> **"Project"**.
4. Pilih repositori GitHub proyek Pena Indonesia ini lalu klik **"Import"**.
5. Vercel akan otomatis mendeteksi:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. (Opsional) Jika ingin menggunakan database Firebase milik Anda sendiri, tambahkan variabel di bagian **Environment Variables** (lihat panduan di bawah). Jika tidak, Anda bisa langsung lewati karena proyek sudah memiliki konfigurasi default yang siap pakai.
7. Klik **"Deploy"**. Dalam hitungan detik, situs Anda sudah live dengan URL HTTPS gratis dari Vercel!

### Opsi B: Deploy Menggunakan Vercel CLI

```bash
# 1. Install Vercel CLI jika belum ada
npm i -g vercel

# 2. Login ke Vercel
vercel login

# 3. Jalankan perintah deploy di folder proyek
vercel

# 4. Untuk deploy versi production:
vercel --prod
```

---

## 🐙 Panduan Upload ke GitHub

Jika Anda mengekspor atau mendownload file proyek ini, berikut langkah-langkah untuk membuat repositori baru di GitHub:

```bash
# 1. Masuk ke folder proyek hasil ekspor
cd pena-indonesia

# 2. Inisialisasi Git
git init

# 3. Tambahkan semua file
git add .

# 4. Buat commit pertama
git commit -m "feat: Inisialisasi proyek web Pena Indonesia untuk GitHub & Vercel"

# 5. Ubah branch utama menjadi main
git branch -M main

# 6. Hubungkan dengan repositori GitHub Anda (ganti URL di bawah dengan milik Anda)
git remote add origin https://github.com/USERNAME_ANDA/pena-indonesia.git

# 7. Push ke GitHub
git push -u origin main
```

---

## 💻 Menjalankan di Komputer Lokal (Local Development)

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18 ke atas disarankan)
- npm / yarn / pnpm / bun

### Langkah-langkah:

```bash
# 1. Install seluruh dependensi
npm install

# 2. Jalankan server pengembangan
npm run dev

# 3. Buka browser di http://localhost:3000
```

### Perintah Script Tersedia:
- `npm run dev`: Menjalankan local dev server dengan Hot Module Reloading.
- `npm run build`: Memeriksa tipe TypeScript dan membangun bundle web produksi ke folder `dist/`.
- `npm run preview`: Meninjau hasil build produksi secara lokal.
- `npm run lint`: Memvalidasi tipe TypeScript tanpa menghasilkan output.

---

## 🔐 Konfigurasi Environment Variables (Opsional)

Proyek ini telah dikonfigurasi dengan Firebase bawaan yang siap pakai langsung. Namun, jika Anda ingin menghubungkannya ke proyek Firebase Anda sendiri, buat file `.env` di root proyek atau atur di menu **Settings -> Environment Variables** pada dashboard Vercel:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Lihat file `.env.example` untuk referensi lengkap.

---

## 📁 Struktur Direktori Web

```text
├── public/                 # Aset statis publik (logo, favicon, PWA manifest)
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── logo.png
│   └── manifest.webmanifest# Konfigurasi PWA (Progressive Web App)
├── src/
│   ├── assets/             # Gambar & ikon lokal
│   ├── components/         # Komponen UI React
│   │   ├── Header.tsx            # Navigasi atas, brand, tema & refresh
│   │   ├── NovelList.tsx         # Tampilan rak buku novel & seri
│   │   ├── NovelDetail.tsx       # Detail buku, sinopsis, rating & daftar bab
│   │   ├── SeriesDetail.tsx      # Tampilan seri & urutan novel
│   │   ├── ChapterReader.tsx     # Pembaca bab, drawer & kustomisasi teks
│   │   ├── CharacterGallery.tsx  # Galeri kartu karakter novel
│   │   ├── ChapterReactions.tsx  # Reaksi emotikon pembaca per bab
│   │   ├── AnnouncementModal.tsx # Pengumuman dinamis dari admin
│   │   ├── ThemeModal.tsx        # Modal pemilih tema (Terang, Sepia, Gelap)
│   │   └── LiterarySplash.tsx    # Animasi pembuka literasi estetik
│   ├── context/
│   │   └── ThemeContext.tsx      # Penyimpanan tema (Light / Sepia / Dark)
│   ├── services/
│   │   ├── novelService.ts       # Query Firestore untuk novel, bab, dan seri
│   │   ├── novelRatingAndHistoryService.ts # Rating & riwayat membaca
│   │   ├── reactionService.ts    # Sistem reaksi emoji real-time
│   │   └── batchSyncService.ts   # Pengelolaan antrian sinkronisasi offline
│   ├── types.ts            # Definisi tipe TypeScript
│   ├── firebase.ts         # Inisialisasi Firebase Web SDK & cache Firestore
│   ├── index.css           # Styling global & Tailwind CSS v4
│   ├── main.tsx            # Entry point React DOM
│   └── App.tsx             # Root component & Web URL hash router
├── .env.example            # Contoh variabel lingkungan
├── .gitignore              # Daftar file yang diabaikan Git & Vercel
├── index.html              # Template HTML utama dengan SEO & Open Graph
├── package.json            # Konfigurasi dependensi dan scripts
├── tsconfig.json           # Konfigurasi compiler TypeScript
├── vercel.json             # Konfigurasi routing & header Vercel
└── vite.config.ts          # Konfigurasi bundler Vite
```

---

## 📄 Lisensi

Hak cipta konten cerita dan karya novel dimiliki oleh para penulis terdaftar di **Pena Indonesia**.
Aplikasi web ini dibangun dengan penuh dedikasi untuk memajukan literasi digital Indonesia.
