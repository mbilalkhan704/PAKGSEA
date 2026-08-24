// public/app.js

// ---------------------------------------------------------------------------
// Demo question tiers
// ---------------------------------------------------------------------------
const TIERS = [
    {
        tier: "Tier 1",
        questions: [
            "How many people were killed in the Abbas Town mosque bombing?",
            "What weapon was used in the attack on Justice Maqbool Baqir's convoy?",
        ],
    },
    {
        tier: "Tier 2",
        questions: [
            "Which incidents involved TTP using explosives against government or political targets?",
            "Compare MQM's and TTP's attack patterns in Karachi. What is different about their preferred weapons and targets?",
        ],
    },
    {
        tier: "Tier 3",
        questions: [
            "Which attacks share both the same actor and the same weapon type as the Manzar Imam assassination?",
            "Which other TTP incidents in Karachi targeted political organizations or government officials using the same weapon type as the Manzar Imam assassination?",
        ],
    },
    {
        tier: "Tier 4",
        questions: [
            "How confident can we be that MQM was responsible for the 1998 market bombing?",
            "Among the incidents attributed to MQM, how does the strength of attribution vary — which are based on a formal claim of responsibility versus suspicion or blame?",
        ],
    },
];

const UNSUPPORTED_PATTERNS = [
    /not supported by the graph/i,
    /not addressed in the provided documents/i,
    /not found in the provided documents/i,
];

// Relation types shown in the visualization. If your demo_kg.json uses
// different relation strings, update this set.
const VISUAL_RELATIONS = new Set([
    "ASSOCIATED_WITH",
    "HAS_ATTACK_TYPE",
    "USED_WEAPON",
    "HAS_TARGET_TYPE",
]);

const NODE_TYPE_COLOR = {
    Incident: "#c98a4b",
    Actor: "#4fbf9f",
    Weapon: "#7a8dd6",
    AttackType: "#d97ba0",
    TargetType: "#8b93a0",
};

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentMode = "graph";
let graphMeta = null;
let baselineMeta = null;
let simulation = null; // active d3 force simulation, stopped/replaced per query
let currentSvgNode = null; // reference to the live <svg> element, for download

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

        renderAnswer(data.answer, data.mode, data.provider);
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
    if (simulation) {
        simulation.stop();
        simulation = null;
    }
    currentSvgNode = null;
}

function renderError(message) {
    askBtn.disabled = false;
    answerBody.innerHTML = `<p class="answer-error">${escapeHtml(message)}</p>`;
}

