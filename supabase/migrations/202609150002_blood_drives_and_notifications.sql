-- Database-backed blood-drive scheduling, donor registration, and in-app alerts.

begin;
set search_path to blood_bank, public;

create table if not exists blood_bank.blood_drive (
  drive_id bigint generated always as identity primary key,
  drive_name varchar(160) not null,
  drive_date date not null,
  start_time time,
  end_time time,
  venue varchar(220) not null,
  address text,
  target_units integer not null check (target_units > 0),
  registered_donors integer not null default 0 check (registered_donors >= 0),
  focus_type varchar(5) not null default 'All',
  status varchar(24) not null default 'scheduled'
    check (status in ('scheduled', 'recruiting', 'full', 'completed', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);

create table if not exists blood_bank.blood_drive_registration (
  registration_id bigint generated always as identity primary key,
  drive_id bigint not null references blood_bank.blood_drive(drive_id) on update cascade on delete cascade,
  donor_id bigint not null references blood_bank.donor(donor_id) on update cascade on delete cascade,
  registered_at timestamptz not null default now(),
  status varchar(20) not null default 'registered'
    check (status in ('registered', 'attended', 'cancelled')),
  unique (drive_id, donor_id)
);

alter table blood_bank.notifications
  add column if not exists drive_id bigint references blood_bank.blood_drive(drive_id) on update cascade on delete cascade;

create unique index if not exists uq_drive_notification_per_recipient
  on blood_bank.notifications(recipient_user_id, drive_id, notification_type)
  where drive_id is not null and notification_type = 'blood_drive_scheduled';

create index if not exists idx_blood_drive_date_status
  on blood_bank.blood_drive(drive_date, status);
create index if not exists idx_drive_registration_donor
  on blood_bank.blood_drive_registration(donor_id, registered_at desc);

alter table blood_bank.blood_drive enable row level security;
alter table blood_bank.blood_drive_registration enable row level security;

drop policy if exists blood_drives_authenticated_read on blood_bank.blood_drive;
create policy blood_drives_authenticated_read
  on blood_bank.blood_drive for select to authenticated using (true);

drop policy if exists drive_registrations_read_own_or_admin on blood_bank.blood_drive_registration;
create policy drive_registrations_read_own_or_admin
  on blood_bank.blood_drive_registration for select to authenticated
  using (
    exists (
      select 1 from blood_bank.donor d
      where d.donor_id = blood_drive_registration.donor_id
        and d.auth_user_id = auth.uid()
    )
    or exists (
      select 1 from blood_bank.admin a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create or replace function blood_bank.schedule_blood_drive(
  p_drive_name text,
  p_drive_date date,
  p_start_time time default null,
  p_end_time time default null,
  p_venue text default null,
  p_address text default null,
  p_target_units integer default 1,
  p_focus_type text default 'All',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  drive_row blood_bank.blood_drive%rowtype;
  notified_count integer := 0;
  normalized_focus text := upper(trim(coalesce(p_focus_type, 'ALL')));
begin
  if not exists (
    select 1 from blood_bank.admin a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then
    raise exception 'Blood donation coordinator access required';
  end if;

  if nullif(trim(coalesce(p_drive_name, '')), '') is null then
    raise exception 'Drive name is required';
  end if;
  if nullif(trim(coalesce(p_venue, '')), '') is null then
    raise exception 'Venue is required';
  end if;
  if p_drive_date is null or p_drive_date < current_date then
    raise exception 'Drive date cannot be in the past';
  end if;
  if p_target_units is null or p_target_units < 1 or p_target_units > 10000 then
    raise exception 'Target units must be between 1 and 10000';
  end if;
  if p_start_time is not null and p_end_time is not null and p_end_time <= p_start_time then
    raise exception 'End time must be later than start time';
  end if;
  if normalized_focus <> 'ALL' and normalized_focus not in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') then
    raise exception 'Invalid focus blood type';
  end if;

  insert into blood_bank.blood_drive (
    drive_name, drive_date, start_time, end_time, venue, address,
    target_units, focus_type, status, notes, created_by
  ) values (
    trim(p_drive_name), p_drive_date, p_start_time, p_end_time, trim(p_venue),
    nullif(trim(coalesce(p_address, '')), ''), p_target_units,
    case when normalized_focus = 'ALL' then 'All' else normalized_focus end,
    'scheduled', nullif(trim(coalesce(p_notes, '')), ''), auth.uid()
  ) returning * into drive_row;

  insert into blood_bank.notifications (
    recipient_user_id, drive_id, notification_type, title, message
  )
  select distinct
    d.auth_user_id,
    drive_row.drive_id,
    'blood_drive_scheduled',
    'New blood drive scheduled',
    drive_row.drive_name || ' will be held on ' ||
      to_char(drive_row.drive_date, 'Mon FMDD, YYYY') || ' at ' || drive_row.venue ||
      '. Open Blood Drives to view the campaign details.'
  from blood_bank.donor d
  where d.auth_user_id is not null
    and lower(coalesce(d.donor_status, 'registered')) in ('registered', 'approved', 'donated')
  on conflict do nothing;

  get diagnostics notified_count = row_count;

  return jsonb_build_object(
    'drive', to_jsonb(drive_row),
    'notified_count', notified_count
  );
end;
$$;

create or replace function blood_bank.register_for_blood_drive(p_drive_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  drive_row blood_bank.blood_drive%rowtype;
  donor_row blood_bank.donor%rowtype;
  registration_row blood_bank.blood_drive_registration%rowtype;
begin
  select * into donor_row
  from blood_bank.donor
  where auth_user_id = auth.uid();

  if not found then raise exception 'A donor profile is required to register'; end if;
  if lower(coalesce(donor_row.donor_status, 'registered')) not in ('registered', 'approved', 'donated') then
    raise exception 'Your donor profile is not currently eligible to register';
  end if;

  select * into drive_row
  from blood_bank.blood_drive
  where drive_id = p_drive_id
  for update;

  if not found then raise exception 'Blood drive not found'; end if;
  if drive_row.drive_date < current_date or drive_row.status in ('completed', 'cancelled') then
    raise exception 'This blood drive is no longer accepting registrations';
  end if;
  if drive_row.registered_donors >= drive_row.target_units or drive_row.status = 'full' then
    raise exception 'This blood drive is already full';
  end if;

  insert into blood_bank.blood_drive_registration (drive_id, donor_id)
  values (drive_row.drive_id, donor_row.donor_id)
  on conflict (drive_id, donor_id) do update
    set status = 'registered', registered_at = now()
    where blood_drive_registration.status = 'cancelled'
  returning * into registration_row;

  if not found then
    return jsonb_build_object('already_registered', true, 'drive_id', drive_row.drive_id);
  end if;

  update blood_bank.blood_drive
  set registered_donors = (
        select count(*) from blood_bank.blood_drive_registration r
        where r.drive_id = drive_row.drive_id and r.status = 'registered'
      ),
      status = case
        when (select count(*) from blood_bank.blood_drive_registration r
              where r.drive_id = drive_row.drive_id and r.status = 'registered') >= target_units
          then 'full'
        else 'recruiting'
      end,
      updated_at = now()
  where drive_id = drive_row.drive_id;

  return jsonb_build_object('already_registered', false, 'drive_id', drive_row.drive_id);
end;
$$;

revoke all on function blood_bank.schedule_blood_drive(text, date, time, time, text, text, integer, text, text) from public;
grant execute on function blood_bank.schedule_blood_drive(text, date, time, time, text, text, integer, text, text) to authenticated;
revoke all on function blood_bank.register_for_blood_drive(bigint) from public;
grant execute on function blood_bank.register_for_blood_drive(bigint) to authenticated;

grant select on blood_bank.blood_drive to authenticated;
grant select on blood_bank.blood_drive_registration to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'blood_bank'
      and tablename = 'blood_drive'
  ) then
    alter publication supabase_realtime add table blood_bank.blood_drive;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
