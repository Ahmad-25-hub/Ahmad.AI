import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.post("/api/generate", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum diisi di file .env."
      });
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt tidak boleh kosong."
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gagal memanggil Gemini API."
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "Tidak ada jawaban dari model.";

    res.json({ text });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Terjadi kesalahan di server lokal."
    });
  }
});

app.listen(port, () => {
  console.log(`Website lokal berjalan di http://localhost:${port}`);
});
