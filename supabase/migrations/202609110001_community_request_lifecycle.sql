-- Community request lifecycle is intentionally separate from the existing
-- admin/inventory status workflow. A donor pledge is not verified blood stock.

begin;

alter table blood_bank.blood_request
  add column if not exists community_status varchar(20) not null default 'active',
  add column if not exists expires_at timestamptz,
  add column if not exists community_fulfilled_at timestamptz;

update blood_bank.blood_request
set expires_at = coalesce(request_date, now()) + interval '72 hours'
where expires_at is null;

update blood_bank.blood_request
set community_status = case
  when lower(coalesce(status, '')) in ('fulfilled', 'complete', 'completed', 'done', 'closed') then 'fulfilled'
  when lower(coalesce(status, '')) in ('rejected', 'declined', 'cancelled', 'canceled', 'needs_clarification') then 'expired'
  when expires_at <= now() then 'expired'
  when community_status in ('active', 'covered', 'fulfilled', 'expired') then community_status
  else 'active'
end;

alter table blood_bank.blood_request
  alter column expires_at set default (now() + interval '72 hours'),
  alter column expires_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_blood_request_community_status'
      and conrelid = 'blood_bank.blood_request'::regclass
  ) then
    alter table blood_bank.blood_request
      add constraint chk_blood_request_community_status
      check (community_status in ('active', 'covered', 'fulfilled', 'expired'));
  end if;
end;
$$;

