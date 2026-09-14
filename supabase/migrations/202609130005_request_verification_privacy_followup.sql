begin;

alter table blood_bank.request_verification_support
  add column if not exists verification_method varchar(40),
  add column if not exists verification_note text,
  add column if not exists verified_by uuid,
  add column if not exists verified_by_email varchar(255),
  add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'request_verification_support_method_check'
      and conrelid = 'blood_bank.request_verification_support'::regclass
  ) then
    alter table blood_bank.request_verification_support
      add constraint request_verification_support_method_check check (
        verification_method is null or verification_method in (
          'uploaded_document', 'physical_document', 'facility_confirmation', 'other'
        )
      );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'blood_bank' and table_name = 'blood_request'
      and column_name = 'verification_method'
  ) then
    execute $migration$
      insert into blood_bank.request_verification_support (
        request_id, verification_method, verification_note, verified_by,
        verified_by_email, verified_at, created_by
      )
      select br.request_id, br.verification_method, br.verification_note, br.verified_by,
        null, br.verified_at,
        coalesce(br.verified_by, '00000000-0000-0000-0000-000000000000'::uuid)
      from blood_bank.blood_request br
      where br.verification_method is not null
      on conflict (request_id) do update set
        verification_method = excluded.verification_method,
        verification_note = excluded.verification_note,
        verified_by = excluded.verified_by,
        verified_at = excluded.verified_at,
        updated_at = now()
    $migration$;
  end if;
end $$;

drop policy if exists request_verification_support_insert_owner on blood_bank.request_verification_support;
create policy request_verification_support_insert_owner
  on blood_bank.request_verification_support
  for insert to authenticated
  with check (
    (
      created_by = auth.uid()
      and (storage_path is null or split_part(storage_path, '/', 1) = auth.uid()::text)
      and exists (
        select 1 from blood_bank.blood_request br
        join blood_bank.patient p on p.patient_id = br.patient_id
        where br.request_id = request_verification_support.request_id
          and p.auth_user_id = auth.uid()
          and br.status = 'pending'
          and coalesce(br.verification_status, 'pending') = 'pending'
      )
    )
    or exists (
      select 1 from blood_bank.admin a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists request_verification_support_update_coordinator on blood_bank.request_verification_support;
create policy request_verification_support_update_coordinator
  on blood_bank.request_verification_support
  for update to authenticated
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

grant select, insert, update, delete on blood_bank.request_verification_support to authenticated;

drop policy if exists request_supporting_documents_insert_owner on storage.objects;
create policy request_supporting_documents_insert_owner
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-supporting-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] ~ '^[0-9]+$'
    and exists (
      select 1 from blood_bank.blood_request br
      join blood_bank.patient p on p.patient_id = br.patient_id
      where br.request_id = ((storage.foldername(name))[2])::bigint
        and p.auth_user_id = auth.uid()
        and br.status = 'pending'
        and coalesce(br.verification_status, 'pending') = 'pending'
    )
  );

create or replace function blood_bank.verify_blood_request(
  p_request_id bigint,
  p_method text,
  p_note text default null,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  request_row blood_bank.blood_request%rowtype;
  support_row blood_bank.request_verification_support%rowtype;
  normalized_method text := lower(trim(coalesce(p_method, '')));
begin
  if auth.uid() is null or not exists (
    select 1 from blood_bank.admin a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then
    raise exception 'Blood donation coordinator access required';
  end if;
  if normalized_method not in ('uploaded_document', 'physical_document', 'facility_confirmation', 'other') then
    raise exception 'Select a valid verification basis';
  end if;

  select * into request_row from blood_bank.blood_request
  where request_id = p_request_id for update;
  if not found then raise exception 'Blood request not found'; end if;
  if request_row.community_status = 'expired' or request_row.expires_at <= now() then
    raise exception 'This request has expired. The recipient must submit a new request';
  end if;
  if request_row.status <> 'pending' or request_row.community_status not in ('active', 'covered') then
    raise exception 'Only pending, open requests can be verified';
  end if;

  select * into support_row from blood_bank.request_verification_support
  where request_id = p_request_id;
  if normalized_method = 'uploaded_document' and nullif(support_row.storage_path, '') is null then
    raise exception 'This request has no uploaded supporting document';
  end if;
  if normalized_method = 'facility_confirmation'
    and nullif(trim(concat_ws(' ', request_row.hospital_reference, p_reference, support_row.facility_contact, p_note)), '') is null then
    raise exception 'Enter a facility contact, confirmation reference, or verification note';
  end if;
  if normalized_method = 'other' and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Explain the other documented verification basis';
  end if;

  insert into blood_bank.request_verification_support (
    request_id, verification_method, verification_note, verified_by, verified_by_email, verified_at, created_by
  ) values (
    p_request_id, normalized_method, nullif(trim(p_note), ''), auth.uid(),
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''), now(), auth.uid()
  )
  on conflict (request_id) do update set
    verification_method = excluded.verification_method,
    verification_note = excluded.verification_note,
    verified_by = excluded.verified_by,
    verified_by_email = excluded.verified_by_email,
    verified_at = excluded.verified_at,
    updated_at = now();

  update blood_bank.blood_request
  set verification_status = 'verified', status = 'approved',
      hospital_reference = coalesce(nullif(trim(p_reference), ''), hospital_reference)
  where request_id = p_request_id
  returning * into request_row;

  return to_jsonb(request_row);
end;
$$;

alter table blood_bank.blood_request
  drop constraint if exists blood_request_verification_method_check,
  drop column if exists verification_method,
  drop column if exists verification_note,
  drop column if exists verified_by,
  drop column if exists verified_at;

revoke all on function blood_bank.verify_blood_request(bigint, text, text, text) from public;
grant execute on function blood_bank.verify_blood_request(bigint, text, text, text) to authenticated;
revoke execute on function blood_bank.rhu_verify_request(bigint, text) from authenticated;

notify pgrst, 'reload schema';
commit;
