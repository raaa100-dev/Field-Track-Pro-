-- ════════════════════════════════════════════════════════
-- FieldAxisHQ CRM Module Schema
-- Run this in Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- Accounts (GCs, Owners, Property Managers)
CREATE TABLE IF NOT EXISTS crm_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  type              text DEFAULT 'gc', -- gc, owner, property_manager, other
  phone             text,
  email             text,
  website           text,
  city              text,
  state             text,
  zip               text,
  primary_contact   text,
  notes             text,
  next_followup     date,
  followup_note     text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Contacts per account
CREATE TABLE IF NOT EXISTS crm_contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid REFERENCES crm_accounts(id) ON DELETE CASCADE,
  name              text NOT NULL,
  title             text,
  phone             text,
  email             text,
  notes             text,
  last_contacted    date,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Buildings / Sites per account
CREATE TABLE IF NOT EXISTS crm_buildings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid REFERENCES crm_accounts(id) ON DELETE CASCADE,
  name              text NOT NULL,
  address           text,
  city              text,
  state             text,
  system_type       text, -- Addressable, Conventional, Hybrid, Wireless, Suppression
  panel_type        text, -- Notifier, Simplex, etc
  device_count      integer,
  sq_footage        integer,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

-- Service Agreements / Contracts
CREATE TABLE IF NOT EXISTS crm_agreements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid REFERENCES crm_accounts(id) ON DELETE CASCADE,
  name              text NOT NULL,
  agreement_type    text, -- inspection, monitoring, service, installation, other
  status            text DEFAULT 'active', -- active, pending, expired
  value             numeric(10,2),
  start_date        date,
  end_date          date,
  renewal_date      date,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

-- Activity Log (calls, emails, visits, notes)
CREATE TABLE IF NOT EXISTS crm_activities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid REFERENCES crm_accounts(id) ON DELETE CASCADE,
  activity_type     text DEFAULT 'note', -- call, email, meeting, visit, note, quote, other
  activity_date     date DEFAULT CURRENT_DATE,
  summary           text NOT NULL,
  notes             text,
  logged_by         text,
  created_at        timestamptz DEFAULT now()
);

-- Sales Pipeline / Leads
CREATE TABLE IF NOT EXISTS crm_pipeline (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid REFERENCES crm_accounts(id) ON DELETE SET NULL,
  title             text NOT NULL,
  stage             text DEFAULT 'new_lead', -- new_lead, contacted, qualified, quoted, negotiating, awarded, lost
  value             numeric(10,2),
  close_date        date,
  description       text,
  created_by        text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Inspections (annual, semi-annual, etc.)
CREATE TABLE IF NOT EXISTS crm_inspections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid REFERENCES crm_accounts(id) ON DELETE CASCADE,
  building_id       uuid REFERENCES crm_buildings(id) ON DELETE SET NULL,
  building_name     text, -- fallback if no building record
  inspection_type   text DEFAULT 'Annual',
  next_due          date NOT NULL,
  last_completed    date,
  status            text DEFAULT 'scheduled', -- scheduled, completed, overdue, cancelled
  notes             text,
  completion_notes  text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_contacts_account    ON crm_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_buildings_account   ON crm_buildings(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_agreements_account  ON crm_agreements(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_account  ON crm_activities(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_account    ON crm_pipeline(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_inspections_account ON crm_inspections(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_inspections_due     ON crm_inspections(next_due);

-- RLS Policies
ALTER TABLE crm_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_buildings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_agreements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_inspections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_accounts'   AND policyname='auth_crm_accounts')   THEN CREATE POLICY "auth_crm_accounts"   ON crm_accounts   FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_contacts'   AND policyname='auth_crm_contacts')   THEN CREATE POLICY "auth_crm_contacts"   ON crm_contacts   FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_buildings'  AND policyname='auth_crm_buildings')  THEN CREATE POLICY "auth_crm_buildings"  ON crm_buildings  FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_agreements' AND policyname='auth_crm_agreements') THEN CREATE POLICY "auth_crm_agreements" ON crm_agreements FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_activities' AND policyname='auth_crm_activities') THEN CREATE POLICY "auth_crm_activities" ON crm_activities FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_pipeline'   AND policyname='auth_crm_pipeline')   THEN CREATE POLICY "auth_crm_pipeline"   ON crm_pipeline   FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_inspections' AND policyname='auth_crm_inspections') THEN CREATE POLICY "auth_crm_inspections" ON crm_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
END $$;

SELECT 'CRM schema created successfully' AS status;
