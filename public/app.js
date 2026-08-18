const form = document.querySelector("#prompt-form");
const promptInput = document.querySelector("#prompt");
const answer = document.querySelector("#answer");
const submitButton = document.querySelector("#submit-button");
const copyButton = document.querySelector("#copy-button");

let latestAnswer = "";

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = promptInput.value.trim();

  if (!prompt) {
    answer.textContent = "Tulis prompt dulu ya.";
    copyButton.disabled = true;
    return;
  }

  submitButton.disabled = true;
  copyButton.disabled = true;
  answer.textContent = "Sedang meminta jawaban...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request gagal.");
    }

    latestAnswer = data.text;
    answer.textContent = latestAnswer;
    copyButton.disabled = false;
  } catch (error) {
    latestAnswer = "";
    answer.textContent = error.message;
    copyButton.disabled = true;
  } finally {
    submitButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  if (!latestAnswer) {
    return;
  }

  await navigator.clipboard.writeText(latestAnswer);
  copyButton.textContent = "Tersalin";

  window.setTimeout(() => {
    copyButton.textContent = "Salin";
  }, 1200);
});
