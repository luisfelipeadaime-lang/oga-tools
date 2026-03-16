# PABLO — CLAUDE.md
## Master Reference Document · Updated 2026-03-16 (v79n)

**PABLO** = Project Agent for Biomass & Land-based Operations  
**Purpose:** Registry-agnostic, methodology-agnostic, end-to-end carbon project development platform  
**Operator:** Luis Felipe Adaime (CCO, ClearSky Limited) — personal infrastructure, personal Claude account  
**Tagline:** Automated developer. For me. Not a product.

---

---
CLEARSKY_PROJECTS: verra_registry_index.clearsky_project=1 for ClearSky portfolio.
Current IDs: 4883, 2985, 1396, 3701, 844, 2496, 985, 1566, 4190, 3298.
Update: `npx wrangler d1 execute clearsky-tools-db --remote --command="UPDATE verra_registry_index SET clearsky_project=1 WHERE id IN ('...')"`

---
STANDING RULE #1 — SEARCH BEFORE BUILDING
Before proposing any technical solution, search for existing free/open-source tools.
Sequence: (1) web_search existing solutions, (2) evaluate fit, (3) custom build ONLY if
nothing adequate exists. Proven: Tailscale+tmux+SSH for mobile terminal, Chart.js for
dashboards, Cloudflare Workers for edge. Estimated savings: 2-3 sessions/month.
---

## 1. IDENTITY & VISION

PABLO is the unified shell that absorbs all existing tools:
- **MITECO-DD** → becomes PABLO's Spain/MITECO registry module (not a separate tool)
- **ForestEngineer** → becomes PABLO's GIS/analysis agent, dispatched from PABLO's Agents tab
- **Brand-Presentations (BP)** → becomes PABLO's document/presentation generator
- **Revenue/HubSpot** → HubSpot intel auto-pulled per project when workspace opens
- **Knowledge Library/Wiki** → ambient context layer, filtered per registry/methodology. Upload via POST /api/knowledge/ingest, browse via GET /api/wiki/docs, RAG via POST /api/wiki/ask. No separate pablo_library table — uses existing knowledge_docs + knowledge_tags.
- **All tools.oga.earth tools** → accessible from PABLO as platform modules

Design philosophy:
1. Project is the unit of work — everything else is a service to the project
2. One active layer at a time — no panels over panels, no modals on modals
3. Agent bar always visible (ForestEngineer, HubSpot, AI Engine)
4. System thinks out loud — live dispatch narratives, not spinners
5. Deliverables are earned — each shows exactly why it is/isn't available yet
6. Knowledge Library is ambient — surfaces inline in flags, not a separate destination

---

## 2. INFRASTRUCTURE (CONFIRMED STATE)

### Repos
| Repo | Location | Status | Notes |
|------|----------|--------|-------|
| `repos/clearsky-site/` | Local | OUTDATED | miteco-dd.html here is v29 — do not use |
| `repos/oga-tools/` | Local → GitHub | PRODUCTION | CNAME → `tools.oga.earth` · Auto-deploys on git push |

### Cloudflare
| Resource | Name/ID | Binding |
|----------|---------|---------|
| Worker | `clearsky-api` | — |
| Worker URL | `https://api-tools.oga.earth` | — |
| D1 Database | `clearsky-tools-db` | `DB` |
| R2 Bucket | `clearsky-files` | `FILES` |
| Cloudflare Account ID | `ea8c23643f21195df3f364066cdf76dd` | — |
| Pages deployment | `tools.oga.earth` | Auto via GitHub |

### Deploy commands
```bash
# Deploy Worker (always from Terminal BP)
cd C:\brand-presentations\infrastructure\clearsky-api
npx wrangler deploy

# Check Worker health
curl https://api-tools.oga.earth/health

# Deploy frontend (auto on push)
cd repos/oga-tools
git add . && git commit -m "feat: ..." && git push
```

