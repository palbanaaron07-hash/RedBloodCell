begin;

-- Cancellation is distinct from coordinator rejection and must remain visible in history.
alter table blood_bank.blood_request
  drop constraint if exists chk_blood_request_status_lifecycle;

alter table blood_bank.blood_request
  add constraint chk_blood_request_status_lifecycle
  check (status in ('pending', 'approved', 'needs_clarification', 'rejected', 'fulfilled', 'cancelled'));

create or replace function blood_bank.manage_my_blood_request(
  p_request_id bigint,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  request_row blood_bank.blood_request%rowtype;
  normalized_action text := lower(trim(coalesce(p_action, '')));
  document_path text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  select br.* into request_row
  from blood_bank.blood_request br
  where br.request_id = p_request_id
  for update;

  if not found then
    raise exception 'Blood request not found';
  end if;

  if not (
    exists (
      select 1 from blood_bank.patient p
      where p.patient_id = request_row.patient_id
        and p.auth_user_id = auth.uid()
    )
    or exists (
      select 1 from blood_bank.users u
      where u.user_id = request_row.requester_user_id
        and u.auth_user_id = auth.uid()
    )
  ) then
    raise exception 'You can only manage your own blood requests';
  end if;

  if normalized_action = 'delete' then
    if lower(coalesce(request_row.status, '')) not in ('pending', 'needs_clarification')
      or lower(coalesce(request_row.verification_status, 'pending')) = 'verified'
      or lower(coalesce(request_row.community_status, 'active')) in ('fulfilled', 'expired')
      or request_row.expires_at <= now()
    then
      raise exception 'Only an open request awaiting verification can be permanently deleted';
    end if;

    select rvs.storage_path into document_path
    from blood_bank.request_verification_support rvs
    where rvs.request_id = request_row.request_id;

    delete from blood_bank.blood_request
    where request_id = request_row.request_id;

    return jsonb_build_object(
      'request_id', request_row.request_id,
      'action', 'deleted',
      'storage_path', document_path
    );
  end if;

  if normalized_action = 'cancel' then
    if lower(coalesce(request_row.status, '')) in ('cancelled', 'rejected', 'fulfilled')
      or lower(coalesce(request_row.community_status, 'active')) in ('fulfilled', 'expired')
      or request_row.expires_at <= now()
    then
      raise exception 'This closed request cannot be cancelled';
    end if;

    if lower(coalesce(request_row.status, '')) <> 'approved'
      and lower(coalesce(request_row.verification_status, 'pending')) <> 'verified'
    then
      raise exception 'Requests awaiting verification should be deleted, not cancelled';
    end if;

    update blood_bank.donor_pledge
    set status = 'cancelled'
    where request_id = request_row.request_id
      and status = 'pledged';

    update blood_bank.replacement_campaign
    set status = 'cancelled', updated_at = now()
    where request_id = request_row.request_id
      and status not in ('complete', 'expired', 'cancelled');

    update blood_bank.blood_request
    set status = 'cancelled',
        community_status = 'expired'
    where request_id = request_row.request_id;

    insert into blood_bank.blood_request_status_log (
      request_id, admin_id, old_status, new_status, reason, note
    ) values (
      request_row.request_id,
      auth.uid()::text,
      request_row.status,
      'cancelled',
      'Cancelled by requester',
      'The requester cancelled this request after coordination began.'
    );

    return jsonb_build_object(
      'request_id', request_row.request_id,
      'action', 'cancelled',
      'status', 'cancelled',
      'community_status', 'expired'
    );
  end if;

  raise exception 'Unsupported request action';
end;
$$;

revoke all on function blood_bank.manage_my_blood_request(bigint, text) from public;
grant execute on function blood_bank.manage_my_blood_request(bigint, text) to authenticated;

commit;
