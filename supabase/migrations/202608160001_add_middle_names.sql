-- Add optional middle names without affecting existing patient or donor records.
begin;

alter table blood_bank.patient
  add column if not exists middle_name varchar(100);

alter table blood_bank.donor
  add column if not exists middle_name varchar(100);

commit;