### Two terminals — ALWAYS
- **Terminal BP** = `C:\brand-presentations\` → Worker + frontend builds
- **Terminal FE** = `C:\MITECO-ForestEngineer\` → GIS agent only (QGIS/Python local)

### Hard rules
- NEVER create `functions/` folder in oga-tools repo (breaks Cloudflare Pages)
- NEVER use React in production HTML (plain JS only)
- NEVER touch existing Worker endpoints without reading worker.js first
- NEVER commit secrets to git
- NEVER send ZIP to Worker directly — use R2-first architecture (upload-chunk → from-r2)
- Worker body limit: 100MB hard cap (Cloudflare)
- Worker CPU limit: ~50ms synchronous — AI passes must be async/chunked

---

════════════════════════════════════════════
SYSTEM.MD IS THE API CONTRACT — READ IT FIRST
════════════════════════════════════════════
Before writing any code, read SYSTEM.md for:
- Canonical functions (Section 1) — use these, never duplicate
- Canonical constants (Section 2) — never redeclare
- D1 field semantics (Section 3) — know what fields mean
- Integration gotchas (Section 4) — known traps per system
- Consumer map (Section 5) — who reads what you're changing
- Research-first rule (Section 6) — inspect before building

If about to create a new function: check Section 1 first.
If it already exists: extend it. Never create a parallel version.

---

## 3. WORKER STATE

### Current version: v78-registry-platform
Worker file: `C:\brand-presentations\infrastructure\clearsky-api\src\worker.js`
Snapshots: `worker-v48.js` through `worker-v79b.js` in `infrastructure/`

#### v79b-ux-rebuild (2026-03-15) — clearskyplatform.html full UX rewrite + Worker pdd-status endpoint
- **Complete rewrite:** 840-line file (49KB) replaces previous 50KB version. New CSS design system, new body HTML, new script.
- **Worker patch:** added GET /api/primitives/registry-index/project/:id/pdd-status endpoint. Queries crawl_runs JOIN crawl_projects (crawl_run_id, registry_project_id) JOIN crawl_documents. Returns status: not_started|crawling|extracting|complete|error + knowledge_doc_id. Worker snapshot: worker-v79b.js.
- **Category pills:** Nature (AFOLU+Livestock), Energy (Energy+Energy Demand+Mining+Chemical+Manufacturing), Waste, Transport, Removals (CCS). CAT_MAP with OR logic.
- **Methodology dropdown:** Verra-style position:absolute dropdown with code (teal mono) + METH_LABELS (36 entries) + project count. Multi-select with chips. Document click listener to close.
- **Status strip:** Registered/Under Validation/Under Development/All with live counts from data.
- **VCU column in table:** vcu-badge with fmtV() + retirement % below.
- **Panel tabs:** Overview + Credit History. Retirement rate SVG ring (retRing). Sparkline div-based bars (2019-2026). Top buyer bar chart.
- **Download flow:** DL_STEPS array with plain-English progress (5 steps, 2s each). POST /crawler/run → pollDlStatus every 5s → finishDl. "Get Project Document" → "Open Document" on complete.
- **Watershed 2026:** inline filter with teal banner. 15 eligible methodologies in WATERSHED set.
- **IS_EXTERNAL mode:** ?mode=external hides "Get Project Document" button and RFP Tracker CTA.
- **Language rules:** No "PABLO", No "Knowledge Library", No "crawler/crawling" in user-visible text. Uses "ClearSky document library", "Credit History", "Get Project Document", "Open Document".
- **Frontend commit:** cf28c91. **Worker snapshot:** worker-v79b.js.

#### v79a-ux-fixes (2026-03-15) — clearskyplatform.html UX improvements (frontend only, superseded by v79b)
- **Download PD:** renamed from "Crawl PDD", wired to POST /crawler/run with pdOnly:true, polls GET /registry-index/project/:id/pdd-status every 5s (max 3min), button states: loading→crawling→extracting→done. Done state links to pablo.html?tab=knowledge&project_id={id}. Button id="pdd-btn-{project_id}".
- **Watershed button:** now filters inline (S.watershedMode toggle), button text shortened to "Watershed 2026", removed any external navigation.
- **Methodology dropdown:** onMethSearch shows code + METH_LABELS plain English label + filtered project count per methodology. Also searches label text.
- **Country search:** new text input above Region filter, filters ALL by country name (case-insensitive substring match). State: S.country. Cleared in resetFilters() and toggleWatershed().
- **AFOLU Activity:** removed from sidebar entirely (afoluList, toggleAfolu, S.afolus all deleted). AFOLU data still shown in detail panel per-project.
- **Health:** v78-registry-platform (no Worker change). **Frontend commit:** 5a7569d.

#### v78-registry-platform (2026-03-15) — D1 registry + clearskyplatform.html
- **D1 tables:** `verra_registry_index` (4,903 rows from verra_all_projects.csv, all Verra VCS project types), `vcu_aggregates` (2,116 rows, pre-aggregated from 317K-row VCU ledger, seeded from vcu_aggregates_seed.json)
- **Worker endpoints:** POST /api/primitives/registry-index/import (CSV upsert, quote-aware parser), POST /api/primitives/vcu/import-aggregates (JSON aggregates batch upsert), GET /api/primitives/registry-index/search (LEFT JOIN vcu_aggregates, returns all 4,903 projects, VCU data null for unissued projects)
- **clearskyplatform.html:** API-fed registry browser. `loadData()` fetches all 4,903 rows, maps `r.methodology`→`meth`, `r.est_annual_reductions`→`vol`, `r.project_category`→`cat`. VCU object built from rows where `vcu_total_issued` is not null (2,116 projects). Same UX/design as registry.html. No embedded data — thin client only. `IS_EXTERNAL` flag: `?mode=external` hides internal CTAs.
- **registry.html:** unchanged, standalone with embedded data, reference UX. Superseded by clearskyplatform.html.
- **Health:** v78-registry-platform. **Snapshot:** worker-v78.js.
- **File:** `repos/oga-tools/tools/clearskyplatform.html` (46KB, commit 33a070e)

#### registry.html v2 (2026-03-14) — frontend only, no worker changes (LEGACY — use clearskyplatform.html)
- **Replaced** onboarding/counterparty tracker with Verra VCS registry browser
- **Data:** 4,903 VCS projects from Verra OData API + VCU transaction data from 173,923 ledger rows (565 projects)
- **Market totals:** 619.6M VCUs issued, 430.2M retired, 189.4M outstanding
- **UI:** dark theme (crawler_test.html tokens), status tabs, methodology/country filters, VCU-only toggle, search, sortable columns, pagination (100/page)
- **Detail panel:** slide-out with Overview + VCU Intelligence tabs
- **VCU Intelligence:** 4 KPI cards (issued, retired, retirement rate, vintage 2022+%), issuance sparkline (2019-2026), SVG retirement rate ring, top 3 buyer bar chart
- **Build pipeline:** `aggregate_vcus.py` (CSV→JS) + `fetch_verra_projects.py` (API→JS) + `build_registry_html.py` (assembler)
- **File:** `repos/oga-tools/tools/registry.html` (774KB, commit f598d6f)
- **Superseded by:** clearskyplatform.html (API-fed, 46KB)

#### v57 changes (2026-03-12):
- **HubSpot Inbox** — read-only email thread viewer inside PABLO
- **D1 tables:** `hubspot_threads` (email thread cache), `hubspot_tasks` (manual task tracking)
- **Helper functions:** `stripHtml()`, `groupEmailThreads()` (v1 engagements → thread grouping), `matchThreadProject()` (keyword overlap matching)
- **7 new endpoints:**
  - `GET /api/hubspot/inbox` — fetch + cache recent email threads from HubSpot v1 API
  - `GET /api/hubspot/thread/:id` — full thread detail (D1 cache with 10min TTL)
  - `POST /api/hubspot/sync-inbox` — full sync (200 engagements, upsert all threads)
  - `GET /api/hubspot/inbox-contacts` — distinct contacts from cached threads
  - `GET /api/hubspot/tasks` — list tasks (ordered by horizon → priority)
  - `POST /api/hubspot/tasks` — create task
  - `PUT /api/hubspot/tasks/:id` — update task fields
  - `DELETE /api/hubspot/tasks/:id` — soft delete (status='deleted')
- **pablo.html:** HubSpot nav tab with 3-column layout (thread list 280px, thread detail flex, task panel 300px), stats strip, search/filter, list/kanban task views
- Uses existing `env.HUBSPOT_TOKEN` secret (same as revenue command center)

#### v57c changes (2026-03-12):
- **Owner ID identity:** `LUIS_HUBSPOT_OWNER_ID = 82916631` — canonical HubSpot identity constant
- **groupEmailThreads:** now stores `ownerId` on each email object from `engagement.ownerId`
- **extractThreadParticipants:** uses `Number(e.ownerId) === LUIS_HUBSPOT_OWNER_ID` (not email scan)
- **hubspot_threads columns added:** `sender_email`, `sender_name`, `involves_luis` (INTEGER 0/1), `luis_role` (TEXT)
- **pablo.html:** removed `LUIS_EMAILS` array + `isLuisEmail()` (dead code), `isLuisThread()` uses `involves_luis` flag, email renderer uses `ownerId === 82916631`

#### v59a changes (2026-03-12):
- **HubSpot Full Archive** — R2-based email thread storage for complete CRM history
- **`archiveThreadToR2(threadId, threadData, env)`** — stores full thread JSON to `hubspot/threads/{id}.json` in R2
- **`getThreadFromR2(threadId, env)`** — fetches thread content from R2
- **`syncHubSpotBatch(env, offset, limit)`** — paginated HubSpot engagement sync: fetches one batch, groups into threads, archives to R2, stores lean metadata in D1 (no thread_json blob)
- **Cron Trigger** — `0 2 * * *` (nightly 2am UTC incremental sync). `async scheduled()` handler added to worker export.
- **D1 changes:** `hubspot_threads` gains `company_name`, `thread_date`, `r2_key`, `sync_status`, `hubspot_contact_id` columns. New `hubspot_sync_state` table tracks backfill progress.
- **New endpoints:**
  - `POST /api/hubspot/backfill` — resumable historical archive (250 engagements/batch, tracks offset in sync_state)
  - `GET /api/hubspot/search?q=&contact=&company=&from=&to=&mine=&limit=` — D1 metadata search (fast, no R2)
  - `GET /api/hubspot/backfill-status` — current sync state + thread count
- **Updated endpoints:**
  - `GET /api/hubspot/inbox` — now D1-only (no HubSpot API call), default 14-day window, supports `?days=&mine=` params
  - `GET /api/hubspot/thread/:id` — fetches full content from R2, falls back to D1 thread_json for pre-v59a threads
  - `POST /api/hubspot/sync-inbox` — uses `syncHubSpotBatch()` (5 batches, archives to R2)
- **Backfill results:** 1,128 unique threads, 224 involve Luis, earliest 2025-09-01, latest 2026-03-12. D1 stays lean (no thread_json blob on new syncs), R2 holds full email content.

#### v60 changes (2026-03-12):
- **Google Document AI integration** — replaces Claude-based PDF OCR as primary extraction path for ALL PDFs.
- **`getGoogleAuthToken(env)`** — generates JWT from service account key, exchanges for OAuth2 access token. Caches token for 55 minutes (tokens valid 60 min). Uses `GOOGLE_DOCUMENT_AI_KEY` secret (full service account JSON).
- **`extractWithDocumentAI(bytes, env)`** — sends PDF bytes to Document AI OCR processor with 15-page chunking via `individualPageSelector`. Reassembles per-page text into single markdown document. Returns `{markdown, word_count, method: 'document_ai', pages_processed}`.
- **`_docAiRequest(base64Chunk, pageIndices, accessToken, env)`** — internal helper for single Document AI API call. Handles error responses and page-level text assembly.
- **New endpoint: `POST /api/primitives/extract`** — standalone extraction endpoint accepting raw file bytes. Returns extracted text without DB storage.
- **Modified: `extractDocument()` PDF pipeline reordered** — Document AI is now primary path for ALL PDFs (not just scanned). 15-page chunking handles large documents. Native `extractPdfText()` is fallback only when Document AI is unavailable or fails. Claude OCR is last resort.
- **New secrets:** `GOOGLE_DOCUMENT_AI_KEY` (GCP service account JSON), `GOOGLE_DOCUMENT_AI_PROCESSOR` (processor resource name).
- **Health version:** `v60-document-ai` with `docai: true` flag in health response.

#### v69 changes (2026-03-13):
- **buildVerraFilter() input normalization** — STATUS_MAP normalizes lowercase status values (`"registered"` → `"Registered"`, `"under_development"` → `"Under development"`). Country inputs normalized to Title Case (e.g. `"brazil"` → `"Brazil"`). REGISTRY_MAP accepts aliases `"verra_vcs"` and `"puro_earth"` alongside standard registry names.
- **classifyVerraDoc() extended** — added 10 project document patterns (project description, monitoring report, verification report, registration request, issuance request, project design document, etc.) beyond original 15 methodology/program patterns. Total: 25 patterns.
- **crawler_test.html v5 (patches A-J):**
  - A: Status `<select>` uses lowercase values — worker normalizes via STATUS_MAP
  - B: `extractVersion()` returns empty string when no version found (no default fallback)
  - C: `classifyVerraDocClient()` extended with same 10 project document patterns
  - D: `inferDocumentRole()` — maps registry_doc_type → document_role client-side
  - E: `isGeographicFile()` + `isBinaryFile()` — split into extension-only checks
  - F: Crawler docs get `pending` quality status (no extraction attempted, `_extractionAttempted` removed)
  - G: Crawler log summary shows project/document/boundary counts
  - H: "Delete Selected" bulk delete button for staging cleanup
  - I-J: reserved

#### v70 changes (2026-03-13):
- **Scanned PDF detection: `isLikelyScannedPdf(fileSizeBytes, pageCount)`** — heuristic: compressed bytes/page < 50KB AND pages > 30. Scanned PDFs have misleading compression ratios; chunker must not trust compressed size.
- **Adaptive chunk sizing constants** — `CHUNK_PAGES_TEXT=15` (native text PDFs), `CHUNK_PAGES_SCANNED=6` (scanned), `CHUNK_PAGES_SCANNED_LARGE=4` (scanned >300 pages). Hard ceiling: 20 pages max regardless.
- **`computePagesPerChunk(fileSize, totalPages)`** — shared helper used by both `extractWithDocumentAIChunked` (sync) and `processExtractionJob` (async queue). Single source of truth for chunk sizing.
- **Continuation queue** — `CHUNKS_PER_INVOCATION=15`, process max 15 chunks per queue invocation. R2 staging at `extractions/{jobId}/chunk_NNNN.txt`. `saveChunkResult()` writes chunk to R2, `assembleChunks()` reads all in order + concatenates. Chunks cleaned from R2 after assembly. Pattern supports unlimited document size.
- **Queue consumer updated** — accepts `{ jobId, chunkOffset, isContinuation }` messages. Routes to `processExtractionJob(jobId, env, chunkOffset)`.
- **`processExtractionJob(jobId, env, chunkOffset)` rewritten** — first invocation tries native text. Document AI path: computes chunk plan, processes `CHUNKS_PER_INVOCATION` chunks, saves to R2, enqueues continuation if more remain, assembles on completion.
- **D1 schema:** `extraction_jobs` gains `total_chunks`, `completed_chunks`, `chunk_offset` columns.
- **API:** `GET /api/primitives/jobs/:id` returns `total_chunks`, `completed_chunks`, `progress_pct`.
- **Health version:** `v70-scanned-pdf`.
- **Test case:** Seringueira PDD — 536p, 8.5MB compressed, ~16KB/page → old chunker would send 252p/chunk (~252MB to DocAI). Fixed to 6p/chunk → 90 chunks → 6 continuation hops.
- **crawler_test.html v6:**
  - Chunk progress bar in upload status column — "done/total chunks" with animated teal fill bar in `pollJob()`
  - Drop zone hint updated for scanned PDF awareness
  - `classifyVerraDoc()` geographic extension early-return guard (BOUNDARY_EXTS/SKIP_EXTS → return null)
  - Draft pattern added: `^draft[-_\s]` → project_description
  - `inferDocumentRole()` rewritten with Verra-specific roles: boundary_file, project_description, listing_representation, legal_agreement, monitoring_report, validation_report, verification_report, public_commentary, risk_assessment, issuance_document
  - Boundary files: `registry_doc_type=''` (blank, not false-positive classification)
  - Multi-file upload confirmed working (multiple attribute + for...of loop)

#### v71 changes (2026-03-13):
- **`hasBinaryGarbage()` detection** — new function detects binary garbage in Document AI output. Filters out responses where Document AI returns raw binary data instead of text.
- **`isLikelyScannedPdf()` updated** — now skips native text extraction entirely for scanned PDFs (previously short-circuited with 200 char threshold). Scanned PDFs go straight to Document AI.
- **Native text threshold now proportional** — `max(200, pageCount * 20)` chars instead of flat 200. Large text-heavy PDFs no longer falsely classified as "insufficient native text".
- **`_docAiRequest()` accepts `forceOcr` parameter** — when true, sets `ocrConfig.enableNativePdfParsing=false` in Document AI request. Forces OCR mode for scanned PDFs (Document AI's native parsing returns garbage for scans).
- **All 3 Document AI paths updated** — sync single (`extractWithDocumentAI`), sync chunked (`extractWithDocumentAIChunked`), and async queue (`processExtractionJob`) all pass `forceOcr=isScanned` and filter output through `hasBinaryGarbage()`.
- **Health version:** `v71-extraction-stable`.
- **crawler_test.html updates:**
  - `extractionStatus` field on staging rows (`extracting`|`polling`|`chunks`|`done`|`error`)
  - `statusCell()` function shows extraction progress in Status column (replaces raw commitLabel during extraction)
  - `addToStaging` called BEFORE extraction starts (row appears immediately with "extracting..." status)
  - `processSingleFile()` replaces `extractFile()` — updates staging row status as extraction progresses
  - `pollJobForStaging()` replaces `pollJob()` — updates staging row with chunk progress (e.g. "3/134 chunks")
  - `updateStagingRow(idx, updates)` helper for live row updates
  - `assignQuality()` guards rows with active `extractionStatus` as 'pending'
  - Version placeholder changed from "v2.0" to "v1.0"

#### v64 changes (2026-03-12):
- **Primitive 3: Document Taxonomy** — three-dimension controlled vocabulary for all knowledge_docs.
- **3 D1 vocab tables:** `taxonomy_doc_types` (13 values), `taxonomy_registries` (11 values), `taxonomy_projects` (8 values). Extensible via INSERT.
- **3 new columns on knowledge_docs:** `registry` (default 'unspecified'), `project` (default 'unassociated'), `taxonomy_source` ('manual' | 'auto' | 'ai').
- **`classifyTaxonomy(filename, textSnippet)`** — rule-based, no API call. Returns `{doc_type, registry, project}`. Runs on filename + first 2000 chars.
- **Manual override fix** — `formData.get('doc_type')` / `formData.get('registry')` / `formData.get('project')` checked BEFORE any classification in `/api/knowledge/ingest` and `/api/methodologies/:id/ingest`. `hints.user_document_type`, `hints.user_registry`, `hints.user_project` flow through `enrichKnowledgeDocAI`.
- **`enrichKnowledgeDocAI` extended** — runs `classifyTaxonomy()` on title+text, sets registry/project/taxonomy_source. Manual hints override auto-classification.
- **6 new endpoints under `/api/primitives/taxonomy/`:**
  - `GET /vocab` — returns all controlled vocabulary (doc_types, registries, projects)
  - `POST /classify` — rule-based classify without ingesting (body: filename, text)
  - `PATCH /assign` — manually assign doc_type/registry/project to existing doc
  - `GET /stats` — counts by all three dimensions
  - `GET /search` — filter docs by doc_type, registry, project, q
  - `POST /backfill` — one-time classify all existing docs via rule engine (batched)
- **Backfill result:** 203 docs classified. Projects: amoedo(30), registry_reference(25), puro_tsb(20), marakoa(5). Registries: miteco(11), verra_vcs(9), puro_earth(7).
- **Health version:** `v64-taxonomy`.

#### v63 changes (2026-03-12):
- **Cloudflare Queues** — replaces `ctx.waitUntil` for async extraction. Each queue message gets its own Worker invocation with fresh 15-minute CPU clock. Eliminates 1102 CPU timeouts permanently.
- **Queue bindings in wrangler.toml** — `EXTRACTION_QUEUE` (producer+consumer for `extraction-queue`), `EXTRACTION_DLQ` (dead-letter queue for failed jobs). `max_batch_size=1`, `max_retries=2`.
- **`async queue(batch, env)`** — new handler in worker exports. Processes one extraction job per message. Acks on success, retries on failure → DLQ after 2 retries.
- **400K char cap removed** — `processExtractionJob` no longer truncates text at 400,000 chars. Uses `capTextByMode(text, mode)`: full=2MB, classify=50K, preview=5K.
- **5-chunk async ceiling removed** — Document AI processes ALL pages in async mode (queue has own CPU budget). No `maxAsyncChunks` limit.
- **`batch_id` column** on `extraction_jobs` table — groups multi-file batch uploads.
- **`createExtractionJob(db, jobId, filename, r2Key, tenant, mode, batchId)`** — gains `batchId` parameter.
- **New endpoint: `POST /api/primitives/extract/batch`** — accepts up to 60 files (`file_0`...`file_59`). Returns `{batch_id, jobs[], batch_poll_url}`.
- **New endpoint: `GET /api/primitives/batch/:batchId`** — aggregate batch status: total/complete/errored/pending counts + per-job status.
- **Fallback: `ctx.waitUntil`** — if `env.EXTRACTION_QUEUE` not bound (dev/preview), falls back to ctx.waitUntil for backwards compatibility.
- **Health version:** `v63-queues` with `queues: true` flag.
- **QA result:** 9MB/269-page PDF → 82,877 words (vs 62,544 with old 400K cap). Batch endpoint: 2 files queued and processed correctly.

#### v62 changes (2026-03-12):
- **Async extraction for large PDFs** — files >8MB → R2-staged async processing via `ctx.waitUntil`. Responds immediately with `{async: true, job_id}`. Client polls `GET /api/primitives/jobs/:id` until status=complete.
- **`createExtractionJob(db, jobId, filename, r2Key, tenant, mode)`** — creates job record in D1 `extraction_jobs` table.
- **`processExtractionJob(jobId, env)`** — background processor: fetches from R2, tries native text extraction first (CPU-cheap), falls back to Document AI with 5-chunk cap, then Claude OCR. Native-first strategy avoids CPU exhaustion on large/many-page PDFs.
- **`ensureExtractionJobsTable(db)`** — idempotent table creation.
- **New D1 table: `extraction_jobs`** — id, filename, r2_key, tenant, mode, status (queued/processing/complete/error), created_at, completed_at, result_r2_key, word_count, char_count, page_count, chunks_used, extraction_method, error.
- **New endpoint: `GET /api/primitives/jobs/:id`** — poll job status. `?text=1` (default) includes full extracted text from R2. `?text=0` returns metadata only.
- **Modified: `POST /api/primitives/extract`** — now returns `{async: false, ...}` for sync results, `{async: true, job_id, poll_url}` for async. Includes `processing_ms` for sync path.
- **`DOCAI_SAFE_RAW_BYTES` lowered** from 14MB to 8MB — ensures single Document AI calls complete within Worker timeout.
- **PDF size limit raised** from 19MB to 200MB for PDFs (non-PDFs remain 19MB).
- **`fetch(request, env, ctx)` signature** — added `ctx` parameter for `waitUntil` access.
- **Health version:** `v62-async-extraction`.

#### v61 changes (2026-03-12):
- **`extractWithDocumentAIChunked(bytes, env, knownPageCount)`** — byte-size-aware wrapper around `extractWithDocumentAI`. Computes adaptive `pagesPerChunk` based on bytes-per-page estimate. Returns `chunks_used`, `chunk_details` array.
- **Chunk metadata passed through** — `extractDocument()` PDF path returns `chunks_used`, `chunk_details`, `large_file`, `total_mb`, `page_count` in result object. `/api/primitives/extract` response includes these fields.
- **`countPdfPages()` dedup** — `extractWithDocumentAIChunked` accepts `knownPageCount` parameter to avoid redundant scans.

#### v58 changes (2026-03-12):
- **`extractDocument(bytes, filename, contentType, env, mode)`** — added `mode` parameter: `'full'` (no cap), `'classify'` (50K cap), `'preview'` (5K cap). Default = `'full'`.
- **`applyExtractionMode(result, mode)`** — new helper wrapping all 10 return paths inside extractDocument. Truncates markdown + recalculates word_count + sets `truncated: true` + `original_length` fields when capping.
- **`cleanPdfText()` Step 0** — line-level filter (long blob lines >200 chars with <3 spaces, lines starting with RuleCounter/Hfootnote/Doc-Start/Item.N) + inline token removal (RuleCounter.*, Hfootnote.*, cite.0@*, glo:*, page.N, equation.*, figure.*, Doc-Start).
- **`baseFilename(filename)`** — global utility strips ZIP subfolder paths (splits on `/` and `\`, returns last segment). Applied in enrichKnowledgeDoc title + return, methodology download Content-Disposition.
- **Standing Rule #16 (EXTRACTION PIPELINE INTEGRITY)** — added to §13. Mandates: one function rule, explicit modes, pre/post grep audit.
- **Methodology clean wipe** — all 4 docs unlinked from puro_tsb, deleted from knowledge_docs. Bundle ready for clean re-ingest.
- **Removed:** redundant `.substring(0, 50000)` from workflow_inputs INSERT (mode='classify' handles it inside extractDocument).
- **3 call sites verified:** extractDocumentContent → mode='full', workflow ingest → mode='classify', PABLO intake/process → mode='full'.

#### v54 changes (2026-03-11):
- **`extractDocument(bytes, filename, contentType, env)`** — new pure bytes→markdown function (no R2, no DB)
  - Handles PDF (≤100pg base64, >100pg native+OCR fallback), DOCX (native XML strip + base64 fallback), XLSX, PPTX, images, text/CSV/JSON
  - Uses `callClaudeRetry()` for all Claude calls (rate limit resilience)
  - Returns `{markdown, word_count, model_used, method}`
- **`callClaudeRetry()`** promoted to global scope (was trapped inside `handleMiteco`)
- **`extractDocumentContent()`** refactored to thin wrapper: R2 read → `extractDocument()` → D1 save
- **`enrichKnowledgeDocAI()`** updated: dynamic tag types (not hardcoded list), `normalizeTagValue()` for lowercase_with_underscores, batch DB inserts
- **PABLO intake/process** now uses `extractDocument()` instead of crude UTF-8 PDF decode

#### v54b fixes (2026-03-11):
- **Fix 1 — Verbatim extraction prompts:** Replaced summarization prompts with verbatim instructions. PDF ≤100pg now says "Extract ALL text completely and verbatim, do NOT summarize". PDF >100pg native/OCR cleanup prompts say "Clean up ONLY artifacts, do NOT summarize or condense". Tested: 2238 words extracted from Plastic Credits white paper vs 849 words from old summarizing prompt.
- **Fix 2 — ocrPdfMultiPage:** Replaced broken byte-slicing approach (sliced raw PDF at 400KB = invalid PDFs for chunks 2+). New approach: ≤100pg delegates to `ocrPdfSingle()` (2-round Haiku), >100pg falls back to `extractPdfText()` native. Returns string (not object) matching all 3 callers.
- **Fix 3 — User title preserved:** `POST /api/knowledge/ingest` now accepts `title` FormData field. pablo.html sends `dname` as `title`. `enrichKnowledgeDoc` passes `{user_title}` through hints. `enrichKnowledgeDocAI` uses `hints.user_title || enrichment.title` — AI enrichment runs (sets document_type, tags, summary) but does NOT overwrite user-provided title. Tested: D1 shows "My Custom Test Title v54b" after AI enrichment.
- **Fix 4 — Extraction warning surfaced:** Ingest response now includes `extraction_warning` when word_count ≤50 or extraction is null. pablo.html shows amber ⚠ warning instead of "ready in library". Tested: 1-word file returns "Low word count (1 words) — document may be a scanned image or corrupt."

### MITECO-DD endpoints (36 routes — DO NOT BREAK)
**CRUD:**
- `GET /api/miteco-dd/projects` — list all projects
- `POST /api/miteco-dd/projects` — create project
- `GET /api/miteco-dd/projects/:id` — get project detail
- `PUT /api/miteco-dd/projects/:id` — update project
- `DELETE /api/miteco-dd/projects/:id` — delete project

**Documents:**
- `GET /api/miteco-dd/projects/:id/documents` — list docs for project
- `POST /api/miteco-dd/projects/:id/documents` — add document
- `PUT /api/miteco-dd/projects/:id/documents/:docId` — update document
- `DELETE /api/miteco-dd/projects/:id/documents/:docId` — delete document
- `GET /api/miteco-dd/projects/:id/documents/:docId/text` — get extracted text

**Processing:**
- `POST /api/miteco-dd/intake/upload-chunk` — upload single file to R2 (multipart)
- `POST /api/miteco-dd/intake/from-r2` — process all files at R2 prefix → D1
- `POST /api/miteco-dd/extract-text` — extract text from single document
- `POST /api/miteco-dd/classify` — classify document into OECC category
- `POST /api/miteco-dd/batch-process` — batch extract + classify pending docs

**Verification:**
- `POST /api/miteco-dd/projects/:id/verify` — structural 11-point OECC check
- `POST /api/miteco-dd/projects/:id/verify-ai` — AI cross-document analysis
- `GET /api/miteco-dd/projects/:id/verify-status` — last verification result

**Package:**
- `POST /api/miteco-dd/projects/:id/package` — generate submission ZIP
- `GET /api/miteco-dd/projects/:id/package/download` — download ZIP from R2
- `POST /api/miteco-dd/projects/:id/correction-doc` — generate correction letter DOCX

**Cascade:**
- `DELETE /api/miteco-dd/projects/:id/cascade` — delete project + all docs + R2 files
- `GET /api/miteco-dd/projects/:id/cascade-preview` — preview what cascade deletes

**Subparcela:**
- `DELETE /api/miteco-dd/projects/:id/subparcelas/:subId` — remove subparcela
- `GET /api/miteco-dd/projects/:id/subparcelas` — list subparcelas
- `POST /api/miteco-dd/projects/:id/subparcelas` — add subparcela

**Misc:**
- `GET /api/miteco-dd/calculadora-options` — MITECO calculator option types
- `GET /api/miteco-dd/provinces` — Spain province list
- `GET /api/miteco-dd/typologies` — project typology list
- `GET /api/miteco-dd/fix-amoedo-ha` — one-time ha fix (idempotent)
- `GET /health` — Worker health + version

### PABLO endpoints (v48–v50)
- `GET /api/pablo/projects` — list all PABLO projects (with flag counts)
- `POST /api/pablo/projects` — create project
- `GET /api/pablo/projects/:id` — get project with flags + deliverables
- `PUT /api/pablo/projects/:id` — update stage/progress/notes
- `GET /api/pablo/projects/:id/flags` — all flags sorted by severity (v49)
- `GET /api/pablo/rules/:registry` → returns rules from D1
- `POST /api/pablo/intake/upload` — upload single file to R2 (multipart) (v49)
- `POST /api/pablo/intake/process` — classify + extract + eligibility analysis (v49)
- `POST /api/pablo/generate` — generate DOCX memo + XLSX financial model via Claude Sonnet → R2 (v50)
- `GET /api/pablo/deliverables/:projectId/:type` — download generated file from R2 (v50)

### Methodology Library endpoints (v56)
- `GET /api/registries` — list all registries (id, name, short_name, website)
- `GET /api/document-roles` — list all document roles (id, label, description)
- `GET /api/methodologies` — list methodology bundles with doc counts, optional filters (?registry_id=&search=)
- `POST /api/methodologies` — create methodology bundle (name, registry_id, version, description, status)
- `GET /api/methodologies/:id` — single bundle with linked documents (via methodology_documents JOIN knowledge_docs)
- `PUT /api/methodologies/:id` — update bundle metadata
- `POST /api/methodologies/:id/ingest` — ingest file into bundle → knowledge_docs + methodology_documents link with document_role_id
- `POST /api/methodologies/ingest-auto` — auto-ingest: upload file, `inferMethodologyMetadata()` AI classification (Haiku) → auto-create/match bundle
- `GET /api/methodologies/:id/export-context` — export all bundle docs as combined markdown context with prompt templates for analysis
- `POST /api/admin/backfill-methodology-links` — one-time: scan all knowledge_docs, match to methodology_bundles by tag/title, create methodology_documents links

**D1 tables (v56):**
- `registries` (id, name, short_name, website, created_at)
- `document_roles` (id, label, description, created_at)
- `methodology_bundles` (id, name, registry_id FK, version, description, status, created_at, updated_at)
- `methodology_documents` (id, bundle_id FK, doc_id FK → knowledge_docs, document_role_id FK, added_at)

**D1 ALTERs (v56):**
- `knowledge_docs.ingest_source TEXT` — tracks how doc entered system (e.g. 'methodology_ingest', 'direct_upload', 'workflow')
- `pablo_projects.methodology_bundle_id TEXT` — FK to methodology_bundles, links project to its methodology

**Key function:** `inferMethodologyMetadata(filename, markdown, env)` — Haiku-based AI classifier in worker.js. Given a filename and extracted text, infers registry, methodology name, version, and document role. Used by `/api/methodologies/ingest-auto`.

### Workflow Engine endpoints (v55)
- `POST /api/pablo/workflows/ingest` — upload ZIP/file → extract → classify → detect intent (Sonnet). Returns `{run_id, inputs, intent, confidence, suggested_output_formats}`
- `POST /api/pablo/workflows/run` — execute confirmed workflow. Body: `{run_id, output_format, confirmed_intent}`. Pulls RAG context from knowledge base, runs Sonnet analysis, saves result to R2 + knowledge_docs. Returns full markdown result.
- `GET /api/pablo/workflows/runs` — list runs (`?project_id=&limit=`)
- `GET /api/pablo/workflows/runs/:id` — single run detail with inputs
- `GET /api/pablo/workflows/runs/:id/result` — raw result markdown from R2
- `POST /api/pablo/workflows/save` — save run as reusable template. Body: `{run_id, name}`
- `GET /api/pablo/workflows/saved` — list saved workflow templates
- `POST /api/pablo/workflows/promote-inputs` — promote workflow input docs to knowledge_docs. Body: `{run_id}`. Returns `{ok, promoted, docs[]}`

**D1 tables:** `workflow_runs`, `workflow_inputs`, `saved_workflows` (3 tables, 2 indexes)

**Output formats:** `dd_report`, `screening_memo`, `compliance_checklist`, `submission_package`, `prefeasibility_memo`, `scorecard`

### Knowledge Quality (v55c)
- `GET /api/knowledge/registries` — dynamic registry list with doc counts from knowledge_tags
- `knowledge_docs` new columns: `content_hash TEXT` (SHA-256 of first 10K chars), `doc_class TEXT DEFAULT 'project_document'`
- **KB_ARCHETYPES**: `canonical_reference`, `project_document`, `correspondence`, `workflow_output`, `financial_model`, `regulatory_filing`
- **CLASSIFICATION_TO_ARCHETYPE**: maps workflow classification → archetype (methodology_spec→canonical_reference, correspondence→correspondence, etc.)
- **Dedup**: `computeContentHash()` + `findExistingKnowledgeDoc()` — checks content_hash before INSERT in enrichKnowledgeDoc, promote-inputs, workflow result auto-save
- **RAG weighting**: wiki/ask now pulls canonical_reference first (up to 4), excludes correspondence+workflow_output from main query, caps correspondence at 2 docs only for relationship-oriented questions
- **enrichKnowledgeDocAI**: now generates `doc_subtype` tag (specific label e.g. "Puro TSB Methodology Edition 2023") and `doc_class` field (updates knowledge_docs if AI returns valid archetype)
- **Dynamic registry filter**: pablo.html (Knowledge Library + Intel sidebar), wiki.html — all fetch from /api/knowledge/registries on view activate

**Auto-saves results to knowledge_docs** with `source_type='workflow_result'` + AI tag enrichment.

### Pending Worker work (v51+)
1. Add `POST /api/pablo/jobs` → write to D1 `jobs` table (ForestEngineer job dispatch)
2. Add `GET /api/pablo/jobs/:id` → ForestEngineer polls this (job status + result)
3. Add `GET /api/pablo/hubspot/:company` → HubSpot API proxy (counterparty auto-pull)

---

## 4. DATABASE (D1) — `clearsky-tools-db`

Total: 56 tables. Key tables:

### MITECO-DD tables
```sql
miteco_projects       -- project metadata, canonical data, stage
miteco_documents      -- files, categories, extraction status, R2 keys
miteco_flags          -- 11-point OECC checks per project
miteco_corrections    -- correction letters generated
miteco_subparcelas    -- subparcela records per project
```

### PABLO tables (created v48, extended v49)
```sql
pablo_projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  client TEXT,
  country TEXT,
  registry TEXT,           -- 'puro' | 'verra' | 'miteco' | 'isometric'
  methodology TEXT,
  stage TEXT,              -- 'intake' | 'analysis' | 'eligibility' | 'generating' | 'review' | 'delivered'
  area_ha REAL,
  volume_m3 REAL,
  corcs_base INTEGER,
  corcs_low INTEGER,
  corcs_high INTEGER,
  dm_factor REAL,
  species TEXT,            -- JSON array
  notes TEXT,
  r2_prefix TEXT,          -- added v49 (ALTER TABLE), e.g. 'pablo/marakoa/intake/'
  hubspot_company TEXT,
  hubspot_contact TEXT,
  created_at TEXT,
  updated_at TEXT
)

