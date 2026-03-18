# ClearSky Commercial Strategy
**Last updated:** 2026-03-17 | **Author:** Luis Felipe Adaime (CCO)

---

## 1. Company Overview

| Field | Value |
|-------|-------|
| Legal Entity (UK) | ClearSky Limited |
| Legal Entity (Spain) | ClearSky Carbono S.L. |
| Address (Spain) | Calle O'Donnell, 18 - Piso 7 I J, 28009 Madrid |
| Position | Carbon market intelligence + project development + buyer services |
| Primary Registry | Verra VCS (4,903 projects indexed) |
| Portfolio Projects | 10 (Amoedo, Bosquia, NatureBrain, Marakoa, Elysium, Enersol, Aperam, REDENOR + 2 others) |

## 2. Team Roles

| Name | Role | Focus | Rep Color |
|------|------|-------|-----------|
| Luis Adaime | CCO | Strategy, platform, key accounts, all tool development | Gold (#f59e0b) |
| Ana Avramovic | Commercial Lead | Highest commercial thread volume (45/mo), buyer outreach | Purple (#a855f7) |
| Carolina Martinez | Commercial | 24 commercial threads/mo, buyer relationships | Blue (#3b82f6) |
| Brian Katz | Commercial (Leading Carbon) | 25 commercial threads/mo, North American market | Green (#22c55e) |
| Bobbie Armstrong | Commercial (Leading Carbon) | 22 commercial threads/mo | Pink (#ec4899) |
| Keith Driver | Commercial (Leading Carbon) | Canadian compliance markets, key relationships | Indigo (#6366f1) |
| Emmanuel Mendoza | Operations | Project operations, Amoedo/MITECO filing | Orange (#f97316) |
| Bart Alexander | Commercial (Leading Carbon) | Market development | — |

### HubSpot Owner IDs
Luis=82916631, Ana=30909325, Carolina=31091907, Brian=30080717, Keith=30233968, Bobbie=30233941, Bart=30233972, Emmanuel=31199673

**CRITICAL:** 146823759 is WRONG for Luis. Correct: 82916631.

## 3. Tool-to-Bottleneck Map

| Bottleneck | Tool | Status | Impact |
|-----------|------|--------|--------|
| "Who is buying what and when?" | clearskyplatform.html (VCU Intelligence) | Live | 2,116 projects with VCU data, buyer profiles, demand matrix, sector analysis |
| "Which buyers match our projects?" | clearskyplatform.html (Match Engine) | Live | Decay-weighted scoring: meth(0-4), country(0-2), demand(0-2), size(0-1), recency(0-1) |
| "Are we reaching the right people?" | HubSpot Classification (v79x) | Live | 1,128 threads classified, 9 categories, rep attribution, commercial_active/prospecting split |
| "How active is each rep?" | rep-summary endpoint + revenue.html | Live | Per-rep commercial thread counts, unique counterparties, 30d/7d windows |
| "What docs does this project need?" | RFP Tracker (rfp-tracker.html) | Live | Watershed 2026 seeded (7 RFP types), per-criterion AI evaluation (Sonnet), supply doc management |
| "What does the market look like?" | Demand Matrix (clearskyplatform.html) | Live | Sector x methodology heatmap, Lorenz concentration, HHI index |
| "Daily status email" | **Not yet built** | Planned | Requires: thread sync < 24h stale, contacts enriched, rep-summary wired to email template |
| "Company-level view" | **Not yet built** | Planned | Requires: company table with deal stage, last touch, assigned rep, thread history |

## 4. Daily Email Specification (Planned)

### Prerequisites
- [ ] Cron contacts/deals refresh (syncHubSpotContacts + syncHubSpotDeals functions — DO NOT EXIST yet)
- [ ] Thread sync < 24h stale (currently cron only does threads, contacts go stale)
- [ ] POST /api/hubspot/enrich-contacts runs after every sync (or wired into cron)

### Content Blocks
1. **Activity Summary** — Total commercial threads (active + prospecting) vs 7d ago
2. **Per-Rep Scorecard** — Name, commercial_active count, commercial_prospecting count, unique counterparties
3. **Hot Threads** — Top 5 commercial_active threads (newest first), with counterparty + subject + last touch
4. **Stale Alerts** — Commercial threads with no activity > 7 days
5. **New Contacts** — Contacts classified as commercial_buyer in last 24h
6. **Pipeline Snapshot** — Deal count by stage (from hubspot_deals_cache)

### Delivery
- Worker cron trigger (daily at 7am Madrid time = 5am UTC)
- Build HTML email body in Worker
- Send via HubSpot transactional email API or SendGrid
- Recipients: Luis, Ana, Carolina, Brian

## 5. Company Table Specification (Planned)

### Data Sources
- hubspot_companies_cache (company name, domain, industry, country)
- hubspot_contacts_cache (contacts per company, enriched with commercial_thread_count)
- hubspot_deals_cache (deals per company, stage, amount)
- hubspot_threads (thread_type, project_tag per company)
- vcu_aggregates (retirement history if buyer is in Verra data)

### Columns
| Column | Source | Notes |
|--------|--------|-------|
| Company | hubspot_companies_cache.name | |
| Sector | BUYER_SECTORS map or industry | |
| Assigned Rep | Most frequent assigned_rep_email across contacts | |
| Deal Stage | Latest deal from hubspot_deals_cache | |
| Last Commercial Touch | MAX(last_commercial_touch) across company contacts | |
| Commercial Threads | SUM(commercial_thread_count) across company contacts | |
| VCU Retirement History | vcu_aggregates match by company domain/name | If buyer exists in Verra data |
| Tier | Auto-tier logic (T1/T2/T3) | |

### Auto-Tier Logic
- **T1**: engagement_score > 100 OR known T1 company OR active deal
- **T2**: engagement_score > 30 OR has_inbound_reply=1 OR meeting_count_60d > 0
- **T3**: everything else

## 6. Apollo Feedback / External Data Integration

### Current State
- No Apollo integration exists
- Contact enrichment is entirely from HubSpot properties
- Company enrichment is from HubSpot companies cache
- Buyer intelligence comes from Verra VCU retirement data (public)

### Potential Enrichment Sources
- Apollo.io: company size, funding, tech stack, direct dials
- LinkedIn Sales Navigator: company news, job changes, connections
- Verra public data: already integrated (4,903 projects, 317K VCU rows)
- CORSIA eligible credits list: would identify aviation compliance buyers

## 7. Open Decisions

| Decision | Options | Impact |
|----------|---------|--------|
| Daily email delivery method | HubSpot transactional vs SendGrid vs SES | SendGrid cheapest, HubSpot keeps everything in one system |
| Company table location | New standalone tool vs pablo.html tab vs revenue.html panel | pablo.html tab keeps internal tools consolidated |
| Apollo integration priority | Now vs after daily email | Daily email doesn't need Apollo — do email first |
| Cron contacts/deals refresh | Add to existing cron vs separate cron | Same cron, after thread sync (sequential) |
| Thread sync staleness | v1 engagements API (deprecated) vs v3 timeline API | v3 is the right answer but requires migration |
| Unknown thread classification | Batch Claude Haiku vs leave as unknown | 386 unknown threads (34.2%), 67 involve Luis — worth classifying |

## 8. Key Metrics (as of 2026-03-17)

| Metric | Value |
|--------|-------|
| HubSpot threads synced | 1,128 |
| Threads involving Luis | 343 |
| Commercial active threads | 108 (9.6%) |
| Commercial prospecting threads | 210 (18.6%) |
| Internal threads | 276 (24.5%) |
| Unknown/unclassified | 386 (34.2%) |
| Contacts classified | 1,668 (265 commercial_buyer, 16 seller, 17 operational, 13 internal, 1,357 unknown) |
| Verra projects indexed | 4,903 |
| Projects with VCU data | 2,116 |
| Unique buyers in Verra data | 200+ (after normalization) |
| RFP types seeded (Watershed 2026) | 7 |
| ClearSky portfolio projects | 10 |
