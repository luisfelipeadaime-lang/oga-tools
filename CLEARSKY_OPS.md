# ClearSky Operations & Team Dynamics
**Last updated:** 2026-03-17 | **Author:** Luis Felipe Adaime (CCO)

---

## 1. Team Dynamics

### Communication Style
- **Luis**: Direct, technical, expects tools to work without explanation. Builds and operates all infrastructure personally via Claude Code. Reviews every deployment. Prefers data-driven answers over qualitative assessments.
- **Ana**: Highest commercial volume (45 threads/mo). Primary user of HubSpot for contact management. Needs tools that surface who to contact next and why.
- **Carolina**: Second-highest commercial volume. Works European market alongside Ana.
- **Brian/Keith/Bobbie**: Leading Carbon team (Canadian office). North American + Canadian compliance markets. Use tools for buyer intelligence and project matching. Keith has key relationships in Canadian compliance.
- **Emmanuel**: Operations focus. Handles MITECO filings, project documentation, Amoedo-specific tasks. Less commercial, more project delivery.

### Internal Domains
- clearskyltd.com (ClearSky UK)
- leadingcarbon.com (Leading Carbon, Canadian affiliate)
- maboroshi.com (Support/admin)

**Rule:** Emails between these 3 domains are ALWAYS internal. Thread classification uses this for the `internal` category.

## 2. Communication Rules

