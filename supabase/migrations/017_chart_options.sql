-- Per-KPI chart customization (color, axis bounds, legend, stacking, sort, top-N).
-- Stored as a free-form JSONB blob; engine + components only read keys they know.

alter table report_kpis
  add column if not exists chart_options jsonb default '{}'::jsonb;

-- Add 'area' + 'gauge' to viz_type. Existing CHECK constraint is permissive (text +
-- check), so we drop and recreate to extend the allowed set.
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'report_kpis_viz_type_check'
       or constraint_name like 'report_kpis_viz_type_check%'
  ) then
    alter table report_kpis drop constraint if exists report_kpis_viz_type_check;
  end if;
end $$;

alter table report_kpis
  add constraint report_kpis_viz_type_check
  check (viz_type in ('card','line','bar','area','pie','table','gauge'));
