---
name: KPI Data Sources Plan
description: Per-KPI source-of-truth map — which connected app or suggested platform should feed each customizable KPI, the exact field to capture, integration status, and capture method. Customizable catalog only (13 entries); std_* lifetime tiles are intentionally Drive-rollup and excluded.
type: project
originSessionId: configure-kpis-data-sources-WPZJk
---

## How to read this doc

Each KPI lists:
- **Data point** — the raw fact we need (and the formula it feeds in `lib/reporting/kpi-catalog.ts`).
- **Primary source** — the recommended system of record. If it's a connected app (see `integrations-status.md`) it's labeled **LIVE**; if it's a third-party platform we don't yet have a connector for, it's labeled **NEW CONNECTOR**.
- **Alt sources** — fallbacks or blended-attribution options.
- **Capture method** — how rows land in `report_raw_files` (or a future `report_external_facts` table). Today every KPI flows through Google Drive CSV/Sheet sync; "NEW CONNECTOR" rows describe the API/webhook we'd add.
- **Status** — `live` / `drive-only` / `needs-connector` / `planned`.

`drive-only` means: works today, but only because the user manually exports the upstream platform to a Sheet. Replacing those with native connectors is the build-out queue.

## Build-out priority (TL;DR)

1. **Stripe** → unlocks `cash_collected` cleanly (highest-trust revenue signal).
2. **Meta Ads + Google Ads** → unlocks `amount_spent`, `cpm`, `total_blended_cost`, `cost_per_qualified_lead`, `cost_qualified_per_booked` (5 of 13 KPIs).
3. **Calendly / GHL calendar** → unlocks `show_rate` denominator and feeds calls-booked into 2 cost KPIs.
4. **CRM (HubSpot or ActiveCampaign — already planned)** → unlocks `qualified_leads`, `unqualified_leads`, `qualified_ratio`, `close_rate`, `pitch_close_rate`.
5. **Webinar platform (Zoom Webinars / Demio)** → unlocks `pitch_close_rate` denominator.

After (1)–(5), 12/13 KPIs have a non-Drive primary source. Only `opt_ins` stays form/CRM-dependent.

---

## Paid-media KPIs

### 1. `amount_spent` — Amount Spent (currency)
- **Data point:** Sum of ad spend over the selected timeframe, per ad account.
- **Primary source:** **Meta Marketing API** + **Google Ads API** (NEW CONNECTOR for each). Field: `spend` on Insights endpoint (Meta) / `metrics.cost_micros / 1e6` (Google Ads).
- **Alt sources:** TikTok Ads `Reports/integrated/get`, LinkedIn Ads `adAnalytics`, Bing Ads. Drive CSV export from Ads Manager (current).
- **Capture method:** Daily cron (`/api/integrations/ads/sync`) writes one row per (account, date) into a new `report_external_facts` table OR materializes into the existing `report_raw_files` shape with `source_type='meta_ads'` so the formula evaluator can match `formula.source = 'meta_ads:<account_id>'`.
- **Status:** `drive-only` today. Recommend NEW CONNECTOR — Meta + Google first.

### 2. `cpm` — CPM (currency)
- **Data point:** `(spend / impressions) * 1000`. Needs both fields aligned by date+account.
- **Primary source:** Same as `amount_spent`. Meta `impressions` field; Google Ads `metrics.impressions`.
- **Alt sources:** Computed downstream of the same Drive export.
- **Capture method:** Same connector as `amount_spent` — emit `{spend, impressions}` per row so both KPIs share rows.
- **Status:** `drive-only`. Solved automatically once #1 ships.

### 3. `total_blended_cost` — Total Blended Cost (currency, repeatable)
- **Data point:** Sum of spend across N platforms (Meta + Google + TikTok + …). Catalog entry is already designed as repeatable — one input slot per platform.
- **Primary source:** Each platform's native API (NEW CONNECTOR per platform). No single source; this is intrinsically blended.
- **Alt sources:** A "blended ads" middleware (Triple Whale, Northbeam, Hyros) if the client uses one — single ingest covering multiple ad accounts.
- **Capture method:** Same per-platform sync as #1. UI lets the user add one row per `source_type`.
- **Status:** `drive-only`. Becomes trivial once Meta + Google + TikTok connectors land.

