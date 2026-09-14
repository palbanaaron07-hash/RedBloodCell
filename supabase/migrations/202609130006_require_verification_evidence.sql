begin;

create or replace function blood_bank.require_request_verification_evidence()
returns trigger
language plpgsql
security definer
set search_path = blood_bank, public
as $$
begin
  if (
    (new.verification_status = 'verified' and old.verification_status is distinct from 'verified')
    or (new.status = 'approved' and old.status is distinct from 'approved')
  ) and not exists (
    select 1 from blood_bank.request_verification_support support
    where support.request_id = new.request_id
      and support.verification_method in (
        'uploaded_document', 'physical_document', 'facility_confirmation', 'other'
      )
      and support.verified_at is not null
  ) then
    raise exception 'Verification evidence must be recorded before this request can be published';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_request_verification_evidence on blood_bank.blood_request;
create trigger trg_require_request_verification_evidence
before update of status, verification_status on blood_bank.blood_request
for each row execute function blood_bank.require_request_verification_evidence();

revoke all on function blood_bank.require_request_verification_evidence() from public;

notify pgrst, 'reload schema';
commit;
