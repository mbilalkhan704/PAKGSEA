// public/app.js
console.log("APP.JS LOADED");
// ---------------------------------------------------------------------------
// Demo question tiers
// ---------------------------------------------------------------------------
const TIERS = [

    {
        tier: "Tier 1 — Basic Factual Retrieval",
        questions: [
            "How many people were killed in the Abbas Town mosque bombing?",
            "What weapon was used in the attack on Justice Maqbool Baqir's convoy?",
        ],
    },

    {
        tier: "Tier 2 — Cross-Incident Pattern Analysis",
        questions: [
            "Which incidents involved TTP using explosives against government or political targets?",
            "Compare MQM's and TTP's attack patterns in Karachi. What is different about their preferred weapons and targets?",
        ],
    },

    {
        tier: "Tier 3 — Multi-Hop Relational Reasoning",
        questions: [
            "Which attacks share both the same actor and the same weapon type as the Manzar Imam assassination?",
            "Which other TTP incidents in Karachi targeted political organizations or government officials using the same weapon type as the Manzar Imam assassination?",
        ],
    },

    {
        tier: "Tier 4 — Provenance & Attribution Reasoning",
        questions: [
            "How confident can we be that MQM was responsible for the 1998 market bombing?",
            "Among the incidents attributed to MQM, how does the strength of attribution vary — which are based on a formal claim of responsibility versus suspicion or blame?",
        ],
    },

    {
        tier: "Tier 5 — Temporal, Aggregative & Provenance-Aware Reasoning",
        questions: [
            "Across MQM and TTP incidents in Karachi, how does weapon choice relate to target type? Identify the most frequent observed weapon–target associations for each actor, compare their distributions, and distinguish relationships explicitly documented in individual incidents from patterns inferred by aggregating multiple incidents.",
            "How did MQM's attack profile change between its earlier incidents (1998–2002) and its later incidents (2013–2018), considering attack type, weapon, target type, and attribution strength? Which of those changes can be supported by explicit provenance, and which are only patterns inferred from the incident data?",
        ],
    },

    {
        tier: "Tier 6 — Comparative, Combinatorial & Higher-Order Reasoning",
        questions: [
            "Are there any TTP incidents where the attack type, weapon type, and target type form a combination that also appears in an MQM incident? If so, which incidents and what are the similarities and differences?",
            "During the period when both MQM and TTP appear in the Karachi dataset, which actor showed greater diversity in attack types and target types, and what evidence supports that conclusion?",
        ],
    },

];

const UNSUPPORTED_PATTERNS = [
    /not supported by the graph/i,
    /not addressed in the provided documents/i,
    /not found in the provided documents/i,
];

// Relation types used to derive an incident's plain-language "facts".
// If your demo_kg.json uses different relation strings, update this set.
const FACT_RELATIONS = new Set([
    "ASSOCIATED_WITH",
    "HAS_ATTACK_TYPE",
    "USED_WEAPON",
    "HAS_TARGET_TYPE",
]);

const SVG_NS = "http://www.w3.org/2000/svg";
const COLOR_STRONG = "#4fbf9f"; // confirmed / claimed_responsibility
const COLOR_WEAK = "#d9a441"; // suspected / believed / blamed / attributed / linked_by_arrest
const COLOR_NEUTRAL = "#5b6472"; // recorded_as_actor / unspecified — never implies confirmed
const COLOR_HUB = "#7a8dd6"; // shared actor/weapon/etc. pivot in a traversal chain

// Grouped-layout threshold: above this many cited incidents, switch from a
// traversal chain to grouped-by-attribution boxes (too many for a legible fan).
const GROUP_THRESHOLD = 6;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentMode = "graph";
let graphMeta = null;
let baselineMeta = null;
let currentSvgNode = null;
let lastHighlightedRect = null;

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const modeButtons = document.querySelectorAll(".mode-btn");
const modeHint = document.getElementById("mode-hint");
const providerSelect = document.getElementById("provider-select");
const tiersContainer = document.getElementById("question-tiers");
const questionInput = document.getElementById("question-input");
const askBtn = document.getElementById("ask-btn");
const answerBody = document.getElementById("answer-body");
const answerModeTag = document.getElementById("answer-mode-tag");
const answerProviderTag = document.getElementById("answer-provider-tag");
const evidenceTrail = document.getElementById("evidence-trail");
const evidenceChips = document.getElementById("evidence-chips");
const graphViz = document.getElementById("graph-viz");
const graphToolbar = document.getElementById("graph-toolbar");
const downloadSvgBtn = document.getElementById("download-svg-btn");
const evidenceDetail = document.getElementById("evidence-detail");
const presentationToggle = document.getElementById("presentation-toggle");