### 4. `cost_per_qualified_lead` — Cost per Qualified Lead (currency)
- **Data point:** `spend / qualified_leads`. Needs spend (paid-media side) + qualified-lead count (CRM/form side).
- **Primary source — numerator:** Meta + Google Ads (see #1).
- **Primary source — denominator:** **HubSpot** or **ActiveCampaign** (planned) — query contacts/deals where `lifecycle_stage = 'sqL'` or a custom `qualified=true` property in the timeframe. Alt: **GoHighLevel** if the client lives there.
- **Alt sources:** Typeform/Jotform with a "qualified yes/no" question scored downstream; Drive CSV from CRM.
- **Capture method:** Two connectors, joined at evaluation time. The Formula DSL already supports divide(left=spend_agg, right=qualified_agg) — both sides just need their own `source_type`.
- **Status:** `drive-only`. Unblocked when Ads connector + CRM connector are both live.

### 5. `cost_qualified_per_booked` — Cost (Qualified Lead) per Booked Call (currency)
- **Data point:** `spend / calls_booked`.
- **Primary source — numerator:** Meta + Google Ads (#1).
- **Primary source — denominator:** **Calendly API** (`/scheduled_events`, count where `status='active'`) or **GoHighLevel calendar** (`/calendars/events`). Alt: **Acuity** (`/appointments`), **SavvyCal**, **Cal.com**.
- **Alt sources:** Google Calendar (LIVE today via MCP) — count events on a specific calendar in the timeframe. Lower fidelity (no qualified/no-show metadata).
- **Capture method:** Calendly webhook → `report_external_facts` row per booking. Cron reconciliation daily.
- **Status:** `drive-only`. Could ship a Google Calendar v0 right now since it's already LIVE.

---

## Funnel KPIs

### 6. `opt_ins` — Opt-ins (count)
- **Data point:** New leads / form submissions / list adds in the timeframe.
- **Primary source:** **CRM list-add events** — HubSpot (`/contacts` filtered by `createdate`) or ActiveCampaign (`/contacts?created_after=`). Alt: **PostHog** (LIVE) — track an `opt_in_submitted` event from the marketing site, count via the Capture API or a daily query.
- **Alt sources:** **Typeform** (`/responses`), **Jotform**, **ConvertKit/Beehiiv** (newsletter signups), **Mailchimp** member adds. Drive CSV from any of the above.
- **Capture method:** PostHog query is the cheapest path (already wired). CRM webhook is the durable path.
- **Status:** `drive-only`. PostHog v0 is doable this sprint; CRM is the long-term home.

### 7. `qualified_leads` — Qualified Leads (count, filterable)
- **Data point:** Leads that passed qualification — usually a CRM stage transition or a tag.
- **Primary source:** **HubSpot** (lifecycle_stage = `marketingqualifiedlead` or `salesqualifiedlead`) / **ActiveCampaign** (tag = `qualified`). Alt: **GoHighLevel** opportunity stage.
- **Alt sources:** **Close.com** lead status; Typeform branching that scores an answer; manual Drive CSV.
- **Capture method:** CRM webhook on contact-property-change or stage-change. Reconcile daily.
- **Status:** `drive-only`. Unlocks when planned CRM connector lands.

### 8. `unqualified_leads` — Unqualified Leads (count, filterable)
- **Data point:** Leads that did not qualify (or were disqualified).
- **Primary source:** Same CRM as #7, opposite filter (`disqualified=true`, or `lifecycle_stage` set to a "lost/dnq" stage).
- **Alt sources:** Computed as `total_opt_ins - qualified_leads` if the CRM doesn't track DQ explicitly.
- **Capture method:** Same as #7.
- **Status:** `drive-only`.

### 9. `qualified_ratio` — Qualified vs Unqualified Ratio
- **Data point:** `qualified / unqualified`.
- **Primary source:** Derived from #7 and #8 — no new ingest needed.
- **Capture method:** Pure formula composition.
- **Status:** Same as #7/#8.

### 10. `show_rate` — Show Rate (percent)
- **Data point:** `calls_showed / calls_booked`.
- **Primary source — denominator (booked):** Calendly / GHL calendar (see #5).
- **Primary source — numerator (showed):** **Zoom API** (`/past_meetings/{id}/participants`) or **Google Meet** participant logs (Workspace Reports API). Alt: **Riverside**, **Whereby**, **Daily.co** participant webhooks.
- **Alt sources:** Sales-rep manual disposition in CRM (`call_status='showed'`) — most teams already log this. Drive CSV from CRM.
- **Capture method:** Calendly + Zoom webhook pair. Match attendees to invitees by email.
- **Status:** `drive-only`. Can be approximated with CRM call-status today; high-fidelity needs Zoom.

---

## Sales KPIs

### 11. `close_rate` — Close Rate (percent)
- **Data point:** `closes / calls_showed`.
- **Primary source — numerator (closes):** **Stripe** (`/charges` or `/checkout/sessions` count where `paid=true` in timeframe) — most reliable. Alt: **CRM deal stage = closed-won** (HubSpot deals, AC deals, GHL opportunities, Close.com).
- **Primary source — denominator:** Same as #10's `calls_showed`.
- **Alt sources:** Stripe Sigma export to Drive (current path).
- **Capture method:** Stripe webhook on `checkout.session.completed` / `charge.succeeded` → `report_external_facts(source_type='stripe', kind='close', amount, customer_id, ts)`.
- **Status:** `drive-only`. Stripe should be the first sales connector — it also unlocks #12.

### 12. `cash_collected` — Cash Collected (currency)
- **Data point:** Sum of cash actually received in the timeframe (not booked revenue).
- **Primary source:** **Stripe** (`balance_transactions` where `type='charge'` AND `created` in range, sum `amount/100` net of refunds). This is the canonical source — bank-reconciled.
- **Alt sources:** **QuickBooks Online** `/reports/ProfitAndLoss` cash basis; **Xero** invoices paid; **PayPal** transactions. Drive CSV export from Stripe (current).
- **Capture method:** Stripe Connect webhook on `balance_transaction.created` (or daily `balance_transactions.list` cron). Always read in account currency, convert at evaluation time if multi-currency.
- **Status:** `drive-only`. **Highest leverage build** — single connector, single highly-trusted KPI, also unlocks `close_rate` numerator.

### 13. `pitch_close_rate` — Conversion Rate at Pitch (percent)
- **Data point:** `closes / leads_present_at_pitch`. The denominator is the tricky one — only relevant for webinar/group-pitch funnels.
- **Primary source — numerator (closes):** Stripe (#12) or CRM closed-won.
- **Primary source — denominator (pitch attendees):** **Zoom Webinars API** (`/past_webinars/{id}/participants` filtered by `duration > offer_slide_timestamp`) or **Demio** (`/events/{id}/registrants?attended=true`). Alt: **WebinarJam**, **EverWebinar**, **eWebinar**, **Riverside** for live workshops.
- **Alt sources:** Manual logging — sales op tags attendees who "stayed for offer" in CRM after each event. Drive CSV from webinar tool.
- **Capture method:** Webinar platform webhook on `webinar.ended` → fetch participant list, filter by leave-time > pitch-timestamp (configured per event).
- **Status:** `drive-only`. Lower priority — narrower applicability than #11/#12.

---

## Cross-cutting build-out checklist

When wiring any new source, the following changes are expected (see `/home/user/Praxis-CENTCOM/lib/reporting/types.ts` and `/home/user/Praxis-CENTCOM/supabase/migrations/016_reporting_v2.sql`):

1. **Schema** — either reuse `report_raw_files` with a `source_type` column, or add `report_external_facts(client_id, source_type, kind, ts, value, dimensions jsonb)` for time-series facts that aren't natural rows-and-columns.
2. **Formula DSL** — extend `AggOp.source` to accept `"<source_type>:<account_id>"` form so the evaluator can route to the right table without breaking the existing Drive matcher.
3. **Sync route** — `/app/api/integrations/<provider>/sync` (cron + webhook handlers).
4. **Catalog UI** — `KPIConfigModal.tsx` source picker should list connected accounts per `source_type` once available, with Drive as the always-available fallback.
5. **Catalog entries** — no change required for the 13 KPIs above; the same `Formula` shape works once `source` strings can address non-Drive sources.

## Connected apps NOT used by KPIs (and why)

- **Slack** — outbound notification channel, no inbound data signal worth turning into a KPI.
- **Gmail** — email content is unstructured; reply-rate KPIs would need separate tooling.
- **Clerk** — auth events; could feed a future "active client logins" KPI but none of the 13 use it.
- **Upstash Redis** — runtime cache, not a system of record.
- **Monday.com** — could substitute for HubSpot/AC as the CRM source for #6–#9 if a client runs their pipeline there. Connector exists (GraphQL client) but isn't wired to KPIs yet.