create or replace function blood_bank.sync_operational_fulfillment_to_community()
returns trigger
language plpgsql
set search_path = blood_bank, public
as $$
begin
  if lower(coalesce(new.status, '')) in ('fulfilled', 'complete', 'completed', 'done', 'closed') then
    new.community_status := 'fulfilled';
    new.community_fulfilled_at := coalesce(new.community_fulfilled_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blood_request_sync_community_fulfillment on blood_bank.blood_request;
create trigger trg_blood_request_sync_community_fulfillment
before insert or update of status on blood_bank.blood_request
for each row execute function blood_bank.sync_operational_fulfillment_to_community();

create index if not exists idx_blood_request_community_feed
  on blood_bank.blood_request(community_status, expires_at, request_date desc);

create table if not exists blood_bank.donor_pledge (
  pledge_id bigint generated always as identity primary key,
  request_id bigint not null references blood_bank.blood_request(request_id) on update cascade on delete cascade,
  donor_id bigint not null references blood_bank.donor(donor_id) on update cascade on delete restrict,
  units_pledged integer not null default 1 check (units_pledged > 0),
  status varchar(20) not null default 'pledged' check (status in ('pledged', 'cancelled')),
  pass_reference varchar(40),
  preferred_date date,
  preferred_time varchar(100),
  donor_phone varchar(50),
  notes text,
  pledged_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_donor_pledge_active
  on blood_bank.donor_pledge(request_id, donor_id)
  where status = 'pledged';

create index if not exists idx_donor_pledge_request_status
  on blood_bank.donor_pledge(request_id, status);

create or replace function blood_bank.refresh_one_request_coverage(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  request_row blood_bank.blood_request%rowtype;
  pledged_units integer;
begin
  select * into request_row
  from blood_bank.blood_request
  where request_id = p_request_id
  for update;

  if not found or request_row.community_status in ('fulfilled', 'expired') then
    return;
  end if;

  if request_row.expires_at <= now() then
    update blood_bank.blood_request
    set community_status = 'expired'
    where request_id = p_request_id;
    return;
  end if;

  select coalesce(sum(units_pledged), 0)::integer into pledged_units
  from blood_bank.donor_pledge
  where request_id = p_request_id and status = 'pledged';

  update blood_bank.blood_request
  set community_status = case
    when pledged_units >= greatest(quantity, 1) then 'covered'
    else 'active'
  end
  where request_id = p_request_id;
end;
$$;

create or replace function blood_bank.sync_request_coverage_from_pledge()
returns trigger
language plpgsql
security definer
set search_path = blood_bank, public
as $$
begin
  if tg_op = 'DELETE' then
    perform blood_bank.refresh_one_request_coverage(old.request_id);
    return old;
  end if;

  perform blood_bank.refresh_one_request_coverage(new.request_id);
  return new;
end;
$$;

drop trigger if exists trg_donor_pledge_request_coverage on blood_bank.donor_pledge;
create trigger trg_donor_pledge_request_coverage
after insert or update or delete on blood_bank.donor_pledge
for each row execute function blood_bank.sync_request_coverage_from_pledge();

create or replace function blood_bank.refresh_community_request_lifecycle()
returns integer
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  affected integer;
begin
  update blood_bank.blood_request
  set community_status = 'expired'
  where community_status in ('active', 'covered')
    and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function blood_bank.pledge_to_blood_request(
  p_request_id bigint,
  p_units integer default 1,
  p_pass_reference text default null,
  p_preferred_date date default null,
  p_preferred_time text default null,
  p_donor_phone text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  donor_row blood_bank.donor%rowtype;
  request_row blood_bank.blood_request%rowtype;
  pledge_row blood_bank.donor_pledge%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into donor_row
  from blood_bank.donor
  where auth_user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'A donor profile is required before responding';
  end if;

  perform blood_bank.refresh_community_request_lifecycle();

  select * into request_row
  from blood_bank.blood_request
  where request_id = p_request_id
  for update;

  if not found then
    raise exception 'Blood request not found';
  end if;
  if request_row.community_status <> 'active' then
    raise exception 'This request is no longer accepting donor responses';
  end if;
  if request_row.patient_id in (
    select patient_id from blood_bank.patient where auth_user_id = auth.uid()
  ) then
    raise exception 'You cannot pledge to your own blood request';
  end if;

  select * into pledge_row
  from blood_bank.donor_pledge
  where request_id = p_request_id
    and donor_id = donor_row.donor_id
    and status = 'pledged'
  limit 1;

  if found then
    return to_jsonb(pledge_row);
  end if;

  insert into blood_bank.donor_pledge (
    request_id, donor_id, units_pledged, pass_reference, preferred_date,
    preferred_time, donor_phone, notes
  ) values (
    p_request_id, donor_row.donor_id, 1,
    nullif(trim(p_pass_reference), ''), p_preferred_date,
    nullif(trim(p_preferred_time), ''), nullif(trim(p_donor_phone), ''),
    nullif(trim(p_notes), '')
  )
  returning * into pledge_row;

  return to_jsonb(pledge_row);
end;
$$;

create or replace function blood_bank.complete_my_blood_request(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  request_row blood_bank.blood_request%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update blood_bank.blood_request br
  set community_status = 'fulfilled',
      community_fulfilled_at = now()
  where br.request_id = p_request_id
    and br.community_status in ('active', 'covered')
    and exists (
      select 1 from blood_bank.patient p
      where p.patient_id = br.patient_id
        and p.auth_user_id = auth.uid()
    )
  returning br.* into request_row;

  if not found then
    raise exception 'Only the recipient can complete an active request';
  end if;

  return to_jsonb(request_row);
end;
$$;

alter table blood_bank.donor_pledge enable row level security;

drop policy if exists donor_pledge_select_participants on blood_bank.donor_pledge;
create policy donor_pledge_select_participants
  on blood_bank.donor_pledge
  for select to authenticated
  using (
    exists (select 1 from blood_bank.donor d where d.donor_id = donor_pledge.donor_id and d.auth_user_id = auth.uid())
    or exists (
      select 1
      from blood_bank.blood_request br
      join blood_bank.patient p on p.patient_id = br.patient_id
      where br.request_id = donor_pledge.request_id and p.auth_user_id = auth.uid()
    )
    or exists (
      select 1 from blood_bank.admin a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

revoke all on function blood_bank.sync_operational_fulfillment_to_community() from public;
revoke all on function blood_bank.refresh_one_request_coverage(bigint) from public;
revoke all on function blood_bank.sync_request_coverage_from_pledge() from public;
revoke all on function blood_bank.refresh_community_request_lifecycle() from public;
revoke all on function blood_bank.pledge_to_blood_request(bigint, integer, text, date, text, text, text) from public;
revoke all on function blood_bank.complete_my_blood_request(bigint) from public;
grant execute on function blood_bank.refresh_community_request_lifecycle() to authenticated;
grant execute on function blood_bank.pledge_to_blood_request(bigint, integer, text, date, text, text, text) to authenticated;
grant execute on function blood_bank.complete_my_blood_request(bigint) to authenticated;

commit;
notify pgrst, 'reload schema';