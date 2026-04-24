-- ============================================================
-- FieldTrack Pro — Views & Reporting Queries
-- Run AFTER 02_rls_and_indexes.sql
-- ============================================================

-- ============================================================
-- VIEW: job_summary (main dashboard view)
-- ============================================================

CREATE OR REPLACE VIEW job_summary AS
SELECT
  j.id,
  j.job_number,
  j.name,
  j.status,
  j.address,
  j.start_date,
  j.due_date,
  j.completion_date,
  j.budget,
  j.gps_lat,
  j.gps_lng,
  j.gps_radius_ft,
  j.pm_review_required,

  -- Company
  c.id              AS company_id,
  c.name            AS company_name,
  c.trade,

  -- Worker count on this job
  (SELECT COUNT(*) FROM job_workers jw
   WHERE jw.job_id = j.id AND jw.is_active = TRUE) AS worker_count,

  -- Workers currently checked in (no checkout)
  (SELECT COUNT(*) FROM checkins ci
   WHERE ci.job_id = j.id AND ci.checkout_at IS NULL) AS workers_on_site,

  -- Total hours logged across all workers
  COALESCE((SELECT SUM(hours_logged) FROM checkins ci
            WHERE ci.job_id = j.id AND ci.hours_logged IS NOT NULL), 0) AS total_hours,

  -- Parts cost
  COALESCE((SELECT SUM(total_cost) FROM parts_issued pi
            WHERE pi.job_id = j.id), 0) AS parts_cost,

  -- Latest checkin
  (SELECT MAX(checkin_at) FROM checkins ci WHERE ci.job_id = j.id) AS last_checkin_at,

  -- Photo count
  (SELECT COUNT(*) FROM job_photos jp WHERE jp.job_id = j.id) AS photo_count,

  -- Checklist progress
  (SELECT COUNT(*) FROM job_checklist_items jci WHERE jci.job_id = j.id) AS checklist_total,
  (SELECT COUNT(*) FROM job_checklist_items jci WHERE jci.job_id = j.id AND jci.is_checked = TRUE) AS checklist_done,

  -- PM inspection status
  (SELECT result FROM (
    SELECT
      CASE WHEN approved_at IS NOT NULL THEN 'approved'
           WHEN rejected_at IS NOT NULL THEN 'rejected'
           WHEN followup_required THEN 'followup_required'
           ELSE 'pending' END AS result,
      visited_at
    FROM pm_inspections WHERE job_id = j.id
    ORDER BY visited_at DESC LIMIT 1
  ) sub) AS pm_review_status,

  -- Overdue flag
  (j.due_date < CURRENT_DATE AND j.status NOT IN ('complete', 'cancelled')) AS is_overdue,
  (CURRENT_DATE - j.due_date) AS days_overdue,

  j.created_at,
  j.updated_at

FROM jobs j
LEFT JOIN companies c ON c.id = j.company_id;

-- ============================================================
-- VIEW: worker_time_summary (hours per worker per job)
-- ============================================================

CREATE OR REPLACE VIEW worker_time_summary AS
SELECT
  ci.job_id,
  j.job_number,
  j.name                  AS job_name,
  ci.worker_id,
  p.full_name             AS worker_name,
  p.company_id,
  c.name                  AS company_name,
  DATE(ci.checkin_at)     AS work_date,
  ci.checkin_at,
  ci.checkout_at,
  ci.hours_logged,
  ci.checkin_dist_ft,
  ci.status               AS checkin_status
FROM checkins ci
JOIN jobs j ON j.id = ci.job_id
JOIN profiles p ON p.id = ci.worker_id
LEFT JOIN companies c ON c.id = p.company_id;

-- ============================================================
-- VIEW: job_cost_summary (financial rollup per job)
-- ============================================================

