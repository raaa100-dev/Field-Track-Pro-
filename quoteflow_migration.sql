-- ── QuoteFlow Schema ─────────────────────────────────────────────────────────

-- Company / branding settings (single row)
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  logo_data_url TEXT DEFAULT '',
  accent_color TEXT DEFAULT '#27500a',
  header_text TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO company_settings (id) VALUES ('main') ON CONFLICT DO NOTHING;

-- Email / integration settings (single row)
CREATE TABLE IF NOT EXISTS integration_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  resend_api_key TEXT DEFAULT '',
  resend_from_email TEXT DEFAULT '',
  resend_from_name TEXT DEFAULT '',
  award_page_public BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO integration_settings (id) VALUES ('main') ON CONFLICT DO NOTHING;

-- GC (General Contractors) contacts
CREATE TABLE IF NOT EXISTS gcs (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quote templates
CREATE TABLE IF NOT EXISTS quote_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trade TEXT DEFAULT '',
  description TEXT DEFAULT '',
  line_items JSONB DEFAULT '[]',
  tax_rate NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  expiry_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Scope blocks (reusable line-item groups)
CREATE TABLE IF NOT EXISTS scope_blocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trade TEXT DEFAULT '',
  line_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  project_name TEXT DEFAULT '',
  project_description TEXT DEFAULT '',
  project_address TEXT DEFAULT '',
  project_city TEXT DEFAULT '',
  project_state TEXT DEFAULT '',
  project_zip TEXT DEFAULT '',
  trade TEXT DEFAULT '',
  estimator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  job_id TEXT,                          -- optional link to existing job
  issue_date DATE,
  expiry_date DATE,
  bid_due_date DATE,
  line_items JSONB DEFAULT '[]',        -- [{id,description,qty,rate}]
  tax_rate NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  from_template_id TEXT REFERENCES quote_templates(id) ON DELETE SET NULL,
  revisions JSONB DEFAULT '[]',         -- snapshot array
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quote recipients (one quote → many GCs)
CREATE TABLE IF NOT EXISTS quote_recipients (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  gc_id TEXT REFERENCES gcs(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  company TEXT DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'draft',          -- draft|sent|viewed|awarded|declined
  token TEXT UNIQUE,                    -- one-time award URL token
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  awarded_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT DEFAULT '',
  signature_name TEXT DEFAULT '',
  signature_title TEXT DEFAULT '',
  signature_email TEXT DEFAULT '',
  signature_image TEXT DEFAULT '',      -- data URL
  signature_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
  job_id TEXT,                          -- link to Field Ops job
  client_name TEXT DEFAULT '',
  client_company TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  project_name TEXT DEFAULT '',
  project_address TEXT DEFAULT '',
  project_city TEXT DEFAULT '',
  project_state TEXT DEFAULT '',
  project_zip TEXT DEFAULT '',
  issue_date DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  line_items JSONB DEFAULT '[]',
  tax_rate NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',          -- draft|sent|paid|overdue
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotes_estimator ON quotes(estimator_id);
CREATE INDEX IF NOT EXISTS idx_quotes_job ON quotes(job_id);
CREATE INDEX IF NOT EXISTS idx_recipients_quote ON quote_recipients(quote_id);
CREATE INDEX IF NOT EXISTS idx_recipients_token ON quote_recipients(token);
CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);

-- Add estimator role to users if not already valid
-- (no schema change needed — role is a TEXT column, just start using 'estimator')

-- Add plan_type to job_plans if not exists (from previous session)
ALTER TABLE job_plans ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'plans';
ALTER TABLE catalog ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_value NUMERIC DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS labor_rate NUMERIC DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS labor_budget NUMERIC DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_budget NUMERIC DEFAULT 0;
