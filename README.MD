# Provenance-Aware Knowledge Graph for Security Event Analysis

## Evidence-Grounded Historical Security Event Analysis

A research prototype investigating whether a **provenance-aware knowledge graph** can improve the analysis of historical security events compared with a conventional flat-text retrieval baseline.

The prototype uses a controlled corpus of **27 historical security incidents from Karachi, Sindh**, involving **Muttahida Qaumi Movement (MQM)** and **Tehrik-i-Taliban Pakistan (TTP)**.

The system allows the same analytical questions to be submitted to two different representations of the same underlying incidents:

- **Baseline Mode** — flat-text incident summaries
- **Graph Mode** — structured knowledge graph with explicit entities, relationships, attribution, and provenance

The purpose is to compare how the two representations perform as questions progress from simple factual lookup to multi-hop relational, temporal, comparative, and provenance-aware reasoning.

---

## Research Question

> **Does provenance-aware, knowledge-graph-enhanced retrieval improve the accuracy and evidence-groundedness of answers to complex historical security-event questions, compared with conventional semantic document retrieval?**

The prototype is designed as an experimental research instrument for investigating this question.

It is **not a production CTD system**, surveillance platform, predictive system, or operational decision-making tool.

---

# 1. Prototype Overview

The current prototype contains:

- **27 historical security incidents**
- **Karachi, Sindh** geographic scope
- **MQM and TTP** as the primary actors
- **133 knowledge-graph nodes**
- **227 knowledge-graph edges**
- Incident-level provenance and evidence relationships
- Attribution-strength information
- Natural-language question answering
- Baseline vs Graph comparison
- Dynamic SVG evidence visualization

The same underlying incidents are represented in two different ways.

### Baseline

The baseline contains only:

```text
id
date
text
````

where `text` is the original incident summary.

The complete set of 27 summaries is supplied to the language model as flat textual context.

### Graph

Graph Mode supplies the complete knowledge graph JSON.

The graph explicitly represents relationships between entities such as:

```text
Incident
Actor
Weapon
Attack Type
Target Type
Evidence
```

along with relationships such as:

```text
ASSOCIATED_WITH
USED_WEAPON
HAS_ATTACK_TYPE
HAS_TARGET_TYPE
SUPPORTED_BY
```

and attribution/provenance information.

---

# 2. Why Compare These Two Representations?

The experiment attempts to isolate the effect of **representation**.

Both modes use the same underlying historical incidents.

The difference is how those incidents are presented to the model.

### Baseline

```text
Question
   ↓
27 flat incident summaries
   ↓
LLM reasoning
   ↓
Answer
```

### Graph

```text
Question
   ↓
Structured knowledge graph
   ↓
Explicit entities + relationships + provenance
   ↓
LLM reasoning
   ↓
Answer + evidence trail
```

This makes it possible to investigate whether explicit relational structure helps with questions that require connections across multiple incidents.

---

# 3. Research Hypothesis

The working hypothesis is:

> Explicitly representing relationships between entities and events, while preserving the evidence supporting those relationships, can improve performance on complex, multi-document historical security-event questions.

The prototype does **not** assume that the graph approach will outperform the baseline on every question.

Simple factual questions may be answered equally well by both approaches.

The expected difference becomes more relevant for questions requiring:

* cross-incident comparison;
* multi-hop relationships;
* temporal aggregation;
* attribution comparison;
* provenance analysis;
* and evidence tracing.

---

# 4. Dataset

## Geographic Scope

```text
Karachi, Sindh, Pakistan
```

## Incidents

```text
27
```

## Primary Actors

```text
Muttahida Qaumi Movement (MQM)
Tehrik-i-Taliban Pakistan (TTP)
```

## Historical Coverage

The dataset contains incidents spanning multiple years, including examples from the late 1990s through the late 2010s.

The prototype intentionally uses a small, controlled corpus so that the comparative behavior of the two representations can be inspected directly during the research demonstration.

---

# 5. Knowledge Graph

The current graph contains:

```text
133 nodes
227 edges
```

The graph represents historical security incidents as interconnected entities.

Conceptually:

```text
                 ┌──────────────┐
                 │    Actor     │
                 └──────┬───────┘
                        │
                  ASSOCIATED_WITH
                        │
                        ▼
                 ┌──────────────┐
                 │   Incident   │
                 └───┬────┬─────┘
                     │    │
          ┌──────────┘    └───────────┐
          ▼                           ▼
   ┌──────────────┐             ┌──────────────┐
   │    Weapon    │             │ Attack Type  │
   └──────────────┘             └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ Target Type  │
              └──────────────┘

                     Incident
                         │
                    SUPPORTED_BY
                         │
                         ▼
                  ┌────────────┐
                  │  Evidence  │
                  └────────────┘
