-- ============================================================
-- VeinDrop - Clear donor test data
-- Run this in the Supabase SQL Editor before testing with real donors.
--
-- Keeps:
--   - blood_bank.admin
--   - blood_bank.patient
--
-- Clears donor-linked data:
--   - blood_request rows that point to donor inventory
--   - blood request logs/notification queue for those requests
--   - donation records
--   - blood inventory
--   - donor lifecycle logs/check-ins
--   - donor rows
-- ============================================================

begin;

set search_path to blood_bank;

do $$
begin
  if to_regclass('blood_bank.blood_request_notification_queue') is not null then
    delete from blood_bank.blood_request_notification_queue q
    using blood_bank.blood_request r
    where q.request_id = r.request_id;
  end if;

  if to_regclass('blood_bank.blood_request_status_log') is not null then
    delete from blood_bank.blood_request_status_log l
    using blood_bank.blood_request r
    where l.request_id = r.request_id;
  end if;

  if to_regclass('blood_bank.blood_request') is not null then
    delete from blood_bank.blood_request;
  end if;

  if to_regclass('blood_bank.donation_record') is not null then
    delete from blood_bank.donation_record;
  end if;

  if to_regclass('blood_bank.blood_inventory') is not null then
    delete from blood_bank.blood_inventory;
  end if;

  if to_regclass('blood_bank.donor_status_log') is not null then
    delete from blood_bank.donor_status_log;
  end if;

  if to_regclass('blood_bank.donor_checkin') is not null then
    delete from blood_bank.donor_checkin;
  end if;

  delete from blood_bank.donor;
end $$;

alter sequence if exists blood_bank.donor_donor_id_seq restart with 1;
alter sequence if exists blood_bank.blood_inventory_inventory_id_seq restart with 1;
alter sequence if exists blood_bank.donation_record_donation_id_seq restart with 1;
alter sequence if exists blood_bank.blood_request_request_id_seq restart with 1;

commit;
