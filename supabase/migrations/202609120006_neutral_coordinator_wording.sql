-- Change user-facing messages only; preserve RPC signatures and authorization.
do $migration$
declare
  routine record;
  definition text;
begin
  for routine in
    select p.oid from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'blood_bank'
      and p.proname in ('rhu_verify_request', 'rhu_complete_replacement',
        'require_verified_request_for_pledge', 'notify_eligible_donors')
  loop
    definition := pg_get_functiondef(routine.oid);
    definition := replace(definition, 'RHU coordinator access required', 'Blood donation coordinator access required');
    definition := replace(definition, 'an RHU coordinator', 'a blood donation coordinator');
    definition := replace(definition, 'The RHU must verify', 'The coordinator must verify');
    definition := replace(definition, 'RHU-verified blood appeal', 'Coordinator-verified blood appeal');
    execute definition;
  end loop;
end;
$migration$;
