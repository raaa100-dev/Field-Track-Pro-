-- ============================================================
-- FieldTrack Pro — Row Level Security Policies & Indexes
-- Run AFTER 01_schema.sql
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_workers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_markups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_issued       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklist_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_inspections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_punch_list      ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lien_waivers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Get current user's company_id
CREATE OR REPLACE FUNCTION current_user_company()
RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

-- Check if current user is PM or admin
CREATE OR REPLACE FUNCTION is_pm_or_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role IN ('admin', 'pm') FROM profiles WHERE id = auth.uid();
$$;

-- Check if current user is assigned to a job
CREATE OR REPLACE FUNCTION is_assigned_to_job(p_job_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_workers
    WHERE job_id = p_job_id
      AND worker_id = auth.uid()
      AND is_active = TRUE
  );
$$;

-- ============================================================
-- COMPANIES — PMs see all, subs see their own company
-- ============================================================

CREATE POLICY "pm_admin_full_companies" ON companies
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_see_own_company" ON companies
  FOR SELECT TO authenticated
  USING (id = current_user_company());

-- ============================================================
-- PROFILES — PMs see all, subs see their own company's profiles
-- ============================================================

CREATE POLICY "pm_admin_full_profiles" ON profiles
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_see_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "sub_see_coworkers" ON profiles
  FOR SELECT TO authenticated
  USING (company_id = current_user_company());

CREATE POLICY "sub_update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- JOBS — PMs see all; subs see only jobs they're assigned to
-- ============================================================

CREATE POLICY "pm_admin_full_jobs" ON jobs
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_see_assigned_jobs" ON jobs
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(id));

-- ============================================================
-- JOB WORKERS — PMs manage; subs see their own assignments
-- ============================================================

CREATE POLICY "pm_admin_full_job_workers" ON job_workers
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_see_own_assignments" ON job_workers
  FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

-- ============================================================
-- CHECK-INS — subs manage their own; PMs see all
-- ============================================================

CREATE POLICY "pm_admin_full_checkins" ON checkins
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_manage_own_checkins" ON checkins
  FOR ALL TO authenticated
  USING (worker_id = auth.uid() AND is_assigned_to_job(job_id));

CREATE POLICY "sub_see_coworker_checkins" ON checkins
  FOR SELECT TO authenticated
  USING (
    is_assigned_to_job(job_id)
    AND company_id = current_user_company()
  );

-- ============================================================
-- JOB PLANS — subs can read plans for assigned jobs
-- ============================================================

CREATE POLICY "pm_admin_full_plans" ON job_plans
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_read_assigned_plans" ON job_plans
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

-- ============================================================
-- PLAN MARKUPS
-- ============================================================

CREATE POLICY "pm_admin_full_markups" ON plan_markups
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_manage_own_markups" ON plan_markups
  FOR ALL TO authenticated
  USING (created_by = auth.uid() AND is_assigned_to_job(job_id));

CREATE POLICY "sub_read_all_job_markups" ON plan_markups
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

-- ============================================================
-- PARTS ISSUED — PMs manage; subs read for assigned jobs
-- ============================================================

CREATE POLICY "pm_admin_full_parts" ON parts_issued
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_read_assigned_parts" ON parts_issued
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

-- ============================================================
-- PHOTOS — subs upload for assigned jobs; PMs manage all
-- ============================================================

CREATE POLICY "pm_admin_full_photos" ON job_photos
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_upload_for_assigned_jobs" ON job_photos
  FOR INSERT TO authenticated
  WITH CHECK (taken_by = auth.uid() AND is_assigned_to_job(job_id));

CREATE POLICY "sub_read_assigned_photos" ON job_photos
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

-- ============================================================
-- CHECKLISTS
-- ============================================================

CREATE POLICY "pm_admin_full_checklist_templates" ON checklist_templates
  FOR ALL TO authenticated USING (is_pm_or_admin());

CREATE POLICY "sub_read_templates" ON checklist_templates
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "pm_admin_full_template_items" ON checklist_template_items
  FOR ALL TO authenticated USING (is_pm_or_admin());

CREATE POLICY "sub_read_template_items" ON checklist_template_items
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "pm_admin_full_checklist_items" ON job_checklist_items
  FOR ALL TO authenticated USING (is_pm_or_admin());

CREATE POLICY "sub_update_checklist_items" ON job_checklist_items
  FOR UPDATE TO authenticated
  USING (is_assigned_to_job(job_id));

CREATE POLICY "sub_read_checklist_items" ON job_checklist_items
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

-- ============================================================
-- PM INSPECTIONS — PMs manage all; subs read for their jobs
-- ============================================================

