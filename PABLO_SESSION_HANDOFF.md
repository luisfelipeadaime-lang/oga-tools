# PABLO Session Handoff — v77-project-metadata
*Date: 2026-03-13*

---

## Current State Summary

**Worker version:** v77-project-metadata
**Worker file:** `C:\brand-presentations\infrastructure\clearsky-api\src\worker.js`
**Snapshot:** `C:\brand-presentations\infrastructure\worker-v77.js`
**Frontend:** `C:\brand-presentations\repos\oga-tools\tools\pablo.html` (commit 8f1aaa6)
**RFP Tracker:** `C:\brand-presentations\repos\oga-tools\tools\rfp-tracker.html` (commit 8fb1873)
**Design System:** `C:\brand-presentations\repos\oga-tools\tools\pablo-system.css` (commit a46c220)
**Bulk Intake:** `C:\brand-presentations\repos\oga-tools\tools\crawler_test.html` v10 (commit 8f1aaa6)
**Live API:** `https://api-tools.oga.earth`
**Live frontend:** `https://tools.oga.earth/tools/pablo.html`
**RFP Tracker live:** `https://tools.oga.earth/tools/rfp-tracker.html`
**Bulk Intake live:** `https://tools.oga.earth/tools/crawler_test.html`
**QA tool:** `https://tools.oga.earth/tools/test.html`

---

## All 4 Primitives + RFP Tool — COMPLETE

| Primitive | Version | Status |
|-----------|---------|--------|
| P1: Extraction | v60-v63, v70-v72, v74 | Mistral OCR primary, async jobs, Queues, scanned PDF detection, cancel/requeue, crawler extract |
| P2: Enrichment | v55c-v58, v73 | AI tagging, doc_class, dedup, normalizeRegistry |
| P3: Taxonomy | v64-v68, v73 | 3-axis vocab + registry_doc_type + normalizeRegistry canonical IDs |
| P4: Crawler | v65-v69, v74, v77 | Verra + Puro + Isometric, R2, queue routing, input normalization, extract+sync pipeline, project metadata, PD filter |
| P5: RFP Tool | v75-v76 | 3 D1 tables, 7 endpoints, AI evaluation engine, Watershed 2026 seeded, full UX rebuild |
| P6: Project Metadata | v77 | project_metadata D1 table, Verra detail fetch+cache, CONTINENT_MAP, is_registered_example, canonical_type |

---

## What Was Done: v77 — Project Metadata + PD Filter + Registered Examples

### Worker
- New D1 table: `project_metadata` (migration_018_project_metadata.sql) — id (PK: `{registry}:{project_id}`), registry, project_id, project_name, country, continent, methodology_code, project_type, status, proponent, vvb, crediting_period_start, crediting_period_end, total_credits_issued, estimated_annual_reductions, registry_url, raw_json, fetched_at
- New columns on `knowledge_docs`: `is_registered_example` (INTEGER DEFAULT 0), `canonical_type` (TEXT: `'methodology'` | `'registered_project'` | NULL)
- `fetchVerraProjectDetail(projectId, env)` — uses Verra search POST endpoint (not /details which 404s), parses resourceSummary data
- `storeProjectMetadata(env, data)` — INSERT ... ON CONFLICT(id) DO UPDATE
- `CONTINENT_MAP` — ~100 countries mapped to 7 regions (Latin America, Africa, Asia, Middle East, Europe, North America, Oceania, Central Asia)
- `crawlVerra()` — now fetches project detail during crawl loop
- `fetchVerraDocuments()` — pd_only filter: PD_PATTERNS regex array + isPdDocument() helper
- `enrichKnowledgeDocAI()` — auto-flags `is_registered_example=1` for crawler PDDs from Registered projects
- `taxonomy/search` — returns `is_registered_example`, `canonical_type`; new filters `?registered_example=1`, `?canonical_type=`
- New endpoints:
  - `GET /api/primitives/project-metadata` — list/filter project metadata
  - `GET /api/primitives/project-metadata/:registry/:id` — live-fetch from registry + cache to D1
- Health: `v77-project-metadata`
- Snapshot: `worker-v77.js`

