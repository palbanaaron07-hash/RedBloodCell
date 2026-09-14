begin;

create or replace function blood_bank.require_verified_request_for_pledge()
returns trigger
language plpgsql
security definer
set search_path = blood_bank, public
as $$
begin
  if new.status = 'pledged' and not exists (
    select 1
    from blood_bank.blood_request br
    where br.request_id = new.request_id
      and br.verification_status = 'verified'
      and br.status = 'approved'
  ) then
    raise exception 'This request must be verified by an RHU coordinator before donors can respond';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_verified_request_for_pledge on blood_bank.donor_pledge;
create trigger trg_require_verified_request_for_pledge
before insert or update of status, request_id on blood_bank.donor_pledge
for each row execute function blood_bank.require_verified_request_for_pledge();

revoke all on function blood_bank.require_verified_request_for_pledge() from public;

commit;