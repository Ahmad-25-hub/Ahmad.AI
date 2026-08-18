// DOM Elements
const form = document.querySelector("#prompt-form");
const promptInput = document.querySelector("#prompt");
const submitButton = document.querySelector("#submit-button");
const chatMessagesContainer = document.querySelector("#chat-messages");
const emptyState = document.querySelector("#empty-state");
const conversationList = document.querySelector("#conversation-list");
const resetChatBtn = document.querySelector("#reset-chat-btn");
const suggestionChips = document.querySelectorAll(".suggestion-chip");

// Application State
let messages = [];
let isLoading = false;
let pendingRenderFrame = null;

// SVGs
const USER_AVATAR_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

const GEMINI_AVATAR_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" fill="currentColor"/></svg>`;

const COPY_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const CHECK_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

const WARNING_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

// Configure Marked.js if available
if (window.marked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true
  });
}

// Fallback Markdown Renderer if Marked CDN fails
function renderMarkdownFallback(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Paragraphs
  const paragraphs = html.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      if (p.startsWith("<pre>") || p.startsWith("<ul>") || p.startsWith("<ol>")) {
        return p;
      }
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

// Render Markdown & enhance code blocks
function renderFormattedText(text) {
  let rawHtml = "";
  if (window.marked && typeof window.marked.parse === "function") {
    try {
      rawHtml = window.marked.parse(text);
    } catch (e) {
      rawHtml = renderMarkdownFallback(text);
    }
  } else {
    rawHtml = renderMarkdownFallback(text);
  }

  // Wrap <pre><code> blocks with Header & Copy button
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = rawHtml;

  const preBlocks = tempDiv.querySelectorAll("pre");
  preBlocks.forEach((pre) => {
    const codeEl = pre.querySelector("code");
    const codeText = codeEl ? codeEl.innerText : pre.innerText;

    // Extract language class
    let lang = "code";
    if (codeEl && codeEl.className) {
      const match = codeEl.className.match(/language-(\w+)/);
      if (match) lang = match[1];
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
      <span>${lang}</span>
      <button type="button" class="code-copy-btn" data-code="${encodeURIComponent(codeText)}">
        ${COPY_ICON_SVG} Salin Kode
      </button>
    `;

    wrapper.appendChild(header);
    wrapper.appendChild(pre.cloneNode(true));
    pre.parentNode.replaceChild(wrapper, pre);
  });

  return tempDiv.innerHTML;
}

// Auto scroll chat to bottom
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  });
}

function scheduleRenderMessages() {
  if (pendingRenderFrame) return;

  pendingRenderFrame = requestAnimationFrame(() => {
    pendingRenderFrame = null;
    renderMessages();
  });
}

// Auto resize textarea
function updateTextareaHeight() {
  promptInput.style.height = "auto";
  const newHeight = Math.min(promptInput.scrollHeight, 180);
  promptInput.style.height = `${newHeight}px`;

  // Enable/disable send button
  const hasText = promptInput.value.trim().length > 0;
  submitButton.disabled = !hasText || isLoading;
}

// Build contents payload for conversation history (excluding error messages)
function buildContentsPayload() {
  return messages
    .filter((msg) => !msg.error)
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    }));
}

// Render Conversation Messages
function renderMessages() {
  if (messages.length === 0) {
    emptyState.style.display = "flex";
    conversationList.innerHTML = "";
    return;
  }

  emptyState.style.display = "none";
  conversationList.innerHTML = "";

  messages.forEach((msg, index) => {
    const row = document.createElement("div");
    row.className = `message-row ${msg.role === "user" ? "user-row" : "ai-row"}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${msg.role === "user" ? "avatar-user" : "avatar-ai"}`;
    avatar.innerHTML = msg.role === "user" ? USER_AVATAR_SVG : GEMINI_AVATAR_SVG;

    const content = document.createElement("div");
    content.className = "message-content";

    if (msg.role === "user") {
      const bubble = document.createElement("div");
      bubble.className = "user-bubble";
      bubble.textContent = msg.text;
      content.appendChild(bubble);
    } else {
      if (msg.error) {
        const errorCard = document.createElement("div");
        errorCard.className = "error-card";
        errorCard.innerHTML = `
          ${WARNING_ICON_SVG}
          <div>
            <strong>Gagal mendapatkan jawaban:</strong>
            <div>${escapeHtml(msg.text)}</div>
          </div>
        `;
        content.appendChild(errorCard);
      } else {
        const aiCard = document.createElement("div");
        aiCard.className = "ai-card";
        aiCard.innerHTML = renderFormattedText(msg.text);

        // Toolbar with copy button
        const toolbar = document.createElement("div");
        toolbar.className = "response-toolbar";

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "copy-btn";
        copyBtn.dataset.index = index;
        copyBtn.innerHTML = `${COPY_ICON_SVG} <span>Salin</span>`;

        toolbar.appendChild(copyBtn);
        aiCard.appendChild(toolbar);
        content.appendChild(aiCard);
      }
    }

    row.appendChild(avatar);
    row.appendChild(content);
    conversationList.appendChild(row);
  });

  // Render typing indicator if loading and no assistant message created yet
  const lastMsg = messages[messages.length - 1];
  if (isLoading && (!lastMsg || lastMsg.role !== "assistant" || !lastMsg.text)) {
    const loadingRow = document.createElement("div");
    loadingRow.className = "message-row ai-row";
    loadingRow.id = "typing-loading-row";

    const avatar = document.createElement("div");
    avatar.className = "avatar avatar-ai";
    avatar.innerHTML = GEMINI_AVATAR_SVG;

    const content = document.createElement("div");
    content.className = "message-content";

    const aiCard = document.createElement("div");
    aiCard.className = "ai-card";
    aiCard.innerHTML = `
      <div class="typing-dots">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;

    content.appendChild(aiCard);
    loadingRow.appendChild(avatar);
    loadingRow.appendChild(content);
    conversationList.appendChild(loadingRow);
  }

  scrollToBottom();
}

// Escape HTML for security
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Submit Prompt Handler with Real-Time SSE Streaming
async function handleSendPrompt(promptText) {
  const text = (promptText || promptInput.value).trim();
  if (!text || isLoading) return;

  // Clear input
  promptInput.value = "";
  updateTextareaHeight();

  // Push User Message
  messages.push({ role: "user", text });
  isLoading = true;
  renderMessages();

  try {
    const payload = {
      prompt: text,
      contents: buildContentsPayload()
    };

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${response.status}`);
    }

    // Add initial empty assistant message for streaming
    const assistantIndex = messages.length;
    messages.push({ role: "assistant", text: "" });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";
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
          const dataStr = trimmed.substring(6).trim();
          if (dataStr === "[DONE]") break;

          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch (e) {
            continue;
          }

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.text) {
            accumulatedText += parsed.text;
            messages[assistantIndex].text = accumulatedText;
            scheduleRenderMessages();
          }
        }
      }
    }

    if (!accumulatedText) {
      messages[assistantIndex].text = "Tidak ada jawaban dari model.";
    }
  } catch (err) {
    // If assistant msg was partially created, replace or update it
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && !lastMsg.text) {
      lastMsg.text = err.message || "Terjadi kesalahan saat memproses prompt.";
      lastMsg.error = true;
    } else {
      messages.push({
        role: "assistant",
        text: err.message || "Terjadi kesalahan saat memproses prompt.",
        error: true
      });
    }
  } finally {
    isLoading = false;
    renderMessages();
  }
}

// Event Listeners
form.addEventListener("submit", (e) => {
  e.preventDefault();
  handleSendPrompt();
});

promptInput.addEventListener("input", updateTextareaHeight);

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!submitButton.disabled) {
      handleSendPrompt();
    }
  }
});

// Suggestion Chip clicks
suggestionChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const promptText = chip.getAttribute("data-prompt");
    if (promptText) {
      handleSendPrompt(promptText);
    }
  });
});

// Reset / New Chat
resetChatBtn.addEventListener("click", () => {
  messages = [];
  isLoading = false;
  promptInput.value = "";
  updateTextareaHeight();
  renderMessages();
});

// Global Event Delegation for Copy Buttons
document.addEventListener("click", async (e) => {
  // Response Copy Button
  const copyBtn = e.target.closest(".copy-btn");
  if (copyBtn) {
    const msgIndex = copyBtn.dataset.index;
    if (msgIndex !== undefined && messages[msgIndex]) {
      const textToCopy = messages[msgIndex].text;
      await copyToClipboard(textToCopy, copyBtn, "Salin");
    }
    return;
  }

  // Code Block Copy Button
  const codeCopyBtn = e.target.closest(".code-copy-btn");
  if (codeCopyBtn) {
    const codeText = decodeURIComponent(codeCopyBtn.dataset.code || "");
    await copyToClipboard(codeText, codeCopyBtn, "Salin Kode");
  }
});

// Helper for Copy with Feedback
async function copyToClipboard(text, buttonEl, defaultLabel) {
  try {
    await navigator.clipboard.writeText(text);
    buttonEl.classList.add("copied");
    buttonEl.innerHTML = `${CHECK_ICON_SVG} <span>Tersalin</span>`;

    setTimeout(() => {
      buttonEl.classList.remove("copied");
      buttonEl.innerHTML = `${COPY_ICON_SVG} <span>${defaultLabel}</span>`;
    }, 1500);
  } catch (err) {
    console.error("Gagal menyalin teks: ", err);
  }
}

// Initial Setup
updateTextareaHeight();
renderMessages();