### Frontend (crawler_test.html v10 + pablo.html)
- **crawler_test.html v10:**
  - PD-only radio filter for Verra crawl (filters document downloads to project descriptions only)
  - Project-ID grouped staging table with collapsible headers
  - PROJECT_META_CACHE — caches project metadata for enrichment display
- **pablo.html:**
  - `klibSourceBadge()` — renders source type badges in Knowledge Library
  - Enhanced canonical column: shows "Method" or "Example" star badges
  - "Registered Examples" filter checkbox in Knowledge Library filter bar
- Frontend commit: 8f1aaa6

---

## What Was Done: v76 — RFP Tracker Full UX Rebuild

### Worker (minimal)
- PATCH `/api/primitives/rfp/:rfp_id/project/:project_id` — updates `submission_status` and `notes` fields
- Health: `v76-rfp-ux`
- Snapshot: `worker-v76.js`

### Frontend (full rewrite: rfp-tracker.html)
Complete rewrite (~1100 lines, commit 8fb1873). Three-column macOS layout using pablo-system.css.

**Architecture:**
- State machine pattern: `STATE` object with reactive rendering functions
- Auto-opens first project with evaluation on RFP load

**Sidebar (220px):**
- RFP list with deadline countdown chips (red <7d, orange <21d, gray)
- "How to use" collapsible section
- "Add RFP" button (alert-only for now)

**Main area (3 tabs):**
1. **Projects** — cards grouped by status (Evaluating/Draft/Ready/Submitted/Conditional), fit score ring with 4 tiers (0-39 Blocked red, 40-69 Gaps amber, 70-84 Likely teal, 85-100 Ready green), HF inline pass/fail preview
2. **Eligibility Criteria** — verbatim criterion text in blockquotes, group filter bar, collapsible rows, expand/collapse all
3. **Submission Prep** — checklist from evaluation data + Typeform links

**Right panel (420px):**
- Score summary with ring + tier label
- Critical gaps (red) + top strengths (green) callout boxes
- Supply doc upload zone (drag-and-drop + click)
- AI evaluation with simulated 3-stage progress animation
- Criterion cards (fail/partial expanded by default, pass collapsed)
- Status selector buttons (Draft/Evaluating/Ready/Submitted)
- Add project form

### QA Results (v76)
| Check | Result |
|-------|--------|
| QA-1 pablo-system.css linked | PASS |
| QA-2 Sidebar with RFP list | PASS |
| QA-3 Three tabs (Projects/Criteria/Prep) | PASS |
| QA-4 Fit score ring with 4 tiers | PASS |
| QA-5 Verbatim criterion_text | PASS |
| QA-6 Supply doc upload | PASS |
| QA-7 Run Evaluation button | PASS |
| QA-8 Status selector | PASS |
| QA-9 Add project form | PASS |
| QA-10 Deadline banner | PASS |
| QA-11 Submission Prep tab | PASS |
| QA-12 Add project | PASS |
| QA-13 Fit tiers (Blocked/Gaps/Likely/Ready) | PASS |
| QA-14 Typeform links | PASS |

---

## What Was Done: v75 — RFP Tool + pablo-system.css + rfp-tracker.html

### PART 1: D1 Schema

3 new tables created via migration 016_rfp_tables.sql:

| Table | Columns | Purpose |
|-------|---------|---------|
| rfps | id, title, buyer_name, deadline, q_and_a_deadline, source_doc_id, criteria_json, eligible_project_types, status | RFP definitions with structured criteria |
| rfp_projects | id, rfp_id, project_name, project_type, registry, methodology, volume, vintage, price, issuance_date, notes, evaluation_json, fit_score, submission_status | Projects being evaluated against RFPs |
| rfp_supply_docs | id, rfp_project_id, knowledge_doc_id, doc_label, uploaded_by | Join table linking projects to knowledge_docs |