CREATE POLICY "pm_admin_full_inspections" ON pm_inspections
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_read_own_job_inspections" ON pm_inspections
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

CREATE POLICY "pm_admin_full_punch_list" ON pm_punch_list
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_read_punch_list" ON pm_punch_list
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

-- ============================================================
-- CHANGE ORDERS — PMs create; subs sign their own
-- ============================================================

CREATE POLICY "pm_admin_full_change_orders" ON change_orders
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_read_own_change_orders" ON change_orders
  FOR SELECT TO authenticated
  USING (is_assigned_to_job(job_id));

CREATE POLICY "sub_sign_change_order" ON change_orders
  FOR UPDATE TO authenticated
  USING (
    is_assigned_to_job(job_id)
    AND status = 'pending_sub'
    AND sub_signed_by IS NULL
  );

-- ============================================================
-- INVOICES — PMs manage; sub leads see their company's invoices
-- ============================================================

CREATE POLICY "pm_admin_full_invoices" ON invoices
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_lead_see_company_invoices" ON invoices
  FOR SELECT TO authenticated
  USING (
    company_id = current_user_company()
    AND current_user_role() IN ('sub_lead')
  );

-- ============================================================
-- LIEN WAIVERS
-- ============================================================

CREATE POLICY "pm_admin_full_waivers" ON lien_waivers
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_upload_waiver" ON lien_waivers
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = current_user_company()
    AND is_assigned_to_job(job_id)
  );

CREATE POLICY "sub_read_own_waivers" ON lien_waivers
  FOR SELECT TO authenticated
  USING (company_id = current_user_company());

-- ============================================================
-- AUDIT LOG — PMs read all; subs read their own entries
-- ============================================================

CREATE POLICY "pm_admin_read_all_audit" ON audit_log
  FOR SELECT TO authenticated
  USING (is_pm_or_admin());

CREATE POLICY "sub_read_own_audit" ON audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No one can UPDATE or DELETE audit log (append-only)
CREATE POLICY "no_update_audit" ON audit_log
  FOR UPDATE TO authenticated USING (FALSE);

CREATE POLICY "no_delete_audit" ON audit_log
  FOR DELETE TO authenticated USING (FALSE);

-- Service role can insert audit logs (via server-side functions)
CREATE POLICY "service_insert_audit" ON audit_log
  FOR INSERT TO authenticated
  USING (TRUE);

-- ============================================================
-- SCHEDULED REPORTS — PMs only
-- ============================================================

CREATE POLICY "pm_admin_full_reports" ON scheduled_reports
  FOR ALL TO authenticated
  USING (is_pm_or_admin());

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Jobs
CREATE INDEX idx_jobs_company      ON jobs(company_id);
CREATE INDEX idx_jobs_status       ON jobs(status);
CREATE INDEX idx_jobs_due_date     ON jobs(due_date);
CREATE INDEX idx_jobs_created_at   ON jobs(created_at DESC);

-- Job workers
CREATE INDEX idx_job_workers_job    ON job_workers(job_id);
CREATE INDEX idx_job_workers_worker ON job_workers(worker_id);

-- Check-ins (heavy read table)
CREATE INDEX idx_checkins_job      ON checkins(job_id);
CREATE INDEX idx_checkins_worker   ON checkins(worker_id);
CREATE INDEX idx_checkins_date     ON checkins(checkin_at DESC);
CREATE INDEX idx_checkins_company  ON checkins(company_id);
CREATE INDEX idx_checkins_active   ON checkins(job_id, worker_id) WHERE checkout_at IS NULL;

-- Photos
CREATE INDEX idx_photos_job        ON job_photos(job_id);
CREATE INDEX idx_photos_worker     ON job_photos(taken_by);

-- Parts
CREATE INDEX idx_parts_job         ON parts_issued(job_id);

-- PM Inspections
CREATE INDEX idx_inspections_job   ON pm_inspections(job_id);
CREATE INDEX idx_inspections_pm    ON pm_inspections(pm_id);

-- Change orders
CREATE INDEX idx_co_job            ON change_orders(job_id);
CREATE INDEX idx_co_status         ON change_orders(status);

-- Audit log (most-queried table)
CREATE INDEX idx_audit_job         ON audit_log(job_id);
CREATE INDEX idx_audit_user        ON audit_log(user_id);
CREATE INDEX idx_audit_action      ON audit_log(action);
CREATE INDEX idx_audit_created     ON audit_log(created_at DESC);
CREATE INDEX idx_audit_company     ON audit_log(company_id);

-- Invoices
CREATE INDEX idx_invoices_company  ON invoices(company_id);
CREATE INDEX idx_invoices_job      ON invoices(job_id);
CREATE INDEX idx_invoices_due      ON invoices(due_date);
