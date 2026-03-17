# PABLO — HubSpot Integration Reference
**Last updated:** 2026-03-17 | **Author:** Luis Felipe Adaime

---

## 1. D1 Table Schemas

### `hubspot_threads` (25 columns)
| # | Column | Type | Default | Notes |
|---|--------|------|---------|-------|
| 0 | `id` | TEXT PK | | MD5 hash thread ID |
| 1 | `contact_id` | TEXT | | HubSpot contact ID |
| 2 | `contact_name` | TEXT | | Display name of primary contact |
| 3 | `contact_email` | TEXT | | Email of primary contact |
| 4 | `company` | TEXT | | Raw company from HubSpot engagement |
| 5 | `deal_id` | TEXT | | Associated deal ID |
| 6 | `deal_name` | TEXT | | Associated deal name |
| 7 | `subject` | TEXT | | Latest email subject |
| 8 | `last_email_at` | TEXT | | ISO 8601 timestamp of most recent email |
| 9 | `email_count` | INTEGER | 0 | Number of emails in thread |
| 10 | `has_unread` | INTEGER | 0 | Unread status flag |
| 11 | `thread_json` | TEXT | | Legacy — deprecated, use R2 |
| 12 | `pablo_project_id` | TEXT | | Linked PABLO project ID (keyword match) |
| 13 | `synced_at` | TEXT | datetime('now') | Last sync timestamp |
| 14 | `created_at` | TEXT | datetime('now') | First seen |
| 15 | `sender_email` | TEXT | | Most recent email sender |
| 16 | `sender_name` | TEXT | | Most recent email sender name |
| 17 | `recipients_json` | TEXT | | JSON array of ALL lowercase participant emails (from+to+cc deduped) |
| 18 | `involves_luis` | INTEGER | 0 | 1 if Luis appears in any from/to/cc across all thread emails |
| 19 | `luis_role` | TEXT | | 'sender' / 'recipient' / 'both' / null |
| 20 | `company_name` | TEXT | | Resolved from hubspot_contacts_cache.company via contact_email |
| 21 | `thread_date` | TEXT | | Date portion of last_email_at (YYYY-MM-DD) |
| 22 | `r2_key` | TEXT | | R2 object key: `hubspot/threads/{id}.json` |
| 23 | `sync_status` | TEXT | 'active' | 'active' or 'archived' |
| 24 | `hubspot_contact_id` | TEXT | | HubSpot CRM contact ID |

### `hubspot_contacts_cache` (20 columns)
| # | Column | Type | Default | Notes |
|---|--------|------|---------|-------|
| 0 | `hubspot_id` | TEXT PK | | HubSpot CRM ID |
| 1 | `firstname` | TEXT | | |
| 2 | `lastname` | TEXT | | |
| 3 | `email` | TEXT | | Primary email |
| 4 | `company` | TEXT | | Company name string |
| 5 | `phone` | TEXT | | |
| 6 | `jobtitle` | TEXT | | |
| 7 | `owner_id` | TEXT | | HubSpot owner ID |
| 8 | `last_activity_date` | TEXT | | |
| 9 | `last_email_date` | TEXT | | |
| 10 | `num_deals` | INTEGER | 0 | |
| 11 | `raw_properties` | TEXT | | Full HubSpot properties JSON |
| 12 | `synced_at` | TEXT | datetime('now') | |
| 13 | `activity_count_30d` | INTEGER | 0 | Enrichment: activities last 30 days |
| 14 | `activity_count_60d` | INTEGER | 0 | |
| 15 | `email_count_60d` | INTEGER | 0 | |
| 16 | `call_count_60d` | INTEGER | 0 | |
| 17 | `meeting_count_60d` | INTEGER | 0 | |
| 18 | `has_inbound_reply` | INTEGER | 0 | |
| 19 | `engagement_score` | REAL | 0 | Computed engagement score |

### `hubspot_companies_cache` (10 columns)
| # | Column | Type | Default | Notes |
|---|--------|------|---------|-------|
| 0 | `hubspot_id` | TEXT PK | | |
| 1 | `name` | TEXT | | Company name |
| 2 | `domain` | TEXT | | Website domain (key for VCU buyer matching) |
| 3 | `industry` | TEXT | | HubSpot industry enum |
| 4 | `city` | TEXT | | |
| 5 | `country` | TEXT | | |
| 6 | `owner_id` | TEXT | | HubSpot owner ID |
| 7 | `num_contacts` | INTEGER | 0 | |
| 8 | `raw_properties` | TEXT | | Full HubSpot properties JSON |
| 9 | `synced_at` | TEXT | datetime('now') | |