Watershed 2026 Carbon RFP pre-seeded:
- 7 hard filters (credit type, vintage, issuance, commercial terms, registry, language, geography)
- 9 quality criteria (baseline, additionality, MRV, durability, leakage, community, co-benefits, delivery risk, external rating)
- 9 biochar-specific, 7 ARR, 3 IFM, 4 super_pollutant, 4 regen_ag
- Commercial terms (offtake, contracting, pricing)
- Deadline: 2026-04-10, Q&A deadline: 2026-03-20

### PART 2: Worker Endpoints (6 new)

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/primitives/rfp/list | GET | List all RFPs with project counts |
| /api/primitives/rfp/:id | GET | RFP detail with parsed criteria + projects with supply doc counts |
| /api/primitives/rfp/:id/project | POST | Add project to RFP (normalizeRegistry on registry) |
| /api/primitives/rfp/:rfp_id/project/:pid/supply | POST | Upload file (extract → knowledge_docs source_type='rfp_supply') or link existing doc |
| /api/primitives/rfp/:rfp_id/project/:pid/evaluate | POST | AI evaluation: Sonnet, per-criterion, verbatim text, fit_score 0-100 |
| /api/primitives/rfp/:rfp_id/project/:pid | GET | Project detail with supply docs and parsed evaluation |

Additional worker changes:
- taxonomy/search now returns `source_type` column
- Health: v75-rfp-tool

### PART 3: pablo-system.css

Shared macOS-inspired design system at `tools/pablo-system.css`:
- CSS custom properties for surfaces, borders, typography, colors, radius, shadows, layout, motion
- Three-column shell: `.pablo-shell` > `.pablo-sidebar` + `.pablo-main` + `.pablo-panel`
- Toolbar, sidebar items, list rows, cards, badges (8 colors), fit score ring
- Criterion cards with status-colored left border
- Buttons (primary/secondary/ghost/danger/sm), inputs, search bar
- Scrollbar styling, utility classes

### PART 4: rfp-tracker.html

Three-column macOS-style RFP workspace:
- **Left sidebar:** RFP list with deadline countdown chips (days remaining, color-coded: red <7d, orange <21d)
- **Center:** Project cards grouped by submission_status (Draft → Evaluating → Ready → Submitted → Shortlisted → Awarded)
- **Right panel:** Project detail with:
  - Supply document upload (drag-and-drop + click, multipart/form-data → extract → knowledge_docs)
  - AI evaluation results: summary bar (fit score, hard filter pass count, quality met count, readiness badge)
  - Critical gaps (red) and strengths (green) callout boxes
  - Hard filter rows (pass/fail icons)
  - Quality and project-type criterion cards (expandable, with verbatim text, evidence, gap, recommendation)
- Add project form with type/registry/volume/vintage/issuance fields
- Q&A deadline warning bar

### PART 5: pablo.html rfp_supply filter

- `KLIB.filterSupply` state property added
- `klibFilteredDocs()` filters by `source_type === 'rfp_supply'` when checked
- "Supply Docs" checkbox added to Knowledge Library filter bar

### QA Results (v75)
| Check | Result |
|-------|--------|
| QA-1 Tables exist | PASS — rfps, rfp_projects, rfp_supply_docs |
| QA-2 Watershed criteria | PASS — 7 HF, 9 quality, 9 biochar, 7 ARR, 3 IFM, 4 SP, 4 RA |
| QA-3 rfp/list | PASS — 1 RFP, Watershed with deadline 2026-04-10 |
| QA-4 rfp/watershed-2026 | PASS — full criteria JSON + commercial terms |
| QA-5 Add project | PASS — created with registry normalized |
| QA-6 rfp-tracker.html loads | PASS — pablo-system.css linked, 28KB |
| QA-7 Project detail | PASS — name, type, registry=puro_earth |
| QA-11 source_type in API | PASS — taxonomy/search returns source_type |
| QA-12 pablo.html filter | PASS — filterSupply + Supply Docs checkbox |

---

## Previous Sessions

### v74-crawler-extraction (2026-03-13)
1. POST /api/primitives/crawler/extract — R2 fetch → extractDocument → knowledge_docs
2. Boundary dedup (registry+project_id+filename)
3. crawler_test.html v8: Case C commit flow
4. 7 docs extracted from Brazil REDD crawl

