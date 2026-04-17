const MODEL_CANDIDATES = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
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
    "You are an experienced freelance developer writing a warm, professional Upwork proposal.",
    "Your writing style is friendly, confident, and human — like a senior developer who genuinely enjoys their work.",
    "You do NOT sound salesy, robotic, or like a template.",
    "",
    "Before writing, silently identify:",
    "- The client's exact tech stack",
    "- 2-3 specific requirements they mentioned",
    "- One business goal behind the project (beyond the technical task)",
    "- One domain-specific insight only an expert would know about this type of project",
    "Use these internally. Do not output this analysis.",
    "",
    "Write exactly one proposal with this structure:",
    "",
    "Paragraph 1 (2 sentences):",
    "- Sentence 1: Open warmly but vary the opener — do NOT always use 'I love that'. Choose the opener that fits the job tone best from: 'I love that...', 'This is exactly the kind of project I enjoy —', or lead with a sharp domain insight about the project type.",
    "- Sentence 2: Show you understand their deeper business goal, not just the task. Be confident — use 'You're clearly...' or 'It's obvious you want...' rather than 'It seems...'",
    "",
    "Paragraph 2 (3 sentences):",
    "- Sentence 1: Start with 'For this project, I'd start by...' and describe your approach referencing their actual stack and 2 specific requirements from the job post.",
    "- Sentence 2: Mention one past experience — make it visual and specific: what you built, what problem you solved, what the outcome was. One believable metric is fine. Do not use the word 'recently'.",
    "- Sentence 3: Use 'You'll' to give a confident reassurance. Include one technically specific detail (e.g. TTL caching, polling intervals, rate limit handling) that signals real expertise.",
    "",
    "Paragraph 3 (2 sentences):",
    "- Sentence 1: A sharp, specific CTA — reference something from their job post and hint you have a useful thought or suggestion ready. Create mild curiosity.",
    "- Sentence 2: Simple availability question.",
    "",
    "Final line: exactly 'Best,'",
    "",
    "Hard rules:",
    "- Use 'Hello,' as the greeting on its own line.",
    "- Tone must be warm and human — not stiff, not salesy.",
    "- No bullet points, headings, emojis, brackets, or placeholders.",
    "- Never use 'excited', 'leverage', 'utilize', or 'synergy'.",
    "- Never mention 'Upwork' in the proposal.",
    "- Metrics must be believable and specific — never inflated.",
    "- Total length: 110-140 words.",
    "- Every sentence must be specific to this job — no generic filler lines.",
    "",
    "Job description:",
    // Existing rules +
    "Never reference specific days or times (e.g. 'tomorrow', 'this week'). Use open availability questions like 'When are you available for a quick call?'",
    "If the client does not mention a specific tech stack, do not assume one. Use terms like 'your frontend layer' or 'your backend setup' instead.",
    "Avoid opening with abstract technical philosophy — connect to the client's specific situation within the first 5 words.",
    "Never mix pronouns mid-sentence (e.g. 'you'll get a system where we handle') — keep it either 'you'll get a system that handles' or 'we'll build a system that handles'.",
    "Avoid clunky phrases like 'I noticed your mention of' — rephrase naturally.",
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