pablo_flags (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  category TEXT,           -- 'technical' | 'legal' | 'financial'
  severity TEXT,           -- 'red' | 'amber' | 'green'
  label TEXT,
  note TEXT,
  source_doc TEXT,
  action TEXT,
  resolved INTEGER DEFAULT 0,
  created_at TEXT
)

pablo_deliverables (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  type TEXT,               -- 'memo' | 'financial_model' | 'pin' | 'pdd' | 'mrv' | 'package' | 'correction'
  status TEXT,             -- 'available' | 'needs_data' | 'not_applicable' | 'generating' | 'done'
  blockers TEXT,           -- JSON array of blocker strings
  r2_key TEXT,
  generated_at TEXT
)

pablo_rules (
  id TEXT PRIMARY KEY,
  registry TEXT,
  rule_number INTEGER,
  title TEXT,
  description TEXT,
  check_type TEXT,         -- 'boolean' | 'document' | 'lab' | 'legal'
  required INTEGER
)
```

### D1 seeded data (pablo_projects — 5 rows)
| id | name | registry | stage | area_ha | corcs_base |
|----|------|----------|-------|---------|-----------|
| marakoa | Proyecto Marakoa | puro | delivered | 1,737 | 32,724 |
| bosquia | Bosquia Asturias | puro | eligibility | 420 | 7,800 |
| naturebrain | NatureBrain Sierra Leone | verra | analysis | 12,400 | null |
| amoedo | Amoedo TSB | puro | eligibility | 22.27 | 1,950 |
| elysium | Elysium Cerrado REDD+ | verra | intake | 68,000 | null |

### D1 seeded data (pablo_rules — 12 rows, Puro.earth TSB)
| # | Rule | Check Type |
|---|------|-----------|
| 1 | Woody lignin-containing biomass (Rule 4.1.6) | boolean |
| 2 | Dry matter (DM) lab measurement confirmed | lab |
| 3 | FSC/PEFC sustainability certification | document |
| 4 | Carbon rights unencumbered | legal |
| 5 | C:N ratio >80 confirmed | lab |
| 6 | Burial depth ≥2m in clay cap | boolean |
| 7 | Soil cap permeability <10⁻⁷ m/s | lab |
| 8 | 100-year land easement notarized | legal |
| 9 | Environmental permit issued (Corporinoquía or equivalent) | legal |
| 10 | No double-counting conflict with existing registry project | boolean |
| 11 | Leaf exclusion protocol documented | document |
| 12 | GWP₂₀ moisture stress test passed (Rule 4.1.4) | lab |

---

## 5. FRONTEND FILES (repos/oga-tools/tools/)

| File | Status | URL | Notes |
|------|--------|-----|-------|
| `pablo.html` | **v1.2 LIVE** | tools.oga.earth/tools/pablo.html | Full platform — intake wired v49, generate wired v50 |
| `miteco-dd.html` | v5-intake-wired | tools.oga.earth/tools/miteco-dd.html | Being absorbed into PABLO |
| `presentations.html` / v2 / v3 | Live | tools.oga.earth/tools/presentations-v3.html | BP agent frontend |
| `dashboard.html` / v3 | Live | tools.oga.earth/tools/dashboard-v3.html | Main dashboard |
| `projects.html` | Live | tools.oga.earth/tools/projects.html | — |
| `revenue.html` | Live | tools.oga.earth/tools/revenue.html | Revenue Command Center + HubSpot |
| `wiki.html` | Live | tools.oga.earth/tools/wiki.html | Knowledge Library RAG |
| `rfp-screener.html` | Live | — | RFP screener |
| `goodcarbon.html` | Live | — | GoodCarbon screener |
| `expense-report.html` | Live | — | Receipt OCR → XLSX/PDF |
| `registry.html` | Live | — | Company registry tool |
| `onboarding.html` | Live | — | Counterparty onboarding |
| `file-librarian.html` | Live | — | File librarian |
| `linkedin.html` | Live | — | LinkedIn agent |
| `test.html` | **LIVE** | tools.oga.earth/tools/test.html | Permanent Document AI extraction QA tool — 8 quality checks (method, word count, 4 garbage patterns: RuleCounter/CIDInit+TeX/Hfootnote/cite.0@, truncation, extraction success), garbage highlighting in text output (red highlight on pattern match). Use before every re-ingest to confirm clean extraction. |
| `call-logger/` | Live | — | PWA HubSpot logger |

---

## 6. PABLO v1 UI — WHAT WAS BUILT (2026-03-10)

File: `pablo.html` (88KB, single-file, no React, no external dependencies except Google Fonts)

### Screen architecture
```
LEFT RAIL (220px fixed):
  Logo: PABLO / automated developer
  Projects list (5 projects, colored dots, stage badges)
  + New Project button
  Platform nav: Pipeline / Knowledge Library / Analytics / Settings
  Agent bar (bottom): ForestEngineer · HubSpot · AI Engine (pulse dots)

MAIN AREA:
  Top bar: breadcrumb + project meta + actions
  Stats bar: 8 KPIs (area, CORCs, revenue, flags, registries...)
  Content: one view at a time (no panels over panels)
```

### Views implemented
1. **Pipeline** — Kanban with 6 stages: INTAKE → GIS/ANALYSIS → ELIGIBILITY → DOC GENERATION → REVIEW → DELIVERED. Each card has flag dots, progress bar, CTA.
2. **Project Workspace** — 6 tabs per project:
   - **OVERVIEW**: 3-column grid (metrics, risk summary, HubSpot intel panel auto-pulled)
   - **DOCUMENTS**: cream/white MITECO-DD style table, TSB requirement column, "Run ForestEngineer" button
   - **ANALYSIS**: 3-column flags (Technical/Legal/Financial) + Registry checklist grid
   - **DELIVERABLES**: Available/Needs data/N-A checklist + previously generated files
   - **AGENTS**: ForestEngineer script grid (8 buttons), job log, HubSpot email history, AI engine log
   - **INTEL**: Knowledge Library filtered by registry + RAG query input. Sidebar filters call GET /api/wiki/docs with ?q= param. RAG input calls POST /api/wiki/ask with project registry/methodology as tags (plain string array). Answer rendered inline with sources + model metadata (Haiku/Sonnet).
3. **New Project Wizard** — 3-step: Registry+Methodology → Project Details → Upload ZIP
4. **Generating Screen** — Live step animation (memo steps → xlsx steps → download buttons)
5. **Dispatch Screen** — Live narrative of ForestEngineer job dispatch

### Three distinct data views
| View | Container | Background | Data source | Stats bar shows |
|------|-----------|------------|-------------|-----------------|
| **Pipeline** (platform nav) | `#v-pipeline` | Dark (--bg0) | PROJECTS array (hardcoded + D1 fetch) | Project stats (ha, CORCs, flags, registries) |
| **Knowledge Library** (platform nav) | `#v-library` | Dark (--bg0) | GET /api/wiki/docs (knowledge_docs + knowledge_tags) | Library stats (doc count, standards, methodologies, countries, themes) |
| **Documents** (project tab) | `#v-documents` | Cream (--doc-bg, docmode) | DOCS_DATA array (hardcoded Amoedo MITECO docs) | Project stats (unchanged) |

### Tag format — CRITICAL for filtering
- `/api/wiki/docs?tag=X` uses **exact match** (`kt.tag_value = ?`) — but registry tag values are **wildly inconsistent**:
  - Puro: `Puro Earth`, `Puro.earth`, `Puro.Earth`, `Puro Standard`, `Puro.earth CORCs`, `Puro.earth Rules v3.1`
  - Verra: `VCS`, `Verra`, `VERRA`, `VCS (Verra)`, `VERRA VCS`
- **Solution**: Use `?q=` (LIKE search on title+summary) instead of `?tag=` for registry filtering
- `/api/wiki/ask` `tags` param: plain string array `["Puro.earth", "TSB"]` — searches `kt.tag_value IN (...)`

### Color system
```
Shell/nav (dark): --bg0: #030810 / --bg1: #070F1E / --bg2: #0C1829 / --bg3: #112034
Document tabs (cream): --cream: #FAF8F4 / --cream2: #F0EDE6 / --cream3: #E8E4DC
Teal: #00D4AA (primary accent, CORCs, available)
Amber: #E8A020 (warnings, pending)
Red: #E8485A (blockers, red flags)
Blue: #4A8CF7 (intake stage, DOCX)
Purple: #9B7FE8 (eligibility stage)
Green: #2ECC71 (delivered, confirmed)
Fonts: Syne (headings/labels) + DM Mono (data/code) + DM Sans (body)
```

### Design rules (DO NOT VIOLATE)
- Document-heavy tabs (Documents, Analysis, Intel) use cream background
- Action-heavy tabs (Overview, Deliverables, Agents) and all screens use dark background
- No modals — full-screen transitions only
- No panels sliding over content
- No bullet lists in the UI — use cards and chips

---

## 7. FORESTENGINEER AGENT

