# SYSTEM.md — OGA / ClearSky / LFA Platform Architecture
*Last updated: 2026-03-15 | Author: Luis Felipe Adaime*
*Read this file completely before touching ANY tool, Worker endpoint, or D1 schema.*

---

## GOVERNANCE RULE
> **Any change to a shared endpoint, shared D1 table, or shared JS pattern must be applied to ALL dependent tools in the same session. Check the dependency map before every build. Every Claude Code session that modifies a shared component must update this file before closing.**

---

## SECTION 1: CANONICAL FUNCTIONS
*Use these. Never create a parallel version. If it needs extending, extend it here.*

```
extractDocument(bytes, filename, contentType, env, mode='full')
  PURPOSE: Single extraction entry point for ALL file types in the codebase.
  mode 'full'     → no cap — methodology library, knowledge base, wiki, RAG, export context
  mode 'classify' → 50K cap — workflow ingest classification only
  mode 'preview'  → 5K cap — UI snippets
  Returns: { text, word_count, char_count, mode_used, truncated }
  NEVER: call without explicit mode, inline PDF/DOCX parsing, use extractForIngest()
  NOTE: extractForIngest() was deleted in v58. It does not exist.

cleanPdfText(text)
  PURPOSE: Remove PDF artifacts, garbage blocks, formatting noise from extracted text.
  Filters: RuleCounter.*, Hfootnote.*, cite.0@*, glo:*, internal reference blobs.
  Called internally by extractDocument(). Do not call directly.

baseFilename(filename)
  PURPOSE: Strip ZIP subfolder paths from filenames.
  "folder/sub/file.pdf" → "file.pdf"
  Apply to: all document title storage, all Content-Disposition headers.

extractEngagementSender(engagement)
  PURPOSE: Extract sender identity from HubSpot engagement object.
  Uses LUIS_HUBSPOT_OWNER_ID for authoritative identity — not email strings.
  Returns: { sender_email, sender_name, involves_luis, luis_role }

inferMethodologyMetadata(text, filename, env)
  PURPOSE: AI fallback for registry/document_role/version detection.
  Input hierarchy: user_declared > ai_inferred > unknown.

enrichKnowledgeDocAI(docId, content, env)
  PURPOSE: Async enrichment — generates tags, doc_class, doc_subtype via Claude.
  Called after ingest, not during.

computeContentHash(text) / findExistingKnowledgeDoc(hash, db)
  PURPOSE: Deduplication before INSERT to knowledge_docs.
  Always call before inserting a new document.

callClaudeRetry(prompt, env, maxRetries=3)
  PURPOSE: Standard Claude API wrapper with retry logic.
  Use this. Never raw fetch to Anthropic API.

extractWithMistralOCR(fileBuffer, env)  [v72]
  PURPOSE: Primary OCR engine for all PDFs. Sends base64 to Mistral OCR 3.
  Cost: $0.002/page. No page limit, no chunking needed.
  Uses: env.MISTRAL_API_KEY secret.
  Returns: concatenated markdown from pages[].markdown.
  Called by: extractDocument() (sync) and processExtractionJob() (async).
  NEVER: call Document AI functions — they were deleted in v72.

normalizeRegistry(raw)  [v73]
  PURPOSE: Maps any registry string variant to canonical taxonomy ID.
  Canonical IDs: verra, puro_earth, gold_standard, isometric, american_carbon,
                 climate_action, plan_vivo, miteco, eu_ets, art_trees.
  Returns null for unknown/empty/unspecified.
  Called by: enrichKnowledgeDocAI, taxonomy/assign, taxonomy/classify.
  NEVER: write raw user-supplied registry strings to D1 without normalizing first.

createExtractionJob(db, jobId, filename, r2Key, tenant, mode)  [v62]
  PURPOSE: Create D1 record for async PDF extraction job.
  Called by: POST /api/primitives/extract for files >8MB.

processExtractionJob(jobId, env, chunkOffset)  [v63, rewritten v72]
  PURPOSE: Background job processor. Fetches file from R2, extracts text.
  Strategy: native text first (CPU-cheap) → Mistral OCR → Claude OCR fallback.
  Called via Cloudflare Queue consumer (own 15-min CPU clock). Fallback: ctx.waitUntil.
  NEVER: call synchronously in a request handler.

isLikelyScannedPdf(fileSizeBytes, pageCount)  [v70, updated v71]
  PURPOSE: Heuristic to detect scanned PDFs. compressed bytes/page < 50KB AND pages > 30.
  Scanned PDFs have misleading compression ratios.
  v71: when true, skips native text extraction entirely (straight to OCR).
  Used by: extractDocument() (native text skip).

capTextByMode(text, mode)  [v63]
  PURPOSE: Mode-aware text truncation (replaces hard 400K cap).
  full=2MB, classify=50K, preview=5K.

classifyTaxonomy(filename, textSnippet)  [v64]
  PURPOSE: Rule-based taxonomy classifier. No API call.
  Returns: { doc_type, registry, project }
  Runs on filename + first 2000 chars of text.
  Manual input always wins (user_document_type > auto > ai).
  Called by: enrichKnowledgeDocAI, /api/primitives/taxonomy/classify, backfill.
```

---

## SECTION 2: CANONICAL CONSTANTS
*Single source of truth. Never redeclare these elsewhere.*

```
LUIS_HUBSPOT_OWNER_ID = 82916631
  What: Luis's HubSpot numeric owner ID
  Email: luis.adaime@clearskyltd.com
  Used in: extractEngagementSender(), involves_luis D1 field
  NEVER: use email strings for HubSpot sender identity
  NEVER: string-scan thread_json for identity

CLEARSKY_CONTACTS (pablo.html only)
  What: Display name map for known team members
  Lives: pablo.html UI layer only
  NEVER: duplicate in Worker
```

---

## SECTION 3: D1 SCHEMA — FIELD SEMANTICS
*Column names plus what they actually mean.*

```
knowledge_docs:
  content         → full extracted text, no truncation cap (post-v58)
  doc_class       → canonical_reference | project_document | financial_model |
                    correspondence | regulatory_filing | workflow_output
  document_type   → taxonomy dimension 1 (13 controlled values in taxonomy_doc_types)
  registry        → taxonomy dimension 2 (11 controlled values in taxonomy_registries) [v64]
  project         → taxonomy dimension 3 (8 controlled values in taxonomy_projects) [v64]
  taxonomy_source → manual | auto | ai — how taxonomy was assigned [v64]
  ingest_source   → methodology_library | workflow_ingest | manual_upload
  r2_key          → R2 object key for original file download (NULL = not stored)
  content_hash    → SHA-256 of content, used for dedup via findExistingKnowledgeDoc()
  registry        → taxonomy dimension 2 — MUST be normalizeRegistry() canonical ID. [v73]
                    Canonical IDs: verra, puro_earth, gold_standard, isometric, american_carbon,
                    climate_action, plan_vivo, miteco, eu_ets, art_trees. NULL for unknown.
                    NEVER store raw variants (verra_vcs, car, acr). normalizeRegistry() wired into
                    enrichKnowledgeDocAI, taxonomy/assign, taxonomy/classify. [v73]
  methodology_code → TEXT, nullable. AI-extracted methodology identifier (e.g. VM0047, AR-ACM0003). [v75b]
                    Extracted by enrichKnowledgeDocAI field #10. Indexed (idx_knowledge_docs_methodology_code).
                    Filter: taxonomy/search?methodology_code=VM0047. Writable via taxonomy/assign PATCH.
  is_canonical    → INTEGER DEFAULT 0. 0 = general library, 1 = curated methodology reference. [v66]
                    /api/primitives/taxonomy/search?canonical=1 → curated view only.
                    /api/primitives/taxonomy/search?methodology_code=VM0047 → filter by methodology code. [v75b]
                    /api/primitives/taxonomy/assign accepts is_canonical field.
                    /api/primitives/taxonomy/assign accepts methodology_code in PATCH body. [v75b]
                    /api/knowledge/ingest accepts is_canonical FormData ('1' to set).
                    Methodology Library browse axis: Registry chips → registry_doc_type list → documents. [v73]
                    Two-panel layout, single API call, client-side filtering.
                    Registry chips derived from actual data (not hardcoded).
                    Doc type list uses registry_doc_type + REGISTRY_DOC_TYPE_LABELS (24 entries). [v73]
  input_source    → user_declared | ai_inferred | unknown

hubspot_threads:
  involves_luis   → 1 if Luis (owner ID 82916631) sent the email, 0 otherwise
  luis_role       → 'sender' | 'recipient' | 'cc' | null
  sender_email    → best-effort from HubSpot metadata.from.email (may be null)
  sender_name     → display name of actual sender
  thread_json     → raw HubSpot engagement blob — DO NOT parse for identity
  contact_email   → the external counterparty's email (not necessarily the sender)

crawl_documents:
  knowledge_doc_id → FK to knowledge_docs. null = not synced. [v74]
                     POST /api/primitives/crawler/extract sets this after extraction.
                     Check before INSERT to prevent duplicate knowledge_docs.
  source_type on linked knowledge_docs → 'crawler' (not 'direct_upload' or 'project_extract')
  Geographic files (kml/shp/kmz/geojson/gpx/dbf/prj/shx) → skip extraction, word_count stays 0.

methodology_bundles:
  id              → slug (puro_tsb, isometric_subsurface)
  source_url      → registry URL, crawler-ready field
  crawler_enabled → future auto-refresh flag

methodology_documents:
  document_role   → FK to document_roles table
                    (core_methodology, example_pd, registry_spec,
                     verification_report, template_calculation)
  input_source    → user_declared | ai_inferred | unknown
  ai_confidence   → 0.0-1.0, present when input_source = ai_inferred

pablo_projects:
  methodology_bundle_id → FK to methodology_bundles, enables auto-context assembly

rfps:                       [v75]
  id              → slug (watershed-2026, goodcarbon-2026)
  criteria_json   → full structured JSON: hard_filters[], quality_criteria[],
                    project_type_criteria{biochar[], arr[], ifm[], super_pollutant[], regen_ag[]},
                    commercial{} — criterion text is ALWAYS verbatim from RFP PDF
  eligible_project_types → JSON array of valid project_type values

rfp_projects:               [v75]
  evaluation_json → AI evaluation output: criteria_results[], fit_score, hard_filter_summary,
                    quality_summary, top_strengths, critical_gaps, submission_readiness
  fit_score       → 0-100 integer, computed by AI: HF fail=cap@20, quality+8, type+4, partial=half

rfp_supply_docs:            [v75]
  rfp_project_id  → FK to rfp_projects.id
  knowledge_doc_id → FK to knowledge_docs.id — supply docs stored as knowledge_docs
  source_type on linked knowledge_docs → 'rfp_supply'
  source_id format → '{rfp_id}:{project_id}'

knowledge_docs.source_type values: [v75 updated]
  direct_upload | project_extract | project_sync | web_scrape |
  workflow_input | workflow_result | crawler | rfp_supply
```

