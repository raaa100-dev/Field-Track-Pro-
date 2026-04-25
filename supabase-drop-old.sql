-- ================================================================
-- FieldAxisHQ — Drop old tables before fresh schema install
-- Run this FIRST, then run supabase-schema.sql
-- WARNING: This deletes all existing data in these tables
-- ================================================================

drop table if exists lien_waivers        cascade;
drop table if exists invoices            cascade;
drop table if exists audit_log           cascade;
drop table if exists notifications       cascade;
drop table if exists orders              cascade;
drop table if exists part_requests       cascade;
drop table if exists gc_alerts           cascade;
drop table if exists daily_logs          cascade;
drop table if exists change_orders       cascade;
drop table if exists pm_inspections      cascade;
drop table if exists job_checklist_items cascade;
drop table if exists job_plans           cascade;
drop table if exists job_photos          cascade;
drop table if exists job_manifest        cascade;
drop table if exists job_parts           cascade;
drop table if exists inventory           cascade;
drop table if exists catalog             cascade;
drop table if exists job_attendance      cascade;
drop table if exists checkins            cascade;
drop table if exists job_workers         cascade;
drop table if exists jobs                cascade;
drop table if exists profiles            cascade;
drop table if exists companies           cascade;

-- Drop old functions/triggers too
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user()  cascade;
drop function if exists get_my_role()      cascade;
drop function if exists is_staff()         cascade;
drop function if exists is_assigned_to_job(uuid) cascade;

select 'All old tables dropped. Now run supabase-schema.sql' as status;
