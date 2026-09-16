-- Coordinator edit and delete blood drives support.

begin;
set search_path to blood_bank, public;

-- Grant admin update & delete policies on blood_drive
drop policy if exists blood_drives_admin_update on blood_bank.blood_drive;
create policy blood_drives_admin_update
  on blood_bank.blood_drive for update to authenticated
  using (
    exists (
      select 1 from blood_bank.admin a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1 from blood_bank.admin a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists blood_drives_admin_delete on blood_bank.blood_drive;
create policy blood_drives_admin_delete
  on blood_bank.blood_drive for delete to authenticated
  using (
    exists (
      select 1 from blood_bank.admin a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- RPC for updating blood drive with validation
create or replace function blood_bank.update_blood_drive(
  p_drive_id bigint,
  p_drive_name text,
  p_drive_date date,
  p_start_time time default null,
  p_end_time time default null,
  p_venue text default null,
  p_address text default null,
  p_target_units integer default 1,
  p_focus_type text default 'All',
  p_status text default 'scheduled',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  drive_row blood_bank.blood_drive%rowtype;
  normalized_focus text := upper(trim(coalesce(p_focus_type, 'ALL')));
  normalized_status text := lower(trim(coalesce(p_status, 'scheduled')));
begin
  if not exists (
    select 1 from blood_bank.admin a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then
    raise exception 'Blood donation coordinator access required';
  end if;

  select * into drive_row
  from blood_bank.blood_drive
  where drive_id = p_drive_id;

  if not found then
    raise exception 'Blood drive not found';
  end if;

  if nullif(trim(coalesce(p_drive_name, '')), '') is null then
    raise exception 'Drive name is required';
  end if;
  if nullif(trim(coalesce(p_venue, '')), '') is null then
    raise exception 'Venue is required';
  end if;
  if p_drive_date is null then
    raise exception 'Drive date is required';
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
  if normalized_status not in ('scheduled', 'recruiting', 'full', 'completed', 'cancelled') then
    raise exception 'Invalid blood drive status';
  end if;

  update blood_bank.blood_drive
  set
    drive_name = trim(p_drive_name),
    drive_date = p_drive_date,
    start_time = p_start_time,
    end_time = p_end_time,
    venue = trim(p_venue),
    address = nullif(trim(coalesce(p_address, '')), ''),
    target_units = p_target_units,
    focus_type = case when normalized_focus = 'ALL' then 'All' else normalized_focus end,
    status = normalized_status,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    updated_at = now()
  where drive_id = p_drive_id
  returning * into drive_row;

  return to_jsonb(drive_row);
end;
$$;

-- RPC for deleting blood drive
create or replace function blood_bank.delete_blood_drive(
  p_drive_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  deleted_count integer := 0;
begin
  if not exists (
    select 1 from blood_bank.admin a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then
    raise exception 'Blood donation coordinator access required';
  end if;

  delete from blood_bank.blood_drive
  where drive_id = p_drive_id;

  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'Blood drive not found or already deleted';
  end if;

  return jsonb_build_object('success', true, 'drive_id', p_drive_id);
end;
$$;

revoke all on function blood_bank.update_blood_drive(bigint, text, date, time, time, text, text, integer, text, text, text) from public;
grant execute on function blood_bank.update_blood_drive(bigint, text, date, time, time, text, text, integer, text, text, text) to authenticated;

revoke all on function blood_bank.delete_blood_drive(bigint) from public;
grant execute on function blood_bank.delete_blood_drive(bigint) to authenticated;

commit;