### Location
`C:\MITECO-ForestEngineer\` — runs on Luis's Windows PC (NOT on Cloudflare)

### Environment
- Windows 10/11
- QGIS 3.44 (OSGeo4W shell)
- Python 3.12 via OSGeo4W
- Claude Code local agent
- CLAUDE.md at `C:\MITECO-ForestEngineer\CLAUDE.md`

### Script inventory (89 Python files confirmed 2026-03-10)

**Core Pipeline:**
| Script | Purpose |
|--------|---------|
| `run_analysis.py` | Pipeline orchestrator (entry point) |
| `parse_dataroom.py` | PDF data room parser |
| `query_catastro.py` | Catastro API queries |
| `extract_project_data.py` | Structured project data extraction |
| `miteco_gis_analysis.py` | Full GIS analysis (CORINE/Natura/SIOSE/EFFIS/slopes) |
| `species_decision_engine.py` | Species selection engine (factor-first + banda marrón) |
| `fill_calculator.py` | MITECO calculator template filler |
| `soil_query.py` | SoilGrids API queries |
| `intersect_layers.py` | EFFIS/SIOSE spatial intersections |

**Map Generators:**
| Script | Purpose |
|--------|---------|
| `generate_maps.py` | A4 DD report maps (QGIS QgsPrintLayout) |
| `generate_maps_mpl.py` | Matplotlib fallback maps |
| `map_generator.py` | A3 QGIS template maps (DIN 6771 + PNOA) |
| `clearsky_map_template.py` | Project-agnostic ClearSky map engine (from GPKG) |
| `multisite.py` | Multi-site auto-detection |

**Report Generators:**
| Script | Purpose |
|--------|---------|
| `generate_dd_report.py` | Generic DD report (.docx/.pdf) |
| `dd_report_generator.py` | DD report utilities + financials + sensitivity analysis |
| `generate_enersol_review.py` | Enersol Spanish technical review |
| `generate_enersol_dd_report.py` | Enersol English DD report |
| `generate_bosquia_review.py` | Bosquia technical review |
| `generate_bosquia_dd_report.py` | Bosquia English DD report |

**Calculators & Financial:**
| Script | Purpose |
|--------|---------|
| `run_enersol_calculators.py` | Enersol 3-scenario calculators + financial model |
| `run_bosquia_calculators.py` | Bosquia 3-scenario calculators + financial model |
| `run_naturebrain_calc.py` | NatureBrain calculator |
| `run_nava_calc.py` | Nava calculator |
| `run_granada_calc.py` | Granada calculator |
| `run_all_calculators.py` | Batch all calculators |

**Utilities:**
| Script | Purpose |
|--------|---------|
| `build_review_gpkg.py` | Zone-based GPKG builder |
| `create_shapefile_from_refcats.py` | INSPIRE WFS shapefile generator |
| `kml_to_shapefile.py` | KML/KMZ converter |
| `quick_gis_analysis.py` | Standalone GIS truth check |
| `dd_planting_analysis.py` | Counterparty planting DD |
| `push_to_r2.py` | Upload outputs to R2 bucket |
| `fill_legal_template.py` | Legal template filler |
| `remove_subparcela.py` | Subparcela removal + cascade |

**Project-specific (legacy):**
- `naturebrain_*.py` (8 versions)
- `nava_*.py`, `enersol_*.py`, `amoedo_*.py`
- `fcc_analysis_amoedo*.py`, `monte_amoedo_verificacion.py`

**Inspection/debug (prefixed `_`):**
- `_inspect*.py`, `_fetch_recintos.py`, `_pseudotsuga_analysis.py`, `_generate_qgis_project.py`, `_dem_stats.py`, `_temp_read_gpkg.py`, etc.

**Batch/PowerShell (20 files):**
- 17 .bat launcher scripts
- 3 .ps1 scripts (catastro test, atom link finders)

### GIS layers used
| Layer | Source | Purpose |
|-------|--------|---------|
| CORINE land cover | Copernicus | Land use classification |
| Natura 2000 / ZEPA | MITECO | Exclusion zones |
| SIOSE | IGN | Detailed land cover |
| Slope / DEM | MDT25 IGN | Terrain analysis |
| EFFIS fire history | Copernicus | Post-fire eligibility |
| SoilGrids | ISRIC API | Soil type + carbon |
| Catastro | INSPIRE WFS | Parcel boundaries |
| PNOA aerial | IGN | Base map |

### Species logic (Spain projects)
1. Natura 2000 tier a/b/c eligibility check per species
2. Banda marrón exclusion (Asturias/Cantabria/Galicia/Basque) — Pseudotsuga, Eucalyptus not allowed
3. Factor-first sorting (MITECO sequestration factors, highest first)
4. MITECO official table values (not custom)

### Job queue architecture
- D1 table: `jobs` (id, project_id, script, params_json, status, result_json, created_at, completed_at)
- Worker writes job to D1 (status: 'queued')
- ForestEngineer polls `GET /api/pablo/jobs?status=queued` every 30s
- On pickup: updates status to 'running', executes script, writes result, updates status to 'done'/'error'
- **STATUS (2026-03-10): Job queue Worker endpoints pending (v49)**

### Integration with PABLO (via Agents tab)
8 scripts available as dispatch buttons in PABLO Agents tab:
1. GIS Analysis (`miteco_gis_analysis.py`)
2. Species Engine (`species_decision_engine.py`)
3. Soil Query (`soil_query.py`)
4. Generate Maps (`generate_maps.py`)
5. Financial Model (`dd_report_generator.py`)
6. Build GPKG (`build_review_gpkg.py`)
7. DD Report EN (`generate_dd_report.py`)
8. Multi-site detect (`multisite.py`)

---

## 8. BRAND-PRESENTATIONS (BP) AGENT

### Location
`C:\brand-presentations\` — same repo as Worker

### What it does
- Multi-brand Claude Code agent for HTML presentations, DOCX, XLSX
- Brands: ClearSky (primary), Andover Consultores
- Produces: Pre-Feasibility Memos, Financial Models, pitch decks, website mockups

### Key outputs
- `Marakoa_Pre-Feasibility_Memo.docx` — delivered 2026-03-10 to Juan Mato Pin
- `Marakoa_Financial_Model.xlsx` — 3 scenarios (Low/Base/High) delivered 2026-03-10
- ClearSky website (clearskyltd.com → GitHub Pages, repo clearsky-site)

### Integration with PABLO
- PABLO Deliverables tab has "Generate Presentation" button → wire to presentations-v3.html or BP agent directly
- BP agent generates outputs, uploads to R2, PABLO shows download link

---

## 9. PROJECTS — COMPLETE DATA

### Marakoa (Puro.earth TSB) — DELIVERED ✅
| Parameter | Value |
|-----------|-------|
| Client | Inforcol / Lignum Resources |
| Intermediary | Juan Mato Pin (Director, Inforcol) |
| Country | 🇨🇴 Colombia — Vichada, Orinoquía |
| Registry | Puro.earth |
| Methodology | TSB Edition 2023 |
| Stage | DELIVERED |
| Eligible area | 1,737 ha |
| Species | Acacia mangium (85%) + Eucalyptus pellita (15%) |
| DM factor | 50% assumed (lab measurement pending) |
| CORCs base | 32,724 |
| CORC range | 20,452 – 44,996 |
| Price assumption | $120–$150/t |
| Revenue base | $3.93M |
| Revenue high | $6.75M |
| ClearSky fee | 8% gross sales + monthly retainer + 5% capital raise |
| Delivered | Pre-Feasibility Memo + Financial Model (10/03/2026) |

**Red flags:**
- Soil cap integrity (Haplaquox/Vichada flooding risk)
- Colcex timber contract — carbon rights GO/NO-GO gate
- FSC/PEFC certification absent (3 pathways analyzed)

**Pending:**
- Colcex contract legal opinion (Juan Mato Pin to revert EoW)
- Corporinoquía environmental permit (initiate immediately)
- Lab measurements: DM factor, C:N ratio, GWP₂₀
- 100-year land easement notarization

### Bosquia Asturias (Puro.earth TSB) — ELIGIBILITY ⚠
| Parameter | Value |
|-----------|-------|
| Client | Bosquia SL |
| Country | 🇪🇸 Spain — Asturias |
| Registry | Puro.earth |
| Methodology | TSB Edition 2023 |
| Stage | ELIGIBILITY |
| Area | 420 ha |
| CORCs | 7,800 |
| Legal | Addendum No. 1 accepted 100% — execution version pending from JC (Cuatrecasas) |
| Pending | Execution version of Addendum No. 1 |

### NatureBrain Sierra Leone (Verra VCS) — GIS/ANALYSIS ●
| Parameter | Value |
|-----------|-------|
| Client | NatureBrain / InfraOceans |
| Country | 🇸🇱 Sierra Leone |
| Registry | Verra VCS |
| Methodology | VM0047 — ARR Non-Forest |
| Stage | GIS / ANALYSIS |
| Area | 12,400 ha |
| CORCs | — (pending GIS) |
| LOI | $5M initial, $10M call option |
| Critical | Title chain broken since 1864 (historical analysis confirmed) |
| Critical | ~85-90% overlap with protected areas (prior Asturias analysis pattern) |
| Note | ClearSky originated via Miguel Angel Garcia Tamargo introduction — no credit in paper trail |

### Amoedo TSB (Puro.earth + MITECO) — ELIGIBILITY ⚙
| Parameter | Value |
|-----------|-------|
| Client | CMVMC de Amoedo |
| Country | 🇪🇸 Spain — Galicia |
| Registry | Puro.earth + MITECO Sumideros |
| Methodology | TSB Edition 2023 + Sumideros Forestales |
| Stage | ELIGIBILITY (processing) |
| Area | 22.27 ha (19 subparcelas, definitiva) |
| Subparcelas | 19 |
| tCO₂ total | 18,507 |
| CORCs available | 3,365 |
| CORCs base (PABLO) | 1,950 |
| MITECO contract | Caja Rural Zamora: 18,409 créditos at €18 + IVA = €331K |
| OECC subsanación | 11 puntos — area confirmed 22.27 ha |
| Blocker | Brian Katz signature on Anexo II (MITECO submission) — pending as of 2026-03-10 |
| Forest engineer | Amancio Serrapio Soárez COETFOGA nº568 (signs Memoria/Certificación) |

### Elysium Cerrado REDD+ (Verra VCS) — INTAKE ●
| Parameter | Value |
|-----------|-------|
| Client | Elysium Asset Management |
| Country | 🇧🇷 Brazil — Cerrado |
| Registry | Verra VCS |
| Methodology | VM0042 REDD+ |
| Stage | INTAKE |
| Area | 68,000 ha |
| CORCs | — |
| Issues | VM0047+VM0044 conflation (methodology confusion in client docs) |
| DD service pricing | $5-8K screening / $15-25K standard / $30-50K deep |

---

## 10. REGISTRIES & METHODOLOGIES

### Puro.earth TSB (Terrestrial Storage of Biomass)
- **Full name:** TSB Methodology for CO₂ Removal, Edition 2023
- **Instrument:** CO₂ Removal Certificates (CORCs) — 1 CORC = 1 tCO₂ permanently removed
- **Mechanism:** Bury woody biomass in clay-pit below decomposition zone → 100+ year storage
- **Crediting period:** 5 years, renewable 2× (max 15 years total)
- **Degradation assumption:** <8.8% asymptotic (IPCC 2019 guidelines)
- **First issuance:** August 2024 (Woodcache PBC, Colorado)
- **Market prices:** $126–$150/CORC (Woodcache Nasdaq, Carbon Sequestration Inc.)
- **Buyers:** Microsoft, Shopify, Zurich Insurance, Frontier consortium
- **Key rule 4.1.6:** Biomass must be lignin-containing (woody) — excludes grasses, aquatic
- **Eligible types:** logging slash/residues, timber processing waste, fire-killed trees, silvicultural thinning, land clearing (with permit)
- **Key technical requirements:** DM lab measurement, C:N ratio >80, burial depth ≥2m clay cap, soil permeability test, FSC/PEFC cert, 100-yr easement, env permit
- **Pit design:** typically ~90×90m, >3.7m deep, clay cap with pitched roof for drainage

### MITECO España — Sumideros Forestales
- **Operator:** MITECO/OECC (Oficina Española de Cambio Climático)
- **Instrument:** Carbon credits (voluntary Spanish registry)
- **11-point OECC check:** Formulario PA, title, forest plan, memoria técnica, calculadora, certificación técnica, mapa, fotografías, plan de gestión, subsanación docs, signatures
- **Key MITECO contacts:** Amancio Serrapio Soárez COETFOGA nº568 (forest engineer signatory)
- **Status in PABLO:** Full 36-endpoint pipeline live (miteco-dd.html v5 → being absorbed)

### Verra VCS
- **VM0047:** ARR in Non-Forest Lands — used for Sierra Leone NatureBrain
- **VM0042:** REDD+ Avoided Unplanned Deforestation — used for Elysium Cerrado
- **VM0044:** IFM Improved Forest Management
- **VM0048:** ARR Restoration
- **Status in PABLO:** Partial (NatureBrain VM0047 flags built, VM0042 pending)

### Isometric
- **Protocols available:** Subsurface Biomass Carbon v1.1, BECCS, ERW
- **Key distinction:** BiCRS (Biomass Carbon Removal & Storage) = their TSB equivalent
- **"Biomass Geological Storage Protocol v1.1"** = deep geological injection (NOT clay pit burial)
- **"Biomass Storage in Terrestrial Subsurface"** = clay pit analog — NOT YET active (no certified projects)
- **Recommendation for Marakoa:** Do NOT use Isometric — no certified terrestrial path, timeline risk too high vs Puro.earth
- **Status in PABLO:** Planned

---

## 11. MITECO-DD PENDING FIXES (v5 → v5.1)
These fixes are on the existing miteco-dd.html, NOT PABLO. They should be done as part of absorbing MITECO-DD into PABLO.

1. **Binary text preview:** files with no extractable text show hex dump — should show "No text available, run OCR" message
2. **Calculadora Option 3:** xlsx output cell reader — reads specific cells from MITECO calculator output
3. **Corrections view:** data not populating from D1 (endpoint exists, frontend binding broken)

---

## 12. BUILD SEQUENCE (NEXT SESSIONS)

### Immediate (v51 Worker + pablo.html v2)
```
Priority 1: ForestEngineer job dispatch ← NEXT
  - Add POST /api/pablo/jobs Worker endpoint → writes D1 jobs table
  - Add GET /api/pablo/jobs/:id → status polling
  - Wire Agents tab "Run" buttons to these endpoints
  - ForestEngineer CLAUDE.md: add polling loop for new jobs

Priority 2: HubSpot auto-pull
  - GET /api/pablo/hubspot/:company → HubSpot Companies API proxy
  - Called automatically when workspace opens
  - Shows in Overview → HubSpot Intel panel
```

### Completed (v49–v50)
```
✅ ZIP intake wiring (v49)
  - POST /api/pablo/intake/upload → R2 upload (multipart)
  - POST /api/pablo/intake/process → classify + extract + eligibility (Claude Sonnet)
  - pablo.html New Project wizard → real intake pipeline with live status
  - Hardened intake callback: project card renders in kanban immediately

✅ Generate Deliverables (v50)
  - POST /api/pablo/generate → Claude Sonnet memo + financial JSON → DOCX (fflate) + XLSX (SheetJS) → R2
  - GET /api/pablo/deliverables/:projectId/:type → download from R2
  - pablo.html Generate button wired to real API with live status + download links
  - Tested end-to-end: Marakoa memo (3.7KB DOCX) + financial model (19.5KB XLSX) generated and downloadable
```

### Medium term
- Absorb miteco-dd.html into PABLO as Spain/MITECO workspace
- MITECO-DD fixed (binary preview, calculadora, corrections)
- Verra VM0042 rule engine (12 rules for Elysium)
- ~~Knowledge Library: upload PDFs to R2, wire /api/pablo/library to R2 list~~ ✅ Done (v51 — uses existing knowledge_docs via /api/knowledge/ingest + /api/wiki/docs)
- ~~RAG endpoint: Claude Sonnet with R2 document context~~ ✅ Done (v51 — uses existing POST /api/wiki/ask, Haiku for simple / Sonnet for complex)

### Long term (post-custody hearing May 18)
- Plan B activation: carbon DD/project eval tool (standalone SaaS)
- Partners: Fernando (Santander SMEs) + Javier (accounting/legal)
- Stack: same Cloudflare Workers + D1 + R2

---

## 13. KEY CONTACTS FOR PROJECTS

| Person | Role | Context |
|--------|------|---------|
| Brian Katz | ClearSky CEO | Must sign Amoedo Anexo II — pending since Feb 2026 |
| Juan Mato Pin | Marakoa intermediary (Inforcol) | Received Pre-Feasibility + Financial Model 10/03/2026 |
| Amancio Serrapio Soárez | Forest engineer COETFOGA nº568 | Signs Memoria/Certificación for MITECO Spain projects |
| JC Hernanz | Cuatrecasas external legal | Bosquia Addendum accepted; execution version pending |
| Suniva Gómez Fernández | Cuatrecasas external legal | IP/employment contract matters |
| Corporinoquía | Colombian env. authority | Permit needed for Marakoa burial operations |
| Ana Avramovic | ClearSky Head of Sales | Internal |
| Carolina Martinez | ClearSky internal | Internal |
| Emmanuel Mendoza | ClearSky internal | Internal |

---

## 14. IP & OWNERSHIP RULES

- All tools built on **personal machine** using **personal Claude account**
- ClearSky blocked Claude.ai on corporate PC — all work done personally
- **Engine.py, models, pipelines, prompts = personal IP**
- ClearSky receives only **final outputs** (PDFs, DOCX, XLSX) — never methodology, never code, never prompts
- Never reference tools as "my model" or "my system" in company channels
- In ClearSky comms: "the analysis shows X" — not "my tool found X"
- ESOP authorized (Brian email 8/03/2026) — negotiate Q3 2026 from position of strength
- Framing: "8 functions + AI tools in personal infra + origination = equity must reflect contribution"

---

## 15. OPERATIONAL RULES FOR CLAUDE CODE

When operating in any terminal for this project:

1. **Always read worker.js before touching it** — `Read src/worker.js completely before touching anything`
2. **Bump version** at top comment on every deploy: `v49-feature-name`
3. **Never break existing endpoints** — add only, never remove
4. **Test after every deploy:** `curl https://api-tools.oga.earth/health`
5. **Save snapshot** after each stable version: `cp src/worker.js infrastructure/worker-v{N}.js`
6. **R2-first always** for any file intake — never send ZIPs to Worker body
7. **Temperature: 0** for all canonical extraction Claude calls (deterministic)
8. **Prefix `_`** for debug/inspection scripts in ForestEngineer (keeps pipeline clean)
9. **Never run PowerShell ZIP** — use Python zipfile module (PowerShell ZIP breaks fflate)
10. **No markdown backticks in AI JSON responses** — enforce with system prompt
11. **MANDATORY: Update PABLO_CLAUDE.md after EVERY prompt round** — session history + any new findings. Copy to BOTH `C:\brand-presentations\PABLO_CLAUDE.md` AND `C:\MITECO-ForestEngineer\PABLO_CLAUDE.md`. No exceptions. Do not wait to be asked.
12. **NEVER use inline `style="display:..."` on `.view` divs** — pablo.html uses `.view{display:none}` / `.view.on{display:block}` for view switching. Inline styles have higher CSS specificity and will override the class rules, making views permanently visible. If a view needs `display:flex`, add a CSS rule like `.view.on#v-foo{display:flex}` instead.
13. **knowledge_docs.source_id meaning varies by source_type** — `direct_upload`: source_id IS the file_id (files table). `project_extract`: source_id is the extract_id (document_extracts table) → must look up file_id via `document_extracts.file_id`. `project_sync`: source_id is the project_id. `web_scrape`: source_id is the URL. To download original file: GET /api/knowledge/docs/:id (returns file_id) → GET /api/files/download/{file_id}.
14. **UI CONTRACT TEST** — mandatory for every build that touches pablo.html OR adds/changes API endpoints consumed by pablo.html. A build is NOT complete without all 4 steps:
   - **STEP 1 — RESPONSE SHAPE VERIFICATION:** For every new/changed endpoint consumed by pablo.html: Log the actual API response shape (keys, nesting, array vs object). Find the exact JS parsing code in pablo.html that consumes it. Read both side-by-side in the same terminal session. Assert: every key the JS accesses exists in the Worker response. Common failure: Worker returns `{ methodologies: [] }` but JS does `data.bundles.forEach()`. Fix any mismatch before deploy. This is non-negotiable.
   - **STEP 2 — HEADLESS RENDER CHECK:** After git push: `curl https://tools.oga.earth/tools/pablo.html` → assert HTTP 200. Scan response for obvious JS syntax errors or missing script tags.
   - **STEP 3 — LIVE API→UI SMOKE TEST:** For each new UI section added or modified: Seed one real record via the API. Call the list endpoint, log the full response shape. Read the pablo.html parsing code for that section. Assert: seeded record would be visible if rendered (key exists, array non-empty, correct field names used). Do this in terminal — read Worker code and pablo.html code simultaneously.
   - **STEP 4 — CLEANUP:** Before final report: DELETE all `qa_test_*`, `test_*`, `debug_*` records from all D1 tables. Assert: `SELECT COUNT(*) FROM methodology_bundles WHERE id LIKE 'qa_%' OR id LIKE 'test_%'` = 0. Same check on knowledge_docs, pablo_projects, workflow_runs.
15. **SESSION FILE UPDATE** — after every successful wrangler deploy + health check: Update PABLO_CLAUDE.md + SYSTEM.md + regenerate PABLO_SESSION_HANDOFF.md + mirror all 3. Never batch updates to end of session only. If chat dies mid-session, last deploy state must be recoverable from PABLO_SESSION_HANDOFF.md.
16. **EXTRACTION PIPELINE INTEGRITY** — mandatory for any build that touches document extraction, knowledge ingestion, or file processing:
   - **THE ONE FUNCTION RULE:** `extractDocument(bytes, filename, contentType, env, mode)` is the ONLY extraction entry point in the entire codebase. No other function may parse PDF/DOCX/XLSX/ODT/RTF bytes directly. No inline extraction. No separate `extractForIngest()`, `extractForClassify()`, or similar.
   - **BEFORE any build that touches extraction:** `grep -n "extractDocument\|extractForIngest\|unzipSync\|w:t\b\|cleanPdfText" src/worker.js` — log all results. Verify every call uses `extractDocument()` with correct mode. If any non-extractDocument extraction exists: consolidate first, then build.
   - **AFTER any build that touches extraction:** Re-run the grep audit. Verify call count has not increased. Verify mode parameter is explicit on every call.
   - **EXTRACTION MODES:** `'full'` → no cap, full cleaning (methodology library, wiki RAG, export context). `'classify'` → 50K cap after extraction (workflow ingest classification only). `'preview'` → 5K cap after extraction (UI thread previews, quick summaries). Default mode = `'full'` if omitted (safest default — never silently truncates).
   - **Every consumer of extractDocument must declare its mode explicitly.**

### Deploy checklist
```
☐ Read worker.js fully
☐ Bump version comment
☐ Add endpoints BEFORE existing catch-all handler
☐ Test locally if possible
☐ npx wrangler deploy
☐ curl health → confirm new version
☐ Test new endpoint with curl
☐ Save snapshot: cp src/worker.js infrastructure/worker-v{N}.js
☐ Commit: git add . && git commit -m "feat: v{N} ..." && git push
```

### QA Rules — Extraction Pipeline (v54f+)

**PRIME DIRECTIVE:** Every change to `extractDocument()`, `cleanPdfText()`, `extractPdfText()`, `ocrPdfSingle()`, `ocrPdfMultiPage()`, or any ingestion pipeline MUST pass automated assertions before reporting success.

**Test suite:** `infrastructure/clearsky-api/test-extraction.js`
**Run:** `cd infrastructure/clearsky-api && node test-extraction.js`

**Rules:**
1. **Binary garbage = zero tolerance.** No `IdentityAdobe`, `AdobeUCS`, `ESRI ArcMap`, `crl.microsoft.com`, font program bytecode, or CMap metadata may appear in stored `knowledge_docs.markdown`. If `cleanPdfText()` misses a pattern, add it.
2. **Word count must be stable or improving.** Remova FEED BoD: 4,000–10,000 words. Proyecto Ordenación Amoedo: 12,000–30,000 words. A change that drops word count >20% is a regression — investigate before deploying.
3. **No broken-word avalanche.** `joinBrokenWords()` handles PDF column-layout splits (`f\nall` → `fall`, `large-\nscale` → `large-scale`). If more than 5 single-char broken lines appear in a doc's first 500 chars, the join logic needs extending.
4. **ESRI/GIS tail truncation.** If `ESRI ArcMap` appears >1000 chars into extracted text, truncate everything from that point. Also strip GIS metadata patterns (`ÿþ*ESRI*`, `D:\d{14}Z`, `FPDF \d+\.\d+`).
5. **Autonomous QA loop.** On any extraction pipeline change: deploy → re-upload QA PDFs (Remova FEED + Ordenación Amoedo from R2 `qa/` prefix or local `C:\brand-presentations\qa_*.pdf`) → run `test-extraction.js` → fix failures → repeat until exit code 0 → only then report to user. Max 10 iterations.