```

The graph is stored as JSON rather than in a dedicated graph database.

---

# 6. Provenance

A central feature of the project is preserving information about the evidence behind relationships.

For example, an evidence relationship may contain provenance information such as:

```json
{
    "dataset": "Global Terrorism Database",
    "provider": "START",
    "event_id": "201311010044",
    "source_field": "summary"
}
```

Attribution information is also represented with distinctions such as:

```text
claimed_responsibility
suspected
believed
blamed
attributed
linked_by_arrest
recorded_as_actor
```

These distinctions are important because an actor appearing in an incident record does not necessarily mean that responsibility was definitively established.

For example:

```text
claimed responsibility
        ↓
stronger attribution evidence

suspected / believed / blamed
        ↓
weaker or uncertain attribution
```

The system is therefore designed to avoid treating every actor–incident relationship as equally certain.

---

# 7. Baseline Corpus

The baseline corpus is intentionally minimal.

Each incident contains:

```json
{
    "id": "...",
    "date": "...",
    "text": "..."
}
```

The `text` field contains the incident summary.

The baseline does **not** expose:

* graph nodes;
* graph edges;
* explicit actor relationships;
* explicit weapon relationships;
* explicit target relationships;
* explicit attribution edges;
* graph traversal;
* embeddings;
* TF-IDF;
* vector search;
* or a graph database.

All 27 summaries are supplied as flat textual context.

This creates a controlled comparison against the structured graph representation.

---

# 8. Retrieval Approach

The current prototype intentionally does **not** implement production-scale retrieval infrastructure.

It does not currently use:

* a vector database;
* embeddings;
* TF-IDF;
* a graph database;
* automated subgraph retrieval.

Instead:

### Baseline Mode

The complete:

```text
baseline_corpus.json
```

is supplied to the LLM.

### Graph Mode

The complete:

```text
demo_kg.json
```

is supplied to the LLM.

This approach is appropriate for the current 27-incident research corpus because the complete context can be supplied to the model.

Future versions can introduce scalable retrieval when the corpus grows substantially.

---

# 9. Demo Benchmark

The prototype uses a six-tier question benchmark.

The questions progressively increase in analytical complexity.

## Tier 1 — Factual Lookup

Simple factual questions used to establish basic functionality.

Examples:

```text
How many people were killed in the Abbas Town mosque bombing?

What weapon was used in the attack on Justice Maqbool Baqir's convoy?
```

---

## Tier 2 — Cross-Incident Pattern Reasoning

Questions requiring comparison across multiple incidents.

Examples:

```text
Which incidents involved TTP using explosives against government or political targets?

Compare MQM's and TTP's attack patterns in Karachi.
What is different about their preferred weapons and targets?
```

---

## Tier 3 — Multi-Hop Relational Reasoning

Questions requiring relationships to be connected across multiple entities.

Examples:

```text
Which attacks share both the same actor and the same weapon type as the Manzar Imam assassination?

Which other TTP incidents in Karachi targeted political organizations
or government officials using the same weapon type as the Manzar Imam assassination?
```

---

## Tier 4 — Provenance & Attribution Reasoning

Questions examining the strength of evidence behind attribution.

Examples:

```text
How confident can we be that MQM was responsible for the 1998 market bombing?

Among the incidents attributed to MQM, how does the strength of attribution vary —
which are based on a formal claim of responsibility versus suspicion or blame?
```

---

## Tier 5 — Temporal, Aggregative & Provenance-Aware Reasoning

Questions requiring temporal comparison, aggregation, and separation of explicit evidence from inferred patterns.

Examples:

```text
How did the relationship between weapon choice and target type differ between
MQM and TTP incidents in Karachi, and which actor showed a stronger association
between explosives and political/military targets?
```

```text
How did MQM's attack profile change between its earlier incidents (1998–2002)
and its later incidents (2013–2018), considering attack type, weapon, target type,
and attribution strength?

Which of those changes can be supported by explicit provenance,
and which are only patterns inferred from the incident data?
```

---

## Tier 6 — Composite Comparative Reasoning

The most demanding questions in the current benchmark.

Examples:

```text
Are there any TTP incidents where the attack type, weapon type, and target type
form a combination that also appears in an MQM incident?

