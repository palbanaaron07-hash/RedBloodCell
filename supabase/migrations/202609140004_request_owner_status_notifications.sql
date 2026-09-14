-- Request status notifications belong to the request owner. Donors receive
-- donor appeals only through notify_eligible_donors.

begin;
set search_path to blood_bank, public;

create or replace function blood_bank.notify_request_owner_of_status_change()
returns trigger
language plpgsql
security definer
set search_path = blood_bank, public
as $$
declare
  notification_title text := 'Request updated';
  notification_message text;
begin
  -- Each replacement pledge already creates a dedicated pledge_received alert.
  -- Do not create a second generic status alert when pledge coverage changes.
  if new.request_type = 'replacement'
    and new.community_status is distinct from old.community_status
    and new.community_status = 'covered'
  then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status then
    case new.verification_status
      when 'verified' then
        notification_title := 'Request approved';
        notification_message := 'Your request #' || new.request_id ||
          ' was verified and is now visible to eligible donors.';
      when 'needs_clarification' then
        notification_title := 'Request needs clarification';
        notification_message := 'Your request #' || new.request_id ||
          ' needs more information before donor matching can begin.';
      when 'rejected' then
        notification_title := 'Request declined';
        notification_message := 'Your request #' || new.request_id ||
          ' did not pass coordinator verification. Review the request details for guidance.';
      else
        notification_message := 'Your request #' || new.request_id || ' is now under review.';
    end case;
  elsif new.community_status is distinct from old.community_status then
    case new.community_status
      when 'covered' then
        notification_title := case when new.request_type = 'replacement'
          then 'Replacement pledges received' else 'Donor coverage reached' end;
        notification_message := case when new.request_type = 'replacement'
          then 'Your replacement request #' || new.request_id ||
            ' has enough pledges and is awaiting facility-confirmed donations.'
          else 'Your request #' || new.request_id ||
            ' has received enough donor pledges.' end;
      when 'fulfilled' then
        notification_title := 'Request fulfilled';
        notification_message := 'Your request #' || new.request_id || ' has been completed.';
      when 'cancelled' then
        notification_title := 'Request cancelled';
        notification_message := 'Your request #' || new.request_id || ' has been cancelled.';
      when 'expired' then
        notification_title := 'Request expired';
        notification_message := 'Your request #' || new.request_id || ' expired without completion.';
      else
        notification_message := 'The status of your request #' || new.request_id || ' was updated.';
    end case;
  elsif new.status is distinct from old.status then
    notification_message := 'The processing status of your request #' || new.request_id ||
      ' changed to ' || replace(coalesce(new.status, 'updated'), '_', ' ') || '.';
  end if;

  if notification_message is null then return new; end if;

  insert into blood_bank.notifications (
    recipient_user_id, request_id, notification_type, title, message
  )
  select
    p.auth_user_id,
    new.request_id,
    'request_updated',
    notification_title,
    notification_message
  from blood_bank.patient p
  where p.patient_id = new.patient_id
    and p.auth_user_id is not null;

  return new;
end;
$$;

drop trigger if exists trg_notify_request_owner_of_status_change on blood_bank.blood_request;
create trigger trg_notify_request_owner_of_status_change
after update of status, verification_status, community_status on blood_bank.blood_request
for each row
when (
  old.status is distinct from new.status
  or old.verification_status is distinct from new.verification_status
  or old.community_status is distinct from new.community_status
)
execute function blood_bank.notify_request_owner_of_status_change();

revoke all on function blood_bank.notify_request_owner_of_status_change() from public;

commit;
notify pgrst, 'reload schema';