const MODE_HINTS = {
    graph: "Answers by traversing typed nodes and edges, with per-edge attribution.",
    baseline: "Answers by reading flat incident summaries, no structured relationships provided.",
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
    renderTiers();
    attachModeToggle();
    attachAsk();
    attachPresentationToggle();
    if (downloadSvgBtn) downloadSvgBtn.addEventListener("click", downloadGraphSvg);

    try {
        const res = await fetch("/data/demo_kg.json");
        graphMeta = await res.json();
    } catch (err) {
        console.warn("Could not load graph metadata:", err);
    }

    try {
        const res = await fetch("/data/baseline_corpus.json");
        baselineMeta = await res.json();
    } catch (err) {
        console.warn("Could not load baseline corpus:", err);
    }
}

function renderTiers() {
    tiersContainer.innerHTML = "";
    TIERS.forEach((tierGroup) => {
        tierGroup.questions.forEach((q, i) => {
            const btn = document.createElement("button");
            btn.className = "tier-btn";
            btn.innerHTML = `<span class="tier-label">${tierGroup.tier} · Q${i + 1}</span>${escapeHtml(q)}`;
            btn.addEventListener("click", () => {
                questionInput.value = q;
                questionInput.focus();
            });
            tiersContainer.appendChild(btn);
        });
    });
}

function attachModeToggle() {
    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            modeButtons.forEach((b) => {
                b.classList.remove("active");
                b.setAttribute("aria-selected", "false");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");
            currentMode = btn.dataset.mode;
            modeHint.textContent = MODE_HINTS[currentMode];
        });
    });
}

function attachAsk() {
    askBtn.addEventListener("click", handleAsk);
    questionInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk();
    });
}

function attachPresentationToggle() {
    if (!presentationToggle) return;
    presentationToggle.addEventListener("click", () => {
        document.body.classList.toggle("presentation-mode");
        const isOn = document.body.classList.contains("presentation-mode");
        presentationToggle.setAttribute("aria-pressed", String(isOn));
        presentationToggle.textContent = isOn ? "Presentation mode: on" : "Presentation mode";
    });
}

// ---------------------------------------------------------------------------
// Ask flow
// ---------------------------------------------------------------------------
async function handleAsk() {
    const question = questionInput.value.trim();
    if (!question) return;

    const provider = providerSelect.value;
    setLoading();

    try {
        const res = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, mode: currentMode, provider }),
        });

        const data = await res.json();

        if (!res.ok) {
            renderError(data.error || "Something went wrong.");
            return;
        }

        renderAnswer(data.answer, data.mode, data.provider, question);
    } catch (err) {
        renderError(err.message || "Network error.");
    }
}

function setLoading() {
    askBtn.disabled = true;
    answerBody.innerHTML = `<p class="answer-loading">Querying ${currentMode} mode…</p>`;
    evidenceTrail.hidden = true;
    evidenceChips.hidden = true;
    evidenceChips.innerHTML = "";
    graphViz.hidden = true;
    graphViz.innerHTML = "";
    graphToolbar.hidden = true;
    evidenceDetail.hidden = true;
    evidenceDetail.innerHTML = "";
    currentSvgNode = null;
    lastHighlightedRect = null;
}

function renderError(message) {
    askBtn.disabled = false;
    answerBody.innerHTML = `<p class="answer-error">${escapeHtml(message)}</p>`;
}

function renderAnswer(answerText, mode, provider, question) {
    askBtn.disabled = false;

    answerModeTag.textContent = mode.toUpperCase();
    answerModeTag.className = `answer-mode-tag ${mode}`;

    const citations = extractCitations(answerText, mode);
    const isUnsupported = UNSUPPORTED_PATTERNS.some((p) => p.test(answerText));

    const displayText = mode === "graph" ? stripCitationTags(answerText, "edge_id") : answerText;
    const formatted = formatAnswerText(displayText);
    answerBody.innerHTML = `<div class="${isUnsupported ? "answer-unsupported" : ""}">${formatted}</div>`;

    renderEvidence(citations, mode, question);
}

function stripCitationTags(text, tagName) {
    const pattern = new RegExp(`\\s*\\[${tagName}:\\s*[\\w-]+\\]`, "g");
    return text
        .replace(pattern, "")
        .replace(/\s+([.,;:!?])/g, "$1")
        .replace(/[ \t]{2,}/g, " ");
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------
function formatAnswerText(text) {
    const escaped = escapeHtml(text);
    const lines = escaped.split("\n");

    let html = "";
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
        if (inUl) { html += "</ul>"; inUl = false; }
        if (inOl) { html += "</ol>"; inOl = false; }
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();

        if (line === "") {
            closeLists();
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            closeLists();
            const level = headingMatch[1].length;
            html += `<h${level} class="answer-heading">${inlineFormat(headingMatch[2])}</h${level}>`;
            return;
        }

        const ulMatch = line.match(/^[-*]\s+(.*)$/);
        if (ulMatch) {
            if (!inUl) { closeLists(); html += "<ul>"; inUl = true; }
            html += `<li>${inlineFormat(ulMatch[1])}</li>`;
            return;
        }

        const olMatch = line.match(/^\d+\.\s+(.*)$/);
        if (olMatch) {
            if (!inOl) { closeLists(); html += "<ol>"; inOl = true; }
            html += `<li>${inlineFormat(olMatch[1])}</li>`;
            return;
        }

        closeLists();
        html += `<p>${inlineFormat(line)}</p>`;
    });

    closeLists();
    return html;
}

