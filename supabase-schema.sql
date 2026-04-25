-- ================================================================
-- FieldAxisHQ — Supabase Schema  v1.0
-- Run this entire file in Supabase SQL Editor
-- ================================================================

-- ── EXTENSIONS ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── COMPANIES (sub-contractor firms) ──────────────────────────
create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  trade         text,
  license_num   text,
  email         text,
  phone         text,
  address       text,
  ins_expiry    date,
  gc_contact    text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── PROFILES (extends auth.users) ─────────────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,
  role          text not null default 'sub_worker'
                  check (role in ('admin','pm','foreman','stager','signout','requestor','technician','sub_lead','sub_worker')),
  company_id    uuid references companies(id) on delete set null,
  is_lead       boolean not null default false,
  is_active     boolean not null default true,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email, coalesce(new.raw_user_meta_data->>'role','sub_worker'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── JOBS ──────────────────────────────────────────────────────
create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text not null default '',
  address         text not null default '',
  gps_lat         double precision,
  gps_lng         double precision,
  gps_radius_ft   integer not null default 250,
  gc_company      text not null default '',
  gc_contact      text not null default '',
  gc_phone        text not null default '',
  gc_email        text not null default '',
  super_name      text not null default '',
  super_phone     text not null default '',
  super_email     text not null default '',
  site_contact_name  text not null default '',
  site_contact_phone text not null default '',
  scope           text not null default '',
  notes           text not null default '',
  install_notes   text not null default '',
  job_walk_by     text not null default '',
  job_walk_date   date,
  job_walk_notes  text not null default '',
  phase           text not null default 'not_started'
                    check (phase in ('not_started','pre_construction','rough_in','trim_out','inspection','closeout','complete')),
  pct_complete    integer not null default 0 check (pct_complete between 0 and 100),
  archived        boolean not null default false,
  company_id      uuid references companies(id) on delete set null,
  pm_review_required  boolean not null default true,
  pm_review_type  text not null default 'final_only',
  contract_value  numeric(12,2),
  labor_budget    numeric(12,2),
  material_budget numeric(12,2),
  labor_rate      numeric(8,2),
  budget          numeric(12,2),
  date_contract   date,
  date_permit     date,
  date_start      date,
  due_date        date,
  date_roughin    date,
  date_trimout    date,
  date_inspection date,
  date_next_visit date,
  date_closeout   date,
  date_co         date,
  completion_date date,
  created_by      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── JOB WORKERS (assignment) ───────────────────────────────────
create table if not exists job_workers (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  worker_id   uuid not null references profiles(id) on delete cascade,
  is_active   boolean not null default true,
  added_by    text,
  added_at    timestamptz not null default now(),
  unique (job_id, worker_id)
);

-- ── CHECKINS (GPS) ─────────────────────────────────────────────
create table if not exists checkins (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  worker_id         uuid not null references profiles(id) on delete cascade,
  company_id        uuid references companies(id) on delete set null,
  checkin_lat       double precision,
  checkin_lng       double precision,
  checkin_dist_ft   integer,
  checkout_at       timestamptz,
  checkout_lat      double precision,
  checkout_lng      double precision,
  hours_logged      numeric(6,2),
  status            text not null default 'checked_in',
  checkin_at        timestamptz not null default now()
);

-- ── JOB ATTENDANCE (non-GPS sign-in) ──────────────────────────
create table if not exists job_attendance (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  user_name   text not null default '',
  user_role   text not null default '',
  sign_in_at  timestamptz not null default now(),
  sign_out_at timestamptz,
  hours       numeric(6,2),
  created_at  timestamptz not null default now()
);

-- ── CATALOG ────────────────────────────────────────────────────
create table if not exists catalog (
  barcode       text primary key,
  name          text not null,
  part_number   text not null default '',
  category      text not null default '',
  description   text not null default '',
  alt_barcodes  text[] not null default '{}',
  unit_cost     numeric(10,2) not null default 0
);

-- ── INVENTORY ──────────────────────────────────────────────────
create table if not exists inventory (
  id          text primary key,
  name        text not null default '',
  description text not null default '',
  qty         integer not null default 0,
  min_qty     integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- ── JOB PARTS (warehouse parts on a job) ──────────────────────
create table if not exists job_parts (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  part_id         text not null,
  part_name       text not null default '',
  status          text not null default 'staged'
                    check (status in ('staged','signed_out','partial_install','installed')),
  assigned_qty    integer not null default 1,
  taken_qty       integer not null default 0,
  installed_qty   integer not null default 0,
  over            boolean not null default false,
  staged_by       text,
  staged_at       text,
  signed_out_by   text,
  signed_out_at   text,
  installed_by    text,
  installed_at    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── JOB MANIFEST (expected parts list) ────────────────────────
create table if not exists job_manifest (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  part_id       text not null,
  part_name     text not null default '',
  expected_qty  integer not null default 1,
  notes         text not null default '',
  added_by      text,
  added_at      text
);

-- ── JOB PHOTOS ─────────────────────────────────────────────────
create table if not exists job_photos (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  url               text not null,
  public_id         text not null default '',
  caption           text not null default '',
  type              text not null default 'photo',
  storage_path      text,
  photo_lat         double precision,
  photo_lng         double precision,
  dist_from_site_ft integer,
  uploaded_by       text,
  created_at        timestamptz not null default now()
);

-- ── JOB PLANS ──────────────────────────────────────────────────
create table if not exists job_plans (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  name          text not null default 'Plan',
  file_name     text not null default '',
  storage_path  text,
  url           text not null,
  public_id     text not null default '',
  thumb_url     text not null default '',
  plan_type     text not null default 'plans',
  file_type     text,
  file_size     bigint,
  notes         text not null default '',
  markup_json   jsonb,
  uploaded_by   text,
  created_at    timestamptz not null default now()
);

-- ── JOB CHECKLIST ──────────────────────────────────────────────
create table if not exists job_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  item_text   text not null,
  section     text,
  is_checked  boolean not null default false,
  checked_by  uuid references profiles(id) on delete set null,
  checked_at  timestamptz,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── PM INSPECTIONS ─────────────────────────────────────────────
create table if not exists pm_inspections (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  pm_id             uuid references profiles(id) on delete set null,
  pm_name           text,
  visit_type        text not null default 'midpoint',
  work_observed     text,
  quality_result    text,
  issues_noted      text,
  pm_notes          text,
  followup_required boolean not null default false,
  followup_date     date,
  rejection_reason  text,
  gps_lat           double precision,
  gps_lng           double precision,
  dist_from_site_ft integer,
  approved_at       timestamptz,
  rejected_at       timestamptz,
  visited_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- ── CHANGE ORDERS ──────────────────────────────────────────────
create table if not exists change_orders (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  co_number       text not null,
  title           text not null,
  description     text,
  value           numeric(12,2) not null default 0,
  days_added      integer not null default 0,
  status          text not null default 'pending_sub',
  pm_signed_by    text,
  pm_signed_at    timestamptz,
  sub_signed_by   text,
  sub_signed_at   timestamptz,
  created_by      text,
  created_at      timestamptz not null default now()
);

-- ── DAILY LOGS ─────────────────────────────────────────────────
create table if not exists daily_logs (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  type        text not null default 'note',
  content     text not null,
  author      text,
  created_at  timestamptz not null default now()
);

-- ── GC ALERTS ──────────────────────────────────────────────────
create table if not exists gc_alerts (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  title       text not null,
  description text,
  priority    text not null default 'normal',
  status      text not null default 'open',
  resolved_at timestamptz,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- ── PART REQUESTS ──────────────────────────────────────────────
create table if not exists part_requests (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  part_id     text not null default '',
  part_name   text not null default '',
  qty         integer not null default 1,
  reason      text,
  status      text not null default 'pending',
  created_by  text,
  approved_by text,
  approved_at text,
  created_at  timestamptz not null default now()
);

-- ── ORDERS (parts ordering workflow) ──────────────────────────
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  job_id          text not null,
  notes           text not null default '',
  items           jsonb not null default '[]',
  status          text not null default 'pending',
  created_by      text,
  approved_by     text,
  approved_at     timestamptz,
  rejected_by     text,
  rejected_at     timestamptz,
  rejection_note  text,
  staged_by       text,
  staged_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- ── NOTIFICATIONS ──────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  title       text not null,
  message     text not null default '',
  meta        jsonb not null default '{}',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── AUDIT LOG ──────────────────────────────────────────────────
create table if not exists audit_log (
  id          text primary key,
  type        text not null,
  job_id      text,
  part_id     text,
  part_name   text,
  username    text,
  gps_lat     double precision,
  gps_lng     double precision,
  extra       text,
  created_at  timestamptz not null default now()
);

-- ── INVOICES ───────────────────────────────────────────────────
create table if not exists invoices (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid references jobs(id) on delete set null,
  company_id  uuid references companies(id) on delete set null,
  amount      numeric(12,2) not null default 0,
  due_date    date,
  paid_at     timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── LIEN WAIVERS ───────────────────────────────────────────────
create table if not exists lien_waivers (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  company_id  uuid references companies(id) on delete set null,
  type        text not null default 'unconditional',
  amount      numeric(12,2),
  url         text,
  signed_at   date,
  uploaded_by text,
  created_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════
create index if not exists idx_jobs_phase         on jobs(phase) where not archived;
create index if not exists idx_jobs_archived      on jobs(archived);
create index if not exists idx_jobs_company       on jobs(company_id);
create index if not exists idx_job_workers_job    on job_workers(job_id);
create index if not exists idx_job_workers_worker on job_workers(worker_id);
create index if not exists idx_checkins_job       on checkins(job_id);
create index if not exists idx_checkins_worker    on checkins(worker_id);
create index if not exists idx_checkins_at        on checkins(checkin_at desc);
create index if not exists idx_job_parts_job      on job_parts(job_id);
create index if not exists idx_job_parts_part     on job_parts(part_id);
create index if not exists idx_job_manifest_job   on job_manifest(job_id);
create index if not exists idx_job_photos_job     on job_photos(job_id);
create index if not exists idx_job_plans_job      on job_plans(job_id);
create index if not exists idx_checklist_job      on job_checklist_items(job_id);
create index if not exists idx_pm_insps_job       on pm_inspections(job_id);
create index if not exists idx_change_orders_job  on change_orders(job_id);
create index if not exists idx_daily_logs_job     on daily_logs(job_id);
create index if not exists idx_gc_alerts_job      on gc_alerts(job_id);
create index if not exists idx_part_requests_job  on part_requests(job_id);
create index if not exists idx_orders_status      on orders(status);
create index if not exists idx_notif_read         on notifications(read);
create index if not exists idx_attendance_job     on job_attendance(job_id);
create index if not exists idx_attendance_user    on job_attendance(user_id);
create index if not exists idx_profiles_company   on profiles(company_id);
create index if not exists idx_catalog_name       on catalog(name);
create index if not exists idx_inventory_qty      on inventory(qty);

-- ════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════
alter table profiles           enable row level security;
alter table companies          enable row level security;
alter table jobs               enable row level security;
alter table job_workers        enable row level security;
alter table checkins           enable row level security;
alter table job_attendance     enable row level security;
alter table catalog            enable row level security;
alter table inventory          enable row level security;
alter table job_parts          enable row level security;
alter table job_manifest       enable row level security;
alter table job_photos         enable row level security;
alter table job_plans          enable row level security;
alter table job_checklist_items enable row level security;
alter table pm_inspections     enable row level security;
alter table change_orders      enable row level security;
alter table daily_logs         enable row level security;
alter table gc_alerts          enable row level security;
alter table part_requests      enable row level security;
alter table orders             enable row level security;
alter table notifications      enable row level security;
alter table audit_log          enable row level security;
alter table invoices           enable row level security;
alter table lien_waivers       enable row level security;

-- Helper: get current user's role
create or replace function get_my_role() returns text
language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- Helper: is current user a staff member (not sub worker)
create or replace function is_staff() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','pm','foreman','stager','signout','requestor','technician'))
$$;

-- Helper: is current user a sub worker assigned to job
create or replace function is_assigned_to_job(p_job_id uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from job_workers
    where job_id = p_job_id and worker_id = auth.uid() and is_active = true
  )
$$;

-- PROFILES: everyone can read, own row editable, admins see all
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (id = auth.uid() or is_staff());
create policy "profiles_update" on profiles for update using (id = auth.uid() or get_my_role() in ('admin','pm'));
create policy "profiles_delete" on profiles for delete using (get_my_role() = 'admin');

-- COMPANIES: all authenticated can read
create policy "companies_select" on companies for select using (auth.role() = 'authenticated');
create policy "companies_write"  on companies for all   using (get_my_role() in ('admin','pm'));

-- JOBS: staff see all, subs see only assigned
create policy "jobs_staff_select" on jobs for select
  using (is_staff() or is_assigned_to_job(id));
create policy "jobs_staff_write"  on jobs for all
  using (is_staff());

-- JOB WORKERS: staff manage, subs read own
create policy "jw_select" on job_workers for select
  using (is_staff() or worker_id = auth.uid());
create policy "jw_write"  on job_workers for all
  using (is_staff());

-- CHECKINS: staff see all, subs see own
create policy "ci_select" on checkins for select
  using (is_staff() or worker_id = auth.uid());
create policy "ci_insert" on checkins for insert
  with check (worker_id = auth.uid() or is_staff());
create policy "ci_update" on checkins for update
  using (worker_id = auth.uid() or is_staff());

-- JOB ATTENDANCE: same pattern
create policy "att_select" on job_attendance for select
  using (is_staff() or user_id = auth.uid());
create policy "att_write"  on job_attendance for all
  using (is_staff() or user_id = auth.uid());

-- CATALOG & INVENTORY: all authenticated can read, staff write
create policy "catalog_select"    on catalog    for select using (auth.role() = 'authenticated');
create policy "catalog_write"     on catalog    for all    using (is_staff());
create policy "inventory_select"  on inventory  for select using (auth.role() = 'authenticated');
create policy "inventory_write"   on inventory  for all    using (is_staff());

-- JOB PARTS: staff all, subs on assigned jobs
create policy "jp_select" on job_parts for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "jp_write"  on job_parts for all
  using (is_staff() or is_assigned_to_job(job_id));

-- JOB MANIFEST: same
create policy "mf_select" on job_manifest for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "mf_write"  on job_manifest for all
  using (is_staff());

-- JOB PHOTOS: staff all, subs on assigned jobs
create policy "ph_select" on job_photos for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "ph_write"  on job_photos for all
  using (is_staff() or is_assigned_to_job(job_id));

-- JOB PLANS: staff write, assigned subs read
create policy "pl_select" on job_plans for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "pl_write"  on job_plans for all
  using (is_staff());

-- CHECKLIST: staff all, assigned subs check items
create policy "cl_select" on job_checklist_items for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "cl_write"  on job_checklist_items for all
  using (is_staff() or is_assigned_to_job(job_id));

-- PM INSPECTIONS: staff
create policy "ins_select" on pm_inspections for select using (is_staff());
create policy "ins_write"  on pm_inspections for all   using (is_staff());

-- CHANGE ORDERS: staff all, subs read assigned
create policy "co_select" on change_orders for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "co_write"  on change_orders for all
  using (is_staff());

-- DAILY LOGS: staff all, subs on assigned jobs
create policy "dl_select" on daily_logs for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "dl_write"  on daily_logs for all
  using (is_staff() or is_assigned_to_job(job_id));

-- GC ALERTS: staff all, subs on assigned
create policy "gc_select" on gc_alerts for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "gc_write"  on gc_alerts for all
  using (is_staff() or is_assigned_to_job(job_id));

-- PART REQUESTS: staff all, subs submit for assigned
create policy "pr_select" on part_requests for select
  using (is_staff() or is_assigned_to_job(job_id));
create policy "pr_write"  on part_requests for all
  using (is_staff() or is_assigned_to_job(job_id));

-- ORDERS: staff all, requestors their own
create policy "ord_select" on orders for select
  using (is_staff() or created_by = (select full_name from profiles where id = auth.uid()));
create policy "ord_write"  on orders for all   using (auth.role() = 'authenticated');

-- NOTIFICATIONS: all staff
create policy "notif_select" on notifications for select using (is_staff());
create policy "notif_write"  on notifications for all   using (is_staff());

-- AUDIT LOG: admins and PMs only
create policy "log_select" on audit_log for select using (get_my_role() in ('admin','pm'));
create policy "log_insert" on audit_log for insert with check (auth.role() = 'authenticated');

-- INVOICES & LIEN WAIVERS: staff
create policy "inv_all"   on invoices      for all using (is_staff());
create policy "lw_all"    on lien_waivers  for all using (is_staff());

-- ════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ════════════════════════════════════════════════
-- Run in Supabase Dashboard → Storage, or via API:
-- create bucket 'fieldtrack-photos'  (public: true, max 20MB)
-- create bucket 'fieldtrack-plans'   (public: true, max 50MB)

-- Storage policies (for dashboard):
-- fieldtrack-photos: allow authenticated users to upload to jobs/{job_id}/* or workers/{user_id}/*
-- fieldtrack-plans:  allow authenticated staff to upload to jobs/{job_id}/plans/*

-- ════════════════════════════════════════════════
-- SEED: DEFAULT ADMIN (optional — server.js also seeds)
-- Uncomment if you want a Supabase auth user for testing:
-- ════════════════════════════════════════════════
-- insert into auth.users (id, email, encrypted_password, email_confirmed_at, role)
-- values (gen_random_uuid(), 'admin@fieldaxishq.com', crypt('admin123', gen_salt('bf')), now(), 'authenticated')
-- on conflict do nothing;

-- ════════════════════════════════════════════════
-- DONE — FieldAxisHQ schema loaded
-- ════════════════════════════════════════════════

-- ════════════════════════════════════════════════
-- ADDITIONS v2 — Daily Reports, Job Walks, Safety, etc.
-- ════════════════════════════════════════════════

-- DAILY REPORTS
create table if not exists daily_reports (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  report_date   date not null default current_date,
  weather       text,
  temp_high     integer,
  temp_low      integer,
  workers_on_site integer default 0,
  work_performed text,
  materials_used text,
  equipment_used text,
  safety_incidents text,
  visitors       text,
  delays         text,
  delay_reason   text,
  photos_taken   integer default 0,
  submitted_by   text,
  submitted_by_id uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- JOB WALKS
create table if not exists job_walks (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  walk_date       date not null default current_date,
  conducted_by    text,
  conducted_by_id uuid references profiles(id) on delete set null,
  attendees       text,
  site_conditions text,
  scope_confirmed boolean default false,
  issues_found    text,
  action_items    jsonb default '[]',
  notes           text,
  signature_url   text,
  created_at      timestamptz not null default now()
);

-- JOB WALK PLANS (markup)
create table if not exists job_walk_plans (
  id            uuid primary key default gen_random_uuid(),
  job_walk_id   uuid references job_walks(id) on delete cascade,
  job_id        uuid references jobs(id) on delete cascade,
  name          text not null,
  url           text not null,
  storage_path  text,
  markup_json   jsonb default '{"dots":[],"texts":[],"legend":{}}',
  uploaded_by   text,
  created_at    timestamptz not null default now()
);

-- SAFETY TOPICS
create table if not exists safety_topics (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  category      text default 'General',
  week_of       date,
  created_by    text,
  created_by_id uuid references profiles(id) on delete set null,
  assigned_to   text[] default '{}',
  company_ids   uuid[] default '{}',
  created_at    timestamptz not null default now()
);

-- SAFETY ACKNOWLEDGEMENTS
create table if not exists safety_acks (
  id              uuid primary key default gen_random_uuid(),
  topic_id        uuid not null references safety_topics(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  full_name       text,
  acknowledged_at timestamptz not null default now(),
  signature_url   text,
  unique(topic_id, profile_id)
);

-- PUNCHLIST (deficiencies from job walk)
create table if not exists punchlist (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  job_walk_id uuid references job_walks(id) on delete set null,
  item        text not null,
  location    text,
  assigned_to text,
  priority    text default 'normal',
  status      text default 'open',
  due_date    date,
  resolved_at timestamptz,
  resolved_by text,
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- SCAN LOG (detailed barcode scan history)
create table if not exists scan_log (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid references jobs(id) on delete cascade,
  part_id     text not null,
  part_name   text,
  action      text not null check (action in ('stage','sign_out','return')),
  qty         integer not null default 1,
  scanned_by  text,
  scanned_by_id uuid references profiles(id) on delete set null,
  scanner_type text default 'camera',
  batch_id    uuid,
  created_at  timestamptz not null default now()
);

-- Enable RLS on new tables
alter table daily_reports    enable row level security;
alter table job_walks        enable row level security;
alter table job_walk_plans   enable row level security;
alter table safety_topics    enable row level security;
alter table safety_acks      enable row level security;
alter table punchlist        enable row level security;
alter table scan_log         enable row level security;

-- Policies (staff full access, subs read their assigned)
create policy "dr_all" on daily_reports for all using (auth.role()='authenticated');
create policy "jw_all_v2" on job_walks for all using (auth.role()='authenticated');
create policy "jwp_all" on job_walk_plans for all using (auth.role()='authenticated');
create policy "st_select" on safety_topics for select using (auth.role()='authenticated');
create policy "st_write" on safety_topics for all using (is_staff());
create policy "sa_all" on safety_acks for all using (auth.role()='authenticated');
create policy "pl_all_v2" on punchlist for all using (auth.role()='authenticated');
create policy "sl_all" on scan_log for all using (auth.role()='authenticated');

-- Indexes
create index if not exists idx_daily_reports_job  on daily_reports(job_id);
create index if not exists idx_daily_reports_date on daily_reports(report_date desc);
create index if not exists idx_job_walks_job      on job_walks(job_id);
create index if not exists idx_safety_topics_week on safety_topics(week_of desc);
create index if not exists idx_safety_acks_topic  on safety_acks(topic_id);
create index if not exists idx_punchlist_job      on punchlist(job_id);
create index if not exists idx_scan_log_job       on scan_log(job_id);
create index if not exists idx_scan_log_part      on scan_log(part_id);