### `hubspot_deals_cache` (9 columns)
| # | Column | Type | Default | Notes |
|---|--------|------|---------|-------|
| 0 | `hubspot_id` | TEXT PK | | |
| 1 | `dealname` | TEXT | | |
| 2 | `amount` | REAL | | Deal value |
| 3 | `dealstage` | TEXT | | Stage ID (internal HubSpot enum) |
| 4 | `pipeline` | TEXT | | Pipeline ID |
| 5 | `closedate` | TEXT | | |
| 6 | `owner_id` | TEXT | | HubSpot owner ID |
| 7 | `raw_properties` | TEXT | | Full HubSpot properties JSON |
| 8 | `synced_at` | TEXT | datetime('now') | |

### Other HubSpot tables
- `hubspot_owners_cache` — cached owner list (owner_id, email, firstname, lastname, synced_at). 24h TTL.
- `hubspot_sync_state` — backfill progress tracking (last_sync_offset, total_synced, backfill_complete)
- `hubspot_tasks` — manual tasks linked to threads (task_text, priority, horizon, thread_id, counterparty)

---

## 2. R2 Structure

**Bucket:** `clearsky-files` (binding: `env.FILES`)
**Path pattern:** `hubspot/threads/{id}.json`

### Thread JSON shape
```json
{
  "id": "7523f1047e7dd8ab55d6e30f10847f24",
  "subject": "RE: Lunch Meeting",
  "contact_name": "tamara.m.mcgillivray@esso.ca",
  "contact_email": "tamara.m.mcgillivray@esso.ca",
  "company": null,
  "pablo_project_id": null,
  "last_activity": "2025-10-27T06:07:25.664Z",
  "emails": [
    {
      "id": 327235577064,
      "from": "keith.driver@leadingcarbon.com",
      "fromName": "Keith Driver",
      "to": ["tamara.m.mcgillivray@esso.ca", "ana@stephenavemarketing.com"],
      "cc": [],
      "subject": "RE: Lunch Meeting",
      "body": "Happy to delay – given your time constraints...",
      "bodyHtml": "<html>...</html>",
      "timestamp": "2025-10-27T06:07:25.664Z",
      "direction": "outbound",
      "ownerId": 30233968
    }
  ]
}
```

**Key fields per email object:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | number | HubSpot engagement ID |
| `from` | string | Sender email address |
| `fromName` | string | Sender display name |
| `to` | string[] | Recipient email addresses |
| `cc` | string[] | CC'd email addresses |
| `subject` | string | Email subject |
| `body` | string | Plain text body (HTML stripped) |
| `bodyHtml` | string | Original HTML body |
| `timestamp` | string | ISO 8601 |
| `direction` | string | "outbound" or "inbound" |
| `ownerId` | number | HubSpot owner ID of the email engagement |

---

## 3. Worker Endpoints

**Base URL:** `https://api-tools.oga.earth`

### Inbox & Threads
| Method | Path | Purpose | Params | Response |
|--------|------|---------|--------|----------|
| GET | `/api/hubspot/inbox` | D1 thread metadata list | `?days=14` (default), `?mine=1`, `?limit=200` | `{ threads[], days, cutoff, total_count }` |
| GET | `/api/hubspot/thread/:id` | Full thread from R2 | — | `{ subject, contact_name, contact_email, company, emails[], involves_luis, luis_role, ... }` |
| GET | `/api/hubspot/search` | Search threads by keyword | `?q=`, `?contact=`, `?company=`, `?from=`, `?to=`, `?mine=1`, `?limit=50` | `{ threads[], count, query }` |
| GET | `/api/hubspot/inbox-contacts` | Distinct contacts from threads | — | `{ contacts[] }` |

