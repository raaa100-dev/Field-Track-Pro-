-- ============================================================
-- FieldTrack Pro — Supabase Schema
-- Run this in your Supabase SQL editor in order: 01 → 02 → 03
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- for GPS geo queries

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'pm', 'sub_lead', 'sub_worker');
CREATE TYPE job_status AS ENUM ('pending', 'in_progress', 'blocked', 'pm_review', 'complete', 'cancelled');
CREATE TYPE checkin_status AS ENUM ('checked_in', 'checked_out', 'blocked_gps');
CREATE TYPE part_status AS ENUM ('ordered', 'in_transit', 'delivered', 'returned');
CREATE TYPE change_order_status AS ENUM ('draft', 'pending_sub', 'pending_pm', 'signed', 'rejected');
CREATE TYPE inspection_result AS ENUM ('satisfactory', 'needs_attention', 'unsatisfactory', 'approved', 'rejected');
CREATE TYPE audit_action AS ENUM (
  'checkin', 'checkout', 'gps_blocked',
  'job_created', 'job_updated', 'status_changed',
  'photo_uploaded', 'plan_markup_saved',
  'part_issued', 'part_updated',
  'pm_inspection_created', 'pm_signoff',
  'checklist_item_checked',
  'change_order_created', 'change_order_signed',
  'lien_waiver_uploaded', 'worker_added', 'worker_removed',
  'invoice_created', 'invoice_paid'
);

-- ============================================================
-- COMPANIES (Sub companies)
-- ============================================================

CREATE TABLE companies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  trade         TEXT,                        -- HVAC, Electrical, Plumbing, etc.
  email         TEXT,
  phone         TEXT,
  license_num   TEXT,
  ins_provider  TEXT,
  ins_policy    TEXT,
  ins_limit     NUMERIC(12,2),
  ins_expiry    DATE,
  wc_provider   TEXT,                        -- Workers comp
  wc_expiry     DATE,
  notes         TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES (All users — PMs and sub workers)
-- ============================================================

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  role          user_role NOT NULL DEFAULT 'sub_worker',
  is_lead       BOOLEAN DEFAULT FALSE,       -- lead worker for their company
  avatar_initials TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOBS
-- ============================================================

CREATE TABLE jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_number        TEXT UNIQUE,             -- human-readable e.g. HVAC-004
  name              TEXT NOT NULL,
  company_id        UUID NOT NULL REFERENCES companies(id),
  status            job_status NOT NULL DEFAULT 'pending',
  scope             TEXT,
  instructions      TEXT,
  safety_notes      TEXT,
  access_notes      TEXT,
  site_contact_name TEXT,
  site_contact_phone TEXT,

  -- Location
  address           TEXT NOT NULL,
  city              TEXT,
  state             TEXT,
  zip               TEXT,
  gps_lat           NUMERIC(10,7),
  gps_lng           NUMERIC(11,7),
  gps_radius_ft     INTEGER DEFAULT 250,     -- check-in allowed within this radius

  -- Dates
  start_date        DATE,
  due_date          DATE,
  completion_date   DATE,                    -- set when actually completed

  -- Financial
  budget            NUMERIC(12,2),
  pm_review_required BOOLEAN DEFAULT TRUE,
  pm_review_type    TEXT DEFAULT 'final_only', -- 'midpoint_and_final' | 'final_only' | 'none'

  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate job numbers
CREATE SEQUENCE job_number_seq START 1;
CREATE OR REPLACE FUNCTION set_job_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.job_number IS NULL THEN
    NEW.job_number := 'JOB-' || LPAD(nextval('job_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_job_number();

-- ============================================================
-- JOB WORKERS  (which workers are authorized on which job)
-- ============================================================

CREATE TABLE job_workers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by      UUID REFERENCES profiles(id),
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE,
  UNIQUE(job_id, worker_id)
);

-- ============================================================
-- CHECK-INS  (one row per check-in event per worker)
-- ============================================================

CREATE TABLE checkins (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id),

  status          checkin_status NOT NULL DEFAULT 'checked_in',
  checkin_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkout_at     TIMESTAMPTZ,
  hours_logged    NUMERIC(5,2),             -- calculated on checkout

  -- GPS at check-in
  checkin_lat     NUMERIC(10,7) NOT NULL,
  checkin_lng     NUMERIC(11,7) NOT NULL,
  checkin_dist_ft INTEGER,                  -- distance from job site at check-in

  -- GPS at check-out
  checkout_lat    NUMERIC(10,7),
  checkout_lng    NUMERIC(11,7),
  checkout_dist_ft INTEGER,

  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-calculate hours on checkout
CREATE OR REPLACE FUNCTION calc_hours_on_checkout()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkout_at IS NOT NULL AND OLD.checkout_at IS NULL THEN
    NEW.hours_logged := ROUND(
      EXTRACT(EPOCH FROM (NEW.checkout_at - NEW.checkin_at)) / 3600.0, 2
    );
    NEW.status := 'checked_out';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_calc_hours
  BEFORE UPDATE ON checkins
  FOR EACH ROW EXECUTE FUNCTION calc_hours_on_checkout();

-- ============================================================
-- JOB PLANS (uploaded plan files)
-- ============================================================

CREATE TABLE job_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,              -- Supabase storage path
  file_type     TEXT,                       -- pdf, png, jpg
  file_size     BIGINT,
  version       INTEGER DEFAULT 1,
  uploaded_by   UUID REFERENCES profiles(id),
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAN MARKUPS (saved canvas drawings on plans)
-- ============================================================

CREATE TABLE plan_markups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  plan_id       UUID REFERENCES job_plans(id),
  revision      INTEGER DEFAULT 1,
  markup_data   JSONB,                      -- canvas drawing data (strokes, pins, etc.)
  thumbnail_path TEXT,                      -- storage path for PNG export
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  notes         TEXT
);

