const MODEL_NAME = "gemini-2.0-flash";
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKey");
const keyStatus = document.getElementById("keyStatus");
const jobDescInput = document.getElementById("jobDesc");
const generateBtn = document.getElementById("generateBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");
const resultSection = document.getElementById("resultSection");
const proposalOutput = document.getElementById("proposalOutput");
const copyBtn = document.getElementById("copyBtn");

function showKeyStatus(message, type) {
  keyStatus.textContent = message;
  keyStatus.className = `key-status ${type}`;
  window.setTimeout(() => {
    keyStatus.textContent = "";
    keyStatus.className = "key-status";
  }, 2200);
}

function setLoadingState(isLoading) {
  generateBtn.disabled = isLoading;
  btnLoader.classList.toggle("hidden", !isLoading);
  btnText.textContent = isLoading ? "Generating..." : "Generate Proposal";
}

function getGeneratedText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim() || ""
  );
}

function buildPrompt(jobDescription) {
  return [
    "You are an expert Upwork freelancer writing proposals.",
    "Write a short, human-written, concise proposal for the job below.",
    "Keep tone natural and confident, not robotic.",
    "Use 3 to 5 short lines only.",
    "Avoid long intros and avoid buzzwords.",
    "",
    "Job description:",
    jobDescription
  ].join("\n");
}

async function loadSavedApiKey() {
  const result = await chrome.storage.local.get(["geminiApiKey"]);
  if (result.geminiApiKey) {
    apiKeyInput.value = result.geminiApiKey;
  }
}

async function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showKeyStatus("Please enter API key first.", "error");
    return;
  }

  await chrome.storage.local.set({ geminiApiKey: apiKey });
  showKeyStatus("API key saved.", "saved");
}

async function generateProposal() {
  const apiKey = apiKeyInput.value.trim();
  const jobDescription = jobDescInput.value.trim();

  if (!apiKey) {
    showKeyStatus("Save API key before generating.", "error");
    return;
  }

  if (!jobDescription) {
    proposalOutput.textContent = "Please paste a job description first.";
    resultSection.classList.remove("hidden");
    return;
  }

  setLoadingState(true);
  resultSection.classList.remove("hidden");
  proposalOutput.textContent = "Generating proposal...";

  try {
    const response = await fetch(
      `${API_BASE_URL}/${MODEL_NAME}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(jobDescription) }]
            }
          ]
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const errorMessage = data?.error?.message || "Gemini API request failed.";
      throw new Error(errorMessage);
    }

    const proposal = getGeneratedText(data);
    if (!proposal) {
      throw new Error("No proposal text returned by Gemini.");
    }

    proposalOutput.textContent = proposal;
  } catch (error) {
    proposalOutput.textContent = `Error: ${error.message}`;
  } finally {
    setLoadingState(false);
  }
}

async function copyProposal() {
  const text = proposalOutput.textContent.trim();
  if (!text || text.startsWith("Error:") || text === "Generating proposal...") {
    return;
  }

  await navigator.clipboard.writeText(text);
  copyBtn.textContent = "Copied";
  copyBtn.classList.add("copied");

  window.setTimeout(() => {
    copyBtn.textContent = "Copy";
    copyBtn.classList.remove("copied");
  }, 1500);
}

saveKeyBtn.addEventListener("click", saveApiKey);
generateBtn.addEventListener("click", generateProposal);
copyBtn.addEventListener("click", copyProposal);

loadSavedApiKey();