### Sync & Backfill
| Method | Path | Purpose | Params | Response |
|--------|------|---------|--------|----------|
| POST | `/api/hubspot/sync-inbox` | Incremental sync (latest 100) | `?offset=0` | `{ processed, threads_updated, has_more }` |
| POST | `/api/hubspot/backfill` | Resumable historical archive | — | `{ status, processed_this_batch, total_synced, has_more, next_offset }` |
| GET | `/api/hubspot/backfill-status` | Check backfill progress | — | `{ total_synced, backfill_complete, total_threads_in_d1 }` |
| POST | `/api/hubspot/backfill-participants` | Re-extract involves_luis, recipients_json, company_name from R2 thread JSONs | `?offset=0&limit=200` | `{ processed, updated_involves_luis, found_luis_as_recipient, found_luis_as_both, company_names_resolved, errors, has_more }` |

### HubSpot Proxy
| Method | Path | Purpose | Params | Response |
|--------|------|---------|--------|----------|
| POST | `/api/hubspot/contacts/search` | Search HubSpot contacts | JSON body (HubSpot search format) | HubSpot response passthrough |
| POST | `/api/hubspot/log-call` | Log call engagement | `{ contactId, subject, body, timestamp, ownerId }` | `{ ok, callId }` |
| POST | `/api/hubspot/log-meeting` | Log meeting engagement | `{ contactId, subject, body, startTime, endTime, ownerId }` | `{ ok, meetingId }` |
| GET | `/api/hubspot/recent/:contactId` | Recent calls + meetings for contact | — | `{ calls[], meetings[] }` |

### Tasks
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/hubspot/tasks` | List tasks (`?status=open`) |
| POST | `/api/hubspot/tasks` | Create task |
| PUT | `/api/hubspot/tasks/:id` | Update task |
| DELETE | `/api/hubspot/tasks/:id` | Soft delete task |

### Full HubSpot Sync (contacts/companies/deals)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/hubspot/sync` | Full sync: contacts (2000 max), companies, deals into D1 cache |