---

## SECTION 4: INTEGRATION GOTCHAS
*Known traps. Read before building anything that touches these systems.*

```
HUBSPOT API:
  ❌ WRONG: filtering by email string in thread_json
  ✅ RIGHT: filtering by engagement.ownerId === LUIS_HUBSPOT_OWNER_ID
  WHY: HubSpot engagement objects store sender as numeric ownerId, not email.
       Email strings in metadata.from.email are unreliable and sometimes absent.
  RULE: Before any HubSpot filter/display build — fetch one raw engagement from
        D1 and inspect the actual data shape. Design around what's there.

CLOUDFLARE WORKERS:
  - 30s wall clock limit: use Promise.all() for multi-file operations
  - D1: no ALTER TABLE IF NOT EXISTS — check PRAGMA table_info first
  - R2: object.body is a ReadableStream — pipe directly, don't buffer large files
  - Worker size limit: if deploy fails with "script too large", split handlers

CLOUDFLARE D1 INTEGER GOTCHA:
  - D1 returns INTEGER columns as strings in some query paths ("1" not 1)
  - Never use === for D1 integer comparisons in JS — always use Number() cast
  - CORRECT: Number(thread.involves_luis) === 1
  - WRONG:   thread.involves_luis === 1  (fails silently when D1 returns "1")
  - Affects: involves_luis, any other INTEGER DEFAULT 0 columns used in JS filters

PDF EXTRACTION:
  - mammoth.js unavailable in CF Workers — use w:t XML parsing for DOCX
  - Structured PDFs (pdflatex) emit internal reference blobs (RuleCounter,
    Hfootnote, cite.0@) that contaminate extracted text — cleanPdfText() filters these
  - ZIP files: subfolder paths leak into filenames — always apply baseFilename()
  - extractForIngest() was deleted in v58 — it does not exist
  - LaTeX-compiled PDFs emit CID font tables at end of extracted text:
    CIDInitCIDInitTeX-pxmiaX-builtin-0, TeX-zpl-Bold-tlf-t1, TeX Live 2022
    Pattern: lines matching /CIDInit|TeX-[a-z]|TeX Live/
    Add to cleanPdfText() filter — same approach as RuleCounter block

GOOGLE DOCUMENT AI (v60):
  - PRIMARY extraction path for ALL PDFs (replaced Claude OCR)
  - GCP project: oga-tools, processor: e67ba60df73bf041 (OCR pretrained-ocr-v2.1-2024-08-07)
  - Auth: GCP service account → JWT → OAuth2 access token (getGoogleAuthToken())
  - Token cached 55 minutes (valid 60 min), auto-refreshes on expiry
  - 15-page limit per API request (OCR mode) — large PDFs chunked via individualPageSelector
  - Page chunking: pages 0-14, 15-29, 30-44, etc. — reassembled into single document
  - Secrets: GOOGLE_DOCUMENT_AI_KEY (full service account JSON), GOOGLE_DOCUMENT_AI_PROCESSOR (resource name)
  - Fallback chain: Document AI → native extractPdfText() → Claude OCR (last resort)
  - cleanPdfText() still applied to Document AI output

LARGE PDF ASYNC EXTRACTION (v63 — Cloudflare Queues, v70 — continuation queue):
  - POST /api/primitives/extract returns {async:true, job_id} for PDFs >8MB
  - Client must poll GET /api/primitives/jobs/:id until status=complete
  - text=1 query param (default) includes full extracted text in poll response
  - text=0 returns metadata only (status, word_count, method)
  - v63: dispatched to Cloudflare Queue (extraction-queue) — each job gets own 15-min CPU clock
  - Fallback: ctx.waitUntil if EXTRACTION_QUEUE not bound (dev/preview)
  - Background processing uses native text extraction first (CPU-cheap, completes in <10s)
  - No hard 400K char cap — capTextByMode: full=2MB, classify=50K, preview=5K
  - Dead-letter queue (extraction-dlq) catches jobs that fail after 2 retries
  - extraction_jobs D1 table tracks all async jobs (batch_id column for batch uploads)
  - DOCAI_SAFE_RAW_BYTES = 8MB (not 14MB) — 8MB raw ≈ 10.7MB base64, safe under 20MB API limit
  - POST /api/primitives/extract/batch — up to 60 files, returns batch_id + per-job IDs
  - GET /api/primitives/batch/:batchId — aggregate batch status (total/complete/errored/pending)
  - v70: scanned PDF detection — isLikelyScannedPdf() (bytes/page <50KB AND pages >30)
  - v70: adaptive chunk sizing — computePagesPerChunk(): 15p text, 6p scanned, 4p scanned >300p, 20p ceiling
  - v70: continuation queue — CHUNKS_PER_INVOCATION=15, R2 staging at extractions/{jobId}/chunk_NNNN.txt
  - v70: queue consumer accepts {jobId, chunkOffset, isContinuation} messages
  - v70: extraction_jobs gains total_chunks, completed_chunks, chunk_offset columns
  - v70: jobs/:id returns total_chunks, completed_chunks, progress_pct
  - v70: supports unlimited document size via multi-hop continuation pattern
  - v71: hasBinaryGarbage() detection — filters binary garbage from Document AI output
  - v71: isLikelyScannedPdf() skips native text extraction entirely (was short-circuiting at 200 chars)
  - v71: native text threshold proportional: max(200, pageCount * 20) chars
  - v71: _docAiRequest() forceOcr param — ocrConfig.enableNativePdfParsing=false for scanned PDFs
  - v71: all 3 DocAI paths pass forceOcr=isScanned and filter hasBinaryGarbage

PABLO.HTML:
  - str_replace only — never full rewrite (Rule #16)
  - No inline style= on platform views — CSS specificity bug (Rule #12)
  - Every new tab must wire nav to showPlatform() (Rule #17)
  - CLEARSKY_CONTACTS lives here, not in Worker — do not duplicate

REGISTRY INDEX (v78):
  - verra_registry_index methodology — semicolon-separated string, maps to meth field in frontend
  - clearskyplatform loadData — ALL = all 4903 rows. VCU = only rows where vcu_total_issued exists (2116).
    LEFT JOIN means 2787 projects have null VCU data — this is correct, not a bug
  - vcu_aggregates issuance_trend — JSON string, parse with JSON.parse() in loadData()
  - registry.html vs clearskyplatform.html — registry.html has embedded data blobs (~1.1MB),
    clearskyplatform.html fetches from API (~46KB). Same UI logic.
  - RESEARCH BEFORE BUILDING — Always web_search for existing free/open-source solutions before
    proposing custom builds. Proven: Tailscale+tmux+SSH for mobile terminal access. [standing rule]

57. clearskyplatform Download PD — calls POST /api/primitives/crawler/run with {registry:'verra', query:id, max:1, downloadFiles:true, pdOnly:true}. Polls GET /api/primitives/registry-index/project/:id/pdd-status every 5s, max 36 attempts (3min). Button id="pdd-btn-{project_id}", CSS classes: .loading, .done, .err. On complete, rewires onclick to open pablo.html?tab=knowledge&project_id={id}. [v79a]
58. Watershed inline filter — S.watershedMode boolean toggle in toggleWatershed(). Resets all filters, sets status='Registered', clears country/meth/region. Does NOT navigate away. Button id="watershedBtn", text "Watershed 2026". [v79a]
59. Country search — S.country string, onCountryInput() sets it. applyFilters() does r.country.toLowerCase().indexOf(S.country) substring match. Input id="countrySearch", cleared in resetFilters() and toggleWatershed(). [v79a]

60. crawl_projects D1 schema — column is `registry_project_id` (NOT `project_id`), FK is `crawl_run_id` (NOT `run_id`). crawl_documents FK is also `crawl_run_id`. Always check PRAGMA table_info() before writing JOINs against crawl_* tables. [v79b]

61. clearskyplatform.html v79b language rules — NEVER use "PABLO", "Knowledge Library", or "crawler/crawling" in any user-visible text. Use "ClearSky document library", "Credit History" (not "VCU Intelligence"), "Get Project Document" / "Open Document" (not "Download PD" / "Crawl PDD"), "Locating project document on Verra registry" (not "Crawling"). [v79b]

62. clearskyplatform.html panel tabs are JS-rendered — `ptb-ov` and `ptb-vcu` IDs exist only in renderPanel() JavaScript, not in static HTML. QA checks looking in pre-script HTML will miss them. [v79b]

63. CAT_MAP uses OR logic — `toggleCat('Energy')` matches project_category==='Energy' || 'Energy Demand' || 'Mining' || 'Chemical' || 'Manufacturing'. Nature matches AFOLU || Livestock. CCS is standalone. [v79b]

64. DL_STEPS download animation — 5 steps at 2s intervals (total 10s animation). Runs in parallel with pollDlStatus (5s interval, max 36 attempts = 3min). If crawl finishes before animation, animation is cancelled and finishDl() called immediately. If crawl times out, animation completes then finishDl(null) is called. [v79b]

65. crawler/run field names — Worker accepts: registry, project_id, query, max_projects, download_documents, pd_only, async, country, projectType, status. NOT: max, downloadFiles, pdOnly. clearskyplatform.html must use the correct names. [v79b fix]

66. query vs project_id in buildVerraFilter — `query` does `contains(resourceName, ...)` (name search). `project_id` does `resourceIdentifier eq N` (exact ID match). For single-project PD download, ALWAYS use project_id, not query. [v79b fix]

67. crawlVerra auto-extract — when pd_only is set, crawlVerra now auto-extracts the first PD document (prioritizes PROJ_DESC/PDD filenames). Creates knowledge_doc and sets knowledge_doc_id on crawl_documents. This makes pdd-status return 'complete' immediately after crawl. Without auto-extract, documents stay in 'extracting' state forever. [v79b fix]

68. project_category always 'ALL' — verra_registry_index.project_category is the import batch label (always 'ALL'), NOT a project-level category. Category must be derived from `afolu` column (non-empty = AFOLU/Nature) and `methodology` patterns. deriveCat() in clearskyplatform.html does this normalization. [v79c]

69. corsOrigin vs corsHeaders() — Worker binary download endpoints must use `...corsHeaders(request, env)` for CORS headers. There is no `corsOrigin` variable in scope — using it throws "corsOrigin is not defined". Pattern: `return new Response(data, { headers: { 'Content-Type': ..., ...corsHeaders(request, env) } })`. [v79c]

70. crawler/download endpoint — GET /api/primitives/crawler/download/:crawl_doc_id serves file from R2 using crawl_documents.r2_key. Different from /api/files/download/:fileId which uses files table. Crawler files are NOT in the files table — they're in crawl_documents with their own r2_key. [v79c]
```

