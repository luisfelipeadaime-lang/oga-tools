# PLATFORM.md — ClearSky Platform Architecture
**Created:** 2026-03-17 | **Author:** Luis Felipe Adaime

---

## 1. VISION

Three-layer architecture separating personal OS, shared platform primitives,
and tenant-specific operator shells:

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 3 — TENANT OPERATOR SHELLS                       │
│  pablo.html (ClearSky) │ andover.html (future) │ ...    │
│  Each tenant gets a full operator workspace              │
├─────────────────────────────────────────────────────────┤
│  LAYER 2 — MULTI-TENANT PLATFORM                        │
│  Cloudflare Worker + D1 + R2                             │
│  Shared primitives: extraction, crawling, taxonomy,      │
│  HubSpot sync, knowledge library, AI enrichment          │
│  Tenant isolation via tenant_id column                   │
├─────────────────────────────────────────────────────────┤
│  LAYER 1 — PERSONAL OS                                  │
│  OpenClaw on VPS (lfa.oga.earth)                         │
│  WhatsApp/Telegram, daily briefings, custody calendar,   │
│  personal skills, memory layer                           │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**
1. **OpenClaw for personal OS** — do not build custom agent runtime. OpenClaw is open source, handles WhatsApp/memory/skills out of the box.
2. **tenant_id migration before second client** — add tenant_id to D1 tables before Andover onboarding, not after.
3. **Proprietary layer is the moat** — HubSpot classifier + registry intelligence + carbon taxonomy + extraction pipeline are genuine differentiators. Keep building.

---

## 2. LAYER 1 — PERSONAL OS (OpenClaw)

### What is OpenClaw
Open-source personal AI agent platform. Handles:
- Multi-channel messaging (WhatsApp, Telegram, Signal, SMS)
- Persistent memory (Markdown files, vector search)
- Skill execution runtime (custom skills in Python/JS)
- Agent dispatch and tool use
- Dashboard at custom domain

### Why OpenClaw (not custom)
| Requirement | OpenClaw | Custom build |
|-------------|----------|-------------|
| WhatsApp integration | Built-in (Baileys) | 2-3 sessions to build |
| Memory persistence | Built-in (Markdown + vector) | Need to design from scratch |
| Skill runtime | Built-in (hot-reload) | Custom execution engine |
| Multi-channel | Built-in (5+ channels) | Build each adapter |
| Maintenance | Community-maintained | Personal maintenance burden |

### lfa.oga.earth plan
- **Hosting:** DigitalOcean VPS ($6/mo droplet) — always-on, not local machine
- **Domain:** lfa.oga.earth (personal subdomain, single-level for Cloudflare SSL)
- **Channels:** WhatsApp (primary), Telegram (secondary)
- **Skills to build:**
  1. `daily-briefing` — calls `/api/hubspot/rep-summary` + `/api/primitives/vcu/market-totals`
  2. `project-status` — calls `/api/pablo/projects` for portfolio snapshot
  3. `custody-calendar` — personal calendar integration

### What stays in Worker, not OpenClaw
- All business logic (classification, scoring, enrichment)
- All D1/R2 data access
- All extraction pipeline
- OpenClaw skills CALL Worker endpoints — they don't duplicate logic

---

## 3. LAYER 2 — MULTI-TENANT PLATFORM (Cloudflare Worker + D1 + R2)

### Current state: single-tenant
All tables have implicit `tenant_id='clearsky'`. No tenant isolation column exists.
This works fine for ClearSky-only. Must change before second tenant.

### Shared primitives (tenant-agnostic)
These work for ANY carbon market tenant without modification:

| Primitive | Endpoint Pattern | What it does |
|-----------|-----------------|--------------|
| Document extraction | POST /api/primitives/extract | Mistral OCR + Claude fallback pipeline |
| Registry crawling | POST /api/primitives/crawler/run | Verra VCS OData, Puro.earth stub |
| Document taxonomy | GET /api/primitives/taxonomy/search | Classification + search |
| Knowledge library | POST /api/knowledge/ingest | Upload + extract + AI enrich |
| AI enrichment | (internal) enrichKnowledgeDocAI() | Auto-classify, tag, summarize |
| Project metadata | GET /api/primitives/project-metadata | Registry project detail cache |

### Tenant-scoped services
These REQUIRE tenant_id isolation:

| Service | Why tenant-scoped |
|---------|-------------------|
| HubSpot sync | Each tenant has own HubSpot token |
| Project pipeline | Tenant's active projects |
| Knowledge docs | Tenant's uploaded documents |
| RFP tracker | Tenant's RFP evaluations |
| Revenue/deals | Tenant's commercial data |
| Operator shell | Tenant's UI configuration |

### Primitives namespace
All shared primitives live under `/api/primitives/` — this namespace is explicitly
NOT tenant-scoped. Tenant-scoped endpoints live under `/api/{tool}/` or `/api/hubspot/`.

---

## 4. MULTI-TENANT DATA MODEL