### v73-pablo-library (2026-03-13)
1. normalizeRegistry() — 10 canonical IDs
2. Methodology Library rewrite (single API, two-panel)
3. Knowledge Library rewrite (searchable sortable table)

### v72-mistral-ocr (2026-03-13)
1. Mistral OCR 3 primary ($0.002/pg, no page limit)
2. Document AI deletion
3. Cancel/Stop button

### v70/v71 — Scanned PDF + Extraction Stability (2026-03-13)
1. isLikelyScannedPdf() + forceOcr
2. hasBinaryGarbage() filter

### v68/v69 — registry_doc_type + Crawler (2026-03-13)
1. classifyVerraDoc() 25 patterns
2. D1 migrations
3. crawler_test.html v3-v5

### v65-v67 — Registry Crawler (2026-03-12)
1. Verra VCS OData, Puro.earth, Isometric API stubs
2. crawl_runs/crawl_projects/crawl_documents tables

---

## Key Gotchas (cumulative)

1. **Platform section vs project tab** — `showPlatform()` vs `tab()`.
2. **Windows CRLF vs Linux LF** — raw byte count differs ~2,841 bytes.
3. **Worker route order** — exact-match routes BEFORE regex wildcard.
4. **No `method` variable in main fetch** — use `request.method`.
5. **Luis canonical email** — `luis.adaime@clearskyltd.com` (HubSpot owner 82916631).
6. **HubSpot owner ID** — 82916631 (not 146823759).
7. **Edit race on worker.js** — re-read before every edit.
8. **thread_json SQLITE_TOOBIG** — null in batch sync, full content in R2.
9. **env.FILES not env.R2** — R2 bound as `FILES` in wrangler.toml.
10. **Backfill resumable** — offset in `hubspot_sync_state`.
11. **Queue consumer != ctx.waitUntil** — own 15-min CPU per message.
12. **Async jobs stuck at "processing"** — queues auto-retry (2x -> DLQ).
13. **env.EXTRACTION_QUEUE** — falls back to ctx.waitUntil if absent.
14. **knowledge_docs.document_type not doc_type** — D1 column is `document_type`; API aliases as `doc_type`.
15. **Crawler queue routing** — `msg.type === 'crawl_run'` -> crawler; bare `{jobId}` -> extraction.
16. **Crawler R2 path** — `crawl/{registry}/{project_id}/{filename}`.
17. **is_canonical vs doc_tier** — `is_canonical=1` is the current filter (v66).
18. **205 docs = 18 Library + ~187 internal** — unfiltered taxonomy/search returns all.
19. **PDF async threshold** — v68 changed from 8MB to 1MB.
20. **registry_doc_type is Verra-native** — separate from PABLO taxonomy doc_type.
21. **Blob preservation** — read file to ArrayBuffer immediately on drop/select.
22. **Verra status normalization** — buildVerraFilter() STATUS_MAP.
23. **Crawler docs default to pending quality** — crawler_test v5.
24. **classifyVerraDoc 25 patterns** — v69 extended from 15.
25. **Scanned PDF detection** — isLikelyScannedPdf(): bytes/page < 50KB AND pages > 30.
26. **extractionStatus on staging rows** — extracting|polling|chunks|done|error.
27. **Mistral OCR primary** — native text → Mistral OCR → Claude OCR fallback → Sonnet base64.
28. **FileList live DOM reference** — Array.from() before async work.
29. **normalizeRegistry canonical IDs** — 10 IDs, NULL for unknown. [v73]
30. **taxonomy/search doc_type alias** — use `d.doc_type` in frontend. [v73]
31. **puro_earth null registry_doc_type** — 7 docs, UI falls back to d.doc_type. [v73]
32. **Methodology tab single API** — taxonomy/search?canonical=1&limit=500. [v73]
33. **Knowledge Library single API** — taxonomy/search?limit=500. [v73]
34. **Crawler commit flow** — Case A (PATCH assign), Case B (POST ingest), Case C (POST crawler/extract). [v74]
35. **knowledge_docs.markdown not content** — INSERT must use `markdown`. [v74]
36. **crawl_documents pre-populated extracted_markdown** — reuses if word_count>=50. [v74]
37. **source_type='crawler'** — all knowledge_docs from crawler/extract. [v74]
38. **RFP route order** — rfp/list (exact) MUST come before rfp/:id (regex). rfp/:id guard: `!== 'list'`. [v75]
39. **RFP supply R2 path** — `rfp-supply/{rfp_id}/{project_id}/{uuid}-{filename}`. [v75]
40. **source_type='rfp_supply'** — all knowledge_docs from RFP supply upload. source_id format: '{rfp_id}:{project_id}'. [v75]
41. **RFP evaluation criterion_text** — ALWAYS verbatim from criteria_json. AI prompt enforces "do not rephrase". [v75]
42. **pablo-system.css** — shared design system, first consumer: rfp-tracker.html. pablo.html migrates in v76. [v75]
43. **taxonomy/search source_type** — now returned in SELECT. Use d.source_type for rfp_supply filter. [v75]
44. **PATCH rfp project** — reuses same rfpProjectDetailMatch regex const as GET. Method check separates them. [v76]
45. **rfp-tracker.html state machine** — STATE object drives all rendering. Always call render functions after state changes. [v76]
46. **Fit score 4 tiers** — 0-39 Blocked (red), 40-69 Gaps (amber), 70-84 Likely (teal), 85-100 Ready (green). [v76]
47. **Verra details API 404** — `/resource/resource/details` returns 404. Use search POST with `resourceIdentifier eq '{id}'` filter instead. [v77]
48. **project_metadata PK format** — `{registry}:{project_id}` (e.g. `verra:934`). [v77]
49. **CONTINENT_MAP coverage** — ~100 countries. Unknown countries get `continent=NULL`. [v77]
50. **is_registered_example vs is_canonical** — `is_canonical=1` = curated methodology reference, `is_registered_example=1` = PDD from Registered project. Both can coexist. [v77]
51. **canonical_type values** — `'methodology'` or `'registered_project'` or NULL. Not to be confused with is_canonical integer flag. [v77]
52. **PD_PATTERNS** — regex array in worker for filtering project descriptions from Verra doc lists. isPdDocument() helper function. [v77]
53. **PROJECT_META_CACHE** — client-side cache in crawler_test.html v10. Populated from /api/primitives/project-metadata. [v77]

