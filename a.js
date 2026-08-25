const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, ShadingType, BorderStyle, AlignmentType, PageBreak, LevelFormat,
    Header, Footer, PageNumber, TabStopType, convertInchesToTwip,
} = require("docx");

const FONT = "Calibri";
const MONO = "Consolas";
const BLACK = "000000";
const GREY_TEXT = "666666";
const GREY_LINE = "999999";
const HEADER_TITLE = "CTD Sindh \u2014 System Architecture & Technical Specification";

// ---------- style helpers, mirrored from reference doc XML ----------

function h1(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: BLACK })],
        spacing: { before: 320, after: 140 },
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, space: 4, color: BLACK },
        },
    });
}

function h2(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 23, bold: true, color: BLACK })],
        spacing: { before: 200, after: 90 },
    });
}

function h3(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 21, bold: true, color: BLACK })],
        spacing: { before: 150, after: 50 },
    });
}

function body(text, opts = {}) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 22, color: BLACK, ...opts })],
        spacing: { after: 160, line: 264, lineRule: "auto" },
        alignment: AlignmentType.JUSTIFIED,
    });
}

function bullet(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 22, color: BLACK })],
        numbering: { reference: "bullet-list", level: 0 },
        spacing: { after: 80 },
    });
}

function numbered(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 22, color: BLACK })],
        numbering: { reference: "numbered-list", level: 0 },
        spacing: { after: 80 },
    });
}

function quote(text) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 22, italics: true, color: BLACK })],
        indent: { left: convertInchesToTwip(0.4), right: convertInchesToTwip(0.4) },
        spacing: { before: 120, after: 200 },
        border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: "AAAAAA", space: 8 },
        },
    });
}

function codeBlock(text) {
    const lines = text.replace(/^\n+|\n+$/g, "").split("\n");
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
                        margins: { top: 160, bottom: 160, left: 200, right: 200 },
                        children: lines.map(
                            (line) =>
                                new Paragraph({
                                    children: [new TextRun({ text: line.length ? line : " ", font: MONO, size: 18, color: BLACK })],
                                    spacing: { after: 0 },
                                })
                        ),
                    }),
                ],
            }),
        ],
    });
}

function spacer(after = 120) {
    return new Paragraph({ text: "", spacing: { after } });
}

function labelTag(text, color) {
    return new Paragraph({
        children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: color || "444444" })],
        spacing: { before: 60, after: 160 },
    });
}

function dataTable(headerRow, rows, colWidths) {
    const totalWidth = 9360;
    const widths = colWidths || headerRow.map(() => Math.floor(totalWidth / headerRow.length));

    const headerCells = headerRow.map(
        (text, i) =>
            new TableCell({
                width: { size: widths[i], type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: "D9D9D9" },
                margins: { top: 90, bottom: 90, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: BLACK })] })],
            })
    );

    const bodyRows = rows.map(
        (row) =>
            new TableRow({
                children: row.map(
                    (cellText, i) =>
                        new TableCell({
                            width: { size: widths[i], type: WidthType.DXA },
                            margins: { top: 90, bottom: 90, left: 120, right: 120 },
                            children: [new Paragraph({ children: [new TextRun({ text: cellText, font: FONT, size: 20, color: BLACK })] })],
                        })
                ),
            })
    );

    return new Table({
        width: { size: totalWidth, type: WidthType.DXA },
        columnWidths: widths,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
        },
        rows: [new TableRow({ children: headerCells, tableHeader: true }), ...bodyRows],
    });
}

// ---------- title-page metadata table (matches reference doc's first-page table) ----------

function metaTable(rows) {
    const col1 = 2400;
    const col2 = 4800;
    const emptyHeaderRow = new TableRow({
        children: [
            new TableCell({
                width: { size: col1, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: "D9D9D9" },
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: "", font: FONT, size: 22, color: BLACK })] })],
            }),
            new TableCell({
                width: { size: col2, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: "D9D9D9" },
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: "", font: FONT, size: 22, color: BLACK })] })],
            }),
        ],
    });

    const dataRows = rows.map(
        ([label, value]) =>
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: col1, type: WidthType.DXA },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: 22, color: BLACK })] })],
                    }),
                    new TableCell({
                        width: { size: col2, type: WidthType.DXA },
                        margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        children: [new Paragraph({ children: [new TextRun({ text: value, font: FONT, size: 22, color: BLACK })] })],
                    }),
                ],
            })
    );

    return new Table({
        width: { size: col1 + col2, type: WidthType.DXA },
        columnWidths: [col1, col2],
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "auto" },
        },
        rows: [emptyHeaderRow, ...dataRows],
    });
}

