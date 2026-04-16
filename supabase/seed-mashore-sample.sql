-- Sample call funnel data for Mashore — 12 weeks of metrics
-- Replace with real data once Sheet is connected

-- Get the Mashore client ID
DO $$
DECLARE
  cid uuid;
BEGIN
  SELECT id INTO cid FROM clients WHERE slug = 'mashore';

  -- Create a manual data source
  INSERT INTO data_sources (client_id, source_type, mapping_status)
  VALUES (cid, 'manual', 'approved');

  -- Week-by-week call funnel metrics (12 weeks)
  -- Week 1: Jan 6 2025
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 320, '2025-01-06', 'week', 'direct'),
    (cid, 'calls_booked', 42, '2025-01-06', 'week', 'direct'),
    (cid, 'calls_showed', 28, '2025-01-06', 'week', 'direct'),
    (cid, 'closes', 8, '2025-01-06', 'week', 'direct'),
    (cid, 'cash_collected', 32000, '2025-01-06', 'week', 'direct'),
    (cid, 'ad_spend', 4200, '2025-01-06', 'week', 'direct'),
    (cid, 'show_rate', 0.667, '2025-01-06', 'week', 'derived'),
    (cid, 'close_rate', 0.286, '2025-01-06', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-01-06', 'week', 'derived'),
    (cid, 'cost_per_lead', 13.13, '2025-01-06', 'week', 'derived');

  -- Week 2: Jan 13
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 285, '2025-01-13', 'week', 'direct'),
    (cid, 'calls_booked', 38, '2025-01-13', 'week', 'direct'),
    (cid, 'calls_showed', 27, '2025-01-13', 'week', 'direct'),
    (cid, 'closes', 9, '2025-01-13', 'week', 'direct'),
    (cid, 'cash_collected', 36000, '2025-01-13', 'week', 'direct'),
    (cid, 'ad_spend', 3900, '2025-01-13', 'week', 'direct'),
    (cid, 'show_rate', 0.711, '2025-01-13', 'week', 'derived'),
    (cid, 'close_rate', 0.333, '2025-01-13', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-01-13', 'week', 'derived'),
    (cid, 'cost_per_lead', 13.68, '2025-01-13', 'week', 'derived');

  -- Week 3: Jan 20
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 350, '2025-01-20', 'week', 'direct'),
    (cid, 'calls_booked', 48, '2025-01-20', 'week', 'direct'),
    (cid, 'calls_showed', 31, '2025-01-20', 'week', 'direct'),
    (cid, 'closes', 11, '2025-01-20', 'week', 'direct'),
    (cid, 'cash_collected', 44000, '2025-01-20', 'week', 'direct'),
    (cid, 'ad_spend', 4500, '2025-01-20', 'week', 'direct'),
    (cid, 'show_rate', 0.646, '2025-01-20', 'week', 'derived'),
    (cid, 'close_rate', 0.355, '2025-01-20', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-01-20', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.86, '2025-01-20', 'week', 'derived');

  -- Week 4: Jan 27
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 310, '2025-01-27', 'week', 'direct'),
    (cid, 'calls_booked', 40, '2025-01-27', 'week', 'direct'),
    (cid, 'calls_showed', 26, '2025-01-27', 'week', 'direct'),
    (cid, 'closes', 7, '2025-01-27', 'week', 'direct'),
    (cid, 'cash_collected', 28000, '2025-01-27', 'week', 'direct'),
    (cid, 'ad_spend', 4100, '2025-01-27', 'week', 'direct'),
    (cid, 'show_rate', 0.65, '2025-01-27', 'week', 'derived'),
    (cid, 'close_rate', 0.269, '2025-01-27', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-01-27', 'week', 'derived'),
    (cid, 'cost_per_lead', 13.23, '2025-01-27', 'week', 'derived');

  -- Week 5: Feb 3
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 375, '2025-02-03', 'week', 'direct'),
    (cid, 'calls_booked', 52, '2025-02-03', 'week', 'direct'),
    (cid, 'calls_showed', 36, '2025-02-03', 'week', 'direct'),
    (cid, 'closes', 12, '2025-02-03', 'week', 'direct'),
    (cid, 'cash_collected', 48000, '2025-02-03', 'week', 'direct'),
    (cid, 'ad_spend', 4800, '2025-02-03', 'week', 'direct'),
    (cid, 'show_rate', 0.692, '2025-02-03', 'week', 'derived'),
    (cid, 'close_rate', 0.333, '2025-02-03', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-02-03', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.80, '2025-02-03', 'week', 'derived');

  -- Week 6: Feb 10
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 340, '2025-02-10', 'week', 'direct'),
    (cid, 'calls_booked', 45, '2025-02-10', 'week', 'direct'),
    (cid, 'calls_showed', 32, '2025-02-10', 'week', 'direct'),
    (cid, 'closes', 10, '2025-02-10', 'week', 'direct'),
    (cid, 'cash_collected', 40000, '2025-02-10', 'week', 'direct'),
    (cid, 'ad_spend', 4300, '2025-02-10', 'week', 'direct'),
    (cid, 'show_rate', 0.711, '2025-02-10', 'week', 'derived'),
    (cid, 'close_rate', 0.313, '2025-02-10', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-02-10', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.65, '2025-02-10', 'week', 'derived');

  -- Week 7: Feb 17
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 290, '2025-02-17', 'week', 'direct'),
    (cid, 'calls_booked', 35, '2025-02-17', 'week', 'direct'),
    (cid, 'calls_showed', 24, '2025-02-17', 'week', 'direct'),
    (cid, 'closes', 8, '2025-02-17', 'week', 'direct'),
    (cid, 'cash_collected', 32000, '2025-02-17', 'week', 'direct'),
    (cid, 'ad_spend', 3800, '2025-02-17', 'week', 'direct'),
    (cid, 'show_rate', 0.686, '2025-02-17', 'week', 'derived'),
    (cid, 'close_rate', 0.333, '2025-02-17', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-02-17', 'week', 'derived'),
    (cid, 'cost_per_lead', 13.10, '2025-02-17', 'week', 'derived');

  -- Week 8: Feb 24
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 365, '2025-02-24', 'week', 'direct'),
    (cid, 'calls_booked', 50, '2025-02-24', 'week', 'direct'),
    (cid, 'calls_showed', 35, '2025-02-24', 'week', 'direct'),
    (cid, 'closes', 13, '2025-02-24', 'week', 'direct'),
    (cid, 'cash_collected', 52000, '2025-02-24', 'week', 'direct'),
    (cid, 'ad_spend', 4600, '2025-02-24', 'week', 'direct'),
    (cid, 'show_rate', 0.70, '2025-02-24', 'week', 'derived'),
    (cid, 'close_rate', 0.371, '2025-02-24', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-02-24', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.60, '2025-02-24', 'week', 'derived');

  -- Week 9: Mar 3
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 395, '2025-03-03', 'week', 'direct'),
    (cid, 'calls_booked', 55, '2025-03-03', 'week', 'direct'),
    (cid, 'calls_showed', 38, '2025-03-03', 'week', 'direct'),
    (cid, 'closes', 14, '2025-03-03', 'week', 'direct'),
    (cid, 'cash_collected', 56000, '2025-03-03', 'week', 'direct'),
    (cid, 'ad_spend', 5000, '2025-03-03', 'week', 'direct'),
    (cid, 'show_rate', 0.691, '2025-03-03', 'week', 'derived'),
    (cid, 'close_rate', 0.368, '2025-03-03', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-03-03', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.66, '2025-03-03', 'week', 'derived');

  -- Week 10: Mar 10
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 410, '2025-03-10', 'week', 'direct'),
    (cid, 'calls_booked', 58, '2025-03-10', 'week', 'direct'),
    (cid, 'calls_showed', 41, '2025-03-10', 'week', 'direct'),
    (cid, 'closes', 15, '2025-03-10', 'week', 'direct'),
    (cid, 'cash_collected', 60000, '2025-03-10', 'week', 'direct'),
    (cid, 'ad_spend', 5200, '2025-03-10', 'week', 'direct'),
    (cid, 'show_rate', 0.707, '2025-03-10', 'week', 'derived'),
    (cid, 'close_rate', 0.366, '2025-03-10', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-03-10', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.68, '2025-03-10', 'week', 'derived');

  -- Week 11: Mar 17
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 380, '2025-03-17', 'week', 'direct'),
    (cid, 'calls_booked', 51, '2025-03-17', 'week', 'direct'),
    (cid, 'calls_showed', 34, '2025-03-17', 'week', 'direct'),
    (cid, 'closes', 11, '2025-03-17', 'week', 'direct'),
    (cid, 'cash_collected', 44000, '2025-03-17', 'week', 'direct'),
    (cid, 'ad_spend', 4700, '2025-03-17', 'week', 'direct'),
    (cid, 'show_rate', 0.667, '2025-03-17', 'week', 'derived'),
    (cid, 'close_rate', 0.324, '2025-03-17', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-03-17', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.37, '2025-03-17', 'week', 'derived');

  -- Week 12: Mar 24 (most recent)
  INSERT INTO metric_snapshots (client_id, metric_key, metric_value, period_date, period_type, confidence) VALUES
    (cid, 'leads', 425, '2025-03-24', 'week', 'direct'),
    (cid, 'calls_booked', 60, '2025-03-24', 'week', 'direct'),
    (cid, 'calls_showed', 43, '2025-03-24', 'week', 'direct'),
    (cid, 'closes', 16, '2025-03-24', 'week', 'direct'),
    (cid, 'cash_collected', 64000, '2025-03-24', 'week', 'direct'),
    (cid, 'ad_spend', 5400, '2025-03-24', 'week', 'direct'),
    (cid, 'show_rate', 0.717, '2025-03-24', 'week', 'derived'),
    (cid, 'close_rate', 0.372, '2025-03-24', 'week', 'derived'),
    (cid, 'average_order_value', 4000, '2025-03-24', 'week', 'derived'),
    (cid, 'cost_per_lead', 12.71, '2025-03-24', 'week', 'derived');

END $$;
