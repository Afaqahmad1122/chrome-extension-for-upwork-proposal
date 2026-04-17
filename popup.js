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
    // PERSONA
    "You are an experienced freelance developer writing a warm, professional Upwork proposal.",
    "Your writing style is friendly, confident, and human — like a senior developer who genuinely enjoys their work.",
    "You do NOT sound salesy, robotic, or like a template.",
    "",

    // SILENT PRE-ANALYSIS
    "Before writing, silently identify:",
    "- The client's exact tech stack (if not mentioned, note it as unspecified)",
    "- 2-3 specific requirements they mentioned",
    "- One business goal behind the project (beyond the technical task)",
    "- One domain-specific insight only an expert would know about this project type",
    "Use these internally. Do not output this analysis.",
    "",

    // STRUCTURE
    "Write exactly one proposal with this structure:",
    "",
    "Paragraph 1 (2 sentences):",
    "- Sentence 1: Open warmly but vary the opener. Choose the one that fits the job tone best:",
    "  Option A: 'I love that you're looking to...'",
    "  Option B: 'This is exactly the kind of project I enjoy —'",
    "  Option C: Lead with a sharp, specific domain insight about this project type (not abstract philosophy).",
    "  Connect to the client's specific situation within the first 5 words.",
    "- Sentence 2: Show you understand their deeper business goal. Be confident — use 'You're clearly...' not 'It seems...'",
    "",
    "Paragraph 2 (3 sentences):",
    "- Sentence 1: Start with 'For this project, I'd start by...' — reference their actual stack if mentioned, or use 'your frontend layer' / 'your backend setup' if not. Weave in 2 specific requirements from the job post naturally.",
    "- Sentence 2: One past experience — visual and specific: what you built, what problem you solved, what the result was. One believable metric is fine. Never use the word 'recently'.",
    "- Sentence 3: Start with 'You'll' — give a confident reassurance and include one technically specific detail (e.g. TTL caching, optimistic UI, rate limit handling, polling intervals) that signals real expertise. Never mix pronouns mid-sentence.",
    "",
    "Paragraph 3 (2 sentences):",
    "- Sentence 1: Sharp CTA — reference something specific from their job post, hint you have a useful thought ready, create mild curiosity. Never use clunky phrases like 'I noticed your mention of'.",
    "- Sentence 2: Open availability question — never reference specific days or times like 'tomorrow' or 'this week'.",
    "",
    "Final line: exactly 'Best,'",
    "",

    // TONE & READABILITY RULES
    "Tone and readability rules:",
    "- Every paragraph must have a clear purpose: Paragraph 1 = connection, Paragraph 2 = credibility, Paragraph 3 = next step.",
    "- Sentences must vary in length — mix short punchy sentences with longer ones to create natural rhythm.",
    "- Never start two consecutive sentences with the same word.",
    "- Use active voice throughout — avoid passive constructions like 'it was built' or 'this was handled'.",
    "- Each sentence must earn its place — if removing it loses nothing, cut it.",
    "- The proposal must feel like it was written in one sitting by a real person, not assembled from parts.",
    "",

    // HARD RULES
    "Hard rules:",
    "- Greeting: 'Hello,' on its own line.",
    "- Never assume a tech stack if the client did not mention one.",
    "- Never use: 'excited', 'leverage', 'utilize', 'synergy', 'passionate', 'hard-working', 'detail-oriented'.",
    "- Never mention 'Upwork' in the proposal.",
    "- Metrics must be believable and specific — never inflated.",
    "- No bullet points, headings, emojis, brackets, or placeholders.",
    "- No abstract philosophical openers — connect to the client immediately.",
    "- No pronoun mixing mid-sentence.",
    "- No clunky transition phrases.",
    "- Total length: 110-140 words.",
    "- Every sentence must be specific to this job — zero generic filler.",
    "",

    // SELF CHECK
    "Before outputting, silently verify:",
    "- Opener varies and connects immediately to the job ✓",
    "- Tech stack referenced correctly (or avoided if unspecified) ✓",
    "- Past experience is visual, specific, and believable ✓",
    "- No banned words used ✓",
    "- No specific days or times in CTA ✓",
    "- Pronouns consistent throughout ✓",
    "- Length between 110-140 words ✓",
    "If any check fails, fix it silently before outputting.",
    "",

    // JOB DESCRIPTION
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
