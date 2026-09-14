begin;

create or replace function blood_bank.rhu_verify_request(p_request_id bigint, p_reference text default null)
returns jsonb language plpgsql security definer
set search_path = blood_bank, public
as $$
declare request_row blood_bank.blood_request%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from blood_bank.admin a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then raise exception 'RHU coordinator access required'; end if;

  select * into request_row from blood_bank.blood_request
  where request_id = p_request_id for update;
  if not found then raise exception 'Blood request not found'; end if;
  if request_row.community_status = 'expired' or request_row.expires_at <= now() then
    raise exception 'This request has expired. The recipient must submit a new request';
  end if;
  if request_row.status <> 'pending' or request_row.community_status not in ('active', 'covered') then
    raise exception 'Only pending, open requests can be verified';
  end if;

  update blood_bank.blood_request
  set verification_status = 'verified', status = 'approved',
      hospital_reference = coalesce(nullif(trim(p_reference), ''), hospital_reference)
  where request_id = p_request_id returning * into request_row;
  return to_jsonb(request_row);
end;
$$;

-- Also reject direct updates that bypass the verification RPC.
create or replace function blood_bank.guard_expired_request_verification()
returns trigger language plpgsql set search_path = blood_bank, public
as $$
begin
  if (old.community_status = 'expired' or old.expires_at <= now()
      or new.community_status = 'expired' or new.expires_at <= now())
    and ((new.verification_status = 'verified' and old.verification_status is distinct from 'verified')
      or (new.status = 'approved' and old.status is distinct from 'approved')) then
    raise exception 'This request has expired. The recipient must submit a new request';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_expired_request_verification on blood_bank.blood_request;
create trigger trg_guard_expired_request_verification
before update on blood_bank.blood_request
for each row execute function blood_bank.guard_expired_request_verification();

revoke all on function blood_bank.guard_expired_request_verification() from public;
revoke all on function blood_bank.rhu_verify_request(bigint, text) from public;
grant execute on function blood_bank.rhu_verify_request(bigint, text) to authenticated;
notify pgrst, 'reload schema';
commit;
