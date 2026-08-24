# Provenance-Aware Knowledge Graph for Security Event Analysis

A prototype knowledge graph for **evidence-grounded analysis of historical security events in Sindh, Pakistan**, using data from the Global Terrorism Database (GTD).

The project explores how a provenance-aware knowledge graph can support more transparent and relational analysis than conventional retrieval-based approaches.

## Project Scope

The current demonstration focuses on **27 historical incidents in Karachi, Sindh**, involving:

- Muttahida Qaumi Movement (MQM)
- Tehrik-i-Taliban Pakistan (TTP)

The incidents are derived from the **Global Terrorism Database (GTD)** provided by the National Consortium for the Study of Terrorism and Responses to Terrorism (START).

## Research Objective

The project investigates whether representing security events as a structured knowledge graph can improve analysis of:

- Relationships between actors and incidents
- Recurring attack methods and weapons
- Targeting patterns
- Cross-incident relationships
- Multi-hop relationships
- Attribution strength and uncertainty
- Evidence and provenance tracing

A key focus is preserving **how an attribution was established**, rather than treating every actor–incident relationship as equally certain.

## Knowledge Graph

The graph represents incidents as interconnected entities rather than isolated records.

Example:

```text
Actor
  │
  │ ASSOCIATED_WITH
  ▼
Incident
  │
  ├── OCCURRED_ON ───────► Date
  ├── OCCURRED_IN ───────► City
  ├── HAS_ATTACK_TYPE ────► Attack Type
  ├── USED_WEAPON ───────► Weapon
  └── TARGETED ──────────► Target