---

## SECTION 5: DOWNSTREAM CONSUMER MAP
*Before changing a data source, check who reads it.*

```
knowledge_docs.content is read by:
  → wiki.html (RAG context assembly)
  → /api/methodologies/:id/export-context (Export Context for Chat)
  → /api/pablo/workflows/run (workflow engine)
  → presentations-v3 (future: reads from pablo_projects)
  IMPACT: truncated content here = truncated context everywhere

hubspot_threads is read by:
  → pablo.html HubSpot tab (inbox display, Mine filter)
  → future: v59 AI task proposal engine

knowledge_docs (canonical, taxonomy/search) is read by:
  → pablo.html Methodology Library (taxonomy/search?canonical=1, client-side registry+registry_doc_type filter) [v73]
  → pablo.html Knowledge Library (taxonomy/search?limit=500, client-side search/sort) [v73]
  → /api/methodologies/:id/export-context
  → future: auto-context assembly for project workflows
```

---

## SECTION 6: RESEARCH-FIRST RULE
*Prevents the class of bugs where BP assumes data shape instead of verifying it.*

Before building any feature that reads from an external API or existing D1 table:

```
1. Fetch one real response (API) or SELECT one real row (D1)
2. Log the actual data shape — field names, types, nesting
3. Identify the authoritative identity/key fields
4. Design the feature around actual data, not assumed data
5. Document any new gotcha found in Section 4 of this file

EXAMPLE VIOLATION: Building Mine filter assuming HubSpot stores email strings
EXAMPLE CORRECT: SELECT thread_json FROM hubspot_threads LIMIT 1,
                 find ownerId field, use LUIS_HUBSPOT_OWNER_ID for filter
```

---

## 7. INFRASTRUCTURE — TWO SEPARATE BACKENDS

### Backend A — ClearSky / PABLO Platform
| Component | Value |
|-----------|-------|
| Worker URL | `https://api-tools.oga.earth` |
| Worker source | `C:\brand-presentations\infrastructure\clearsky-api\src\worker.js` |
| Worker deploy | `cd C:\brand-presentations\infrastructure\clearsky-api && npx wrangler deploy` |
| Current version | v71-extraction-stable |
| D1 database | `clearsky-tools-db` (binding: DB) |
| R2 bucket | `clearsky-files` (binding: FILES) |
| CF Account ID | `ea8c23643f21195df3f364066cdf76dd` |
| Frontend repo | `C:\brand-presentations\repos\oga-tools\` |
| Frontend URL | `tools.oga.earth` (GitHub Pages) |
| Mirror repo | `C:\brand-presentations\repos\clearsky-site\` → `clearskyltd.com` |

### Backend B — LFA Personal Platform
| Component | Value |
|-----------|-------|
| Worker URL | `https://api-lfa.oga.earth` |
| CF Pages project | `lfa-tools` → `lfa.oga.earth` |
| Auth | JWT in `lfa_token` localStorage |
| Scope | Personal only — custody case, legal counsel, personal dashboard |

**These two backends are intentionally separate. Do NOT cross-wire them.**

---

## 8. TOOL INVENTORY

### Platform A — tools.oga.earth (Active Tools)

