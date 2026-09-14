-- RHU coordinators verify and mobilize donors; they do not issue or deduct
-- blood owned by a treating hospital. Replacement progress is separate from
-- the recipient's acknowledgement that blood was received.

begin;

alter table blood_bank.blood_request
  add column if not exists request_type varchar(30) not null default 'unsure',
  add column if not exists verification_status varchar(30) not null default 'pending',
  add column if not exists hospital_reference varchar(100),
  add column if not exists recipient_received_at timestamptz;

alter table blood_bank.blood_request
  drop constraint if exists chk_blood_request_type,
  add constraint chk_blood_request_type check (request_type in ('replacement', 'emergency_donor', 'unsure')),
  drop constraint if exists chk_blood_request_verification_status,
  add constraint chk_blood_request_verification_status check (verification_status in ('pending', 'verified', 'needs_clarification', 'rejected'));

update blood_bank.blood_request
set verification_status = case
  when lower(coalesce(status, '')) in ('approved', 'fulfilled', 'complete', 'completed', 'done') then 'verified'
  when lower(coalesce(status, '')) in ('rejected', 'declined', 'cancelled', 'canceled') then 'rejected'
  when lower(coalesce(status, '')) in ('needs_clarification', 'needs clarification') then 'needs_clarification'
  else verification_status
end;
create table if not exists blood_bank.replacement_campaign (
  campaign_id bigint generated always as identity primary key,
  request_id bigint not null unique references blood_bank.blood_request(request_id) on update cascade on delete cascade,
  target_units integer not null check (target_units > 0),
  pledged_units integer not null default 0 check (pledged_units >= 0),
  confirmed_units integer not null default 0 check (confirmed_units >= 0),
  status varchar(30) not null default 'pending_verification'
    check (status in ('pending_verification', 'active', 'pledged', 'complete', 'expired', 'cancelled')),
  confirmation_reference varchar(120),
  verified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_replacement_campaign_status on blood_bank.replacement_campaign(status, created_at desc);

create or replace function blood_bank.sync_replacement_campaign_from_request()
returns trigger language plpgsql security definer set search_path = blood_bank, public
as $$
begin
  if new.request_type = 'replacement' then
    insert into blood_bank.replacement_campaign(request_id, target_units, status, verified_at)
    values (new.request_id, greatest(new.quantity, 1),
      case when new.verification_status = 'verified' then 'active' else 'pending_verification' end,
      case when new.verification_status = 'verified' then now() else null end)
    on conflict (request_id) do update
      set target_units = greatest(excluded.target_units, replacement_campaign.confirmed_units),
          status = case
            when replacement_campaign.status = 'complete' then 'complete'
            when new.verification_status = 'verified' then
              case when replacement_campaign.pledged_units >= greatest(new.quantity, 1) then 'pledged' else 'active' end
            when new.verification_status = 'rejected' then 'cancelled'
            else 'pending_verification' end,
          verified_at = case when new.verification_status = 'verified'
            then coalesce(replacement_campaign.verified_at, now()) else replacement_campaign.verified_at end,
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_request_replacement_campaign on blood_bank.blood_request;
create trigger trg_request_replacement_campaign
after insert or update of request_type, quantity, verification_status on blood_bank.blood_request
for each row execute function blood_bank.sync_replacement_campaign_from_request();

create or replace function blood_bank.sync_request_coverage_from_pledge()
returns trigger language plpgsql security definer set search_path = blood_bank, public
as $$
declare target_request_id bigint; total_pledged integer;
begin
  target_request_id := case when tg_op = 'DELETE' then old.request_id else new.request_id end;
  select coalesce(sum(units_pledged), 0)::integer into total_pledged
  from blood_bank.donor_pledge where request_id = target_request_id and status = 'pledged';
  update blood_bank.replacement_campaign
  set pledged_units = total_pledged,
      status = case when status in ('complete', 'expired', 'cancelled') then status
        when total_pledged >= target_units then 'pledged'
        when status <> 'pending_verification' then 'active' else status end,
      updated_at = now()
  where request_id = target_request_id;
  perform blood_bank.refresh_one_request_coverage(target_request_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function blood_bank.complete_my_blood_request(p_request_id bigint)
returns jsonb language plpgsql security definer set search_path = blood_bank, public
as $$
declare request_row blood_bank.blood_request%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update blood_bank.blood_request br
  set recipient_received_at = coalesce(br.recipient_received_at, now()),
      community_status = case when br.request_type = 'replacement' then br.community_status else 'fulfilled' end,
      community_fulfilled_at = case when br.request_type = 'replacement'
        then br.community_fulfilled_at else coalesce(br.community_fulfilled_at, now()) end
  where br.request_id = p_request_id
    and br.patient_id in (select patient_id from blood_bank.patient where auth_user_id = auth.uid())
    and br.community_status in ('active', 'covered')
  returning br.* into request_row;
  if not found then raise exception 'Only the recipient can acknowledge an active request'; end if;
  return to_jsonb(request_row);
end;
$$;

create or replace function blood_bank.rhu_verify_request(p_request_id bigint, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = blood_bank, public
as $$
declare request_row blood_bank.blood_request%rowtype;
begin
  if not exists (select 1 from blood_bank.admin a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  then raise exception 'RHU coordinator access required'; end if;
  update blood_bank.blood_request
  set verification_status = 'verified', status = 'approved',
      hospital_reference = coalesce(nullif(trim(p_reference), ''), hospital_reference)
  where request_id = p_request_id returning * into request_row;
  if not found then raise exception 'Blood request not found'; end if;
  return to_jsonb(request_row);
end;
$$;

create or replace function blood_bank.rhu_complete_replacement(
  p_request_id bigint, p_confirmed_units integer, p_confirmation_reference text
)
returns jsonb language plpgsql security definer set search_path = blood_bank, public
as $$
declare campaign_row blood_bank.replacement_campaign%rowtype;
begin
  if not exists (select 1 from blood_bank.admin a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  then raise exception 'RHU coordinator access required'; end if;
  if p_confirmed_units <= 0 then raise exception 'Confirmed units must be greater than zero'; end if;
  if nullif(trim(p_confirmation_reference), '') is null then
    raise exception 'Hospital or authorized facility confirmation reference is required'; end if;
  select * into campaign_row from blood_bank.replacement_campaign where request_id = p_request_id for update;
  if not found then raise exception 'Replacement campaign not found'; end if;
  if p_confirmed_units < campaign_row.target_units then
    raise exception 'All target replacement units must be confirmed before completion'; end if;
  update blood_bank.replacement_campaign
  set confirmed_units = p_confirmed_units, status = 'complete',
      confirmation_reference = trim(p_confirmation_reference), completed_at = now(), updated_at = now()
  where request_id = p_request_id returning * into campaign_row;
  update blood_bank.blood_request
  set status = 'fulfilled', community_status = 'fulfilled', community_fulfilled_at = now()
  where request_id = p_request_id;
  return to_jsonb(campaign_row);
end;
$$;

alter table blood_bank.replacement_campaign enable row level security;
drop policy if exists replacement_campaign_read_authenticated on blood_bank.replacement_campaign;
create policy replacement_campaign_read_authenticated on blood_bank.replacement_campaign for select to authenticated using (true);
revoke all on function blood_bank.rhu_verify_request(bigint, text) from public;
revoke all on function blood_bank.rhu_complete_replacement(bigint, integer, text) from public;
grant execute on function blood_bank.rhu_verify_request(bigint, text) to authenticated;
grant execute on function blood_bank.rhu_complete_replacement(bigint, integer, text) to authenticated;
grant select on blood_bank.replacement_campaign to authenticated;

commit;