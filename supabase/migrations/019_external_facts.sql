-- Migration 019: report_external_facts
-- ============================================================================
-- Holds time-series data points pulled from non-Drive sources (PostHog today;
-- Stripe / Meta Ads / Calendly later — see content/memory/kpi-data-sources-plan.md).
--
-- The reporting engine reads these facts in addition to report_raw_files. At
-- query time, facts are grouped by (source_type, kind) and presented to the
-- engine as synthetic "files" with a stable filename of `<source_type>:<kind>`
-- (e.g. `posthog:opt_ins`, `stripe:cash_collected`). KPI formulas reference
-- these synthetic filenames the same way they reference real Drive filenames,
-- so no Formula DSL change is needed and existing Drive-based KPIs are
-- untouched.

CREATE TABLE IF NOT EXISTS report_external_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- Which provider produced this fact: 'posthog' | 'stripe' | 'meta_ads' | ...
  source_type text NOT NULL,
  -- Logical metric name, semi-stable: 'opt_ins', 'cash_collected', 'amount_spent'.
  -- Becomes the second half of the synthetic filename + a column in the engine.
  kind text NOT NULL,
  -- Event/transaction time. timeframe filtering binds against this.
  ts timestamptz NOT NULL,
  -- The numeric payload (count, dollars, etc.). NULL is allowed for facts that
  -- only carry dimensions (rare; usually 1 for "one event happened").
  value numeric,
  -- Free-form labels carried alongside the value. Become extra columns when the
  -- fact is exposed as a synthetic engine row, so KPIs can filter/group by them
  -- (e.g. {"campaign":"summer-launch","platform":"meta"}).
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Stable upstream identifier — used for idempotent syncs. For PostHog daily
  -- aggregates: 'posthog:opt_ins:2025-05-08'. For Stripe charges: the charge id.
  external_id text,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One upsert key per (client, source, kind, external_id). External_id may be
-- NULL for facts that don't carry one — those won't dedup, on purpose.
CREATE UNIQUE INDEX IF NOT EXISTS report_external_facts_dedup
  ON report_external_facts (client_id, source_type, kind, external_id)
  WHERE external_id IS NOT NULL;

-- Read path: the kpis GET handler filters by client_id + source_type + ts.
CREATE INDEX IF NOT EXISTS report_external_facts_lookup
  ON report_external_facts (client_id, source_type, kind, ts DESC);

-- Auto-update updated_at on UPDATE so the sync logic can use it for
-- "last synced at" reporting.
CREATE OR REPLACE FUNCTION report_external_facts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_external_facts_updated_at ON report_external_facts;
CREATE TRIGGER report_external_facts_updated_at
  BEFORE UPDATE ON report_external_facts
  FOR EACH ROW
  EXECUTE FUNCTION report_external_facts_touch_updated_at();
