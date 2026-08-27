-- ============================================================
-- BloodConnect - Migration: Add note column to blood_request
-- Allows admin to store notes/clarification when changing request status
-- ============================================================

begin;

set search_path to blood_bank;

alter table blood_bank.blood_request
  add column if not exists note text;

commit;