function inlineFormat(str) {
    return str.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// ---------------------------------------------------------------------------
// Citation extraction
// ---------------------------------------------------------------------------
function extractCitations(text, mode) {
    const pattern = mode === "graph" ? /\[edge_id:\s*([\w-]+)\]/g : /\[doc_id:\s*([\w-]+)\]/g;
    const matches = [...text.matchAll(pattern)];
    return [...new Set(matches.map((m) => m[1]))];
}

// ---------------------------------------------------------------------------
// Evidence rendering dispatcher
// ---------------------------------------------------------------------------
function renderEvidence(ids, mode, question) {
    evidenceDetail.hidden = true;
    evidenceDetail.innerHTML = "";

    if (ids.length === 0) {
        evidenceTrail.hidden = true;
        return;
    }

    evidenceTrail.hidden = false;

    if (mode === "graph") {
        evidenceChips.hidden = true;
        evidenceChips.innerHTML = "";
        renderEvidenceTrailDiagram(ids, question);
    } else {
        graphViz.hidden = true;
        graphToolbar.hidden = true;
        evidenceChips.hidden = false;
        renderBaselineChips(ids);
    }
}

function renderBaselineChips(ids) {
    evidenceChips.innerHTML = "";
    ids.forEach((id) => {
        const doc = baselineMeta ? baselineMeta.find((d) => d.id === id) : null;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "evidence-chip";
        chip.textContent = doc ? `${doc.date} · ${truncate(doc.text, 42)}` : id;
        chip.title = "Click for full source text";
        chip.addEventListener("click", () => showEvidenceDetail(doc, id, "baseline"));
        evidenceChips.appendChild(chip);
    });
}

function truncate(str, n) {
    return str.length > n ? str.slice(0, n).trim() + "…" : str;
}

// ===========================================================================
// PROVENANCE-AWARE EVIDENCE TRAIL
// Renders QUESTION -> EVIDENCE -> ANSWER as a vertical flow. The evidence
// shape (traversal chain vs grouped-by-attribution) is chosen automatically
// from the actual cited data — nothing here is specific to any one question.
// ===========================================================================

function attributionTier(attr) {
    if (attr === "confirmed" || attr === "claimed_responsibility") return 0; // strong
    if (!attr || attr === "recorded_as_actor") return 2; // ambiguous — never implies confirmed
    return 1; // circumstantial: suspected, believed, blamed, attributed, linked_by_arrest
}

function tierColor(tier) {
    if (tier === 0) return COLOR_STRONG;
    if (tier === 1) return COLOR_WEAK;
    return COLOR_NEUTRAL;
}

function attributionLabel(attr) {
    if (!attr) return "RECORDED AS ACTOR";
    return attr.replace(/_/g, " ").toUpperCase();
}

function relationLabel(relation) {
    return relation.toUpperCase().replace(/_/g, " ");
}

function shortId(id) {
    const parts = String(id).split(":");
    return parts[parts.length - 1];
}

function shortDescription(facts) {
    return [facts.attackType, facts.targetType].filter(Boolean).join(" · ") || null;
}

function getSourceExcerpt(edgeId, maxChars) {
    if (!edgeId || !graphMeta) return "";
    const edge = graphMeta.edges.find((e) => e.id === edgeId);
    const text = edge?.provenance?.text;
    if (!text) return "";
    return text.length > maxChars ? text.slice(0, maxChars).trim() + "…" : text;
}

function getEventId(facts, incidentId) {
    if (facts.edgeId && graphMeta) {
        const edge = graphMeta.edges.find((e) => e.id === facts.edgeId);
        if (edge?.provenance?.event_id) return edge.provenance.event_id;
    }
    return shortId(incidentId);
}

function getConnectedFacts(incidentId) {
    const edges = graphMeta.edges.filter(
        (e) => (e.source === incidentId || e.target === incidentId) && FACT_RELATIONS.has(e.relation)
    );

    const facts = { actor: null, weapon: null, attackType: null, targetType: null, attribution: null, edgeId: null };

    edges.forEach((e) => {
        const otherId = e.source === incidentId ? e.target : e.source;
        const otherNode = graphMeta.nodes.find((n) => n.id === otherId);
        if (!otherNode) return;

        if (e.relation === "ASSOCIATED_WITH") {
            facts.actor = otherNode.name;
            facts.attribution = e.provenance?.attribution || null;
            facts.edgeId = e.id;
        } else if (e.relation === "USED_WEAPON") {
            facts.weapon = otherNode.name;
        } else if (e.relation === "HAS_ATTACK_TYPE") {
            facts.attackType = otherNode.name;
        } else if (e.relation === "HAS_TARGET_TYPE") {
            facts.targetType = otherNode.name;
        }
    });

    return facts;
}

function orderedCitedIncidents(citedIds) {
    const citedEdges = graphMeta.edges.filter((e) => citedIds.includes(e.id));
    const incidentIds = [];
    citedEdges.forEach((e) => {
        [e.source, e.target].forEach((id) => {
            if (typeof id === "string" && id.startsWith("incident:") && !incidentIds.includes(id)) {
                incidentIds.push(id);
            }
        });
    });
    return incidentIds;
}

function buildEvidenceItems(incidentIds) {
    return incidentIds.map((id) => {
        const node = graphMeta.nodes.find((n) => n.id === id);
        return {
            incidentId: id,
            date: node?.properties?.date || shortId(id),
            facts: getConnectedFacts(id),
        };
    });
}

// Finds attribute values (actor/weapon/attackType/targetType) shared by
// EVERY cited item — these are the real pivot criteria that explain why
// the incidents were selected together, derived from the data itself.
function chooseHubsForChain(items) {
    const dimsPriority = ["actor", "weapon", "attackType", "targetType"];
    const hubs = [];
    dimsPriority.forEach((dim) => {
        const values = items.map((it) => it.facts[dim]).filter(Boolean);
        if (values.length === items.length && values.every((v) => v === values[0])) {
            hubs.push({ dim, name: values[0] });
        }
    });
    return hubs.slice(0, 2);
}

function relationForDim(dim) {
    return { actor: "ASSOCIATED_WITH", weapon: "USED_WEAPON", attackType: "HAS_ATTACK_TYPE", targetType: "HAS_TARGET_TYPE" }[dim];
}

function dimLabel(dim) {
    return { actor: "ACTOR", weapon: "WEAPON", attackType: "ATTACK TYPE", targetType: "TARGET TYPE" }[dim] || dim.toUpperCase();
}

// ---------------------------------------------------------------------------
// Low-level SVG box primitive — every card/pill in the trail is built from
// this. Text is pre-wrapped and passed as a line array, so nothing overflows
// the box: the box grows to fit the text, never the reverse.
// ---------------------------------------------------------------------------
function textLine(text, opts = {}) {
    return { text, ...opts };
}

function wrapAsLines(text, maxChars, opts = {}) {
    if (!text) return [];
    const words = String(text).split(/\s+/);
    const out = [];
    let current = "";
    words.forEach((w) => {
        const test = current ? current + " " + w : w;
        if (test.length > maxChars && current) {
            out.push(current);
            current = w;
        } else {
            current = test;
        }
    });
    if (current) out.push(current);
    return out.map((t) => textLine(t, opts));
}

function highlightRect(rectSel) {
    if (lastHighlightedRect) lastHighlightedRect.attr("stroke-width", 1.8);
    rectSel.attr("stroke-width", 3.2);
    lastHighlightedRect = rectSel;
}

function renderBox(layer, { x, y, width, lines, borderColor, fill, onClick, pill = false }) {
    const lineHeight = 12;
    const padding = 9;
    const height = padding * 2 + Math.max(lines.length, 1) * lineHeight;

    const g = layer
        .append("g")
        .attr("transform", `translate(${x - width / 2}, ${y - height / 2})`)
        .style("cursor", onClick ? "pointer" : "default");

    const rect = g
        .append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("rx", pill ? height / 2 : 6)
        .attr("fill", fill || "#1c2430")
        .attr("stroke", borderColor || "#2a323d")
        .attr("stroke-width", 1.8);

    const text = g.append("text").attr("text-anchor", "middle");
    lines.forEach((ln, i) => {
        text
            .append("tspan")
            .attr("x", width / 2)
            .attr("y", padding + (i + 0.9) * lineHeight)
            .attr("font-size", ln.size || 9)
            .attr("font-family", ln.font || "IBM Plex Sans, sans-serif")
            .attr("fill", ln.color || "#e7e4dc")
            .attr("font-weight", ln.weight || "400")
            .text(ln.text);
    });

    if (onClick) g.on("click", () => { highlightRect(rect); onClick(); });

    return { leftX: x - width / 2, rightX: x + width / 2, topY: y - height / 2, bottomY: y + height / 2, midX: x, midY: y, width, height, rectSel: rect };
}

function drawConnector(layer, x1, y1, x2, y2, label) {
    layer
        .append("path")
        .attr("d", `M${x1},${y1} L${x2},${y2}`)
        .attr("stroke", "#3a4552")
        .attr("stroke-width", 1.4)
        .attr("stroke-dasharray", "2,3")
        .attr("fill", "none");
    if (label) {
        layer
            .append("text")
            .attr("x", x1 + 10)
            .attr("y", (y1 + y2) / 2 - 3)
            .attr("font-size", 7.5)
            .attr("font-family", "IBM Plex Mono, monospace")
            .attr("fill", "#6b7480")
            .text(label);
    }
}

function bezierPath(x1, y1, x2, y2) {
    const midY = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
}

function setupSvg(width, initialHeight, displayHeight) {
    const svg = d3
        .select(graphViz)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${initialHeight}`)
        .attr("width", "100%")
        .attr("height", displayHeight);

    currentSvgNode = svg.node();

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    svg.call(
        d3.zoom()
            .scaleExtent([0.4, 3])
            .on("zoom", (event) => zoomLayer.attr("transform", event.transform))
    );

    return { svg, zoomLayer };
}

function finalizeSvgSize(svg, zoomLayer) {
    const bbox = zoomLayer.node().getBBox();
    svg.attr("viewBox", `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);
    svg.attr("height", Math.min(bbox.height + 40, 560));
}