### Internal Tool Access
- All internal tools live at tools.oga.earth
- pablo.html is the internal OS shell (absorbs revenue, dashboard, call logger, wiki over time)
- External/client tools (clearskyplatform.html, future buyer portal) stay standalone
- **NEVER deploy internal tools to clearskyltd.com** (that's the corporate site)
- **NEVER create `functions/` folder in oga-tools repo** (breaks Cloudflare Pages)

### Tool Naming Rules
- User-facing text: NEVER use "PABLO", "Knowledge Library", or "crawler"
- clearskyplatform.html: "Carbon Market Intelligence" / "Project Intelligence Platform"
- Internal tools can reference PABLO by name
- All tool titles: "CLEARSKY | Tool Name" format

### Data Visibility Rules
- Internal tools can show all data (thread classifications, rep names, engagement scores)
- External tools (?mode=external): hide internal CTAs, rep attribution, commercial intelligence
- ClearSky portfolio projects identified by clearsky_project=1 in verra_registry_index

## 3. HubSpot Credibility Requirements

### Data Freshness
The team will NOT trust tool data unless:
1. **Sync timestamp is visible** — every page shows "Last sync: Xm ago" in topbar
2. **Contacts cache < 3 days old** — red warning banner if stale
3. **Thread data < 24h** — thread classifications must reflect recent emails
4. **Engagement enrichment runs after every sync** — without this, engagement_score is NULL

### Known Data Quality Issues
| Issue | Impact | Status |
|-------|--------|--------|
| HubSpot v1 engagements API deprecated | May return stale data, latest thread is 2026-03-12 despite daily cron | Needs v3 migration |
| GET /api/hubspot/sync does INSERT OR REPLACE | Resets engagement_score to NULL | Must run enrich-contacts after |
| company_name NULL on 911/1128 threads | Can't group threads by company | Resolved via backfill-participants |
| 386 threads (34.2%) classified as unknown | Missing commercial signal | Batch Claude Haiku would fix |
| Contacts cache was 20 days stale | All engagement data was outdated | Manually refreshed, needs cron |

### Trust Sequence
For any new data display to be trusted by the team:
1. Show the data source and last-updated timestamp
2. Show rep names they recognize (not owner IDs)
3. Match numbers they can verify against HubSpot manually
4. Don't show zeros where they expect data — better to hide the metric

## 4. Data Freshness Prerequisites (Daily Email)

Before the daily email can ship, ALL of these must be true:
- [ ] `syncHubSpotContacts(env)` function exists and runs in cron
- [ ] `syncHubSpotDeals(env)` function exists and runs in cron
- [ ] `enrich-contacts` runs automatically after contacts sync (not manual trigger)
- [ ] Thread sync uses v3 API (or v1 returns data < 24h old)
- [ ] `rep-summary` endpoint returns accurate data (verified against manual HubSpot check)
- [ ] Email delivery mechanism chosen and tested (HubSpot transactional / SendGrid)

### Cron Schedule (current)
```
0 2 * * *  →  syncHubSpotBatch() only (threads)
```
Missing: contacts refresh, companies refresh, deals refresh, enrich-contacts, rep-summary cache

### Cron Schedule (target)
```
0 2 * * *  →  syncHubSpotBatch()     (threads — incremental)
             →  syncHubSpotContacts()  (contacts — full refresh)
             →  syncHubSpotDeals()     (deals — full refresh)
             →  enrichContacts()       (commercial_thread_count, assigned_rep)
             →  cacheRepSummary()      (for daily email + dashboard)
0 5 * * *  →  sendDailyEmail()        (7am Madrid = 5am UTC)
```

## 5. Build Sequencing Rules

### Dependencies
```
Thread Classification (v79x) ✅
  → Contact Enrichment (v79y) ✅
    → Rep Summary (v79y) ✅
      → revenue.html wiring (v79z) ✅
        → Cron contacts/deals refresh (NEXT)
          → Daily Email (BLOCKED on cron)
          → Company Table (BLOCKED on cron)
```

### Standing Rules for Build Order
1. **Worker first, frontend second** — never build UI for endpoints that don't exist
2. **Data freshness before features** — no point showing stale data in a new format
3. **Single source of truth** — all business logic in Worker, never duplicated in frontend JS
4. **Verify before shipping** — headless test or API curl before announcing to team
5. **No internal tools on clearskyltd.com** — oga-tools repo only for tools.oga.earth

### What NOT to Build Next
- Apollo integration (daily email doesn't need it)
- More VCU intelligence features (platform is already comprehensive)
- New standalone HTML tools (consolidate into pablo.html instead)
- Mobile optimization (team uses desktop exclusively)

## 6. Deployment Checklist

### Worker Deploy
```bash
cd C:\brand-presentations\infrastructure\clearsky-api
npx wrangler deploy
# Wait 1-15 min for propagation
curl https://api-tools.oga.earth/health  # Check version marker
```

### Frontend Deploy
```bash
cd C:\brand-presentations\repos\oga-tools
git add [specific files]
git commit -m "feat: description"
git push
# Auto-deploys to tools.oga.earth via Cloudflare Pages
```

### Post-Deploy Verification
1. Check health endpoint version marker matches expected
2. Hit the specific endpoint that changed
3. Open the frontend page in browser (not just local)
4. Verify sync timestamp shows recent data
5. Check browser console for errors

### Recovery
- Worker rollback: `cp infrastructure/worker-v{PREV}.js infrastructure/clearsky-api/src/worker.js && npx wrangler deploy`
- Frontend rollback: `git revert HEAD && git push`

## 7. Incident Log

### Ana Shadow Tool Incident
**What happened:** Ana was using a separate/outdated version of a tool that showed different data than the current live version. This created confusion about data accuracy and trust in the platform.

**Root cause:** Multiple HTML files for similar functionality, no clear indication of which is canonical.

**Resolution:**
- All internal tools consolidated under tools.oga.earth (oga-tools repo)
- Each tool has exactly one canonical HTML file
- pablo.html is the internal OS shell — new features go there, not as standalone tools
- Standing Rule: external tools (clearskyplatform.html) stay standalone but consume Worker endpoints only

**Lesson:** Tool fragmentation creates trust issues. One canonical source per function.

## 8. Internal vs External Tool Matrix

| Tool | Location | Audience | Notes |
|------|----------|----------|-------|
| pablo.html | tools.oga.earth/tools/pablo.html | Internal only | OS shell for all internal tools |
| revenue.html | tools.oga.earth/tools/revenue.html | Internal only | Revenue command center |
| dashboard.html | tools.oga.earth/tools/dashboard.html | Internal only | Team dashboard |
| clearskyplatform.html | tools.oga.earth/tools/clearskyplatform.html | External + Internal | Carbon Market Intelligence (?mode=external hides internal CTAs) |
| rfp-tracker.html | tools.oga.earth/tools/rfp-tracker.html | Internal only | RFP management |
| clearsky-admin.html | tools.oga.earth/tools/clearsky-admin.html | Internal (password-gated) | Portfolio admin |
| crawler_test.html | tools.oga.earth/tools/crawler_test.html | Internal only | Bulk intake hub |
| wiki.html | tools.oga.earth/tools/wiki.html | Internal only | Knowledge wiki Q&A |
