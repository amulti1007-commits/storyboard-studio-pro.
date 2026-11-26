# Storyboard Studio Pro — Online + Gemini API

Aplikasi ini mengubah ide cerita menjadi storyboard melalui Gemini, lalu memakai fitur editor, Master Prompt, pembagian part, dan unduh TXT/JSON yang sudah ada pada versi HTML.

## Kebutuhan
- Node.js 22 atau lebih baru
- API key Gemini dari https://aistudio.google.com/apikey
- Akun GitHub dan Render untuk hosting online

## Jalankan lokal
1. Salin `.env.example` menjadi `.env`.
2. Isi `GEMINI_API_KEY` dengan API key milik Anda. Jangan pernah memasukkan key ke file HTML atau GitHub.
3. Isi `APP_USER` dan `APP_PASSWORD` dengan kredensial pribadi.
4. Jalankan:

   ```bash
   npm install
   npm start
   ```
5. Buka `http://localhost:3000`.

## Hosting di Render
1. Buat repository GitHub baru dan unggah semua isi folder ini. Pastikan `.env` tidak ikut diunggah.
2. Di Render pilih **New + → Web Service**, hubungkan repository tersebut.
3. Render mendeteksi `render.yaml`; periksa Build Command `npm install` dan Start Command `npm start`.
4. Di bagian Environment tambahkan:
   - `GEMINI_API_KEY` = API key dari Google AI Studio
   - `GEMINI_MODEL` = `gemini-3.8-flash`
   - `APP_USER` = nama login pilihan
   - `APP_PASSWORD` = password panjang dan unik
5. Deploy. Buka URL `https://nama-aplikasi.onrender.com`. Browser akan meminta username/password jika Basic Auth diaktifkan.

## Cara kerja
Browser → `/api/generate` di server Node.js → Gemini API. API key hanya disimpan sebagai environment variable server.

## Catatan
- Generator menerima hingga 3 gambar karakter dan 2 gambar latar (maksimum 8 MB per gambar) untuk analisis multimodal.
- Gambar dikirim ke Gemini saat tombol generate ditekan; gunakan gambar yang memang boleh Anda kirim ke layanan AI.
- Fitur ini menghasilkan storyboard dan prompt video, bukan merender file video.
- Hosting gratis dapat mengalami cold start, batas pemakaian, atau perubahan kebijakan harga. Periksa dashboard Render dan Google AI Studio untuk kuota/biaya terkini.
- Basic Auth sederhana ini melindungi akses dasar. Untuk aplikasi publik berskala besar, gunakan sistem autentikasi dan pembatasan penggunaan yang lebih kuat.