// --- Line builders for each box type ---
function questionLines(question, width) {
    return [
        textLine("QUESTION", { size: 8, font: "IBM Plex Mono, monospace", color: "#8b93a0", weight: "600" }),
        ...wrapAsLines(question || "Query", Math.floor(width / 6.2), { size: 10.5, color: "#e7e4dc" }),
    ];
}

function hubLines(hub) {
    return [
        textLine(dimLabel(hub.dim), { size: 7.5, font: "IBM Plex Mono, monospace", color: "#c9d1e0" }),
        textLine(hub.name, { size: 10.5, color: "#e7e4dc", weight: "600" }),
    ];
}

// tag: optional label like "REFERENCE / CONTEXT" shown above the date
function evidenceCardLines(item, width, tag) {
    const attr = item.facts.attribution;
    const color = tierColor(attributionTier(attr));
    const desc = shortDescription(item.facts);
    const edgeId = item.facts.edgeId;
    const eventId = getEventId(item.facts, item.incidentId);
    const excerpt = getSourceExcerpt(edgeId, 44);

    const lines = [];
    if (tag) lines.push(textLine(tag, { size: 7, font: "IBM Plex Mono, monospace", color: "#6b7480", weight: "600" }));
    lines.push(textLine(item.date, { size: 10.5, color: "#e7e4dc", weight: "600" }));
    if (desc) lines.push(...wrapAsLines(desc, Math.floor(width / 6.4), { size: 8, color: "#c7cdd6" }).slice(0, 2));
    lines.push(textLine(attributionLabel(attr), { size: 8, font: "IBM Plex Mono, monospace", color, weight: "600" }));
    if (edgeId) lines.push(textLine(`${edgeId} · event ${eventId}`, { size: 6.8, font: "IBM Plex Mono, monospace", color: "#5b6472" }));
    if (excerpt) lines.push(...wrapAsLines(`"${excerpt}"`, Math.floor(width / 5.4), { size: 7.3, color: "#8b93a0" }).slice(0, 2));

    return { lines, color, edgeId };
}