### Activity Stats
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/revenue/activity-stats` | HubSpot activity aggregation for revenue dashboard |

---

## 4. Backfill-Participants Endpoint

**`POST /api/hubspot/backfill-participants?offset=0&limit=200`**

### What it does
1. Reads `hubspot_threads` rows (paginated, 200/call to stay under 1000 subrequest limit)
2. For each row, fetches the full thread JSON from R2 via `env.FILES.get(r2_key)`
3. Parses the `emails[]` array from each thread
4. Collects ALL participant emails (from + to + cc across all emails), lowercased and deduped
5. Determines `involves_luis` and `luis_role` by checking if Luis's canonical emails appear in from/to/cc:
   - Sender only → `luis_role = 'sender'`
   - Recipient only → `luis_role = 'recipient'`
   - Both sender AND recipient across different emails → `luis_role = 'both'`
   - Neither → `involves_luis = 0, luis_role = null`
6. Builds `recipients_json` = sorted deduped array of all participant emails
7. Resolves `company_name` from `hubspot_contacts_cache` via `contact_email` lookup
8. Updates `hubspot_threads` with all four fields

### When to re-run
- After any `POST /api/hubspot/sync-inbox` that adds new threads
- After `POST /api/hubspot/backfill` completes new batches
- After `GET /api/hubspot/sync` refreshes the contacts cache (for company_name resolution)

### Luis canonical emails
```
LUIS_EMAILS = [
  "luis.adaime@clearskyltd.com",
  "luis.adaime@clearskyltd.onmicrosoft.com"
]
```

---

## 5. Known Data Quality Issues

### company_name (null on 911/1128 threads)
- `company_name` is resolved by looking up `contact_email` in `hubspot_contacts_cache.email`
- Many threads have null contact_email or the contact isn't in the cache
- The cache itself only has 1,668 contacts (HubSpot has 1,725+)
- Many contacts don't have the `company` field populated in HubSpot

### Last sync staleness
- D1 cache last synced: **2026-02-25** (3+ weeks stale)
- 57 contacts missing (1,725 in HubSpot vs 1,668 in D1)
- Thread sync runs on demand via `POST /api/hubspot/sync-inbox`

### Case duplication in sender_email — FIXED (2026-03-17)
- **Fixed**: All `sender_email` and `contact_email` values lowercased in D1 (278 + 196 rows updated)
- `syncHubSpotBatch()` now lowercases `sender_email` at insert time
- `recipients_json` was already lowercase

### recipients_json
- Now populated on all 1,128 threads (was null on all before 2026-03-17 backfill)
- Contains deduplicated, lowercase, sorted array of all from/to/cc addresses across all emails in thread

---

## 6. involves_luis Logic

### Three states
| `luis_role` | Meaning | Count (2026-03-17) |
|-------------|---------|-----------|
| `sender` | Luis appears in `from` field of at least one email, but never in `to`/`cc` | 131 |
| `recipient` | Luis appears in `to` or `cc` of at least one email, but never in `from` | 139 |
| `both` | Luis appears in both `from` AND `to`/`cc` across different emails in the thread | 73 |
| `null` | Luis does not appear in any from/to/cc field | 785 |

### How determined
The `backfill-participants` endpoint scans every email in the R2 thread JSON:
- If any `email.from` (lowercased) matches a Luis canonical email → `luisIsSender = true`
- If any `email.to[]` or `email.cc[]` entry (lowercased) matches → `luisIsRecipient = true`
- Final: both true → "both", sender only → "sender", recipient only → "recipient", neither → null

### Previous method (broken — fixed 2026-03-17)
The original `extractThreadParticipants()` function only checked `ownerId === 82916631` (HubSpot owner ID). This only caught threads where Luis was the HubSpot engagement owner — missing all threads where Luis was CC'd or in the to/cc fields but not the engagement owner. Result: 214 threads marked as involving Luis vs 343 after the email-based backfill.

### Sync pipeline fix (2026-03-17)
`extractThreadParticipants()` now uses the same email-based logic as `backfill-participants`:
- Scans ALL `from`/`to`/`cc` across every email in thread
- Checks against `LUIS_EMAILS` array (canonical addresses)
- Populates `recipients_json` at sync time (sorted, deduped, lowercase)
- `syncHubSpotBatch()` also resolves `company_name` from `hubspot_contacts_cache`
- New threads synced via `POST /api/hubspot/sync-inbox` now get correct data at INSERT time

### Internal thread detection
- Internal domains: `clearskyltd.com`, `leadingcarbon.com`, `maboroshi.com`
- Thread is internal if ALL participants in `recipients_json` have internal domain emails
- Frontend: internal threads dimmed to 45% opacity in Mine view + "internal" badge
- 61 of 200 recent threads (30.5%) are internal-only

---

## 7. Classification TODO

Next step: email intent taxonomy for automated thread categorization.

**Proposed categories:**
- `buyer_inquiry` — inbound interest from potential credit buyers
- `supplier_outreach` — outreach to project developers / suppliers
- `deal_negotiation` — active deal terms, pricing, contract discussions
- `market_intel` — market reports, competitor info, industry news
- `admin` — expense reports, signatures, internal logistics
- `internal` — team coordination, project updates between ClearSky/Leading Carbon staff

**Implementation approach:** Use Claude Haiku on thread subject + first email body (< 500 chars) for classification. Store in new `thread_category` column on `hubspot_threads`. Could be run during `backfill-participants` or as a separate backfill endpoint.

---

## 8. Changelog

| Date | Change | Details |
|------|--------|---------|
| 2026-03-17 | `backfill-participants` endpoint created | Walks all 1,128 R2 thread JSONs, extracts from/to/cc from every email, rebuilds `involves_luis` (343 threads, was 214), `luis_role` (sender=131, recipient=139, both=73), `recipients_json` (all 1,128 populated), `company_name` (217 resolved). Paginated at 200/call. |
| 2026-03-17 | pablo.html Mine filter fix | `isLuisThread()` now uses `parseInt()`. Display name logic: shows `sender_name` for recipient/both roles, `contact_name` for sender role. Added `luis_role` badges (sent/received/CC'd). Added QA debug row in thread detail panel. |
| 2026-03-17 | Worker inbox endpoint updated | Added `recipients_json` to SELECT in `/api/hubspot/inbox` |
| 2026-03-17 | `extractThreadParticipants()` rewritten | Now scans all from/to/cc emails instead of ownerId. Populates `recipients_json` at sync time. `syncHubSpotBatch()` also resolves `company_name` from contacts cache. |
| 2026-03-17 | D1 data cleanup | Lowercased 278 `sender_email` + 196 `contact_email` values. Zero wrongly-tagged `involves_luis` found. |
| 2026-03-17 | pablo.html arrow badges + internal dimming | Role badges: ↑ sent / ↓ received / ↔ CC'd. Internal thread detection (all participants from ClearSky/LC/Maboroshi). Dimmed to 45% in Mine view + "internal" badge. QA debug row expanded to 120 chars, opacity 0.5. |
