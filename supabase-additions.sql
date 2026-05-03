
-- ── Parts staging enhancements ───────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staging_status        text DEFAULT 'pending';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expected_staging_date date DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS ordered_qty      integer DEFAULT 0;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS staged_at        timestamptz DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS checked_out_at   timestamptz DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS checked_out_by   text DEFAULT NULL;
ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS notes            text DEFAULT NULL;

SELECT 'Parts staging columns added' AS status;

-- ── New job fields ────────────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number               text DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimator                text DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_contract_value  numeric(12,2) DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS trade                    text DEFAULT NULL;
SELECT 'New job fields added' AS status;

-- ── Projected dates ───────────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS projected_start    date DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS projected_closeout date DEFAULT NULL;
SELECT 'Projected date columns added' AS status;

-- ── PM Visit type ─────────────────────────────────────────────────────────────
ALTER TABLE pm_visits ADD COLUMN IF NOT EXISTS visit_type text DEFAULT 'regular';
SELECT 'pm_visits visit_type added' AS status;
