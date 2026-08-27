begin;

alter table if exists blood_bank.donor
  add column if not exists gender varchar(20),
  add column if not exists date_of_birth date;

commit;
