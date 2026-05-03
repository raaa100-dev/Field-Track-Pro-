
-- ── Parts staging enhancements ───────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staging_status        text DEFAULT 'pending';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expected_staging_date date DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS ordered_qty      integer DEFAULT 0;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS staged_at        timestamptz DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS checked_out_at   timestamptz DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS checked_out_by   text DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS notes            text DEFAULT NULL;

SELECT 'Parts staging columns added' AS status;
