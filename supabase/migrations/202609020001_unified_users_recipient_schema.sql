-- VeinDrop: phase 1 unified users and Recipient migration.
-- Additive and data-preserving. Do not delete legacy tables in this migration.

begin;
set search_path to blood_bank, public;

-- Some installations started from the original schema without every earlier
-- additive migration. Normalize those legacy tables before reading from them.
alter table if exists blood_bank.patient add column if not exists middle_name varchar(100);
alter table if exists blood_bank.patient add column if not exists auth_user_id uuid;
alter table if exists blood_bank.patient add column if not exists email varchar(255);
alter table if exists blood_bank.donor add column if not exists middle_name varchar(100);
alter table if exists blood_bank.donor add column if not exists auth_user_id uuid;
alter table if exists blood_bank.donor add column if not exists gender varchar(30);
alter table if exists blood_bank.donor add column if not exists date_of_birth date;
alter table if exists blood_bank.donor add column if not exists donor_status varchar(30) not null default 'registered';
alter table if exists blood_bank.donor add column if not exists check_in_date timestamptz;
alter table if exists blood_bank.donor add column if not exists deferred_reason text;
alter table if exists blood_bank.donor add column if not exists show_on_map boolean not null default false;
alter table if exists blood_bank.donor add column if not exists location_status varchar(30) not null default 'needs_review';
alter table if exists blood_bank.donor add column if not exists map_area varchar(120);

