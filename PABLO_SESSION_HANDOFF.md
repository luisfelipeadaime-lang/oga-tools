# PABLO Session Handoff — v79m-fix2
*Date: 2026-03-16*

---

## Current State Summary

**Worker version:** v79m-fix2
**Worker file:** `C:\brand-presentations\infrastructure\clearsky-api\src\worker.js`
**Snapshot:** `C:\brand-presentations\infrastructure\worker-v79m.js`
**Frontend:** `C:\brand-presentations\repos\oga-tools\tools\clearskyplatform.html` (commit 49fc62c)
**RFP Tracker:** `C:\brand-presentations\repos\oga-tools\tools\rfp-tracker.html` (commit ba1fa8b)
**Design System:** `C:\brand-presentations\repos\oga-tools\tools\pablo-system.css` (commit a46c220)
**Bulk Intake:** `C:\brand-presentations\repos\oga-tools\tools\crawler_test.html` v10 (commit 8f1aaa6)
**Live API:** `https://api-tools.oga.earth`
**Live frontend:** `https://tools.oga.earth/tools/clearskyplatform.html`

---

## All Primitives + Tools — COMPLETE

| Primitive | Version | Status |
|-----------|---------|--------|
| P1: Extraction | v60-v63, v70-v72, v74 | Mistral OCR primary, async jobs, Queues, scanned PDF detection, cancel/requeue, crawler extract |
| P2: Enrichment | v55c-v58, v73 | AI tagging, doc_class, dedup, normalizeRegistry |
| P3: Taxonomy | v64-v68, v73 | 3-axis vocab + registry_doc_type + normalizeRegistry canonical IDs |
| P4: Crawler | v65-v69, v74 | Verra + Puro + Isometric, R2, queue routing, input normalization, extract+sync pipeline |
| P5: RFP Tool | v75-v76 | 3 D1 tables, 7 endpoints, AI evaluation engine, Watershed 2026 seeded |
| P6: Project Metadata | v77 | project_metadata D1 table, fetchVerraProjectDetail, PD filter, registered examples |
| P7: Registry Platform | v78-v79m | clearskyplatform.html — full UX, 4,903 projects, VCU Intelligence tab (2,116 projects + Buyer Intelligence + Demand Map + Bloomberg-connected features), Download flow, RFP pre-populate, category pills |

---

## What Was Done: v79m-fix2 — Bug Fixes + UX Polish

### Worker Changes

| # | Component | Details |
|---|-----------|---------|
| W1 | **BUYER_NORM_REVERSE** | Auto-computed reverse map (canonical→[raw variants]). Built from BUYER_NORM entries. Enables querying vcu_buyer_year_totals by canonical name across all raw variants. |
| W2 | **buyer-yearly/:name rewrite** | Uses BUYER_NORM_REVERSE to build variants array (canonical + raw names), queries with IN clause + GROUP BY year. Falls back to LIKE if no results. Per-project breakdown also uses IN clause. |
| W3 | **buyer-sector-yearly/:sector** | New endpoint. Gets canonical buyer names from BUYER_SECTORS matching sector, builds allVariants with BUYER_NORM_REVERSE, queries vcu_buyer_year_totals. Returns per-company: {name, yearly, retired_2024/2025/2026, trend, total_retired}. Sorted by retired_2025 DESC. |
| W4 | **Bug fix: /vcu/buyers** | Removed ?yearly=1 code that fetched ALL 54,492 rows from vcu_buyer_year_totals (3.78s timeout). Yearly data now fetched lazily via /vcu/buyer-yearly/:name. |
| W5 | **Bug fix: demand-matrix** | Changed year-filtered query from raw row fetch (68K rows → error 1102) to GROUP BY buyer_name, project_id with SUM(quantity). |

### Frontend Changes (F1-F6)

| # | Feature | Details |
|---|---------|---------|
| F1 | **Remove "Load matches" button** | Auto-loads recommendations with spinner. loadRecs() and renderRecs() no longer reference btn elements. |
| F1b | **Remove "Score buyers" button** | Auto-loads buyer recs with spinner + setTimeout(loadBuyerRecs, 50). |
| F2 | **Expand button** | Visible labeled button (Expand/Collapse text + ↗/✖ icons). position:absolute in position:relative panel. Escape key handler to collapse. .panel.expanded class toggle on vcuPanel. |
| F3 | **Sector table with yearly** | Promise.all fetches /vcu/buyers + /vcu/buyer-sector-yearly/:sector. renderSectorCompaniesWithYearly() shows 9 columns (Company, Lifetime, 2024, 2025, 2026, Projects, Top Method, Conc., Trend). Trend icons: ↑ green/↓ red/→ gray. sectorCompanyCache stores {buyers, yearlyData}. |
| F4 | **Retirement bar chart** | sp-bars height 120px normal / 180px expanded (CSS .panel.expanded .sp-bars{height:180px}). Bar min-height 6px. Value labels above bars. |
| F5 | **Top project bars** | Min 3% bar width (Math.max(pct,3)), share percentage shown, bold volume, font-size 11.5px. |
| F6 | **Remove remaining Load CTAs** | "Click to load companies..." replaced with auto-spinner. All "Load" text removed (grep confirms 0 matches). |