function renderAnswer(answerText, mode, provider) {
    askBtn.disabled = false;

    answerModeTag.textContent = mode.toUpperCase();
    answerModeTag.className = `answer-mode-tag ${mode}`;
    answerProviderTag.textContent = provider;

    const citations = extractCitations(answerText, mode);
    const isUnsupported = UNSUPPORTED_PATTERNS.some((p) => p.test(answerText));

    // Citations are extracted from the raw text above (for the diagram / chips),
    // then stripped from what's actually displayed — a layman reader has no use
    // for a bare edge_id/doc_id token inline in a sentence.
    const displayText = mode === "graph" ? stripCitationTags(answerText, "edge_id") : answerText;

    const formatted = formatAnswerText(displayText);
    answerBody.innerHTML = `<div class="${isUnsupported ? "answer-unsupported" : ""}">${formatted}</div>`;

    renderEvidence(citations, mode);
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
// Evidence rendering
// ---------------------------------------------------------------------------
function renderEvidence(ids, mode) {
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
        renderGraphViz(ids);
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

// ---------------------------------------------------------------------------
// Graph visualization (D3 — native SVG, zoomable, draggable, downloadable)
// ---------------------------------------------------------------------------
function buildDisplayGraph(citedIds) {
    const citedEdges = graphMeta.edges.filter((e) => citedIds.includes(e.id));
    const incidentIds = new Set();
    citedEdges.forEach((e) => {
        [e.source, e.target].forEach((id) => {
            if (typeof id === "string" && id.startsWith("incident:")) incidentIds.add(id);
        });
    });

    const allEdges = graphMeta.edges.filter(
        (e) =>
            VISUAL_RELATIONS.has(e.relation) &&
            (incidentIds.has(e.source) || incidentIds.has(e.target))
    );

    const nodeIdSet = new Set();
    allEdges.forEach((e) => {
        nodeIdSet.add(e.source);
        nodeIdSet.add(e.target);
    });

    const nodes = graphMeta.nodes.filter((n) => nodeIdSet.has(n.id));
    return { nodes, edges: allEdges };
}

function labelForNode(node) {
    if (node.type === "Incident") {
        return node.properties?.date || shortId(node.id);
    }
    return node.name || shortId(node.id);
}

function relationLabel(relation) {
    return relation.toLowerCase().replace(/_/g, " ");
}

function shortId(id) {
    const parts = String(id).split(":");
    return parts[parts.length - 1];
}

function edgeColor(e) {
    if (e.relation === "ASSOCIATED_WITH") {
        const attr = e.provenance?.attribution;
        if (attr === "confirmed" || attr === "claimed_responsibility") return "#4fbf9f";
        if (attr === "suspected" || attr === "believed" || attr === "blamed") return "#d9a441";
    }
    return "#3a4552";
}

function truncateLabel(str, n) {
    return str.length > n ? str.slice(0, n) + "…" : str;
}

function renderGraphViz(citedIds) {
    if (!graphMeta) {
        graphViz.hidden = true;
        graphToolbar.hidden = true;
        return;
    }

    const display = buildDisplayGraph(citedIds);

    if (display.nodes.length === 0) {
        graphViz.hidden = true;
        graphToolbar.hidden = true;
        return;
    }

    graphViz.hidden = false;
    graphToolbar.hidden = false;
    graphViz.innerHTML = "";

    const width = graphViz.clientWidth || 600;
    const height = 340;

    const nodesData = display.nodes.map((n) => ({ ...n, displayLabel: labelForNode(n) }));
    const edgesData = display.edges.map((e) => ({ ...e }));
    const citedSet = new Set(citedIds);

    const svg = d3
        .select(graphViz)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", height);

    currentSvgNode = svg.node();

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");

    svg.call(
        d3.zoom()
            .scaleExtent([0.3, 4])
            .on("zoom", (event) => zoomLayer.attr("transform", event.transform))
    );

    if (simulation) simulation.stop();

    simulation = d3
        .forceSimulation(nodesData)
        .force("link", d3.forceLink(edgesData).id((d) => d.id).distance(95).strength(0.55))
        .force("charge", d3.forceManyBody().strength(-230))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(40));

    const link = zoomLayer
        .append("g")
        .selectAll("line")
        .data(edgesData)
        .join("line")
        .attr("stroke", (d) => edgeColor(d))
        .attr("stroke-width", (d) => (citedSet.has(d.id) ? 2.5 : 1.2))
        .attr("stroke-opacity", 0.85)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            const edge = graphMeta.edges.find((e) => e.id === d.id);
            showEvidenceDetail(edge, edge.id, "graph");
        });

    const node = zoomLayer
        .append("g")
        .selectAll("g")
        .data(nodesData)
        .join("g")
        .style("cursor", "pointer")
        .call(dragBehavior(simulation))
        .on("click", (event, d) => {
            const fullNode = graphMeta.nodes.find((n) => n.id === d.id);
            showNodeDetail(fullNode);
        });

    node.each(function (d) {
        const g = d3.select(this);
        if (d.type === "Incident") {
            g.append("rect")
                .attr("width", 78)
                .attr("height", 32)
                .attr("x", -39)
                .attr("y", -16)
                .attr("rx", 5)
                .attr("fill", "#1c2430")
                .attr("stroke", NODE_TYPE_COLOR[d.type] || "#2a323d")
                .attr("stroke-width", 2);
        } else {
            g.append("circle")
                .attr("r", 24)
                .attr("fill", "#1c2430")
                .attr("stroke", NODE_TYPE_COLOR[d.type] || "#2a323d")
                .attr("stroke-width", 2);
        }
    });

    node
        .append("text")
        .text((d) => truncateLabel(d.displayLabel, 14))
        .attr("text-anchor", "middle")
        .attr("dy", 4)
        .attr("font-size", 10)
        .attr("font-family", "IBM Plex Sans, sans-serif")
        .attr("fill", "#e7e4dc")
        .style("pointer-events", "none");

    node.append("title").text((d) => d.displayLabel);

    simulation.on("tick", () => {
        link
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);

        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
}

function dragBehavior(sim) {
    function started(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    function ended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
}

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
    a.download = "provenance-graph.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showNodeDetail(node) {
    if (!node) return;
    evidenceDetail.hidden = false;
    evidenceDetail.innerHTML = `
    <div class="evidence-detail-header">
      <span class="evidence-detail-id">${escapeHtml(node.name || labelForNode(node))}</span>
      <span class="evidence-detail-attr">${escapeHtml(node.type)}</span>
    </div>
    <p class="evidence-detail-text">${escapeHtml(nodeSummary(node))}</p>
  `;
}

function nodeSummary(node) {
    if (node.type === "Incident") {
        const p = node.properties || {};
        return `Date: ${p.date || "unknown"} · Killed: ${p.nkill ?? "unknown"} · Wounded: ${p.nwound ?? "unknown"}`;
    }
    return `Category: ${node.type}`;
}

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
        <span class="evidence-detail-id">${escapeHtml(relationLabel(record.relation))}</span>
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