create table if not exists blood_bank.users (
  user_id bigint generated always as identity primary key,
  auth_user_id uuid unique references auth.users(id) on update cascade on delete cascade,
  email varchar(255),
  first_name varchar(100) not null,
  middle_name varchar(100),
  last_name varchar(100) not null,
  contact_number varchar(50),
  address text,
  legacy_recipient_id bigint unique,
  legacy_donor_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_users_email_ci
  on blood_bank.users(lower(email))
  where email is not null and trim(email) <> '';

create table if not exists blood_bank.recipient_details (
  user_id bigint primary key references blood_bank.users(user_id) on update cascade on delete cascade,
  blood_type_needed varchar(5) not null,
  hospital_name varchar(255),
  created_at timestamptz not null default now()
);

create table if not exists blood_bank.donor_details (
  user_id bigint primary key references blood_bank.users(user_id) on update cascade on delete cascade,
  blood_type varchar(5) not null,
  gender varchar(30),
  date_of_birth date,
  availability_status varchar(50),
  donor_status varchar(30) not null default 'registered',
  last_donation_date date,
  check_in_date timestamptz,
  deferred_reason text,
  show_on_map boolean not null default false,
  location_status varchar(30) not null default 'needs_review',
  map_area varchar(120),
  created_at timestamptz not null default now()
);

-- First create accounts for donor rows. One matching auth identity or email
-- represents one person, so it can later hold both roles.
insert into blood_bank.users (
  auth_user_id, email, first_name, middle_name, last_name,
  contact_number, address, legacy_donor_id, created_at
)
select d.auth_user_id, nullif(trim(d.email), ''), d.first_name, d.middle_name,
       d.last_name, d.contact_number, d.address, d.donor_id, d.created_at
from blood_bank.donor d
where not exists (
  select 1 from blood_bank.users u where u.legacy_donor_id = d.donor_id
)
and not exists (
  select 1 from blood_bank.users u
  where (d.auth_user_id is not null and u.auth_user_id = d.auth_user_id)
     or (d.auth_user_id is null and nullif(trim(d.email), '') is not null
         and lower(u.email) = lower(trim(d.email)))
);

-- Recipient rows that match an existing user are linked; unmatched rows become
-- their own user account so no records are guessed or discarded.
insert into blood_bank.users (
  auth_user_id, email, first_name, middle_name, last_name,
  contact_number, address, legacy_recipient_id, created_at
)
select p.auth_user_id, nullif(trim(p.email), ''), p.first_name, p.middle_name,
       p.last_name, p.contact_number, p.address, p.patient_id, p.created_at
from blood_bank.patient p
where not exists (
  select 1 from blood_bank.users u where u.legacy_recipient_id = p.patient_id
)
and not exists (
  select 1 from blood_bank.users u
  where (p.auth_user_id is not null and u.auth_user_id = p.auth_user_id)
     or (p.auth_user_id is null and nullif(trim(p.email), '') is not null
         and lower(u.email) = lower(trim(p.email)))
);

update blood_bank.users u
set legacy_recipient_id = p.patient_id,
    email = coalesce(u.email, nullif(trim(p.email), '')),
    contact_number = coalesce(u.contact_number, p.contact_number),
    address = coalesce(u.address, p.address),
    updated_at = now()
from blood_bank.patient p
where u.legacy_recipient_id is null
  and (
    (p.auth_user_id is not null and u.auth_user_id = p.auth_user_id)
    or (p.auth_user_id is null and nullif(trim(p.email), '') is not null
        and lower(u.email) = lower(trim(p.email)))
  );

insert into blood_bank.recipient_details (
  user_id, blood_type_needed, hospital_name, created_at
)
select u.user_id, p.blood_type_needed, p.hospital_name, p.created_at
from blood_bank.patient p
join blood_bank.users u on u.legacy_recipient_id = p.patient_id
on conflict (user_id) do update
set blood_type_needed = excluded.blood_type_needed,
    hospital_name = excluded.hospital_name;

insert into blood_bank.donor_details (
  user_id, blood_type, gender, date_of_birth, availability_status, donor_status,
  last_donation_date, check_in_date, deferred_reason, show_on_map,
  location_status, map_area, created_at
)
select u.user_id, d.blood_type, d.gender, d.date_of_birth,
       d.availability_status, coalesce(d.donor_status, 'registered'),
       d.last_donation_date, d.check_in_date, d.deferred_reason,
       coalesce(d.show_on_map, false), coalesce(d.location_status, 'needs_review'),
       d.map_area, d.created_at
from blood_bank.donor d
join blood_bank.users u on u.legacy_donor_id = d.donor_id
on conflict (user_id) do update
set blood_type = excluded.blood_type,
    gender = excluded.gender,
    date_of_birth = excluded.date_of_birth,
    availability_status = excluded.availability_status,
    donor_status = excluded.donor_status,
    last_donation_date = excluded.last_donation_date,
    check_in_date = excluded.check_in_date,
    deferred_reason = excluded.deferred_reason,
    show_on_map = excluded.show_on_map,
    location_status = excluded.location_status,
    map_area = excluded.map_area;

-- New relationship columns coexist with old IDs during this phase.
alter table blood_bank.blood_request add column if not exists requester_user_id bigint;
alter table blood_bank.blood_inventory add column if not exists donor_user_id bigint;
alter table blood_bank.donation_record add column if not exists donor_user_id bigint;

update blood_bank.blood_request br
set requester_user_id = u.user_id
from blood_bank.users u
where br.requester_user_id is null
  and br.patient_id = u.legacy_recipient_id;

update blood_bank.blood_inventory bi
set donor_user_id = u.user_id
from blood_bank.users u
where bi.donor_user_id is null
  and bi.donor_id = u.legacy_donor_id;

update blood_bank.donation_record dr
set donor_user_id = u.user_id
from blood_bank.users u
where dr.donor_user_id is null
  and dr.donor_id = u.legacy_donor_id;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_blood_request_requester_user') then
    alter table blood_bank.blood_request add constraint fk_blood_request_requester_user
      foreign key (requester_user_id) references blood_bank.users(user_id)
      on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_blood_inventory_donor_user') then
    alter table blood_bank.blood_inventory add constraint fk_blood_inventory_donor_user
      foreign key (donor_user_id) references blood_bank.users(user_id)
      on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_donation_record_donor_user') then
    alter table blood_bank.donation_record add constraint fk_donation_record_donor_user
      foreign key (donor_user_id) references blood_bank.users(user_id)
      on update cascade on delete restrict;
  end if;
end;
$$;

create index if not exists idx_blood_request_requester_user on blood_bank.blood_request(requester_user_id);
create index if not exists idx_blood_inventory_donor_user on blood_bank.blood_inventory(donor_user_id);
create index if not exists idx_donation_record_donor_user on blood_bank.donation_record(donor_user_id);

create or replace function blood_bank.set_user_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on blood_bank.users;
create trigger trg_users_updated_at before update on blood_bank.users
for each row execute function blood_bank.set_user_updated_at();

create or replace function blood_bank.get_my_account_context()
returns jsonb language sql security definer
set search_path = blood_bank, public as $$
  select jsonb_build_object(
    'user', to_jsonb(u),
    'roles', array_to_json(array_remove(array[
      case when rd.user_id is not null then 'recipient' end,
      case when dd.user_id is not null then 'donor' end
    ], null))::jsonb,
    'recipient', to_jsonb(rd),
    'donor', to_jsonb(dd)
  )
  from blood_bank.users u
  left join blood_bank.recipient_details rd on rd.user_id = u.user_id
  left join blood_bank.donor_details dd on dd.user_id = u.user_id
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

alter table blood_bank.users enable row level security;
alter table blood_bank.recipient_details enable row level security;
alter table blood_bank.donor_details enable row level security;

drop policy if exists users_select_own on blood_bank.users;
create policy users_select_own on blood_bank.users
for select to authenticated using (auth_user_id = auth.uid());

revoke all on function blood_bank.get_my_account_context() from public;
grant execute on function blood_bank.get_my_account_context() to authenticated;

-- Before final retirement, all values below must be zero.
-- select count(*) filter (where requester_user_id is null) from blood_bank.blood_request;
-- select count(*) filter (where donor_user_id is null) from blood_bank.blood_inventory;
-- select count(*) filter (where donor_user_id is null) from blood_bank.donation_record;

commit;
notify pgrst, 'reload schema';