CREATE OR REPLACE VIEW job_cost_summary AS
SELECT
  j.id                    AS job_id,
  j.job_number,
  j.name                  AS job_name,
  j.budget,
  c.name                  AS company_name,

  -- Labor cost (hours × $100/hr default — update rate per company in real app)
  COALESCE(SUM(ci.hours_logged), 0)          AS total_hours,
  COALESCE(SUM(ci.hours_logged) * 100, 0)   AS est_labor_cost,

  -- Parts cost
  COALESCE((SELECT SUM(total_cost) FROM parts_issued pi
            WHERE pi.job_id = j.id), 0)       AS parts_cost,

  -- Change order value added
  COALESCE((SELECT SUM(value) FROM change_orders co
            WHERE co.job_id = j.id AND co.status = 'signed'), 0) AS change_order_value,

  -- Total spend
  COALESCE(SUM(ci.hours_logged) * 100, 0)
  + COALESCE((SELECT SUM(total_cost) FROM parts_issued pi WHERE pi.job_id = j.id), 0)
    AS total_spend,

  -- Variance (positive = over budget)
  (COALESCE(SUM(ci.hours_logged) * 100, 0)
  + COALESCE((SELECT SUM(total_cost) FROM parts_issued pi WHERE pi.job_id = j.id), 0))
  - j.budget              AS budget_variance

FROM jobs j
LEFT JOIN companies c ON c.id = j.company_id
LEFT JOIN checkins ci ON ci.job_id = j.id
GROUP BY j.id, j.job_number, j.name, j.budget, c.name;

-- ============================================================
-- VIEW: sub_performance_summary (reporting dashboard)
-- ============================================================

CREATE OR REPLACE VIEW sub_performance_summary AS
SELECT
  c.id                    AS company_id,
  c.name                  AS company_name,
  c.trade,
  c.ins_expiry,

  -- Job counts
  COUNT(DISTINCT j.id)                              AS total_jobs,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'complete') AS completed_jobs,
  COUNT(DISTINCT j.id) FILTER (WHERE j.is_overdue)  AS overdue_jobs,

  -- On-time rate
  ROUND(
    COUNT(DISTINCT j.id) FILTER (
      WHERE j.status = 'complete'
      AND (j.completion_date <= j.due_date OR j.due_date IS NULL)
    )::NUMERIC
    / NULLIF(COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'complete'), 0) * 100,
  1) AS on_time_rate_pct,

  -- Check-in compliance (% of work days where at least one check-in occurred)
  ROUND(
    COUNT(DISTINCT DATE(ci.checkin_at)) FILTER (WHERE ci.status = 'checked_in')::NUMERIC
    / NULLIF(
        (SELECT COUNT(DISTINCT DATE(generate_series))
         FROM generate_series(
           LEAST(MIN(j.start_date), CURRENT_DATE - 30),
           CURRENT_DATE,
           '1 day'
         ) WHERE EXTRACT(dow FROM generate_series) BETWEEN 1 AND 5),
      0) * 100,
  1) AS checkin_compliance_pct,

  -- Labor
  COALESCE(SUM(ci.hours_logged), 0) AS total_hours,

  -- Workers
  COUNT(DISTINCT jw.worker_id) AS total_workers,

  -- Insurance expiry flag
  CASE
    WHEN c.ins_expiry < CURRENT_DATE THEN 'expired'
    WHEN c.ins_expiry < CURRENT_DATE + 30 THEN 'expiring_soon'
    ELSE 'current'
  END AS insurance_status,

  -- Missing lien waivers
  (SELECT COUNT(DISTINCT cj.id)
   FROM jobs cj
   WHERE cj.company_id = c.id
     AND cj.status = 'complete'
     AND NOT EXISTS (
       SELECT 1 FROM lien_waivers lw
       WHERE lw.job_id = cj.id AND lw.company_id = c.id
     )
  ) AS missing_lien_waivers,

  -- Unsigned change orders
  (SELECT COUNT(*) FROM change_orders co2
   JOIN jobs j2 ON j2.id = co2.job_id
   WHERE j2.company_id = c.id AND co2.status = 'pending_sub'
  ) AS unsigned_change_orders

FROM companies c
LEFT JOIN jobs j ON j.company_id = c.id
  AND j.is_overdue IS NOT NULL  -- join with computed field from job_summary via subquery
LEFT JOIN job_workers jw ON jw.job_id = j.id
LEFT JOIN checkins ci ON ci.job_id = j.id AND ci.worker_id = jw.worker_id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.trade, c.ins_expiry;

-- ============================================================
-- VIEW: active_checkins (live GPS dashboard)
-- ============================================================

CREATE OR REPLACE VIEW active_checkins AS
SELECT
  ci.id,
  ci.job_id,
  j.job_number,
  j.name                  AS job_name,
  j.address               AS job_address,
  j.gps_lat               AS site_lat,
  j.gps_lng               AS site_lng,
  ci.worker_id,
  p.full_name             AS worker_name,
  p.company_id,
  c.name                  AS company_name,
  ci.checkin_at,
  ci.checkin_lat,
  ci.checkin_lng,
  ci.checkin_dist_ft,
  EXTRACT(EPOCH FROM (NOW() - ci.checkin_at)) / 3600.0 AS hours_so_far
