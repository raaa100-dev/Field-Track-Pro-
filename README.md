# FieldTrack Pro — Supabase Backend Setup

## Files in this package

| File | What it does |
|------|-------------|
| `01_schema.sql` | All tables, enums, triggers, auto-increments |
| `02_rls_and_indexes.sql` | Row-level security policies + performance indexes |
| `03_views_and_functions.sql` | Reporting views, GPS check-in RPC, stored procedures |
| `fieldtrack-client.js` | JavaScript client library (import in your frontend) |

---

## 1. Create your Supabase project

1. Go to https://supabase.com → New Project
2. Pick a name (e.g. `fieldtrack-pro`), set a strong DB password
3. Choose your region (pick closest to Phoenix/Arizona — `us-west-1`)

---

## 2. Run the SQL files — in order

In your Supabase dashboard → **SQL Editor**, run each file in order:

```
01_schema.sql          ← tables, enums, triggers
02_rls_and_indexes.sql ← RLS policies, indexes
03_views_and_functions.sql ← views, GPS checkin RPC, reports
```

Run each file completely before starting the next.

---

## 3. Create Storage Buckets

In **Storage** → New Bucket, create these two buckets:

| Bucket name | Public? | Purpose |
|-------------|---------|---------|
| `fieldtrack-photos` | No (private) | Progress photos |
| `fieldtrack-plans` | No (private) | Plan PDFs and images |

Then add storage policies for each bucket:

```sql
-- Allow authenticated users to upload to their job folders
CREATE POLICY "auth_upload_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fieldtrack-photos');

CREATE POLICY "auth_read_photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fieldtrack-photos');

CREATE POLICY "auth_upload_plans" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fieldtrack-plans');

CREATE POLICY "auth_read_plans" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fieldtrack-plans');
```

---

## 4. Set up Auth

In **Authentication** → Settings:

- **Email confirmations**: Disable for internal app (or enable if you want workers to confirm)
- **Site URL**: Your frontend URL
- **Redirect URLs**: Add your app URL

To create the first PM/admin user:

```sql
-- After creating the user in Auth, run this to set their profile + role:
INSERT INTO profiles (id, full_name, email, role)
VALUES (
  '<auth_user_id_from_supabase_auth>',
  'Your Name',
  'you@company.com',
  'pm'
);
```

---

## 5. Environment variables

In your frontend project, add a `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in: Supabase Dashboard → Project Settings → API

---

## 6. Install the client

```bash
npm install @supabase/supabase-js
```

Then import and use:

```js
import { jobsApi, checkinsApi, reportsApi } from './fieldtrack-client.js'

// Get all jobs (PMs see all, subs see their assigned jobs via RLS)
const jobs = await jobsApi.list({ status: 'in_progress' })

// GPS check-in (validates distance server-side)
navigator.geolocation.getCurrentPosition(async pos => {
  const result = await checkinsApi.checkIn(
    jobId,
    pos.coords.latitude,
    pos.coords.longitude
  )
  if (result.blocked) {
    alert(`Too far — you are ${result.dist_ft}ft from the site`)
  } else {
    alert(`Checked in! ${result.dist_ft}ft from site`)
  }
})

// PM sign-off
await inspectionsApi.approve(inspectionId, jobId)

// Pull compliance report
const report = await reportsApi.compliance()
```

---

## Database table overview

```
companies              Sub companies (Cruz HVAC, Rios Electric, etc.)
profiles               All users — PMs and sub workers
jobs                   Job records with GPS coords and geofence radius
job_workers            Which workers are authorized on which job
checkins               Every GPS check-in and check-out event
job_plans              Uploaded plan files (stored in Supabase Storage)
plan_markups           Saved canvas markup data (JSON) per revision
parts_issued           Parts and materials issued to jobs
job_photos             GPS-tagged progress photos
checklist_templates    Reusable checklist templates per trade
job_checklist_items    Per-job checklist items with completion tracking
pm_inspections         PM visit records with GPS, quality rating, notes
pm_punch_list          Punch list items per inspection
change_orders          Scope change requests with dual signature tracking
invoices               Invoice records with payment status
lien_waivers           Uploaded lien waiver documents
audit_log              Append-only log of every action (GPS, user, time)
scheduled_reports      Email report schedule config
```

## Key views (use these in your queries)

```
job_summary            Jobs with computed fields (overdue, worker count, progress %)
active_checkins        Live GPS — workers currently on site
worker_time_summary    Time log joined with names and job details
job_cost_summary       Budget vs actual per job
sub_performance_summary On-time rate, compliance, insurance status per company
compliance_overview    Single-row count of all outstanding compliance items
```

## Key RPC functions (call via supabase.rpc)

```
gps_checkin(job_id, lat, lng)   GPS-validated check-in — returns success/blocked
gps_checkout(job_id, lat, lng)  Check out and auto-calculate hours
report_daily_checkins(date)     All check-ins for a given date
report_job_status(start, end)   Job status report for a date range
```

---

## Role-based access (RLS summary)

| Role | Jobs | Workers | GPS/Checkins | Photos | PM Inspections | Reports |
|------|------|---------|--------------|--------|----------------|---------|
| `admin` | All | All | All | All | All | All |
| `pm` | All | All | All | All | Full control | All |
| `sub_lead` | Assigned only | Own company | Own + co-workers | Own jobs | Read only | Own company |
| `sub_worker` | Assigned only | Own profile | Own checkins | Own uploads | Read only | — |

Subs cannot see jobs they are not assigned to — enforced at the database level.

---

## Next steps to go live

1. Connect the `FieldTrack-Pro.html` frontend to this Supabase backend using `fieldtrack-client.js`
2. Add a geocoding call (Google Maps API or Mapbox) when a PM enters a job address to auto-fill `gps_lat`/`gps_lng`
3. Set up a Supabase Edge Function to handle scheduled email reports (trigger via cron)
4. Configure Supabase Auth email templates for worker invitations
5. Add Supabase Realtime to the GPS dashboard for live updates