**QA test PDFs (kept permanently):**
- `C:\brand-presentations\qa_remova.pdf` — Remova FEED BoD (5.4MB, English, BECCS project)
- `C:\brand-presentations\qa_ordenacion.pdf` — Proyecto Ordenación Amoedo (15.2MB, Galician/Spanish, forestry)

---

## 16. UI REVERSION PREVENTION

Mandatory before and after every pablo.html edit:

**BEFORE editing pablo.html:**
1. Run: `git log --oneline -5` (in oga-tools repo) — log the current HEAD commit hash
2. Run: `grep -c "Methodology Library" tools/pablo.html` — log the count
3. Run: `grep -c "Export Context" tools/pablo.html` — log the count
4. Run: `grep -c "Browse\|Ingest\|Quick Add" tools/pablo.html` — log the count
5. If ANY count is 0 when it should be >0 — **STOP. Do not edit.** The file has already been reverted. Restore from git history first: `git log --all --oneline -- tools/pablo.html` (find last good commit), `git checkout [GOOD_COMMIT] -- tools/pablo.html`

**AFTER editing pablo.html, before git push:**
1. Re-run all grep checks above — all counts must be EQUAL OR HIGHER than before
2. Assert: "Methodology Library" tab still present
3. Assert: "Export Context for Chat" button still present
4. Assert: Browse / Ingest / Quick Add mode buttons still present
5. Assert: ALL previously working tabs still present (Knowledge, Wiki, Workflows, etc.)
6. If any count dropped — do NOT push. Find what was accidentally deleted and restore.

**AFTER git push:**
1. `curl https://tools.oga.earth/tools/pablo.html | grep -c "Methodology Library"` — must return >0
2. If 0 — the push reverted the live file. Investigate immediately.

**ROOT CAUSE OF REVERSION:** editing pablo.html by replacing large blocks instead of targeted str_replace operations. ALWAYS use str_replace (Edit tool) for pablo.html edits. NEVER rewrite the entire file. NEVER copy-paste a full new version. Each edit = one targeted str_replace with the minimum change needed.

---

## 17. FRONTEND VISUAL QA PROTOCOL

Mandatory after every pablo.html deploy. grep counts and HTTP 200s are NOT sufficient — they do not verify what the user sees.

**A. LIVE FILE CONTENT CHECK** (not local file — the actual deployed file):
```bash
curl -s https://tools.oga.earth/tools/pablo.html -o /tmp/pablo_live.html
```
For every nav item that should exist, verify in `/tmp/pablo_live.html`:
- `grep -c "Methodology Library"` → must be >= 2 (nav item + view section)
- `grep -c "v-methodology"` → must be >= 1
- `grep -c "nav-methodology"` → must be >= 1 (sidebar wiring)
- A count of 1 means it's in only one place — likely the nav item exists but the view section is missing, or vice versa.

**B. NAV WIRING CHECK:**
- Every sidebar nav item must have: `id="nav-{name}"`, `onclick="showPlatform('{name}')"`, matching `<div id="v-{name}" class="view">` section, and a call in `showPlatform()` to load its data.
- Missing ANY of these = tab visible in sidebar but clicking does nothing or shows blank.

**C. NO INLINE DISPLAY OVERRIDE:**
- Scan `v-{name}` div for `style="display:none"` or `style="display:block"` — assert: none found.

**D. GITHUB PAGES DEPLOYMENT CONFIRMED:**
- After git push, wait 45s, then: `curl -sI ... | grep last-modified`
- Timestamp must be NEWER than before the push.

**E. LOCAL ↔ LIVE SYNC CHECK:**
- Compare text-mode char count (not raw bytes — Windows CRLF adds ~2,800 bytes vs Linux LF)
- Must be identical in text mode. If not: GitHub Pages serving stale version.

**F. FILE SIZE REGRESSION CHECK:**
- After every edit, compare pablo.html text-mode size to before.
- If size DECREASED by more than 1KB: a section was accidentally deleted. STOP and investigate.

**G. PLATFORM SECTION vs PROJECT TAB:**
- Sidebar nav items (Pipeline, Workflows, Knowledge Library, Analytics, Methodology) are PLATFORM sections — accessible without opening a project. They use `showPlatform('{name}')`.
- Project tabs (Overview, Documents, Analysis, Links, Deliverables, Agents, Intel, Methodology) are PROJECT tabs — only visible when viewing a specific project. They use `tab('{name}')`.
- A platform section MUST have: sidebar `<div class="rnavitem">`, a `showPlatform()` handler, and a `<div id="v-{name}" class="view">` section.
- A feature meant to be always accessible (like Methodology Library) MUST be a platform section, not just a project tab.

**WHAT "DEPLOYED AND WORKING" MEANS:**
- All checks A through F pass on LIVE file
- Live text-mode size matches local text-mode size
- All nav items present in both nav section AND view section of live file
- If BP cannot verify visually (no browser access): "Structural checks pass. Luis must visually confirm in browser."

---

## 18. MARAKOA FINANCIAL MODEL PARAMETERS

| Scenario | CORCs | Price | Revenue |
|----------|-------|-------|---------|
| Low | 20,452 | $110 | $2.25M |
| Base | 32,724 | $120 | $3.93M |
| High | 44,996 | $150 | $6.75M |

| Component | Value |
|-----------|-------|
| DM factor | 50% (assumed, lab pending) |
| Degradation | <8.8% (Puro methodology) |
| Species split | 85% Acacia mangium / 15% Eucalyptus pellita |
| Area | 1,737 ha eligible |
| Crediting period | 5 years (renewable 2× = 15 years max) |
| ClearSky commercial fee | 8% of gross sales |
| Monthly retainer | TBD |
| Capital raise fee | 5% |
| DM sensitivity | ±15% CORCs (±4,900 CORCs / ±$588K at $120) |

---

## 19. PURO.EARTH TSB — TECHNICAL REFERENCE

### Burial pit design
- Dimensions: ~90×90m footprint, depth >3.7m
- Cap: native high-plasticity clay (K < 10⁻⁷ m/s)
- Roof: pitched clay cap for rainwater drainage
- Objective: isolate biomass from O₂, moisture, and decomposers
- Degradation <8.8% asymptotic at correct design

### Eligible biomass (Rule 4.1.6)
- (a) Logging slash / harvest residues
- (b) Timber processing waste
- (c) Fire/disaster-killed trees
- (d) Silvicultural thinning / management
- (e) Land clearing with valid permit
- **Key:** must be lignin-containing woody biomass
- **Excluded:** grasses, aquatic biomass, agricultural residues

### Benchmarks
| Project | Country | Volume | Price | Notes |
|---------|---------|--------|-------|-------|
| Woodcache PBC | USA (Colorado) | — | ~$150/t (Nasdaq) | First TSB issuance Aug 2024 |
| Carbon Sequestration Inc. | USA (Texas) | 10,000t | $126/t | Clay pit design, 2024 |

### Haplaquox risk (Vichada — Marakoa-specific)
- Vichada Llanos Orientales = Oxisols with seasonal flooding
- Haplaquox suborder = seasonally saturated
- Risk: clay cap permeability compromised during wet season
- Mitigation: drainage design required before burial operations
- Corporinoquía permit mandatory for earth-moving operations

---

## 20. VICHADA / COLOMBIA MARKET CONTEXT

- Vichada = epicenter of Colombian commercial reforestation for carbon
- Forest First Colombia: FSC+VCS, ~40,000 ha
- Vichada Climate Reforestation: GS 4221, 73,835 ha
- Brújula Verde (Trafigura): $100M investment, eucalyptus, controversial (exotic species in native savanna)
- Colombia: 74 active afforestation/reforestation carbon projects (3rd globally after China, India)
- Plantation species: Acacia mangium (dominant), eucalyptus, Caribbean pine, minimal natives
- TSB eligibility: feedstock = forestry waste/residues (not commercial timber itself)
- Operational challenges Vichada: transport cost to pits, clay availability, water table in Llanos

---

## 21. FILE & PATH REFERENCE

```
C:\brand-presentations\
  infrastructure\
    clearsky-api\
      src\
        worker.js              ← PRODUCTION WORKER (never edit without reading first)
      wrangler.toml
    worker-v{N}.js             ← snapshots
  PABLO_CLAUDE.md              ← this file (save here)

C:\MITECO-ForestEngineer\
  CLAUDE.md                    ← ForestEngineer agent instructions
  PABLO_CLAUDE.md              ← this file (save here too)
  scripts\
    run_analysis.py            ← entry point
    [89 scripts total]
  data\
    [GIS layers: CORINE, Natura2000, SIOSE, EFFIS, DEM]

repos\oga-tools\               ← PRODUCTION FRONTEND REPO
  tools\
    pablo.html                 ← PABLO v1 (built 2026-03-10)
    miteco-dd.html             ← v5 (being absorbed into PABLO)
    [all other tools]
  CNAME                        ← tools.oga.earth

repos\clearsky-site\           ← OUTDATED — do not use for MITECO-DD
```

---

## 23. PARALLEL TERMINAL RESTRICTION

pablo.html is a single file. Two terminals MUST NOT edit pablo.html simultaneously.

**ALLOWED in parallel:** Worker endpoints (different file), D1 migrations, SYSTEM.md updates, test scripts.

**NOT ALLOWED in parallel:** any two operations that both write to pablo.html.