-- ============================================================
-- PARTS / MATERIALS ISSUED
-- ============================================================

CREATE TABLE parts_issued (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  part_number   TEXT,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,2) NOT NULL,
  unit_cost     NUMERIC(10,2),
  total_cost    NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  status        part_status DEFAULT 'ordered',
  issued_by     UUID REFERENCES profiles(id),
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  notes         TEXT
);

-- ============================================================
-- PHOTOS  (GPS-tagged progress photos)
-- ============================================================

CREATE TABLE job_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  checkin_id      UUID REFERENCES checkins(id),
  storage_path    TEXT NOT NULL,
  thumbnail_path  TEXT,
  caption         TEXT,
  stage           TEXT,                     -- 'before' | 'during' | 'after' | 'issue'
  taken_by        UUID REFERENCES profiles(id),
  taken_at        TIMESTAMPTZ DEFAULT NOW(),

  -- GPS where photo was taken
  photo_lat       NUMERIC(10,7),
  photo_lng       NUMERIC(11,7),
  dist_from_site_ft INTEGER,

  is_approved     BOOLEAN,                  -- PM can approve/flag photos
  pm_note         TEXT
);

-- ============================================================
-- CHECKLISTS
-- ============================================================

CREATE TABLE checklist_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,              -- 'HVAC Install', 'Electrical Panel'
  trade         TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_template_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  section         TEXT,                     -- 'Pre-work', 'Installation', 'Completion'
  item_text       TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  required        BOOLEAN DEFAULT TRUE
);

CREATE TABLE job_checklist_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES checklist_template_items(id),
  section         TEXT,
  item_text       TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  required        BOOLEAN DEFAULT TRUE,
  is_checked      BOOLEAN DEFAULT FALSE,
  checked_by      UUID REFERENCES profiles(id),
  checked_at      TIMESTAMPTZ,
  notes           TEXT
);

-- ============================================================
-- PM INSPECTIONS / REVIEWS
-- ============================================================

CREATE TABLE pm_inspections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  visit_type      TEXT NOT NULL,            -- 'midpoint' | 'final'
  pm_id           UUID NOT NULL REFERENCES profiles(id),

  visited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_lat       NUMERIC(10,7),
  visit_lng       NUMERIC(11,7),
  dist_from_site_ft INTEGER,

  work_observed   TEXT,
  quality_result  inspection_result,
  issues_noted    TEXT,
  pm_notes        TEXT,

  -- Follow-up
  followup_required BOOLEAN DEFAULT FALSE,
  followup_date   DATE,
  followup_resolved BOOLEAN DEFAULT FALSE,
  followup_notes  TEXT,

  -- Sign-off
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Punch list items per inspection
CREATE TABLE pm_punch_list (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id   UUID NOT NULL REFERENCES pm_inspections(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id),
  item_text       TEXT NOT NULL,
  is_resolved     BOOLEAN DEFAULT FALSE,
  resolved_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHANGE ORDERS
-- ============================================================

CREATE TABLE change_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  co_number       TEXT,                     -- e.g. CO-001
  title           TEXT NOT NULL,
  description     TEXT,
  value           NUMERIC(12,2),            -- can be positive or negative
  days_added      INTEGER DEFAULT 0,
  status          change_order_status DEFAULT 'draft',

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  pm_signed_by    UUID REFERENCES profiles(id),
  pm_signed_at    TIMESTAMPTZ,

  sub_signed_by   UUID REFERENCES profiles(id),
  sub_signed_at   TIMESTAMPTZ,

  rejected_by     UUID REFERENCES profiles(id),
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE SEQUENCE co_number_seq START 1;
CREATE OR REPLACE FUNCTION set_co_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.co_number IS NULL THEN
    NEW.co_number := 'CO-' || LPAD(nextval('co_number_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_co_number
  BEFORE INSERT ON change_orders
  FOR EACH ROW EXECUTE FUNCTION set_co_number();

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  invoice_number  TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  storage_path    TEXT,                     -- uploaded invoice PDF
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LIEN WAIVERS
-- ============================================================

CREATE TABLE lien_waivers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  storage_path    TEXT,                     -- uploaded waiver PDF
  uploaded_by     UUID REFERENCES profiles(id),
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT
);

-- ============================================================
-- AUDIT LOG  (append-only, never update)
-- ============================================================

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID REFERENCES jobs(id),
  user_id         UUID REFERENCES profiles(id),
  company_id      UUID REFERENCES companies(id),
  action          audit_action NOT NULL,
  entity_type     TEXT,                     -- 'checkin' | 'photo' | 'job' etc.
  entity_id       UUID,
  gps_lat         NUMERIC(10,7),
  gps_lng         NUMERIC(11,7),
  dist_from_site_ft INTEGER,
  detail          JSONB,                    -- flexible extra data
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEDULED REPORTS
-- ============================================================

CREATE TABLE scheduled_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  report_type     TEXT NOT NULL,            -- 'performance' | 'labor' | 'cost' | 'compliance' etc.
  frequency       TEXT NOT NULL,            -- 'daily' | 'weekly' | 'monthly' | 'on_trigger'
  schedule_cron   TEXT,                     -- e.g. '0 8 * * 1' for Mon 8am
  recipients      TEXT[],                   -- array of email addresses
  filters         JSONB,                    -- {company_id, date_range, etc.}
  is_active       BOOLEAN DEFAULT TRUE,
  last_sent_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGERS (auto-update on all main tables)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_updated_at_companies   BEFORE UPDATE ON companies   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_profiles    BEFORE UPDATE ON profiles    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_jobs        BEFORE UPDATE ON jobs        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_inspections BEFORE UPDATE ON pm_inspections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