function answerLines(title, subLines) {
    return [
        textLine("ANSWER", { size: 8, font: "IBM Plex Mono, monospace", color: COLOR_STRONG, weight: "600" }),
        textLine(title, { size: 11, color: "#e7e4dc", weight: "600" }),
        ...subLines.map((s) => textLine(s, { size: 8, font: "IBM Plex Mono, monospace", color: "#8b93a0" })),
    ];
}

function evidenceClickHandler(edgeId) {
    return () => {
        if (!edgeId) return;
        const edge = graphMeta.edges.find((e) => e.id === edgeId);
        if (edge) showEvidenceDetail(edge, edge.id, "graph");
    };
}

// ---------------------------------------------------------------------------
// Dispatcher — chooses the evidence shape from the actual cited data
// ---------------------------------------------------------------------------
function renderEvidenceTrailDiagram(citedIds, question) {
    if (!graphMeta) {
        graphViz.hidden = true;
        graphToolbar.hidden = true;
        return;
    }

    const incidentIds = orderedCitedIncidents(citedIds);
    if (incidentIds.length === 0) {
        graphViz.hidden = true;
        graphToolbar.hidden = true;
        return;
    }

    graphViz.hidden = false;
    graphToolbar.hidden = false;
    graphViz.innerHTML = "";

    const items = buildEvidenceItems(incidentIds);

    if (items.length > GROUP_THRESHOLD) {
        renderGroupedTrail(items, question);
        return;
    }

    const hubs = chooseHubsForChain(items);
    if (hubs.length > 0 && items.length > 1) {
        renderChainTrail(items, hubs, question);
    } else {
        renderFlatTrail(items, question);
    }
}

