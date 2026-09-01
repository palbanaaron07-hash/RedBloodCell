# VeinDrop / RedBloodCell

VeinDrop is a multi-page blood-bank prototype. Its operational pages use classic HTML, CSS, and JavaScript with Supabase as the primary application backend. The React/Vite entry is a separate PWA landing/dashboard shell.

## Development

```powershell
npm ci
npm run dev
```

Vite opens `homie.html`, the existing marketing home. `index.html` remains the installable React/PWA entry at `/`.

## Production verification

```powershell
npm run build
npm run verify:architecture
```

The Vite configuration explicitly treats every root HTML page as an entry. The verification command fails if a public route, referenced local asset, or production output is missing.

## Architecture boundaries

- Root `*.html` files are stable public routes. Keep their filenames when refactoring internals.
- `src/` contains bundled React code and styles.
- `public/` contains classic browser scripts, PWA files, and other files that must retain stable root URLs.
- `public/scripts/pages/` contains behavior extracted unchanged from the corresponding HTML pages.
- `supabase/` contains the primary PostgreSQL migrations and privileged Edge Functions.
- `api/` is the legacy PHP/MySQL compatibility layer. It is not the primary domain backend.
- Root `supabase-*.sql` files are manual compatibility/recovery patches retained at their documented paths. New schema evolution belongs in `supabase/migrations/`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for responsibilities and refactoring rules.
