# Latihan Pakai Groq dan Gemini API

Website chat lokal sederhana yang dapat memakai Groq maupun Gemini API. Model dapat dipilih langsung dari dropdown di header.

## Cara menjalankan

1. Install dependency:

   ```bash
   npm install
   ```

2. Buat file `.env` dari `.env.example`, lalu isi satu atau kedua API key beserta daftar modelnya:

   ```env
   GROQ_API_KEY=api_key_groq_kamu
   GROQ_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant
   GEMINI_API_KEY=api_key_gemini_kamu
   GEMINI_MODELS=gemini-2.5-flash,gemini-2.5-pro
   AI_DEFAULT_MODEL=groq:llama-3.3-70b-versatile
   PORT=3000
   ```

   `GROQ_MODELS` dan `GEMINI_MODELS` adalah daftar model yang boleh dipilih, dipisahkan dengan koma. Hanya provider dengan API key yang terisi yang akan muncul di dropdown. `AI_DEFAULT_MODEL` opsional dan memakai format `provider:nama-model`.

3. Jalankan website lokal:

   ```bash
   npm start
   ```

4. Buka `http://localhost:3000`.

## Catatan keamanan

API key hanya dibaca oleh `server.js`; jangan simpan API key di `public/app.js` atau `public/index.html`.