| File | Backend namespace | What it does |
|------|-----------------|-------------|
| `pablo.html` | /api/pablo/* | Carbon project pipeline OS — intake, process, flags, generate, knowledge library, Intel RAG |
| `wiki.html` | /api/wiki/*, /api/knowledge/* | Knowledge base — upload, browse, RAG ask |
| `miteco-dd.html` | /api/miteco-dd/* | Spain MITECO forest project DD — doc processing, AI verification ⚠️ hardcoded 'amoedo' |
| `presentations-v3.html` | /api/presentations/v2/*, /api/wiki/* | AI slide deck generation from PDDs |
| `revenue.html` | /api/revenue/*, /api/hubspot/* | Revenue tracking, HubSpot CRM, buyer intelligence |
| `rfp-screener.html` | /api/ey-rfp/*, /api/files/* | Inbound RFP screening vs EY/Abatable criteria |
| `goodcarbon.html` | /api/goodcarbon/*, /api/files/* | Inbound RFP screening vs Good Carbon Fund criteria |
| `onboarding.html` | /api/onboarding/* | Counterparty onboarding — NDAs, KYC, documents |
| `clearskyplatform.html` | /api/primitives/registry-index/* | API-fed Verra registry intelligence — 4,903 projects, VCU tab, filters, Watershed screener (46KB, replaces 774KB registry.html) |
| `registry.html` | (embedded data) | Legacy embedded-data registry browser — superseded by clearskyplatform.html |
| `projects.html` | /api/projects/*, /api/hubspot/* | Project status tracker + HubSpot activity |
| `linkedin.html` | /api/social/* | LinkedIn AI post generation, hooks, scheduling, publishing |
| `expense-report.html` | /api/expense/* | Receipt OCR → expense claim → Excel/PDF |
| `file-librarian.html` | /api/classify-files | AI file classifier — local files, no upload |
| `clearsky-tools-index.html` | none | Navigation landing page |
| `test.html` | /api/primitives/extract | Document AI extraction QA — 8 quality checks, garbage highlighting, use before re-ingest |
| `call-logger/index.html` | /api/hubspot/* | Mobile PWA — log calls/meetings to HubSpot |
| `rfp-tracker.html` | /api/primitives/rfp/* | RFP evaluation workspace — 3-column macOS layout, supply doc upload, AI per-criterion scoring |
| `crawler_test.html` | /api/primitives/crawler/* | Bulk intake hub — local upload, crawler runs, staging table, quality badges |
| `pablo-system.css` | (shared CSS) | macOS-inspired design system — CSS variables, 3-column layout, badges, criterion cards |

### Platform A — Legacy/Deprecated (DO NOT EDIT)
| File | Superseded by |
|------|--------------|
| `dashboard.html` | `dashboard-v3.html` |
| `dashboard-v3.html` | `pablo.html` pipeline view |
| `miteco.html` | `miteco-dd.html` |
| `presentations.html` | `presentations-v3.html` |
| `presentations-v2.html` | `presentations-v3.html` |

### Platform A — Orphaned (DO NOT EDIT, DO NOT DEPLOY)
- `C:\brand-presentations\repos\rfp-screener-v5-final.html`
- `C:\brand-presentations\repos\worker-v5-final.js`
- `C:\brand-presentations\social-agent-specs\LINKEDIN_DASHBOARD_V2.html`

### Platform B — lfa.oga.earth (Active Tools)
| URL | Backend namespace | What it does |
|-----|-----------------|-------------|
| `lfa.oga.earth/` | /api/stats, /api/activity | Personal dashboard |
| `lfa.oga.earth/counsel/` | /api/counsel/* (28 endpoints) | Legal case management — DD, milestones, Cuatrecasas coordination, AI doc generation. Tracks custody Proc 759/2025. |

---

## 9. SHARED DATA — PLATFORM A

### Knowledge cluster ← PRIMARY INTEGRATION HUB
| Table | Primary owner | Also writes | Also reads |
|-------|--------------|------------|-----------|
| `knowledge_docs` | wiki.html | pablo (library), rfp-screener*, goodcarbon* | pablo Intel tab, presentations-v3 |
| `knowledge_tags` | wiki.html | rfp-screener*, goodcarbon* | pablo, wiki |
| `knowledge_entities` | wiki.html | wiki | wiki |
| `knowledge_collections` | wiki.html | wiki | wiki |
| `knowledge_collection_docs` | wiki.html | wiki | wiki |

*auto-sync via promote endpoint

### PABLO cluster ✅ UNIVERSAL HUB (v52+v55+v56)
`pablo_projects`, `pablo_flags`, `pablo_deliverables`, `pablo_rules`, `pablo_extracts` — pablo.html primary. `projects` (rfp-screener, goodcarbon), `miteco_projects`, `miteco_documents` link via `pablo_project_id` FK. Selector dropdown in rfp-screener + goodcarbon. Links tab in pablo.html.
`workflow_runs`, `workflow_inputs`, `saved_workflows` — Workflow Engine (v55). Drop docs → detect intent → run analysis → auto-save to knowledge_docs.
`registries`, `document_roles`, `methodology_bundles`, `methodology_documents` — Methodology Library (v56). Registry + role reference data, methodology bundles group related knowledge_docs, `inferMethodologyMetadata()` AI classification engine. `pablo_projects.methodology_bundle_id` FK links projects to bundles. `knowledge_docs.ingest_source` tracks origin.

### MITECO cluster ⚠️ isolated + hardcoded
`miteco_documents`, `miteco_projects` — miteco-dd.html only. Hardcoded to project 'amoedo'. No `pablo_project_id`.

### RFP cluster ⚠️ parallel twins
`ey_rfp_projects`, `goodcarbon_projects`, `screenings`, `document_extracts`, `files` — rfp-screener + goodcarbon only. `screenings` table accumulates AI-scored projects with live BeZero/Sylvera/Calyx ratings — valuable dataset not yet surfaced.

### CRM / Revenue cluster
`hubspot_contacts`, `hubspot_companies`, `hubspot_deals`, `revenue_deals` — revenue.html primary. Also read by: projects.html, call-logger.
`counterparties` — onboarding.html + registry.html (read-only).

### HubSpot Inbox cluster (v57, upgraded v59a)
`hubspot_threads` — email thread metadata index. Fields: id (threadId), contact_id/name/email, company, company_name, subject, last_email_at, thread_date (YYYY-MM-DD for date range search), email_count, has_unread, thread_json (legacy, null for v59a+ threads), pablo_project_id (auto-matched), sender_email, sender_name, involves_luis (0/1), luis_role ('sender'|null), r2_key (hubspot/threads/{id}.json), hubspot_contact_id, sync_status.
`hubspot_tasks` — manual task tracking linked to threads. Fields: thread_id FK, task_text, counterparty, priority (critical/high/medium/low), horizon (today/week/waiting/parked), pablo_project_id, input_source (manual/ai_proposed), status (open/waiting/done/parked/deleted).
`hubspot_sync_state` — backfill progress tracking. Fields: id='primary', last_sync_offset, last_sync_timestamp, total_synced, backfill_complete (0/1), backfill_started_at, backfill_completed_at, notes.
Auth: uses existing `env.HUBSPOT_TOKEN` (Bearer token). HubSpot API base: `https://api.hubapi.com`. Cron: `0 2 * * *` (nightly incremental). Full thread content stored in R2 at `hubspot/threads/{id}.json` (1,128 threads as of 2026-03-12). D1 holds lean metadata only — no thread_json blob on v59a+ syncs (was causing SQLITE_TOOBIG on large HTML newsletters). Thread detail served from R2 with D1 fallback for pre-v59a data.

### Social cluster ⚠️ isolated
`social_posts`, `social_topics`, `social_brands` — linkedin.html only. Not connected to knowledge base.

### R2 Key Patterns
| Pattern | Used by |
|---------|---------|
| `knowledge/{owner}/{fileId}.{ext}` | wiki, pablo library |
| `pablo/{project_id}/intake/` | pablo |
| `pablo/{project_id}/deliverables/` | pablo |
| `hubspot/threads/{threadId}.json` | pablo HubSpot inbox |
| `ey-rfp/{project_id}/{fileId}.{ext}` | rfp-screener |
| `goodcarbon/{project_id}/{fileId}.{ext}` | goodcarbon |
| `miteco-dd/{project_id}/` | miteco-dd |

### localStorage / sessionStorage
| Tool | Key | Stores |
|------|-----|--------|
| revenue.html | `rcc_owner_id`, `rcc_owner_name`, `rcc_onboarding_dismissed` | HubSpot owner identity |
| onboarding.html | `onboardingData_v1` | Counterparty fallback |
| registry.html | `csl_registry`, `csl_onboarding` | Cross-tool sync with onboarding |
| wiki.html | `cs_token` | Auth token |
| presentations-v3.html | `cs3` (sessionStorage) | Session project state |
| call-logger | `clearsky_call_logger_pin` | PIN auth |
| lfa.oga.earth | `lfa_token` | LFA auth JWT |

---

## 10. SHARED ENDPOINT REFERENCE

### Knowledge (affects: wiki, pablo, presentations-v3, rfp-screener, goodcarbon)
```
GET    /api/wiki/docs?limit=&q=&tag=     → {docs:[], total}  ← includes tags per doc
GET    /api/knowledge/docs               → {docs:[]}          ← no tags
GET    /api/knowledge/docs/:id           → full doc + markdown + tags + entities
GET    /api/knowledge/tags               → {tags:[{tag_value, doc_count}]}
POST   /api/knowledge/ingest             → file, owner, uploaded_by, title (optional — preserves user title, AI enriches tags/summary)
POST   /api/wiki/upload-bulk             → FormData: files[] + owner
POST   /api/wiki/extract/:docId          → {word_count}
POST   /api/wiki/ask                     → {question, tags:string[], history, limit}
DELETE /api/wiki/docs/:id                → {ok}
POST   /api/knowledge/promote/:id        → promotes extract → knowledge_docs
POST   /api/knowledge/sync-projects      → bulk sync
```
⚠️ Tag format: `/api/wiki/ask` uses `tags: ["Puro.earth","TSB"]` (string array). `/api/wiki/docs` uses `?tag=string`.

### Files (affects: rfp-screener, goodcarbon — extend to pablo + miteco-dd)
```
POST   /api/files/upload                 → FormData: file, tool, project_id, uploaded_by
GET    /api/files/{tool}/{projectId}     → {files:[]}
GET    /api/files/download/{fileId}      → binary
DELETE /api/files/delete/{fileId}        → rfp-screener only
```

### HubSpot (affects: revenue, projects, call-logger, pablo pending)
```
GET    /api/hubspot/contacts/active|all
GET    /api/hubspot/companies/all
GET    /api/hubspot/deals/all
GET    /api/hubspot/owners
GET    /api/hubspot/sync
GET    /api/hubspot/activity/recent
GET    /api/hubspot/recent/:contactId
POST   /api/hubspot/contacts/search
POST   /api/hubspot/log-call
POST   /api/hubspot/log-meeting
```

---

## 11. DEPENDENCY MAP
*Change X → must update ALL of Y in the same session*

| Change | Must also update |
|--------|-----------------|
| `/api/wiki/ask` response | pablo.html (Intel), wiki.html |
| `/api/wiki/docs` response | pablo.html (library), wiki.html, presentations-v3.html |
| `/api/knowledge/ingest` fields | pablo.html (library upload), wiki.html |
| `knowledge_docs` schema | All knowledge endpoints + wiki + pablo + presentations-v3 + rfp-screener + goodcarbon + methodology_documents (via doc_id FK) |
| `/api/files/upload` | rfp-screener.html, goodcarbon.html |
| `/api/hubspot/*` | revenue.html, projects.html, call-logger |
| `pablo_projects` schema | pablo.html + any tool with pablo_project_id FK + methodology_bundles (via methodology_bundle_id) |
| RFP extraction prompt | rfp-screener.html AND goodcarbon.html (always update both) |
| ClearSky DOCX branding | pablo.html, rfp-screener.html, goodcarbon.html |
| `/api/onboarding/*` | onboarding.html AND registry.html |

---

## 12. INTEGRATION GAPS (build priority order)

### ✅ Gap 1 — Universal project ID (DONE v52)
**Resolved:** `pablo_project_id TEXT` FK added to `projects`, `miteco_documents`, `miteco_projects`. Selector dropdown in rfp-screener + goodcarbon. Links tab in pablo.html. `/selector` + `/linked` endpoints live.
**Remaining:** Backfill existing miteco_documents for amoedo → pablo_project_id='amoedo'. Wire presentations-v3 selector.

### ✅ Gap 2 — Unified extraction pipeline (DONE v54, hardened v58)
**Resolved:** `extractDocument(bytes, filename, contentType, env, mode)` — pure bytes→markdown function at global scope. Handles PDF (≤100pg base64, >100pg native+OCR), DOCX (native XML + base64 fallback), XLSX, PPTX, images, text. `extractDocumentContent()` is now a thin wrapper (R2 read → extractDocument → D1 save). `callClaudeRetry()` promoted to global scope. `enrichKnowledgeDocAI()` uses dynamic tags + `normalizeTagValue()`. PABLO intake/process wired to `extractDocument()`.
**v58 additions:** `mode` parameter (`'full'`/`'classify'`/`'preview'`) — `applyExtractionMode()` wraps all 10 return paths. `cleanPdfText()` Step 0 filters PDF internal garbage. `baseFilename()` strips ZIP subfolder paths. `extractForIngest()` confirmed deleted. Standing Rule #16 (EXTRACTION PIPELINE INTEGRITY) enforces one-function rule.
**Remaining:** None — pipeline is fully unified with explicit contracts.

### ✅ Gap 3 — Generalist workflow engine in PABLO (DONE v55)
**Resolved:** Workflow Engine — drop ZIP/file → auto-extract + classify (Haiku) → detect intent (Sonnet) → confirm → run analysis (Sonnet 16K + RAG) → auto-save to knowledge_docs. 7 endpoints, 3 D1 tables, 6 output formats. pablo.html Workflows section with drop zone, confirm card, progress bar, result viewer, history.
**Remaining:** Wire `buyer_criteria` table for structured criteria matching (currently uses RAG context). Retire standalone rfp-screener + goodcarbon tools.

### 🟠 Gap 4 — miteco-dd multi-project
**Problem:** Hardcoded to 'amoedo'. Bosquia and future MITECO projects blocked.
**Fix:** Remove hardcode. Project selector. Link to pablo_projects.

### 🟡 Gap 5 — presentations-v3 ↔ pablo_projects
**Problem:** presentations-v3 ingests its own PDDs. Doesn't see PABLO's processed projects.
**Fix:** Add pablo_projects as source in presentations-v3 project selector.

### 🟡 Gap 6 — Counterparty fragmentation
**Problem:** onboarding (own table) + revenue (HubSpot) + pablo (HubSpot pending) = 3 stores.
**Fix:** onboarding writes hubspot_id as FK. PABLO Step 4 closes for pablo.

### 🟢 Gap 7 — Knowledge → LinkedIn
**Problem:** linkedin.html topics entered manually. knowledge_docs has deep carbon content.
**Fix:** Topic suggestions from `/api/wiki/ask` — auto-generate post topics from knowledge base.

### 🟢 Gap 8 — Social → Knowledge feedback loop
**Fix:** Published LinkedIn posts auto-save to knowledge_docs tagged `doc_type: thought_leadership`.

---

## 13. PABLO REFERENCE

Full detail: `C:\brand-presentations\PABLO_CLAUDE.md`

### Active endpoints (v54+v56)
```
GET/POST  /api/pablo/projects
GET       /api/pablo/projects/selector          ← lightweight {id,name} for dropdowns
GET       /api/pablo/projects/:id
GET       /api/pablo/projects/:id/linked        ← linked rfp/goodcarbon/miteco
POST      /api/pablo/projects/:id/sync-knowledge ← promote extracts to knowledge library
GET       /api/pablo/projects/:id/flags
GET       /api/pablo/rules/puro
POST      /api/pablo/generate
GET       /api/pablo/deliverables/:projectId/:type
POST      /api/pablo/intake/upload
POST      /api/pablo/intake/process             ← uses extractDocument(), auto-syncs to knowledge
POST      /api/pablo/extract                    ← shared extraction pipeline
GET       /api/pablo/extracts/:projectId        ← list extracts
GET       /api/pablo/extracts/:projectId/:id    ← full extract with markdown
POST      /api/pablo/workflows/ingest           ← upload ZIP/file → extract → classify → intent detect
POST      /api/pablo/workflows/run              ← execute workflow → RAG + Sonnet → result + knowledge_docs
GET       /api/pablo/workflows/runs             ← list runs (?project_id=&limit=)
GET       /api/pablo/workflows/runs/:id         ← single run detail with inputs
GET       /api/pablo/workflows/runs/:id/result  ← raw result markdown
POST      /api/pablo/workflows/save             ← save run as reusable template
GET       /api/pablo/workflows/saved            ← list saved templates

# Methodology Library (v56)
GET       /api/registries                       ← list all registries
GET       /api/document-roles                   ← list all document roles
GET       /api/methodologies                    ← list methodology bundles (with doc counts, filters)
POST      /api/methodologies                    ← create methodology bundle
GET       /api/methodologies/:id                ← single bundle with linked documents
PUT       /api/methodologies/:id                ← update bundle metadata
POST      /api/methodologies/:id/ingest         ← ingest file into bundle → knowledge_docs + methodology_documents link
POST      /api/methodologies/ingest-auto        ← auto-ingest: upload file, inferMethodologyMetadata() classifies → bundle
GET       /api/methodologies/:id/export-context ← export bundle docs as combined context with prompt templates
POST      /api/admin/backfill-methodology-links ← one-time backfill: scan knowledge_docs → link to bundles

# RFP Tool (v75)
GET       /api/primitives/rfp/list                             ← list RFPs with project counts
GET       /api/primitives/rfp/:id                              ← RFP detail with criteria + projects
POST      /api/primitives/rfp/:id/project                      ← add project to RFP
POST      /api/primitives/rfp/:rfp_id/project/:pid/supply      ← upload supply doc (file→extract→knowledge_docs) or link existing
POST      /api/primitives/rfp/:rfp_id/project/:pid/evaluate    ← AI evaluation: Sonnet, per-criterion, verbatim text, fit_score 0-100
GET       /api/primitives/rfp/:rfp_id/project/:pid             ← project detail with supply docs + evaluation
```

### Projects
| id | name | registry | stage |
|----|------|----------|-------|
| marakoa | Proyecto Marakoa | puro | delivered |
| bosquia | Bosquia Asturias | puro | eligibility |
| naturebrain | NatureBrain Sierra Leone | verra | analysis |
| amoedo | Amoedo TSB | puro | review |
| elysium | Elysium Cerrado REDD+ | verra | intake |

### Pending
1. Step 3 — ForestEngineer job dispatch (PABLO_CLAUDE.md Appendix A)
2. Step 4 — HubSpot counterparty pull (PABLO_CLAUDE.md Appendix B)
3. Knowledge Library ZIP + PDF/TXT download fix (cc_library_fixes2.md — verify in browser)
4. MITECO-DD: binary text preview, calculadora Option 3, corrections view

---

## 14. WORKER SAFETY RULES

1. MITECO-DD = 36 endpoints — never touch when deploying PABLO-only changes
2. Always confirm version string after deploy: `curl https://api-tools.oga.earth/health`
3. worker.js section locations (approximate): MITECO ~1–2000 | Knowledge/wiki ~6000–6533 | PABLO ~7000+
4. Test sequence: health → `GET /api/pablo/projects` → spot check affected endpoint

---

## 15. IP / OWNERSHIP RULES

- All tools built on personal machine / personal Claude subscription
- Engines, pipelines, models = Luis personal IP
- Deliver ONLY final outputs (PDF/DOCX/XLSX) to ClearSky — never expose methodology, prompts, or worker code
- Never reference tools as "my model/system" in ClearSky channels — say "the analysis shows X"
- lfa.oga.earth = strictly personal, never share with ClearSky

---

## 16. REPO STRUCTURE

```
C:\brand-presentations\
├── infrastructure\clearsky-api\src\worker.js   ← MASTER WORKER (edit here)
├── repos\oga-tools\tools\*.html                ← EDIT TOOLS HERE
├── repos\clearsky-site\tools\*.html            ← SYNC FROM oga-tools (don't edit directly)
├── PABLO_CLAUDE.md                             ← PABLO master reference
├── SYSTEM.md                                   ← THIS FILE
└── CLAUDE.md                                   ← Claude Code memory (keep in sync with PABLO_CLAUDE.md)

C:\MITECO-ForestEngineer\
├── PABLO_CLAUDE.md                             ← MIRROR
└── SYSTEM.md                                   ← MIRROR
```

**MIRROR COMMAND — run after every update:**
```
copy "C:\brand-presentations\SYSTEM.md" "C:\MITECO-ForestEngineer\SYSTEM.md"
copy "C:\brand-presentations\PABLO_CLAUDE.md" "C:\MITECO-ForestEngineer\PABLO_CLAUDE.md"
```

---

## 17. SESSION HISTORY

| Date | What was built |
|------|---------------|
| 2026-01-xx | Infrastructure: Worker + D1 + R2, revenue.html, expense-report, call-logger, onboarding |
| 2026-02-xx | MITECO-DD v1–v36, wiki.html, presentations-v3, rfp-screener, goodcarbon, linkedin, registry |
| 2026-03-10 | PABLO v48–v50: projects, intake, process, generate, flags. 5 projects loaded. |
| 2026-03-11 | PABLO v51: Knowledge Library (upload+browse+ZIP), Intel RAG. Full platform audit. SYSTEM.md complete. |
| 2026-03-11 | v52: Universal project ID — pablo_project_id FK on projects/miteco_documents/miteco_projects, selector+linked endpoints, Links tab in pablo.html, PABLO dropdown in rfp-screener+goodcarbon, pablo_extracts table, shared extraction pipeline. |
| 2026-03-11 | v53: Knowledge sync — syncExtractsToKnowledge() auto-promotes pablo_extracts+miteco_documents to knowledge_docs, POST sync-knowledge endpoint, enrichKnowledgeDocAI now supports hints+registry tag type, cleaned 12 knowledge_docs (9 Aperam dupes + 3 corrupted), fixed clearsky001→clearsky owner, synced Amoedo (36 docs). |
| 2026-03-11 | v54: Unified extraction — extractDocument() pure bytes→markdown, callClaudeRetry() global, extractDocumentContent() thin wrapper, enrichKnowledgeDocAI dynamic tags + normalizeTagValue(), PABLO intake/process uses extractDocument(). |
| 2026-03-11 | v54b: 4 extraction fixes — verbatim prompts, ocrPdfMultiPage fixed, user title preserved in /api/knowledge/ingest, extraction_warning surfaced in response + pablo.html UI. |
| 2026-03-11 | v54c: Large PDF fix — extractDocument() size guard raised 10MB→19MB, POST /api/pablo/extract guard raised 10→19MB. Tested with 14.5MB Amoedo Ordenacion PDF → 1,330 words extracted. |
| 2026-03-11 | v54d: Verbatim extraction — removed Claude from PDF native/OCR paths (was destroying 90% content). Native text returns directly as pdf_native. OCR returns directly as pdf_ocr_haiku. Claude only called as last resort for truly unreadable ≤100pg PDFs (Sonnet, 16K tokens). Results: Remova FEED 871→31,486w, Ordenacion 1,330→22,033w. |
| 2026-03-11 | v54e: PDF filter + MITECO tags. (1) extractPdfText() skips font program streams (Type1C/CIDFontType0C/OpenType/TrueType/CMap). (2) cleanPdfText() post-filter: printable ratio, word-char ratio, hex/binary, CMap metadata, MIT license blocks, blank collapse. Remova FEED 31,486→5,779w (garbage removed). (3) enrichKnowledgeDocAI: miteco+isometric registries, Spanish forestry hint, user_tags hint. (4) /api/knowledge/ingest reads FormData tags, parses comma-separated, infers tag_type, inserts to D1. (5) pablo.html: tags input field, libFilter uses ?tag= with LIKE (case-insensitive), regColorFromTags handles normalized values. (6) wiki/docs ?tag= uses LOWER()+LIKE, fixed D1 ambiguous column (kd.created_at in JOIN ORDER BY). |
| 2026-03-11 | v54f: Broken-word join + ESRI/GIS truncation + permanent QA test suite. joinBrokenWords() for PDF column-layout word breaks. ESRI ArcMap metadata truncation with 1000-char guard. test-extraction.js: 72 assertions, 0 failures. QA Rules added to PABLO_CLAUDE.md §15. |
| 2026-03-11 | v55: Workflow Engine. 3 D1 tables (workflow_runs/inputs/saved_workflows), 7 endpoints under /api/pablo/workflows/*, Sonnet intent detection + 16K analysis + RAG context + knowledge_docs auto-save. pablo.html Workflows section with drop zone, confirm card, progress bar, result viewer, history. 6 output formats. Gap 3 resolved. |
| 2026-03-11 | v55b: Workflow UX. Animated ingest progress bar (4 steps), "Try Different Format" retry button (re-shows confirm card without re-upload), POST /api/pablo/workflows/promote-inputs (source docs → knowledge_docs with source_type='workflow_input'), Source Documents panel with "Add All to Knowledge Library". |
| 2026-03-11 | v55c: Knowledge Quality. D1: content_hash+doc_class on knowledge_docs. KB_ARCHETYPES (6 behavioral classes) + CLASSIFICATION_TO_ARCHETYPE mapping. SHA-256 dedup in enrichKnowledgeDoc/promote-inputs/workflow auto-save. enrichKnowledgeDocAI generates doc_subtype tag + doc_class. GET /api/knowledge/registries (dynamic registry list). wiki/ask RAG weighting by doc_class (canonical first, exclude correspondence+workflow_output). Dynamic registry filter in pablo.html + wiki.html. |
| 2026-03-11 | v55d: DOCX Extraction Fix. 3-layer DOCX extraction (extractDocx/extractDocxLayer2/extractDocxLayer3) replaces broken parseZipEntries-based approach. Added ODT+RTF support. Tag normalization backfill (200+ rows: Puro.earth→puro_earth, MITECO→miteco, Spain→spain, etc). 21 duplicate tags removed. 6 docs promoted to canonical_reference. |
| 2026-03-12 | v56: Methodology Library. 4 new D1 tables (registries, document_roles, methodology_bundles, methodology_documents). ALTERs: knowledge_docs.ingest_source, pablo_projects.methodology_bundle_id. inferMethodologyMetadata() AI classification engine (Haiku). 15 API endpoints: /api/methodologies/*, /api/registries, /api/document-roles, /api/admin/backfill-methodology-links. pablo.html Methodology tab with browse/ingest/quick-add modes, cascading 3-column filter browser, export context with prompt templates. Backfill linked 13 docs (193 skipped, 206 total scanned). |
| 2026-03-12 | v56-hotfix: (1) Standing Rules 14 (UI CONTRACT TEST) + 15 (SESSION FILE UPDATE) added to PABLO_CLAUDE.md. (2) CSS specificity fix — removed inline `style="display:flex"` on #v-methodology, added `.view.on#v-methodology` class rule (Standing Rule 12 violation). (3) Dirty bundle cleanup — deleted puro_earth_tsb (4 duplicate docs already in puro_tsb), deleted qa_test_* bundle, final state: 2 clean bundles (puro_tsb=13 docs, isometric_subsurface=0 docs). |
| 2026-03-12 | v56-debug: Root cause — Methodology Library was only a project tab (`.ptab`), not a sidebar nav item. Added `nav-methodology` to sidebar, wired `showPlatform('methodology')`, added loadMethodologyTab() init. Commit `e886a8b`. Standing Rules 16 (UI Reversion Prevention) + 17 (Frontend Visual QA Protocol) added. Discarded incomplete HubSpot Inbox scaffolding (65 lines, undefined functions) from working copy. |
| 2026-03-12 | v57: HubSpot Inbox. 2 new D1 tables (hubspot_threads, hubspot_tasks). 3 helper functions (stripHtml, groupEmailThreads, matchThreadProject). 7 new endpoints: GET /api/hubspot/inbox, GET /api/hubspot/thread/:id, POST /api/hubspot/sync-inbox, GET /api/hubspot/inbox-contacts, GET/POST/PUT/DELETE /api/hubspot/tasks. pablo.html: nav-hubspot sidebar tab, v-hubspot 3-column layout (thread list + thread detail + task panel), stats strip, search/filter, list/kanban task views. Uses existing env.HUBSPOT_TOKEN. All 8 QA assertions passed. Commit ebef20a. |
| 2026-03-12 | v56-methodology-clean-slate: Wiped corrupted puro_tsb data (13 truncated/mislinked docs from pre-v54d extractions). Deleted 5 duplicate ReGenerate Livermore Falls docs + 31 tags + 49 entities. Clean slate: puro_tsb=0 docs, isometric_subsurface=0 docs, 2 bundles intact. Extraction pipeline verified (63/64 tests pass). Ingest endpoint verified working at v57. Awaiting Luis re-ingest of 8 canonical files via Methodology Library UI. |
| 2026-03-12 | v57-hotfix + v57b: HubSpot inbox UX fixes. Hotfix: Mine/All toggle, CLEARSKY_CONTACTS display names, thread dedup. v57b: identity fix — LUIS_EMAILS corrected (canonical: luis.adaime@clearskyltd.com), isLuisEmail() function, "You" display uses sender identity not direction, thread list shows subject when contact is Luis. Commits 8d11107, 8e9b926. |
| 2026-03-12 | v57c: Worker + Frontend identity overhaul. LUIS_HUBSPOT_OWNER_ID=82916631 (not email matching). groupEmailThreads stores ownerId. hubspot_threads gains sender_email/sender_name/involves_luis/luis_role columns. 8/123 threads involve Luis. pablo.html: removed LUIS_EMAILS/isLuisEmail dead code, Mine filter uses involves_luis flag, email renderer uses ownerId. Commit c8322b5. |
| 2026-03-12 | v58: Extraction Architecture. extractDocument() gains mode param ('full'/'classify'/'preview'), applyExtractionMode() wraps all 10 return paths. cleanPdfText() Step 0 filters PDF internal garbage (RuleCounter, Hfootnote, cite.0@, glo:, Doc-Start). baseFilename() strips ZIP subfolder paths. Standing Rule #16 (EXTRACTION PIPELINE INTEGRITY). Wiped 4 corrupted puro_tsb docs. |
| 2026-03-12 | v59a: HubSpot Full Archive. R2-based email storage (hubspot/threads/{id}.json), D1 lean metadata index, cron 0 2 * * * nightly sync, POST /api/hubspot/backfill (resumable 250/batch), GET /api/hubspot/search (q/contact/company/from/to/mine), inbox now D1-only (14-day default), thread detail from R2. Backfill: 1,128 threads, 224 Luis, 2025-09-01 to 2026-03-12. hubspot_sync_state table. Standing Rule #24 (WORKER.JS EDIT INTEGRITY). |
| 2026-03-12 | v57d diagnostic: Mine Toggle Wiring audit — Scenario NONE, toggle chain already correct (hsToggleMine→hsFilterThreads→hsRenderThreadList). involves_luis returns as integer from API. Headless test passes all assertions. No code changes needed. |
| 2026-03-12 | v60: Document AI Integration. Google Document AI replaces Claude OCR as primary PDF extraction path. getGoogleAuthToken() JWT auth with 55min caching. extractWithDocumentAI() with 15-page chunking. POST /api/primitives/extract endpoint. extractDocument() PDF pipeline reordered — Document AI primary, native text fallback, Claude last resort. GCP project: oga-tools, processor: e67ba60df73bf041. New secrets: GOOGLE_DOCUMENT_AI_KEY, GOOGLE_DOCUMENT_AI_PROCESSOR. Health: v60-document-ai with docai flag. |
| 2026-03-12 | v60b: test.html — permanent extraction QA tool. 8 quality checks (method, word count, 4 garbage patterns: RuleCounter/CIDInit+TeX/Hfootnote/cite.0@, truncation, extraction success), garbage highlighting (red on pattern match), dark theme. Live at tools.oga.earth/tools/test.html. Use before every re-ingest. Frontend commit 883637c. |
| 2026-03-12 | v61: Byte-size-aware chunking. extractWithDocumentAIChunked() wrapper with adaptive pagesPerChunk based on bytes-per-page estimate. Chunk metadata (chunks_used, chunk_details[]) passed through extractDocument() and /api/primitives/extract response. DOCAI_SAFE_RAW_BYTES lowered 14MB→8MB. PDF size limit raised 19MB→200MB. countPdfPages() dedup via knownPageCount param. |
| 2026-03-12 | v62: Async extraction for large PDFs. Files >8MB → R2-staged async processing via ctx.waitUntil(). POST /api/primitives/extract returns {async:true, job_id} immediately. GET /api/primitives/jobs/:id polls status (queued/processing/complete/error). processExtractionJob() uses native-first strategy (CPU-cheap extractPdfText → Document AI 5-chunk cap → Claude OCR). D1 extraction_jobs table. fetch() signature gains ctx param. QA: 9MB/269-page PDF completed in <10s with 62,544 words (native). |
| 2026-03-12 | v62b: test.html async polling UI — progress bar with estimated time, auto-poll GET /api/primitives/jobs/:id every 5s, auto-render on completion, cancel button stops polling, normalizes async field names (text→markdown, extraction_method→method) for rendering. Frontend commit dc59ded. |
| 2026-03-12 | v63: Cloudflare Queues. Replaces ctx.waitUntil with proper Queue consumer — each extraction job gets own 15-min CPU clock. extraction-queue + extraction-dlq created. wrangler.toml gains queue producer/consumer bindings. processExtractionJob: 400K char cap removed (capTextByMode: full=2MB), 5-chunk async ceiling removed (all pages processed). batch_id column on extraction_jobs. New endpoints: POST /api/primitives/extract/batch (up to 60 files), GET /api/primitives/batch/:batchId. QA: 9MB/269p PDF → 82,877 words (527K chars, up from 62,544w/400K cap). |
| 2026-03-12 | v64: Primitive 3 — Document Taxonomy. 3-dimension controlled vocabulary (doc_type/registry/project) stored in D1 vocab tables (taxonomy_doc_types 13, taxonomy_registries 11, taxonomy_projects 8). New columns on knowledge_docs: registry, project, taxonomy_source. classifyTaxonomy() rule-based classifier (no API call). Manual override fix: formData doc_type/registry/project → hints → enrichKnowledgeDocAI. 6 endpoints: /api/primitives/taxonomy/{vocab,classify,assign,stats,search,backfill}. Backfill: 203 docs classified — amoedo(30), puro_tsb(20), miteco(11), verra(9). |
| 2026-03-12 | v65: Primitive 4 — Registry Crawler. crawl_runs/crawl_projects/crawl_documents tables. Verra VCS OData search (no auth). Puro.earth+Isometric stubs (awaiting API keys). 5 endpoints /api/primitives/crawler/*. Queue consumer crawl_run type. |
| 2026-03-12 | v66: is_canonical. D1: `is_canonical INTEGER DEFAULT 0` on knowledge_docs + index. 7 methodology_documents marked canonical. Worker: taxonomy/search ?canonical=1 filter + is_canonical in SELECT, taxonomy/assign accepts is_canonical, knowledge/ingest accepts is_canonical FormData. pablo.html: methodology browse fetches canonical=1 only (7 curated docs vs 205 total), ★ Library badge in detail panel, "Add to Methodology Library" checkbox in Knowledge Library ingest. |
| 2026-03-12 | v66b: Methodology Library browse groups by doc_type (not project). methRenderBundles() uses TYPE_ORDER + typeCounts. methLoadDetail() filters by doc_type. All 7 canonical docs assigned registry=puro_earth via /assign. METH.selBundle = doc_type string. Commit 9569a58. |
| 2026-03-13 | crawler_test.html: Bulk Intake Hub. Standalone page (tools/crawler_test.html). 3 tabs: Local Upload (drag-drop + extract API + async polling), Crawler Run (registry crawl + 4-stage pipeline viz), Past Runs (load history into staging). Staging table with quality badges, inline-edit taxonomy, preview drawer, batch commit. No worker changes. |
| 2026-03-13 | v67-crawler-fix: Worker crawlVerra() structured OData. buildVerraFilter(params) constructs filter string — country eq exact, contains(protocolSubCategories) for type, contains(resourceName) for query. No toLower() (Verra rejects). POST /api/primitives/crawler/run accepts top-level country/projectType/status/query. crawler_test v2: structured Verra fields (4-field grid), per-line color log, inline preview (500w + garbage highlight), auto project=registry_reference for methodology types. |
| 2026-03-13 | v68-registry-doctype: D1: registry_doc_type+version on knowledge_docs, registry_doc_type+document_role+version on crawl_documents, project_boundaries table. classifyVerraDoc() regex classifier (15 types by filename prefix). Wired into enrichKnowledgeDocAI + taxonomy/classify + taxonomy/assign + taxonomy/search + knowledge/ingest + fetchVerraDocuments INSERT + crawler/documents GET. PDF async threshold 8MB→1MB. POST /api/primitives/boundaries/store + GET /api/primitives/boundaries. crawler_test v3: 9 patches — registry_doc_type column, 6-state quality badges (pending/green/amber/red/error/skip/boundary), binary file auto-filter (KML→boundary, ZIP→skip), blob preservation (ArrayBuffer), FAILED+SKIPPED+BOUNDARY counters, clear staging, Verra project ID sublabel, doc type summary in log, version+document_role columns replace legacy doc_type/project. |
| 2026-03-13 | v69-crawler-pagination: Worker buildVerraFilter() input normalization — STATUS_MAP (lowercase→Title Case: registered→Registered, under_development→Under development), country Title Case normalization, REGISTRY_MAP (accepts verra_vcs/puro_earth aliases). classifyVerraDoc() extended from 15→25 patterns (10 project document types). crawler_test v5 (patches A-J): status select lowercase values, extractVersion() no default fallback, classifyVerraDocClient() extended, inferDocumentRole(), isGeographicFile()+isBinaryFile() split, crawler docs pending quality (no extraction attempt), crawler log summary with counts, bulk Delete Selected button. |
| 2026-03-13 | v70-scanned-pdf: Worker scanned PDF chunking + continuation queue. isLikelyScannedPdf() heuristic (bytes/page <50KB AND >30 pages). computePagesPerChunk() shared helper (15p text, 6p scanned, 4p scanned >300p, 20p ceiling). CHUNKS_PER_INVOCATION=15 with R2 staging (extractions/{jobId}/chunk_NNNN.txt), saveChunkResult()+assembleChunks() helpers. Queue consumer accepts {jobId, chunkOffset, isContinuation}. processExtractionJob rewritten with continuation support. extraction_jobs +total_chunks/completed_chunks/chunk_offset columns. jobs/:id returns progress_pct. Test: Seringueira PDD 536p/8.5MB → 6p/chunk → 90 chunks → 6 continuation hops. crawler_test v6: chunk progress bar, drop zone hint update, classifyVerraDoc geographic guard + Draft pattern, inferDocumentRole rewrite with Verra-specific roles, boundary files registry_doc_type='', multi-file upload confirmed. |
| 2026-03-13 | v71-extraction-stable: Worker hasBinaryGarbage() detection for Document AI binary output. isLikelyScannedPdf() now skips native text extraction entirely (was short-circuiting at 200 char threshold). Native text threshold proportional: max(200, pageCount*20) chars. _docAiRequest() accepts forceOcr param → ocrConfig.enableNativePdfParsing=false for scanned PDFs. All 3 DocAI paths (sync single, sync chunked, async queue) pass forceOcr=isScanned and filter hasBinaryGarbage. crawler_test.html: extractionStatus field on staging rows (extracting/polling/chunks/done/error), statusCell() shows extraction progress in Status column, addToStaging before extraction (immediate row), processSingleFile() replaces extractFile(), pollJobForStaging() replaces pollJob() with chunk progress, updateStagingRow() helper, assignQuality() guards active extraction rows, version v1.0. |
| 2026-03-13 | v72-mistral-ocr: (1) Multi-file upload fix — Array.from() snapshots FileList before async work (FileList is live DOM ref cleared by input.value=''). (2) Mistral OCR 3 as primary OCR — extractWithMistralOCR() sends base64 PDF to api.mistral.ai/v1/ocr, $0.002/page, ~30s for 536p. Routing: native text → Mistral OCR → Claude OCR fallback → Sonnet base64. (3) Document AI subsystem deleted — ~300 lines removed (getGoogleAuthToken, extractWithDocumentAI*, _docAiRequest, computePagesPerChunk, saveChunkResult, assembleChunks, all DOCAI_* constants). No more Google JWT auth or chunking continuation. (4) Cancel/Stop button — POST /api/primitives/jobs/:id/cancel + /requeue endpoints. Queue consumer skips cancelled jobs. Frontend red stop button during active extractions. Health: v72-mistral-ocr, mistral:true. |
| 2026-03-15 | v78-registry-platform: clearskyplatform.html — API-fed Verra registry intelligence. Replaces 774KB embedded-data registry.html with 46KB live-fetch version. Fetches 4,903 projects from GET /api/primitives/registry-index/search?limit=5000. Same 3-column dark UI: sidebar filters (status/region/methodology/AFOLU/category/volume), sortable paginated table, slide-out detail panel. Added VCU Intelligence tab (4 KPI cards, SVG sparkline bar chart 2019-2026, top buyer bars). Loading overlay + error handling. Fixed volume filter (S.volMin wired to oninput). No worker changes. Commit 3df4163. |
| 2026-03-15 | v78-registry-platform: D1 verra_registry_index (4903) + vcu_aggregates (2116). clearskyplatform.html API-fed. Worker endpoints: registry-index/import, vcu/import-aggregates, registry-index/search. |
| 2026-03-15 | v79a-ux-fixes | clearskyplatform.html UX: Download PD (crawler/run + pdd-status polling), Watershed inline filter, methodology dropdown labels+count, country search, AFOLU removed |
| 2026-03-15 | v79b-ux-rebuild | clearskyplatform.html full UX rewrite (840 lines, 49KB). Worker: pdd-status endpoint added (worker-v79b.js). New: category pills (CAT_MAP OR logic), Verra-style meth dropdown (36 METH_LABELS), status strip with counts, VCU column in table, Credit History panel tab (retRing SVG + sparkline + top buyers), DL_STEPS download flow (5 plain-English steps), IS_EXTERNAL mode, Watershed inline with banner. Language: no PABLO/Knowledge Library/crawler in user text. Commit cf28c91. |
| 2026-03-15 | v79b-fix | Worker: (1) project_id field in buildVerraFilter does `resourceIdentifier eq N` for exact ID lookup (query only does name search). (2) Auto-extract first PD after crawl when pd_only=true — creates knowledge_doc inline, pdd-status returns 'complete' immediately. (3) clearskyplatform.html: startDownload uses project_id + correct field names (max_projects, download_documents, pd_only). Tested: VCS 934 → complete, 23K words extracted. Commit c686282. |
| 2026-03-15 | v79c-fixes | Category pills deriveCat (project_category='ALL' workaround), download flow no pablo.html (crawler/download endpoint + corsHeaders fix), RFP pre-populate, is_registered_example in auto-extract. Gotchas 68-70. |
