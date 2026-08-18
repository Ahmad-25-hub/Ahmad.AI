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
    const contentsParam = req.body?.contents;

    if (!prompt && (!Array.isArray(contentsParam) || contentsParam.length === 0)) {
      return res.status(400).json({
        error: "Prompt tidak boleh kosong."
      });
    }

    const contentsPayload =
      Array.isArray(contentsParam) && contentsParam.length > 0
        ? contentsParam
        : [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ];

    // Set headers for SSE streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: contentsPayload
        })
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      res.write(`data: ${JSON.stringify({ error: data?.error?.message || "Gagal memanggil Gemini API." })}\n\n`);
      return res.end();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.substring(6).trim();
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              const textChunk =
                parsed?.candidates?.[0]?.content?.parts
                  ?.map((part) => part.text || "")
                  .join("") || "";
              if (textChunk) {
                res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
              }
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Terjadi kesalahan di server lokal." });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`Website lokal berjalan di http://localhost:${port}`);
});