// ---------------------------------------------------------------------------
// CHAIN layout — an actual traversal path: hub -> reference incident ->
// (hub) -> fan-out to matching incidents -> answer. Used when a small
// number of incidents share a common actor/weapon/etc.
// ---------------------------------------------------------------------------
function renderChainTrail(items, hubs, question) {
    const width = graphViz.clientWidth || 700;
    const centerX = width / 2;
    const reference = items[0];
    const matches = items.slice(1);
    const cardWidth = 156;

    const { svg, zoomLayer } = setupSvg(width, 2000, 480);
    const edgeLayer = zoomLayer.append("g");
    const nodeLayer = zoomLayer.append("g");

    let y = 26;

    const qBox = renderBox(nodeLayer, { x: centerX, y, width: 170, lines: questionLines(question, 170), borderColor: "#8b93a0" });
    y = qBox.bottomY + 22;

    nodeLayer
        .append("text")
        .attr("x", centerX).attr("y", y).attr("text-anchor", "middle")
        .attr("font-size", 8.5).attr("font-family", "IBM Plex Mono, monospace").attr("letter-spacing", "0.08em")
        .attr("fill", "#6b7480")
        .text("EVIDENCE — REASONING PATH");
    drawConnector(edgeLayer, centerX, qBox.bottomY, centerX, y - 10, null);
    y += 24;

    let prevBottom = { x: centerX, y };
    let referenceDrawn = false;

    hubs.forEach((hub, i) => {
        const hb = renderBox(nodeLayer, { x: centerX, y: prevBottom.y + 30, width: 140, lines: hubLines(hub), borderColor: COLOR_HUB, fill: "#1c2430", pill: true });
        drawConnector(edgeLayer, prevBottom.x, prevBottom.y, centerX, hb.topY, i === 0 ? null : relationForDim(hubs[i - 1].dim));
        prevBottom = { x: centerX, y: hb.bottomY };

        if (!referenceDrawn) {
            const refInfo = evidenceCardLines(reference, cardWidth + 20, "REFERENCE / CONTEXT");
            const refBox = renderBox(nodeLayer, {
                x: centerX, y: prevBottom.y + 34, width: cardWidth + 20,
                lines: refInfo.lines, borderColor: "#8b93a0",
                onClick: evidenceClickHandler(refInfo.edgeId),
            });
            drawConnector(edgeLayer, prevBottom.x, prevBottom.y, centerX, refBox.topY, relationForDim(hub.dim));
            prevBottom = { x: centerX, y: refBox.bottomY };
            referenceDrawn = true;
        }
    });

    y = prevBottom.y + 26;
    nodeLayer
        .append("text")
        .attr("x", centerX).attr("y", y).attr("text-anchor", "middle")
        .attr("font-size", 8.5).attr("font-family", "IBM Plex Mono, monospace").attr("letter-spacing", "0.08em")
        .attr("fill", "#6b7480")
        .text(`MATCHING INCIDENTS (${matches.length})`);
    drawConnector(edgeLayer, prevBottom.x, prevBottom.y, centerX, y - 10, null);
    const fanOriginY = y;
    y += 30;

    const totalRowWidth = matches.length * (cardWidth + 18);
    const rowStartX = centerX - totalRowWidth / 2 + cardWidth / 2;

    const matchBoxes = matches.map((m, i) => {
        const info = evidenceCardLines(m, cardWidth, null);
        const box = renderBox(nodeLayer, {
            x: rowStartX + i * (cardWidth + 18), y: y + 60, width: cardWidth,
            lines: info.lines, borderColor: info.color,
            onClick: evidenceClickHandler(info.edgeId),
        });
        return { ...box, color: info.color };
    });

    matchBoxes.forEach((b) => {
        edgeLayer.append("path")
            .attr("d", bezierPath(centerX, fanOriginY, b.midX, b.topY))
            .attr("stroke", b.color).attr("stroke-width", 1.6).attr("fill", "none").attr("stroke-opacity", 0.7);
    });

    const maxMatchBottom = Math.max(...matchBoxes.map((b) => b.bottomY));
    const strong = matchBoxes.filter((b) => b.color === COLOR_STRONG).length;
    const weak = matchBoxes.length - strong;

    const ansBox = renderBox(nodeLayer, {
        x: centerX, y: maxMatchBottom + 44, width: 180,
        lines: answerLines(`${matches.length} matching incident${matches.length !== 1 ? "s" : ""}`, [`${strong} confirmed/claimed`, `${weak} suspected/unconfirmed`]),
        borderColor: COLOR_STRONG, fill: "#1a2620",
    });

    matchBoxes.forEach((b) => {
        edgeLayer.append("path")
            .attr("d", bezierPath(b.midX, b.bottomY, ansBox.midX, ansBox.topY))
            .attr("stroke", b.color).attr("stroke-width", 1.6).attr("fill", "none").attr("stroke-opacity", 0.7);
    });

    finalizeSvgSize(svg, zoomLayer);
}

