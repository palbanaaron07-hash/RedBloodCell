-- Private password-reset throttling and audit state.
-- Service-role access only: no policies are intentionally created.

begin;

create table if not exists public.password_reset_challenges (
  email_hash text primary key,
  ip_hash text not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verify_attempts smallint not null default 0 check (verify_attempts between 0 and 5),
  verified_at timestamptz,
  password_updated_at timestamptz,
  consumed_at timestamptz,
  user_id uuid references auth.users(id) on delete set null
);

create table if not exists public.password_reset_events (
  event_id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email_hash text not null,
  ip_hash text not null,
  event_type text not null check (event_type in (
    'requested',
    'request_limited',
    'verification_failed',
    'verified',
    'reset_completed'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_events_email_time
  on public.password_reset_events (email_hash, created_at desc);

create index if not exists idx_password_reset_events_ip_time
  on public.password_reset_events (ip_hash, created_at desc);

alter table public.password_reset_challenges enable row level security;
alter table public.password_reset_events enable row level security;

revoke all on public.password_reset_challenges from anon, authenticated;
revoke all on public.password_reset_events from anon, authenticated;

create or replace function public.claim_password_reset_attempt(target_email_hash text)
returns table (allowed boolean, attempts smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge public.password_reset_challenges%rowtype;
begin
  select * into challenge
  from public.password_reset_challenges
  where email_hash = target_email_hash
  for update;

  if not found
    or challenge.consumed_at is not null
    or challenge.verified_at is not null
    or challenge.expires_at <= now()
    or challenge.verify_attempts >= 5 then
    return query select false, coalesce(challenge.verify_attempts, 0)::smallint;
    return;
  end if;

  update public.password_reset_challenges
  set verify_attempts = verify_attempts + 1
  where email_hash = target_email_hash
  returning verify_attempts into challenge.verify_attempts;

  return query select true, challenge.verify_attempts;
end;
$$;

revoke all on function public.claim_password_reset_attempt(text) from public, anon, authenticated;
grant execute on function public.claim_password_reset_attempt(text) to service_role;

commit;