**Sequence rule:** if two builds both touch pablo.html, complete and push the first build fully (including live verification checks per Rule #17) before starting the second build's pablo.html edits.

**If parallel pablo.html edits happen accidentally:** treat as a reversion event. Run full Rule #16 diagnostic before proceeding.

---

## 24. WORKER.JS EDIT INTEGRITY

Mirrors pablo.html Rule #16 (UI Reversion Prevention) for the Worker file:

1. **NEVER rewrite worker.js in full.** str_replace only, targeted sections.
2. **Before any worker edit:** `grep -n` the target function to find exact lines.
3. **Before deploy:** `wc -c src/worker.js` must not decrease by more than 500 bytes unless a function was explicitly deleted (document which one).
4. **Two terminals MAY edit worker.js simultaneously** ONLY if their target functions are confirmed non-overlapping via grep before either starts.

---

## 22. SESSION HISTORY SUMMARY

| Date | What was built |
|------|---------------|
| 2026-01-xx | ClearSky contract signed, tools platform started |
| 2026-02-xx | Revenue Command Center, Expense Reporter, Call Logger PWA, Spain Projects Dashboard (10 projects), Social Agent, Counterparty Onboarding, File Librarian, Company Registry |
| 2026-02-28 | ForestEngineer GIS analysis run on Marakoa (7 layers, 7 maps) |
| 2026-03-05 | MITECO-DD v36: R2-first architecture, AI verification, ha validation |
| 2026-03-07 | MITECO-DD v38: end-to-end Amoedo test (66 files, 6 AI-detected inconsistencies) |
| 2026-03-08 | MITECO-DD v39-v47: full pipeline stable (36 endpoints) |
| 2026-03-08 | engine.py: lease contract automation (26 substitutions, Loureiro ES+EN) |
| 2026-03-08 | Bosquia Asturias Addendum No. 1: 8 points identified, accepted 100% |
| 2026-03-10 | Marakoa Pre-Feasibility Memo + Financial Model delivered to Juan Mato Pin |
| 2026-03-10 | PABLO design session: full architecture, UX decisions, 6 tabs, 3 agents |
| 2026-03-10 | PABLO v1 built: pablo.html (88KB), v48 Worker, D1 seeded, 5 projects live |
| 2026-03-10 | v49: Intake pipeline wired (upload→R2, process→classify+extract+eligibility via Claude Sonnet). r2_prefix column added to pablo_projects. Hardened intake callback (STATE.wizReg null bug fixed). |
| 2026-03-10 | v50: Generate endpoint live — DOCX memo + XLSX financial model via Claude Sonnet → R2. Download endpoint. pablo.html Generate button wired to real API. Marakoa test: 3.7KB DOCX + 19.5KB XLSX generated end-to-end. |
| 2026-03-10 | v50 hotfix: Generate button did nothing — `<div id="genscr">` opening tag was missing from HTML. Lines 636-652 were orphaned (not wrapped in #genscr container). `showGen()` called `getElementById('genscr')` → null → TypeError → silent failure. One-line fix: added `<div id="genscr">` wrapper. |
| 2026-03-10 | v50 hotfix 2: Projects lost on refresh — PROJECTS was a hardcoded const array with no D1 fetch. New projects created via wizard were added to in-memory array but vanished on page reload. Fix: made `init()` async, added `dbToFrontend()` mapper (DB schema → frontend shape), fetch `GET /api/pablo/projects` on load, merge DB projects into PROJECTS array (DB wins for existing IDs, new IDs appended). Added `COUNTRY_FLAGS` lookup (30+ countries → emoji). Hardcoded rich data (hs, delvd, species, notes) preserved for seed projects when DB has no data. |
| 2026-03-10 | v50 hotfix 3: Delete project — `DELETE /api/pablo/projects/:id` (hard delete from D1 + R2 cleanup). Removes pablo_flags, pablo_deliverables, miteco_documents, pablo_projects rows + R2 intake/deliverable files. Frontend: red Delete button in topbar with confirm dialog, splices from PROJECTS array, returns to pipeline view. Initial deploy crashed (error 1101) because `miteco_documents` has no `source` column — removed the `AND source = ?` filter. |
| 2026-03-11 | v51: Knowledge Library + Intel RAG wired. Two-panel layout (upload + browse via GET /api/wiki/docs). Intel tab sidebar filters + RAG via POST /api/wiki/ask. Upload via POST /api/knowledge/ingest. No Worker changes. Commit e94d269. |
| 2026-03-11 | v52: Knowledge Library UX overhaul. Dynamic stats bar switches between project stats and library stats (doc count, standards, methodologies, countries, themes) via updateLibraryStats(). Registry filter chips (All/Puro/Verra/MITECO/Isometric) using ?q= LIKE search (not ?tag= which requires exact match and fails due to inconsistent tag values). Delete buttons + download links on each doc row. setProjectStats() restores pipeline stats on view switch. Tag format discovery: standard tags are inconsistent (VCS/Verra/VERRA/Puro Earth/Puro.earth/Puro.Earth) — use ?q= text search, NOT ?tag= exact match. Commit 8b3aa4c. |
| 2026-03-11 | v52 hotfix: Browser cache preventing users from seeing new code. GitHub Pages serves with Cache-Control: max-age=600 (10 min). Added `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">` + Pragma + Expires meta tags. Fix: hard refresh (Ctrl+Shift+R) or incognito window. Commit 4ff6203. |
| 2026-03-11 | v52 hotfix 2 — CSS specificity bug: v-documents and v-intel had inline `style="display:flex"` which overrode `.view{display:none}` (inline styles beat class selectors). These two divs were ALWAYS visible, consuming #content space and pushing v-library below visible area (overflow:hidden clips). Fix: removed inline styles, added `.view.on#v-documents{display:flex;flex-direction:column}` and `.view.on#v-intel{display:flex}` CSS rules. Now .view hide/show works for ALL views. Commit 3a51b52. |
| 2026-03-11 | v53: Library ZIP bulk upload + PDF/TXT download buttons + text viewer. (1) JSZip CDN loaded, drop zone handles ZIP files (extracts contents, shows file list, uploads via /api/wiki/upload-bulk + sequential extract). (2) Replaced useless ↓ JSON link with "↓ PDF" button (downloads original file from R2 via file_id chain: knowledge_docs→document_extracts→files→/api/files/download) and "TXT" button (opens full-screen text viewer overlay with extracted markdown, summary, tags, download-as-txt). (3) Worker v51: GET /api/knowledge/docs/:id now returns `file_id` (resolved from source_id via extract→files lookup for project_extract, direct for direct_upload). Commits 972fc9e + 2044d21. |
| 2026-03-11 | v52 Worker: Universal Project ID + Unified Extraction Pipeline. (1) D1: `pablo_project_id TEXT` FK added to `projects`, `miteco_documents`, `miteco_projects` + indexes. `pablo_extracts` table created. (2) Worker: `GET /api/pablo/projects/selector` (id+name for dropdowns), `GET /api/pablo/projects/:id/linked` (cross-tool links), `POST /api/pablo/extract` (shared extraction pipeline → pablo_extracts), `GET /api/pablo/extracts/:projectId[/:id]`. Generic POST/PUT handlers pass pablo_project_id. Route order fix: selector before projMatch regex. Column name fix: miteco_documents uses `category`/`doc_type` not `document_type`. (3) pablo.html: Links tab between Analysis and Deliverables, renderLinks() fetches /linked, shows grouped cards by tool. (4) rfp-screener.html + goodcarbon.html: PABLO Project dropdown (ff-pablo), loadPabloSelector() on init, passed as top-level field in POST/PUT, populated on edit from p.pablo_project_id. Commit dbed957. |
| 2026-03-11 | v53 Worker: Knowledge Sync Pipeline. (1) `syncExtractsToKnowledge(project_id, env)` — reads from both `pablo_extracts` AND `miteco_documents`, creates `knowledge_docs` + AI enrichment with project hints (registry, methodology, project_name). (2) `enrichKnowledgeDocAI` now accepts `hints={}` param — adds context block to prompt, adds `registry` to tag types with canonical names. (3) `enrichKnowledgeDoc` passes hints through. (4) `POST /api/pablo/intake/process` auto-calls syncExtractsToKnowledge after flags (Step 7). (5) `POST /api/pablo/projects/:id/sync-knowledge` — manual trigger. (6) D1: `knowledge_doc_id TEXT`, `document_type TEXT` added to `pablo_extracts`. (7) Cleaned 12 knowledge_docs: 9 Aperam audit report duplicates (kept oldest + project_sync), 3 corrupted docs (0-217 words). (8) Fixed `owner=clearsky001` on 1 doc → `clearsky`. Source: `presentations-v3.html` was passing `clearsky001` in 4 places — all fixed. (9) Synced Amoedo: 36 docs promoted to knowledge library with `registry: Puro.earth` tags. Other 4 projects: 0 docs (no files uploaded yet). (10) RAG verified: "How deep is the burial pit in Walsenburg?" answered correctly with 9 context docs. Frontend commit 90fa718. |
| 2026-03-11 | v54 Worker: Unified extraction pipeline. `extractDocument()` pure bytes→markdown. `callClaudeRetry()` global. `extractDocumentContent()` thin wrapper. `enrichKnowledgeDocAI` dynamic tags + `normalizeTagValue()`. PABLO intake/process wired to `extractDocument()`. |
| 2026-03-11 | v54b Worker: 4 extraction fixes. (1) Verbatim prompts — "do NOT summarize" (2238 words vs 849 old). (2) ocrPdfMultiPage — delegates to ocrPdfSingle for ≤100pg, native extractPdfText for >100pg (was slicing invalid PDFs). (3) User title — POST /api/knowledge/ingest accepts `title` FormData, pablo.html sends dname, hints.user_title prevents AI overwrite. (4) extraction_warning — ingest returns warning when word_count≤50 or null, pablo.html shows amber ⚠. Frontend commit cae39c4. |
| 2026-03-11 | v54c Worker: Large PDF fix. extractDocument() size guard raised 10MB→19MB (1MB under Claude's 20MB API limit). POST /api/pablo/extract guard also raised 10→19MB. Tested: 14.5MB Amoedo Ordenacion PDF (424056_Proxecto_Ordenacion_OKK.pdf) → 1,330 words extracted via native extractPdfText pipeline (>100 pages). Previously failed silently with 0 words. |
| 2026-03-11 | v54d Worker: Verbatim extraction — removed Claude from all PDF paths where good text exists. (1) Native text path: `extractPdfText()` returns good text → return directly as `pdf_native`, no Claude "cleanup" (was destroying 90% of content: 14,945→1,330 words). (2) OCR path: `ocrPdfSingle`/`ocrPdfMultiPage` returns text → return directly as `pdf_ocr_haiku`, no Claude cleanup. (3) Base64 path: ONLY used as last resort when both native+OCR return <200 chars, switched to Sonnet with 16K tokens and strict verbatim prompt. (4) Text/XML storage caps raised 50K→300K, PDF caps raised 100K→400K. Results: Remova FEED 871→31,486 words (36x), Ordenacion Amoedo 1,330→22,033 words (16.5x). model_used now shows `pdf_native` instead of `claude-haiku-4-5`. |
| 2026-03-11 | v54e Worker + Frontend: PDF filter + MITECO tags. **BUG 1 fix**: (1) `extractPdfText()` now skips font program streams (Type1C, CIDFontType0C, OpenType, TrueType via /Length1, CMap via /Type /CMap) at stream level. (2) `cleanPdfText()` post-filter: printable ratio <0.60 discard (>20 chars), word-char ratio <0.50 discard (>30 chars), hex/binary line discard, CMap/font metadata line discard, MIT license block skip (15 lines), blank line collapse. Results: Remova FEED 31,486→5,779 words (garbage removed, real content preserved). **BUG 2 fix**: (3) `enrichKnowledgeDocAI` prompt now includes `miteco` and `isometric` in registries list, Spanish forestry hint. (4) User tags support: hints.user_tags passed through, worker parses comma-separated tags from FormData, infers tag_type (registry/country/methodology/theme), inserts before AI enrichment. (5) pablo.html: tags input field in upload form, `libFilter()` stores lowercase, `loadLibraryDocs()` uses `?tag=` (LIKE search on normalized tag_value) instead of `?q=` for registry filters. `regColorFromTags` handles underscore-normalized values. (6) Worker wiki/docs `?tag=` uses `LOWER(kt.tag_value) LIKE ?` for case-insensitive match. Fixed D1 ambiguous column error (`kd.created_at` in JOIN branch ORDER BY). Frontend commit dade60f. |
| 2026-03-11 | v54f Worker: Broken-word join + ESRI/GIS truncation + permanent QA test suite. (1) `joinBrokenWords()` function: repairs PDF column-layout word breaks — hyphen-split (`large-\nscale`→`large-scale`), newline-split (`en\nter`→`enter`), number-range TPA patterns. Applied as Step 1 inside `cleanPdfText()`. (2) ESRI/GIS metadata truncation: if `ESRI ArcMap` found >1000 chars in, truncates remainder. Strips residual GIS patterns (`ÿþ*ESRI*`, `D:\d{14}Z`, `FPDF \d+\.\d+`). (3) Created `infrastructure/clearsky-api/test-extraction.js` — permanent QA test suite: D1 queries via wrangler, global assertions (binary garbage, word count, broken words) + document-specific tests (Remova FEED 4k-10k words, Ordenación ≥12k, content markers). (4) QA results: Remova FEED 5,699w (clean), Ordenación 17,403w (clean), 72 assertions passed, 0 failed. (5) Added QA Rules section to PABLO_CLAUDE.md §15. |
| 2026-03-11 | v55 Worker + Frontend: Workflow Engine. (1) 3 D1 tables: `workflow_runs`, `workflow_inputs`, `saved_workflows` + 2 indexes. (2) 7 new endpoints under `/api/pablo/workflows/*`: ingest (ZIP/file → extract → classify → Sonnet intent detection), run (RAG context + Sonnet 16K analysis → R2 + knowledge_docs auto-save), runs list, run detail, result markdown, save template, list saved. (3) 6 output formats: dd_report, screening_memo, compliance_checklist, submission_package, prefeasibility_memo, scorecard. (4) pablo.html: Workflows nav item (between Pipeline and Knowledge Library), drop zone + confirm card + progress bar + result viewer + history list. (5) Fixed `extractDocument()` arg order bug in user spec (was `bytes,ext,filename` → corrected to `bytes,filename,contentType`). (6) Fixed `enrichKnowledgeDocAI` arg order (env before hints). (7) All 7 QA checks passed: D1 tables, ingest (confidence 0.85), runs list, full DD report (5,785 chars), knowledge_docs save (760 words), content quality, no route conflicts. Commit 72a8809. |
| 2026-03-11 | v55b Worker + Frontend: Workflow UX. (1) Ingest progress indicator: animated bar with 4-step status messages (uploading → extracting → classifying → detecting intent) replaces static "Analyzing..." text. (2) "Try Different Format" button: amber button in result view calls `wfRetryFormat()` which re-shows confirm card with same run_id (no re-upload needed). "Cancel" renamed to "Reset". (3) `POST /api/pablo/workflows/promote-inputs`: promotes workflow input docs (word_count>20) to knowledge_docs with source_type='workflow_input', AI enrichment via enrichKnowledgeDocAI. (4) Source Documents panel: appears below result with file list + "Add All to Knowledge Library" button. (5) WF state extended: `lastIngestData` persists ingest response for retry. All 5 QA checks passed. Commit d62497a. |
| 2026-03-11 | v55c Worker + Frontend: Knowledge Quality. (1) D1: content_hash TEXT + doc_class TEXT on knowledge_docs + 2 indexes. (2) KB_ARCHETYPES + CLASSIFICATION_TO_ARCHETYPE constants for 6 behavioral classes. (3) computeContentHash() + findExistingKnowledgeDoc() — SHA-256 dedup on first 10K chars. (4) enrichKnowledgeDoc() now checks dedup + sets doc_class. (5) promote-inputs dedup: second promote returns duplicate:true + existing doc_id. (6) Workflow result auto-save: dedup + doc_class='workflow_output'. (7) enrichKnowledgeDocAI: generates doc_subtype tag + doc_class field, updates knowledge_docs if valid archetype. (8) GET /api/knowledge/registries — dynamic registry list from knowledge_tags. (9) wiki/ask RAG weighting: canonical_reference first (up to 4), excludes correspondence+workflow_output, caps correspondence at 2 for relationship queries. (10) Dynamic registry filter in pablo.html (library + intel sidebar) + wiki.html. All 8 QA checks passed. Commit b803272. |
| 2026-03-11 | v55d Worker: DOCX Extraction Fix. (1) Diagnosed 3 compounding bugs in DOCX branch: `parseZipEntries()` only extracts xl/ paths (skips word/), `.find()` called on plain object, `.bytes` accessed on text strings — all silently caught. (2) Added 5 extraction helpers: `extractDocx()` (fflate unzipSync + w:t regex per paragraph), `extractDocxLayer2()` (all word/*.xml aggressive tag strip), `extractDocxLayer3()` (raw UTF-8 printable runs), `extractOdt()` (content.xml tag strip), `extractRtf()` (control word strip + hex/unicode decode). (3) Replaced broken DOCX branch with 3-layer fallback returning `docx_native` method (no Claude needed). (4) Added ODT + RTF branches in extractDocument(). (5) Tag normalization backfill: Puro.earth→puro_earth (30), MITECO→miteco (1), Spain→spain (26), United States→united_states (15), TSB→tsb (25), Forestry→forestry (18), Galicia→galicia (19), Pontevedra→pontevedra (8), AFOLU→afolu (11), VCS→vcs (12), Puro Earth→puro_earth (8), SDG 13/15/8→sdg_13/15/8, REDD+→redd_plus, Carbon Sequestration→carbon_sequestration, ClearSky Carbono→clearsky_carbono. Deduplication removed 21 duplicate rows. (6) doc_class backfill: 6 methodology/registry_spec/verification_report docs promoted to canonical_reference. Registries reduced 16→15. All 8 QA checks passed. Worker v55d deployed. |
| 2026-03-12 | v56 Worker + Frontend: Methodology Library. (1) 4 new D1 tables: `registries` (id, name, short_name, website), `document_roles` (id, label, description), `methodology_bundles` (id, name, registry_id FK, version, description, status), `methodology_documents` (id, bundle_id FK, doc_id FK → knowledge_docs, document_role_id FK). (2) ALTER: `knowledge_docs.ingest_source TEXT`, `pablo_projects.methodology_bundle_id TEXT`. (3) `inferMethodologyMetadata(filename, markdown, env)` — Haiku-based AI classification engine: given filename + extracted text, infers registry, methodology name, version, document role. (4) 15 API endpoints: `GET /api/registries`, `GET /api/document-roles`, `GET/POST /api/methodologies`, `GET/PUT /api/methodologies/:id`, `POST /api/methodologies/:id/ingest`, `POST /api/methodologies/ingest-auto`, `GET /api/methodologies/:id/export-context`, `POST /api/admin/backfill-methodology-links`. (5) pablo.html: new "Methodology" tab with 3 modes — browse (cascading 3-column filter: registry → bundle → documents), ingest (file upload with auto-classification), quick-add (manual bundle creation). (6) Export context: combines all bundle docs into single markdown blob with prompt templates for downstream analysis. (7) One-time backfill: scanned 206 knowledge_docs, linked 13 to methodology bundles (193 skipped — no matching bundle or not methodology-related). |
| 2026-03-12 | v56-hotfix: (1) Standing Rules 14 (UI CONTRACT TEST — 4-step mandatory process: response shape verification, headless render check, live API→UI smoke test, cleanup) + 15 (SESSION FILE UPDATE — update all docs after every deploy) added. (2) CSS specificity fix: `#v-methodology` had inline `style="display:flex"` overriding `.view{display:none}` — Standing Rule 12 violation. Removed inline style, added `.view.on#v-methodology{display:flex;flex-direction:column}` class rule. (3) Dirty bundle cleanup: deleted `puro_earth_tsb` (4 docs were duplicates already linked to puro_tsb), deleted `qa_test_*` bundle. Final state: 2 clean bundles — puro_tsb (13 docs), isometric_subsurface (0 docs). All 8 QA assertions passed. |
| 2026-03-12 | v56-ui-restore audit: Standing Rule 16 (UI REVERSION PREVENTION) added. Diagnostic confirmed NO content reversion — all HTML sections present in both live and local files. |
| 2026-03-12 | v57 Worker + Frontend: HubSpot Inbox. (1) 2 new D1 tables: `hubspot_threads` (email thread cache with contact_id, contact_name, contact_email, company, subject, email_count, has_unread, thread_json, pablo_project_id), `hubspot_tasks` (task tracking with thread_id FK, counterparty, priority, horizon, input_source, ai_confidence, status). (2) 3 new helper functions: `stripHtml()` (tag removal preserving line breaks), `groupEmailThreads()` (v1 engagements grouped by threadId/normalized subject, inbound/outbound detection via domain matching), `matchThreadProject()` (keyword overlap >= 2 words). (3) 7 new endpoints under `/api/hubspot/*`: `GET /inbox` (fetch + cache + project-match), `GET /thread/:id` (10min cache TTL), `POST /sync-inbox` (200 engagements, batch upsert), `GET /inbox-contacts` (distinct contacts), `GET/POST/PUT/DELETE /tasks` (full CRUD). (4) pablo.html: `nav-hubspot` sidebar item, `v-hubspot` view with 3-column layout (thread list 280px + thread detail flex + task panel 300px), stats strip (emails/threads/unread/tasks/waiting/sync), search + contact/project filters, thread selection with full email chain (inbound left-aligned blue border, outbound right-aligned teal border), task list/kanban toggle, inline task creation form pre-filled from active thread. All 8 QA assertions passed. Commit ebef20a. |
| 2026-03-12 | v56-debug: **Root cause: Scenario D — Methodology Library was only a project tab, not a sidebar nav item.** The `.ptab` at line 466 (`onclick="tab('methodology')"`) was only accessible after clicking into a specific project. The left sidebar nav (Pipeline, Workflows, Knowledge Library, Analytics) did NOT include Methodology Library — no `<div class="rnavitem" id="nav-methodology">` existed. **Fix:** (1) Added `nav-methodology` sidebar item with book icon SVG + `onclick="showPlatform('methodology')"`. (2) Added `'methodology'` to `showPlatform()` nav array and labels map. (3) Added `if(v==='methodology') loadMethodologyTab();` init call. Commit `e886a8b`. Standing Rule 17 (FRONTEND VISUAL QA PROTOCOL) added — defines what "deployed and working" actually means: live file content checks, nav wiring checks, platform section vs project tab distinction. Also discovered and discarded incomplete HubSpot Inbox scaffolding (65 lines, undefined functions) that was polluting the working copy. |
| 2026-03-12 | v56-methodology-clean-slate: Wiped puro_tsb dirty data (13 links deleted, 5 duplicate ReGenerate docs removed with 31 tags + 49 entities). Clean slate: puro_tsb=0 docs, isometric_subsurface=0 docs. Extraction pipeline verified (63/64 tests pass). **Awaiting Luis to ingest 8 canonical files**: 7 for puro_tsb (TSB methodology PDF, Walsenburg PD, Fasera registration, 2 audit reports, 2 XLSX models) + 1 for isometric_subsurface (SBCRS v1.1 PDF). Worker now v57-hubspot-inbox. |
| 2026-03-12 | v57-hotfix: HubSpot inbox UX. (1) Mine/All toggle — filters threads to Luis's emails only (LUIS_EMAILS array). (2) CLEARSKY_CONTACTS display name mapping — brian.katz→Brian Katz, ana.avramovic→Ana Avramovic, etc. (3) hsDedupThreads() — merges threads with identical normalized subject + contact_email within 24h window (fixes HubSpot typo duplicates like tamara.m.mcgillidray). (4) Standing Rule #23 (PARALLEL TERMINAL RESTRICTION) added to PABLO_CLAUDE.md. Commit 8d11107. |
| 2026-03-12 | v57b: HubSpot identity fix. (1) LUIS_EMAILS corrected — canonical email `luis.adaime@clearskyltd.com` placed first (was missing). (2) `isLuisEmail()` function added — exact match against LUIS_EMAILS array. (3) Email renderer: replaced `e.direction === 'outbound'` with `isLuisEmail(e.from)` for accurate "You" display. (4) Thread list: shows subject instead of contact name when contact resolves to Luis Adaime. Commit 8e9b926. |
| 2026-03-12 | v57c: Worker + Frontend identity overhaul. (1) `LUIS_HUBSPOT_OWNER_ID = 82916631` constant — canonical HubSpot identity via owner ID, not email matching. (2) `groupEmailThreads()` now stores `ownerId` on each email object. (3) `extractThreadParticipants()` uses owner ID check instead of email scan. (4) hubspot_threads: `sender_email`, `sender_name`, `involves_luis`, `luis_role` columns added + populated. (5) Truncated + re-synced: **8 of 123 threads involve Luis**. (6) pablo.html: removed `LUIS_EMAILS`/`isLuisEmail()` dead code, `isLuisThread()` uses `involves_luis` flag, email renderer uses `ownerId === 82916631`, thread list shows counterparty for Luis threads. Commit c8322b5. |
| 2026-03-12 | v58: Extraction Architecture. Architectural fix — one extraction function, one place to fix, explicit contracts everywhere. (1) `extractDocument()` gains `mode` parameter (`'full'`/`'classify'`/`'preview'`), `applyExtractionMode()` wraps all 10 return paths. (2) `cleanPdfText()` Step 0: line-level filter for PDF internal cross-reference garbage (RuleCounter, Hfootnote, cite.0@, glo:, Doc-Start, long blob lines). (3) `baseFilename()` global utility strips ZIP subfolder paths from titles + download headers. (4) Removed redundant `.substring(0, 50000)` from workflow_inputs INSERT. (5) Standing Rule #16 (EXTRACTION PIPELINE INTEGRITY) added — mandates one-function rule, explicit modes, grep audit pre/post build. (6) Wiped all 4 corrupted/capped docs from puro_tsb (clean slate for re-ingest). QA: Assertions 1,2,8 PASS. Assertions 3-7 blocked on user re-ingesting files. |
| 2026-03-12 | v57d diagnostic: HubSpot Mine Toggle Wiring audit. **Scenario: NONE — toggle wiring already correct.** Full call chain verified: `hsToggleMine(true)` → sets `hsMineOnly=true` → calls `hsFilterThreads()` → applies `isLuisThread(t)` filter → calls `hsRenderThreadList()`. `isLuisThread()` correctly checks `thread.involves_luis === 1` (integer, not string — verified from API response). `hsDedupThreads()` preserves `involves_luis` field. API returns 54 threads, 1 with `involves_luis=1`. User's reported issue likely caused by browser cache or pre-v57c propagation timing. Headless test `test-mine-filter.js` passes all assertions (7 edge cases + wiring check). No code changes made. |
| 2026-03-12 | v59a: HubSpot Full Archive. (1) R2-based email thread storage — full JSON at `hubspot/threads/{id}.json`, 1,128 threads archived. (2) D1 hubspot_threads now lean metadata index (thread_json=null for new syncs). (3) `syncHubSpotBatch()` paginated sync: HubSpot API → groupEmailThreads → archiveThreadToR2 → D1 metadata. (4) Cron trigger `0 2 * * *` (nightly incremental). (5) `POST /api/hubspot/backfill` — resumable (250/batch, tracks offset in hubspot_sync_state). (6) `GET /api/hubspot/search` — D1 metadata search (q, contact, company, from, to, mine). (7) Inbox now D1-only (14-day default, no HubSpot API call). (8) Thread detail fetches from R2, falls back to D1 thread_json. (9) SQLITE_TOOBIG fix: thread_json=null in batch sync (was storing MB-sized HTML newsletters). (10) Standing Rule #24 (WORKER.JS EDIT INTEGRITY). Stats: 1,128 threads, 224 involve Luis, 2025-09-01 to 2026-03-12, all 10 QA assertions PASS. |
| 2026-03-12 | v60: Document AI Integration. Google Document AI replaces Claude-based PDF OCR as primary extraction path. (1) `getGoogleAuthToken(env)` — JWT auth with GCP service account, 55min token caching. (2) `extractWithDocumentAI(bytes, env)` — OCR processor with 15-page chunking via `individualPageSelector`, reassembles per-page text. (3) `_docAiRequest()` — internal API call helper. (4) `POST /api/primitives/extract` — standalone extraction endpoint (no DB storage). (5) `extractDocument()` PDF pipeline reordered: Document AI primary for ALL PDFs, native `extractPdfText()` fallback only when Document AI unavailable, Claude OCR last resort. (6) New secrets: `GOOGLE_DOCUMENT_AI_KEY` (service account JSON), `GOOGLE_DOCUMENT_AI_PROCESSOR` (processor resource name). (7) GCP project: `oga-tools`, processor: `e67ba60df73bf041` (OCR pretrained-ocr-v2.1-2024-08-07). Health: `v60-document-ai` with `docai: true` flag. |
| 2026-03-12 | v60b: test.html — permanent extraction QA tool with 8 quality checks, garbage highlighting, dark theme. Live at tools.oga.earth/tools/test.html. Checks: extraction method, word count, 4 garbage patterns (RuleCounter, CIDInit/TeX, Hfootnote, cite.0@), truncation detection, extraction success. Red highlight on garbage pattern matches in text output. Use before every re-ingest to confirm clean extraction. Frontend commit 883637c. |
| 2026-03-12 | v62b: test.html handles async extraction jobs — progress bar + 5s polling for files >8MB, cancel button stops polling, auto-renders result when job complete, all sync behavior unchanged. Frontend commit dc59ded. |
| 2026-03-12 | v64: Document Taxonomy. 3 D1 vocab tables (taxonomy_doc_types, taxonomy_registries, taxonomy_projects), 3 new columns on knowledge_docs (registry, project, taxonomy_source). classifyTaxonomy() rule engine. 6 endpoints /api/primitives/taxonomy/*. Backfill: 203 docs classified. |
| 2026-03-12 | v64-frontend: Methodology browse wired to taxonomy/search. Replaced bundle-based listing with project-based listing. Extended docIcon to 13 taxonomy doc_types. Added methDownloadTaxDoc(). Commit 627f5e5. |
| 2026-03-12 | v65: Registry Crawler. crawl_runs/crawl_projects/crawl_documents tables. Verra VCS fully functional (OData search API). Puro.earth + Isometric stubs (awaiting API keys). 5 endpoints /api/primitives/crawler/*. Queue consumer for async crawl. |
| 2026-03-12 | v66: is_canonical structural fix. (1) D1: `is_canonical INTEGER DEFAULT 0` on knowledge_docs + index. (2) 7 existing methodology_documents marked canonical. (3) Worker: taxonomy/search accepts `?canonical=1` filter, returns `is_canonical` in SELECT. taxonomy/assign accepts `is_canonical` field. knowledge/ingest accepts `is_canonical` FormData. (4) pablo.html: methodology browse fetches `&canonical=1` (shows only curated docs), detail panel shows "★ Library" badge, Knowledge Library ingest form has "Add to Methodology Library" checkbox. Health: v66-canonical. QA: 5/5 assertions PASS. Commits 6941294 (frontend) + worker deploy. |
| 2026-03-12 | v66b: Methodology Library browse now groups by doc_type (not project). methRenderBundles() uses TYPE_ORDER + typeCounts from METH.docs. methLoadDetail() filters by doc_type. All 7 canonical docs assigned registry=puro_earth via /assign. Middle column now shows: Core Methodology / Verification Report / Financial Model / Example PD. METH.selBundle now holds a doc_type string, not a project string. Commit 9569a58. |

| 2026-03-13 | crawler_test.html: Bulk Intake Hub. Standalone page at `tools/crawler_test.html` (direct URL only, no nav link). 3-tab layout: (1) Local Upload — drag-and-drop file extraction via POST /api/primitives/extract with async polling for >8MB files. (2) Crawler Run — registry selector (verra/puro/isometric), query input, max projects, download toggle, 4-stage pipeline visualization (Crawl→Download→Extract→Enrich), live log. (3) Past Runs — loads from GET /api/primitives/crawler/status, "Load" button populates staging. Staging Table: quality badges (green/amber/red based on word count + garbage detection), inline-editable doc_type/registry/project fields with datalist autocomplete, canonical checkbox, preview drawer (markdown text + metadata). Commit: local uploads → POST /api/knowledge/ingest, crawler docs with knowledge_doc_id → PATCH /api/primitives/taxonomy/assign. Dark theme matching pablo.html (Syne+DM Mono+DM Sans fonts, --bg0/#030810 palette). No worker changes. |
| 2026-03-13 | v67-crawler-fix Worker + crawler_test v2. **Worker:** crawlVerra() now uses structured OData filters via buildVerraFilter(params). Verra OData: no toLower() support, uses `country eq 'Brazil'` exact match + `contains(protocolSubCategories, 'REDD')` + `contains(resourceName, 'keyword')`. POST /api/primitives/crawler/run accepts top-level country, projectType, status, query fields (backward-compat with nested config). Health: v67-crawler-fix. **Frontend:** (1) auto project=registry_reference for methodology doc_types (core_methodology/registry_spec/technical_report/policy_document/example_pd/market_intelligence/methodology). (2) Structured per-line log panel with color-coded levels (info/success/error/warn). (3) Inline text preview per staging row — first 500 words with garbage pattern highlighting. (4) Verra crawler tab shows 4 structured fields (Country/Project Type/Status/Name contains), Puro/Isometric keeps simple query field. (5) getCrawlParams() reads registry-specific fields → structured API body. |
| 2026-03-13 | v68-registry-doctype Worker + crawler_test v3. **Worker:** D1 migrations (registry_doc_type+version on knowledge_docs, registry_doc_type+document_role+version on crawl_documents, project_boundaries table). classifyVerraDoc() regex classifier (15 Verra-native types by filename prefix). Wired into enrichKnowledgeDocAI, taxonomy/classify, taxonomy/assign, taxonomy/search, knowledge/ingest, fetchVerraDocuments INSERT, crawler/documents GET. PDF async threshold 8MB→1MB. New endpoints: POST /api/primitives/boundaries/store, GET /api/primitives/boundaries. Health: v68-registry-doctype. **Frontend (9 patches):** (A) registry_doc_type column + client-side classifyVerraDoc mirror. (B) Failed+Skipped+Boundary counters in stats bar. (C) File blob preservation via immediate ArrayBuffer read. (D) Clear Staging button with confirm. (E) 6-state quality badges (pending/green/amber/red/error/skip/boundary). (F) Binary file auto-filter (KML/SHP→boundary, ZIP/GDB→skip). (G) Crawler docs project=unassociated, Verra project ID sublabel. (H) Doc type counts in crawler log summary. (I) Replaced doc_type/registry/project columns with registry_doc_type+version+document_role. Commit c47d06c. |
| 2026-03-13 | v69-crawler-pagination Worker + crawler_test v5. **Worker:** buildVerraFilter() input normalization — STATUS_MAP (lowercase→Title Case: registered→Registered, under_development→Under development), country Title Case normalization, REGISTRY_MAP (accepts verra_vcs/puro_earth aliases). classifyVerraDoc() extended from 15→25 patterns (10 project document types: project description, monitoring report, verification report, registration/issuance requests, PDD, etc.). Health: v69-crawler-pagination. **Frontend (patches A-J):** (A) Status select lowercase values (normalized by worker). (B) extractVersion() no default fallback. (C) classifyVerraDocClient() extended with 10 project patterns. (D) inferDocumentRole() maps registry_doc_type→document_role. (E) isGeographicFile()+isBinaryFile() extension-only split. (F) Crawler docs _extractionAttempted removed → pending quality. (G) Crawler log summary with project/document/boundary counts. (H) Delete Selected bulk delete button. |
| 2026-03-13 | v70-scanned-pdf Worker + crawler_test v6. **Worker:** isLikelyScannedPdf() heuristic (bytes/page <50KB AND >30 pages). computePagesPerChunk() shared helper (CHUNK_PAGES_TEXT=15, CHUNK_PAGES_SCANNED=6, CHUNK_PAGES_SCANNED_LARGE=4, 20p ceiling). Continuation queue: CHUNKS_PER_INVOCATION=15, R2 staging at extractions/{jobId}/chunk_NNNN.txt, saveChunkResult()+assembleChunks() helpers. Queue consumer accepts {jobId, chunkOffset, isContinuation}. processExtractionJob(jobId, env, chunkOffset) rewritten with continuation support. D1: extraction_jobs +total_chunks/completed_chunks/chunk_offset. API: jobs/:id returns total_chunks+completed_chunks+progress_pct. Health: v70-scanned-pdf. Test: Seringueira PDD 536p/8.5MB → 6p/chunk → 90 chunks → 6 continuation hops. **Frontend (v6):** chunk progress bar (done/total with animated teal fill), drop zone hint for scanned PDFs, classifyVerraDoc geographic guard (BOUNDARY_EXTS/SKIP_EXTS early-return), Draft pattern (^draft[-_\s]→project_description), inferDocumentRole rewrite (10 Verra-specific roles), boundary files registry_doc_type='', multi-file upload confirmed. |
| 2026-03-13 | v72-mistral-ocr Worker + crawler_test v7. **4 changes:** (1) **Multi-file upload fix:** FileList is a live DOM reference — `fileInput.value=''` clears it before async loop iterates past file 1; `e.dataTransfer.files` invalidated when event handler returns. Fix: `Array.from()` snapshots both FileList references before async work. (2) **Mistral OCR 3 integration:** New `extractWithMistralOCR(fileBuffer, env)` function — POST `https://api.mistral.ai/v1/ocr`, model `mistral-ocr-latest`, document as base64 data URL, response `pages[].markdown` joined. Wired as PRIMARY OCR in both sync `extractDocument()` and async `processExtractionJob()`. Cost: $0.002/page. Extraction routing: native text (free, if sufficient) → Mistral OCR ($0.002/pg) → Claude OCR (fallback, small PDFs) → Sonnet base64 (last resort ≤100pg). MISTRAL_API_KEY Worker secret. Health: `mistral: true`. (3) **Document AI deletion:** Removed entire DocAI subsystem — `getGoogleAuthToken`, `extractWithDocumentAI`, `extractWithDocumentAIChunked`, `_docAiRequest`, `computePagesPerChunk`, `saveChunkResult`, `assembleChunks`, all DOCAI_* constants. ~300 lines deleted. No more Google JWT auth, no chunking continuation queue. (4) **Cancel/Stop button:** POST `/api/primitives/jobs/:id/cancel` sets status='cancelled'. Queue consumer checks status before processing and skips cancelled jobs. POST `/api/primitives/jobs/:id/requeue` resets job + re-enqueues. Frontend: red "Stop Extraction" button appears during active extractions, cancels all in-flight jobs. **QA:** Seringueira PDD 536p → 172K words via mistral_ocr in ~30s (vs 6 continuation hops with DocAI). Health: v72-mistral-ocr. |
| 2026-03-13 | v73-pablo-library Worker + pablo.html rewrite. **Worker:** (1) `normalizeRegistry(raw)` — strips spaces/underscores/hyphens, lowercases, maps all variants to canonical taxonomy ID (verra, puro_earth, gold_standard, isometric, american_carbon, climate_action, plan_vivo, miteco, eu_ets, art_trees). Returns null for unknown/empty. (2) Wired into all write paths: enrichKnowledgeDocAI, taxonomy/assign, taxonomy/classify. (3) classifyTaxonomy registry assignments fixed: `car`→`climate_action`, `acr`→`american_carbon`, `unspecified`→`null`. (4) D1 backfill: `verra_vcs`→`verra` (20 rows), `car`→`climate_action` (1 row). Health: v73-pablo-library. **Frontend:** (1) Methodology Library rebuilt on registry_doc_type axis — single API call (taxonomy/search?canonical=1&limit=500), client-side filtering, two-panel layout: registry chips (derived from data) + doc type list (using registry_doc_type + REGISTRY_DOC_TYPE_LABELS 24-entry map) + document cards. (2) Knowledge Library rebuilt as searchable sortable table — single API call (taxonomy/search?limit=500), client-side search + canonical filter + column sort, columns: Title/Type/Registry/Version/Words/Canonical/Preview. (3) REG_LABELS 11-entry map for display names. (4) Both panels use existing viewLibText() for preview and methDownloadTaxDoc() for download. Commit 6fc73b9. QA: 10/10 PASS. |
| 2026-03-13 | v74-crawler-extraction Worker + crawler_test v8. **Worker:** POST `/api/primitives/crawler/extract` — reads r2_key from crawl_documents, runs canonical extractDocument() pipeline (native→Mistral OCR→Claude fallback), writes extracted_markdown+word_count back to crawl_documents, inserts into knowledge_docs with source_type='crawler' + normalizeRegistry(), links knowledge_doc_id. Skips geographic files (KML/SHP/KMZ/geojson/gpx/dbf/prj/shx). Dedup: returns already_synced if knowledge_doc_id exists. Fire-and-forget enrichKnowledgeDocAI for tags/doc_class. Boundary dedup: project_boundaries checks registry+project_id+filename before INSERT. Health: v74-crawler-extraction. Snapshot: worker-v74.js. **Frontend:** commitSelected() Case C replaces dead-end error with `/api/primitives/crawler/extract` call. STATUS column shows "↻ extracting…" (teal) during extraction, transitions to "✓ done" on success. Boundary rows from crawler committed without extraction. assignQuality() re-run after extraction completes. Commit ed7b7b0. QA: 10/10 PASS — 7 docs from Brazil REDD crawl (5 PDFs extracted 65-24K words, 2 KMLs skipped). |
| 2026-03-13 | v75-rfp-tool Worker + rfp-tracker.html + pablo-system.css. **Worker:** 3 new D1 tables (rfps, rfp_projects, rfp_supply_docs). 6 new endpoints: GET rfp/list, GET rfp/:id, POST rfp/:id/project, POST rfp/:rfp_id/project/:project_id/supply (file upload→extractDocument→knowledge_docs with source_type='rfp_supply' OR reference existing knowledge_doc), POST rfp/:rfp_id/project/:project_id/evaluate (AI evaluation engine: Sonnet, per-criterion scoring, verbatim criterion text preserved, evidence from supply docs, gap analysis, fit_score 0-100, submission_readiness), GET rfp/:rfp_id/project/:project_id (detail with supply docs). Watershed 2026 pre-seeded: 7 hard filters, 9 quality criteria, 9 biochar, 7 ARR, 3 IFM, 4 super_pollutant, 4 regen_ag + commercial terms. taxonomy/search now returns source_type. Health: v75-rfp-tool. Snapshot: worker-v75.js. **Frontend:** pablo-system.css: shared macOS design system (CSS variables, 3-column layout, badges, criterion cards, fit score ring, buttons, inputs). rfp-tracker.html: three-column workspace — sidebar (RFP list with deadline chips), center (project cards grouped by status), right panel (supply doc upload/drop, AI evaluation, per-criterion scoring). pablo.html: added Supply Docs checkbox filter to Knowledge Library (filterSupply on KLIB state). Commit a46c220. QA: 12/12 PASS. |
| 2026-03-13 | v75b-crawler-fix Worker + crawler_test v9. **Worker:** D1 migration 017_methodology_code.sql — `methodology_code TEXT` column + index on knowledge_docs. enrichKnowledgeDocAI: field #10 `methodology_code` (e.g. VM0047, AR-ACM0003) added to AI prompt + UPDATE statement. taxonomy/search: returns methodology_code in SELECT, new `?methodology_code=` filter param. taxonomy/assign: accepts methodology_code in PATCH body. buildVerraFilter: NO changes needed (country/projectType null guards already existed at lines 6462/6471). Health: v75b-crawler-fix. Snapshot: worker-v75b.js. **Frontend:** crawler_test.html v9 (commit ef7b824): Country field labelled "(optional)", new Methodology column in staging table, methodology_code passed in all 3 commit paths (Case A/B/C). |
| 2026-03-15 | v78-registry-platform: D1 tables verra_registry_index (4,903 rows) + vcu_aggregates (2,116 rows). Worker endpoints: registry-index/import, vcu/import-aggregates, registry-index/search. clearskyplatform.html: API-fed registry browser (46KB, replaces 774KB embedded-data registry.html). VCU Intelligence tab: 4 KPI cards, sparkline bar chart 2019-2026, top buyer bars. Loading overlay + error handling. Commit 33a070e. |
| 2026-03-15 | v79a-ux-fixes | clearskyplatform.html: Download PD wired (crawler/run + pdd-status polling), Watershed inline filter, methodology dropdown with labels+count, country search, AFOLU removed from sidebar |
| 2026-03-15 | v79b-ux-rebuild | clearskyplatform.html: Full UX rewrite (840 lines). Category pills, Verra-style meth dropdown (36 labels), status strip, VCU column, Credit History panel tab with retRing+sparkline, DL_STEPS download flow, IS_EXTERNAL mode. Worker: pdd-status endpoint (worker-v79b.js). Language: no PABLO/Knowledge Library/crawler in user text. Commit cf28c91. |
| 2026-03-15 | v79c-category-pills-download-rfp | clearskyplatform.html + rfp-tracker.html + Worker. **FIX 1 — Category pills now filter correctly:** Added `deriveCat(r)` function — derives category from `afolu` column (for nature projects) and `methodology` regex patterns (for energy/waste/transport/CCS). Root cause: `project_category` column in verra_registry_index was always 'ALL' (import batch label), so CAT_MAP never matched. Category distribution: AFOLU 1,752 / Energy 2,682 / Waste 368 / Transport 100 / CCS 1. Changed loadData() line: `cat:r.project_category||'Other'` → `cat:deriveCat(r)`. **FIX 2 — Download flow: no pablo.html:** Modified pdd-status endpoint to return `crawl_doc_id` alongside `knowledge_doc_id`. Added GET /api/primitives/crawler/download/:crawl_doc_id — serves PDF from R2 with CORS headers (uses `...corsHeaders(request, env)`). Replaced finishDl() with inline "Download PDF" (link to crawler/download) and "View Text" (viewText function opens new window with markdown). Added viewText(docId): fetches /api/knowledge/docs/{id}, opens formatted text in new tab. Removed ALL pablo.html references from clearskyplatform.html (grep confirms 0 matches). **FIX 3 — Add to RFP Tracker pre-populates:** Added addToRfp(id): builds URLSearchParams (project_name, registry=verra, verra_id, methodology) and opens rfp-tracker.html. Updated Watershed callout button onclick to use addToRfp(row.id). Added checkUrlParams() to rfp-tracker.html: reads URL params, opens add project form, pre-fills ap-name, ap-registry, ap-notes (with Verra ID + methodology). Called from init() after loadRfps/selectRfp. **FIX 4 — PDs classified as registered examples:** Auto-extract INSERT now includes is_registered_example column. Looks up project_status from crawl_projects before INSERT. Sets is_registered_example=1 if project_status === 'Registered'. Also sets `project` column to registry_project_id (was 'unassociated'). Worker v79c deployed (Version ID: 1f7b1e4c-63bd-46ef-8ea5-3ebea5ff8a92). Frontend commit ba1fa8b. Snapshot: infrastructure/worker-v79c.js. |
| 2026-03-15 | v79d-vcu-intelligence | clearskyplatform.html + Worker. **Worker:** Added `safeJsonParse(str, fallback)` utility. Added GET /api/primitives/vcu/search — query params: buyer (JSON substring LIKE), project (exact ID or name LIKE), meth (LIKE), status (active=outstanding>0, retired=rr>=99), year_from, year_to, country, limit (max 500), offset. SQL: LEFT JOIN vcu_aggregates v + verra_registry_index r. Returns parsed issuance_trend (array) and top_buyers (array of [name,vol] pairs) via safeJsonParse. Added GET /api/primitives/vcu/market-totals — SUM(total_issued/retired/outstanding), COUNT. Top 10 buyers: fetches all top_buyers JSON strings, parses in JS, aggregates by name, sorts desc, slices 10. Health: v79d-vcu-intelligence. **Frontend:** Activated dimmed VCU Intelligence tab (removed `dim` class, added `onclick="showPage('vcu')"`). Added `showPage(pg)` function — toggles `.page.active` and `.ptab.active` classes, lazy-loads VCU data on first switch via `window.vcuLoaded` flag. Added `page-vcu` div with 3-column layout: sidebar (buyer search, status strip All/Active/Retired, vintage year range, country, methodology, reset button), main table (ID/Project/Issued/Retired/Active/Ret% columns with sort), detail panel (empty state + vcuPanelDetail). Added VCU state: `VDATA=[], VFILT=[], VS={status,sortCol,sortDir,selectedId}`. Functions: `loadVCUPage()` fetches vcu/search?limit=500 + maps project_id→id; `filterVCU()` client-side filter chain (status/project/country/meth/buyer/year); `setVCUStatus(s)` toggles status strip tabs; `sortVCU(col)` + `sortVCUApply()` toggle asc/desc sort; `renderVCU()` builds row HTML (max 500, color-coded Ret%); `selVCURow(id)` selects row + renders panel; `renderVCUPanel(id)` builds KPI grid (Issued/Retired/Outstanding/Vintage2022+), retirement ring SVG (color by threshold), issuance trend sparkline bars, top 5 buyer bars; `resetVCU()` clears all filters + state. Added helper functions: `fmtN(v)` (toLocaleString), `fmtK(v)` (B/M/K suffixes), `esc(s)` (HTML escape via textContent). **Fix:** API returns `project_id` not `id` — added `.map(function(r){r.id=r.project_id;return r;})` in loadVCUPage. Worker v79d deployed (Version ID: 1dcf3179-a6d1-43a6-a60e-4c0a01c0f184). Frontend commits 81b8935 + cacb81f. Snapshot: infrastructure/worker-v79d.js. Gotchas 71-74. |
| 2026-03-15 | v79e-vcu-perf | Worker + clearskyplatform.html. **FIX A — Lighter list payload:** vcu/search no longer returns issuance_trend or full top_buyers array. Returns `top_buyer_name` (first buyer name) and `top_buyer_vol` (first buyer volume) instead. Response: 87KB/200 rows (was 247KB/500 rows), per-row: 449B (was 594B). **FIX B — Detail endpoint:** Added GET /api/primitives/vcu/project/:id — returns single project with FULL data (issuance_trend + all buyers + proponent). renderVCUPanel() now fetches from detail endpoint with loading state + error handling. **FIX C — market-totals cache:** Added vcu_market_cache D1 table (migration 025). computeMarketTotals() helper function extracted. market-totals reads cache first (0.20s cached vs 1.4s live). Cache populated: (1) on first miss (cache-on-read), (2) after vcu/import-aggregates. **FIX D — Frontend updates:** filterVCU buyer search uses top_buyer_name instead of JSON.stringify(top_buyers). renderVCUPanel shows "Loading..." while fetching, error state on failure. Health: v79e-vcu-perf. Worker deployed (Version ID: 1aeb5291-581b-43d7-a8e2-6ca7c270d9a7). Frontend commit 2885c53. **FIX E — Buyer search all_buyers:** Added `all_buyers: parsedBuyers` to vcu/search list response. Changed filterVCU() buyer filter from `top_buyer_name` check to `JSON.stringify(r.all_buyers\|\|[]).toLowerCase().includes(buyer)` — now searches ALL buyers per project. Worker redeployed (Version ID: 3aff73d0). Frontend commit 2d7d901. Snapshot updated: infrastructure/worker-v79e.js. Gotcha 75 updated. **FIX F — VCU tab shows all 2116 projects:** Root cause: THREE caps at 500 — (1) worker vcu/search `Math.min(..., 500)` capped SQL LIMIT, (2) frontend loadVCUPage fetched `?limit=500`, (3) renderVCU `Math.min(VFILT.length, 500)` capped rendered rows. All three changed from 500 to 2500. Worker redeployed (Version ID: 90d0c3d0). Frontend commit 4728d2c. Gotchas 77-78. |
| 2026-03-15 | v79f-buyer-intelligence | Worker + clearskyplatform.html. **Worker:** GET /api/primitives/vcu/buyers — aggregates buyer data from vcu_aggregates.top_buyers JSON across all 2116 projects. Groups by buyer name, sums total_retired, collects unique methodologies/countries, builds project list sorted by vol. Filters: buyer (name substring), meth (methodology match), country. Returns top 200 buyers sorted by total_retired DESC. Projects capped at 20 per buyer in list. GET /api/primitives/vcu/buyers/:name — detail for single buyer (URL-encoded name), full project list, exact name match (case-insensitive). Health: v79f-buyer-intelligence. Worker deployed (Version ID: abeab287). Snapshot: infrastructure/worker-v79f.js. **Frontend:** By Buyer sub-tab added inside VCU Intelligence tab. setVCUSub() switches vProjectView/vBuyerView. Status/year/retirement filters hidden in buyer mode via vProjectOnlyFilters div. loadBuyers() lazy-loads on first tab switch (buyersLoaded flag). filterBuyers() wired to shared sidebar filters (buyer, meth, country). renderBuyers() shows sortable table (buyer name, total retired, project count, top methodology, top country, methodology chips via mCls()). selBuyerRow() + renderBuyerPanelData() shows buyer detail panel in the existing VCU panel area (KV grid with 4 cards, top 5 projects with percentage bars, methodology chips, countries list). filterVCU() returns early and calls filterBuyers() when VCU_SUB==='buyer'. Retirement rate filter added (vRetMin — min retirement %). Supply pressure column added to project table (outstanding / avg annual issuance = months of supply, color coded: <6mo red, <18mo amber, >=18mo green). sortVCU supports supply_months column. resetVCU() clears vRetMin + selBuyer. Frontend commit 6ddb7cd. Gotchas 79-81. |
| 2026-03-16 | v79i-demand-intelligence | Worker + clearskyplatform.html. **Worker:** BUYER_NORM (26 entries) — normalizes buyer name variants (e.g. 'Eni Upstream'→'Eni SpA', 'Marke VW Pkw'→'Volkswagen AG', 'CHEVRON PETROLEUM COMPANY'→'Chevron Corporation', 'Netflix'→'Netflix Inc.'). BUYER_SECTORS (65 entries) — maps canonical buyer names to sectors (Oil & Gas, Airlines, Automotive, Technology, Banking & Finance, Retail & Consumer, Energy & Utilities, Industrial, Government, NGO & Foundation, Other). normalizeBuyer(name) — applies BUYER_NORM, wired into computeMarketTotals(), vcu/buyers aggregation, vcu/buyers/:name detail. METH_GROUPS + getMethGroup(code) — maps methodology codes to 10 groups (REDD+, ARR, IFM, Blue Carbon, Biochar, Landfill Gas, Methane, Renewables, Savanna/Grassland, Other). sector field added to buyer objects in /vcu/buyers response. sector filter param added to /vcu/buyers. GET /api/primitives/vcu/demand-matrix — aggregates retirement volume by sector×methodology group from all vcu_aggregates rows. Returns {sectors[], methodologies[], matrix{sector→{meth→vol}}, top_buyers_by_sector{sector→[{name,vol}]}}. Health: v79i-demand-intelligence. Snapshot: infrastructure/worker-v79i.js. **Frontend:** Tab reorder — VCU Intelligence is now first/default tab, Project Browser is second (lazy-loaded via browserLoaded flag). showPage() updated: VCU=pages[0], browser=pages[1]. Boot: loadVCUPage() (was loadData()). loadData() sets window.browserLoaded=true on success. Topbar title: "Carbon Market Intelligence" (was "Project Intelligence Platform"). Demand Map sub-tab added ([By Project] [By Buyer] [Demand Map]). setVCUSub('map') shows vMapView, lazy-loads via mapLoaded flag. loadDemandMap() fetches /vcu/demand-matrix. renderDemandMap() builds sector×methodology heatmap table with cellColor() intensity scaling (teal opacity: 0.6/0.35/0.15/0.05), volume + row % per cell, sector label with top buyer name, row totals in amber. Data files: data/verra-registry/buyer_normalization.csv (26 entries), buyer_sectors.csv (65 entries), demand_matrix.json, buyers_v79i.json. Frontend commit 1734ecb. Gotchas 82-85. |
| 2026-03-16 | v79j-full-polish | Worker + clearskyplatform.html. **Worker:** top_buyer_by_cell added to /vcu/demand-matrix response — nested object {sector→{methGroup→{name,vol}}} tracking highest-volume buyer per cell. avg_annual_retirement + last_activity_year added to /vcu/buyers — tracks min_year/max_year per buyer from first/last_issuance_year, computes avg_annual = total_retired / years_span. Health: v79j-full-polish. Snapshot: infrastructure/worker-v79j.js. **Frontend 9 features:** (1) Demand map tfoot with column totals + grandTotal + row % share. (2) Cell hover tooltips using top_buyer_by_cell (sector→methodology, volume, top buyer name). (3) Methodology full-name legend in buyer detail panel (METH_LABELS[m] title + code→name legend below chips). (4) Export CSV button on buyer table (exportBuyerCSV() — Blob download of BUYER_FILTERED). (5) Buyer panel KV grid expanded to 3-col 6-card (added Avg per Project + Last Activity). (6) Sector filter dropdown (vSectorQ) in VCU sidebar, shown only in buyer mode via vBuyerOnlyFilters div. (7) Velocity column in buyer table (avg_annual_retirement/yr, sortable). (8) Last Active column in buyer table (last_activity_year, green if >=2024, sortable). (9) Demand map sector filter pills (filterDemandSector() + data-sector on rows). Buyer table colspan updated 6→8. Frontend commit 2c4ab0a. Gotchas 86-89. |
| 2026-03-16 | v79m-fix2 | Worker + clearskyplatform.html. **Worker:** BUYER_NORM_REVERSE auto-computed reverse map (canonical→[raw variants]). Rewrote /vcu/buyer-yearly/:name with reverse normalization — builds variants array (canonical + all raw names via BUYER_NORM_REVERSE), queries vcu_buyer_year_totals with IN clause, GROUP BY year. New endpoint GET /api/primitives/vcu/buyer-sector-yearly/:sector — per-company yearly data for a sector using reverse normalization. Returns {sector, companies:[{name, yearly:{2024:N,...}, retired_2024/2025/2026, trend, total_retired}]} sorted by retired_2025 DESC. Bug fix: removed ?yearly=1 code from /vcu/buyers (was fetching 54K rows). Bug fix: demand-matrix year-filtered query changed from raw rows to GROUP BY buyer_name,project_id with SUM(quantity) (was error 1102 on 68K rows). Health: v79m-fix2. Snapshot: infrastructure/worker-v79m.js. **Frontend F1-F6:** (F1) Remove "Load matches" button — auto-loads recommendations with spinner. (F1b) Remove "Score buyers" button — auto-loads buyer recs with setTimeout. (F2) Expand button — visible labeled button (Expand/Collapse text + icons), Escape key to collapse, .panel.expanded class toggle. (F3) Sector table — Promise.all fetches /vcu/buyers + /vcu/buyer-sector-yearly/:sector; renderSectorCompaniesWithYearly() shows 9 columns (Company, Lifetime, 2024, 2025, 2026, Projects, Top Method, Conc., Trend). Trend icons: ↑ green/↓ red/→ gray. (F4) Retirement bar chart — sp-bars height 120px normal / 180px expanded (CSS .panel.expanded .sp-bars{height:180px}). Bar min-height 6px. (F5) Top project bars — min 3% bar width, share percentage shown, bold volume. (F6) "Click to load companies" replaced with auto-spinner. Frontend commit 49fc62c. Gotchas 111-112. |
| 2026-03-16 | v79l-bloomberg-connected | Worker + clearskyplatform.html. **Worker W1-W6:** (W1) ALTER TABLE verra_registry_index ADD COLUMN clearsky_project INTEGER DEFAULT 0; seeded 10 ClearSky portfolio project IDs (9 found). (W2) METH_PLAIN object (29 entries) + methPlain(code) function — maps methodology codes to plain English labels. (W3) Enhanced /vcu/project/:id — adds clearsky_project (boolean), meth_label (via methPlain), vintage_breakdown (FIFO-allocated array of {year,issued,outstanding,retired}). computeVintageBreakdown(trend, totalRetired) — walks issuance_trend array from oldest vintage, allocates retirements FIFO. (W4) GET /api/primitives/vcu/match-projects/:buyer_name — decay-weighted scoring (2025×4, 2024×3, 2023×2, 2022×1, pre×0.5). 5 score components: meth (0-4), country (0-2), demand (0-2), size (0-1), recency (0-1). Returns market_matches (limit 15) + clearsky_matches (all). Each match includes vintage_breakdown, clearsky_project, meth_label. (W5) GET /api/primitives/vcu/match-buyers/:project_id — reverse scoring top 10 buyers for a project. Score: meth_match (0-4), country_match (0-2), recency (0-2), size_fit (0-1), demand_validation (0-1). Returns avg_annual_retirement, last_activity_year, sector, countries per buyer. (W6) GET /api/primitives/vcu/global-search?q= — searches buyers (top_buyers JSON), projects (verra_registry_index name/id), sectors (BUYER_SECTORS values). Max 3 per type. Health: v79l-bloomberg-connected. Snapshot: infrastructure/worker-v79l.js. **Frontend F1-F12:** (F1) Global search bar in topbar — debounced API call to global-search, dropdown with sector/buyer/project results, gotoBuyer/gotoProject/gotoSector navigation. (F2) Breadcrumb navigation — panelBreadcrumb array, pushBreadcrumb() wired into selBuyerRow + selVCURow + expandSector, navBreadcrumb() for back-navigation. (F3) Sticky headers — .ph position:sticky;top:0, .results-bar sticky. (F4) Sector accordion — demand map rows get id="mrow-{sk}" + onclick="expandSector()", expansion TR id="mexp-{sk}" with loadSectorCompanies() lazy-loading buyer table. sectorCompanyCache{}. (F5) API-backed recs — renderBuyerPanelData() replaces matchProjects() with lazy-load "Load matches" button calling loadRecs(name) → match-projects API. Renders market_matches + clearsky_matches with recRow(), scoreBar(), vintageBar(). (F6) Trend bars with value labels — buyerSparkline() shows fmtV volume above each bar + dashed avg line with avg value. (F7) Expandable methodology cards — replaces flat methodology chips. Each card shows code + label, onclick toggleMethCard() fetches match-projects and shows top 3 projects for that methodology. methCardCache{}. (F8) Market share % — renderVCUPanel() buyer rows show percentage of total + clickable names linking to buyer profile via gotoBuyer(). (F9) Find buyers — renderVCUPanel() adds "Score buyers" button calling loadBuyerRecs(projectId) → match-buyers API. renderBuyerRecs() shows scored buyers with reason + scoreBar. (F10) General CSV export — exportCSV(type,context) supports 4 types: buyers, buyer_profile, demand_matrix, project_buyers. exportBuyerCSV() delegates to exportCSV('buyers'). Export buttons added to buyer panel header + project panel. (F11) Similar buyers — getSimilarBuyers(name,sector,meths) filters BUYER_DATA by same sector or methodology overlap, shows top 4 in buyer panel. (F12) Sub-tab reorder — By Buyer is now first/default (was By Project). VCU_SUB='buyer', vBuyerView default display:flex, loadBuyers() in BOOT. Frontend commit 017901d. Gotchas 90-95. |

| 2026-03-16 | v79n-navigation-redesign | clearskyplatform.html (frontend only, no worker changes). **Two-pane layout:** Replaced fixed 3-column grid (210px+1fr+370px) with dynamic two-pane system. Three panel states: hidden (210px 1fr 0px), split (210px 38fr 62fr), full (0px 0px 1fr). CSS classes on `.page.active` (panel-split, panel-full). PANEL_STATE variable + setPanelState() function. openEntityPanel(renderFn) wrapper auto-transitions hidden→split on first entity selection. **Entity navigation:** Replaced breadcrumb+expand with entity-nav bar: ← Back button + context label + Expand/Collapse button. goBack() pops breadcrumb or closes panel at root. Escape: full→split→hidden. setEntityContext(['By Buyer','Shell']) updates context label. **Prominent navigation:** Page tabs sticky (z-index:50), 42px height, font-weight:600, 3px border-bottom. VCU sub-tabs: sticky (z-index:19), background:var(--bg2), badges with live counts (buyer count updated in loadBuyers). **Panel body split:** panel-body-top (flex-shrink:0, fixed header+KV grid, border-bottom) + panel-body-scroll (flex:1, overflow-y:auto). Applied to both renderBuyerPanelData and renderVCUPanel. Full-mode two-column: `.page.active.panel-full .panel-body-scroll{column-count:2;column-gap:24px}`. **Download CTAs:** downloadPDFNow(projectId) — checks pdd-status, serves R2 PDF if available, else opens Verra registry page + silently queues background crawl. generateIntelReport(projectId) — POST /crawler/run with 5-step progress (INTEL_STEPS), pollIntelStatus(), finishIntel() with Download PDF + View Report buttons. IS_EXTERNAL guard hides both CTAs. **Onboarding:** localStorage cs_visited_v1, showOnboardingTooltips() with 4 sequential tips (By Buyer, Demand Map, table click, panel expand). showOnbTip(i) with floating positioned tooltip + "Got it" button. fadeInTip CSS animation. .onb-tip CSS class. **Column tooltips:** title attributes on all 5 buyer table headers (Buyer, Total Retired, Velocity, Last Active, Projects). **Quick tips:** Educational empty state panel in vcuPanelEmpty with 4 tips (sector click, buyer click, ⌘K search, expand). Frontend commit 479530d. 2,400 lines, 148,491 bytes. Gotchas 113-118. |

---

*Last updated: 2026-03-16 by Claude (Opus 4.6)*
*Save to: `C:\brand-presentations\PABLO_CLAUDE.md` AND `C:\MITECO-ForestEngineer\PABLO_CLAUDE.md`*
*Also keep a copy in: `repos/oga-tools/PABLO_CLAUDE.md` (not deployed, gitignored optional)*
