const MODEL_CANDIDATES = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];
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

function parseRetryAfterSeconds(message) {
  const match = message.match(/retry in\s+([\d.]+)s/i);
  if (!match) {
    return null;
  }
  return Math.ceil(Number.parseFloat(match[1]));
}

function isQuotaError(status, message) {
  const normalized = (message || "").toLowerCase();
  return (
    status === 429 ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("rate limit")
  );
}

function formatApiError(status, message) {
  const retryAfterSeconds = parseRetryAfterSeconds(message || "");

  if (isQuotaError(status, message)) {
    return [
      "Your API quota limit has been reached.",
      retryAfterSeconds
        ? `Please try again after ${retryAfterSeconds} seconds.`
        : "Please wait a moment and try again.",
      "If this keeps happening, enable billing in Gemini API or use another API key.",
    ].join(" ");
  }

  if (status === 400 || status === 403) {
    return "Your API key appears invalid or restricted. Please verify it and save it again.";
  }

  return "Request failed. Please try again.";
}

async function requestProposal(apiKey, jobDescription, modelName) {
  const response = await fetch(`${API_BASE_URL}/${modelName}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(jobDescription) }],
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Gemini API request failed.";
    throw {
      status: response.status,
      message,
      modelName,
    };
  }

  const proposal = getGeneratedText(data);
  if (!proposal) {
    throw {
      status: 500,
      message: "No proposal text returned by Gemini.",
      modelName,
    };
  }

  return { proposal, modelName };
}

function buildPrompt(jobDescription) {
  return [
    "You are an expert Upwork freelancer writing highly personalized proposals that sound like a real developer, not a bot.",
    "Write exactly one short proposal for the job description below.",
    "",
    "Follow this structure strictly:",
    "1) Sentence 1: Start with 'I noticed you are looking for someone who can ...' — mention the core technical need using words from the job post.",
    "2) Sentence 2: Start with 'This usually comes up when ...' — name a realistic, specific pain point tied to THIS type of project (e.g. stale odds data, API rate limits, payload bloat), then add a brief parallel experience with a concrete and believable metric or outcome.",
    "3) Sentence 3: Explain your approach in plain language — name at least one specific technology or pattern relevant to the job (e.g. Redis, polling interval, endpoint versioning), and use 'your' naturally.",
    "4) Sentence 4: Offer a small, specific, and actionable freebie (not vague like 'data flow advice'), then end with a curiosity-triggering question that makes them want to reply.",
    "5) Final line must be exactly: 'Best regards!'",
    "",
    "Hard rules:",
    "- Exactly 4 sentences in the body.",
    "- Use clear, short, conversational English — no buzzwords, no corporate tone.",
    "- Use 'you' or 'your' in at least 2 sentences.",
    "- Reference the client's actual tech stack if mentioned in the job description.",
    "- No placeholders, brackets, headings, bullet points, or emojis.",
    "- Metrics must sound realistic and specific, not inflated.",
    "- Be specific to the given job description — generic lines are not allowed.",
    "- If any rule is missed, rewrite silently and return only the corrected final proposal.",
    "",
    "Job description:",
    jobDescription,
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
    let lastError = null;
    for (const modelName of MODEL_CANDIDATES) {
      try {
        const result = await requestProposal(apiKey, jobDescription, modelName);
        proposalOutput.textContent = result.proposal;
        showKeyStatus(`Generated with ${modelName}`, "saved");
        return;
      } catch (error) {
        lastError = error;
        const msg = (error?.message || "").toLowerCase();
        const canTryAnotherModel =
          error?.status === 404 ||
          msg.includes("not found") ||
          msg.includes("unsupported") ||
          msg.includes("quota exceeded") ||
          msg.includes("limit: 0");

        if (!canTryAnotherModel) {
          break;
        }
      }
    }

    const friendlyMessage = formatApiError(
      lastError?.status,
      lastError?.message || "",
    );
    proposalOutput.textContent = friendlyMessage;
  } catch (error) {
    proposalOutput.textContent =
      "An unexpected error occurred. Please reload the extension and try again.";
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