### Migration plan (Week 2)

#### Step 1: Add tenant_id column
```sql
-- Surgical migration — add column with default, no data loss
ALTER TABLE knowledge_docs ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
ALTER TABLE hubspot_threads ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
ALTER TABLE hubspot_contacts_cache ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
ALTER TABLE hubspot_companies_cache ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
ALTER TABLE hubspot_deals_cache ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
ALTER TABLE crawl_runs ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
ALTER TABLE rfps ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
ALTER TABLE rfp_projects ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
-- Projects table already has 'tool' column — tenant_id adds isolation layer
ALTER TABLE projects ADD COLUMN tenant_id TEXT DEFAULT 'clearsky';
```

#### Step 2: Create tenants table
```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,              -- 'clearsky', 'andover', etc.
  name TEXT NOT NULL,               -- 'ClearSky Limited'
  domain TEXT,                      -- 'clearskyltd.com'
  hubspot_token_key TEXT,           -- Wrangler secret name: HUBSPOT_TOKEN_CLEARSKY
  config TEXT,                      -- JSON: modules enabled, branding, etc.
  created_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1
);

INSERT INTO tenants (id, name, domain, hubspot_token_key)
VALUES ('clearsky', 'ClearSky Limited', 'clearskyltd.com', 'HUBSPOT_API_KEY');
```

#### Step 3: Update Worker routing
```javascript
// Extract tenant from request (header, subdomain, or query param)
function getTenantId(request, env) {
  // Option A: X-Tenant-Id header (for API calls)
  const header = request.headers.get('X-Tenant-Id');
  if (header) return header;
  // Option B: default to 'clearsky' during migration
  return 'clearsky';
}

// All tenant-scoped queries add WHERE tenant_id = ?
const docs = await env.DB.prepare(
  'SELECT * FROM knowledge_docs WHERE tenant_id = ? AND ...'
).bind(tenantId, ...).all();
```

#### Step 4: R2 key namespacing
```
Current:  hubspot/threads/{id}.json
Future:   clearsky/hubspot/threads/{id}.json
          andover/hubspot/threads/{id}.json
```

### Cloudflare Workers for Platforms (future, not now)
If a second tenant needs custom code execution, migrate to Workers for Platforms.
Current single-Worker architecture is sufficient for 2-3 tenants with data isolation only.

---

## 5. LAYER 3 — TENANT OPERATOR SHELLS

### The pablo-pattern
Each tenant gets an operator shell following the pablo.html pattern:
- Sidebar nav with tenant's modules
- Stats bar showing tenant KPIs
- Three-column layout (list / detail / tasks)
- Agent dispatch bar
- HubSpot inbox (if tenant has HubSpot)
- Knowledge library (tenant-scoped)
- Project pipeline (tenant domain-specific)

### Current shells
| Shell | Tenant | Status | Access |
|-------|--------|--------|--------|
| pablo.html | ClearSky | Live | Luis only |
| revenue.html | ClearSky | Live | ClearSky team |
| dashboard.html | ClearSky | Live | ClearSky team |
| clearskyplatform.html | ClearSky (-> clients) | Live | Internal + future external |
| lfa.oga.earth | Personal | In development | Luis only |

### Andover Consultores shell (future)
When ready: andover.html or andover.oga.earth
Reuses: Worker endpoints (with tenant_id='andover'), extraction primitives,
crawling primitives, same dark UI skill
Requires: Andover HubSpot token (or alternative CRM), Andover project types
Build time with primitives in place: 1-2 sessions vs weeks from scratch

### Shell onboarding checklist (for any new tenant)
- [ ] Add tenant to tenants table
- [ ] Add tenant secrets to Wrangler (HUBSPOT_TOKEN_{TENANT} etc.)
- [ ] Backfill tenant_id on any imported data
- [ ] Create operator shell HTML using frontend-dark-ui.skill + clearsky-brand.skill
- [ ] Configure sidebar modules for tenant domain
- [ ] Add tenant to PLATFORM.md shells table

---

## 6. PROPRIETARY LAYER (what NOT to replace with open source)

These are the genuine differentiators. External tools don't have carbon market
domain context. Protect and keep building:

| Component | Why proprietary | Status |
|-----------|----------------|--------|
| HubSpot classification engine | 5-tier contact + 9-category thread classifier tuned for carbon market | Live v79x |
| Carbon registry intelligence | 4,903 Verra projects, VCU demand matrix, buyer scoring, METH_GROUPS | Live v79m |
| MITECO/Puro/Verra document taxonomy | Carbon-specific doc types, registry classifier, 25 patterns | Live v64 |
| Extraction pipeline | Mistral OCR tuned for carbon PDFs, DOCX 3-layer, scanned PDF detection | Live v72 |
| Buyer profiling engine | AI relationship summaries from HubSpot email history | Live revenue.html |
| Rep attribution model | Infers ClearSky rep ownership from thread participant patterns | Live v79y |

---