### Gotchas Added (96-97)

96. BUYER_NORM_REVERSE — auto-computed reverse map. Used in buyer-yearly/:name and buyer-sector-yearly/:sector to query raw names in vcu_buyer_year_totals via IN clause.
97. vcu_buyer_year_totals stores RAW buyer names — never query by canonical name directly. Build variants array from BUYER_NORM_REVERSE.

---

## Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| Worker | v79m-fix2 deployed | Health: v79m-fix2 |
| Worker snapshot | worker-v79m.js | Saved in infrastructure/ |
| clearskyplatform.html | Deployed (49fc62c) | Live at tools.oga.earth |
| PABLO_CLAUDE.md | Updated | v79m-fix2 entry added |
| SYSTEM.md | Updated | Gotchas 96-97 |

---

## QA Results

| QA | Test | Result |
|----|------|--------|
| QA-1 | Health version | PASS (v79m-fix2) |
| QA-2 | /vcu/buyers?limit=3 | PASS (Shell 38.8M, Eni SpA 26.5M, DL 11.5M) |
| QA-3 | buyer-yearly/Shell | PASS (9 years, 39M total, 2018-2026) |
| QA-4 | buyer-yearly/Eni SpA | PASS (7 years, 26.6M total, reverse norm combines Eni Upstream + Eni Plenitude) |
| QA-5 | buyer-sector-yearly/Oil & Gas | PASS (6 companies, top: Shell 10.9M 2024) |
| QA-6 | buyer-sector-yearly/Energy & Utilities | PASS (7 companies, top: EnergyAustralia 640K 2025) |
| QA-7 | demand-matrix | PASS (11 sectors, no error 1102) |
| QA-8 | buyer-yearly/DL | PASS (3 years, 13.1M total) |
| QA-9 | No remaining "Load" CTAs | PASS (grep: 0 matches) |

---

## Quick Reference

### Deploy Worker
```bash
cd C:\brand-presentations\infrastructure\clearsky-api
npx wrangler deploy
curl -H "Origin: https://tools.oga.earth" https://api-tools.oga.earth/health
```

### Deploy Frontend
```bash
cd C:\brand-presentations\repos\oga-tools
git add tools/clearskyplatform.html
git commit -m "feat: ..."
git push
```

### Test New Endpoints
```bash
curl -s "https://api-tools.oga.earth/api/primitives/vcu/buyer-sector-yearly/Oil%20%26%20Gas" -o tmp.txt && python -c "import json;d=json.load(open('tmp.txt','r',encoding='utf-8'));print(d['status'],len(d['companies']))"
curl -s "https://api-tools.oga.earth/api/primitives/vcu/buyer-yearly/Shell" -o tmp.txt && python -c "import json;d=json.load(open('tmp.txt','r',encoding='utf-8'));print(d['status'],d['total'],len(d['yearly']))"
curl -s "https://api-tools.oga.earth/api/primitives/vcu/demand-matrix" -o tmp.txt && python -c "import json;d=json.load(open('tmp.txt','r',encoding='utf-8'));print(d['status'])"
```

### Key Counts
- vcu_aggregates: 2,116 projects
- vcu_buyer_yearly: 68,573 rows (raw buyer names)
- vcu_buyer_year_totals: 54,492 rows (raw buyer names)
- verra_registry_index: 4,903 projects (1,521 Registered)
- ClearSky portfolio: 9 projects flagged (of 10 seeded IDs)
- Buyer normalization: 26 variant→canonical mappings (BUYER_NORM + BUYER_NORM_REVERSE)
- Buyer sectors: 65 classified, 11 sector categories
- METH_PLAIN: 29 methodology labels
- Top buyers (normalized): Shell (38.8M), Eni SpA (26.5M), DL (11.5M)
- Demand matrix: Oil & Gas REDD+ = 42.2M (largest cell)
- Buyer table: 8 columns
- Frontend: 2,183 lines, 102 functions, 137,342 bytes