FROM checkins ci
JOIN jobs j ON j.id = ci.job_id
JOIN profiles p ON p.id = ci.worker_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE ci.checkout_at IS NULL
  AND ci.status = 'checked_in';

-- ============================================================
-- VIEW: compliance_overview
-- ============================================================

CREATE OR REPLACE VIEW compliance_overview AS
SELECT
  -- Change orders needing sub signature
  (SELECT COUNT(*) FROM change_orders WHERE status = 'pending_sub') AS co_pending_sub,
  (SELECT COUNT(*) FROM change_orders WHERE status = 'pending_pm') AS co_pending_pm,

  -- Lien waivers missing
  (SELECT COUNT(DISTINCT j.id)
   FROM jobs j
   WHERE j.status = 'complete'
     AND NOT EXISTS (
       SELECT 1 FROM lien_waivers lw
       WHERE lw.job_id = j.id
     )
  ) AS missing_lien_waivers,

  -- Insurance expiring within 30 days
  (SELECT COUNT(*) FROM companies
   WHERE is_active AND ins_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
  ) AS insurance_expiring_soon,

  -- Overdue invoices
  (SELECT COUNT(*) FROM invoices
   WHERE paid_at IS NULL AND due_date < CURRENT_DATE
  ) AS overdue_invoices,

  -- PM reviews outstanding
  (SELECT COUNT(*) FROM jobs
   WHERE status IN ('pm_review', 'complete')
     AND pm_review_required = TRUE
     AND NOT EXISTS (
       SELECT 1 FROM pm_inspections pi
       WHERE pi.job_id = jobs.id AND pi.approved_at IS NOT NULL
     )
  ) AS pm_reviews_outstanding;

-- ============================================================
-- STORED PROCEDURE: gps_checkin
-- Validates GPS distance before allowing check-in
-- ============================================================

