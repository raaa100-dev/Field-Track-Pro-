-- ================================================================
-- FieldAxisHQ v2 — Schema Additions
-- Run this in Supabase SQL Editor AFTER the original schema
-- ================================================================

-- DAILY REPORTS
create table if not exists daily_reports (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  report_date   date not null default current_date,
  weather       text not null default '',
  temp_high     integer,
  temp_low      integer,
  crew_count    integer not null default 0,
  hours_worked  numeric(6,2),
  work_performed text not null default '',
  materials_used text not null default '',
  equipment_used text not null default '',
  issues        text not null default '',
  visitors      text not null default '',
  photos        jsonb not null default '[]',
  submitted_by  text,
  submitted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- JOB WALKS
create table if not exists job_walks (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  walk_date     date not null default current_date,
  walked_by     text not null default '',
  attendees     text not null default '',
  scope_notes   text not null default '',
  conditions    text not null default '',
  measurements  text not null default '',
  photos        jsonb not null default '[]',
  plan_markups  jsonb not null default '[]',
  issues_found  text not null default '',
  action_items  text not null default '',
  follow_up_date date,
  status        text not null default 'open',
  created_at    timestamptz not null default now()
);

-- JOB WALK PLANS (PDF uploads with markup)
create table if not exists job_walk_plans (
  id            uuid primary key default gen_random_uuid(),
  job_walk_id   uuid references job_walks(id) on delete cascade,
  job_id        uuid references jobs(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  url           text not null,
  markup_json   jsonb not null default '{"dots":[],"textboxes":[],"legend":[]}',
  created_at    timestamptz not null default now()
);

-- SAFETY TOPICS
create table if not exists safety_topics (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null default '',
  category      text not null default 'general',
  week_of       date,
  attachments   jsonb not null default '[]',
  created_by    text,
  created_at    timestamptz not null default now()
);

-- SAFETY ACKNOWLEDGEMENTS
create table if not exists safety_acks (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid references safety_topics(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade,
  user_name     text not null default '',
  acknowledged_at timestamptz not null default now(),
  unique(topic_id, user_id)
);

-- SAFETY ASSIGNMENTS
create table if not exists safety_assignments (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid references safety_topics(id) on delete cascade,
  assigned_to   uuid references profiles(id) on delete cascade,
  assigned_name text not null default '',
  due_date      date,
  assigned_at   timestamptz not null default now()
);

-- PUNCH LIST
create table if not exists punch_list (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  item          text not null,
  location      text not null default '',
  assigned_to   text not null default '',
  priority      text not null default 'normal',
  status        text not null default 'open',
  due_date      date,
  completed_at  timestamptz,
  completed_by  text,
  photos        jsonb not null default '[]',
  created_by    text,
  created_at    timestamptz not null default now()
);

-- DOCUMENT VAULT
create table if not exists job_documents (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  name          text not null,
  category      text not null default 'general',
  file_name     text not null,
  storage_path  text,
  url           text not null,
  uploaded_by   text,
  created_at    timestamptz not null default now()
);

-- LIEN WAIVERS (enhanced)
-- (already exists, skip)

-- QR CODES per job (store generated token)
alter table jobs add column if not exists qr_token text unique;
alter table jobs add column if not exists expected_onsite_date date;
alter table jobs add column if not exists next_visit_date date;

-- Enhanced job stages
alter table jobs drop constraint if exists jobs_phase_check;
alter table jobs add constraint jobs_phase_check check (
  phase in ('not_started','in_progress','pre_test','pre_tested','ready_for_final','complete','cancelled')
);

-- Update catalog with more fields
alter table catalog add column if not exists description text not null default '';
alter table catalog add column if not exists vendor text not null default '';
alter table catalog add column if not exists unit_of_measure text not null default 'each';

-- Enhanced job_parts with better tracking
alter table job_parts add column if not exists checked_out_by text;
alter table job_parts add column if not exists checked_out_at timestamptz;
alter table job_parts add column if not exists notes text not null default '';
alter table job_parts add column if not exists job_location text not null default '';

-- Scan events log (every scan gets logged)
create table if not exists scan_events (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  part_id       text not null,
  part_name     text not null default '',
  action        text not null, -- 'stage_in' | 'check_out' | 'return'
  qty           integer not null default 1,
  scanned_by    text not null default '',
  scanned_at    timestamptz not null default now(),
  device_info   text not null default ''
);

-- Indexes
create index if not exists idx_daily_reports_job on daily_reports(job_id);
create index if not exists idx_daily_reports_date on daily_reports(report_date desc);
create index if not exists idx_job_walks_job on job_walks(job_id);
create index if not exists idx_safety_topics_week on safety_topics(week_of desc);
create index if not exists idx_safety_acks_topic on safety_acks(topic_id);
create index if not exists idx_safety_acks_user on safety_acks(user_id);
create index if not exists idx_punch_list_job on punch_list(job_id);
create index if not exists idx_scan_events_job on scan_events(job_id);
create index if not exists idx_scan_events_part on scan_events(part_id);
create index if not exists idx_job_docs_job on job_documents(job_id);

-- RLS
alter table daily_reports enable row level security;
alter table job_walks enable row level security;
alter table job_walk_plans enable row level security;
alter table safety_topics enable row level security;
alter table safety_acks enable row level security;
alter table safety_assignments enable row level security;
alter table punch_list enable row level security;
alter table job_documents enable row level security;
alter table scan_events enable row level security;

create policy "dr_all" on daily_reports for all using (auth.role()='authenticated');
create policy "jw_all" on job_walks for all using (auth.role()='authenticated');
create policy "jwp_all" on job_walk_plans for all using (auth.role()='authenticated');
create policy "st_all" on safety_topics for all using (auth.role()='authenticated');
create policy "sa_all" on safety_acks for all using (auth.role()='authenticated');
create policy "sass_all" on safety_assignments for all using (auth.role()='authenticated');
create policy "pl_rls" on punch_list for all using (auth.role()='authenticated');
create policy "jd_all" on job_documents for all using (auth.role()='authenticated');
create policy "se_all" on scan_events for all using (auth.role()='authenticated');

select 'v2 schema additions complete' as status;

-- ── v2.1 ADDITIONS ────────────────────────────────────────────
-- Run these in Supabase SQL Editor

-- PM fields on jobs
alter table jobs add column if not exists project_manager text not null default '';
alter table jobs add column if not exists pm_visit_schedule text not null default 'none';
alter table jobs add column if not exists next_pm_visit date;

-- Sub contractor work assignments per job
create table if not exists job_sub_assignments (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  scope_of_work text not null default '',
  contract_value numeric(12,2),
  status        text not null default 'assigned',
  start_date    date,
  due_date      date,
  notes         text not null default '',
  created_by    text,
  created_at    timestamptz not null default now()
);

-- PM visits log (separate from PM inspections)
create table if not exists pm_visits (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  visit_date      date not null default current_date,
  pm_name         text not null default '',
  observations    text not null default '',
  issues          text not null default '',
  outcome         text not null default 'visited',
  next_visit_date date,
  created_at      timestamptz not null default now()
);

-- job_walk_plans: allow null job_walk_id for job-level as-builts
alter table job_walk_plans alter column job_walk_id drop not null;

-- Indexes
create index if not exists idx_job_sub_job on job_sub_assignments(job_id);
create index if not exists idx_pm_visits_job on pm_visits(job_id);

-- RLS
alter table job_sub_assignments enable row level security;
alter table pm_visits enable row level security;
create policy "jsa_all" on job_sub_assignments for all using (auth.role()='authenticated');
create policy "pmv_all" on pm_visits for all using (auth.role()='authenticated');

select 'v2.1 additions complete' as status;

-- ── Urgent Flag + Tasks System ───────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_urgent          boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgent_note        text DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgent_assigned_to uuid DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgent_assigned_name text DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgent_priority    text DEFAULT 'high';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgent_flagged_at  timestamptz DEFAULT NULL;

CREATE TABLE IF NOT EXISTS job_tasks (
  id              text PRIMARY KEY,
  job_id          text REFERENCES jobs(id) ON DELETE SET NULL,
  job_name        text DEFAULT '',
  title           text NOT NULL,
  description     text DEFAULT '',
  assigned_to     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_name   text DEFAULT '',
  priority        text DEFAULT 'medium',
  status          text DEFAULT 'open',
  source          text DEFAULT 'manual',
  created_by      text DEFAULT '',
  resolution_notes text DEFAULT NULL,
  resolved_at     timestamptz DEFAULT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_tasks_job_id    ON job_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_assigned  ON job_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_tasks_status    ON job_tasks(status);

ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "auth_job_tasks" ON job_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'Urgent flag + job_tasks table created' AS status;