## 7. WHAT TO USE FROM OPEN SOURCE (don't reinvent)

| Need | Use | Instead of building |
|------|-----|-------------------|
| Personal agent OS | OpenClaw | Custom lfa agent runtime |
| Multi-tenant isolation | Cloudflare Workers for Platforms (when needed) | Custom tenant routing from scratch |
| Presentation generation (generic) | Gamma.app / Beautiful.ai for non-branded | Custom PPTX for generic decks |
| Agent memory | OpenClaw built-in (Markdown files) | Custom memory system |
| Channel routing (WhatsApp/Telegram) | OpenClaw built-in | Custom WhatsApp integration |
| Skill execution runtime | OpenClaw built-in | Custom skill runner |

---

## 8. GAMEPLAN (sequenced)

### Week 1 — Technical debt + data trust
- [x] v79z2: v3 HubSpot API migration (close 5-day thread gap) — DONE 2026-03-18
- [x] v79z2: cron every 4 hours (0 */4 * * *) — DONE 2026-03-18
- [x] v79z2: visible sync timestamp on revenue.html + dashboard.html — DONE 2026-03-18
- [x] v79z2: pipeline/deal sync fix (revenue.html $0 -> real pipeline value) — DONE 2026-03-18
- [ ] Ana/Carolina walkthrough (30 min, show existing tools)

### Week 2 — Multi-tenant foundation
- [ ] Add tenant_id to D1 tables (surgical migration, ClearSky default)
- [ ] Create tenants table
- [ ] Update Worker routing to be tenant-aware
- [ ] R2 key namespacing by tenant
- [ ] Verify ClearSky still works, Andover can be onboarded

### Week 3 — OpenClaw personal OS
- [ ] Install OpenClaw on VPS (DigitalOcean $6/mo droplet)
- [ ] Connect WhatsApp channel
- [ ] Build daily-briefing skill (calls /api/hubspot/rep-summary)
- [ ] Build project-status skill (calls /api/pablo/projects)
- [ ] Build custody-calendar skill (calls personal calendar)
- [ ] lfa.oga.earth = OpenClaw management dashboard

### Week 3b — presentations-v3.html hardening (after OpenClaw install)
- [ ] Add manual text paste input path (toggle: Upload / Paste text)
- [ ] Wrap all Mistral OCR calls in try/catch with 30s timeout + native fallback
- [ ] Wrap all Claude calls in try/catch with 30s timeout + raw text fallback
- [ ] Add degradation banner component (reusable for all tools)
- [ ] Add platform_state table to D1 + credits-exhausted detection in Worker
- [ ] Add POST /api/admin/reset-ai-status endpoint
- [ ] Test all three input paths end-to-end

### Week 4+ — Team-facing improvements
- [ ] Daily email briefing (Ana + Carolina, 7am Mon-Fri)
- [ ] Simplified company table (T1/T2/New, Excel export)
- [ ] CRM v2 call prep sheets on revenue.html
- [ ] Buyer Intel auto-refresh in nightly cron
- [ ] Andover Consultores tenant shell (when ready)

---

## 9. OPEN QUESTIONS

- [ ] OpenClaw hosting: local machine vs VPS? VPS is always-on, recommended.
- [ ] Andover Consultores: what CRM do they use? HubSpot or other?
- [ ] Tenant isolation level: row-level (tenant_id column) sufficient, or need separate D1 databases per tenant?
- [ ] lfa.oga.earth scope: what personal contexts beyond work? (health, finances, custody, social)
- [ ] Skills to convert to OpenClaw format: which of the 7 existing skills are most useful as OpenClaw skills first?

---

## 10. DOCUMENTATION UPDATE PROTOCOL

After any session that touches platform architecture, tenant model, or gameplan:
Add a dated entry to this file's changelog and update the relevant section.
Mirror to: C:\brand-presentations\PLATFORM.md

### Changelog
| Date | Entry |
|------|-------|
| 2026-03-18 | v79z3-crm-platform: CRM tab added as first tab on clearskyplatform.html. Worker endpoints: contacts-view (company-grouped, idle_days, deals), contact-lists CRUD. Frontend: preloadCRM boot, company accordion, status/owner/text filters, buyer panel CRM section, radarCard CRM badge, openBuyerFromCRM fuzzy match, CSV export. 513 companies, 1,168 contacts loaded. |
| 2026-03-18 | v79z2-unified: Week 1 technical debt completed. v1→v3 HubSpot email migration, cron every 4h with contacts+deals+enrich, sync timestamps on frontends, pipeline value fallback. Thread gap closed (Mar 12 → Mar 18). |
| 2026-03-17 | File created. Three-layer architecture defined. OpenClaw adoption decision for personal OS. Multi-tenant migration plan for Week 2. Proprietary layer inventory. Full gameplan Weeks 1-4. |

---
*Mirror to: C:\brand-presentations\PLATFORM.md and C:\MITECO-ForestEngineer\PLATFORM.md*