If so, which incidents and what are the similarities and differences?
```

```text
During the period when both MQM and TTP appear in the Karachi dataset,
which actor showed greater diversity in attack types and target types,
and what evidence supports that conclusion?
```

---

# 10. Evaluation Method

The current evaluation is primarily **manual and qualitative**.

For each benchmark question:

1. The question is submitted to Baseline Mode.
2. The same question is submitted to Graph Mode.
3. The answers are compared.
4. The evidence trails are inspected.
5. The strengths and weaknesses of each answer are recorded.

The evaluation considers:

| Dimension             | What is examined                                           |
| --------------------- | ---------------------------------------------------------- |
| Factual Accuracy      | Are the stated facts correct?                              |
| Completeness          | Were relevant incidents identified?                        |
| Relational Reasoning  | Were relationships between entities correctly connected?   |
| Multi-Hop Reasoning   | Can multiple relationships be followed correctly?          |
| Attribution Accuracy  | Are attribution strengths correctly distinguished?         |
| Evidence Groundedness | Can claims be traced to supporting evidence?               |
| Provenance Awareness  | Are explicit evidence and inferred patterns distinguished? |
| Unsupported Inference | Does the answer introduce unsupported claims?              |

No automated numerical benchmark score is currently generated.

The evaluation is intentionally qualitative at this prototype stage.

---

# 11. Evidence Visualization

The frontend dynamically generates an SVG evidence trail using **D3.js**.

The visualization can show:

* relevant nodes;
* relevant edges;
* incident nodes;
* actor nodes;
* weapon nodes;
* attack-type nodes;
* target-type nodes;
* evidence nodes;
* provenance information;
* and the relationships connecting the answer to its supporting evidence.

Conceptually:

```text
Question
   │
   ▼
Relevant Evidence
   │
   ├── Incident
   ├── Actor
   ├── Weapon
   ├── Attack Type
   ├── Target Type
   └── Evidence / Provenance
   │
   ▼
Generated Answer
```

The evidence visualization is intended to make the basis of an answer more inspectable.

It should not be interpreted as a guarantee that the LLM's reasoning is deterministic or error-free.

---

# 12. Technology Stack

| Component     | Technology                 |
| ------------- | -------------------------- |
| Frontend      | HTML / CSS / JavaScript    |
| Visualization | D3.js                      |
| Backend       | Vercel Serverless Function |
| API Endpoint  | `api/ask.js`               |
| LLM           | Gemini 3.6 Flash           |
| Data Format   | JSON                       |
| Deployment    | Vercel                     |

---

# 13. Project Structure

```text
PAKGSEA_DEMO/
│
├── .vercel/
│   ├── cache/
│   ├── project.json
│   └── README.txt
│
├── api/
│   └── ask.js
│
├── data/
│   ├── baseline_corpus.json
│   └── demo_kg.json
│
├── prompts/
│   ├── baseline_prompt.txt
│   └── graph_prompt.txt
│
├── public/
│   ├── data/
│   │   ├── baseline_corpus.json
│   │   └── demo_kg.json
│   │
│   ├── app.js
│   ├── index.html
│   └── style.css
│
├── .env.local
├── .gitignore
├── h.py
├── LICENSE
├── package.json
├── README.MD
└── vercel.json
```

### Important Files

#### `api/ask.js`

Backend serverless API responsible for receiving questions and communicating with the Gemini model.

#### `data/baseline_corpus.json`

Flat-text representation of the 27 incidents.

#### `data/demo_kg.json`

Structured knowledge graph containing 133 nodes and 227 edges.

#### `prompts/baseline_prompt.txt`

System instructions for Baseline Mode.

#### `prompts/graph_prompt.txt`

System instructions for Graph Mode.

#### `public/index.html`

Main frontend interface.

#### `public/app.js`

Frontend application logic, API interaction, mode switching, and visualization handling.

#### `public/style.css`

Frontend styling.

#### `public/data/`

Browser-accessible copies of the data used by the frontend visualization.

---

# 14. Local Development

## Requirements

Install:

* Node.js
* npm
* Vercel CLI

The project requires a Gemini API key.

Set it locally in:

```text
.env.local
```

Example:

```env
GEMINI_API_KEY=your_api_key_here
```

Do not commit `.env.local` or expose the API key publicly.

---

## Install Dependencies

```bash
npm install
```

---

## Run Locally

Using Vercel:

```bash
vercel dev
```

The local development server will provide the application URL.

---

# 15. Deployment

The prototype is deployed using Vercel.

The deployment contains:

```text
Frontend
    ↓
