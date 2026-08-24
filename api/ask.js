// api/ask.js
// Vercel serverless function — receives { question, mode } from the frontend,
// builds the correct system prompt (baseline vs graph), calls the selected
// LLM provider server-side (key never reaches the browser), and returns the answer.
//
// TO ADD A NEW PROVIDER: add one entry to the PROVIDERS dictionary below.
// Nothing else in this file needs to change.

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// PROVIDER REGISTRY
// Each entry defines everything needed to call that provider:
//   envKey       - name of the environment variable holding its API key
//   buildUrl     - (apiKey) => full request URL
//   buildHeaders - (apiKey) => headers object
//   buildBody    - (promptText) => request body object (provider-specific shape)
//   parseReply   - (responseJson) => extracted answer string
// ---------------------------------------------------------------------------
const PROVIDERS = {
    gemini: {
        envKey: "GEMINI_API_KEY",
        buildUrl: (apiKey) =>
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        buildHeaders: () => ({ "Content-Type": "application/json" }),
        buildBody: (promptText) => ({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
                maxOutputTokens: 4096,
                thinkingConfig: { thinkingLevel: "low" },
            },
        }),
        parseReply: (data) =>
            data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
            "No response generated.",
    },

    // Add more providers here, e.g.:
    // groq: {
    //   envKey: "GROQ_API_KEY",
    //   buildUrl: () => "https://api.groq.com/openai/v1/chat/completions",
    //   buildHeaders: (apiKey) => ({
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${apiKey}`,
    //   }),
    //   buildBody: (promptText) => ({
    //     model: "openai/gpt-oss-120b",
    //     messages: [{ role: "user", content: promptText }],
    //     temperature: 0.2,
    //     max_tokens: 2048,
    //   }),
    //   parseReply: (data) => data?.choices?.[0]?.message?.content || "No response generated.",
    // },
    // openai: {
    //   envKey: "OPENAI_API_KEY",
    //   buildUrl: () => "https://api.openai.com/v1/chat/completions",
    //   buildHeaders: (apiKey) => ({
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${apiKey}`,
    //   }),
    //   buildBody: (promptText) => ({
    //     model: "gpt-4o-mini",
    //     messages: [{ role: "user", content: promptText }],
    //     temperature: 0.2,
    //   }),
    //   parseReply: (data) => data?.choices?.[0]?.message?.content || "No response generated.",
    // },
};

// Default provider if the frontend doesn't specify one (or set LLM_PROVIDER env var).
// The actual active provider per-request now comes from the request body,
// so it can be changed live from the UI — see handler below.
const DEFAULT_PROVIDER = process.env.LLM_PROVIDER || "gemini";

// ---------------------------------------------------------------------------
// Data + prompt templates (loaded once per cold start)
// ---------------------------------------------------------------------------
const baselineCorpus = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "baseline_corpus.json"), "utf-8")
);
const graphData = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "demo_kg.json"), "utf-8")
);
const baselinePromptTemplate = fs.readFileSync(
    path.join(process.cwd(), "prompts", "baseline_prompt.txt"),
    "utf-8"
);
const graphPromptTemplate = fs.readFileSync(
    path.join(process.cwd(), "prompts", "graph_prompt.txt"),
    "utf-8"
);

function buildBaselinePrompt(question) {
    const docsText = baselineCorpus
        .map((d) => `[doc_id: ${d.id}] (${d.date}) ${d.text}`)
        .join("\n\n");

    return baselinePromptTemplate
        .replace("{{DOCUMENTS}}", docsText)
        .replace("{{QUESTION}}", question);
}

function buildGraphPrompt(question) {
    const graphText = JSON.stringify(
        { nodes: graphData.nodes, edges: graphData.edges },
        null,
        2
    );

    return graphPromptTemplate
        .replace("{{GRAPH_JSON}}", graphText)
        .replace("{{QUESTION}}", question);
}

// ---------------------------------------------------------------------------
// Generic call — works for whichever provider name is passed in, using its
// registry entry. providerName comes from the frontend request (UI dropdown),
// falling back to DEFAULT_PROVIDER if not specified.
// ---------------------------------------------------------------------------
async function callProvider(promptText, providerName) {
    const provider = PROVIDERS[providerName];
    if (!provider) {
        throw new Error(
            `Unknown provider "${providerName}". Available: ${Object.keys(PROVIDERS).join(", ")}`
        );
    }

    const apiKey = process.env[provider.envKey];
    if (!apiKey) {
        throw new Error(`${provider.envKey} is not set in environment variables.`);
    }

    const response = await fetch(provider.buildUrl(apiKey), {
        method: "POST",
        headers: provider.buildHeaders(apiKey),
        body: JSON.stringify(provider.buildBody(promptText)),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${providerName} API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return provider.parseReply(data);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
    }

    try {
        const { question, mode, provider } = req.body || {};

        if (!question || typeof question !== "string") {
            res.status(400).json({ error: "Missing or invalid 'question' field." });
            return;
        }
        if (mode !== "baseline" && mode !== "graph") {
            res.status(400).json({ error: "'mode' must be 'baseline' or 'graph'." });
            return;
        }

        const providerName = provider || DEFAULT_PROVIDER;
        if (!PROVIDERS[providerName]) {
            res.status(400).json({
                error: `Unknown provider "${providerName}". Available: ${Object.keys(PROVIDERS).join(", ")}`,
            });
            return;
        }

        const promptText =
            mode === "baseline" ? buildBaselinePrompt(question) : buildGraphPrompt(question);

        const answer = await callProvider(promptText, providerName);

        res.status(200).json({ mode, provider: providerName, answer });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Internal server error." });
    }
};