// ---------------------------------------------------------------------------
// GROUPED layout — evidence grouped into boxes by exact attribution
// category, ordered strongest to weakest. Used for larger evidence sets
// where a fan-out chain would be too tall to read.
// ---------------------------------------------------------------------------
function renderGroupedTrail(items, question) {
    const width = graphViz.clientWidth || 700;
    const centerX = width / 2;
    const boxWidth = 240;

    const { svg, zoomLayer } = setupSvg(width, 3000, 500);
    const edgeLayer = zoomLayer.append("g");
    const nodeLayer = zoomLayer.append("g");

    let y = 26;

    const qBox = renderBox(nodeLayer, { x: centerX, y, width: 200, lines: questionLines(question, 200), borderColor: "#8b93a0" });
    y = qBox.bottomY + 22;

    nodeLayer
        .append("text")
        .attr("x", centerX).attr("y", y).attr("text-anchor", "middle")
        .attr("font-size", 8.5).attr("font-family", "IBM Plex Mono, monospace").attr("letter-spacing", "0.08em")
        .attr("fill", "#6b7480")
        .text("EVIDENCE — GROUPED BY ATTRIBUTION");
    drawConnector(edgeLayer, centerX, qBox.bottomY, centerX, y - 10, null);
    y += 24;

    const groups = {};
    items.forEach((it) => {
        const key = it.facts.attribution || "recorded_as_actor";
        (groups[key] = groups[key] || []).push(it);
    });
    const sortedKeys = Object.keys(groups).sort(
        (a, b) => attributionTier(a) - attributionTier(b) || a.localeCompare(b)
    );

    const groupResults = [];

    sortedKeys.forEach((key) => {
        const tier = attributionTier(key);
        const color = tierColor(tier);
        const groupItems = groups[key];

        const headerLine = textLine(`${attributionLabel(key)}  (${groupItems.length})`, { size: 9, font: "IBM Plex Mono, monospace", color, weight: "600" });
        const rowLines = groupItems.map((it) => textLine(`${it.date}   →   ${it.facts.edgeId || "—"}`, { size: 8, font: "IBM Plex Mono, monospace", color: "#c7cdd6" }));

        const box = renderBox(nodeLayer, { x: centerX, y: y + 40, width: boxWidth, lines: [headerLine, ...rowLines], borderColor: color, fill: "#1c2430" });

        // Per-row invisible click targets so each incident is individually inspectable.
        groupItems.forEach((it, idx) => {
            const rowTop = box.topY + 9 + (1 + idx) * 12 - 9;
            nodeLayer
                .append("rect")
                .attr("x", box.leftX + 4).attr("y", rowTop).attr("width", boxWidth - 8).attr("height", 12)
                .attr("fill", "transparent").style("cursor", "pointer")
                .on("click", () => {
                    highlightRect(box.rectSel);
                    evidenceClickHandler(it.facts.edgeId)();
                });
        });

        drawConnector(edgeLayer, centerX, y, centerX, box.topY, null);
        y = box.bottomY + 20;
        groupResults.push({ color, count: groupItems.length });
    });

    y += 8;
    const strongTotal = groupResults.filter((g) => g.color === COLOR_STRONG).reduce((s, g) => s + g.count, 0);
    const weakTotal = groupResults.filter((g) => g.color === COLOR_WEAK).reduce((s, g) => s + g.count, 0);
    const neutralTotal = groupResults.filter((g) => g.color === COLOR_NEUTRAL).reduce((s, g) => s + g.count, 0);

    const subLines = [`${strongTotal} confirmed/claimed`, `${weakTotal} circumstantial`];
    if (neutralTotal > 0) subLines.push(`${neutralTotal} recorded only`);

    const ansBox = renderBox(nodeLayer, {
        x: centerX, y: y + 32, width: 200,
        lines: answerLines(`${items.length} incidents examined`, subLines),
        borderColor: COLOR_STRONG, fill: "#1a2620",
    });
    drawConnector(edgeLayer, centerX, y, centerX, ansBox.topY, null);

    finalizeSvgSize(svg, zoomLayer);
}

