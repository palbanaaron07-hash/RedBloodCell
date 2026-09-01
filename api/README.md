# PHP/MySQL compatibility API

This directory preserves the existing `/api/*.php` endpoints and PHP session behavior. Supabase is the primary backend; these endpoints support legacy login, registration synchronization, password synchronization, and older MySQL workflows.

Do not move endpoint files into a nested directory without routing aliases because their paths are public compatibility interfaces. New operational features should use Supabase migrations, Row Level Security, RPCs, or Edge Functions unless MySQL compatibility is an explicit requirement.

`config.php` contains local XAMPP defaults and permissive development CORS. Production deployment requires environment-provided credentials, restricted origins, hardened session cookies, and non-debug database error responses.
