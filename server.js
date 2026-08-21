import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

function parseModels(value, fallback = "") {
  return [...new Set(`${value || fallback}`.split(",").map((model) => model.trim()).filter(Boolean))];
}

function getAvailableModels() {
  const models = [];

  if (process.env.GROQ_API_KEY) {
    parseModels(process.env.GROQ_MODELS, process.env.GROQ_MODEL || "llama-3.3-70b-versatile")
      .forEach((model) => models.push({
        id: `groq:${model}`,
        label: `Groq · ${model}`,
        provider: "groq",
        model
      }));
  }

  if (process.env.GEMINI_API_KEY) {
    parseModels(process.env.GEMINI_MODELS, process.env.GEMINI_MODEL || "gemini-2.5-flash")
      .forEach((model) => models.push({
        id: `gemini:${model}`,
        label: `Gemini · ${model}`,
        provider: "gemini",
        model
      }));
  }

  return models;
}

function getDefaultModel(models) {
  const configured = process.env.AI_DEFAULT_MODEL?.trim();
  return models.find((model) => model.id === configured)?.id || models[0]?.id || "";
}

function sendSseError(res, error) {
  res.write(`data: ${JSON.stringify({ error })}\n\n`);
  res.end();
}

async function streamGroqResponse(res, model, messages) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, messages, stream: true })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return sendSseError(res, data?.error?.message || "Gagal memanggil Groq API.");
  }

  await forwardStream(res, response, (parsed) => parsed?.choices?.[0]?.delta?.content || "");
}

async function streamGeminiResponse(res, model, messages) {
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return sendSseError(res, data?.error?.message || "Gagal memanggil Gemini API.");
  }

  await forwardStream(
    res,
    response,
    (parsed) => parsed?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || ""
  );
}

async function forwardStream(res, response, getTextChunk) {
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
      const data = line.trim().replace(/^data:\s*/, "");
      if (!data || data === "[DONE]") continue;

      try {
        const textChunk = getTextChunk(JSON.parse(data));
        if (textChunk) res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
      } catch {
        // Abaikan event SSE yang tidak berbentuk JSON.
      }
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.get("/api/config", (_req, res) => {
  const models = getAvailableModels();
  res.json({ models, defaultModel: getDefaultModel(models) });
});

app.post("/api/generate", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const messagesParam = req.body?.messages;
    const models = getAvailableModels();
    const requestedModelId = String(req.body?.model || getDefaultModel(models)).trim();

    if (!models.length) {
      return res.status(500).json({ error: "Isi GROQ_API_KEY atau GEMINI_API_KEY di file .env." });
    }

    const selectedModel = models.find((model) => model.id === requestedModelId);
    if (!selectedModel) {
      return res.status(400).json({ error: "Model yang dipilih tidak tersedia." });
    }

    if (!prompt && (!Array.isArray(messagesParam) || messagesParam.length === 0)) {
      return res.status(400).json({ error: "Prompt tidak boleh kosong." });
    }

    const messages = Array.isArray(messagesParam) && messagesParam.length > 0
      ? messagesParam
          .filter((message) => ["user", "assistant", "system"].includes(message?.role))
          .map((message) => ({ role: message.role, content: String(message.content || "") }))
          .filter((message) => message.content)
      : [{ role: "user", content: prompt }];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    if (selectedModel.provider === "groq") {
      await streamGroqResponse(res, selectedModel.model, messages);
    } else {
      await streamGeminiResponse(res, selectedModel.model, messages);
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Terjadi kesalahan di server lokal." });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || "Terjadi kesalahan di server lokal." })}\n\n`);
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`Website lokal berjalan di http://localhost:${port}`);
});