// ---------------------------------------------------------------------------
// FLAT layout — fallback for a single incident lookup, or when cited
// incidents share no common attribute (no meaningful traversal to show).
// ---------------------------------------------------------------------------
function renderFlatTrail(items, question) {
    const width = graphViz.clientWidth || 700;
    const centerX = width / 2;
    const cardWidth = 180;

    const { svg, zoomLayer } = setupSvg(width, 1600, 440);
    const edgeLayer = zoomLayer.append("g");
    const nodeLayer = zoomLayer.append("g");

    let y = 26;

    const qBox = renderBox(nodeLayer, { x: centerX, y, width: 170, lines: questionLines(question, 170), borderColor: "#8b93a0" });
    y = qBox.bottomY + 22;

    nodeLayer
        .append("text")
        .attr("x", centerX).attr("y", y).attr("text-anchor", "middle")
        .attr("font-size", 8.5).attr("font-family", "IBM Plex Mono, monospace").attr("letter-spacing", "0.08em")
        .attr("fill", "#6b7480")
        .text(`EVIDENCE (${items.length})`);
    drawConnector(edgeLayer, centerX, qBox.bottomY, centerX, y - 10, null);
    const fanOriginY = y;
    y += 30;

    const totalRowWidth = items.length * (cardWidth + 18);
    const rowStartX = centerX - totalRowWidth / 2 + cardWidth / 2;

    const cardBoxes = items.map((it, i) => {
        const info = evidenceCardLines(it, cardWidth, null);
        const box = renderBox(nodeLayer, {
            x: rowStartX + i * (cardWidth + 18), y: y + 60, width: cardWidth,
            lines: info.lines, borderColor: info.color,
            onClick: evidenceClickHandler(info.edgeId),
        });
        return { ...box, color: info.color, facts: it.facts, date: it.date };
    });

    cardBoxes.forEach((b) => {
        edgeLayer.append("path")
            .attr("d", bezierPath(centerX, fanOriginY, b.midX, b.topY))
            .attr("stroke", b.color).attr("stroke-width", 1.6).attr("fill", "none").attr("stroke-opacity", 0.7);
    });

    const maxBottom = Math.max(...cardBoxes.map((b) => b.bottomY));
    const single = items.length === 1;
    const strong = cardBoxes.filter((b) => b.color === COLOR_STRONG).length;
    const weak = cardBoxes.length - strong;

    const ansLines = single
        ? answerLines(cardBoxes[0].date, [shortDescription(cardBoxes[0].facts) || "—", attributionLabel(cardBoxes[0].facts.attribution)])
        : answerLines(`${items.length} incidents`, [`${strong} confirmed/claimed`, `${weak} suspected/unconfirmed`]);

    const ansBox = renderBox(nodeLayer, { x: centerX, y: maxBottom + 44, width: 180, lines: ansLines, borderColor: COLOR_STRONG, fill: "#1a2620" });

    cardBoxes.forEach((b) => {
        edgeLayer.append("path")
            .attr("d", bezierPath(b.midX, b.bottomY, ansBox.midX, ansBox.topY))
            .attr("stroke", b.color).attr("stroke-width", 1.6).attr("fill", "none").attr("stroke-opacity", 0.7);
    });

    finalizeSvgSize(svg, zoomLayer);
}

// ---------------------------------------------------------------------------
// SVG download
// ---------------------------------------------------------------------------
function downloadGraphSvg() {
    if (!currentSvgNode) return;

    const clone = currentSvgNode.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);

    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#161d27");
    clone.insertBefore(bg, clone.firstChild);

    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "evidence-trail.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Detail panel (click-to-expand) — the actual source text a card points to
// ---------------------------------------------------------------------------
function showEvidenceDetail(record, id, mode) {
    if (!record) {
        evidenceDetail.hidden = false;
        evidenceDetail.innerHTML = `<p class="evidence-detail-empty">No stored detail found for ${escapeHtml(id)}.</p>`;
        return;
    }

    evidenceDetail.hidden = false;

    if (mode === "graph") {
        const prov = record.provenance || {};
        const attribution = prov.attribution ? prov.attribution.replace(/_/g, " ") : "unspecified";
        evidenceDetail.innerHTML = `
      <div class="evidence-detail-header">
        <span class="evidence-detail-id">${escapeHtml(relationLabel(record.relation))} · ${escapeHtml(record.id)}</span>
        <span class="evidence-detail-attr">${escapeHtml(attribution)}</span>
      </div>
      <p class="evidence-detail-text">${escapeHtml(prov.text || "No source text recorded for this edge.")}</p>
      <p class="evidence-detail-meta">${escapeHtml(prov.dataset || "")} ${prov.event_id ? "· event " + escapeHtml(prov.event_id) : ""}</p>
    `;
    } else {
        evidenceDetail.innerHTML = `
      <div class="evidence-detail-header">
        <span class="evidence-detail-id">${escapeHtml(record.date || "")}</span>
      </div>
      <p class="evidence-detail-text">${escapeHtml(record.text)}</p>
    `;
    }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

init();