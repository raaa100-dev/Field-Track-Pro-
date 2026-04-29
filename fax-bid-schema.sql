-- ================================================================
-- FieldAxisHQ — Bid Engine Schema
-- Run in Supabase SQL Editor AFTER the existing schema
-- ================================================================

-- GC contacts
CREATE TABLE IF NOT EXISTS gcs (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company     text NOT NULL DEFAULT '',
  name        text NOT NULL DEFAULT '',
  email       text NOT NULL DEFAULT '',
  phone       text DEFAULT '',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- Bid templates
CREATE TABLE IF NOT EXISTS fax_bid_templates (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        text NOT NULL,
  trade       text DEFAULT '',
  description text DEFAULT '',
  line_items  jsonb DEFAULT '[]',
  tax_rate    numeric DEFAULT 0,
  notes       text DEFAULT '',
  terms       text DEFAULT '',
  expiry_days integer DEFAULT 30,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Scope blocks
CREATE TABLE IF NOT EXISTS fax_bid_scope_blocks (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        text NOT NULL,
  trade       text DEFAULT '',
  line_items  jsonb DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Bids (quotes)
CREATE TABLE IF NOT EXISTS fax_bids (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number              text NOT NULL,
  version             integer DEFAULT 1,
  project_name        text DEFAULT '',
  project_description text DEFAULT '',
  project_address     text DEFAULT '',
  project_city        text DEFAULT '',
  project_state       text DEFAULT '',
  project_zip         text DEFAULT '',
  trade               text DEFAULT '',
  estimator_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  job_id              uuid REFERENCES jobs(id) ON DELETE SET NULL,
  issue_date          date,
  expiry_date         date,
  bid_due_date        date,
  line_items          jsonb DEFAULT '[]',
  tax_rate            numeric DEFAULT 0,
  subtotal            numeric DEFAULT 0,
  tax                 numeric DEFAULT 0,
  total               numeric DEFAULT 0,
  notes               text DEFAULT '',
  terms               text DEFAULT '',
  from_template_id    text REFERENCES fax_bid_templates(id) ON DELETE SET NULL,
  revisions           jsonb DEFAULT '[]',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Bid recipients
CREATE TABLE IF NOT EXISTS fax_bid_recipients (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  quote_id            text NOT NULL REFERENCES fax_bids(id) ON DELETE CASCADE,
  gc_id               text REFERENCES gcs(id) ON DELETE SET NULL,
  name                text DEFAULT '',
  company             text DEFAULT '',
  email               text NOT NULL DEFAULT '',
  status              text DEFAULT 'draft',
  token               text UNIQUE,
  sent_at             timestamptz,
  viewed_at           timestamptz,
  awarded_at          timestamptz,
  declined_at         timestamptz,
  decline_reason      text DEFAULT '',
  signature_name      text DEFAULT '',
  signature_title     text DEFAULT '',
  signature_email     text DEFAULT '',
  signature_image     text DEFAULT '',
  signature_timestamp timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS fax_bid_invoices (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number          text NOT NULL,
  quote_id        text REFERENCES fax_bids(id) ON DELETE SET NULL,
  job_id          uuid REFERENCES jobs(id) ON DELETE SET NULL,
  client_name     text DEFAULT '',
  client_company  text DEFAULT '',
  client_email    text DEFAULT '',
  project_name    text DEFAULT '',
  project_address text DEFAULT '',
  project_city    text DEFAULT '',
  project_state   text DEFAULT '',
  project_zip     text DEFAULT '',
  issue_date      date,
  due_date        date,
  paid_at         timestamptz,
  line_items      jsonb DEFAULT '[]',
  tax_rate        numeric DEFAULT 0,
  subtotal        numeric DEFAULT 0,
  tax             numeric DEFAULT 0,
  total           numeric DEFAULT 0,
  notes           text DEFAULT '',
  terms           text DEFAULT '',
  status          text DEFAULT 'draft',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Branding (single row)
CREATE TABLE IF NOT EXISTS fax_bid_branding (
  id              text PRIMARY KEY DEFAULT 'main',
  company_name    text DEFAULT '',
  tagline         text DEFAULT '',
  address         text DEFAULT '',
  phone           text DEFAULT '',
  email           text DEFAULT '',
  logo_data_url   text DEFAULT '',
  accent_color    text DEFAULT '#2563eb',
  updated_at      timestamptz DEFAULT now()
);
INSERT INTO fax_bid_branding (id) VALUES ('main') ON CONFLICT DO NOTHING;

-- Email config (single row)
CREATE TABLE IF NOT EXISTS fax_bid_email_config (
  id              text PRIMARY KEY DEFAULT 'main',
  resend_api_key  text DEFAULT '',
  from_email      text DEFAULT '',
  from_name       text DEFAULT '',
  updated_at      timestamptz DEFAULT now()
);
INSERT INTO fax_bid_email_config (id) VALUES ('main') ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fax_bids_estimator        ON fax_bids(estimator_id);
CREATE INDEX IF NOT EXISTS idx_fax_bids_job              ON fax_bids(job_id);
CREATE INDEX IF NOT EXISTS idx_fax_bid_recipients_quote  ON fax_bid_recipients(quote_id);
CREATE INDEX IF NOT EXISTS idx_fax_bid_recipients_token  ON fax_bid_recipients(token);
CREATE INDEX IF NOT EXISTS idx_fax_bid_invoices_quote    ON fax_bid_invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_fax_bid_invoices_job      ON fax_bid_invoices(job_id);

-- RLS
ALTER TABLE gcs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE fax_bid_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fax_bid_scope_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fax_bids           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fax_bid_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fax_bid_invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fax_bid_branding   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fax_bid_email_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gcs_all"        ON gcs;
DROP POLICY IF EXISTS "fax_bt_all"     ON fax_bid_templates;
DROP POLICY IF EXISTS "fax_bsb_all"    ON fax_bid_scope_blocks;
DROP POLICY IF EXISTS "fax_bids_all"   ON fax_bids;
DROP POLICY IF EXISTS "fax_br_all"     ON fax_bid_recipients;
DROP POLICY IF EXISTS "fax_bi_all"     ON fax_bid_invoices;
DROP POLICY IF EXISTS "fax_bb_all"     ON fax_bid_branding;
DROP POLICY IF EXISTS "fax_be_all"     ON fax_bid_email_config;

CREATE POLICY "gcs_all"        ON gcs                 FOR ALL USING (auth.role()='authenticated');
CREATE POLICY "fax_bt_all"     ON fax_bid_templates   FOR ALL USING (auth.role()='authenticated');
CREATE POLICY "fax_bsb_all"    ON fax_bid_scope_blocks FOR ALL USING (auth.role()='authenticated');
CREATE POLICY "fax_bids_all"   ON fax_bids            FOR ALL USING (auth.role()='authenticated');
CREATE POLICY "fax_br_all"     ON fax_bid_recipients  FOR ALL USING (auth.role()='authenticated');
CREATE POLICY "fax_bi_all"     ON fax_bid_invoices    FOR ALL USING (auth.role()='authenticated');
CREATE POLICY "fax_bb_all"     ON fax_bid_branding    FOR ALL USING (auth.role()='authenticated');
CREATE POLICY "fax_be_all"     ON fax_bid_email_config FOR ALL USING (auth.role()='authenticated');

SELECT 'FieldAxisHQ Bid Engine schema complete' AS status;

-- ── PDF Quote additions (run after initial schema) ──────────────────────────
ALTER TABLE fax_bids ADD COLUMN IF NOT EXISTS pdf_url       text DEFAULT NULL;
ALTER TABLE fax_bids ADD COLUMN IF NOT EXISTS pdf_filename  text DEFAULT NULL;
ALTER TABLE fax_bids ADD COLUMN IF NOT EXISTS quote_type    text DEFAULT 'standard';

SELECT 'PDF Quote columns added' AS status;
