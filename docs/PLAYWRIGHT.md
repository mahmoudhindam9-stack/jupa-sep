# Playwright E2E tests for Juba-SE​P

## Isolation guarantee

The browser suite runs against a disposable Supabase stack started by the GitHub Actions runner. It applies this repository's migrations to a fresh local database, creates a temporary first administrator, and discards the database when the job ends.

The test configuration refuses to start unless:

- The application origin is exactly `http://jupa-sep.test:3000`.
- `VITE_E2E_ISOLATED=true` is set.
- `VITE_SUPABASE_URL` is exactly `http://127.0.0.1:54321`.

The Vite configuration and browser Supabase client both fail closed in isolated E2E mode. They do not fall back to the hosted project URL or key. No production URL, credentials, user data, payment records, or database writes are used by this workflow.

## What the first suite covers

- First administrator bootstrap in a fresh local database.
- Admin session creation and persistence after a hard reload.
- Protected admin route access and guest redirection.
- Login screen rendering after bootstrap.
- Rejection of invalid credentials without creating a cached local session.
- Forgot-password form rendering (the test does not send an email).
- Responsive login layout at a 375px viewport.
- Browser crash checks across the major admin, POS, cashier, captain, kitchen, and public menu routes.

These are browser smoke/regression tests. They do not yet create sample sales, inventory movements, journal entries, or payment transactions. Those workflow tests should be added with disposable seeded fixtures after the route suite is green.

## Run in GitHub Actions

Open or update a pull request targeting `main`. The workflow starts a fresh Supabase local stack, applies all committed migrations, starts the app with local-only credentials, and runs Chromium tests. It uploads the HTML report, screenshots, traces, and other failure evidence as a seven-day artifact. The generated authentication state is excluded from artifacts and Git.

## Run locally

Requirements: Node.js 22+, a Docker-compatible container runtime, and the Supabase CLI.

```bash
npm ci
npm install --no-save @playwright/test@1.65.1
npx playwright install chromium
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
npx supabase status -o env
```

Export `API_URL` as `VITE_SUPABASE_URL`, `ANON_KEY` as both `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and set `VITE_E2E_ISOLATED=true`. Add `127.0.0.1 jupa-sep.test` to the machine's hosts file, then run:

```bash
PLAYWRIGHT_BASE_URL=http://jupa-sep.test:3000 npm run test:e2e
```

Use `npx supabase db reset --local --no-seed` before a repeat run if you want to recreate the fresh first-admin bootstrap state. Do not use `--linked`, `--remote`, a hosted URL, or production credentials for this suite.
