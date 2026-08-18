# Latihan Pakai Gemini API

Project website lokal sederhana untuk mencoba API key dari Google AI Studio.

## Cara menjalankan

1. Install dependency:

   ```bash
   npm install
   ```

2. Buat file `.env` dari `.env.example`, lalu isi API key:

   ```bash
   GEMINI_API_KEY=api_key_kamu
   GEMINI_MODEL=gemini-3.6-flash
   PORT=3000
   ```

3. Jalankan website lokal:

   ```bash
   npm start
   ```

4. Buka:

   ```text
   http://localhost:3000
   ```

## Catatan keamanan

Jangan taruh API key langsung di file frontend seperti `public/app.js` atau `public/index.html`, karena akan terlihat oleh browser. Project ini memakai server lokal `server.js` sebagai perantara agar API key tetap berada di `.env`.