Vercel
    ↓
/api/ask.js
    ↓
Gemini API
```

Environment variables should be configured in the Vercel project rather than committed to the repository.

---

# 16. Security and Data Handling

The current prototype uses publicly available historical information.

It does not require:

* classified information;
* operational CTD information;
* live intelligence;
* real-time surveillance data;
* or personally sensitive operational datasets.

The prototype is intended for research and demonstration purposes.

API credentials must never be committed to Git.

Use environment variables for secrets.

---

# 17. Responsible Use

This prototype:

* does not perform real-time surveillance;
* does not perform predictive identification;
* does not make autonomous law-enforcement decisions;
* does not profile individuals;
* does not claim that historical attribution is automatically factual;
* and should not be treated as an operational intelligence system.

Historical attribution may be uncertain, disputed, or based on different levels of evidence.

The system should therefore preserve and communicate uncertainty wherever possible.

---

# 18. Current Limitations

The current prototype is intentionally limited.

### Small Dataset

Only 27 incidents are represented.

### Geographic Scope

The corpus is limited to Karachi/Sindh.

### Actor Scope

The current corpus focuses on MQM and TTP.

### Full-Context Processing

Both modes receive their entire respective context rather than using scalable retrieval.

### No Vector Database

There is currently no embedding-based vector retrieval system.

### No Graph Database

The knowledge graph is currently represented as JSON.

### Manual Evaluation

The current benchmark is manually compared rather than automatically scored.

### LLM Limitations

Generated answers may still contain mistakes, omissions, or unsupported inferences.

### Dataset Limitations

The quality of conclusions depends on the completeness and reliability of the underlying historical sources.

---

# 19. Future Development

The prototype is intended to provide a foundation for a larger research system.

Future development may include:

* larger historical corpora;
* additional actors and organizations;
* broader geographic coverage;
* automated entity extraction;
* automated relationship extraction;
* source-document ingestion;
* embedding-based retrieval;
* vector databases;
* graph databases;
* automated subgraph retrieval;
* standardized evaluation metrics;
* expert evaluation;
* contradiction detection;
* source-quality assessment;
* richer provenance models;
* and controlled CTD-specific validation if separately authorized.

A future production-scale architecture would therefore move from:

```text
Small JSON corpus
+
Full-context LLM reasoning
```

toward:

```text
Large Evidence Corpus
        ↓
Document Processing
        ↓
Entity / Relationship Extraction
        ↓
Provenance-Aware Knowledge Graph
        +
Vector / Semantic Index
        ↓
Hybrid Retrieval
        ↓
Evidence-Grounded Reasoning
        ↓
Answer + Evidence Trail
```

---

# 20. Research Significance

The central research contribution being investigated is not simply the use of an LLM or a question-answering interface.

The key idea is:

> **Represent relationships explicitly and preserve the evidence behind those relationships.**

A conventional text-based system may need to repeatedly infer relationships from prose.

A knowledge graph can represent those relationships explicitly:

```text
Actor
  ↓
Incident
  ↓
Weapon
  ↓
Target
  ↓
Evidence
  ↓
Provenance
```

This representation is particularly relevant to questions such as:

* Which incidents share an actor?
* Which incidents share an actor and weapon?
* Which targets are associated with a particular organization?
* How does attribution strength vary?
* Which relationships are explicitly supported by evidence?
* Which conclusions are patterns inferred from multiple incidents?

The prototype provides a controlled environment for investigating whether this explicit representation produces measurable analytical benefits.

---

# 21. Status

**Project Status:** Experimental Research Prototype

**Current Scope:**

```text
27 incidents
Karachi, Sindh
MQM + TTP
133 nodes
227 edges
Baseline + Graph modes
Manual comparative evaluation
D3.js evidence visualization
Vercel deployment
```

This repository represents the current prototype and research demonstration, not the final proposed production-scale system.

---

# 22. License

This project is released under the **MIT License**.

See:

```text
LICENSE
```

for the complete license text.

---

## Authors

**Group 2**

* Muhammad Bilal Khan
* Qadeer
* Wassam ul Rab
* Abdul Latif
* Yasir

Prepared in the context of the research project:

**“A Provenance-Aware Knowledge Graph Approach to Evidence-Grounded Historical Security Event Analysis”**

Prepared for:

**Counter Terrorism Department (CTD), Sindh**

August 2026

```
```