CREATE OR REPLACE FUNCTION gps_checkin(
  p_job_id    UUID,
  p_lat       NUMERIC,
  p_lng       NUMERIC
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job           RECORD;
  v_dist_ft       INTEGER;
  v_existing      UUID;
  v_checkin_id    UUID;
BEGIN
  -- Get job details
  SELECT id, gps_lat, gps_lng, gps_radius_ft, status
  INTO v_job FROM jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  IF v_job.status IN ('complete', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job is not active');
  END IF;

  -- Check worker is authorized
  IF NOT is_assigned_to_job(p_job_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this job');
  END IF;

  -- Calculate distance in feet using Haversine approximation
  -- (3958.8 miles * 5280 ft/mile * pi/180 for degree conversion)
  v_dist_ft := ROUND(
    3958.8 * 5280 * ACOS(
      LEAST(1.0, COS(RADIANS(p_lat)) * COS(RADIANS(v_job.gps_lat))
      * COS(RADIANS(v_job.gps_lng) - RADIANS(p_lng))
      + SIN(RADIANS(p_lat)) * SIN(RADIANS(v_job.gps_lat)))
    )
  );

  -- Log attempt regardless
  INSERT INTO audit_log (job_id, user_id, action, gps_lat, gps_lng, dist_from_site_ft, detail)
  VALUES (
    p_job_id, auth.uid(),
    CASE WHEN v_dist_ft <= v_job.gps_radius_ft THEN 'checkin' ELSE 'gps_blocked' END,
    p_lat, p_lng, v_dist_ft,
    jsonb_build_object('dist_ft', v_dist_ft, 'radius_ft', v_job.gps_radius_ft)
  );

  -- Block if too far
  IF v_dist_ft > v_job.gps_radius_ft THEN
    RETURN jsonb_build_object(
      'success', false,
      'blocked', true,
      'dist_ft', v_dist_ft,
      'radius_ft', v_job.gps_radius_ft,
      'error', format('You are %s ft from the site. Check-in requires within %s ft.', v_dist_ft, v_job.gps_radius_ft)
    );
  END IF;

  -- Check for existing open check-in
  SELECT id INTO v_existing FROM checkins
  WHERE job_id = p_job_id AND worker_id = auth.uid() AND checkout_at IS NULL;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already checked in. Please check out first.');
  END IF;

  -- Create check-in
  INSERT INTO checkins (job_id, worker_id, company_id, checkin_lat, checkin_lng, checkin_dist_ft)
  SELECT p_job_id, auth.uid(), p.company_id, p_lat, p_lng, v_dist_ft
  FROM profiles p WHERE p.id = auth.uid()
  RETURNING id INTO v_checkin_id;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'dist_ft', v_dist_ft,
    'message', format('Checked in successfully. You are %s ft from the site.', v_dist_ft)
  );
END;
$$;

-- ============================================================
-- STORED PROCEDURE: gps_checkout
-- ============================================================

CREATE OR REPLACE FUNCTION gps_checkout(
  p_job_id  UUID,
  p_lat     NUMERIC,
  p_lng     NUMERIC
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_checkin_id  UUID;
  v_hours       NUMERIC;
BEGIN
  SELECT id INTO v_checkin_id
  FROM checkins
  WHERE job_id = p_job_id AND worker_id = auth.uid() AND checkout_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active check-in found for this job');
  END IF;

  UPDATE checkins
  SET checkout_at = NOW(), checkout_lat = p_lat, checkout_lng = p_lng
  WHERE id = v_checkin_id
  RETURNING hours_logged INTO v_hours;

  INSERT INTO audit_log (job_id, user_id, action, gps_lat, gps_lng, detail)
  VALUES (p_job_id, auth.uid(), 'checkout', p_lat, p_lng,
    jsonb_build_object('hours', v_hours, 'checkin_id', v_checkin_id));

  RETURN jsonb_build_object(
    'success', true,
    'hours_logged', v_hours,
    'message', format('Checked out. %.2f hours logged.', v_hours)
  );
END;
$$;

-- ============================================================
-- REPORT QUERY: Daily check-in summary (for scheduled email)
-- ============================================================

CREATE OR REPLACE FUNCTION report_daily_checkins(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  company_name    TEXT,
  worker_name     TEXT,
  job_name        TEXT,
  job_number      TEXT,
  checkin_time    TIMESTAMPTZ,
  checkout_time   TIMESTAMPTZ,
  hours_logged    NUMERIC,
  gps_verified    BOOLEAN,
  dist_ft         INTEGER
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    c.name,
    p.full_name,
    j.name,
    j.job_number,
    ci.checkin_at,
    ci.checkout_at,
    ci.hours_logged,
    ci.checkin_dist_ft <= j.gps_radius_ft,
    ci.checkin_dist_ft
  FROM checkins ci
  JOIN profiles p ON p.id = ci.worker_id
  JOIN jobs j ON j.id = ci.job_id
  LEFT JOIN companies c ON c.id = p.company_id
  WHERE DATE(ci.checkin_at) = p_date
  ORDER BY c.name, p.full_name, ci.checkin_at;
$$;

-- ============================================================
-- REPORT QUERY: Job status report for a date range
-- ============================================================

CREATE OR REPLACE FUNCTION report_job_status(
  p_start DATE DEFAULT CURRENT_DATE - 30,
  p_end   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  job_number      TEXT,
  job_name        TEXT,
  company_name    TEXT,
  status          job_status,
  start_date      DATE,
  due_date        DATE,
  completion_date DATE,
  days_overdue    INTEGER,
  total_hours     NUMERIC,
  parts_cost      NUMERIC,
  budget          NUMERIC,
  pm_approved     BOOLEAN
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    j.job_number,
    j.name,
    c.name,
    j.status,
    j.start_date,
    j.due_date,
    j.completion_date,
    GREATEST(0, CURRENT_DATE - j.due_date) FILTER (WHERE j.status NOT IN ('complete','cancelled')) AS days_overdue,
    COALESCE(SUM(ci.hours_logged), 0),
    COALESCE((SELECT SUM(total_cost) FROM parts_issued pi WHERE pi.job_id = j.id), 0),
    j.budget,
    EXISTS (SELECT 1 FROM pm_inspections pi WHERE pi.job_id = j.id AND pi.approved_at IS NOT NULL)
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  LEFT JOIN checkins ci ON ci.job_id = j.id
  WHERE (j.start_date BETWEEN p_start AND p_end OR j.due_date BETWEEN p_start AND p_end)
  GROUP BY j.id, j.job_number, j.name, c.name, j.status,
           j.start_date, j.due_date, j.completion_date, j.budget
  ORDER BY j.due_date;
$$;
