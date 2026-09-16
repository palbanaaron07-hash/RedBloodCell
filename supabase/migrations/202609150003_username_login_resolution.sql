-- Enable login via Username by resolving Username to Email securely.

begin;
set search_path to blood_bank, public;

alter table if exists blood_bank.users
  add column if not exists username varchar(60);

create unique index if not exists uq_users_username_ci
  on blood_bank.users (lower(trim(username)))
  where username is not null and trim(username) <> '';

-- Backfill usernames from auth.users metadata where available
update blood_bank.users u
set username = trim(au.raw_user_meta_data->>'username')
from auth.users au
where u.auth_user_id = au.id
  and u.username is null
  and nullif(trim(au.raw_user_meta_data->>'username'), '') is not null;

-- Secure function to resolve email for authentication by email or username in public schema (required for Supabase client RPC)
create or replace function public.resolve_login_identifier(identifier text)
returns table (
  email text,
  user_found boolean
)
language plpgsql
security definer
set search_path = blood_bank, auth, public
as $$
declare
  clean_input text := lower(trim(coalesce(identifier, '')));
  matched_email text;
begin
  if clean_input = '' then
    return query select null::text, false;
    return;
  end if;

  -- 1. Direct email lookup if input looks like an email
  if position('@' in clean_input) > 0 then
    select lower(trim(u.email)) into matched_email
    from auth.users u
    where lower(trim(u.email)) = clean_input
    limit 1;

    if matched_email is not null then
      return query select matched_email, true;
      return;
    end if;

    return query select clean_input, true;
    return;
  end if;

  -- 2. Built-in Admin shortcut if logging in as admin
  if clean_input = 'admin' then
    select lower(trim(u.email)) into matched_email
    from auth.users u
    where lower(trim(u.email)) in ('admin@bloodconnect.com', 'adminblood@gmail.com', 'admin@bloodconnect.ph')
    limit 1;

    if matched_email is not null then
      return query select matched_email, true;
      return;
    end if;
  end if;

  -- 3. Check blood_bank.users table by username
  select lower(trim(u.email)) into matched_email
  from blood_bank.users u
  where lower(trim(u.username)) = clean_input
    and u.email is not null
  limit 1;

  if matched_email is not null then
    return query select matched_email, true;
    return;
  end if;

  -- 4. Check auth.users user_metadata by username
  select lower(trim(au.email)) into matched_email
  from auth.users au
  where lower(trim(au.raw_user_meta_data->>'username')) = clean_input
    and au.email is not null
  limit 1;

  if matched_email is not null then
    return query select matched_email, true;
    return;
  end if;

  return query select null::text, false;
end;
$$;

grant execute on function public.resolve_login_identifier(text) to anon, authenticated, service_role;

-- Alias in blood_bank schema
create or replace function blood_bank.resolve_login_identifier(identifier text)
returns table (
  email text,
  user_found boolean
)
language sql
security definer
as $$
  select * from public.resolve_login_identifier(identifier);
$$;

grant execute on function blood_bank.resolve_login_identifier(text) to anon, authenticated, service_role;

commit;