// ---------- header / footer ----------

const pageHeader = new Header({
    children: [
        new Paragraph({
            children: [new TextRun({ text: HEADER_TITLE, font: FONT, size: 16, color: GREY_TEXT })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 4, color: GREY_LINE } },
        }),
    ],
});

const pageFooter = new Footer({
    children: [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Page ", font: FONT, size: 16, color: GREY_TEXT }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY_TEXT }),
                new TextRun({ text: " of ", font: FONT, size: 16, color: GREY_TEXT }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: GREY_TEXT }),
            ],
        }),
    ],
});

// ---------- document ----------

const doc = new Document({
    numbering: {
        config: [
            {
                reference: "bullet-list",
                levels: [
                    {
                        level: 0,
                        format: LevelFormat.BULLET,
                        text: "\u2022",
                        alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 480, hanging: 260 } } },
                    },
                ],
            },
            {
                reference: "numbered-list",
                levels: [
                    {
                        level: 0,
                        format: LevelFormat.DECIMAL,
                        text: "%1.",
                        alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 480, hanging: 260 } } },
                    },
                ],
            },
        ],
    },
    sections: [
        {
            properties: {
                page: {
                    size: { width: 11906, height: 16838 }, // A4, matches reference doc
                    margin: { top: 1400, bottom: 1400, left: 1200, right: 1200, header: 708, footer: 708 },
                },
            },
            headers: { default: pageHeader },
            footers: { default: pageFooter },
            children: [
                // ---------------- Title Page ----------------
                new Paragraph({ text: "", spacing: { before: 800 } }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                    children: [
                        new TextRun({
                            text: "SYSTEM ARCHITECTURE & TECHNICAL SPECIFICATION",
                            bold: true,
                            size: 32,
                            font: FONT,
                            color: BLACK,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 260 },
                    children: [
                        new TextRun({
                            text: "Provenance-Aware Knowledge Graph Approach to Evidence-Grounded Historical Security Event Analysis",
                            italics: true,
                            size: 24,
                            font: FONT,
                            color: BLACK,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 900 },
                    children: [
                        new TextRun({
                            text:
                                "Companion document to: A Provenance-Aware Knowledge Graph Approach to Evidence-Grounded Historical Security Event Analysis",
                            italics: true,
                            size: 22,
                            font: FONT,
                            color: BLACK,
                        }),
                    ],
                }),
                metaTable([
                    ["Prepared for", "Counter Terrorism Department (CTD), Sindh"],
                    ["Document type", "System Architecture & Technical Specification (accompanies the Research Project Proposal, Prototype Technical Report, and Demo & Evaluation Protocol)"],
                    ["Prepared by", "Group 2"],
                ]),
                new Paragraph({ children: [new PageBreak()] }),

                // ---------------- 1. System Overview ----------------
                h1("1. System Overview"),
                body(
                    "The system is designed to support evidence-grounded analysis of historical security events by transforming fragmented historical information into structured, provenance-aware knowledge and allowing analysts to query that information through natural language."
                ),
                body(
                    "The core research idea is to compare conventional flat-text retrieval / retrieval-augmented generation (RAG) against provenance-aware knowledge-graph-enhanced retrieval (GraphRAG), using the same underlying historical information as the basis for both approaches."
                ),
                body("The system is intended to answer questions ranging from simple incident lookups to more complex analytical tasks, including:"),
                bullet("Cross-incident comparisons"),
                bullet("Multi-hop relational questions"),
                bullet("Temporal analysis"),
                bullet("Actor / weapon / target comparisons"),
                bullet("Attribution analysis"),
                bullet("Provenance-aware questions"),
                bullet("Evidence-tracing questions"),
                spacer(),
                quote(
                    "A generated analytical conclusion should remain connected to the evidence and relationships from which it was derived."
                ),
                body("This principle is the central architectural commitment underlying every design decision described in this document."),

                // ---------------- 2. Architectural Design Principles ----------------
                h1("2. Architectural Design Principles"),
                h2("2.1 Evidence First"),
                body("Historical information is treated as evidence requiring verification, rather than as unquestioned ground truth."),
                h2("2.2 Provenance Preservation"),
                body("Structured relationships retain information about the source and evidence that support them."),
                h2("2.3 Representation-Level Comparison"),
                body("The baseline and graph approaches operate on the same underlying historical incidents while differing primarily in representation, isolating representation as the experimental variable."),
                h2("2.4 Separation of Evidence and Generation"),
                body("The language model generates answers from supplied or retrieved evidence rather than independently inventing historical facts."),
                h2("2.5 Attribution Uncertainty"),
                body("Attribution is not represented as a simple binary of responsible / not responsible. Instead, the system preserves finer-grained distinctions, such as:"),
                bullet("Claimed responsibility"),
                bullet("Attributed"),
                bullet("Blamed"),
                bullet("Suspected"),
                bullet("Believed"),
                bullet("Linked through arrest"),
                bullet("Recorded as actor"),
                bullet("Denied / condemned"),
                h2("2.6 Human-Inspectable Evidence"),
                body("The system allows an analyst to inspect the evidence underlying a generated answer."),
                h2("2.7 Non-Operational Design"),
                body("The system is intended for historical analytical research. It is not a real-time surveillance, predictive policing, or autonomous decision-making system."),

                // ---------------- 3. High-Level Architecture ----------------
                h1("3. High-Level Architecture"),
                body("At the highest level, the intended architecture is a layered pipeline connecting historical sources to an analyst-facing, evidence-grounded answer:"),
                codeBlock(`Historical Sources
       |
       v
Evidence Collection
       |
       v
Document / Evidence Corpus
       |
       v
Entity & Relationship Extraction
       |
       v
Verification & Normalization
       |
       v
Provenance-Aware Knowledge Graph
       |
       +------------------------+
       |                        |
       v                        v
  Baseline RAG            Graph Retrieval
       |                        |
       +-----------+------------+
                   |
                   v
             LLM Reasoning
                   |
                   v
        Evidence-Grounded Answer
                   |
                   v
        Evidence / Provenance Trail
                   |
                   v
        Analyst-Facing Interface`),
                spacer(),
                body("Each layer is described in technical terms in the sections that follow, beginning with the evidence layer and proceeding through extraction, graph construction, retrieval, reasoning, and presentation."),

                // ---------------- 4. Historical Evidence Layer ----------------
                h1("4. Historical Evidence Layer"),
                body("The eventual evidence layer is the foundation of the full research system. Potential sources include:"),
                bullet("Publicly available news archives"),
                bullet("Official public reports"),
                bullet("Academic publications"),
                bullet("Research publications"),
                bullet("Structured historical datasets, where legally and contractually permissible"),
                body(
                    "Structured datasets may be used for candidate incident discovery, metadata assistance, and initial identification of events, but are not automatically treated as ground truth. Important facts are independently verified against available source evidence where the research methodology requires it."
                ),

                // ---------------- 5. Evidence and Document Representation ----------------
                h1("5. Evidence and Document Representation"),
                body("The full system maintains an evidence corpus containing source documents and relevant passages. Conceptually, a document record is structured as follows:"),
                codeBlock(`Document
 |-- document_id
 |-- title
 |-- source/provider
 |-- publication date
 |-- source URL/reference
 \`-- text/passages`),
                spacer(),
                body("Evidence passages are addressable so that relationships and generated claims can ultimately be traced back to their supporting material."),

                // ---------------- 6. Entity and Relationship Extraction Layer ----------------
                h1("6. Entity and Relationship Extraction Layer"),
                body("The planned extraction process identifies entities including:"),
                bullet("Incidents"),
                bullet("Organizations / actors"),
                bullet("Locations"),
                bullet("Attack types"),
                bullet("Weapons"),
                bullet("Target types"),
                bullet("Casualties / outcomes"),
                bullet("Evidence records"),
                body("Relationships may include concepts such as:"),
                codeBlock(`Actor    -> ASSOCIATED_WITH -> Incident
Incident -> HAS_ATTACK_TYPE  -> Attack Type
Incident -> USED_WEAPON      -> Weapon
Incident -> TARGETED         -> Target
Incident -> OCCURRED_AT      -> Location
Incident -> SUPPORTED_BY     -> Evidence`),
                spacer(),
                body("Attribution relationships preserve the nature of the attribution rather than reducing it to a simple actor label. For example:"),
                codeBlock(`Actor -> ASSOCIATED_WITH -> Incident
             |
             \`-- attribution = suspected`),
                spacer(),
                body("or:"),
                codeBlock(`Actor -> ASSOCIATED_WITH -> Incident
             |
             \`-- attribution = claimed_responsibility`),

                // ---------------- 7. Provenance-Aware Knowledge Graph ----------------
                h1("7. Provenance-Aware Knowledge Graph"),
                body("The provenance-aware knowledge graph is the central structural component of the proposed system."),
                h3("Nodes"),
                bullet("Incident"),
                bullet("Actor"),
                bullet("Location"),
                bullet("Weapon"),
                bullet("Attack Type"),
                bullet("Target Type"),
                bullet("Evidence"),
                h3("Edges"),
                bullet("ASSOCIATED_WITH"),
                bullet("HAS_ATTACK_TYPE"),
                bullet("USED_WEAPON"),
                bullet("TARGETED"),
                bullet("OCCURRED_AT"),
                bullet("SUPPORTED_BY"),
                body("Relationships may carry provenance metadata. A conceptual edge can be represented as:"),
                codeBlock(`{
  "source": "incident",
  "relation": "ASSOCIATED_WITH",
  "target": "actor",
  "provenance": {
    "dataset": "...",
    "provider": "...",
    "event_id": "...",
    "source_field": "...",
    "attribution": "...",
    "text": "..."
  }
}`),
                spacer(),
                body("Not every edge contains every field; provenance fields depend on the relationship type and the evidence available for it."),

                // ---------------- 8. Current Prototype Knowledge Graph ----------------
                h1("8. Current Prototype Knowledge Graph"),
                body("The current prototype implements a knowledge graph with the following exact characteristics:"),
                bullet("Geographic scope: Karachi, Sindh"),
                bullet("Incidents: 27"),
                bullet("Actors: MQM and TTP"),
                bullet("Nodes: 133"),
                bullet("Edges: 227"),
                bullet("Representation: JSON"),
                bullet("Graph supplied directly to the LLM as structured context"),
                bullet("No dedicated graph database currently implemented"),
                spacer(),
                body("The current graph is therefore a JSON-based experimental knowledge graph, not a production graph database."),

                // ---------------- 9. Baseline Architecture ----------------
                h1("9. Baseline Architecture"),
                body("The current baseline corpus contains exactly 27 records, each structured as:"),
                codeBlock(`{
  "id": "...",
  "date": "...",
  "text": "..."
}`),
                spacer(),
                body("The text field contains the incident summary. The baseline deliberately does not provide separate structured fields for actor, weapon, attack type, target type, attribution, or relationships — these must be inferred by the LLM from the flat incident text."),
                body("In the current prototype, the baseline flow is:"),
                codeBlock(`27 Incident Summaries
        |
        v
Baseline Prompt
        |
        v
Gemini 3.6 Flash
        |
        v
Answer`),
                spacer(),
                body("There is currently no vector database, embedding pipeline, TF-IDF retrieval, or semantic search index, because the current 27-document corpus is small enough to provide directly as context."),

                // ---------------- 10. Current Graph Architecture ----------------
                h1("10. Current Graph Architecture"),
                body("The graph mode follows:"),
                codeBlock(`133 Nodes + 227 Edges
          |
          v
      KG JSON
          |
          v
     Graph Prompt
          |
          v
   Gemini 3.6 Flash
          |
          v
     Answer + Evidence
          |
          v
 Dynamic SVG Evidence Trail`),
                spacer(),
                body("The complete graph JSON is supplied to the model. The model can therefore reason over explicit relationships instead of reconstructing every relationship from prose."),

                // ---------------- 11. LLM Layer ----------------
                h1("11. LLM Layer"),
                body("The current prototype uses Google Gemini 3.6 Flash. The same model is used for both the baseline and graph modes."),
                body(
                    "Using a single model across both conditions is important for experimental fairness, because changing the model between conditions would introduce an additional, confounding variable."
                ),
                body("The LLM is responsible for:"),
                bullet("Interpreting the natural-language question"),
                bullet("Identifying relevant information"),
                bullet("Reasoning over supplied context"),
                bullet("Generating the final response"),
                bullet("Presenting evidence-grounded conclusions"),
                body("The system prompts instruct the model to avoid unsupported claims and to distinguish explicit evidence from inference."),

                // ---------------- 12. Application Layer ----------------
                h1("12. Application Layer"),
                h3("Frontend"),
                body("Technologies: HTML, CSS, JavaScript, and D3.js."),
                body("Responsibilities:"),
                bullet("Question input"),
                bullet("Mode selection"),
                bullet("Answer presentation"),
                bullet("Evidence presentation"),
                bullet("Dynamic graph visualization"),
                bullet("SVG rendering"),
                h3("Backend"),
                body("The current API layer is api/ask.js, running as a Vercel serverless function. Its responsibilities include:"),
                bullet("Receiving the question"),
                bullet("Determining the selected mode"),
                bullet("Loading the relevant context"),
                bullet("Constructing the model request"),
                bullet("Calling Gemini"),
                bullet("Returning the generated response to the frontend"),

                // ---------------- 13. Evidence Visualization Architecture ----------------
                h1("13. Evidence Visualization Architecture"),
                body("The evidence visualization pipeline is as follows:"),
                codeBlock(`Question
   |
   v
LLM Answer
   |
   v
Relevant Evidence / Relationships
   |
   v
Frontend Visualization
   |
   v
D3.js SVG`),
                spacer(),
                body(
                    "The current prototype can dynamically display relevant nodes, relevant edges, and provenance/evidence cards. The visualization is presented as an interpretability layer rather than as the actual reasoning engine, helping the analyst trace the path from question to evidence, to relationships, to answer."
                ),

                // ---------------- 14. Current Prototype Architecture Diagram ----------------
                h1("14. Current Prototype Architecture Diagram"),
                labelTag("CURRENT EXPERIMENTAL PROTOTYPE ARCHITECTURE", "1F4D78"),
                codeBlock(`                    +---------------------+
                    |    User Question    |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    |   Web Interface     |
                    |  HTML/CSS/JS/D3     |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    |    Vercel API       |
                    |    api/ask.js       |
                    +----------+----------+
                               |
                  +------------+-------------+
                  |                          |
                  v                          v
        +-------------------+      +--------------------+
        |  Baseline Corpus  |      |  Knowledge Graph    |
        |  27 flat texts    |      |  133 nodes          |
        |  id/date/text     |      |  227 edges          |
        +---------+---------+      +----------+----------+
                  |                           |
                  +-------------+-------------+
                                |
                                v
                   +--------------------------+
                   |     Gemini 3.6 Flash      |
                   +-------------+-------------+
                                 |
                                 v
                     +----------------------+
                     |   Generated Answer   |
                     +-----------+----------+
                                 |
                                 v
                     +----------------------+
                     |   Evidence Trail     |
                     |     D3.js SVG        |
                     +----------------------+`),

                // ---------------- 15. Proposed Full-System Architecture ----------------
                h1("15. Proposed Full-System Architecture"),
                labelTag("PROPOSED FULL RESEARCH SYSTEM ARCHITECTURE \u2014 NOT CURRENTLY IMPLEMENTED", "9C4500"),
                body("The future architecture is intended to support the following expanded pipeline:"),
                codeBlock(`Multiple Historical Sources
          |
          v
Evidence Ingestion
          |
          v
Document Processing
          |
          v
Entity / Relation Extraction
          |
          v
Evidence Verification
          |
          v
Canonical Knowledge Graph
          |
          v
Provenance Store
          |
 +------------------------------+
 |                              |
 v                              v
Semantic Retrieval       Graph Retrieval
 |                              |
 +--------------+---------------+
                |
                v
        Hybrid Retrieval
                |
                v
        Evidence Assembly
                |
                v
        LLM Reasoning
                |
                v
 Evidence-Grounded Answer
                |
                v
 Provenance / Evidence Trail
                |
                v
      Analyst Interface`),

                // ---------------- 16. Future Retrieval Architecture ----------------
                h1("16. Future Retrieval Architecture"),
                body("This section describes the intended eventual difference between the two retrieval approaches. None of the components below are implemented in the current prototype unless otherwise stated in Sections 9 and 10."),
                h2("Baseline (future)"),
                codeBlock(`Question
   |
   v
Semantic Document Retrieval
   |
   v
Relevant Text Passages
   |
   v
LLM
   |
   v
Answer`),
                h2("Graph-Enhanced (future)"),
                codeBlock(`Question
   |
   v
Entity / Relationship Identification
   |
   v
Graph Traversal / Graph Retrieval
   |
   v
Relevant Incidents + Relationships
   |
   v
Supporting Evidence
   |
   v
LLM
   |
   v
Answer + Provenance`),
                h2("Hybrid Future Architecture"),
                body("The eventual system may combine semantic retrieval, graph retrieval, provenance filtering, evidence ranking, and LLM reasoning to answer complex questions more robustly. These components do not all exist in the current prototype."),

                // ---------------- 17. Data Flow ----------------
                h1("17. Data Flow"),
                h2("Future Ingestion Flow"),
                codeBlock(`Source Documents
      |
      v
Document Parsing
      |
      v
Incident Identification
      |
      v
Entity Extraction
      |
      v
Relationship Extraction
      |
      v
Source Verification
      |
      v
Normalization
      |
      v
Knowledge Graph
      |
      v
Provenance Attachment`),
                h2("Query Flow"),
                codeBlock(`Natural-Language Question
      |
      v
Question Analysis
      |
      v
Retrieval Strategy
      |
      v
Evidence Retrieval
      |
      v
Relationship Traversal
      |
      v
Evidence Assembly
      |
      v
LLM Generation
      |
      v
Answer + Supporting Evidence`),

                // ---------------- 18. Attribution Model ----------------
                h1("18. Attribution Model"),
                body("Attribution receives special architectural treatment because it is central to the research. The system preserves attribution as an evidence-qualified relationship, conceptually:"),
                codeBlock(`Actor --ASSOCIATED_WITH--> Incident
              |
              |-- attribution: claimed_responsibility
              |-- attribution: suspected
              |-- attribution: blamed
              |-- attribution: believed
              \`-- attribution: attributed`),
                spacer(),
                body("The system also preserves contradictory evidence rather than silently discarding it. For example:"),
                codeBlock(`Source A -> actor blamed
Source B -> actor denied involvement`),
                spacer(),
                body("Neither source is automatically discarded. This design allows the eventual system to answer questions such as \u201cHow confident can we be that actor X was responsible?\u201d without converting uncertainty into false certainty."),

                // ---------------- 19. Security and Responsible Architecture ----------------
                h1("19. Security and Responsible Architecture"),
                body("The system is designed around the following principles:"),
                bullet("Authorized access"),
                bullet("Evidence traceability"),
                bullet("Historical analysis"),
                bullet("Human review"),
                bullet("Non-operational use"),
                bullet("No autonomous enforcement decisions"),
                bullet("No predictive identification of individuals"),
                body("A future, domain-specific phase (e.g., involving a Counter-Terrorism Department or comparable authority) would require appropriate authorization, access controls, governance, and data handling procedures."),

                // ---------------- 20. Scalability Roadmap ----------------
                h1("20. Scalability Roadmap"),
                h2("Current"),
                bullet("27 incidents"),
                bullet("2 actors"),
                bullet("Karachi"),
                bullet("JSON-based knowledge graph"),
                bullet("Complete context supplied to the LLM"),
                bullet("Manual evaluation"),
                h2("Future"),
                bullet("Larger historical corpus"),
                bullet("Multiple geographic regions"),
                bullet("Additional organizations/entities"),
                bullet("Scalable document retrieval"),
                bullet("Vector/semantic retrieval where appropriate"),
                bullet("Graph database or scalable graph storage"),
                bullet("Automated ingestion pipelines"),
                bullet("More sophisticated provenance management"),
                bullet("Formal benchmark evaluation"),
                bullet("Quantitative metrics"),
                bullet("Controlled, authorized domain-specific validation, if approved"),

                // ---------------- 21. Technology Stack ----------------
                h1("21. Technology Stack"),
                dataTable(
                    ["Layer", "Current Prototype", "Future Research System"],
                    [
                        ["Frontend", "HTML/CSS/JS", "Web analytical interface"],
                        ["Visualization", "D3.js / SVG", "Advanced evidence visualization"],
                        ["Backend", "Vercel Serverless", "Scalable API/backend"],
                        ["LLM", "Gemini 3.6 Flash", "Model selected through evaluation"],
                        ["Baseline Corpus", "JSON", "Scalable document store"],
                        ["Knowledge Graph", "JSON", "Scalable graph storage/database"],
                        ["Retrieval", "Full-context", "Semantic + graph/hybrid retrieval"],
                        ["Embeddings", "Not used", "Potential future component"],
                        ["Vector DB", "Not used", "Potential future component"],
                        ["Evaluation", "Manual", "Formal quantitative + qualitative"],
                        ["Deployment", "Vercel prototype", "Appropriate research/production infrastructure"],
                    ],
                    [2600, 3380, 3380]
                ),
                spacer(),
                body("\u201cFuture\u201d does not imply guaranteed implementation; it represents the intended architecture for further research."),

                // ---------------- 22. Prototype vs Full System Comparison ----------------
                h1("22. Prototype vs Full System Comparison"),
                dataTable(
                    ["Capability", "Current Prototype", "Intended Full System"],
                    [
                        ["Historical corpus", "27 incidents", "Large-scale corpus"],
                        ["Geography", "Karachi", "Expandable"],
                        ["Actors", "MQM + TTP", "Expandable"],
                        ["Baseline", "27 flat summaries", "Semantic retrieval"],
                        ["Graph", "133 nodes / 227 edges", "Larger scalable KG"],
                        ["Graph storage", "JSON", "Dedicated scalable storage"],
                        ["Retrieval", "Full-context", "Retrieval pipeline"],
                        ["LLM", "Gemini 3.6 Flash", "To be evaluated"],
                        ["Provenance", "Embedded in KG", "Dedicated provenance architecture"],
                        ["Visualization", "D3 SVG", "Advanced analytical interface"],
                        ["Evaluation", "Manual", "Formal benchmark"],
                        ["Deployment", "Experimental Vercel deployment", "Future authorized infrastructure"],
                    ],
                    [2600, 3380, 3380]
                ),

                // ---------------- 23. Architectural Limitations ----------------
                h1("23. Architectural Limitations"),
                body("The current prototype has the following known limitations, presented explicitly rather than hidden:"),
                bullet("Small corpus"),
                bullet("Limited actors and geography"),
                bullet("No dedicated graph database"),
                bullet("No vector retrieval"),
                bullet("Full-context prompting rather than scalable retrieval"),
                bullet("Manual evaluation"),
                bullet("Limited provenance normalization"),
                bullet("LLM-dependent reasoning"),
                bullet("Prototype-level security and deployment"),
                bullet("No CTD operational data"),

                // ---------------- 24. Architectural Research Significance ----------------
                h1("24. Architectural Research Significance"),
                body(
                    "The research contribution is not simply the use of a large language model together with a knowledge graph. Instead, the work investigates whether combining structured relationships, provenance, and evidence-grounded generation can improve answers to complex historical security-event questions compared with flat-text retrieval."
                ),
                body("The architecture described in this document is therefore designed specifically to enable the experimental comparison required by the research question."),

                // ---------------- 25. Final Architecture Principle ----------------
                h1("25. Final Architecture Principle"),
                quote(
                    "The proposed architecture treats the knowledge graph not merely as a storage mechanism, but as an explicit representation of relationships between historical events, entities, and evidence. Provenance connects those relationships back to their supporting sources, while the analytical interface allows users to interrogate the resulting structure through natural language. The current prototype demonstrates this architecture at small scale; the proposed full system provides the pathway for scalable research evaluation and, subject to authorization, future domain-specific validation."
                ),
            ],
        },
    ],
});

Packer.toBuffer(doc).then((buffer) => {
    require("fs").writeFileSync("C:/Users/PMLS/Desktop/PAKGSEA_DEMO/System_Architecture_Technical_Specification.docx", buffer);
    console.log("done");
});