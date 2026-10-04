# หนี้ชัด (NeeChat)

> บันทึกทุกการจ่าย ตรวจสอบทุกยอด

Personal loan ledger for กยศ. repayments: record each payment with its slip, keep a running ledger balance, and never lose history (edits void and replace, nothing is deleted). Mobile-first PWA. Not affiliated with กยศ.

## Stack

Next.js 15 (App Router) · Supabase (Postgres, Storage, Auth) · Drizzle ORM · Tailwind + shadcn/ui · Vitest · Playwright · Serwist

## Architecture

Clean Architecture, dependencies point inward (enforced by ESLint `boundaries`):

```
src/domain          entities, Money/DateOnly, ledger math (pure, no framework imports)
src/application     ports (interfaces) + use cases
src/infrastructure  Drizzle repositories, Supabase storage, container
src/presentation    components, server actions, view-models     ┐ presentation
src/app             Next.js routes (thin)                       ┘
```

Design spec: `docs/superpowers/specs/2026-10-04-neechat-phase1-2-design.md`
Implementation plan: `docs/superpowers/plans/2026-10-04-neechat-phase1-2.md`

## Local development

Prereqs: Node 20+, Docker Desktop.

```bash
npm install
npx supabase start            # prints anon/service_role keys
cp .env.example .env.local    # paste keys
cp .env.example .env.test     # same values, used by integration/E2E tests
npm run db:migrate
npm run dev                   # http://localhost:3000
```

Magic-link emails land in the local Mailpit inbox at http://127.0.0.1:54324. Supabase Studio: http://127.0.0.1:54323.

The email template is `supabase/templates/magic_link.html`. It links to `/auth/callback?token_hash=…&type=email&redirect_to=…`; the `redirect_to` parameter carries the deep link the user lands on after login.

### Testing on a real phone (ทดสอบบนมือถือจริง)

The evidence picker uses `crypto.randomUUID()`, which only exists in a secure context. Opening the dev server over plain `http://<LAN-IP>:3000` from a phone will therefore fail to pick files. Instead use one of:

- `localhost` forwarding, e.g. `adb reverse tcp:3000 tcp:3000` (Android) and open `http://localhost:3000` on the phone
- an HTTPS tunnel to your dev server
- the deployed HTTPS URL (see `docs/deploy.md`)

## Scripts

| Script | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | unit tests (domain, application, view-models) |
| `npm run test:int` | integration tests against local Supabase |
| `npm run e2e` | Playwright mobile flow (starts `npm run dev` via `webServer`; logs in through the admin API, no email needed) |
| `npm run lint` / `typecheck` | ESLint incl. layer boundaries / tsc |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run icons` | regenerate PWA icons |

## Ledger rules

- Ledger Balance = opening balance − Σ ACTIVE payments dated after the opening-balance date.
- Payments are immutable. Editing voids the original and creates a replacement linked by a correction record. Voiding records a correction without a replacement.
- Evidence files live in the private `evidence` bucket and are served through 1-hour signed URLs.
- "Today" (future-date checks, default dates) is computed in Asia/Bangkok regardless of the server time zone.
- Database RLS uses select-only owner policies; all writes go through the server.

## Deploy

See `docs/deploy.md`.