---

## Taxonomy Dimensions (v64-v73)

```
doc_type (13):  core_methodology, project_description, verification_report, registry_spec,
                financial_model, example_pd, legal_agreement, market_intelligence,
                policy_document, technical_report, presentation, correspondence, other

registry (10 canonical, v73):
  verra, puro_earth, gold_standard, isometric, american_carbon, climate_action,
  plan_vivo, miteco, eu_ets, art_trees
  All writes go through normalizeRegistry(). NULL for unknown.

project (8):    marakoa, bosquia, amoedo, puro_tsb, isometric_subsurface,
                clearsky_internal, registry_reference, unassociated

registry_doc_type (25, v69):
  VM_methodology, VMD_module, VT_tool, VCS_program_document, JNR_document,
  CCP_document, CCP_label_document, AFOLU_tool, CDM_tool,
  puro_document, isometric_document, GS_document,
  project_description_template, verification_document, monitoring_document,
  + 10 project document patterns

source_type (8, v75):
  direct_upload, project_extract, project_sync, web_scrape,
  workflow_input, workflow_result, crawler, rfp_supply
```

---

## Next Steps

### Option A — More RFP projects + evaluation
Add real ClearSky projects (GreenCarbon Biochar, Ember, WoodCache, Fasera) to Watershed 2026.
Upload PDDs and run evaluations.

### Option B — Puro.earth/Isometric crawler
API keys needed. Wire into existing crawler infrastructure.

### Option C — RFP PDF auto-parse
Upload an RFP PDF → AI extracts criteria → auto-creates rfps record.
Currently Watershed is manually seeded.

### Option D — pablo.html migration to pablo-system.css
Migrate pablo.html dark theme to use pablo-system.css (light theme).

---

*Generated: 2026-03-13 by Claude (Opus 4.6) — updated for v77-project-metadata*
