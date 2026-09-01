# Primary Supabase backend

- `migrations/` is the canonical forward schema history.
- `functions/` contains privileged Deno Edge Functions.
- Root-level `supabase-*.sql` files are historical/manual patches retained for compatibility with existing setup instructions and runtime error guidance.

Before deploying, confirm which manual patches are already represented in the target database. New database changes should be added as timestamped, idempotent migrations and tested against a fresh database and an upgraded existing database.
