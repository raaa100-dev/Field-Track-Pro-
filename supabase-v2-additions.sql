-- ================================================================
-- FieldAxisHQ v2 — Additional Tables
-- Run AFTER supabase-schema.sql
-- ================================================================

-- DAILY REPORTS
create table if not exists daily_reports (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  report_date   date not null default current_date,
  weather       text,
  temp_high     integer,
  temp_low      integer,
  crew_count    integer default 0,
  work_performed text,
  materials_used text,
  equipment_used text,
  visitors       text,
  issues         text,
  photos         jsonb default '[]',
  submitted_by   text,
  submitted_by_id uuid references profiles(id),
  created_at    timestamptz default now()
);

-- JOB WALKS
create table if not exists job_walks (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  walk_date     date not null default current_date,
  conducted_by  text,
  attendees     text,
  scope_notes   text,
  existing_conditions text,
  access_notes  text,
  electrical_notes text,
  mechanical_notes text,
  special_requirements text,
  hazards_noted text,
  follow_up_items text,
  plans         jsonb default '[]',
  photos        jsonb default '[]',
  created_at    timestamptz default now()
);

-- PLAN MARKUPS
create table if not exists plan_markups (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  plan_id       uuid references job_plans(id) on delete cascade,
  markup_json   jsonb default '[]',
  legend        jsonb default '[]',
  version       integer default 1,
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- SAFETY TOPICS
create table if not exists safety_topics (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  category      text default 'general',
  week_of       date,
  assigned_to   text default 'all',
  company_ids   uuid[] default '{}',
  profile_ids   uuid[] default '{}',
  attachment_url text,
  created_by    text,
  created_at    timestamptz default now()
);

-- SAFETY ACKNOWLEDGEMENTS
create table if not exists safety_acks (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid references safety_topics(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete cascade,
  full_name     text,
  acknowledged_at timestamptz default now(),
  unique(topic_id, profile_id)
);

-- SIGN-IN LOG (QR / manual job site sign-in)
create table if not exists site_signins (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete set null,
  full_name     text not null,
  company_name  text,
  role_onsite   text,
  signed_in_at  timestamptz default now(),
  signed_out_at timestamptz,
  hours         numeric(6,2),
  notes         text
);

-- PUNCH LIST (snag list)
create table if not exists punch_list (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  item          text not null,
  location      text,
  priority      text default 'normal',
  assigned_to   text,
  status        text default 'open',
  photo_url     text,
  resolved_at   timestamptz,
  resolved_by   text,
  created_by    text,
  created_at    timestamptz default now()
);

-- DOCUMENT VAULT
create table if not exists job_documents (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references jobs(id) on delete cascade,
  name          text not null,
  category      text default 'general',
  url           text not null,
  storage_path  text,
  file_size     bigint,
  uploaded_by   text,
  created_at    timestamptz default now()
);

-- CHANGE ORDERS (upgrade existing with more fields)
alter table change_orders add column if not exists category text default 'scope';
alter table change_orders add column if not exists labor_hours numeric(8,2);
alter table change_orders add column if not exists material_cost numeric(12,2);

-- JOBS — add new phase values and fields
alter table jobs add column if not exists phase_detail text default 'not_started';
alter table jobs add column if not exists expected_onsite_date date;
alter table jobs add column if not exists next_visit_date date;
alter table jobs add column if not exists pretest_date date;
alter table jobs add column if not exists final_date date;
alter table jobs add column if not exists qr_code_url text;
alter table jobs add column if not exists budget_labor numeric(12,2);
alter table jobs add column if not exists budget_material numeric(12,2);
alter table jobs add column if not exists actual_labor numeric(12,2);
alter table jobs add column if not exists actual_material numeric(12,2);
alter table jobs add column if not exists lien_waiver_required boolean default false;
alter table jobs add column if not exists overtime_alert_hrs integer default 8;

-- CATALOG — add more fields
alter table catalog add column if not exists description text;
alter table catalog add column if not exists manufacturer text;
alter table catalog add column if not exists unit text default 'EA';
alter table catalog add column if not exists image_url text;

-- JOB PARTS — add missing fields  
alter table job_parts add column if not exists description text;
alter table job_parts add column if not exists unit_cost numeric(10,2);
alter table job_parts add column if not exists checkout_note text;
alter table job_parts add column if not exists checked_out_by text;
alter table job_parts add column if not exists checked_out_at timestamptz;

-- INDEXES for new tables
create index if not exists idx_daily_reports_job on daily_reports(job_id);
create index if not exists idx_daily_reports_date on daily_reports(report_date desc);
create index if not exists idx_job_walks_job on job_walks(job_id);
create index if not exists idx_safety_topics_week on safety_topics(week_of desc);
create index if not exists idx_safety_acks_topic on safety_acks(topic_id);
create index if not exists idx_site_signins_job on site_signins(job_id);
create index if not exists idx_punch_list_job on punch_list(job_id);
create index if not exists idx_job_docs_job on job_documents(job_id);

-- RLS for new tables
alter table daily_reports enable row level security;
alter table job_walks enable row level security;
alter table plan_markups enable row level security;
alter table safety_topics enable row level security;
alter table safety_acks enable row level security;
alter table site_signins enable row level security;
alter table punch_list enable row level security;
alter table job_documents enable row level security;

create policy "dr_all" on daily_reports for all using (auth.role()='authenticated');
create policy "jw_all" on job_walks for all using (auth.role()='authenticated');
create policy "pm_all" on plan_markups for all using (auth.role()='authenticated');
create policy "st_select" on safety_topics for select using (auth.role()='authenticated');
create policy "st_write" on safety_topics for all using (is_staff());
create policy "sa_all" on safety_acks for all using (auth.role()='authenticated');
create policy "ss_all" on site_signins for all using (auth.role()='authenticated');
create policy "pl_all" on punch_list for all using (auth.role()='authenticated');
create policy "jd_all" on job_documents for all using (auth.role()='authenticated');

select 'v2 schema additions complete' as status;
