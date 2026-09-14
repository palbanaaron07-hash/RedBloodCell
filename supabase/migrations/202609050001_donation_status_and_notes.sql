-- Migration: Add status, notes, and reason to donation_record and update get_my_donation_history RPC
-- Date: 2026-09-05

begin;

alter table if exists blood_bank.donation_record add column if not exists status varchar(30) not null default 'completed';
alter table if exists blood_bank.donation_record add column if not exists notes text;
alter table if exists blood_bank.donation_record add column if not exists reason text;

-- Create index on donation_record status
create index if not exists idx_donation_record_status on blood_bank.donation_record(status);

-- Update get_my_donation_history to return status and notes
-- PostgreSQL cannot replace a function when its OUT-column shape changes.
drop function if exists blood_bank.get_my_donation_history();
create or replace function blood_bank.get_my_donation_history()
returns table (
  donation_id bigint,
  blood_type varchar,
  quantity int,
  donation_date date,
  status varchar,
  notes text
)
language sql
security definer
set search_path = blood_bank, public
as $$
  select dr.donation_id,
         dr.blood_type,
         dr.quantity,
         dr.donation_date,
         coalesce(dr.status, 'completed')::varchar as status,
         coalesce(dr.notes, dr.reason, '')::text as notes
  from blood_bank.donation_record dr
  join blood_bank.donor d on d.donor_id = dr.donor_id
  where d.auth_user_id = auth.uid()
  order by dr.donation_date desc, dr.donation_id desc;
$$;

revoke all on function blood_bank.get_my_donation_history() from public;
grant execute on function blood_bank.get_my_donation_history() to authenticated;

commit;

notify pgrst, 'reload schema';
