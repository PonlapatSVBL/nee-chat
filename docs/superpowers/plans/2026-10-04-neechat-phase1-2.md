# NeeChat Phase 1+2 (Payment Ledger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first PWA where a single user sets up their กยศ. loan, records each payment with a slip photo, sees a running ledger balance, and can correct or void entries without losing history.

**Architecture:** Clean Architecture in one Next.js 15 codebase. `domain/` holds entities and pure ledger math, `application/` holds ports and use cases, `infrastructure/` implements ports with Drizzle (Supabase Postgres) and Supabase Storage, and the presentation layer (`src/app` routes + `src/presentation`) calls use cases through Server Actions. Dependencies point inward only, enforced by ESLint.

**Tech Stack:** Next.js 15 (App Router, TypeScript strict), Tailwind CSS v4 + shadcn/ui, react-hook-form + zod, Drizzle ORM + postgres-js, Supabase (Postgres, Storage, Auth magic link via `@supabase/ssr`), decimal.js, Vitest, Playwright, Serwist (PWA).

**Spec:** `docs/superpowers/specs/2026-10-04-neechat-phase1-2-design.md`

## Global Constraints

- Node.js 20+ and Docker Desktop (for `supabase start`) are required on the dev machine. Windows: run commands in Git Bash.
- Next.js pinned to `15.x`. React 19. Do not upgrade to Next 16 (middleware file rename).
- All money columns are `numeric(12,2)`; in TypeScript money is always the `Money` value object (decimal.js). Never use `number` for amounts outside display formatting.
- All dates of payment are `DateOnly` (ISO `YYYY-MM-DD` string, no time zone). Timestamps (`createdAt`, `voidedAt`) are `Date`.
- Payments are immutable: the only permitted update is `ACTIVE → VOIDED` once. Edits create a replacement payment plus a `payment_corrections` row.
- Ledger Balance = `opening_balance − Σ amount(ACTIVE payments with paid_at > opening_balance_date)`.
- Evidence files: MIME in `image/jpeg, image/png, image/webp, application/pdf`, size ≤ 5,242,880 bytes, stored at `{user_id}/payments/{payment_id}/{file_id}.{ext}` in private bucket `evidence`, read via signed URL (3600 s).
- Every table row carries `user_id`; every repository method takes `userId` and filters by it.
- UI copy is Thai. Money renders as `3,000.00 บาท`. Dates render in พ.ศ. as `4 ต.ค. 2569`.
- Layer rule (ESLint `boundaries`): `domain` imports only `domain`; `application` imports `domain|application`; `infrastructure` imports `domain|application|infrastructure`; presentation (`src/app`, `src/presentation`, `src/middleware.ts`) imports anything. Domain and application must never import Next.js, Drizzle or Supabase.
- Deviation from spec, by necessity: Next.js requires the router directory at `src/app`, so routes live in `src/app/**` (thin files) and everything else presentation-related lives in `src/presentation/**`. Both are the presentation layer.
- **UI tasks (16–22) have a REQUIRED SUB-SKILL:** invoke `frontend-design:frontend-design` and then `impeccable:impeccable` before writing any component or page. The code in those tasks fixes component names, props, behavior and copy; the skills direct the visual layer (tokens in `globals.css`, type scale, spacing, color, motion). Keep names and behavior as written; restyle freely.
- Commit after every task (and after each green test where the task says so). Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Use `npm` only.

---

## File Structure

```text
.env.example                         documented env vars
.env.local                           local secrets (gitignored)
.env.test                            Supabase local values for integration/E2E (gitignored)
drizzle.config.ts                    drizzle-kit config (schema + migrations paths)
eslint.config.mjs                    Next defaults + boundaries rule
next.config.ts                       Serwist wrapper
playwright.config.ts                 mobile viewport, webServer
vitest.config.ts                     unit tests (*.test.ts, excludes *.int.test.ts)
vitest.integration.config.ts         integration tests (*.int.test.ts) with .env.test
components.json                      shadcn aliases into src/presentation
supabase/config.toml                 local Supabase (auth URLs, email template)
supabase/templates/magic_link.html   token_hash based login email
scripts/make-icons.mjs               PWA icons from SVG
e2e/                                 Playwright specs + helpers

src/domain/shared/     result.ts, errors.ts, money.ts, date-only.ts (+ tests)
src/domain/loan/       loan.ts (+ test)
src/domain/payment/    payment.ts, correction.ts (+ test)
src/domain/evidence/   evidence.ts (+ test)
src/domain/ledger/     ledger.ts (+ test)

src/application/ports/        repositories.ts, file-storage.ts, system.ts, unit-of-work.ts
src/application/testing/      in-memory.ts (test doubles shared by use-case tests)
src/application/use-cases/    loan/, payment/, query/  (one class per file + test)

src/infrastructure/db/            schema.ts, client.ts, migrations/
src/infrastructure/repositories/  mappers.ts, drizzle-*.ts, unit-of-work.ts, index.ts (+ int tests)
src/infrastructure/storage/       supabase-file-storage.ts (+ int test)
src/infrastructure/supabase/      service-client.ts
src/infrastructure/system/        clock.ts, ids.ts
src/infrastructure/container.ts   wires use cases (server-only)

src/presentation/lib/supabase/    server.ts, browser.ts, middleware.ts
src/presentation/lib/             utils.ts (shadcn cn), resize-image.ts, upload-evidence.ts
src/presentation/actions/         auth.ts, loan.ts, payment.ts, evidence.ts (Server Actions)
src/presentation/forms/           loan-schema.ts, payment-schema.ts (zod)
src/presentation/view-models/     format.ts, error-messages.ts, default-note.ts (+ tests)
src/presentation/components/      ui/ (shadcn), shell/, auth/, loan/, dashboard/, payments/, evidence/
src/app/                          layout.tsx, globals.css, manifest.ts, sw.ts,
                                  (auth)/login, auth/callback/route.ts,
                                  (onboarding)/setup, (app)/{page,payments,more}
src/middleware.ts
```

---

### Task 1: Project scaffold, tooling, layer boundaries

**Files:**
- Create: Next.js app via `create-next-app`, `vitest.config.ts`, `vitest.integration.config.ts`, `src/test/setup-int.ts`, `.env.example`, `tsconfig.json` (modify), `eslint.config.mjs` (replace), `package.json` scripts
- Create: `src/domain/.gitkeep`, `src/application/.gitkeep`, `src/infrastructure/.gitkeep`, `src/presentation/.gitkeep`

**Interfaces:**
- Produces: `npm run test`, `npm run test:int`, `npm run lint`, `npm run typecheck` scripts; `@/` alias to `src/`; ESLint boundaries rule that fails on inward-violating imports.

- [ ] **Step 1: Scaffold Next.js into a temp folder and move it in**

The repo already has `docs/` and `.gitignore`, so scaffold into a subfolder and move.

```bash
cd /b/Piw-Github/nee-chat
npx create-next-app@15 tmp-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-install --no-turbopack
shopt -s dotglob
mv -f tmp-scaffold/* .
rmdir tmp-scaffold
printf '\n!.env.example\n.env.test\ncoverage/\nplaywright-report/\ntest-results/\npublic/sw.js\npublic/sw.js.map\n' >> .gitignore
```

Expected: `package.json`, `src/app/`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json` now exist at the repo root.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install next@15 react@19 react-dom@19 decimal.js zod@3 react-hook-form @hookform/resolvers drizzle-orm postgres @supabase/supabase-js @supabase/ssr lucide-react class-variance-authority clsx tailwind-merge sonner server-only
npm install -D vitest @vitest/coverage-v8 drizzle-kit eslint-plugin-boundaries eslint-import-resolver-typescript @playwright/test dotenv tsx @serwist/next serwist sharp
```

Expected: no peer-dependency errors. If `next@15` resolves to a 15.x version, good.

- [ ] **Step 3: Add npm scripts**

```bash
npm pkg set scripts.dev="next dev" scripts.build="next build" scripts.start="next start" \
  scripts.lint="eslint ." scripts.typecheck="tsc --noEmit" \
  scripts.test="vitest run" scripts.test:watch="vitest" \
  scripts.test:int="vitest run --config vitest.integration.config.ts" \
  scripts.db:generate="drizzle-kit generate" scripts.db:migrate="drizzle-kit migrate" \
  scripts.e2e="playwright test" scripts.icons="node scripts/make-icons.mjs"
```

- [ ] **Step 4: Tighten tsconfig**

Edit `tsconfig.json` so `compilerOptions` contains these keys (keep the rest generated by create-next-app):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- [ ] **Step 5: Vitest configs**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts', 'node_modules', '.next'],
    environment: 'node',
  },
});
```

Create `vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.int.test.ts'],
    environment: 'node',
    setupFiles: ['./src/test/setup-int.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
```

Create `src/test/setup-int.ts`:

```ts
import { config } from 'dotenv';

config({ path: '.env.test' });

for (const key of ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in .env.test (copy from .env.example and fill from \`npx supabase status\`)`);
  }
}
```

- [ ] **Step 6: Env example**

Create `.env.example`:

```bash
# Supabase (from `npx supabase status` locally, or project settings in production)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-me
SUPABASE_SERVICE_ROLE_KEY=replace-me
# Direct Postgres connection used by Drizzle (local default below)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Public origin used in magic-link redirects
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 7: ESLint boundaries**

Replace `eslint.config.mjs` with:

```js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import boundaries from 'eslint-plugin-boundaries';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'application', pattern: 'src/application/**' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },
        { type: 'presentation', pattern: ['src/presentation/**', 'src/app/**', 'src/middleware.ts'] },
        { type: 'test', pattern: 'src/test/**' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'domain', allow: ['domain'] },
            { from: 'application', allow: ['domain', 'application'] },
            { from: 'infrastructure', allow: ['domain', 'application', 'infrastructure'] },
            { from: 'presentation', allow: ['domain', 'application', 'infrastructure', 'presentation'] },
            { from: 'test', allow: ['domain', 'application', 'infrastructure', 'presentation', 'test'] },
          ],
        },
      ],
      'boundaries/no-unknown-files': 'off',
    },
  },
  { ignores: ['.next/**', 'public/sw.js', 'node_modules/**', 'src/infrastructure/db/migrations/**'] },
];
```

Create the layer folders:

```bash
mkdir -p src/domain src/application src/infrastructure src/presentation
touch src/domain/.gitkeep src/application/.gitkeep src/infrastructure/.gitkeep src/presentation/.gitkeep
```

- [ ] **Step 8: Prove the boundary rule bites**

```bash
mkdir -p src/domain/tmp src/presentation/tmp
echo "export const x = 1;" > src/presentation/tmp/thing.ts
echo "import { x } from '@/presentation/tmp/thing'; export const y = x;" > src/domain/tmp/violation.ts
npm run lint
```

Expected: lint FAILS with a `boundaries/element-types` error on `src/domain/tmp/violation.ts`.

```bash
rm -rf src/domain/tmp src/presentation/tmp
npm run lint
```

Expected: lint passes.

- [ ] **Step 9: Smoke test Vitest and typecheck**

Create `src/test/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm run test` → Expected: `1 passed`.
Run: `npm run typecheck` → Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with Vitest, ESLint layer boundaries, env example

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Domain shared kernel — Result, DomainError, Money, DateOnly

**Files:**
- Create: `src/domain/shared/result.ts`, `src/domain/shared/errors.ts`, `src/domain/shared/money.ts`, `src/domain/shared/date-only.ts`
- Test: `src/domain/shared/money.test.ts`, `src/domain/shared/date-only.test.ts`
- Delete: `src/domain/.gitkeep`

**Interfaces:**
- Produces:
  - `type Result<T, E = DomainError> = Ok<T> | Err<E>`; `ok(value)`, `err(error)`
  - `class DomainError extends Error { code: DomainErrorCode }` with codes listed below
  - `class Money`: `Money.parse(s): Result<Money>`, `Money.of(s): Money` (throws), `Money.zero()`, `add`, `subtract`, `isPositive`, `isNegative`, `isZero`, `equals`, `compare`, `toString()` → `"3000.00"`, `toNumber()`
  - `class DateOnly`: `DateOnly.parse(s): Result<DateOnly>`, `DateOnly.of(s)`, `DateOnly.fromDate(d: Date)` (local date), `.iso`, `.year/.month/.day`, `compare`, `isAfter`, `isBefore`, `equals`, `toDate()` (UTC midnight)

- [ ] **Step 1: Write failing tests**

`src/domain/shared/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  it('parses plain and comma-formatted strings to two decimals', () => {
    expect(Money.of('3000').toString()).toBe('3000.00');
    expect(Money.of('3,000.5').toString()).toBe('3000.50');
    expect(Money.of(' 182420.50 ').toString()).toBe('182420.50');
  });

  it('rejects more than two decimals, empty and non-numeric input', () => {
    for (const bad of ['1.234', '', 'abc', '12.3.4', '1e3']) {
      const r = Money.parse(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_AMOUNT');
    }
  });

  it('adds and subtracts without float drift', () => {
    const a = Money.of('0.10');
    const b = Money.of('0.20');
    expect(a.add(b).toString()).toBe('0.30');
    expect(Money.of('195420.50').subtract(Money.of('3000')).toString()).toBe('192420.50');
  });

  it('compares', () => {
    expect(Money.of('1').compare(Money.of('2'))).toBe(-1);
    expect(Money.of('2').compare(Money.of('2'))).toBe(0);
    expect(Money.of('3').compare(Money.of('2'))).toBe(1);
    expect(Money.of('5').isPositive()).toBe(true);
    expect(Money.of('-5').isNegative()).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.of('1.5').equals(Money.of('1.50'))).toBe(true);
  });
});
```

`src/domain/shared/date-only.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DateOnly } from './date-only';

describe('DateOnly', () => {
  it('parses valid ISO dates', () => {
    const d = DateOnly.of('2026-10-04');
    expect(d.iso).toBe('2026-10-04');
    expect(d.year).toBe(2026);
    expect(d.month).toBe(10);
    expect(d.day).toBe(4);
  });

  it('rejects bad formats and impossible dates', () => {
    for (const bad of ['2026-13-01', '2026-02-30', '04/10/2026', '2026-1-4', '']) {
      const r = DateOnly.parse(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_DATE');
    }
  });

  it('compares chronologically', () => {
    const a = DateOnly.of('2026-09-04');
    const b = DateOnly.of('2026-10-04');
    expect(a.isBefore(b)).toBe(true);
    expect(b.isAfter(a)).toBe(true);
    expect(a.equals(DateOnly.of('2026-09-04'))).toBe(true);
    expect(a.compare(b)).toBe(-1);
  });

  it('converts from a JS Date using local calendar fields', () => {
    const local = new Date(2026, 9, 4, 23, 59);
    expect(DateOnly.fromDate(local).iso).toBe('2026-10-04');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL, cannot resolve `./money` and `./date-only`.

- [ ] **Step 3: Implement**

`src/domain/shared/errors.ts`:

```ts
export type DomainErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE'
  | 'FUTURE_DATE'
  | 'INVALID_NAME'
  | 'INVALID_PAYMENT_METHOD'
  | 'REASON_REQUIRED'
  | 'LOAN_NOT_FOUND'
  | 'LOAN_ALREADY_EXISTS'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_ALREADY_VOIDED'
  | 'EVIDENCE_NOT_FOUND'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_EVIDENCE_PATH'
  | 'PERSISTENCE_FAILED'
  | 'STORAGE_FAILED';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}
```

`src/domain/shared/result.ts`:

```ts
import type { DomainError } from './errors';

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = DomainError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
```

`src/domain/shared/money.ts`:

```ts
import Decimal from 'decimal.js';
import { DomainError } from './errors';
import { err, ok, type Result } from './result';

const TWO_DECIMALS = /^-?\d+(\.\d{1,2})?$/;

export class Money {
  private constructor(private readonly value: Decimal) {}

  static parse(input: string): Result<Money> {
    const cleaned = input.trim().replace(/,/g, '');
    if (!TWO_DECIMALS.test(cleaned)) {
      return err(new DomainError('INVALID_AMOUNT', `ไม่ใช่จำนวนเงินที่ถูกต้อง: "${input}"`));
    }
    return ok(new Money(new Decimal(cleaned)));
  }

  /** For trusted input (database rows, tests). Throws on invalid input. */
  static of(input: string): Money {
    const result = Money.parse(input);
    if (!result.ok) throw result.error;
    return result.value;
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isNegative(): boolean {
    return this.value.lessThan(0);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  compare(other: Money): -1 | 0 | 1 {
    return this.value.comparedTo(other.value) as -1 | 0 | 1;
  }

  toString(): string {
    return this.value.toFixed(2);
  }

  toNumber(): number {
    return this.value.toNumber();
  }
}
```

`src/domain/shared/date-only.ts`:

```ts
import { DomainError } from './errors';
import { err, ok, type Result } from './result';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export class DateOnly {
  private constructor(readonly iso: string) {}

  static parse(input: string): Result<DateOnly> {
    const trimmed = input.trim();
    const match = ISO_DATE.exec(trimmed);
    if (!match) {
      return err(new DomainError('INVALID_DATE', `รูปแบบวันที่ไม่ถูกต้อง: "${input}"`));
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    const real =
      probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
    if (!real) {
      return err(new DomainError('INVALID_DATE', `ไม่มีวันที่นี้ในปฏิทิน: "${input}"`));
    }
    return ok(new DateOnly(trimmed));
  }

  /** For trusted input (database rows, tests). Throws on invalid input. */
  static of(input: string): DateOnly {
    const result = DateOnly.parse(input);
    if (!result.ok) throw result.error;
    return result.value;
  }

  /** Uses the local calendar fields of the given Date. */
  static fromDate(date: Date): DateOnly {
    return new DateOnly(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }

  get year(): number {
    return Number(this.iso.slice(0, 4));
  }

  get month(): number {
    return Number(this.iso.slice(5, 7));
  }

  get day(): number {
    return Number(this.iso.slice(8, 10));
  }

  compare(other: DateOnly): -1 | 0 | 1 {
    if (this.iso < other.iso) return -1;
    if (this.iso > other.iso) return 1;
    return 0;
  }

  isAfter(other: DateOnly): boolean {
    return this.compare(other) === 1;
  }

  isBefore(other: DateOnly): boolean {
    return this.compare(other) === -1;
  }

  equals(other: DateOnly): boolean {
    return this.iso === other.iso;
  }

  /** UTC midnight of this calendar date. */
  toDate(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, this.day));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: money + date-only suites PASS (plus smoke).

- [ ] **Step 5: Commit**

```bash
rm -f src/domain/.gitkeep
git add src/domain/shared
git commit -m "feat(domain): add Result, DomainError, Money and DateOnly value objects

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Domain — Loan

**Files:**
- Create: `src/domain/loan/loan.ts`
- Test: `src/domain/loan/loan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface Loan { id; userId; name; loanNumber: string|null; openingBalance: Money; openingBalanceDate: DateOnly; defaultAmount: Money|null; createdAt: Date; updatedAt: Date }
  interface LoanDraft { name; loanNumber: string|null; openingBalance: Money; openingBalanceDate: DateOnly; defaultAmount: Money|null }
  validateLoanDraft(draft): Result<LoanDraft>
  createLoan(draft, ctx: { id; userId; now: Date }): Loan
  applyLoanUpdate(loan, draft, now: Date): Loan
  ```

- [ ] **Step 1: Write failing test**

`src/domain/loan/loan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { applyLoanUpdate, createLoan, validateLoanDraft, type LoanDraft } from './loan';

const draft: LoanDraft = {
  name: '  กยศ. ของฉัน ',
  loanNumber: ' 12345 ',
  openingBalance: Money.of('195420.50'),
  openingBalanceDate: DateOnly.of('2026-06-30'),
  defaultAmount: Money.of('3000'),
};

describe('validateLoanDraft', () => {
  it('trims name and loan number', () => {
    const r = validateLoanDraft(draft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('กยศ. ของฉัน');
      expect(r.value.loanNumber).toBe('12345');
    }
  });

  it('turns blank loan number into null', () => {
    const r = validateLoanDraft({ ...draft, loanNumber: '   ' });
    if (r.ok) expect(r.value.loanNumber).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('rejects empty name', () => {
    const r = validateLoanDraft({ ...draft, name: ' ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_NAME');
  });

  it('rejects negative opening balance and non-positive default amount', () => {
    const neg = validateLoanDraft({ ...draft, openingBalance: Money.of('-1') });
    expect(neg.ok).toBe(false);
    const zeroDefault = validateLoanDraft({ ...draft, defaultAmount: Money.of('0') });
    expect(zeroDefault.ok).toBe(false);
    if (!zeroDefault.ok) expect(zeroDefault.error.code).toBe('INVALID_AMOUNT');
  });
});

describe('createLoan / applyLoanUpdate', () => {
  it('stamps ids and timestamps', () => {
    const now = new Date('2026-10-04T10:00:00Z');
    const loan = createLoan(draft, { id: 'loan-1', userId: 'user-1', now });
    expect(loan.id).toBe('loan-1');
    expect(loan.userId).toBe('user-1');
    expect(loan.createdAt).toBe(now);
    expect(loan.updatedAt).toBe(now);
  });

  it('keeps id/userId/createdAt on update and bumps updatedAt', () => {
    const now = new Date('2026-10-04T10:00:00Z');
    const later = new Date('2026-10-05T10:00:00Z');
    const loan = createLoan(draft, { id: 'loan-1', userId: 'user-1', now });
    const updated = applyLoanUpdate(loan, { ...draft, name: 'ใหม่' }, later);
    expect(updated.id).toBe('loan-1');
    expect(updated.createdAt).toBe(now);
    expect(updated.updatedAt).toBe(later);
    expect(updated.name).toBe('ใหม่');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- loan`
Expected: FAIL, cannot resolve `./loan`.

- [ ] **Step 3: Implement**

`src/domain/loan/loan.ts`:

```ts
import { DateOnly } from '@/domain/shared/date-only';
import { DomainError } from '@/domain/shared/errors';
import { Money } from '@/domain/shared/money';
import { err, ok, type Result } from '@/domain/shared/result';

export interface Loan {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly loanNumber: string | null;
  readonly openingBalance: Money;
  readonly openingBalanceDate: DateOnly;
  readonly defaultAmount: Money | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LoanDraft {
  readonly name: string;
  readonly loanNumber: string | null;
  readonly openingBalance: Money;
  readonly openingBalanceDate: DateOnly;
  readonly defaultAmount: Money | null;
}

export function validateLoanDraft(draft: LoanDraft): Result<LoanDraft> {
  const name = draft.name.trim();
  if (name.length === 0) {
    return err(new DomainError('INVALID_NAME', 'กรุณาระบุชื่อเงินกู้'));
  }
  if (draft.openingBalance.isNegative()) {
    return err(new DomainError('INVALID_AMOUNT', 'ยอดตั้งต้นต้องไม่ติดลบ'));
  }
  if (draft.defaultAmount && !draft.defaultAmount.isPositive()) {
    return err(new DomainError('INVALID_AMOUNT', 'ยอดจ่ายประจำต้องมากกว่า 0'));
  }
  const loanNumber = draft.loanNumber?.trim() || null;
  return ok({ ...draft, name, loanNumber });
}

export function createLoan(draft: LoanDraft, ctx: { id: string; userId: string; now: Date }): Loan {
  return {
    id: ctx.id,
    userId: ctx.userId,
    name: draft.name,
    loanNumber: draft.loanNumber,
    openingBalance: draft.openingBalance,
    openingBalanceDate: draft.openingBalanceDate,
    defaultAmount: draft.defaultAmount,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

export function applyLoanUpdate(loan: Loan, draft: LoanDraft, now: Date): Loan {
  return {
    ...loan,
    name: draft.name,
    loanNumber: draft.loanNumber,
    openingBalance: draft.openingBalance,
    openingBalanceDate: draft.openingBalanceDate,
    defaultAmount: draft.defaultAmount,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- loan` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/loan
git commit -m "feat(domain): add Loan entity with draft validation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 4: Domain — Payment and PaymentCorrection

**Files:**
- Create: `src/domain/payment/payment.ts`, `src/domain/payment/correction.ts`
- Test: `src/domain/payment/payment.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type PaymentMethod = 'MOBILE_BANKING' | 'COUNTER' | 'ATM' | 'OTHER'; const PAYMENT_METHODS
  type PaymentStatus = 'ACTIVE' | 'VOIDED'
  interface Payment { id; loanId; userId; paidAt: DateOnly; amount: Money; paymentMethod; referenceNo: string|null; notes: string|null; status; voidedAt: Date|null; voidReason: string|null; replacedByPaymentId: string|null; createdAt: Date }
  interface PaymentDraft { paidAt: DateOnly; amount: Money; paymentMethod: PaymentMethod; referenceNo: string|null; notes: string|null }
  parsePaymentMethod(s: string): Result<PaymentMethod>
  validatePaymentDraft(draft, today: DateOnly): Result<PaymentDraft>
  createPayment(draft, ctx: { id; loanId; userId; now: Date }): Payment
  voidPayment(p, reason: string, now: Date, replacedByPaymentId: string|null): Result<Payment>
  interface PaymentCorrection { id; userId; originalPaymentId; replacementPaymentId: string|null; reason; createdAt: Date }
  ```

- [ ] **Step 1: Write failing test**

`src/domain/payment/payment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { createPayment, parsePaymentMethod, validatePaymentDraft, voidPayment, type PaymentDraft } from './payment';

const today = DateOnly.of('2026-10-04');
const draft: PaymentDraft = {
  paidAt: DateOnly.of('2026-10-04'),
  amount: Money.of('3000'),
  paymentMethod: 'MOBILE_BANKING',
  referenceNo: ' REF123 ',
  notes: '  ',
};
const now = new Date('2026-10-04T09:00:00Z');

describe('parsePaymentMethod', () => {
  it('accepts known methods and rejects others', () => {
    expect(parsePaymentMethod('ATM')).toEqual({ ok: true, value: 'ATM' });
    const bad = parsePaymentMethod('CASH');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('INVALID_PAYMENT_METHOD');
  });
});

describe('validatePaymentDraft', () => {
  it('trims reference and nulls blank notes', () => {
    const r = validatePaymentDraft(draft, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.referenceNo).toBe('REF123');
      expect(r.value.notes).toBeNull();
    }
  });

  it('rejects non-positive amount', () => {
    const r = validatePaymentDraft({ ...draft, amount: Money.of('0') }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_AMOUNT');
  });

  it('rejects a future paid_at', () => {
    const r = validatePaymentDraft({ ...draft, paidAt: DateOnly.of('2026-10-05') }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FUTURE_DATE');
  });
});

describe('createPayment', () => {
  it('creates an ACTIVE payment with null void fields', () => {
    const p = createPayment(draft, { id: 'p1', loanId: 'l1', userId: 'u1', now });
    expect(p.status).toBe('ACTIVE');
    expect(p.voidedAt).toBeNull();
    expect(p.voidReason).toBeNull();
    expect(p.replacedByPaymentId).toBeNull();
    expect(p.createdAt).toBe(now);
  });
});

describe('voidPayment', () => {
  const active = createPayment(draft, { id: 'p1', loanId: 'l1', userId: 'u1', now });
  const later = new Date('2026-10-05T09:00:00Z');

  it('marks VOIDED with reason, time and replacement', () => {
    const r = voidPayment(active, ' พิมพ์ยอดผิด ', later, 'p2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe('VOIDED');
      expect(r.value.voidedAt).toBe(later);
      expect(r.value.voidReason).toBe('พิมพ์ยอดผิด');
      expect(r.value.replacedByPaymentId).toBe('p2');
      expect(r.value.amount.equals(active.amount)).toBe(true);
    }
  });

  it('requires a reason', () => {
    const r = voidPayment(active, '  ', later, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('REASON_REQUIRED');
  });

  it('refuses to void twice', () => {
    const once = voidPayment(active, 'x', later, null);
    if (!once.ok) throw once.error;
    const twice = voidPayment(once.value, 'y', later, null);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.error.code).toBe('PAYMENT_ALREADY_VOIDED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- payment` → Expected: FAIL, cannot resolve `./payment`.

- [ ] **Step 3: Implement**

`src/domain/payment/payment.ts`:

```ts
import { DateOnly } from '@/domain/shared/date-only';
import { DomainError } from '@/domain/shared/errors';
import { Money } from '@/domain/shared/money';
import { err, ok, type Result } from '@/domain/shared/result';

export const PAYMENT_METHODS = ['MOBILE_BANKING', 'COUNTER', 'ATM', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentStatus = 'ACTIVE' | 'VOIDED';

export interface Payment {
  readonly id: string;
  readonly loanId: string;
  readonly userId: string;
  readonly paidAt: DateOnly;
  readonly amount: Money;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNo: string | null;
  readonly notes: string | null;
  readonly status: PaymentStatus;
  readonly voidedAt: Date | null;
  readonly voidReason: string | null;
  readonly replacedByPaymentId: string | null;
  readonly createdAt: Date;
}

export interface PaymentDraft {
  readonly paidAt: DateOnly;
  readonly amount: Money;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNo: string | null;
  readonly notes: string | null;
}

export function parsePaymentMethod(input: string): Result<PaymentMethod> {
  if ((PAYMENT_METHODS as readonly string[]).includes(input)) {
    return ok(input as PaymentMethod);
  }
  return err(new DomainError('INVALID_PAYMENT_METHOD', `ช่องทางการชำระไม่ถูกต้อง: "${input}"`));
}

export function validatePaymentDraft(draft: PaymentDraft, today: DateOnly): Result<PaymentDraft> {
  if (!draft.amount.isPositive()) {
    return err(new DomainError('INVALID_AMOUNT', 'จำนวนเงินต้องมากกว่า 0'));
  }
  if (draft.paidAt.isAfter(today)) {
    return err(new DomainError('FUTURE_DATE', 'วันที่ชำระต้องไม่เป็นวันในอนาคต'));
  }
  return ok({
    ...draft,
    referenceNo: draft.referenceNo?.trim() || null,
    notes: draft.notes?.trim() || null,
  });
}

export function createPayment(
  draft: PaymentDraft,
  ctx: { id: string; loanId: string; userId: string; now: Date },
): Payment {
  return {
    id: ctx.id,
    loanId: ctx.loanId,
    userId: ctx.userId,
    paidAt: draft.paidAt,
    amount: draft.amount,
    paymentMethod: draft.paymentMethod,
    referenceNo: draft.referenceNo,
    notes: draft.notes,
    status: 'ACTIVE',
    voidedAt: null,
    voidReason: null,
    replacedByPaymentId: null,
    createdAt: ctx.now,
  };
}

export function voidPayment(
  payment: Payment,
  reason: string,
  now: Date,
  replacedByPaymentId: string | null,
): Result<Payment> {
  if (payment.status === 'VOIDED') {
    return err(new DomainError('PAYMENT_ALREADY_VOIDED', 'รายการนี้ถูกยกเลิกไปแล้ว'));
  }
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return err(new DomainError('REASON_REQUIRED', 'กรุณาระบุเหตุผล'));
  }
  return ok({
    ...payment,
    status: 'VOIDED',
    voidedAt: now,
    voidReason: trimmed,
    replacedByPaymentId,
  });
}
```

`src/domain/payment/correction.ts`:

```ts
export interface PaymentCorrection {
  readonly id: string;
  readonly userId: string;
  readonly originalPaymentId: string;
  /** null when the payment was voided without a replacement */
  readonly replacementPaymentId: string | null;
  readonly reason: string;
  readonly createdAt: Date;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- payment` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/payment
git commit -m "feat(domain): add immutable Payment entity with void rules and PaymentCorrection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Domain — Evidence

**Files:**
- Create: `src/domain/evidence/evidence.ts`
- Test: `src/domain/evidence/evidence.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type EvidenceType = 'PAYMENT_SLIP' | 'RECEIPT' | 'OTHER'
  const ALLOWED_MIME_TYPES: readonly ['image/jpeg','image/png','image/webp','application/pdf']; type AllowedMimeType
  const MAX_EVIDENCE_BYTES = 5_242_880
  interface Evidence { id; paymentId; userId; storagePath; type; mimeType: AllowedMimeType; sizeBytes: number; originalFilename: string|null; createdAt: Date }
  validateFile(f: { mimeType: string; sizeBytes: number }): Result<AllowedMimeType>
  extensionFor(mime: AllowedMimeType): 'jpg'|'png'|'webp'|'pdf'
  evidenceDirectory(userId, paymentId): string            // "{userId}/payments/{paymentId}"
  buildStoragePath(userId, paymentId, fileId, mime): string // "{dir}/{fileId}.{ext}"
  isPathOwnedBy(path, userId, paymentId): boolean
  createEvidence(input: { id; paymentId; userId; storagePath; type; mimeType; sizeBytes; originalFilename; now }): Evidence
  copyEvidenceTo(e, newPaymentId, newId, now): Evidence   // same storagePath, new payment
  ```

- [ ] **Step 1: Write failing test**

`src/domain/evidence/evidence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_EVIDENCE_BYTES,
  buildStoragePath,
  copyEvidenceTo,
  createEvidence,
  extensionFor,
  isPathOwnedBy,
  validateFile,
} from './evidence';

describe('validateFile', () => {
  it('accepts allowed types within size', () => {
    const r = validateFile({ mimeType: 'image/jpeg', sizeBytes: 1024 });
    expect(r).toEqual({ ok: true, value: 'image/jpeg' });
  });

  it('rejects unsupported type', () => {
    const r = validateFile({ mimeType: 'image/gif', sizeBytes: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects oversize file', () => {
    const r = validateFile({ mimeType: 'application/pdf', sizeBytes: MAX_EVIDENCE_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FILE_TOO_LARGE');
  });
});

describe('storage paths', () => {
  it('builds the canonical path and recognises ownership', () => {
    const path = buildStoragePath('u1', 'p1', 'f1', 'image/png');
    expect(path).toBe('u1/payments/p1/f1.png');
    expect(isPathOwnedBy(path, 'u1', 'p1')).toBe(true);
    expect(isPathOwnedBy(path, 'u2', 'p1')).toBe(false);
    expect(isPathOwnedBy('u1/payments/p1/../p9/f.png', 'u1', 'p1')).toBe(false);
    expect(extensionFor('application/pdf')).toBe('pdf');
  });
});

describe('copyEvidenceTo', () => {
  it('reuses the file but points at the new payment', () => {
    const now = new Date('2026-10-04T00:00:00Z');
    const e = createEvidence({
      id: 'e1', paymentId: 'p1', userId: 'u1', storagePath: 'u1/payments/p1/f1.jpg',
      type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 100, originalFilename: 'slip.jpg', now,
    });
    const later = new Date('2026-10-05T00:00:00Z');
    const copy = copyEvidenceTo(e, 'p2', 'e2', later);
    expect(copy.id).toBe('e2');
    expect(copy.paymentId).toBe('p2');
    expect(copy.storagePath).toBe(e.storagePath);
    expect(copy.createdAt).toBe(later);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- evidence` → Expected: FAIL, cannot resolve `./evidence`.

- [ ] **Step 3: Implement**

`src/domain/evidence/evidence.ts`:

```ts
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';

export type EvidenceType = 'PAYMENT_SLIP' | 'RECEIPT' | 'OTHER';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_EVIDENCE_BYTES = 5_242_880;

export interface Evidence {
  readonly id: string;
  readonly paymentId: string;
  readonly userId: string;
  readonly storagePath: string;
  readonly type: EvidenceType;
  readonly mimeType: AllowedMimeType;
  readonly sizeBytes: number;
  readonly originalFilename: string | null;
  readonly createdAt: Date;
}

export function validateFile(file: { mimeType: string; sizeBytes: number }): Result<AllowedMimeType> {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
    return err(new DomainError('UNSUPPORTED_FILE_TYPE', 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF'));
  }
  if (file.sizeBytes > MAX_EVIDENCE_BYTES) {
    return err(new DomainError('FILE_TOO_LARGE', 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB'));
  }
  return ok(file.mimeType as AllowedMimeType);
}

export function extensionFor(mime: AllowedMimeType): 'jpg' | 'png' | 'webp' | 'pdf' {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
  }
}

export function evidenceDirectory(userId: string, paymentId: string): string {
  return `${userId}/payments/${paymentId}`;
}

export function buildStoragePath(userId: string, paymentId: string, fileId: string, mime: AllowedMimeType): string {
  return `${evidenceDirectory(userId, paymentId)}/${fileId}.${extensionFor(mime)}`;
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+\.(jpg|png|webp|pdf)$/;

export function isPathOwnedBy(path: string, userId: string, paymentId: string): boolean {
  const prefix = `${evidenceDirectory(userId, paymentId)}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return SAFE_SEGMENT.test(rest);
}

export function createEvidence(input: {
  id: string;
  paymentId: string;
  userId: string;
  storagePath: string;
  type: EvidenceType;
  mimeType: AllowedMimeType;
  sizeBytes: number;
  originalFilename: string | null;
  now: Date;
}): Evidence {
  return {
    id: input.id,
    paymentId: input.paymentId,
    userId: input.userId,
    storagePath: input.storagePath,
    type: input.type,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    originalFilename: input.originalFilename,
    createdAt: input.now,
  };
}

export function copyEvidenceTo(evidence: Evidence, newPaymentId: string, newId: string, now: Date): Evidence {
  return { ...evidence, id: newId, paymentId: newPaymentId, createdAt: now };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- evidence` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/evidence
git commit -m "feat(domain): add Evidence entity, file validation and storage path rules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Domain — Ledger math (balance, timeline, dashboard)

**Files:**
- Create: `src/domain/ledger/ledger.ts`
- Test: `src/domain/ledger/ledger.test.ts`

**Interfaces:**
- Produces:
  ```ts
  countsTowardBalance(loan, p): boolean
  sortChronologically(payments): Payment[]          // paidAt asc, then createdAt asc
  computeLedgerBalance(loan, payments): Money
  interface TimelineRow { payment: Payment; balanceAfter: Money | null }
  interface TimelineGroup { year: number; month: number; rows: TimelineRow[] }   // newest group/rows first
  buildTimeline(loan, payments, opts?: { includeVoided?: boolean }): TimelineGroup[]
  interface DashboardSummary { ledgerBalance: Money; totalPaid: Money; paymentCount: number; latestPayment: Payment | null }
  computeDashboard(loan, payments): DashboardSummary
  ```

- [ ] **Step 1: Write failing test**

`src/domain/ledger/ledger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLoan, type Loan } from '@/domain/loan/loan';
import { createPayment, voidPayment, type Payment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { buildTimeline, computeDashboard, computeLedgerBalance } from './ledger';

const loan: Loan = createLoan(
  {
    name: 'กยศ.', loanNumber: null, openingBalance: Money.of('195420.50'),
    openingBalanceDate: DateOnly.of('2026-06-30'), defaultAmount: Money.of('3000'),
  },
  { id: 'l1', userId: 'u1', now: new Date('2026-06-30T00:00:00Z') },
);

function pay(id: string, paidAt: string, amount: string, createdAt = `${paidAt}T08:00:00Z`): Payment {
  return createPayment(
    { paidAt: DateOnly.of(paidAt), amount: Money.of(amount), paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null },
    { id, loanId: 'l1', userId: 'u1', now: new Date(createdAt) },
  );
}

describe('computeLedgerBalance', () => {
  it('subtracts only ACTIVE payments after the opening date', () => {
    const before = pay('p0', '2026-06-04', '3000');      // on/before opening date: ignored
    const onDate = pay('p1', '2026-06-30', '3000');      // same day as opening: ignored
    const jul = pay('p2', '2026-07-04', '3000');
    const aug = pay('p3', '2026-08-04', '3000');
    const voidedRes = voidPayment(pay('p4', '2026-09-04', '3000'), 'ผิด', new Date(), null);
    if (!voidedRes.ok) throw voidedRes.error;
    const balance = computeLedgerBalance(loan, [before, onDate, jul, aug, voidedRes.value]);
    expect(balance.toString()).toBe('189420.50');
  });

  it('returns the opening balance when there are no payments', () => {
    expect(computeLedgerBalance(loan, []).toString()).toBe('195420.50');
  });
});

describe('buildTimeline', () => {
  const jul = pay('p2', '2026-07-04', '3000');
  const aug = pay('p3', '2026-08-04', '3000');
  const augLater = pay('p5', '2026-08-04', '500', '2026-08-04T20:00:00Z');
  const old = pay('p0', '2026-06-04', '3000');
  const voidedRes = voidPayment(pay('p4', '2026-09-04', '3000'), 'ผิด', new Date(), null);
  if (!voidedRes.ok) throw voidedRes.error;
  const all = [aug, old, voidedRes.value, jul, augLater];

  it('groups by month newest first and carries a running balance', () => {
    const groups = buildTimeline(loan, all);
    expect(groups.map((g) => `${g.year}-${g.month}`)).toEqual(['2026-8', '2026-7', '2026-6']);
    const augRows = groups[0]!.rows;
    expect(augRows.map((r) => r.payment.id)).toEqual(['p5', 'p3']);
    expect(augRows[0]!.balanceAfter?.toString()).toBe('188920.50');
    expect(augRows[1]!.balanceAfter?.toString()).toBe('189420.50');
    expect(groups[1]!.rows[0]!.balanceAfter?.toString()).toBe('192420.50');
  });

  it('shows null balance for payments on/before the opening date', () => {
    const groups = buildTimeline(loan, all);
    expect(groups[2]!.rows[0]!.payment.id).toBe('p0');
    expect(groups[2]!.rows[0]!.balanceAfter).toBeNull();
  });

  it('hides voided rows by default and includes them on request with null balance', () => {
    expect(buildTimeline(loan, all).flatMap((g) => g.rows).some((r) => r.payment.id === 'p4')).toBe(false);
    const withVoided = buildTimeline(loan, all, { includeVoided: true });
    const row = withVoided.flatMap((g) => g.rows).find((r) => r.payment.id === 'p4');
    expect(row?.balanceAfter).toBeNull();
    expect(withVoided[0]!.month).toBe(9);
  });
});

describe('computeDashboard', () => {
  it('totals ACTIVE payments regardless of date and picks the latest', () => {
    const old = pay('p0', '2026-06-04', '3000');
    const jul = pay('p2', '2026-07-04', '3000');
    const voidedRes = voidPayment(pay('p4', '2026-09-04', '3000'), 'ผิด', new Date(), null);
    if (!voidedRes.ok) throw voidedRes.error;
    const s = computeDashboard(loan, [voidedRes.value, old, jul]);
    expect(s.ledgerBalance.toString()).toBe('192420.50');
    expect(s.totalPaid.toString()).toBe('6000.00');
    expect(s.paymentCount).toBe(2);
    expect(s.latestPayment?.id).toBe('p2');
  });

  it('handles no payments', () => {
    const s = computeDashboard(loan, []);
    expect(s.totalPaid.isZero()).toBe(true);
    expect(s.paymentCount).toBe(0);
    expect(s.latestPayment).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- ledger` → Expected: FAIL, cannot resolve `./ledger`.

- [ ] **Step 3: Implement**

`src/domain/ledger/ledger.ts`:

```ts
import type { Loan } from '@/domain/loan/loan';
import type { Payment } from '@/domain/payment/payment';
import { Money } from '@/domain/shared/money';

export interface TimelineRow {
  readonly payment: Payment;
  /** Ledger balance right after this payment; null when it does not count toward the balance. */
  readonly balanceAfter: Money | null;
}

export interface TimelineGroup {
  readonly year: number;
  readonly month: number;
  readonly rows: TimelineRow[];
}

export interface DashboardSummary {
  readonly ledgerBalance: Money;
  readonly totalPaid: Money;
  readonly paymentCount: number;
  readonly latestPayment: Payment | null;
}

export function countsTowardBalance(loan: Loan, payment: Payment): boolean {
  return payment.status === 'ACTIVE' && payment.paidAt.isAfter(loan.openingBalanceDate);
}

export function sortChronologically(payments: readonly Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const byDate = a.paidAt.compare(b.paidAt);
    if (byDate !== 0) return byDate;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function computeLedgerBalance(loan: Loan, payments: readonly Payment[]): Money {
  return payments
    .filter((p) => countsTowardBalance(loan, p))
    .reduce((balance, p) => balance.subtract(p.amount), loan.openingBalance);
}

export function buildTimeline(
  loan: Loan,
  payments: readonly Payment[],
  opts: { includeVoided?: boolean } = {},
): TimelineGroup[] {
  const includeVoided = opts.includeVoided ?? false;
  let running = loan.openingBalance;
  const rows: TimelineRow[] = [];

  for (const payment of sortChronologically(payments)) {
    let balanceAfter: Money | null = null;
    if (countsTowardBalance(loan, payment)) {
      running = running.subtract(payment.amount);
      balanceAfter = running;
    }
    if (payment.status === 'VOIDED' && !includeVoided) continue;
    rows.push({ payment, balanceAfter });
  }

  rows.reverse();

  const groups: TimelineGroup[] = [];
  for (const row of rows) {
    const { year, month } = row.payment.paidAt;
    const last = groups[groups.length - 1];
    if (last && last.year === year && last.month === month) {
      last.rows.push(row);
    } else {
      groups.push({ year, month, rows: [row] });
    }
  }
  return groups;
}

export function computeDashboard(loan: Loan, payments: readonly Payment[]): DashboardSummary {
  const active = sortChronologically(payments.filter((p) => p.status === 'ACTIVE'));
  return {
    ledgerBalance: computeLedgerBalance(loan, payments),
    totalPaid: active.reduce((sum, p) => sum.add(p.amount), Money.zero()),
    paymentCount: active.length,
    latestPayment: active.length > 0 ? active[active.length - 1]! : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- ledger` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ledger
git commit -m "feat(domain): add ledger balance, timeline and dashboard calculations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Application ports and in-memory test doubles

**Files:**
- Create: `src/application/ports/repositories.ts`, `src/application/ports/file-storage.ts`, `src/application/ports/system.ts`, `src/application/ports/unit-of-work.ts`, `src/application/testing/in-memory.ts`
- Test: `src/application/testing/in-memory.test.ts`
- Delete: `src/application/.gitkeep`

**Interfaces:**
- Produces (all later use cases and infrastructure implement/consume exactly these):
  ```ts
  interface LoanRepository { findByUserId(userId): Promise<Loan|null>; findById(id, userId): Promise<Loan|null>; save(loan): Promise<void> /* upsert */ }
  interface PaymentRepository { findById(id, userId): Promise<Payment|null>; listByLoan(loanId, userId): Promise<Payment[]>; findLatestActive(loanId, userId): Promise<Payment|null>; insert(p): Promise<void>; markVoided(p): Promise<void> }
  interface EvidenceRepository { findById(id, userId): Promise<Evidence|null>; listByPayment(paymentId, userId): Promise<Evidence[]>; insertMany(items): Promise<void>; countByPaymentIds(ids, userId): Promise<Record<string, number>> }
  interface CorrectionRepository { insert(c): Promise<void>; findByReplacement(replacementPaymentId, userId): Promise<PaymentCorrection|null> }
  interface Repositories { loans; payments; evidence; corrections }
  interface FileStorage { createSignedUploadUrl(path): Promise<{ url: string; token: string }>; createSignedReadUrl(path, expiresInSeconds): Promise<string>; delete(paths: string[]): Promise<void>; exists(path): Promise<boolean> }
  interface Clock { now(): Date; today(): DateOnly }
  interface IdGenerator { next(): string }
  interface UnitOfWork { run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> }
  // testing
  class InMemoryLoanRepository, InMemoryPaymentRepository (failOnInsert flag), InMemoryEvidenceRepository, InMemoryCorrectionRepository, InMemoryFileStorage (files: Set<string>, deleted: string[]), FixedClock(now: Date, today: DateOnly), SequenceIdGenerator ('id-1', 'id-2', …), InMemoryUnitOfWork
  makeTestContext(opts?: { now?: Date; today?: DateOnly }): { repos, uow, storage, clock, ids }
  ```

- [ ] **Step 1: Write failing test**

`src/application/testing/in-memory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLoan } from '@/domain/loan/loan';
import { createPayment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { makeTestContext } from './in-memory';

describe('in-memory test doubles', () => {
  it('scopes reads by userId and sorts latest active payment', async () => {
    const { repos, clock, ids } = makeTestContext();
    const loan = createLoan(
      { name: 'x', loanNumber: null, openingBalance: Money.of('10'), openingBalanceDate: DateOnly.of('2026-01-01'), defaultAmount: null },
      { id: ids.next(), userId: 'u1', now: clock.now() },
    );
    await repos.loans.save(loan);
    expect(await repos.loans.findByUserId('u1')).toEqual(loan);
    expect(await repos.loans.findByUserId('u2')).toBeNull();

    const mk = (id: string, paidAt: string) =>
      createPayment(
        { paidAt: DateOnly.of(paidAt), amount: Money.of('1'), paymentMethod: 'ATM', referenceNo: null, notes: null },
        { id, loanId: loan.id, userId: 'u1', now: clock.now() },
      );
    await repos.payments.insert(mk('a', '2026-02-01'));
    await repos.payments.insert(mk('b', '2026-03-01'));
    expect((await repos.payments.findLatestActive(loan.id, 'u1'))?.id).toBe('b');
    expect(await repos.payments.findById('a', 'u2')).toBeNull();
  });

  it('counts evidence per payment and tracks storage deletes', async () => {
    const { repos, storage } = makeTestContext();
    await repos.evidence.insertMany([
      { id: 'e1', paymentId: 'p1', userId: 'u1', storagePath: 'u1/payments/p1/a.jpg', type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null, createdAt: new Date() },
      { id: 'e2', paymentId: 'p1', userId: 'u1', storagePath: 'u1/payments/p1/b.jpg', type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null, createdAt: new Date() },
    ]);
    expect(await repos.evidence.countByPaymentIds(['p1', 'p2'], 'u1')).toEqual({ p1: 2 });
    storage.files.add('u1/payments/p1/a.jpg');
    await storage.delete(['u1/payments/p1/a.jpg']);
    expect(await storage.exists('u1/payments/p1/a.jpg')).toBe(false);
    expect(storage.deleted).toEqual(['u1/payments/p1/a.jpg']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- in-memory` → Expected: FAIL, cannot resolve `./in-memory`.

- [ ] **Step 3: Implement ports**

`src/application/ports/repositories.ts`:

```ts
import type { Evidence } from '@/domain/evidence/evidence';
import type { Loan } from '@/domain/loan/loan';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { Payment } from '@/domain/payment/payment';

export interface LoanRepository {
  findByUserId(userId: string): Promise<Loan | null>;
  findById(id: string, userId: string): Promise<Loan | null>;
  /** Insert or update by id. */
  save(loan: Loan): Promise<void>;
}

export interface PaymentRepository {
  findById(id: string, userId: string): Promise<Payment | null>;
  listByLoan(loanId: string, userId: string): Promise<Payment[]>;
  /** Latest ACTIVE payment by paidAt then createdAt. */
  findLatestActive(loanId: string, userId: string): Promise<Payment | null>;
  insert(payment: Payment): Promise<void>;
  /** Persist status/voidedAt/voidReason/replacedByPaymentId of an already-stored payment. */
  markVoided(payment: Payment): Promise<void>;
}

export interface EvidenceRepository {
  findById(id: string, userId: string): Promise<Evidence | null>;
  listByPayment(paymentId: string, userId: string): Promise<Evidence[]>;
  insertMany(items: readonly Evidence[]): Promise<void>;
  countByPaymentIds(paymentIds: readonly string[], userId: string): Promise<Record<string, number>>;
}

export interface CorrectionRepository {
  insert(correction: PaymentCorrection): Promise<void>;
  findByReplacement(replacementPaymentId: string, userId: string): Promise<PaymentCorrection | null>;
}

export interface Repositories {
  readonly loans: LoanRepository;
  readonly payments: PaymentRepository;
  readonly evidence: EvidenceRepository;
  readonly corrections: CorrectionRepository;
}
```

`src/application/ports/file-storage.ts`:

```ts
export interface SignedUpload {
  readonly url: string;
  readonly token: string;
}

export interface FileStorage {
  createSignedUploadUrl(path: string): Promise<SignedUpload>;
  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string>;
  delete(paths: readonly string[]): Promise<void>;
  exists(path: string): Promise<boolean>;
}
```

`src/application/ports/system.ts`:

```ts
import type { DateOnly } from '@/domain/shared/date-only';

export interface Clock {
  now(): Date;
  today(): DateOnly;
}

export interface IdGenerator {
  next(): string;
}
```

`src/application/ports/unit-of-work.ts`:

```ts
import type { Repositories } from './repositories';

export interface UnitOfWork {
  /** Runs fn inside one transaction; any thrown error rolls back. */
  run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
}
```

- [ ] **Step 4: Implement in-memory doubles**

`src/application/testing/in-memory.ts`:

```ts
import type { Evidence } from '@/domain/evidence/evidence';
import type { Loan } from '@/domain/loan/loan';
import { sortChronologically } from '@/domain/ledger/ledger';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { Payment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import type { FileStorage, SignedUpload } from '@/application/ports/file-storage';
import type {
  CorrectionRepository,
  EvidenceRepository,
  LoanRepository,
  PaymentRepository,
  Repositories,
} from '@/application/ports/repositories';
import type { Clock, IdGenerator } from '@/application/ports/system';
import type { UnitOfWork } from '@/application/ports/unit-of-work';

export class InMemoryLoanRepository implements LoanRepository {
  readonly loans = new Map<string, Loan>();

  async findByUserId(userId: string): Promise<Loan | null> {
    return [...this.loans.values()].find((l) => l.userId === userId) ?? null;
  }

  async findById(id: string, userId: string): Promise<Loan | null> {
    const loan = this.loans.get(id);
    return loan && loan.userId === userId ? loan : null;
  }

  async save(loan: Loan): Promise<void> {
    this.loans.set(loan.id, loan);
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly payments = new Map<string, Payment>();
  failOnInsert = false;

  async findById(id: string, userId: string): Promise<Payment | null> {
    const p = this.payments.get(id);
    return p && p.userId === userId ? p : null;
  }

  async listByLoan(loanId: string, userId: string): Promise<Payment[]> {
    return [...this.payments.values()].filter((p) => p.loanId === loanId && p.userId === userId);
  }

  async findLatestActive(loanId: string, userId: string): Promise<Payment | null> {
    const active = (await this.listByLoan(loanId, userId)).filter((p) => p.status === 'ACTIVE');
    const sorted = sortChronologically(active);
    return sorted.length > 0 ? sorted[sorted.length - 1]! : null;
  }

  async insert(payment: Payment): Promise<void> {
    if (this.failOnInsert) throw new Error('simulated insert failure');
    if (this.payments.has(payment.id)) throw new Error(`duplicate payment id ${payment.id}`);
    this.payments.set(payment.id, payment);
  }

  async markVoided(payment: Payment): Promise<void> {
    if (!this.payments.has(payment.id)) throw new Error(`unknown payment ${payment.id}`);
    this.payments.set(payment.id, payment);
  }
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  readonly items = new Map<string, Evidence>();

  async findById(id: string, userId: string): Promise<Evidence | null> {
    const e = this.items.get(id);
    return e && e.userId === userId ? e : null;
  }

  async listByPayment(paymentId: string, userId: string): Promise<Evidence[]> {
    return [...this.items.values()].filter((e) => e.paymentId === paymentId && e.userId === userId);
  }

  async insertMany(items: readonly Evidence[]): Promise<void> {
    for (const e of items) this.items.set(e.id, e);
  }

  async countByPaymentIds(paymentIds: readonly string[], userId: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const e of this.items.values()) {
      if (e.userId === userId && paymentIds.includes(e.paymentId)) {
        counts[e.paymentId] = (counts[e.paymentId] ?? 0) + 1;
      }
    }
    return counts;
  }
}

export class InMemoryCorrectionRepository implements CorrectionRepository {
  readonly items: PaymentCorrection[] = [];

  async insert(correction: PaymentCorrection): Promise<void> {
    this.items.push(correction);
  }

  async findByReplacement(replacementPaymentId: string, userId: string): Promise<PaymentCorrection | null> {
    return this.items.find((c) => c.replacementPaymentId === replacementPaymentId && c.userId === userId) ?? null;
  }
}

export class InMemoryFileStorage implements FileStorage {
  readonly files = new Set<string>();
  readonly deleted: string[] = [];

  async createSignedUploadUrl(path: string): Promise<SignedUpload> {
    return { url: `memory://upload/${path}`, token: `token-${path}` };
  }

  async createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
    return `memory://read/${path}?expires=${expiresInSeconds}`;
  }

  async delete(paths: readonly string[]): Promise<void> {
    for (const p of paths) {
      this.files.delete(p);
      this.deleted.push(p);
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

export class FixedClock implements Clock {
  constructor(
    private readonly fixedNow: Date,
    private readonly fixedToday: DateOnly,
  ) {}

  now(): Date {
    return this.fixedNow;
  }

  today(): DateOnly {
    return this.fixedToday;
  }
}

export class SequenceIdGenerator implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}

  async run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    return fn(this.repos);
  }
}

export interface TestContext {
  repos: {
    loans: InMemoryLoanRepository;
    payments: InMemoryPaymentRepository;
    evidence: InMemoryEvidenceRepository;
    corrections: InMemoryCorrectionRepository;
  };
  uow: InMemoryUnitOfWork;
  storage: InMemoryFileStorage;
  clock: FixedClock;
  ids: SequenceIdGenerator;
}

export function makeTestContext(opts: { now?: Date; today?: DateOnly } = {}): TestContext {
  const repos = {
    loans: new InMemoryLoanRepository(),
    payments: new InMemoryPaymentRepository(),
    evidence: new InMemoryEvidenceRepository(),
    corrections: new InMemoryCorrectionRepository(),
  };
  return {
    repos,
    uow: new InMemoryUnitOfWork(repos),
    storage: new InMemoryFileStorage(),
    clock: new FixedClock(opts.now ?? new Date('2026-10-04T09:00:00Z'), opts.today ?? DateOnly.of('2026-10-04')),
    ids: new SequenceIdGenerator(),
  };
}
```

- [ ] **Step 5: Run tests and lint**

Run: `npm run test -- in-memory` → Expected: PASS.
Run: `npm run lint` → Expected: pass (application imports only domain/application).

- [ ] **Step 6: Commit**

```bash
rm -f src/application/.gitkeep
git add src/application
git commit -m "feat(application): define repository, storage, clock and unit-of-work ports with in-memory doubles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 8: Use cases — SetupLoan, UpdateLoan, GetLoan

**Files:**
- Create: `src/application/use-cases/loan/parse-loan-input.ts`, `src/application/use-cases/loan/setup-loan.ts`, `src/application/use-cases/loan/update-loan.ts`, `src/application/use-cases/loan/get-loan.ts`
- Test: `src/application/use-cases/loan/loan-use-cases.test.ts`

**Interfaces:**
- Consumes: ports from Task 7, `validateLoanDraft/createLoan/applyLoanUpdate` from Task 3.
- Produces:
  ```ts
  interface LoanInput { name: string; loanNumber: string|null; openingBalance: string; openingBalanceDate: string; defaultAmount: string|null }
  parseLoanInput(input: LoanInput): Result<LoanDraft>
  class SetupLoan { constructor(loans: LoanRepository, ids: IdGenerator, clock: Clock); execute(input: LoanInput & { userId }): Promise<Result<{ loanId: string }>> }   // LOAN_ALREADY_EXISTS
  class UpdateLoan { constructor(loans, clock); execute(input: LoanInput & { userId; loanId }): Promise<Result<void>> }   // LOAN_NOT_FOUND
  class GetLoan { constructor(loans); execute(userId): Promise<Loan | null> }
  ```

- [ ] **Step 1: Write failing test**

`src/application/use-cases/loan/loan-use-cases.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { GetLoan } from './get-loan';
import { SetupLoan } from './setup-loan';
import { UpdateLoan } from './update-loan';

const input = {
  userId: 'u1',
  name: 'กยศ. ของฉัน',
  loanNumber: null,
  openingBalance: '195,420.50',
  openingBalanceDate: '2026-06-30',
  defaultAmount: '3000',
};

describe('loan use cases', () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = makeTestContext();
  });

  it('SetupLoan creates one loan per user', async () => {
    const setup = new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock);
    const r = await setup.execute(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const loan = await new GetLoan(ctx.repos.loans).execute('u1');
    expect(loan?.id).toBe(r.value.loanId);
    expect(loan?.openingBalance.toString()).toBe('195420.50');
    expect(loan?.defaultAmount?.toString()).toBe('3000.00');

    const again = await setup.execute(input);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('LOAN_ALREADY_EXISTS');
  });

  it('SetupLoan rejects invalid money / date / name', async () => {
    const setup = new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock);
    const badMoney = await setup.execute({ ...input, openingBalance: 'abc' });
    expect(badMoney.ok).toBe(false);
    if (!badMoney.ok) expect(badMoney.error.code).toBe('INVALID_AMOUNT');
    const badDate = await setup.execute({ ...input, openingBalanceDate: '30/06/2026' });
    if (!badDate.ok) expect(badDate.error.code).toBe('INVALID_DATE');
    const badName = await setup.execute({ ...input, name: '' });
    if (!badName.ok) expect(badName.error.code).toBe('INVALID_NAME');
  });

  it('UpdateLoan changes fields and rejects unknown loan', async () => {
    const setup = new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock);
    const created = await setup.execute(input);
    if (!created.ok) throw created.error;
    const update = new UpdateLoan(ctx.repos.loans, ctx.clock);
    const r = await update.execute({ ...input, loanId: created.value.loanId, name: 'เปลี่ยนชื่อ', defaultAmount: null });
    expect(r.ok).toBe(true);
    const loan = await new GetLoan(ctx.repos.loans).execute('u1');
    expect(loan?.name).toBe('เปลี่ยนชื่อ');
    expect(loan?.defaultAmount).toBeNull();

    const missing = await update.execute({ ...input, loanId: 'nope' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('LOAN_NOT_FOUND');
    const otherUser = await update.execute({ ...input, loanId: created.value.loanId, userId: 'u2' });
    expect(otherUser.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- loan-use-cases` → Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement**

`src/application/use-cases/loan/parse-loan-input.ts`:

```ts
import { validateLoanDraft, type LoanDraft } from '@/domain/loan/loan';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { err, type Result } from '@/domain/shared/result';

export interface LoanInput {
  readonly name: string;
  readonly loanNumber: string | null;
  readonly openingBalance: string;
  readonly openingBalanceDate: string;
  readonly defaultAmount: string | null;
}

export function parseLoanInput(input: LoanInput): Result<LoanDraft> {
  const openingBalance = Money.parse(input.openingBalance);
  if (!openingBalance.ok) return err(openingBalance.error);

  const openingBalanceDate = DateOnly.parse(input.openingBalanceDate);
  if (!openingBalanceDate.ok) return err(openingBalanceDate.error);

  let defaultAmount: Money | null = null;
  if (input.defaultAmount && input.defaultAmount.trim() !== '') {
    const parsed = Money.parse(input.defaultAmount);
    if (!parsed.ok) return err(parsed.error);
    defaultAmount = parsed.value;
  }

  return validateLoanDraft({
    name: input.name,
    loanNumber: input.loanNumber,
    openingBalance: openingBalance.value,
    openingBalanceDate: openingBalanceDate.value,
    defaultAmount,
  });
}
```

`src/application/use-cases/loan/setup-loan.ts`:

```ts
import { createLoan } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { LoanRepository } from '@/application/ports/repositories';
import type { Clock, IdGenerator } from '@/application/ports/system';
import { parseLoanInput, type LoanInput } from './parse-loan-input';

export class SetupLoan {
  constructor(
    private readonly loans: LoanRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoanInput & { userId: string }): Promise<Result<{ loanId: string }>> {
    const existing = await this.loans.findByUserId(input.userId);
    if (existing) {
      return err(new DomainError('LOAN_ALREADY_EXISTS', 'มีข้อมูลเงินกู้อยู่แล้ว'));
    }
    const draft = parseLoanInput(input);
    if (!draft.ok) return err(draft.error);

    const loan = createLoan(draft.value, { id: this.ids.next(), userId: input.userId, now: this.clock.now() });
    await this.loans.save(loan);
    return ok({ loanId: loan.id });
  }
}
```

`src/application/use-cases/loan/update-loan.ts`:

```ts
import { applyLoanUpdate } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { LoanRepository } from '@/application/ports/repositories';
import type { Clock } from '@/application/ports/system';
import { parseLoanInput, type LoanInput } from './parse-loan-input';

export class UpdateLoan {
  constructor(
    private readonly loans: LoanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoanInput & { userId: string; loanId: string }): Promise<Result<void>> {
    const loan = await this.loans.findById(input.loanId, input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));

    const draft = parseLoanInput(input);
    if (!draft.ok) return err(draft.error);

    await this.loans.save(applyLoanUpdate(loan, draft.value, this.clock.now()));
    return ok(undefined);
  }
}
```

`src/application/use-cases/loan/get-loan.ts`:

```ts
import type { Loan } from '@/domain/loan/loan';
import type { LoanRepository } from '@/application/ports/repositories';

export class GetLoan {
  constructor(private readonly loans: LoanRepository) {}

  execute(userId: string): Promise<Loan | null> {
    return this.loans.findByUserId(userId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- loan-use-cases` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/loan
git commit -m "feat(application): add SetupLoan, UpdateLoan and GetLoan use cases

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Use cases — PrepareEvidenceUpload and RecordPayment

**Files:**
- Create: `src/application/use-cases/payment/parse-payment-input.ts`, `src/application/use-cases/payment/evidence-input.ts`, `src/application/use-cases/payment/prepare-evidence-upload.ts`, `src/application/use-cases/payment/record-payment.ts`
- Test: `src/application/use-cases/payment/record-payment.test.ts`

**Interfaces:**
- Consumes: Task 4 payment functions, Task 5 evidence functions, Task 7 ports.
- Produces:
  ```ts
  interface PaymentInput { paidAt: string; amount: string; paymentMethod: string; referenceNo: string|null; notes: string|null }
  parsePaymentInput(input, today: DateOnly): Result<PaymentDraft>
  interface UploadedEvidenceInput { fileId: string; storagePath: string; mimeType: string; sizeBytes: number; originalFilename: string|null }
  buildEvidenceList(items, ctx: { userId; paymentId; now; ids }): Result<Evidence[]>   // validates each file and path ownership; type = PAYMENT_SLIP
  class PrepareEvidenceUpload { constructor(storage: FileStorage, ids: IdGenerator); execute(input: { userId; paymentId: string|null; mimeType; sizeBytes }): Promise<Result<{ paymentId; fileId; storagePath; uploadUrl; token }>> }
  class RecordPayment { constructor(loans, uow, storage, ids, clock); execute(input: PaymentInput & { userId; loanId; paymentId: string|null; evidence: UploadedEvidenceInput[] }): Promise<Result<{ paymentId }>> }
  ```

- [ ] **Step 1: Write failing test**

`src/application/use-cases/payment/record-payment.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { PrepareEvidenceUpload } from './prepare-evidence-upload';
import { RecordPayment } from './record-payment';

describe('RecordPayment', () => {
  let ctx: TestContext;
  let loanId: string;

  beforeEach(async () => {
    ctx = makeTestContext();
    const r = await new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock).execute({
      userId: 'u1', name: 'กยศ.', loanNumber: null, openingBalance: '195420.50', openingBalanceDate: '2026-06-30', defaultAmount: '3000',
    });
    if (!r.ok) throw r.error;
    loanId = r.value.loanId;
  });

  const base = {
    userId: 'u1',
    paidAt: '2026-10-04',
    amount: '3,000',
    paymentMethod: 'MOBILE_BANKING',
    referenceNo: 'REF1',
    notes: 'ชำระงวดเดือน ต.ค. 2569',
  };

  it('records a payment with uploaded evidence in one unit of work', async () => {
    const prepare = new PrepareEvidenceUpload(ctx.storage, ctx.ids);
    const prepared = await prepare.execute({ userId: 'u1', paymentId: null, mimeType: 'image/jpeg', sizeBytes: 1000 });
    if (!prepared.ok) throw prepared.error;
    expect(prepared.value.storagePath).toBe(`u1/payments/${prepared.value.paymentId}/${prepared.value.fileId}.jpg`);
    expect(prepared.value.uploadUrl).toContain(prepared.value.storagePath);

    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base,
      loanId,
      paymentId: prepared.value.paymentId,
      evidence: [{ fileId: prepared.value.fileId, storagePath: prepared.value.storagePath, mimeType: 'image/jpeg', sizeBytes: 1000, originalFilename: 'slip.jpg' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.paymentId).toBe(prepared.value.paymentId);
    const stored = await ctx.repos.payments.findById(r.value.paymentId, 'u1');
    expect(stored?.amount.toString()).toBe('3000.00');
    expect(stored?.status).toBe('ACTIVE');
    const evidence = await ctx.repos.evidence.listByPayment(r.value.paymentId, 'u1');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.type).toBe('PAYMENT_SLIP');
  });

  it('records without evidence and generates a payment id', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({ ...base, loanId, paymentId: null, evidence: [] });
    expect(r.ok).toBe(true);
  });

  it('rejects evidence paths that belong to another user or payment', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base, loanId, paymentId: 'p-mine',
      evidence: [{ fileId: 'f', storagePath: 'u2/payments/p-mine/f.jpg', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_EVIDENCE_PATH');
  });

  it('rejects unknown loan, bad method, future date', async () => {
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const noLoan = await record.execute({ ...base, loanId: 'x', paymentId: null, evidence: [] });
    if (!noLoan.ok) expect(noLoan.error.code).toBe('LOAN_NOT_FOUND');
    const badMethod = await record.execute({ ...base, loanId, paymentId: null, evidence: [], paymentMethod: 'CASH' });
    if (!badMethod.ok) expect(badMethod.error.code).toBe('INVALID_PAYMENT_METHOD');
    const future = await record.execute({ ...base, loanId, paymentId: null, evidence: [], paidAt: '2026-10-05' });
    if (!future.ok) expect(future.error.code).toBe('FUTURE_DATE');
    expect([noLoan.ok, badMethod.ok, future.ok]).toEqual([false, false, false]);
  });

  it('deletes uploaded files when persistence fails', async () => {
    ctx.repos.payments.failOnInsert = true;
    const path = 'u1/payments/p1/f1.jpg';
    ctx.storage.files.add(path);
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const r = await record.execute({
      ...base, loanId, paymentId: 'p1',
      evidence: [{ fileId: 'f1', storagePath: path, mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PERSISTENCE_FAILED');
    expect(ctx.storage.deleted).toEqual([path]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- record-payment` → Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement**

`src/application/use-cases/payment/parse-payment-input.ts`:

```ts
import { parsePaymentMethod, validatePaymentDraft, type PaymentDraft } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { err, type Result } from '@/domain/shared/result';

export interface PaymentInput {
  readonly paidAt: string;
  readonly amount: string;
  readonly paymentMethod: string;
  readonly referenceNo: string | null;
  readonly notes: string | null;
}

export function parsePaymentInput(input: PaymentInput, today: DateOnly): Result<PaymentDraft> {
  const paidAt = DateOnly.parse(input.paidAt);
  if (!paidAt.ok) return err(paidAt.error);
  const amount = Money.parse(input.amount);
  if (!amount.ok) return err(amount.error);
  const method = parsePaymentMethod(input.paymentMethod);
  if (!method.ok) return err(method.error);

  return validatePaymentDraft(
    {
      paidAt: paidAt.value,
      amount: amount.value,
      paymentMethod: method.value,
      referenceNo: input.referenceNo,
      notes: input.notes,
    },
    today,
  );
}
```

`src/application/use-cases/payment/evidence-input.ts`:

```ts
import { createEvidence, isPathOwnedBy, validateFile, type Evidence } from '@/domain/evidence/evidence';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { IdGenerator } from '@/application/ports/system';

export interface UploadedEvidenceInput {
  readonly fileId: string;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly originalFilename: string | null;
}

export function buildEvidenceList(
  items: readonly UploadedEvidenceInput[],
  ctx: { userId: string; paymentId: string; now: Date; ids: IdGenerator },
): Result<Evidence[]> {
  const result: Evidence[] = [];
  for (const item of items) {
    const mime = validateFile(item);
    if (!mime.ok) return err(mime.error);
    if (!isPathOwnedBy(item.storagePath, ctx.userId, ctx.paymentId)) {
      return err(new DomainError('INVALID_EVIDENCE_PATH', 'ตำแหน่งไฟล์ไม่ถูกต้อง'));
    }
    result.push(
      createEvidence({
        id: ctx.ids.next(),
        paymentId: ctx.paymentId,
        userId: ctx.userId,
        storagePath: item.storagePath,
        type: 'PAYMENT_SLIP',
        mimeType: mime.value,
        sizeBytes: item.sizeBytes,
        originalFilename: item.originalFilename,
        now: ctx.now,
      }),
    );
  }
  return ok(result);
}
```

`src/application/use-cases/payment/prepare-evidence-upload.ts`:

```ts
import { buildStoragePath, validateFile } from '@/domain/evidence/evidence';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { FileStorage } from '@/application/ports/file-storage';
import type { IdGenerator } from '@/application/ports/system';

export interface PreparedUpload {
  readonly paymentId: string;
  readonly fileId: string;
  readonly storagePath: string;
  readonly uploadUrl: string;
  readonly token: string;
}

export class PrepareEvidenceUpload {
  constructor(
    private readonly storage: FileStorage,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    userId: string;
    paymentId: string | null;
    mimeType: string;
    sizeBytes: number;
  }): Promise<Result<PreparedUpload>> {
    const mime = validateFile(input);
    if (!mime.ok) return err(mime.error);

    const paymentId = input.paymentId ?? this.ids.next();
    const fileId = this.ids.next();
    const storagePath = buildStoragePath(input.userId, paymentId, fileId, mime.value);
    try {
      const signed = await this.storage.createSignedUploadUrl(storagePath);
      return ok({ paymentId, fileId, storagePath, uploadUrl: signed.url, token: signed.token });
    } catch (cause) {
      return err(new DomainError('STORAGE_FAILED', `เตรียมอัปโหลดไม่สำเร็จ: ${String(cause)}`));
    }
  }
}
```

`src/application/use-cases/payment/record-payment.ts`:

```ts
import { createPayment } from '@/domain/payment/payment';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { FileStorage } from '@/application/ports/file-storage';
import type { LoanRepository } from '@/application/ports/repositories';
import type { Clock, IdGenerator } from '@/application/ports/system';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import { buildEvidenceList, type UploadedEvidenceInput } from './evidence-input';
import { parsePaymentInput, type PaymentInput } from './parse-payment-input';

export interface RecordPaymentInput extends PaymentInput {
  readonly userId: string;
  readonly loanId: string;
  /** Pre-generated by PrepareEvidenceUpload when files were uploaded first; null otherwise. */
  readonly paymentId: string | null;
  readonly evidence: readonly UploadedEvidenceInput[];
}

export class RecordPayment {
  constructor(
    private readonly loans: LoanRepository,
    private readonly uow: UnitOfWork,
    private readonly storage: FileStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: RecordPaymentInput): Promise<Result<{ paymentId: string }>> {
    const loan = await this.loans.findById(input.loanId, input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));

    const draft = parsePaymentInput(input, this.clock.today());
    if (!draft.ok) return err(draft.error);

    const now = this.clock.now();
    const paymentId = input.paymentId ?? this.ids.next();
    const evidence = buildEvidenceList(input.evidence, { userId: input.userId, paymentId, now, ids: this.ids });
    if (!evidence.ok) return err(evidence.error);

    const payment = createPayment(draft.value, { id: paymentId, loanId: loan.id, userId: input.userId, now });

    try {
      await this.uow.run(async (repos) => {
        await repos.payments.insert(payment);
        await repos.evidence.insertMany(evidence.value);
      });
    } catch (cause) {
      await this.storage.delete(evidence.value.map((e) => e.storagePath)).catch(() => undefined);
      return err(new DomainError('PERSISTENCE_FAILED', `บันทึกไม่สำเร็จ: ${String(cause)}`));
    }

    return ok({ paymentId });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- record-payment` → Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/payment
git commit -m "feat(application): add PrepareEvidenceUpload and RecordPayment use cases

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Use cases — VoidPayment and CorrectPayment

**Files:**
- Create: `src/application/use-cases/payment/void-payment.ts`, `src/application/use-cases/payment/correct-payment.ts`
- Test: `src/application/use-cases/payment/correct-void.test.ts`

**Interfaces:**
- Consumes: Task 9 helpers (`parsePaymentInput`, `buildEvidenceList`), Task 4 `voidPayment`, Task 5 `copyEvidenceTo`.
- Produces:
  ```ts
  class VoidPayment { constructor(uow, ids, clock); execute(input: { userId; paymentId; reason }): Promise<Result<void>> }
  class CorrectPayment { constructor(uow, storage, ids, clock); execute(input: PaymentInput & { userId; originalPaymentId; newPaymentId: string|null; reason; newEvidence: UploadedEvidenceInput[] }): Promise<Result<{ paymentId }>> }
  ```

- [ ] **Step 1: Write failing test**

`src/application/use-cases/payment/correct-void.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { CorrectPayment } from './correct-payment';
import { RecordPayment } from './record-payment';
import { VoidPayment } from './void-payment';

describe('VoidPayment / CorrectPayment', () => {
  let ctx: TestContext;
  let loanId: string;
  let paymentId: string;

  beforeEach(async () => {
    ctx = makeTestContext();
    const loan = await new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock).execute({
      userId: 'u1', name: 'กยศ.', loanNumber: null, openingBalance: '195420.50', openingBalanceDate: '2026-06-30', defaultAmount: '3000',
    });
    if (!loan.ok) throw loan.error;
    loanId = loan.value.loanId;
    const recorded = await new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', loanId, paymentId: 'p1', paidAt: '2026-10-04', amount: '3000', paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null,
      evidence: [{ fileId: 'f1', storagePath: 'u1/payments/p1/f1.jpg', mimeType: 'image/jpeg', sizeBytes: 10, originalFilename: 'a.jpg' }],
    });
    if (!recorded.ok) throw recorded.error;
    paymentId = recorded.value.paymentId;
  });

  it('VoidPayment marks VOIDED and records a correction without replacement', async () => {
    const r = await new VoidPayment(ctx.uow, ctx.ids, ctx.clock).execute({ userId: 'u1', paymentId, reason: 'บันทึกซ้ำ' });
    expect(r.ok).toBe(true);
    const p = await ctx.repos.payments.findById(paymentId, 'u1');
    expect(p?.status).toBe('VOIDED');
    expect(p?.voidReason).toBe('บันทึกซ้ำ');
    expect(p?.replacedByPaymentId).toBeNull();
    expect(ctx.repos.corrections.items).toHaveLength(1);
    expect(ctx.repos.corrections.items[0]?.replacementPaymentId).toBeNull();
  });

  it('VoidPayment refuses other users, unknown ids, empty reason and double void', async () => {
    const vp = new VoidPayment(ctx.uow, ctx.ids, ctx.clock);
    const other = await vp.execute({ userId: 'u2', paymentId, reason: 'x' });
    if (!other.ok) expect(other.error.code).toBe('PAYMENT_NOT_FOUND');
    const empty = await vp.execute({ userId: 'u1', paymentId, reason: ' ' });
    if (!empty.ok) expect(empty.error.code).toBe('REASON_REQUIRED');
    expect((await vp.execute({ userId: 'u1', paymentId, reason: 'x' })).ok).toBe(true);
    const twice = await vp.execute({ userId: 'u1', paymentId, reason: 'y' });
    if (!twice.ok) expect(twice.error.code).toBe('PAYMENT_ALREADY_VOIDED');
    expect([other.ok, empty.ok, twice.ok]).toEqual([false, false, false]);
  });

  it('CorrectPayment voids the original, creates a replacement, copies evidence and links them', async () => {
    const r = await new CorrectPayment(ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', originalPaymentId: paymentId, newPaymentId: 'p2', reason: 'พิมพ์ยอดผิด',
      paidAt: '2026-10-04', amount: '2500', paymentMethod: 'MOBILE_BANKING', referenceNo: 'REF2', notes: null,
      newEvidence: [{ fileId: 'f2', storagePath: 'u1/payments/p2/f2.png', mimeType: 'image/png', sizeBytes: 5, originalFilename: null }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.paymentId).toBe('p2');

    const original = await ctx.repos.payments.findById(paymentId, 'u1');
    expect(original?.status).toBe('VOIDED');
    expect(original?.replacedByPaymentId).toBe('p2');

    const replacement = await ctx.repos.payments.findById('p2', 'u1');
    expect(replacement?.amount.toString()).toBe('2500.00');
    expect(replacement?.loanId).toBe(loanId);

    const evidence = await ctx.repos.evidence.listByPayment('p2', 'u1');
    expect(evidence.map((e) => e.storagePath).sort()).toEqual(['u1/payments/p1/f1.jpg', 'u1/payments/p2/f2.png']);

    const correction = await ctx.repos.corrections.findByReplacement('p2', 'u1');
    expect(correction?.originalPaymentId).toBe(paymentId);
    expect(correction?.reason).toBe('พิมพ์ยอดผิด');
  });

  it('CorrectPayment rejects already-voided originals and cleans up new files on failure', async () => {
    await new VoidPayment(ctx.uow, ctx.ids, ctx.clock).execute({ userId: 'u1', paymentId, reason: 'x' });
    const cp = new CorrectPayment(ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    const voided = await cp.execute({
      userId: 'u1', originalPaymentId: paymentId, newPaymentId: 'p3', reason: 'y',
      paidAt: '2026-10-04', amount: '1', paymentMethod: 'ATM', referenceNo: null, notes: null, newEvidence: [],
    });
    expect(voided.ok).toBe(false);
    if (!voided.ok) expect(voided.error.code).toBe('PAYMENT_ALREADY_VOIDED');

    // fresh active payment, then force persistence failure
    const recorded = await new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', loanId, paymentId: 'p4', paidAt: '2026-10-01', amount: '100', paymentMethod: 'ATM', referenceNo: null, notes: null, evidence: [],
    });
    if (!recorded.ok) throw recorded.error;
    ctx.repos.payments.failOnInsert = true;
    const failed = await cp.execute({
      userId: 'u1', originalPaymentId: 'p4', newPaymentId: 'p5', reason: 'z',
      paidAt: '2026-10-01', amount: '90', paymentMethod: 'ATM', referenceNo: null, notes: null,
      newEvidence: [{ fileId: 'f5', storagePath: 'u1/payments/p5/f5.jpg', mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }],
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe('PERSISTENCE_FAILED');
    expect(ctx.storage.deleted).toContain('u1/payments/p5/f5.jpg');
    expect((await ctx.repos.payments.findById('p4', 'u1'))?.status).toBe('ACTIVE');
  });
});
```

Note on the last assertion: the in-memory unit of work has no rollback, so `CorrectPayment` must call `markVoided` *after* the replacement insert inside the transaction. Real rollback is tested in Task 13.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- correct-void` → Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement**

`src/application/use-cases/payment/void-payment.ts`:

```ts
import { voidPayment } from '@/domain/payment/payment';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { Clock, IdGenerator } from '@/application/ports/system';
import type { UnitOfWork } from '@/application/ports/unit-of-work';

export class VoidPayment {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: { userId: string; paymentId: string; reason: string }): Promise<Result<void>> {
    const now = this.clock.now();
    try {
      return await this.uow.run(async (repos) => {
        const payment = await repos.payments.findById(input.paymentId, input.userId);
        if (!payment) return err(new DomainError('PAYMENT_NOT_FOUND', 'ไม่พบรายการชำระ'));

        const voided = voidPayment(payment, input.reason, now, null);
        if (!voided.ok) return err(voided.error);

        await repos.payments.markVoided(voided.value);
        await repos.corrections.insert({
          id: this.ids.next(),
          userId: input.userId,
          originalPaymentId: payment.id,
          replacementPaymentId: null,
          reason: voided.value.voidReason ?? input.reason.trim(),
          createdAt: now,
        });
        return ok(undefined);
      });
    } catch (cause) {
      return err(new DomainError('PERSISTENCE_FAILED', `ยกเลิกรายการไม่สำเร็จ: ${String(cause)}`));
    }
  }
}
```

`src/application/use-cases/payment/correct-payment.ts`:

```ts
import { copyEvidenceTo } from '@/domain/evidence/evidence';
import { createPayment, voidPayment } from '@/domain/payment/payment';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { FileStorage } from '@/application/ports/file-storage';
import type { Clock, IdGenerator } from '@/application/ports/system';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import { buildEvidenceList, type UploadedEvidenceInput } from './evidence-input';
import { parsePaymentInput, type PaymentInput } from './parse-payment-input';

export interface CorrectPaymentInput extends PaymentInput {
  readonly userId: string;
  readonly originalPaymentId: string;
  /** Pre-generated by PrepareEvidenceUpload when new files were uploaded first; null otherwise. */
  readonly newPaymentId: string | null;
  readonly reason: string;
  readonly newEvidence: readonly UploadedEvidenceInput[];
}

export class CorrectPayment {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly storage: FileStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CorrectPaymentInput): Promise<Result<{ paymentId: string }>> {
    const now = this.clock.now();
    const draft = parsePaymentInput(input, this.clock.today());
    if (!draft.ok) return err(draft.error);

    const newPaymentId = input.newPaymentId ?? this.ids.next();
    const newEvidence = buildEvidenceList(input.newEvidence, {
      userId: input.userId,
      paymentId: newPaymentId,
      now,
      ids: this.ids,
    });
    if (!newEvidence.ok) return err(newEvidence.error);
    const newPaths = newEvidence.value.map((e) => e.storagePath);

    try {
      return await this.uow.run(async (repos) => {
        const original = await repos.payments.findById(input.originalPaymentId, input.userId);
        if (!original) return err(new DomainError('PAYMENT_NOT_FOUND', 'ไม่พบรายการชำระ'));

        const voided = voidPayment(original, input.reason, now, newPaymentId);
        if (!voided.ok) return err(voided.error);

        const replacement = createPayment(draft.value, {
          id: newPaymentId,
          loanId: original.loanId,
          userId: input.userId,
          now,
        });
        const existing = await repos.evidence.listByPayment(original.id, input.userId);
        const copied = existing.map((e) => copyEvidenceTo(e, newPaymentId, this.ids.next(), now));

        await repos.payments.insert(replacement);
        await repos.evidence.insertMany([...copied, ...newEvidence.value]);
        await repos.payments.markVoided(voided.value);
        await repos.corrections.insert({
          id: this.ids.next(),
          userId: input.userId,
          originalPaymentId: original.id,
          replacementPaymentId: newPaymentId,
          reason: voided.value.voidReason ?? input.reason.trim(),
          createdAt: now,
        });
        return ok({ paymentId: newPaymentId });
      });
    } catch (cause) {
      await this.storage.delete(newPaths).catch(() => undefined);
      return err(new DomainError('PERSISTENCE_FAILED', `แก้ไขรายการไม่สำเร็จ: ${String(cause)}`));
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- correct-void` → Expected: PASS (4 tests). Then `npm run test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/payment
git commit -m "feat(application): add VoidPayment and CorrectPayment with evidence carry-over

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Use cases — GetDashboard, ListPayments, GetPaymentDetail

**Files:**
- Create: `src/application/use-cases/query/get-dashboard.ts`, `src/application/use-cases/query/list-payments.ts`, `src/application/use-cases/query/get-payment-detail.ts`
- Test: `src/application/use-cases/query/queries.test.ts`

**Interfaces:**
- Consumes: Task 6 ledger functions, Task 7 ports.
- Produces:
  ```ts
  class GetDashboard { constructor(loans, payments); execute({ userId }): Promise<Result<{ loan: Loan; summary: DashboardSummary }>> }   // LOAN_NOT_FOUND
  interface PaymentListView { loan: Loan; groups: TimelineGroup[]; evidenceCount: Record<string, number> }
  class ListPayments { constructor(loans, payments, evidence); execute({ userId; includeVoided: boolean }): Promise<Result<PaymentListView>> }
  interface PaymentDetailView { loan: Loan; payment: Payment; balanceAfter: Money|null; evidence: Array<{ evidence: Evidence; url: string }>; replacedBy: Payment|null; correctedFrom: Payment|null; correctionReason: string|null }
  class GetPaymentDetail { constructor(loans, payments, evidence, corrections, storage); execute({ userId; paymentId }): Promise<Result<PaymentDetailView>> }   // PAYMENT_NOT_FOUND
  const SIGNED_URL_TTL_SECONDS = 3600
  ```

- [ ] **Step 1: Write failing test**

`src/application/use-cases/query/queries.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '@/application/testing/in-memory';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { CorrectPayment } from '@/application/use-cases/payment/correct-payment';
import { RecordPayment } from '@/application/use-cases/payment/record-payment';
import { GetDashboard } from './get-dashboard';
import { GetPaymentDetail } from './get-payment-detail';
import { ListPayments } from './list-payments';

describe('query use cases', () => {
  let ctx: TestContext;
  let loanId: string;

  beforeEach(async () => {
    ctx = makeTestContext();
    const loan = await new SetupLoan(ctx.repos.loans, ctx.ids, ctx.clock).execute({
      userId: 'u1', name: 'กยศ.', loanNumber: null, openingBalance: '195420.50', openingBalanceDate: '2026-06-30', defaultAmount: '3000',
    });
    if (!loan.ok) throw loan.error;
    loanId = loan.value.loanId;
    const record = new RecordPayment(ctx.repos.loans, ctx.uow, ctx.storage, ctx.ids, ctx.clock);
    for (const [id, paidAt] of [['p1', '2026-07-04'], ['p2', '2026-08-04'], ['p3', '2026-09-04']] as const) {
      const r = await record.execute({
        userId: 'u1', loanId, paymentId: id, paidAt, amount: '3000', paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null,
        evidence: id === 'p3' ? [{ fileId: 'f3', storagePath: `u1/payments/p3/f3.jpg`, mimeType: 'image/jpeg', sizeBytes: 1, originalFilename: null }] : [],
      });
      if (!r.ok) throw r.error;
    }
  });

  it('GetDashboard summarises the loan', async () => {
    const r = await new GetDashboard(ctx.repos.loans, ctx.repos.payments).execute({ userId: 'u1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.summary.ledgerBalance.toString()).toBe('186420.50');
    expect(r.value.summary.paymentCount).toBe(3);
    expect(r.value.summary.latestPayment?.id).toBe('p3');
    const none = await new GetDashboard(ctx.repos.loans, ctx.repos.payments).execute({ userId: 'u2' });
    expect(none.ok).toBe(false);
  });

  it('ListPayments returns grouped timeline and evidence counts', async () => {
    const r = await new ListPayments(ctx.repos.loans, ctx.repos.payments, ctx.repos.evidence).execute({ userId: 'u1', includeVoided: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.groups.map((g) => g.month)).toEqual([9, 8, 7]);
    expect(r.value.evidenceCount).toEqual({ p3: 1 });
  });

  it('GetPaymentDetail resolves evidence URLs, balance and correction links', async () => {
    const corrected = await new CorrectPayment(ctx.uow, ctx.storage, ctx.ids, ctx.clock).execute({
      userId: 'u1', originalPaymentId: 'p3', newPaymentId: 'p4', reason: 'พิมพ์ผิด',
      paidAt: '2026-09-04', amount: '2500', paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null, newEvidence: [],
    });
    if (!corrected.ok) throw corrected.error;

    const detail = new GetPaymentDetail(ctx.repos.loans, ctx.repos.payments, ctx.repos.evidence, ctx.repos.corrections, ctx.storage);
    const replacement = await detail.execute({ userId: 'u1', paymentId: 'p4' });
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) return;
    expect(replacement.value.balanceAfter?.toString()).toBe('186920.50');
    expect(replacement.value.evidence).toHaveLength(1);
    expect(replacement.value.evidence[0]?.url).toContain('u1/payments/p3/f3.jpg');
    expect(replacement.value.correctedFrom?.id).toBe('p3');
    expect(replacement.value.correctionReason).toBe('พิมพ์ผิด');
    expect(replacement.value.replacedBy).toBeNull();

    const original = await detail.execute({ userId: 'u1', paymentId: 'p3' });
    if (!original.ok) throw original.error;
    expect(original.value.payment.status).toBe('VOIDED');
    expect(original.value.balanceAfter).toBeNull();
    expect(original.value.replacedBy?.id).toBe('p4');
    expect(original.value.correctionReason).toBe('พิมพ์ผิด');

    const missing = await detail.execute({ userId: 'u1', paymentId: 'nope' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('PAYMENT_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- queries` → Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement**

`src/application/use-cases/query/get-dashboard.ts`:

```ts
import { computeDashboard, type DashboardSummary } from '@/domain/ledger/ledger';
import type { Loan } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { LoanRepository, PaymentRepository } from '@/application/ports/repositories';

export interface DashboardView {
  readonly loan: Loan;
  readonly summary: DashboardSummary;
}

export class GetDashboard {
  constructor(
    private readonly loans: LoanRepository,
    private readonly payments: PaymentRepository,
  ) {}

  async execute(input: { userId: string }): Promise<Result<DashboardView>> {
    const loan = await this.loans.findByUserId(input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));
    const payments = await this.payments.listByLoan(loan.id, input.userId);
    return ok({ loan, summary: computeDashboard(loan, payments) });
  }
}
```

`src/application/use-cases/query/list-payments.ts`:

```ts
import { buildTimeline, type TimelineGroup } from '@/domain/ledger/ledger';
import type { Loan } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { EvidenceRepository, LoanRepository, PaymentRepository } from '@/application/ports/repositories';

export interface PaymentListView {
  readonly loan: Loan;
  readonly groups: TimelineGroup[];
  readonly evidenceCount: Record<string, number>;
}

export class ListPayments {
  constructor(
    private readonly loans: LoanRepository,
    private readonly payments: PaymentRepository,
    private readonly evidence: EvidenceRepository,
  ) {}

  async execute(input: { userId: string; includeVoided: boolean }): Promise<Result<PaymentListView>> {
    const loan = await this.loans.findByUserId(input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));
    const payments = await this.payments.listByLoan(loan.id, input.userId);
    const groups = buildTimeline(loan, payments, { includeVoided: input.includeVoided });
    const ids = groups.flatMap((g) => g.rows.map((r) => r.payment.id));
    const evidenceCount = ids.length > 0 ? await this.evidence.countByPaymentIds(ids, input.userId) : {};
    return ok({ loan, groups, evidenceCount });
  }
}
```

`src/application/use-cases/query/get-payment-detail.ts`:

```ts
import type { Evidence } from '@/domain/evidence/evidence';
import { buildTimeline } from '@/domain/ledger/ledger';
import type { Loan } from '@/domain/loan/loan';
import type { Payment } from '@/domain/payment/payment';
import { DomainError } from '@/domain/shared/errors';
import type { Money } from '@/domain/shared/money';
import { err, ok, type Result } from '@/domain/shared/result';
import type { FileStorage } from '@/application/ports/file-storage';
import type {
  CorrectionRepository,
  EvidenceRepository,
  LoanRepository,
  PaymentRepository,
} from '@/application/ports/repositories';

export const SIGNED_URL_TTL_SECONDS = 3600;

export interface EvidenceWithUrl {
  readonly evidence: Evidence;
  readonly url: string;
}

export interface PaymentDetailView {
  readonly loan: Loan;
  readonly payment: Payment;
  readonly balanceAfter: Money | null;
  readonly evidence: EvidenceWithUrl[];
  /** The payment that replaced this one (when this one is VOIDED by a correction). */
  readonly replacedBy: Payment | null;
  /** The original payment this one replaced (when this one is a replacement). */
  readonly correctedFrom: Payment | null;
  readonly correctionReason: string | null;
}

export class GetPaymentDetail {
  constructor(
    private readonly loans: LoanRepository,
    private readonly payments: PaymentRepository,
    private readonly evidence: EvidenceRepository,
    private readonly corrections: CorrectionRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(input: { userId: string; paymentId: string }): Promise<Result<PaymentDetailView>> {
    const payment = await this.payments.findById(input.paymentId, input.userId);
    if (!payment) return err(new DomainError('PAYMENT_NOT_FOUND', 'ไม่พบรายการชำระ'));
    const loan = await this.loans.findById(payment.loanId, input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));

    const all = await this.payments.listByLoan(loan.id, input.userId);
    const row = buildTimeline(loan, all, { includeVoided: true })
      .flatMap((g) => g.rows)
      .find((r) => r.payment.id === payment.id);

    const evidenceItems = await this.evidence.listByPayment(payment.id, input.userId);
    const evidence = await Promise.all(
      evidenceItems.map(async (e) => ({
        evidence: e,
        url: await this.storage.createSignedReadUrl(e.storagePath, SIGNED_URL_TTL_SECONDS),
      })),
    );

    const replacedBy = payment.replacedByPaymentId
      ? await this.payments.findById(payment.replacedByPaymentId, input.userId)
      : null;
    const correction = await this.corrections.findByReplacement(payment.id, input.userId);
    const correctedFrom = correction ? await this.payments.findById(correction.originalPaymentId, input.userId) : null;
    const correctionReason = payment.status === 'VOIDED' ? payment.voidReason : (correction?.reason ?? null);

    return ok({
      loan,
      payment,
      balanceAfter: row?.balanceAfter ?? null,
      evidence,
      replacedBy,
      correctedFrom,
      correctionReason,
    });
  }
}
```

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `npm run test` → Expected: all PASS.
Run: `npm run lint && npm run typecheck` → Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/query
git commit -m "feat(application): add dashboard, payment list and payment detail queries

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 12: Supabase local, Drizzle schema and migrations (incl. RLS + bucket)

**Files:**
- Create: `supabase/config.toml` (via CLI, then edit), `supabase/templates/magic_link.html`, `drizzle.config.ts`, `src/infrastructure/db/schema.ts`, `src/infrastructure/db/client.ts`, `src/infrastructure/db/migrations/*` (generated + one custom), `.env.local`, `.env.test`
- Test: `src/infrastructure/db/schema.int.test.ts`
- Delete: `src/infrastructure/.gitkeep`

**Interfaces:**
- Produces: Drizzle tables `loans`, `payments`, `paymentEvidence`, `paymentCorrections`; enums `paymentMethodEnum`, `paymentStatusEnum`, `evidenceTypeEnum`; `createDb(url?)`, types `Db`, `Tx`, `DbExecutor`.

- [ ] **Step 1: Initialise and start Supabase locally**

Docker Desktop must be running.

```bash
npx supabase init
npx supabase start
npx supabase status
```

Expected: `supabase/config.toml` created; status prints `API URL http://127.0.0.1:54321`, `DB URL postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `Inbucket URL http://127.0.0.1:54324` (or `Mailpit URL`), `anon key`, `service_role key`.

- [ ] **Step 2: Write `.env.local` and `.env.test`**

```bash
cp .env.example .env.local
cp .env.example .env.test
```

Edit both files: paste the `anon key` into `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the `service_role key` into `SUPABASE_SERVICE_ROLE_KEY`. The URL defaults already match local.

- [ ] **Step 3: Configure Supabase auth for magic-link via token_hash**

Edit `supabase/config.toml` so the `[auth]` section has:

```toml
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback", "http://127.0.0.1:3000/auth/callback"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false

[auth.email.template.magic_link]
subject = "ลิงก์เข้าสู่ระบบ หนี้ชัด"
content_path = "./supabase/templates/magic_link.html"
```

Create `supabase/templates/magic_link.html`:

```html
<h2>เข้าสู่ระบบ หนี้ชัด</h2>
<p>กดลิงก์ด้านล่างเพื่อเข้าสู่ระบบ ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">เข้าสู่ระบบ</a></p>
<p>ถ้าคุณไม่ได้ขอลิงก์นี้ ไม่ต้องทำอะไร</p>
```

Restart so config applies:

```bash
npx supabase stop && npx supabase start
```

- [ ] **Step 4: Drizzle config and schema**

`drizzle.config.ts`:

```ts
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/db/schema.ts',
  out: './src/infrastructure/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
```

`src/infrastructure/db/schema.ts`:

```ts
import { date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const paymentMethodEnum = pgEnum('payment_method', ['MOBILE_BANKING', 'COUNTER', 'ATM', 'OTHER']);
export const paymentStatusEnum = pgEnum('payment_status', ['ACTIVE', 'VOIDED']);
export const evidenceTypeEnum = pgEnum('evidence_type', ['PAYMENT_SLIP', 'RECEIPT', 'OTHER']);

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    loanNumber: text('loan_number'),
    openingBalance: money('opening_balance').notNull(),
    openingBalanceDate: date('opening_balance_date', { mode: 'string' }).notNull(),
    defaultAmount: money('default_amount'),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
  },
  (t) => [index('loans_user_idx').on(t.userId)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id),
    userId: uuid('user_id').notNull(),
    paidAt: date('paid_at', { mode: 'string' }).notNull(),
    amount: money('amount').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    referenceNo: text('reference_no'),
    notes: text('notes'),
    status: paymentStatusEnum('status').notNull(),
    voidedAt: ts('voided_at'),
    voidReason: text('void_reason'),
    replacedByPaymentId: uuid('replaced_by_payment_id'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('payments_loan_user_idx').on(t.loanId, t.userId), index('payments_user_idx').on(t.userId)],
);

export const paymentEvidence = pgTable(
  'payment_evidence',
  {
    id: uuid('id').primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    userId: uuid('user_id').notNull(),
    storagePath: text('storage_path').notNull(),
    type: evidenceTypeEnum('type').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    originalFilename: text('original_filename'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('payment_evidence_payment_idx').on(t.paymentId)],
);

export const paymentCorrections = pgTable(
  'payment_corrections',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    originalPaymentId: uuid('original_payment_id')
      .notNull()
      .references(() => payments.id),
    replacementPaymentId: uuid('replacement_payment_id').references(() => payments.id),
    reason: text('reason').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('payment_corrections_replacement_idx').on(t.replacementPaymentId)],
);
```

`src/infrastructure/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { __neechatSql?: postgres.Sql };

export function createDb(url: string = process.env.DATABASE_URL ?? '') {
  if (!url) throw new Error('DATABASE_URL is not set');
  // prepare:false is required for Supabase's transaction pooler (port 6543).
  const sql = globalForDb.__neechatSql ?? postgres(url, { prepare: false, max: 10 });
  if (process.env.NODE_ENV !== 'production') globalForDb.__neechatSql = sql;
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbExecutor = Db | Tx;
```

- [ ] **Step 5: Generate the schema migration and a custom RLS/bucket migration**

```bash
npm run db:generate -- --name init_ledger
npx drizzle-kit generate --custom --name rls_and_evidence_bucket
```

Expected: two files in `src/infrastructure/db/migrations/` (`0000_init_ledger.sql`, `0001_rls_and_evidence_bucket.sql`) plus `meta/`.

Replace the contents of `0001_rls_and_evidence_bucket.sql` with:

```sql
-- Row Level Security as a second line of defence (server uses a direct connection that bypasses it).
alter table "loans" enable row level security;
alter table "payments" enable row level security;
alter table "payment_evidence" enable row level security;
alter table "payment_corrections" enable row level security;

create policy "loans_owner" on "loans" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payments_owner" on "payments" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_evidence_owner" on "payment_evidence" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_corrections_owner" on "payment_corrections" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private evidence bucket. Access only via signed URLs created server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
```

Apply:

```bash
npm run db:migrate
```

Expected: `migrations applied successfully` (or similar) with no errors.

- [ ] **Step 6: Integration test proving the schema exists**

`src/infrastructure/db/schema.int.test.ts`:

```ts
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from './client';

describe('database schema', () => {
  it('has the ledger tables, RLS enabled, and the evidence bucket', async () => {
    const db = createDb();
    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = tables.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(['loans', 'payments', 'payment_evidence', 'payment_corrections']));

    const rls = await db.execute<{ relname: string; relrowsecurity: boolean }>(
      sql`select relname, relrowsecurity from pg_class where relname in ('loans','payments','payment_evidence','payment_corrections')`,
    );
    expect(rls.every((r) => r.relrowsecurity)).toBe(true);

    const bucket = await db.execute<{ id: string; public: boolean }>(sql`select id, public from storage.buckets where id = 'evidence'`);
    expect(bucket[0]).toMatchObject({ id: 'evidence', public: false });
  });
});
```

Run: `npm run test:int` → Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rm -f src/infrastructure/.gitkeep
git add supabase drizzle.config.ts src/infrastructure/db
git commit -m "feat(infra): add Supabase local config, Drizzle schema and migrations with RLS and evidence bucket

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(`.env.local` and `.env.test` are gitignored; verify with `git status` that they are not staged.)

---

### Task 13: Drizzle repositories and unit of work

**Files:**
- Create: `src/infrastructure/repositories/mappers.ts`, `src/infrastructure/repositories/drizzle-loan-repository.ts`, `src/infrastructure/repositories/drizzle-payment-repository.ts`, `src/infrastructure/repositories/drizzle-evidence-repository.ts`, `src/infrastructure/repositories/drizzle-correction-repository.ts`, `src/infrastructure/repositories/unit-of-work.ts`, `src/infrastructure/repositories/index.ts`
- Test: `src/infrastructure/repositories/repositories.int.test.ts`

**Interfaces:**
- Consumes: ports (Task 7), schema/client (Task 12).
- Produces: `makeRepositories(exec: DbExecutor): Repositories`, `class DrizzleUnitOfWork implements UnitOfWork { constructor(db: Db) }`.

- [ ] **Step 1: Write failing integration test**

`src/infrastructure/repositories/repositories.int.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createLoan } from '@/domain/loan/loan';
import { createPayment, voidPayment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { createDb } from '@/infrastructure/db/client';
import { loans, paymentCorrections, paymentEvidence, payments } from '@/infrastructure/db/schema';
import { makeRepositories } from './index';
import { DrizzleUnitOfWork } from './unit-of-work';

const db = createDb();
const repos = makeRepositories(db);
const userId = randomUUID();
const otherUser = randomUUID();
const now = new Date('2026-10-04T09:00:00.000Z');

const loan = createLoan(
  { name: 'กยศ.', loanNumber: '12345', openingBalance: Money.of('195420.50'), openingBalanceDate: DateOnly.of('2026-06-30'), defaultAmount: Money.of('3000') },
  { id: randomUUID(), userId, now },
);

function pay(paidAt: string, amount: string, createdAt = now) {
  return createPayment(
    { paidAt: DateOnly.of(paidAt), amount: Money.of(amount), paymentMethod: 'MOBILE_BANKING', referenceNo: 'R', notes: null },
    { id: randomUUID(), loanId: loan.id, userId, now: createdAt },
  );
}

afterAll(async () => {
  await db.delete(paymentCorrections).where(eq(paymentCorrections.userId, userId));
  await db.delete(paymentEvidence).where(eq(paymentEvidence.userId, userId));
  await db.delete(payments).where(eq(payments.userId, userId));
  await db.delete(loans).where(eq(loans.userId, userId));
});

describe('Drizzle repositories', () => {
  it('round-trips a loan with exact money and date values', async () => {
    await repos.loans.save(loan);
    const found = await repos.loans.findByUserId(userId);
    expect(found?.openingBalance.toString()).toBe('195420.50');
    expect(found?.openingBalanceDate.iso).toBe('2026-06-30');
    expect(found?.defaultAmount?.toString()).toBe('3000.00');
    expect(found?.createdAt.toISOString()).toBe(now.toISOString());
    expect(await repos.loans.findByUserId(otherUser)).toBeNull();
    expect(await repos.loans.findById(loan.id, otherUser)).toBeNull();

    await repos.loans.save({ ...loan, name: 'แก้แล้ว' });
    expect((await repos.loans.findById(loan.id, userId))?.name).toBe('แก้แล้ว');
  });

  it('stores payments, finds latest active, and marks voided', async () => {
    const a = pay('2026-07-04', '3000');
    const b = pay('2026-08-04', '3000.50');
    await repos.payments.insert(a);
    await repos.payments.insert(b);
    expect((await repos.payments.listByLoan(loan.id, userId)).length).toBeGreaterThanOrEqual(2);
    expect((await repos.payments.findLatestActive(loan.id, userId))?.id).toBe(b.id);
    expect((await repos.payments.findById(b.id, userId))?.amount.toString()).toBe('3000.50');

    const voided = voidPayment(b, 'ผิด', now, a.id);
    if (!voided.ok) throw voided.error;
    await repos.payments.markVoided(voided.value);
    const reloaded = await repos.payments.findById(b.id, userId);
    expect(reloaded?.status).toBe('VOIDED');
    expect(reloaded?.voidReason).toBe('ผิด');
    expect(reloaded?.replacedByPaymentId).toBe(a.id);
    expect((await repos.payments.findLatestActive(loan.id, userId))?.id).toBe(a.id);
  });

  it('stores evidence and corrections', async () => {
    const p = pay('2026-09-04', '100');
    await repos.payments.insert(p);
    const e1 = randomUUID();
    await repos.evidence.insertMany([
      { id: e1, paymentId: p.id, userId, storagePath: `${userId}/payments/${p.id}/${e1}.jpg`, type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 42, originalFilename: 'slip.jpg', createdAt: now },
    ]);
    await repos.evidence.insertMany([]);
    expect((await repos.evidence.listByPayment(p.id, userId))[0]?.sizeBytes).toBe(42);
    expect(await repos.evidence.findById(e1, userId)).not.toBeNull();
    expect(await repos.evidence.findById(e1, otherUser)).toBeNull();
    expect(await repos.evidence.countByPaymentIds([p.id, randomUUID()], userId)).toEqual({ [p.id]: 1 });

    const replacement = pay('2026-09-04', '90');
    await repos.payments.insert(replacement);
    await repos.corrections.insert({ id: randomUUID(), userId, originalPaymentId: p.id, replacementPaymentId: replacement.id, reason: 'แก้', createdAt: now });
    expect((await repos.corrections.findByReplacement(replacement.id, userId))?.originalPaymentId).toBe(p.id);
  });

  it('rolls back the unit of work when a step throws', async () => {
    const uow = new DrizzleUnitOfWork(db);
    const p = pay('2026-10-01', '1');
    await expect(
      uow.run(async (r) => {
        await r.payments.insert(p);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repos.payments.findById(p.id, userId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int` → Expected: FAIL, cannot resolve `./index` / `./unit-of-work`.

- [ ] **Step 3: Implement mappers**

`src/infrastructure/repositories/mappers.ts`:

```ts
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { AllowedMimeType, Evidence } from '@/domain/evidence/evidence';
import type { Loan } from '@/domain/loan/loan';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { Payment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { loans, paymentCorrections, paymentEvidence, payments } from '@/infrastructure/db/schema';

type LoanRow = InferSelectModel<typeof loans>;
type PaymentRow = InferSelectModel<typeof payments>;
type EvidenceRow = InferSelectModel<typeof paymentEvidence>;
type CorrectionRow = InferSelectModel<typeof paymentCorrections>;

export function rowToLoan(row: LoanRow): Loan {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    loanNumber: row.loanNumber,
    openingBalance: Money.of(row.openingBalance),
    openingBalanceDate: DateOnly.of(row.openingBalanceDate),
    defaultAmount: row.defaultAmount === null ? null : Money.of(row.defaultAmount),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function loanToRow(loan: Loan): InferInsertModel<typeof loans> {
  return {
    id: loan.id,
    userId: loan.userId,
    name: loan.name,
    loanNumber: loan.loanNumber,
    openingBalance: loan.openingBalance.toString(),
    openingBalanceDate: loan.openingBalanceDate.iso,
    defaultAmount: loan.defaultAmount?.toString() ?? null,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
  };
}

export function rowToPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    loanId: row.loanId,
    userId: row.userId,
    paidAt: DateOnly.of(row.paidAt),
    amount: Money.of(row.amount),
    paymentMethod: row.paymentMethod,
    referenceNo: row.referenceNo,
    notes: row.notes,
    status: row.status,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    replacedByPaymentId: row.replacedByPaymentId,
    createdAt: row.createdAt,
  };
}

export function paymentToRow(p: Payment): InferInsertModel<typeof payments> {
  return {
    id: p.id,
    loanId: p.loanId,
    userId: p.userId,
    paidAt: p.paidAt.iso,
    amount: p.amount.toString(),
    paymentMethod: p.paymentMethod,
    referenceNo: p.referenceNo,
    notes: p.notes,
    status: p.status,
    voidedAt: p.voidedAt,
    voidReason: p.voidReason,
    replacedByPaymentId: p.replacedByPaymentId,
    createdAt: p.createdAt,
  };
}

export function rowToEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    paymentId: row.paymentId,
    userId: row.userId,
    storagePath: row.storagePath,
    type: row.type,
    mimeType: row.mimeType as AllowedMimeType,
    sizeBytes: row.sizeBytes,
    originalFilename: row.originalFilename,
    createdAt: row.createdAt,
  };
}

export function evidenceToRow(e: Evidence): InferInsertModel<typeof paymentEvidence> {
  return {
    id: e.id,
    paymentId: e.paymentId,
    userId: e.userId,
    storagePath: e.storagePath,
    type: e.type,
    mimeType: e.mimeType,
    sizeBytes: e.sizeBytes,
    originalFilename: e.originalFilename,
    createdAt: e.createdAt,
  };
}

export function rowToCorrection(row: CorrectionRow): PaymentCorrection {
  return {
    id: row.id,
    userId: row.userId,
    originalPaymentId: row.originalPaymentId,
    replacementPaymentId: row.replacementPaymentId,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export function correctionToRow(c: PaymentCorrection): InferInsertModel<typeof paymentCorrections> {
  return {
    id: c.id,
    userId: c.userId,
    originalPaymentId: c.originalPaymentId,
    replacementPaymentId: c.replacementPaymentId,
    reason: c.reason,
    createdAt: c.createdAt,
  };
}
```

- [ ] **Step 4: Implement repositories**

`src/infrastructure/repositories/drizzle-loan-repository.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import type { Loan } from '@/domain/loan/loan';
import type { LoanRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { loans } from '@/infrastructure/db/schema';
import { loanToRow, rowToLoan } from './mappers';

export class DrizzleLoanRepository implements LoanRepository {
  constructor(private readonly db: DbExecutor) {}

  async findByUserId(userId: string): Promise<Loan | null> {
    const rows = await this.db.select().from(loans).where(eq(loans.userId, userId)).limit(1);
    return rows[0] ? rowToLoan(rows[0]) : null;
  }

  async findById(id: string, userId: string): Promise<Loan | null> {
    const rows = await this.db
      .select()
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .limit(1);
    return rows[0] ? rowToLoan(rows[0]) : null;
  }

  async save(loan: Loan): Promise<void> {
    const row = loanToRow(loan);
    await this.db
      .insert(loans)
      .values(row)
      .onConflictDoUpdate({
        target: loans.id,
        set: {
          name: row.name,
          loanNumber: row.loanNumber,
          openingBalance: row.openingBalance,
          openingBalanceDate: row.openingBalanceDate,
          defaultAmount: row.defaultAmount,
          updatedAt: row.updatedAt,
        },
      });
  }
}
```

`src/infrastructure/repositories/drizzle-payment-repository.ts`:

```ts
import { and, desc, eq } from 'drizzle-orm';
import type { Payment } from '@/domain/payment/payment';
import type { PaymentRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { payments } from '@/infrastructure/db/schema';
import { paymentToRow, rowToPayment } from './mappers';

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string, userId: string): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.userId, userId)))
      .limit(1);
    return rows[0] ? rowToPayment(rows[0]) : null;
  }

  async listByLoan(loanId: string, userId: string): Promise<Payment[]> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.loanId, loanId), eq(payments.userId, userId)));
    return rows.map(rowToPayment);
  }

  async findLatestActive(loanId: string, userId: string): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.loanId, loanId), eq(payments.userId, userId), eq(payments.status, 'ACTIVE')))
      .orderBy(desc(payments.paidAt), desc(payments.createdAt))
      .limit(1);
    return rows[0] ? rowToPayment(rows[0]) : null;
  }

  async insert(payment: Payment): Promise<void> {
    await this.db.insert(payments).values(paymentToRow(payment));
  }

  async markVoided(payment: Payment): Promise<void> {
    await this.db
      .update(payments)
      .set({
        status: payment.status,
        voidedAt: payment.voidedAt,
        voidReason: payment.voidReason,
        replacedByPaymentId: payment.replacedByPaymentId,
      })
      .where(and(eq(payments.id, payment.id), eq(payments.userId, payment.userId)));
  }
}
```

`src/infrastructure/repositories/drizzle-evidence-repository.ts`:

```ts
import { and, count, eq, inArray } from 'drizzle-orm';
import type { Evidence } from '@/domain/evidence/evidence';
import type { EvidenceRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { paymentEvidence } from '@/infrastructure/db/schema';
import { evidenceToRow, rowToEvidence } from './mappers';

export class DrizzleEvidenceRepository implements EvidenceRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string, userId: string): Promise<Evidence | null> {
    const rows = await this.db
      .select()
      .from(paymentEvidence)
      .where(and(eq(paymentEvidence.id, id), eq(paymentEvidence.userId, userId)))
      .limit(1);
    return rows[0] ? rowToEvidence(rows[0]) : null;
  }

  async listByPayment(paymentId: string, userId: string): Promise<Evidence[]> {
    const rows = await this.db
      .select()
      .from(paymentEvidence)
      .where(and(eq(paymentEvidence.paymentId, paymentId), eq(paymentEvidence.userId, userId)))
      .orderBy(paymentEvidence.createdAt);
    return rows.map(rowToEvidence);
  }

  async insertMany(items: readonly Evidence[]): Promise<void> {
    if (items.length === 0) return;
    await this.db.insert(paymentEvidence).values(items.map(evidenceToRow));
  }

  async countByPaymentIds(paymentIds: readonly string[], userId: string): Promise<Record<string, number>> {
    if (paymentIds.length === 0) return {};
    const rows = await this.db
      .select({ paymentId: paymentEvidence.paymentId, n: count() })
      .from(paymentEvidence)
      .where(and(inArray(paymentEvidence.paymentId, [...paymentIds]), eq(paymentEvidence.userId, userId)))
      .groupBy(paymentEvidence.paymentId);
    return Object.fromEntries(rows.map((r) => [r.paymentId, Number(r.n)]));
  }
}
```

`src/infrastructure/repositories/drizzle-correction-repository.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { CorrectionRepository } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { paymentCorrections } from '@/infrastructure/db/schema';
import { correctionToRow, rowToCorrection } from './mappers';

export class DrizzleCorrectionRepository implements CorrectionRepository {
  constructor(private readonly db: DbExecutor) {}

  async insert(correction: PaymentCorrection): Promise<void> {
    await this.db.insert(paymentCorrections).values(correctionToRow(correction));
  }

  async findByReplacement(replacementPaymentId: string, userId: string): Promise<PaymentCorrection | null> {
    const rows = await this.db
      .select()
      .from(paymentCorrections)
      .where(and(eq(paymentCorrections.replacementPaymentId, replacementPaymentId), eq(paymentCorrections.userId, userId)))
      .limit(1);
    return rows[0] ? rowToCorrection(rows[0]) : null;
  }
}
```

`src/infrastructure/repositories/index.ts`:

```ts
import type { Repositories } from '@/application/ports/repositories';
import type { DbExecutor } from '@/infrastructure/db/client';
import { DrizzleCorrectionRepository } from './drizzle-correction-repository';
import { DrizzleEvidenceRepository } from './drizzle-evidence-repository';
import { DrizzleLoanRepository } from './drizzle-loan-repository';
import { DrizzlePaymentRepository } from './drizzle-payment-repository';

export function makeRepositories(exec: DbExecutor): Repositories {
  return {
    loans: new DrizzleLoanRepository(exec),
    payments: new DrizzlePaymentRepository(exec),
    evidence: new DrizzleEvidenceRepository(exec),
    corrections: new DrizzleCorrectionRepository(exec),
  };
}
```

`src/infrastructure/repositories/unit-of-work.ts`:

```ts
import type { Repositories } from '@/application/ports/repositories';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import type { Db } from '@/infrastructure/db/client';
import { makeRepositories } from './index';

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(makeRepositories(tx)));
  }
}
```

- [ ] **Step 5: Run integration tests, lint, typecheck**

Run: `npm run test:int` → Expected: PASS (schema + 4 repository tests).
Run: `npm run lint && npm run typecheck` → Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/repositories
git commit -m "feat(infra): implement Drizzle repositories and transactional unit of work

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Supabase storage adapter, system adapters and the container

**Files:**
- Create: `src/infrastructure/supabase/service-client.ts`, `src/infrastructure/storage/supabase-file-storage.ts`, `src/infrastructure/system/clock.ts`, `src/infrastructure/system/ids.ts`, `src/infrastructure/container.ts`
- Test: `src/infrastructure/storage/supabase-file-storage.int.test.ts`

**Interfaces:**
- Produces:
  ```ts
  createServiceClient(): SupabaseClient            // service role, no session persistence
  class SupabaseFileStorage implements FileStorage { constructor(client, bucket = 'evidence') }
  class SystemClock implements Clock; class UuidIdGenerator implements IdGenerator
  getContainer(): Container  // { loans: LoanRepository, getLoan, setupLoan, updateLoan, prepareEvidenceUpload, recordPayment, correctPayment, voidPayment, getDashboard, listPayments, getPaymentDetail, storage, evidence: EvidenceRepository, clock }
  ```

- [ ] **Step 1: Write failing integration test**

`src/infrastructure/storage/supabase-file-storage.int.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { createServiceClient } from '@/infrastructure/supabase/service-client';
import { SupabaseFileStorage } from './supabase-file-storage';

const storage = new SupabaseFileStorage(createServiceClient());
const path = `${randomUUID()}/payments/${randomUUID()}/${randomUUID()}.png`;
// 1x1 transparent PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

afterAll(async () => {
  await storage.delete([path]);
});

describe('SupabaseFileStorage', () => {
  it('signs an upload, accepts a client upload, signs a read URL, and deletes', async () => {
    const signed = await storage.createSignedUploadUrl(path);
    expect(signed.token).toBeTruthy();

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const upload = await anon.storage.from('evidence').uploadToSignedUrl(path, signed.token, png, { contentType: 'image/png' });
    expect(upload.error).toBeNull();

    expect(await storage.exists(path)).toBe(true);

    const url = await storage.createSignedReadUrl(path, 60);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');

    await storage.delete([path]);
    expect(await storage.exists(path)).toBe(false);
  });

  it('rejects disallowed MIME at the bucket level', async () => {
    const badPath = `${randomUUID()}/payments/x/y.gif`;
    const signed = await storage.createSignedUploadUrl(badPath);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const upload = await anon.storage.from('evidence').uploadToSignedUrl(badPath, signed.token, png, { contentType: 'image/gif' });
    expect(upload.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- supabase-file-storage` → Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement adapters**

`src/infrastructure/supabase/service-client.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
```

`src/infrastructure/storage/supabase-file-storage.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FileStorage, SignedUpload } from '@/application/ports/file-storage';

export class SupabaseFileStorage implements FileStorage {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string = 'evidence',
  ) {}

  async createSignedUploadUrl(path: string): Promise<SignedUpload> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`createSignedUploadUrl failed: ${error?.message ?? 'no data'}`);
    return { url: data.signedUrl, token: data.token };
  }

  async createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw new Error(`createSignedUrl failed: ${error?.message ?? 'no data'}`);
    return data.signedUrl;
  }

  async delete(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(this.bucket).remove([...paths]);
    if (error) throw new Error(`remove failed: ${error.message}`);
  }

  async exists(path: string): Promise<boolean> {
    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '' : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    const { data, error } = await this.client.storage.from(this.bucket).list(dir, { search: name, limit: 1 });
    if (error) throw new Error(`list failed: ${error.message}`);
    return (data ?? []).some((f) => f.name === name);
  }
}
```

`src/infrastructure/system/clock.ts`:

```ts
import { DateOnly } from '@/domain/shared/date-only';
import type { Clock } from '@/application/ports/system';

/** Uses the server's local calendar for "today". Set TZ=Asia/Bangkok in production. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(): DateOnly {
    return DateOnly.fromDate(new Date());
  }
}
```

`src/infrastructure/system/ids.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '@/application/ports/system';

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
```

`src/infrastructure/container.ts`:

```ts
import 'server-only';
import type { FileStorage } from '@/application/ports/file-storage';
import type { EvidenceRepository, LoanRepository } from '@/application/ports/repositories';
import type { Clock } from '@/application/ports/system';
import { GetLoan } from '@/application/use-cases/loan/get-loan';
import { SetupLoan } from '@/application/use-cases/loan/setup-loan';
import { UpdateLoan } from '@/application/use-cases/loan/update-loan';
import { CorrectPayment } from '@/application/use-cases/payment/correct-payment';
import { PrepareEvidenceUpload } from '@/application/use-cases/payment/prepare-evidence-upload';
import { RecordPayment } from '@/application/use-cases/payment/record-payment';
import { VoidPayment } from '@/application/use-cases/payment/void-payment';
import { GetDashboard } from '@/application/use-cases/query/get-dashboard';
import { GetPaymentDetail } from '@/application/use-cases/query/get-payment-detail';
import { ListPayments } from '@/application/use-cases/query/list-payments';
import { createDb } from '@/infrastructure/db/client';
import { makeRepositories } from '@/infrastructure/repositories';
import { DrizzleUnitOfWork } from '@/infrastructure/repositories/unit-of-work';
import { SupabaseFileStorage } from '@/infrastructure/storage/supabase-file-storage';
import { createServiceClient } from '@/infrastructure/supabase/service-client';
import { SystemClock } from '@/infrastructure/system/clock';
import { UuidIdGenerator } from '@/infrastructure/system/ids';

export interface Container {
  readonly loans: LoanRepository;
  readonly evidence: EvidenceRepository;
  readonly storage: FileStorage;
  readonly clock: Clock;
  readonly getLoan: GetLoan;
  readonly setupLoan: SetupLoan;
  readonly updateLoan: UpdateLoan;
  readonly prepareEvidenceUpload: PrepareEvidenceUpload;
  readonly recordPayment: RecordPayment;
  readonly correctPayment: CorrectPayment;
  readonly voidPayment: VoidPayment;
  readonly getDashboard: GetDashboard;
  readonly listPayments: ListPayments;
  readonly getPaymentDetail: GetPaymentDetail;
}

let cached: Container | undefined;

export function getContainer(): Container {
  if (cached) return cached;
  const db = createDb();
  const repos = makeRepositories(db);
  const uow = new DrizzleUnitOfWork(db);
  const storage = new SupabaseFileStorage(createServiceClient());
  const clock = new SystemClock();
  const ids = new UuidIdGenerator();

  cached = {
    loans: repos.loans,
    evidence: repos.evidence,
    storage,
    clock,
    getLoan: new GetLoan(repos.loans),
    setupLoan: new SetupLoan(repos.loans, ids, clock),
    updateLoan: new UpdateLoan(repos.loans, clock),
    prepareEvidenceUpload: new PrepareEvidenceUpload(storage, ids),
    recordPayment: new RecordPayment(repos.loans, uow, storage, ids, clock),
    correctPayment: new CorrectPayment(uow, storage, ids, clock),
    voidPayment: new VoidPayment(uow, ids, clock),
    getDashboard: new GetDashboard(repos.loans, repos.payments),
    listPayments: new ListPayments(repos.loans, repos.payments, repos.evidence),
    getPaymentDetail: new GetPaymentDetail(repos.loans, repos.payments, repos.evidence, repos.corrections, storage),
  };
  return cached;
}
```

- [ ] **Step 4: Run integration tests, lint, typecheck**

Run: `npm run test:int` → Expected: PASS (storage adapter tests included).
Run: `npm run lint && npm run typecheck` → Expected: clean. (`server-only` only throws when imported from client components; typecheck is fine.)

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure
git commit -m "feat(infra): add Supabase storage adapter, system clock/ids and use-case container

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 15: Auth plumbing — Supabase SSR clients, middleware, login, callback, protected layouts

**Files:**
- Create: `src/presentation/lib/supabase/env.ts`, `src/presentation/lib/supabase/server.ts`, `src/presentation/lib/supabase/browser.ts`, `src/presentation/lib/supabase/middleware.ts`, `src/presentation/lib/auth/resolve-next.ts`, `src/middleware.ts`, `src/presentation/actions/auth.ts`, `src/presentation/components/auth/login-form.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/(onboarding)/layout.tsx`, `src/app/(onboarding)/setup/page.tsx` (placeholder), `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (placeholder)
- Delete: `src/app/page.tsx` (create-next-app default), `src/presentation/.gitkeep`
- Test: `src/presentation/lib/auth/resolve-next.test.ts`

**Interfaces:**
- Produces:
  ```ts
  supabasePublicEnv(): { url; anonKey }
  createSupabaseServerClient(): Promise<SupabaseClient>      // cookie-backed, for Server Components/Actions/Route Handlers
  getCurrentUser(): Promise<User | null>; requireUserId(): Promise<string>   // redirects to /login
  createSupabaseBrowserClient(): SupabaseClient
  updateSession(request: NextRequest): Promise<NextResponse>
  resolveNext(params: URLSearchParams, origin: string): string   // safe same-origin path, default '/'
  sendMagicLinkAction(prev: AuthActionState, formData): Promise<AuthActionState>; signOutAction(): Promise<never>
  type AuthActionState = { status: 'idle' } | { status: 'sent'; email } | { status: 'error'; message }
  ```

- [ ] **Step 1: Write failing unit test for resolveNext**

`src/presentation/lib/auth/resolve-next.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveNext } from './resolve-next';

const origin = 'http://localhost:3000';

describe('resolveNext', () => {
  it('uses a same-origin relative next path', () => {
    expect(resolveNext(new URLSearchParams('next=%2Fpayments%2Fnew'), origin)).toBe('/payments/new');
  });

  it('extracts next from redirect_to when present', () => {
    const params = new URLSearchParams({ redirect_to: 'http://localhost:3000/auth/callback?next=%2Fmore' });
    expect(resolveNext(params, origin)).toBe('/more');
  });

  it('falls back to / for missing, absolute, protocol-relative or foreign values', () => {
    expect(resolveNext(new URLSearchParams(''), origin)).toBe('/');
    expect(resolveNext(new URLSearchParams('next=https%3A%2F%2Fevil.example'), origin)).toBe('/');
    expect(resolveNext(new URLSearchParams('next=%2F%2Fevil.example'), origin)).toBe('/');
    expect(resolveNext(new URLSearchParams({ redirect_to: 'https://evil.example/x?next=/more' }), origin)).toBe('/');
  });
});
```

Run: `npm run test -- resolve-next` → Expected: FAIL, cannot resolve `./resolve-next`.

- [ ] **Step 2: Implement resolveNext**

`src/presentation/lib/auth/resolve-next.ts`:

```ts
function safePath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

/** Picks a safe same-origin path to continue to after login. */
export function resolveNext(params: URLSearchParams, origin: string): string {
  const direct = safePath(params.get('next'));
  if (direct) return direct;

  const redirectTo = params.get('redirect_to');
  if (redirectTo) {
    try {
      const url = new URL(redirectTo);
      if (url.origin === origin) {
        const nested = safePath(url.searchParams.get('next'));
        if (nested) return nested;
      }
    } catch {
      // ignore malformed redirect_to
    }
  }
  return '/';
}
```

Run: `npm run test -- resolve-next` → Expected: PASS.

- [ ] **Step 3: Supabase clients**

`src/presentation/lib/supabase/env.ts`:

```ts
export function supabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set');
  return { url, anonKey };
}
```

`src/presentation/lib/supabase/server.ts`:

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabasePublicEnv } from './env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabasePublicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by middleware instead.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user.id;
}
```

`src/presentation/lib/supabase/browser.ts`:

```ts
'use client';
import { createBrowserClient } from '@supabase/ssr';
import { supabasePublicEnv } from './env';

export function createSupabaseBrowserClient() {
  const { url, anonKey } = supabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
```

`src/presentation/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabasePublicEnv } from './env';

const PUBLIC_PREFIXES = ['/login', '/auth'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === '/login') {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}
```

`src/middleware.ts`:

```ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/presentation/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
```

- [ ] **Step 4: Auth actions and login form**

`src/presentation/actions/auth.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/presentation/lib/supabase/server';

export type AuthActionState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string };

const schema = z.object({
  email: z.string().trim().email('กรุณากรอกอีเมลให้ถูกต้อง'),
  next: z.string().default('/'),
});

export async function sendMagicLinkAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = schema.safeParse({ email: formData.get('email'), next: formData.get('next') ?? '/' });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' };
  }
  const next = parsed.data.next.startsWith('/') && !parsed.data.next.startsWith('//') ? parsed.data.next : '/';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return { status: 'error', message: 'ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้งในอีกสักครู่' };
  }
  return { status: 'sent', email: parsed.data.email };
}

export async function signOutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

`src/presentation/components/auth/login-form.tsx` (functional baseline; Task 16 restyles it):

```tsx
'use client';

import { useActionState } from 'react';
import { sendMagicLinkAction, type AuthActionState } from '@/presentation/actions/auth';

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(sendMagicLinkAction, { status: 'idle' });

  if (state.status === 'sent') {
    return (
      <section className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-4">
        <h1 className="text-2xl font-semibold">ตรวจอีเมลของคุณ</h1>
        <p>
          เราส่งลิงก์เข้าสู่ระบบไปที่ <strong>{state.email}</strong> แล้ว กดลิงก์ในอีเมลเพื่อเข้าใช้งาน
        </p>
        <p className="text-sm opacity-70">ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง</p>
      </section>
    );
  }

  const error = state.status === 'error' ? state.message : initialError;

  return (
    <form action={action} className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <div>
        <h1 className="text-3xl font-bold">หนี้ชัด</h1>
        <p className="opacity-70">บันทึกทุกการจ่าย ตรวจสอบทุกยอด</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1">
        <span>อีเมล</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className="h-12 rounded-md border px-3"
          placeholder="you@example.com"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-12 rounded-md bg-black text-white disabled:opacity-50">
        {pending ? 'กำลังส่ง…' : 'ส่งลิงก์เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
```

`src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from '@/presentation/components/auth/login-form';

export const metadata = { title: 'เข้าสู่ระบบ' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={next && next.startsWith('/') ? next : '/'}
      initialError={error === 'link' ? 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่' : null}
    />
  );
}
```

`src/app/auth/callback/route.ts`:

```ts
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveNext } from '@/presentation/lib/auth/resolve-next';
import { createSupabaseServerClient } from '@/presentation/lib/supabase/server';

const OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'recovery', 'invite', 'email_change'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = resolveNext(searchParams, origin);
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  const code = searchParams.get('code');

  const supabase = await createSupabaseServerClient();

  if (tokenHash && rawType && (OTP_TYPES as string[]).includes(rawType)) {
    const { error } = await supabase.auth.verifyOtp({ type: rawType as EmailOtpType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL('/login?error=link', origin));
}
```

- [ ] **Step 5: Protected layouts and placeholders**

```bash
rm -f src/app/page.tsx src/presentation/.gitkeep
```

`src/app/(onboarding)/layout.tsx`:

```tsx
import { requireUserId } from '@/presentation/lib/supabase/server';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return <>{children}</>;
}
```

`src/app/(onboarding)/setup/page.tsx` (placeholder, replaced in Task 17):

```tsx
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { signOutAction } from '@/presentation/actions/auth';
import { requireUserId } from '@/presentation/lib/supabase/server';

export default async function SetupPage() {
  const userId = await requireUserId();
  const loan = await getContainer().getLoan.execute(userId);
  if (loan) redirect('/');
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold">ตั้งค่าเงินกู้</h1>
      <p>ฟอร์มจะมาใน Task 17</p>
      <form action={signOutAction}>
        <button type="submit" className="underline">ออกจากระบบ</button>
      </form>
    </main>
  );
}
```

`src/app/(app)/layout.tsx` (Task 16 wraps this in `AppShell`):

```tsx
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { requireUserId } from '@/presentation/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const loan = await getContainer().getLoan.execute(userId);
  if (!loan) redirect('/setup');
  return <>{children}</>;
}
```

`src/app/(app)/page.tsx` (placeholder, replaced in Task 18):

```tsx
export default function HomePlaceholder() {
  return <main className="p-4">Dashboard มาใน Task 18</main>;
}
```

- [ ] **Step 6: Verify end to end by hand**

```bash
npm run typecheck && npm run lint
npm run dev
```

1. Open http://localhost:3000 → Expected: redirected to `/login?next=%2F`.
2. Enter your email, submit → Expected: "ตรวจอีเมลของคุณ".
3. Open http://127.0.0.1:54324 (Inbucket/Mailpit), open the newest mail, click "เข้าสู่ระบบ" → Expected: lands on `/setup` (no loan yet) showing the placeholder.
4. Click "ออกจากระบบ" → Expected: back on `/login`.
5. Visit `/auth/callback?token_hash=bad&type=email` → Expected: `/login?error=link` with the Thai error message.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): add Supabase SSR auth with magic link, middleware guard and protected layouts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Design foundation — tokens, app shell, bottom nav, formatting view-models

> **REQUIRED SUB-SKILL:** Invoke `frontend-design:frontend-design`, then `impeccable:impeccable`, before writing any file in this task. Use them to decide the palette, type scale, radius, spacing and motion for a calm, trustworthy Thai personal-finance app used one-handed on a phone. Write the resulting tokens into `src/app/globals.css` and summarise them in `docs/design/tokens.md`. Keep every component name, prop and string below unchanged.

**Files:**
- Create: `components.json`, `src/presentation/lib/utils.ts` (shadcn `cn`), `src/presentation/components/ui/*` (shadcn), `src/presentation/components/shell/app-shell.tsx`, `src/presentation/components/shell/bottom-nav.tsx`, `src/presentation/components/shell/page-header.tsx`, `src/presentation/components/shell/primary-action-button.tsx`, `src/presentation/components/shared/money-text.tsx`, `src/presentation/components/shared/empty-state.tsx`, `src/presentation/view-models/format.ts`, `src/presentation/view-models/default-note.ts`, `src/presentation/view-models/error-messages.ts`, `src/presentation/actions/types.ts`, `docs/design/tokens.md`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/presentation/components/auth/login-form.tsx` (restyle only)
- Test: `src/presentation/view-models/format.test.ts`, `src/presentation/view-models/default-note.test.ts`, `src/presentation/view-models/error-messages.test.ts`

**Interfaces:**
- Produces:
  ```ts
  formatBaht(amount: Money | string): string           // "3,000.00 บาท"
  formatAmount(amount: Money | string): string         // "3,000.00"
  formatThaiDate(date: DateOnly | string): string      // "4 ต.ค. 2569"
  formatThaiDateLong(date): string                     // "4 ตุลาคม 2569"
  formatThaiMonthYear(year, month): string             // "ตุลาคม 2569"
  formatThaiDateTime(d: Date): string                  // "4 ต.ค. 2569 16:05" (Asia/Bangkok)
  THAI_MONTHS_SHORT, THAI_MONTHS_LONG, toBuddhistYear(y)
  PAYMENT_METHOD_LABELS: Record<PaymentMethod, string>
  buildDefaultNote(today: DateOnly): string            // "ชำระงวดเดือน ต.ค. 2569"
  messageFor(error: DomainError): string
  type ActionResult<T = void> = { ok: true; data: T } | { ok: false; message: string; code?: DomainErrorCode; fieldErrors?: Record<string, string> }
  failure(error: DomainError): ActionResult<never>; success<T>(data: T): ActionResult<T>
  <AppShell title? children>  <BottomNav/>  <PageHeader title back? action?>  <PrimaryActionButton href label/>  <MoneyText amount size?/>  <EmptyState title description? action?/>
  ```

- [ ] **Step 1: Write failing tests for view-models**

`src/presentation/view-models/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { formatAmount, formatBaht, formatThaiDate, formatThaiDateLong, formatThaiDateTime, formatThaiMonthYear } from './format';

describe('format', () => {
  it('formats baht with grouping and two decimals', () => {
    expect(formatBaht(Money.of('3000'))).toBe('3,000.00 บาท');
    expect(formatBaht('182420.5')).toBe('182,420.50 บาท');
    expect(formatAmount(Money.of('0'))).toBe('0.00');
  });

  it('formats dates in Buddhist era', () => {
    expect(formatThaiDate(DateOnly.of('2026-10-04'))).toBe('4 ต.ค. 2569');
    expect(formatThaiDate('2026-01-31')).toBe('31 ม.ค. 2569');
    expect(formatThaiDateLong('2026-10-04')).toBe('4 ตุลาคม 2569');
    expect(formatThaiMonthYear(2026, 10)).toBe('ตุลาคม 2569');
  });

  it('formats timestamps in Bangkok time', () => {
    expect(formatThaiDateTime(new Date('2026-10-04T09:05:00Z'))).toBe('4 ต.ค. 2569 16:05');
  });
});
```

`src/presentation/view-models/default-note.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { buildDefaultNote } from './default-note';

describe('buildDefaultNote', () => {
  it('names the current month in Thai with Buddhist year', () => {
    expect(buildDefaultNote(DateOnly.of('2026-10-04'))).toBe('ชำระงวดเดือน ต.ค. 2569');
  });
});
```

`src/presentation/view-models/error-messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/domain/shared/errors';
import { messageFor } from './error-messages';

describe('messageFor', () => {
  it('maps known codes to Thai copy', () => {
    expect(messageFor(new DomainError('PAYMENT_ALREADY_VOIDED'))).toBe('รายการนี้ถูกยกเลิกไปแล้ว');
    expect(messageFor(new DomainError('FILE_TOO_LARGE'))).toBe('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
  });

  it('falls back to a generic message for persistence failures', () => {
    expect(messageFor(new DomainError('PERSISTENCE_FAILED', 'raw db text'))).toBe('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  });
});
```

Run: `npm run test -- view-models` → Expected: FAIL, modules missing.

- [ ] **Step 2: Implement view-models and action result type**

`src/presentation/view-models/format.ts`:

```ts
import type { PaymentMethod } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import type { Money } from '@/domain/shared/money';

export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;
export const THAI_MONTHS_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MOBILE_BANKING: 'Mobile Banking',
  COUNTER: 'เคาน์เตอร์ธนาคาร',
  ATM: 'ตู้ ATM',
  OTHER: 'อื่น ๆ',
};

export function toBuddhistYear(year: number): number {
  return year + 543;
}

const amountFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function asString(amount: Money | string): string {
  return typeof amount === 'string' ? amount : amount.toString();
}

export function formatAmount(amount: Money | string): string {
  return amountFormatter.format(Number(asString(amount)));
}

export function formatBaht(amount: Money | string): string {
  return `${formatAmount(amount)} บาท`;
}

function asDateOnly(date: DateOnly | string): DateOnly {
  return typeof date === 'string' ? DateOnly.of(date) : date;
}

export function formatThaiDate(date: DateOnly | string): string {
  const d = asDateOnly(date);
  return `${d.day} ${THAI_MONTHS_SHORT[d.month - 1]} ${toBuddhistYear(d.year)}`;
}

export function formatThaiDateLong(date: DateOnly | string): string {
  const d = asDateOnly(date);
  return `${d.day} ${THAI_MONTHS_LONG[d.month - 1]} ${toBuddhistYear(d.year)}`;
}

export function formatThaiMonthYear(year: number, month: number): string {
  return `${THAI_MONTHS_LONG[month - 1]} ${toBuddhistYear(year)}`;
}

const bangkokParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatThaiDateTime(date: Date): string {
  const parts = Object.fromEntries(bangkokParts.formatToParts(date).map((p) => [p.type, p.value]));
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${toBuddhistYear(year)} ${parts.hour}:${parts.minute}`;
}
```

`src/presentation/view-models/default-note.ts`:

```ts
import type { DateOnly } from '@/domain/shared/date-only';
import { THAI_MONTHS_SHORT, toBuddhistYear } from './format';

export function buildDefaultNote(today: DateOnly): string {
  return `ชำระงวดเดือน ${THAI_MONTHS_SHORT[today.month - 1]} ${toBuddhistYear(today.year)}`;
}
```

`src/presentation/view-models/error-messages.ts`:

```ts
import type { DomainError, DomainErrorCode } from '@/domain/shared/errors';

const MESSAGES: Record<DomainErrorCode, string> = {
  INVALID_AMOUNT: 'จำนวนเงินไม่ถูกต้อง',
  INVALID_DATE: 'วันที่ไม่ถูกต้อง',
  FUTURE_DATE: 'วันที่ชำระต้องไม่เป็นวันในอนาคต',
  INVALID_NAME: 'กรุณาระบุชื่อเงินกู้',
  INVALID_PAYMENT_METHOD: 'กรุณาเลือกช่องทางการชำระ',
  REASON_REQUIRED: 'กรุณาระบุเหตุผล',
  LOAN_NOT_FOUND: 'ไม่พบข้อมูลเงินกู้',
  LOAN_ALREADY_EXISTS: 'มีข้อมูลเงินกู้อยู่แล้ว',
  PAYMENT_NOT_FOUND: 'ไม่พบรายการชำระ',
  PAYMENT_ALREADY_VOIDED: 'รายการนี้ถูกยกเลิกไปแล้ว',
  EVIDENCE_NOT_FOUND: 'ไม่พบไฟล์หลักฐาน',
  UNSUPPORTED_FILE_TYPE: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF',
  FILE_TOO_LARGE: 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB',
  INVALID_EVIDENCE_PATH: 'ไฟล์หลักฐานไม่ถูกต้อง กรุณาแนบใหม่',
  PERSISTENCE_FAILED: 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  STORAGE_FAILED: 'อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง',
};

export function messageFor(error: DomainError): string {
  return MESSAGES[error.code] ?? error.message;
}
```

`src/presentation/actions/types.ts`:

```ts
import type { DomainError, DomainErrorCode } from '@/domain/shared/errors';
import { messageFor } from '@/presentation/view-models/error-messages';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: DomainErrorCode; fieldErrors?: Record<string, string> };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(error: DomainError): ActionResult<never> {
  return { ok: false, message: messageFor(error), code: error.code };
}
```

Run: `npm run test -- view-models` → Expected: PASS.

- [ ] **Step 3: shadcn/ui setup pointed at the presentation layer**

```bash
npx shadcn@latest init -d -y
```

Then overwrite `components.json` with:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/presentation/components",
    "utils": "@/presentation/lib/utils",
    "ui": "@/presentation/components/ui",
    "lib": "@/presentation/lib",
    "hooks": "@/presentation/hooks"
  },
  "iconLibrary": "lucide"
}
```

If `init` created `src/lib/utils.ts`, move it: `mkdir -p src/presentation/lib && git mv -f src/lib/utils.ts src/presentation/lib/utils.ts 2>/dev/null || mv src/lib/utils.ts src/presentation/lib/utils.ts; rmdir src/lib 2>/dev/null || true`.

```bash
npx shadcn@latest add button input label textarea select card badge dialog skeleton sonner separator -y -o
npm install next-themes   # the generated ui/sonner.tsx imports useTheme from next-themes
npm run typecheck
```

Expected: components under `src/presentation/components/ui/`, typecheck clean. If any generated file still imports from `@/lib/utils` or `@/components/ui/...`, fix the import to `@/presentation/lib/utils` / `@/presentation/components/ui/...`.

- [ ] **Step 4: Tokens, fonts, root layout**

Apply the design direction from the skills to `src/app/globals.css` (keep the shadcn variable names so `ui/*` keep working; set `--font-sans` to the Thai font variable). Record the final values in `docs/design/tokens.md` (palette, type scale, spacing, radius, motion durations, and why).

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { Toaster } from '@/presentation/components/ui/sonner';
import './globals.css';

const font = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'หนี้ชัด', template: '%s · หนี้ชัด' },
  description: 'บันทึกทุกการจ่าย ตรวจสอบทุกยอด',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'หนี้ชัด', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff', // replace with the token chosen by the design pass
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={font.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Shell components**

`src/presentation/components/shell/bottom-nav.tsx`:

```tsx
'use client';

import { Home, MoreHorizontal, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/presentation/lib/utils';

const ITEMS = [
  { href: '/', label: 'หน้าแรก', icon: Home, match: (p: string) => p === '/' },
  { href: '/payments', label: 'รายการ', icon: ReceiptText, match: (p: string) => p.startsWith('/payments') },
  { href: '/more', label: 'เพิ่มเติม', icon: MoreHorizontal, match: (p: string) => p.startsWith('/more') },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-xs',
                  active ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`src/presentation/components/shell/app-shell.tsx`:

```tsx
import { BottomNav } from './bottom-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

`src/presentation/components/shell/page-header.tsx`:

```tsx
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} aria-label="ย้อนกลับ" className="-ml-2 inline-flex size-10 items-center justify-center rounded-full">
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
      )}
      <h1 className="flex-1 text-xl font-semibold">{title}</h1>
      {action}
    </header>
  );
}
```

`src/presentation/components/shell/primary-action-button.tsx`:

```tsx
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/presentation/components/ui/button';
import { cn } from '@/presentation/lib/utils';

export function PrimaryActionButton({ href, label }: { href: string; label: string }) {
  return (
    <div className="fixed inset-x-0 z-30 px-4" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.75rem)' }}>
      <Link href={href} className={cn(buttonVariants({ size: 'lg' }), 'mx-auto flex h-14 w-full max-w-md text-base shadow-lg')}>
        <Plus className="size-5" aria-hidden />
        {label}
      </Link>
    </div>
  );
}
```

`src/presentation/components/shared/money-text.tsx`:

```tsx
import type { Money } from '@/domain/shared/money';
import { formatAmount } from '@/presentation/view-models/format';
import { cn } from '@/presentation/lib/utils';

export function MoneyText({ amount, size = 'md', className }: { amount: Money | string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl font-semibold', xl: 'text-4xl font-bold tracking-tight' };
  return (
    <span className={cn('tabular-nums', sizes[size], className)}>
      {formatAmount(amount)} <span className="text-[0.7em] font-normal text-muted-foreground">บาท</span>
    </span>
  );
}
```

`src/presentation/components/shared/empty-state.tsx`:

```tsx
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
```

Update `src/app/(app)/layout.tsx` to return `<AppShell>{children}</AppShell>` (import from `@/presentation/components/shell/app-shell`).

Restyle `login-form.tsx` using `Button`, `Input`, `Label` from `ui/` and the tokens. Keep all strings, the `next` hidden input, `role="alert"` and the pending label.

- [ ] **Step 6: Verify**

```bash
npm run test && npm run lint && npm run typecheck
npm run dev
```

Open http://localhost:3000/login on a 390px-wide viewport (DevTools device toolbar): Thai font loads, form is usable one-handed, no horizontal scroll. Log in → `/setup` placeholder renders. Temporarily visit `/` after creating a loan in Task 17 to see the shell; for now confirm no runtime errors in the console.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): add design tokens, app shell, bottom nav and Thai formatting view-models

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 17: Loan setup and edit screens

> **REQUIRED SUB-SKILL:** `frontend-design:frontend-design` then `impeccable:impeccable` before writing components. Keep names, props, labels and behavior below.

**Files:**
- Create: `src/presentation/forms/field-errors.ts`, `src/presentation/forms/loan-schema.ts`, `src/presentation/actions/loan.ts`, `src/presentation/components/loan/loan-form.tsx`, `src/app/(app)/more/loan/page.tsx`
- Modify: `src/app/(onboarding)/setup/page.tsx` (replace placeholder)
- Test: `src/presentation/forms/loan-schema.test.ts`

**Interfaces:**
- Produces:
  ```ts
  MONEY_PATTERN, ISO_DATE_PATTERN, moneyString, optionalMoneyString, isoDateString (zod)
  loanFormSchema; type LoanFormValues = { name; loanNumber; openingBalance; openingBalanceDate; defaultAmount }  // all strings
  formDataToLoanValues(fd: FormData): LoanFormValues
  zodFieldErrors(error: ZodError): Record<string, string>
  type LoanActionState = { ok: false; message?: string; fieldErrors?: Record<string,string>; values?: LoanFormValues } | { ok: true }
  saveLoanAction(prev: LoanActionState, formData: FormData): Promise<LoanActionState>   // redirects on success
  <LoanForm loanId? defaults submitLabel />
  ```
- Form labels (exact, used by E2E): `ชื่อเงินกู้`, `เลขสัญญา (ถ้ามี)`, `ยอดหนี้ตั้งต้น`, `ยอดนี้เป็นของวันที่`, `ยอดจ่ายประจำ (ถ้ามี)`; submit button `บันทึก`.

- [ ] **Step 1: Write failing test**

`src/presentation/forms/loan-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formDataToLoanValues, loanFormSchema } from './loan-schema';
import { zodFieldErrors } from './field-errors';

describe('loanFormSchema', () => {
  const valid = { name: 'กยศ.', loanNumber: '', openingBalance: '195,420.50', openingBalanceDate: '2026-06-30', defaultAmount: '' };

  it('accepts valid values including comma-grouped money and empty optionals', () => {
    expect(loanFormSchema.safeParse(valid).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...valid, defaultAmount: '3000' }).success).toBe(true);
  });

  it('reports per-field Thai errors', () => {
    const r = loanFormSchema.safeParse({ ...valid, name: ' ', openingBalance: '1.234', openingBalanceDate: '30/06/2026', defaultAmount: 'x' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const errors = zodFieldErrors(r.error);
    expect(errors.name).toBe('กรุณาระบุชื่อเงินกู้');
    expect(errors.openingBalance).toBe('กรอกตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง');
    expect(errors.openingBalanceDate).toBe('กรุณาเลือกวันที่');
    expect(errors.defaultAmount).toBe('กรอกตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง');
  });

  it('reads FormData into string values', () => {
    const fd = new FormData();
    fd.set('name', 'x');
    fd.set('openingBalance', '1');
    fd.set('openingBalanceDate', '2026-01-01');
    expect(formDataToLoanValues(fd)).toEqual({ name: 'x', loanNumber: '', openingBalance: '1', openingBalanceDate: '2026-01-01', defaultAmount: '' });
  });
});
```

Run: `npm run test -- loan-schema` → Expected: FAIL, modules missing.

- [ ] **Step 2: Implement schemas and helpers**

`src/presentation/forms/field-errors.ts`:

```ts
import type { ZodError } from 'zod';

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
```

`src/presentation/forms/loan-schema.ts`:

```ts
import { z } from 'zod';

export const MONEY_PATTERN = /^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_MESSAGE = 'กรอกตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง';

export const moneyString = z.string().trim().min(1, 'กรุณากรอกจำนวนเงิน').regex(MONEY_PATTERN, MONEY_MESSAGE);
export const optionalMoneyString = z.string().trim().refine((v) => v === '' || MONEY_PATTERN.test(v), MONEY_MESSAGE);
export const isoDateString = z.string().regex(ISO_DATE_PATTERN, 'กรุณาเลือกวันที่');

export const loanFormSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อเงินกู้').max(100, 'ชื่อยาวเกินไป'),
  loanNumber: z.string().trim().max(50, 'เลขสัญญายาวเกินไป'),
  openingBalance: moneyString,
  openingBalanceDate: isoDateString,
  defaultAmount: optionalMoneyString,
});

export type LoanFormValues = z.infer<typeof loanFormSchema>;

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

export function formDataToLoanValues(fd: FormData): LoanFormValues {
  return {
    name: str(fd, 'name'),
    loanNumber: str(fd, 'loanNumber'),
    openingBalance: str(fd, 'openingBalance'),
    openingBalanceDate: str(fd, 'openingBalanceDate'),
    defaultAmount: str(fd, 'defaultAmount'),
  };
}
```

Run: `npm run test -- loan-schema` → Expected: PASS.

- [ ] **Step 3: Server action**

`src/presentation/actions/loan.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { zodFieldErrors } from '@/presentation/forms/field-errors';
import { formDataToLoanValues, loanFormSchema, type LoanFormValues } from '@/presentation/forms/loan-schema';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { messageFor } from '@/presentation/view-models/error-messages';

export type LoanActionState =
  | { ok: false; message?: string; fieldErrors?: Record<string, string>; values?: LoanFormValues }
  | { ok: true };

export async function saveLoanAction(_prev: LoanActionState, formData: FormData): Promise<LoanActionState> {
  const userId = await requireUserId();
  const values = formDataToLoanValues(formData);
  const parsed = loanFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  }

  const v = parsed.data;
  const input = {
    userId,
    name: v.name,
    loanNumber: v.loanNumber || null,
    openingBalance: v.openingBalance,
    openingBalanceDate: v.openingBalanceDate,
    defaultAmount: v.defaultAmount || null,
  };

  const loanIdRaw = formData.get('loanId');
  const loanId = typeof loanIdRaw === 'string' && loanIdRaw ? loanIdRaw : null;
  const container = getContainer();
  const result = loanId
    ? await container.updateLoan.execute({ ...input, loanId })
    : await container.setupLoan.execute(input);

  if (!result.ok) {
    return { ok: false, message: messageFor(result.error), values };
  }

  revalidatePath('/', 'layout');
  redirect(loanId ? '/more' : '/');
}
```

- [ ] **Step 4: Loan form component and pages**

`src/presentation/components/loan/loan-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { saveLoanAction, type LoanActionState } from '@/presentation/actions/loan';
import type { LoanFormValues } from '@/presentation/forms/loan-schema';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';

interface Props {
  loanId?: string;
  defaults: LoanFormValues;
  submitLabel: string;
}

function Field({
  id, label, hint, error, children,
}: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function LoanForm({ loanId, defaults, submitLabel }: Props) {
  const [state, action, pending] = useActionState<LoanActionState, FormData>(saveLoanAction, { ok: false });
  const values = (!state.ok && state.values) || defaults;
  const errors = (!state.ok && state.fieldErrors) || {};

  return (
    <form action={action} className="flex flex-col gap-5">
      {loanId && <input type="hidden" name="loanId" value={loanId} />}

      <Field id="name" label="ชื่อเงินกู้" error={errors.name}>
        <Input id="name" name="name" defaultValue={values.name} required maxLength={100} className="h-12" />
      </Field>

      <Field id="loanNumber" label="เลขสัญญา (ถ้ามี)" error={errors.loanNumber}>
        <Input id="loanNumber" name="loanNumber" defaultValue={values.loanNumber} maxLength={50} className="h-12" />
      </Field>

      <Field
        id="openingBalance"
        label="ยอดหนี้ตั้งต้น"
        hint="ดูจากยอดหนี้คงเหลือล่าสุดในระบบ กยศ."
        error={errors.openingBalance}
      >
        <Input id="openingBalance" name="openingBalance" inputMode="decimal" defaultValue={values.openingBalance} required className="h-12 text-lg tabular-nums" placeholder="0.00" />
      </Field>

      <Field id="openingBalanceDate" label="ยอดนี้เป็นของวันที่" hint="รายการชำระหลังวันนี้จะถูกนำมาหักจากยอดตั้งต้น" error={errors.openingBalanceDate}>
        <Input id="openingBalanceDate" name="openingBalanceDate" type="date" defaultValue={values.openingBalanceDate} required className="h-12" />
      </Field>

      <Field id="defaultAmount" label="ยอดจ่ายประจำ (ถ้ามี)" hint="ใช้เติมให้อัตโนมัติตอนบันทึกการชำระ" error={errors.defaultAmount}>
        <Input id="defaultAmount" name="defaultAmount" inputMode="decimal" defaultValue={values.defaultAmount} className="h-12 tabular-nums" placeholder="เช่น 3000" />
      </Field>

      {!state.ok && state.message && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" size="lg" className="h-12" disabled={pending}>
        {pending ? 'กำลังบันทึก…' : submitLabel}
      </Button>
    </form>
  );
}
```

Replace `src/app/(onboarding)/setup/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { LoanForm } from '@/presentation/components/loan/loan-form';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'ตั้งค่าเงินกู้' };

export default async function SetupPage() {
  const userId = await requireUserId();
  const container = getContainer();
  const loan = await container.getLoan.execute(userId);
  if (loan) redirect('/');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">ตั้งค่าเงินกู้</h1>
        <p className="text-muted-foreground">กรอกครั้งเดียว แก้ไขภายหลังได้ที่เมนู “เพิ่มเติม”</p>
      </div>
      <LoanForm
        defaults={{ name: 'กยศ. ของฉัน', loanNumber: '', openingBalance: '', openingBalanceDate: container.clock.today().iso, defaultAmount: '' }}
        submitLabel="บันทึก"
      />
    </main>
  );
}
```

`src/app/(app)/more/loan/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { LoanForm } from '@/presentation/components/loan/loan-form';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'ตั้งค่าเงินกู้' };

export default async function EditLoanPage() {
  const userId = await requireUserId();
  const loan = await getContainer().getLoan.execute(userId);
  if (!loan) redirect('/setup');

  return (
    <>
      <PageHeader title="ตั้งค่าเงินกู้" back="/more" />
      <LoanForm
        loanId={loan.id}
        defaults={{
          name: loan.name,
          loanNumber: loan.loanNumber ?? '',
          openingBalance: loan.openingBalance.toString(),
          openingBalanceDate: loan.openingBalanceDate.iso,
          defaultAmount: loan.defaultAmount?.toString() ?? '',
        }}
        submitLabel="บันทึกการแก้ไข"
      />
    </>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run test && npm run lint && npm run typecheck
npm run dev
```

Log in, land on `/setup`, submit with an invalid amount `1.234` → Thai field error, values preserved. Submit valid data → redirected to `/` (placeholder dashboard) inside the app shell with bottom nav. Visit `/more/loan` → form prefilled; change name → saved and redirected to `/more` (404 until Task 22 is fine; use back).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(loan): add loan setup and edit screens with validated server action

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: Dashboard

> **REQUIRED SUB-SKILL:** `frontend-design:frontend-design` then `impeccable:impeccable` before writing components. The ledger balance is the hero number; the primary action must be reachable with a thumb.

**Files:**
- Create: `src/presentation/components/dashboard/dashboard-view.tsx`, `src/presentation/components/dashboard/stat-card.tsx`
- Modify: `src/app/(app)/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `GetDashboard` (Task 11), `MoneyText`, `EmptyState`, `PrimaryActionButton`, `formatBaht`, `formatThaiDate`.
- Produces: `<DashboardView view: DashboardView />` (server component), `<StatCard label hint? children />`.
- Copy (exact): `ยอดคงเหลือตามบัญชีของฉัน`, `ตั้งต้น {amount} ณ {date}`, `ชำระแล้วทั้งหมด`, `จำนวนครั้ง`, `{n} ครั้ง`, `งวดล่าสุด`, `บันทึกแล้ว`, `ยังไม่มีรายการชำระ`, `กดปุ่มด้านล่างเพื่อบันทึกการชำระครั้งแรก`, FAB `บันทึกการชำระ`.

- [ ] **Step 1: Components**

`src/presentation/components/dashboard/stat-card.tsx`:

```tsx
import { Card, CardContent } from '@/presentation/components/ui/card';

export function StatCard({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div>{children}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
```

`src/presentation/components/dashboard/dashboard-view.tsx`:

```tsx
import Link from 'next/link';
import type { DashboardView as DashboardData } from '@/application/use-cases/query/get-dashboard';
import { Badge } from '@/presentation/components/ui/badge';
import { EmptyState } from '@/presentation/components/shared/empty-state';
import { MoneyText } from '@/presentation/components/shared/money-text';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { PrimaryActionButton } from '@/presentation/components/shell/primary-action-button';
import { formatBaht, formatThaiDate, PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';
import { StatCard } from './stat-card';

export function DashboardView({ view }: { view: DashboardData }) {
  const { loan, summary } = view;
  const latest = summary.latestPayment;

  return (
    <>
      <PageHeader title={loan.name} />
      <div className="flex flex-col gap-3">
        <StatCard
          label="ยอดคงเหลือตามบัญชีของฉัน"
          hint={`ตั้งต้น ${formatBaht(loan.openingBalance)} ณ ${formatThaiDate(loan.openingBalanceDate)}`}
        >
          <MoneyText amount={summary.ledgerBalance} size="xl" />
        </StatCard>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="ชำระแล้วทั้งหมด">
            <MoneyText amount={summary.totalPaid} size="lg" />
          </StatCard>
          <StatCard label="จำนวนครั้ง">
            <span className="text-2xl font-semibold tabular-nums">{summary.paymentCount}</span>{' '}
            <span className="text-muted-foreground">ครั้ง</span>
          </StatCard>
        </div>

        <StatCard label="งวดล่าสุด">
          {latest ? (
            <Link href={`/payments/${latest.id}`} className="flex items-center justify-between gap-3 py-1">
              <div className="flex flex-col">
                <span className="font-medium">{formatThaiDate(latest.paidAt)}</span>
                <span className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[latest.paymentMethod]}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <MoneyText amount={latest.amount} size="lg" />
                <Badge variant="secondary">บันทึกแล้ว</Badge>
              </div>
            </Link>
          ) : (
            <EmptyState title="ยังไม่มีรายการชำระ" description="กดปุ่มด้านล่างเพื่อบันทึกการชำระครั้งแรก" />
          )}
        </StatCard>
      </div>
      <PrimaryActionButton href="/payments/new" label="บันทึกการชำระ" />
    </>
  );
}
```

- [ ] **Step 2: Page**

Replace `src/app/(app)/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { DashboardView } from '@/presentation/components/dashboard/dashboard-view';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userId = await requireUserId();
  const result = await getContainer().getDashboard.execute({ userId });
  if (!result.ok) redirect('/setup');
  return <DashboardView view={result.value} />;
}
```

- [ ] **Step 3: Verify**

`npm run lint && npm run typecheck`, then `npm run dev`: `/` shows the loan name, opening balance as ledger balance, `0.00` paid, `0 ครั้ง`, empty latest card, and the FAB above the bottom nav without overlapping it at 390×844.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dashboard): add ledger dashboard with latest payment and primary action

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 19: Record a payment — form, camera/gallery evidence picker, client-side resize, upload

> **REQUIRED SUB-SKILL:** `frontend-design:frontend-design` then `impeccable:impeccable` before writing components. Target: open → fill → attach → save in under 60 seconds, one-handed.

**Files:**
- Create: `src/presentation/forms/payment-schema.ts`, `src/presentation/actions/payment.ts`, `src/presentation/lib/resize-image.ts`, `src/presentation/lib/upload-evidence.ts`, `src/presentation/components/evidence/evidence-picker.tsx`, `src/presentation/components/payments/payment-form.tsx`, `src/app/(app)/payments/new/page.tsx`
- Test: `src/presentation/forms/payment-schema.test.ts`

**Interfaces:**
- Consumes: `PrepareEvidenceUpload`, `RecordPayment`, `CorrectPayment`, `VoidPayment` (Tasks 9–10) via container; `UploadedEvidenceInput` type; `buildDefaultNote`; `ActionResult`.
- Produces:
  ```ts
  paymentFormSchema; correctionFormSchema (reason required)
  type PaymentFormValues = { paidAt; amount; paymentMethod: PaymentMethod; referenceNo; notes; reason }   // all strings
  prepareUploadAction(input: { paymentId: string|null; mimeType; sizeBytes }): Promise<ActionResult<PreparedUpload>>
  recordPaymentAction(input: { values: PaymentFormValues; paymentId: string|null; evidence: UploadedEvidenceInput[] }): Promise<ActionResult<{ paymentId }>>
  correctPaymentAction(input: { originalPaymentId; newPaymentId: string|null; values; evidence }): Promise<ActionResult<{ paymentId }>>
  voidPaymentAction(input: { paymentId; reason }): Promise<ActionResult<void>>
  prepareForUpload(file: File): Promise<{ blob: Blob; mimeType: string }>   // resizes images to ≤1600px JPEG q0.85
  interface PendingFile { id; blob: Blob; name; mimeType; previewUrl: string|null }
  uploadEvidence(files: PendingFile[], paymentId: string|null): Promise<{ paymentId: string|null; uploaded: UploadedEvidenceInput[] }>
  <EvidencePicker files onChange disabled? />      // camera input data-testid="camera-input", gallery input data-testid="gallery-input"; thumbnails alt "สลิป {n}"
  <PaymentForm mode: 'create'|'correct' defaults originalPaymentId? existingEvidenceCount? />
  ```
- Labels (exact, used by E2E): `วันที่ชำระ`, `จำนวนเงิน`, `ช่องทางการชำระ`, `เลขอ้างอิง`, `หมายเหตุ`, `เหตุผลที่แก้ไข`; buttons `ถ่ายรูปสลิป`, `เลือกจากเครื่อง`, submit `บันทึก`.

- [ ] **Step 1: Write failing schema test**

`src/presentation/forms/payment-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { correctionFormSchema, paymentFormSchema } from './payment-schema';

const valid = { paidAt: '2026-10-04', amount: '3,000', paymentMethod: 'MOBILE_BANKING', referenceNo: '', notes: '', reason: '' };

describe('payment schemas', () => {
  it('accepts a valid payment form', () => {
    expect(paymentFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown method and bad amount', () => {
    expect(paymentFormSchema.safeParse({ ...valid, paymentMethod: 'CASH' }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...valid, amount: '-5' }).success).toBe(false);
  });

  it('requires a reason only for corrections', () => {
    expect(paymentFormSchema.safeParse(valid).success).toBe(true);
    const r = correctionFormSchema.safeParse(valid);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('กรุณาระบุเหตุผลที่แก้ไข');
  });
});
```

Run: `npm run test -- payment-schema` → Expected: FAIL.

- [ ] **Step 2: Schema**

`src/presentation/forms/payment-schema.ts`:

```ts
import { z } from 'zod';
import { PAYMENT_METHODS } from '@/domain/payment/payment';
import { isoDateString, moneyString } from './loan-schema';

export const paymentFormSchema = z.object({
  paidAt: isoDateString,
  amount: moneyString,
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'กรุณาเลือกช่องทางการชำระ' }),
  referenceNo: z.string().trim().max(100, 'เลขอ้างอิงยาวเกินไป'),
  notes: z.string().trim().max(500, 'หมายเหตุยาวเกินไป'),
  reason: z.string().trim().max(500, 'เหตุผลยาวเกินไป'),
});

export const correctionFormSchema = paymentFormSchema.extend({
  reason: z.string().trim().min(1, 'กรุณาระบุเหตุผลที่แก้ไข').max(500, 'เหตุผลยาวเกินไป'),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
```

Run: `npm run test -- payment-schema` → Expected: PASS.

- [ ] **Step 3: Server actions**

`src/presentation/actions/payment.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getContainer } from '@/infrastructure/container';
import type { UploadedEvidenceInput } from '@/application/use-cases/payment/evidence-input';
import type { PreparedUpload } from '@/application/use-cases/payment/prepare-evidence-upload';
import { DomainError } from '@/domain/shared/errors';
import { zodFieldErrors } from '@/presentation/forms/field-errors';
import { correctionFormSchema, paymentFormSchema, type PaymentFormValues } from '@/presentation/forms/payment-schema';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { failure, success, type ActionResult } from './types';

function revalidateLedger() {
  revalidatePath('/', 'layout');
}

export async function prepareUploadAction(input: {
  paymentId: string | null;
  mimeType: string;
  sizeBytes: number;
}): Promise<ActionResult<PreparedUpload>> {
  const userId = await requireUserId();
  const result = await getContainer().prepareEvidenceUpload.execute({ userId, ...input });
  return result.ok ? success(result.value) : failure(result.error);
}

export async function recordPaymentAction(input: {
  values: PaymentFormValues;
  paymentId: string | null;
  evidence: UploadedEvidenceInput[];
}): Promise<ActionResult<{ paymentId: string }>> {
  const userId = await requireUserId();
  const parsed = paymentFormSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', fieldErrors: zodFieldErrors(parsed.error) };

  const container = getContainer();
  const loan = await container.getLoan.execute(userId);
  if (!loan) return failure(new DomainError('LOAN_NOT_FOUND'));

  const v = parsed.data;
  const result = await container.recordPayment.execute({
    userId,
    loanId: loan.id,
    paymentId: input.paymentId,
    paidAt: v.paidAt,
    amount: v.amount,
    paymentMethod: v.paymentMethod,
    referenceNo: v.referenceNo || null,
    notes: v.notes || null,
    evidence: input.evidence,
  });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(result.value);
}

export async function correctPaymentAction(input: {
  originalPaymentId: string;
  newPaymentId: string | null;
  values: PaymentFormValues;
  evidence: UploadedEvidenceInput[];
}): Promise<ActionResult<{ paymentId: string }>> {
  const userId = await requireUserId();
  const parsed = correctionFormSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', fieldErrors: zodFieldErrors(parsed.error) };

  const v = parsed.data;
  const result = await getContainer().correctPayment.execute({
    userId,
    originalPaymentId: input.originalPaymentId,
    newPaymentId: input.newPaymentId,
    reason: v.reason,
    paidAt: v.paidAt,
    amount: v.amount,
    paymentMethod: v.paymentMethod,
    referenceNo: v.referenceNo || null,
    notes: v.notes || null,
    newEvidence: input.evidence,
  });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(result.value);
}

export async function voidPaymentAction(input: { paymentId: string; reason: string }): Promise<ActionResult<void>> {
  const userId = await requireUserId();
  const result = await getContainer().voidPayment.execute({ userId, ...input });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(undefined);
}
```

- [ ] **Step 4: Client helpers — resize and upload**

`src/presentation/lib/resize-image.ts`:

```ts
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const SKIP_RESIZE_UNDER_BYTES = 2 * 1024 * 1024;

export async function prepareForUpload(file: File): Promise<{ blob: Blob; mimeType: string }> {
  if (!file.type.startsWith('image/')) return { blob: file, mimeType: file.type };

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_SIDE / longest);
    const alreadySmall = scale === 1 && file.size <= SKIP_RESIZE_UNDER_BYTES;
    const supportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (alreadySmall && supportedType) return { blob: file, mimeType: file.type };

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', JPEG_QUALITY),
    );
    return { blob, mimeType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}
```

`src/presentation/lib/upload-evidence.ts`:

```ts
'use client';

import type { UploadedEvidenceInput } from '@/application/use-cases/payment/evidence-input';
import { prepareUploadAction } from '@/presentation/actions/payment';
import { createSupabaseBrowserClient } from './supabase/browser';

export interface PendingFile {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
  previewUrl: string | null;
}

export class UploadError extends Error {}

export async function uploadEvidence(
  files: readonly PendingFile[],
  paymentId: string | null,
): Promise<{ paymentId: string | null; uploaded: UploadedEvidenceInput[] }> {
  if (files.length === 0) return { paymentId, uploaded: [] };
  const supabase = createSupabaseBrowserClient();
  let currentPaymentId = paymentId;
  const uploaded: UploadedEvidenceInput[] = [];

  for (const file of files) {
    const prepared = await prepareUploadAction({ paymentId: currentPaymentId, mimeType: file.mimeType, sizeBytes: file.blob.size });
    if (!prepared.ok) throw new UploadError(prepared.message);
    currentPaymentId = prepared.data.paymentId;

    const { error } = await supabase.storage
      .from('evidence')
      .uploadToSignedUrl(prepared.data.storagePath, prepared.data.token, file.blob, { contentType: file.mimeType });
    if (error) throw new UploadError(error.message);

    uploaded.push({
      fileId: prepared.data.fileId,
      storagePath: prepared.data.storagePath,
      mimeType: file.mimeType,
      sizeBytes: file.blob.size,
      originalFilename: file.name,
    });
  }
  return { paymentId: currentPaymentId, uploaded };
}
```

- [ ] **Step 5: Evidence picker**

`src/presentation/components/evidence/evidence-picker.tsx`:

```tsx
'use client';

import { Camera, FileText, Images, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { MAX_EVIDENCE_BYTES } from '@/domain/evidence/evidence';
import { Button } from '@/presentation/components/ui/button';
import { prepareForUpload } from '@/presentation/lib/resize-image';
import type { PendingFile } from '@/presentation/lib/upload-evidence';

interface Props {
  files: PendingFile[];
  onChange: (files: PendingFile[]) => void;
  disabled?: boolean;
}

export function EvidencePicker({ files, onChange, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
    // revoke only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const added: PendingFile[] = [];
    for (const file of Array.from(list)) {
      try {
        const { blob, mimeType } = await prepareForUpload(file);
        if (blob.size > MAX_EVIDENCE_BYTES) {
          toast.error(`ไฟล์ ${file.name} ใหญ่เกิน 5 MB`);
          continue;
        }
        added.push({
          id: crypto.randomUUID(),
          blob,
          name: file.name,
          mimeType,
          previewUrl: mimeType.startsWith('image/') ? URL.createObjectURL(blob) : null,
        });
      } catch {
        toast.error(`อ่านไฟล์ ${file.name} ไม่ได้`);
      }
    }
    onChange([...files, ...added]);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  }

  function remove(id: string) {
    const target = files.find((f) => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={cameraRef}
        data-testid="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void addFiles(e.target.files)}
        disabled={disabled}
      />
      <input
        ref={galleryRef}
        data-testid="gallery-input"
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        onChange={(e) => void addFiles(e.target.files)}
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" className="h-14" onClick={() => cameraRef.current?.click()} disabled={disabled}>
          <Camera className="size-5" aria-hidden /> ถ่ายรูปสลิป
        </Button>
        <Button type="button" size="lg" variant="outline" className="h-14" onClick={() => galleryRef.current?.click()} disabled={disabled}>
          <Images className="size-5" aria-hidden /> เลือกจากเครื่อง
        </Button>
      </div>
      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <li key={f.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {f.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.previewUrl} alt={`สลิป ${i + 1}`} className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs">
                  <FileText className="size-6" aria-hidden />
                  <span className="line-clamp-2">{f.name}</span>
                </div>
              )}
              <button
                type="button"
                aria-label={`ลบไฟล์ ${i + 1}`}
                onClick={() => remove(f.id)}
                className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background/90 shadow"
                disabled={disabled}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Payment form**

`src/presentation/components/payments/payment-form.tsx`:

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/domain/payment/payment';
import { correctPaymentAction, recordPaymentAction } from '@/presentation/actions/payment';
import { EvidencePicker } from '@/presentation/components/evidence/evidence-picker';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { correctionFormSchema, paymentFormSchema, type PaymentFormValues } from '@/presentation/forms/payment-schema';
import { uploadEvidence, UploadError, type PendingFile } from '@/presentation/lib/upload-evidence';
import { PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';

interface Props {
  mode: 'create' | 'correct';
  defaults: PaymentFormValues;
  originalPaymentId?: string;
  existingEvidenceCount?: number;
}

export function PaymentForm({ mode, defaults, originalPaymentId, existingEvidenceCount = 0 }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(mode === 'correct' ? correctionFormSchema : paymentFormSchema),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;

  async function onSubmit(values: PaymentFormValues) {
    setBusy(true);
    try {
      const { paymentId, uploaded } = await uploadEvidence(files, null);
      const result =
        mode === 'create'
          ? await recordPaymentAction({ values, paymentId, evidence: uploaded })
          : await correctPaymentAction({ originalPaymentId: originalPaymentId!, newPaymentId: paymentId, values, evidence: uploaded });

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof PaymentFormValues, { message });
          }
        }
        toast.error(result.message);
        return;
      }
      toast.success(mode === 'create' ? 'บันทึกการชำระแล้ว' : 'แก้ไขรายการแล้ว');
      router.push(mode === 'create' ? '/payments' : `/payments/${result.data.paymentId}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof UploadError ? 'อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง' : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  const noEvidence = files.length === 0 && existingEvidenceCount === 0;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paidAt">วันที่ชำระ</Label>
        <Input id="paidAt" type="date" className="h-12" {...form.register('paidAt')} />
        {errors.paidAt && <p role="alert" className="text-sm text-destructive">{errors.paidAt.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">จำนวนเงิน</Label>
        <Input id="amount" inputMode="decimal" placeholder="0.00" className="h-14 text-2xl tabular-nums" {...form.register('amount')} />
        {errors.amount && <p role="alert" className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentMethod">ช่องทางการชำระ</Label>
        <select
          id="paymentMethod"
          className="h-12 rounded-md border border-input bg-background px-3 text-base"
          {...form.register('paymentMethod')}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
        {errors.paymentMethod && <p role="alert" className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="referenceNo">เลขอ้างอิง</Label>
        <Input id="referenceNo" autoComplete="off" className="h-12" {...form.register('referenceNo')} />
        {errors.referenceNo && <p role="alert" className="text-sm text-destructive">{errors.referenceNo.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">หมายเหตุ</Label>
        <Textarea id="notes" rows={2} {...form.register('notes')} />
        {errors.notes && <p role="alert" className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      {mode === 'correct' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reason">เหตุผลที่แก้ไข</Label>
          <Textarea id="reason" rows={2} placeholder="เช่น พิมพ์ยอดผิด" {...form.register('reason')} />
          {errors.reason && <p role="alert" className="text-sm text-destructive">{errors.reason.message}</p>}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">หลักฐาน</h2>
        {mode === 'correct' && existingEvidenceCount > 0 && (
          <p className="text-sm text-muted-foreground">สลิปเดิม {existingEvidenceCount} ไฟล์จะติดไปกับรายการใหม่อัตโนมัติ</p>
        )}
        <EvidencePicker files={files} onChange={setFiles} disabled={busy} />
        {noEvidence && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            ยังไม่ได้แนบสลิป คุณยังบันทึกได้ แต่แนะนำให้แนบไว้เป็นหลักฐาน
          </p>
        )}
      </section>

      <Button type="submit" size="lg" className="h-14 text-base" disabled={busy}>
        {busy ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 7: Page with auto-fill defaults**

`src/app/(app)/payments/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentForm } from '@/presentation/components/payments/payment-form';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { buildDefaultNote } from '@/presentation/view-models/default-note';

export const metadata = { title: 'บันทึกการชำระ' };

export default async function NewPaymentPage() {
  const userId = await requireUserId();
  const container = getContainer();
  const dashboard = await container.getDashboard.execute({ userId });
  if (!dashboard.ok) redirect('/setup');

  const { loan, summary } = dashboard.value;
  const latest = summary.latestPayment;
  const today = container.clock.today();

  return (
    <>
      <PageHeader title="บันทึกการชำระ" back="/" />
      <PaymentForm
        mode="create"
        defaults={{
          paidAt: today.iso,
          amount: loan.defaultAmount?.toString() ?? latest?.amount.toString() ?? '',
          paymentMethod: latest?.paymentMethod ?? 'MOBILE_BANKING',
          referenceNo: '',
          notes: buildDefaultNote(today),
          reason: '',
        }}
      />
    </>
  );
}
```

- [ ] **Step 8: Verify by hand**

`npm run test && npm run lint && npm run typecheck`, then `npm run dev` on a phone-sized viewport:

1. `/` → tap "บันทึกการชำระ" → form prefilled with today, `3000.00`, Mobile Banking, note "ชำระงวดเดือน ต.ค. 2569".
2. Tap "เลือกจากเครื่อง", pick a large JPG → thumbnail appears; check Network tab: the PUT to Supabase is a JPEG ≤ ~400 KB.
3. Submit → toast "บันทึกการชำระแล้ว", redirected to `/payments` (404 until Task 20; that is expected for now).
4. In Supabase Studio (http://127.0.0.1:54323) → Storage → `evidence` → file under `{user}/payments/{payment}/`; Table editor → `payments` row ACTIVE, `payment_evidence` row.
5. Enter amount `abc` → inline Thai error, no request sent.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(payments): add record-payment flow with camera/gallery evidence, resize and signed upload

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 20: Payment list (timeline)

> **REQUIRED SUB-SKILL:** `frontend-design:frontend-design` then `impeccable:impeccable` before writing components. Rows must scan fast: date left, amount right, running balance under it.

**Files:**
- Create: `src/presentation/components/payments/payment-timeline.tsx`, `src/presentation/components/payments/payment-row.tsx`, `src/app/(app)/payments/page.tsx`

**Interfaces:**
- Consumes: `ListPayments` (Task 11), `TimelineGroup`, `formatThaiMonthYear`, `formatThaiDate`, `MoneyText`, `EmptyState`, `PrimaryActionButton`.
- Produces: `<PaymentTimeline groups evidenceCount />`, `<PaymentRow row evidenceCount />` (server components).
- Copy (exact): header `รายการชำระ`; toggle link `แสดงรายการที่ยกเลิก` / `ซ่อนรายการที่ยกเลิก`; row sublabel `ยอดหลังชำระ {amount}` or `ยอดหลังชำระ —`; voided badge `ยกเลิกแล้ว`; empty `ยังไม่มีรายการชำระ`.

- [ ] **Step 1: Row and timeline components**

`src/presentation/components/payments/payment-row.tsx`:

```tsx
import { Paperclip } from 'lucide-react';
import Link from 'next/link';
import type { TimelineRow } from '@/domain/ledger/ledger';
import { Badge } from '@/presentation/components/ui/badge';
import { MoneyText } from '@/presentation/components/shared/money-text';
import { formatAmount, formatThaiDate, PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';
import { cn } from '@/presentation/lib/utils';

export function PaymentRow({ row, evidenceCount }: { row: TimelineRow; evidenceCount: number }) {
  const { payment, balanceAfter } = row;
  const voided = payment.status === 'VOIDED';
  return (
    <li>
      <Link
        href={`/payments/${payment.id}`}
        className={cn('flex items-center justify-between gap-3 rounded-lg px-2 py-3 active:bg-muted', voided && 'opacity-70')}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{formatThaiDate(payment.paidAt)}</span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
            {evidenceCount > 0 && <Paperclip className="size-3.5" aria-label={`มีหลักฐาน ${evidenceCount} ไฟล์`} />}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <MoneyText amount={payment.amount} size="lg" className={cn(voided && 'line-through')} />
          {voided ? (
            <Badge variant="outline">ยกเลิกแล้ว</Badge>
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground">
              ยอดหลังชำระ {balanceAfter ? formatAmount(balanceAfter) : '—'}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
```

`src/presentation/components/payments/payment-timeline.tsx`:

```tsx
import type { TimelineGroup } from '@/domain/ledger/ledger';
import { formatThaiMonthYear } from '@/presentation/view-models/format';
import { PaymentRow } from './payment-row';

export function PaymentTimeline({ groups, evidenceCount }: { groups: TimelineGroup[]; evidenceCount: Record<string, number> }) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={`${group.year}-${group.month}`}>
          <h2 className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur">
            {formatThaiMonthYear(group.year, group.month)}
          </h2>
          <ul className="divide-y">
            {group.rows.map((row) => (
              <PaymentRow key={row.payment.id} row={row} evidenceCount={evidenceCount[row.payment.id] ?? 0} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Page**

`src/app/(app)/payments/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentTimeline } from '@/presentation/components/payments/payment-timeline';
import { EmptyState } from '@/presentation/components/shared/empty-state';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { PrimaryActionButton } from '@/presentation/components/shell/primary-action-button';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'รายการชำระ' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ voided?: string }> }) {
  const userId = await requireUserId();
  const { voided } = await searchParams;
  const includeVoided = voided === '1';
  const result = await getContainer().listPayments.execute({ userId, includeVoided });
  if (!result.ok) redirect('/setup');
  const { groups, evidenceCount } = result.value;

  return (
    <>
      <PageHeader
        title="รายการชำระ"
        action={
          <Link href={includeVoided ? '/payments' : '/payments?voided=1'} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {includeVoided ? 'ซ่อนรายการที่ยกเลิก' : 'แสดงรายการที่ยกเลิก'}
          </Link>
        }
      />
      {groups.length === 0 ? (
        <EmptyState title="ยังไม่มีรายการชำระ" description="กดปุ่มด้านล่างเพื่อบันทึกการชำระครั้งแรก" />
      ) : (
        <PaymentTimeline groups={groups} evidenceCount={evidenceCount} />
      )}
      <PrimaryActionButton href="/payments/new" label="บันทึกการชำระ" />
    </>
  );
}
```

- [ ] **Step 3: Verify**

`npm run lint && npm run typecheck`, `npm run dev`: `/payments` shows the payment recorded in Task 19 under "ตุลาคม 2569" with amount and "ยอดหลังชำระ 192,420.50" (opening 195,420.50 − 3,000), paperclip icon present. Record a payment dated before the opening date → "ยอดหลังชำระ —".

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(payments): add monthly timeline list with running balance and voided toggle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 21: Payment detail, evidence viewer, correct and void

> **REQUIRED SUB-SKILL:** `frontend-design:frontend-design` then `impeccable:impeccable` before writing components. Status (active / voided / replacement) must be unmistakable at a glance.

**Files:**
- Create: `src/presentation/actions/evidence.ts`, `src/presentation/components/evidence/evidence-gallery.tsx`, `src/presentation/components/payments/void-payment-dialog.tsx`, `src/presentation/components/payments/payment-detail-view.tsx`, `src/app/(app)/payments/[id]/page.tsx`, `src/app/(app)/payments/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `GetPaymentDetail` (Task 11), `voidPaymentAction` (Task 19), `PaymentForm` mode `correct` (Task 19), `SIGNED_URL_TTL_SECONDS`.
- Produces:
  ```ts
  refreshEvidenceUrlAction(evidenceId: string): Promise<ActionResult<{ url: string }>>
  interface EvidenceItemVm { id: string; url: string; mimeType: string; filename: string | null }
  <EvidenceGallery items: EvidenceItemVm[] />        // client; thumbnails alt "สลิป {n}"; tap opens Dialog; PDFs open in new tab
  <VoidPaymentDialog paymentId />                    // client; trigger "ยกเลิกรายการ", textarea label "เหตุผล", confirm "ยืนยันการยกเลิก"
  <PaymentDetailView view: PaymentDetailView />      // server
  ```
- Copy (exact): header `รายละเอียดการชำระ`; voided banner `รายการนี้ถูกยกเลิกแล้ว`; link `ดูรายการที่แก้ไขแล้ว`; replacement banner `แก้ไขจากรายการเดิม`; badge `บันทึกแล้ว` / `ยกเลิกแล้ว`; rows `ช่องทาง`, `เลขอ้างอิง`, `ยอดหลังชำระ`, `หมายเหตุ`, `บันทึกเมื่อ`; section `หลักฐาน`; empty `ยังไม่มีหลักฐาน`; buttons `แก้ไขรายการ`, `ยกเลิกรายการ`.

- [ ] **Step 1: Evidence URL refresh action**

`src/presentation/actions/evidence.ts`:

```ts
'use server';

import { getContainer } from '@/infrastructure/container';
import { SIGNED_URL_TTL_SECONDS } from '@/application/use-cases/query/get-payment-detail';
import { DomainError } from '@/domain/shared/errors';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { failure, success, type ActionResult } from './types';

export async function refreshEvidenceUrlAction(evidenceId: string): Promise<ActionResult<{ url: string }>> {
  const userId = await requireUserId();
  const container = getContainer();
  const evidence = await container.evidence.findById(evidenceId, userId);
  if (!evidence) return failure(new DomainError('EVIDENCE_NOT_FOUND'));
  try {
    const url = await container.storage.createSignedReadUrl(evidence.storagePath, SIGNED_URL_TTL_SECONDS);
    return success({ url });
  } catch {
    return failure(new DomainError('STORAGE_FAILED'));
  }
}
```

- [ ] **Step 2: Evidence gallery (client)**

`src/presentation/components/evidence/evidence-gallery.tsx`:

```tsx
'use client';

import { FileText } from 'lucide-react';
import { useState } from 'react';
import { refreshEvidenceUrlAction } from '@/presentation/actions/evidence';
import { Dialog, DialogContent, DialogTitle } from '@/presentation/components/ui/dialog';

export interface EvidenceItemVm {
  id: string;
  url: string;
  mimeType: string;
  filename: string | null;
}

function EvidenceImage({ item, alt, className }: { item: EvidenceItemVm; alt: string; className?: string }) {
  const [src, setSrc] = useState(item.url);
  const [refreshed, setRefreshed] = useState(false);

  async function handleError() {
    if (refreshed) return;
    setRefreshed(true);
    const result = await refreshEvidenceUrlAction(item.id);
    if (result.ok) setSrc(result.data.url);
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => void handleError()} />;
}

export function EvidenceGallery({ items }: { items: EvidenceItemVm[] }) {
  const [open, setOpen] = useState<EvidenceItemVm | null>(null);

  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((item, i) => {
          const alt = `สลิป ${i + 1}`;
          const isImage = item.mimeType.startsWith('image/');
          return (
            <li key={item.id} className="aspect-square overflow-hidden rounded-lg border bg-muted">
              {isImage ? (
                <button type="button" className="size-full" onClick={() => setOpen(item)} aria-label={`เปิด${alt}`}>
                  <EvidenceImage item={item} alt={alt} className="size-full object-cover" />
                </button>
              ) : (
                <a href={item.url} target="_blank" rel="noreferrer" className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs">
                  <FileText className="size-6" aria-hidden />
                  <span className="line-clamp-2">{item.filename ?? 'PDF'}</span>
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-[100vw] border-0 bg-black p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">หลักฐานการชำระ</DialogTitle>
          {open && <EvidenceImage item={open} alt="หลักฐานการชำระ" className="max-h-[90dvh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Void dialog (client)**

`src/presentation/components/payments/void-payment-dialog.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { voidPaymentAction } from '@/presentation/actions/payment';
import { Button } from '@/presentation/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/presentation/components/ui/dialog';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';

export function VoidPaymentDialog({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (reason.trim() === '') {
      setError('กรุณาระบุเหตุผล');
      return;
    }
    setBusy(true);
    const result = await voidPaymentAction({ paymentId, reason });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success('ยกเลิกรายการแล้ว');
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="h-12 text-destructive">
          ยกเลิกรายการ
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยกเลิกรายการนี้?</DialogTitle>
          <DialogDescription>รายการจะถูกทำเครื่องหมายว่ายกเลิก ประวัติและหลักฐานยังเก็บไว้ ย้อนดูได้ภายหลัง</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="void-reason">เหตุผล</Label>
          <Textarea id="void-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น บันทึกซ้ำ" />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            กลับ
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'กำลังยกเลิก…' : 'ยืนยันการยกเลิก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Detail view (server) and pages**

`src/presentation/components/payments/payment-detail-view.tsx`:

```tsx
import Link from 'next/link';
import type { PaymentDetailView as DetailData } from '@/application/use-cases/query/get-payment-detail';
import { EvidenceGallery } from '@/presentation/components/evidence/evidence-gallery';
import { Badge } from '@/presentation/components/ui/badge';
import { buttonVariants } from '@/presentation/components/ui/button';
import { EmptyState } from '@/presentation/components/shared/empty-state';
import { MoneyText } from '@/presentation/components/shared/money-text';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { cn } from '@/presentation/lib/utils';
import { formatAmount, formatThaiDateLong, formatThaiDateTime, PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';
import { VoidPaymentDialog } from './void-payment-dialog';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export function PaymentDetailView({ view }: { view: DetailData }) {
  const { payment, balanceAfter, evidence, replacedBy, correctedFrom, correctionReason } = view;
  const voided = payment.status === 'VOIDED';

  return (
    <>
      <PageHeader title="รายละเอียดการชำระ" back="/payments" />

      {voided && (
        <section className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">รายการนี้ถูกยกเลิกแล้ว</p>
          {correctionReason && <p className="text-sm">เหตุผล: {correctionReason}</p>}
          {payment.voidedAt && <p className="text-xs text-muted-foreground">เมื่อ {formatThaiDateTime(payment.voidedAt)}</p>}
          {replacedBy && (
            <Link href={`/payments/${replacedBy.id}`} className="mt-2 inline-block text-sm underline underline-offset-4">
              ดูรายการที่แก้ไขแล้ว
            </Link>
          )}
        </section>
      )}

      {!voided && correctedFrom && (
        <section className="mb-4 rounded-xl border bg-muted/40 p-4">
          <p className="font-medium">แก้ไขจากรายการเดิม</p>
          {correctionReason && <p className="text-sm">เหตุผล: {correctionReason}</p>}
          <Link href={`/payments/${correctedFrom.id}`} className="mt-2 inline-block text-sm underline underline-offset-4">
            ดูรายการเดิม ({formatAmount(correctedFrom.amount)} บาท)
          </Link>
        </section>
      )}

      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <MoneyText amount={payment.amount} size="xl" className={cn(voided && 'line-through opacity-60')} />
        <p className="text-muted-foreground">{formatThaiDateLong(payment.paidAt)}</p>
        <Badge variant={voided ? 'outline' : 'secondary'}>{voided ? 'ยกเลิกแล้ว' : 'บันทึกแล้ว'}</Badge>
      </div>

      <dl className="divide-y rounded-xl border px-4">
        <Row label="ช่องทาง">{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</Row>
        <Row label="เลขอ้างอิง">{payment.referenceNo ?? '—'}</Row>
        <Row label="ยอดหลังชำระ">
          {balanceAfter ? (
            <span className="tabular-nums">{formatAmount(balanceAfter)} บาท</span>
          ) : (
            <span className="text-muted-foreground">— {voided ? '' : '(ก่อนวันที่ยอดตั้งต้น)'}</span>
          )}
        </Row>
        <Row label="หมายเหตุ">{payment.notes ?? '—'}</Row>
        <Row label="บันทึกเมื่อ">{formatThaiDateTime(payment.createdAt)}</Row>
      </dl>

      <section className="mt-6 flex flex-col gap-3">
        <h2 className="text-sm font-medium">หลักฐาน</h2>
        {evidence.length === 0 ? (
          <EmptyState title="ยังไม่มีหลักฐาน" description="แก้ไขรายการเพื่อแนบสลิปเพิ่ม" />
        ) : (
          <EvidenceGallery
            items={evidence.map((e) => ({ id: e.evidence.id, url: e.url, mimeType: e.evidence.mimeType, filename: e.evidence.originalFilename }))}
          />
        )}
      </section>

      {!voided && (
        <div className="mt-8 flex flex-col gap-2">
          <Link href={`/payments/${payment.id}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12')}>
            แก้ไขรายการ
          </Link>
          <VoidPaymentDialog paymentId={payment.id} />
        </div>
      )}
    </>
  );
}
```

`src/app/(app)/payments/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentDetailView } from '@/presentation/components/payments/payment-detail-view';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'รายละเอียดการชำระ' };
export const dynamic = 'force-dynamic';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const result = await getContainer().getPaymentDetail.execute({ userId, paymentId: id });
  if (!result.ok) {
    if (result.error.code === 'PAYMENT_NOT_FOUND') notFound();
    redirect('/');
  }
  return <PaymentDetailView view={result.value} />;
}
```

`src/app/(app)/payments/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentForm } from '@/presentation/components/payments/payment-form';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'แก้ไขรายการ' };

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const result = await getContainer().getPaymentDetail.execute({ userId, paymentId: id });
  if (!result.ok) notFound();
  const { payment, evidence } = result.value;
  if (payment.status === 'VOIDED') redirect(`/payments/${id}`);

  return (
    <>
      <PageHeader title="แก้ไขรายการ" back={`/payments/${id}`} />
      <p className="mb-4 text-sm text-muted-foreground">
        รายการเดิมจะถูกทำเครื่องหมายว่ายกเลิก และสร้างรายการใหม่แทน ประวัติทั้งสองยังอยู่ครบ
      </p>
      <PaymentForm
        mode="correct"
        originalPaymentId={payment.id}
        existingEvidenceCount={evidence.length}
        defaults={{
          paidAt: payment.paidAt.iso,
          amount: payment.amount.toString(),
          paymentMethod: payment.paymentMethod,
          referenceNo: payment.referenceNo ?? '',
          notes: payment.notes ?? '',
          reason: '',
        }}
      />
    </>
  );
}
```

Note: the `UUID` route param is passed straight to the use case; a non-UUID string makes Postgres throw on the uuid column. Guard it: at the top of both pages add

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID.test(id)) notFound();
```

right after `const { id } = await params;`.

- [ ] **Step 5: Verify by hand**

`npm run lint && npm run typecheck`, `npm run dev`:

1. Tap a row in `/payments` → detail shows amount, date, method, reference, "ยอดหลังชำระ", slip thumbnail; tap thumbnail → full-screen dialog.
2. "แก้ไขรายการ" → form prefilled, "สลิปเดิม 1 ไฟล์จะติดไปกับรายการใหม่อัตโนมัติ"; submit without reason → inline error; add reason, change amount → redirected to the new payment, banner "แก้ไขจากรายการเดิม", slip still visible.
3. Follow "ดูรายการเดิม" → red banner "รายการนี้ถูกยกเลิกแล้ว" with reason and "ดูรายการที่แก้ไขแล้ว".
4. On the new payment: "ยกเลิกรายการ" → dialog → confirm with reason → banner appears, action buttons gone. `/` shows the opening balance again.
5. `/payments/not-a-uuid` → 404 page.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(payments): add detail view with evidence viewer, correction and void flows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 22: More page, PWA manifest, service worker, icons

> **REQUIRED SUB-SKILL:** `frontend-design:frontend-design` then `impeccable:impeccable` for the More page and the app icon mark. Icon color must come from the token palette.

**Files:**
- Create: `src/app/(app)/more/page.tsx`, `src/app/manifest.ts`, `src/app/sw.ts`, `scripts/make-icons.mjs`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`
- Modify: `next.config.ts`, `tsconfig.json`

**Interfaces:**
- Produces: `/more` page; `/manifest.webmanifest`; `/sw.js` (built, gitignored) caching only static assets, fonts and icons; installable PWA.
- Copy (exact): header `เพิ่มเติม`; items `ตั้งค่าเงินกู้`, `ออกจากระบบ`; footer `หนี้ชัด v{version}`.

- [ ] **Step 1: More page**

`src/app/(app)/more/page.tsx`:

```tsx
import { ChevronRight, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { signOutAction } from '@/presentation/actions/auth';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { version } from '../../../../package.json';

export const metadata = { title: 'เพิ่มเติม' };

export default function MorePage() {
  return (
    <>
      <PageHeader title="เพิ่มเติม" />
      <ul className="divide-y rounded-xl border">
        <li>
          <Link href="/more/loan" className="flex h-14 items-center gap-3 px-4 active:bg-muted">
            <Settings className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1">ตั้งค่าเงินกู้</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
        <li>
          <form action={signOutAction}>
            <button type="submit" className="flex h-14 w-full items-center gap-3 px-4 text-left text-destructive active:bg-muted">
              <LogOut className="size-5" aria-hidden />
              <span className="flex-1">ออกจากระบบ</span>
            </button>
          </form>
        </li>
      </ul>
      <p className="mt-8 text-center text-xs text-muted-foreground">หนี้ชัด v{version}</p>
    </>
  );
}
```

`tsconfig.json` must have `"resolveJsonModule": true` (create-next-app sets it). Verify with `npm run typecheck`.

- [ ] **Step 2: Manifest and icons**

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'หนี้ชัด',
    short_name: 'หนี้ชัด',
    description: 'บันทึกทุกการจ่าย ตรวจสอบทุกยอด',
    lang: 'th',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff', // token: --background
    theme_color: '#ffffff', // token: --primary or header color chosen in Task 16
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

`scripts/make-icons.mjs` (replace `BRAND` with the primary token hex from `docs/design/tokens.md`):

```js
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const BRAND = '#0F766E';
const svg = (maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="${BRAND}"/>
  <path d="M150 268l64 64 148-148" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

mkdirSync('public/icons', { recursive: true });
await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(svg(true))).resize(512, 512).png().toFile('public/icons/icon-512-maskable.png');
console.log('icons written to public/icons');
```

```bash
npm run icons
```

Expected: three PNGs in `public/icons/`.

- [ ] **Step 3: Service worker with Serwist**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
```

`src/app/sw.ts`:

```ts
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Only the app shell's static assets are cached. Ledger data always comes from the network.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'static-assets',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ url }) => url.origin === 'https://fonts.gstatic.com' || url.pathname.startsWith('/icons/'),
      handler: new CacheFirst({
        cacheName: 'fonts-icons',
        plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 })],
      }),
    },
  ],
});

serwist.addEventListeners();
```

Edit `tsconfig.json`: in `compilerOptions.lib` add `"webworker"`; add `"types": ["@serwist/next/typings"]`; in top-level `exclude` add `"public/sw.js"`.

- [ ] **Step 4: Verify**

```bash
npm run lint && npm run typecheck
npm run build && npm run start
```

Expected: build succeeds and writes `public/sw.js`. In Chrome at http://localhost:3000 (logged in): DevTools → Application → Manifest shows "หนี้ชัด" with icons and no errors; Service Workers shows `sw.js` activated; the omnibox offers "Install หนี้ชัด". `/more` lists the two items and the version. Sign out works.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(pwa): add More page, web manifest, icons and asset-only service worker

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 23: End-to-end test on a phone viewport (Playwright)

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers/auth.ts`, `e2e/fixtures/slip.png`, `e2e/ledger.spec.ts`

**Interfaces:**
- Consumes: the running app, Supabase local (`.env.test`), labels/copy fixed in Tasks 17–21.
- Produces: `npm run e2e` covering login → setup → record with slip → list → detail → correct → void → dashboard.

- [ ] **Step 1: Install browsers and write config**

```bash
npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.test' });

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Auth helper and fixture**

`e2e/helpers/auth.ts`:

```ts
import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createTestUser(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('no user');
  return data.user.id;
}

/** Logs in without email by generating a magic link server-side and hitting the callback with its token hash. */
export async function loginAs(page: Page, email: string): Promise<void> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const tokenHash = data.properties.hashed_token;
  await page.goto(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=%2F`);
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  for (const table of ['payment_corrections', 'payment_evidence', 'payments', 'loans']) {
    await admin.from(table).delete().eq('user_id', userId);
  }
  const { data } = await admin.storage.from('evidence').list(`${userId}/payments`);
  for (const dir of data ?? []) {
    const files = await admin.storage.from('evidence').list(`${userId}/payments/${dir.name}`);
    const paths = (files.data ?? []).map((f) => `${userId}/payments/${dir.name}/${f.name}`);
    if (paths.length) await admin.storage.from('evidence').remove(paths);
  }
  await admin.auth.admin.deleteUser(userId);
}
```

Create the fixture (1×1 PNG):

```bash
mkdir -p e2e/fixtures
node -e "require('fs').writeFileSync('e2e/fixtures/slip.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64'))"
```

- [ ] **Step 3: Write the E2E spec**

`e2e/ledger.spec.ts`:

```ts
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createTestUser, deleteTestUser, loginAs } from './helpers/auth';

const email = `e2e-${Date.now()}@example.com`;
let userId: string;

test.beforeAll(async () => {
  userId = await createTestUser(email);
});

test.afterAll(async () => {
  await deleteTestUser(userId);
});

test('setup loan, record payment with slip, correct it, void it', async ({ page }) => {
  await loginAs(page, email);
  await expect(page).toHaveURL(/\/setup$/);

  // Loan setup
  await page.getByLabel('ชื่อเงินกู้').fill('กยศ. ทดสอบ');
  await page.getByLabel('ยอดหนี้ตั้งต้น').fill('195420.50');
  await page.getByLabel('ยอดนี้เป็นของวันที่').fill('2026-06-30');
  await page.getByLabel('ยอดจ่ายประจำ (ถ้ามี)').fill('3000');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  // the opening balance appears both as the hero number and in the hint line
  await expect(page.getByText('195,420.50').first()).toBeVisible();
  await expect(page.getByText('ยังไม่มีรายการชำระ')).toBeVisible();

  // Record a payment with a slip
  await page.getByRole('link', { name: 'บันทึกการชำระ' }).click();
  await expect(page).toHaveURL(/\/payments\/new$/);
  await expect(page.getByLabel('จำนวนเงิน')).toHaveValue('3000.00');
  await page.getByLabel('วันที่ชำระ').fill('2026-10-04');
  await page.getByLabel('เลขอ้างอิง').fill('REF-E2E');
  await page.getByTestId('gallery-input').setInputFiles(path.join(__dirname, 'fixtures/slip.png'));
  await expect(page.getByAltText('สลิป 1')).toBeVisible();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();

  // List
  await expect(page).toHaveURL(/\/payments$/);
  await expect(page.getByText('ตุลาคม 2569')).toBeVisible();
  await expect(page.getByText('ยอดหลังชำระ 192,420.50')).toBeVisible();

  // Detail
  await page.getByRole('link', { name: /3,000\.00/ }).first().click();
  await expect(page).toHaveURL(/\/payments\/[0-9a-f-]{36}$/);
  await expect(page.getByText('REF-E2E')).toBeVisible();
  await expect(page.getByAltText('สลิป 1')).toBeVisible();

  // Correct
  await page.getByRole('link', { name: 'แก้ไขรายการ' }).click();
  await expect(page.getByText('สลิปเดิม 1 ไฟล์จะติดไปกับรายการใหม่อัตโนมัติ')).toBeVisible();
  await page.getByLabel('จำนวนเงิน').fill('2500');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByText('กรุณาระบุเหตุผลที่แก้ไข')).toBeVisible();
  await page.getByLabel('เหตุผลที่แก้ไข').fill('พิมพ์ยอดผิด');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByText('แก้ไขจากรายการเดิม')).toBeVisible();
  await expect(page.getByText('2,500.00')).toBeVisible();
  await expect(page.getByAltText('สลิป 1')).toBeVisible();

  // Original is voided and linked
  await page.getByRole('link', { name: /ดูรายการเดิม/ }).click();
  await expect(page.getByText('รายการนี้ถูกยกเลิกแล้ว')).toBeVisible();
  await expect(page.getByText('เหตุผล: พิมพ์ยอดผิด')).toBeVisible();
  await page.getByRole('link', { name: 'ดูรายการที่แก้ไขแล้ว' }).click();

  // Void the replacement
  await page.getByRole('button', { name: 'ยกเลิกรายการ' }).click();
  await page.getByLabel('เหตุผล', { exact: true }).fill('บันทึกซ้ำ');
  await page.getByRole('button', { name: 'ยืนยันการยกเลิก' }).click();
  await expect(page.getByText('รายการนี้ถูกยกเลิกแล้ว')).toBeVisible();

  // Dashboard back to opening balance
  await page.goto('/');
  await expect(page.getByText('195,420.50').first()).toBeVisible();
  await expect(page.getByText('ยังไม่มีรายการชำระ')).toBeVisible();

  // Voided rows hidden by default, shown on toggle
  await page.goto('/payments');
  await expect(page.getByText('ยังไม่มีรายการชำระ')).toBeVisible();
  await page.getByRole('link', { name: 'แสดงรายการที่ยกเลิก' }).click();
  await expect(page.getByText('ยกเลิกแล้ว').first()).toBeVisible();
});
```

- [ ] **Step 4: Run**

```bash
npm run e2e
```

Expected: `1 passed`. If a selector fails, fix the component copy to match the exact strings in the task tables (Tasks 17–21), not the test.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test(e2e): add mobile Playwright flow for setup, record, correct and void

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 24: README, deployment runbook, and Definition of Done check

**Files:**
- Create: `README.md`, `docs/deploy.md`
- Modify: `docs/superpowers/specs/2026-10-04-neechat-phase1-2-design.md` (tick the DoD items that are verified)

- [ ] **Step 1: README**

`README.md`:

```markdown
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

Magic-link emails land in the local inbox at http://127.0.0.1:54324. Supabase Studio: http://127.0.0.1:54323.

## Scripts

| Script | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | unit tests (domain, application, view-models) |
| `npm run test:int` | integration tests against local Supabase |
| `npm run e2e` | Playwright mobile flow (starts dev server) |
| `npm run lint` / `typecheck` | ESLint incl. layer boundaries / tsc |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run icons` | regenerate PWA icons |

## Ledger rules

- Ledger Balance = opening balance − Σ ACTIVE payments dated after the opening-balance date.
- Payments are immutable. Editing voids the original and creates a replacement linked by a correction record. Voiding records a correction without a replacement.
- Evidence files live in the private `evidence` bucket and are served through 1-hour signed URLs.

## Deploy

See `docs/deploy.md`.
```

- [ ] **Step 2: Deployment runbook**

`docs/deploy.md`:

```markdown
# Deploying หนี้ชัด

## 1. Supabase project

1. Create a project at https://supabase.com (region: Southeast Asia / Singapore).
2. Project Settings → API: copy `URL`, `anon` key, `service_role` key.
3. Project Settings → Database → Connection string: copy the **Session pooler** URI (port 5432) for migrations and the **Transaction pooler** URI (port 6543) for the app.
4. Run migrations from your machine:
   ```bash
   DATABASE_URL='<session pooler uri>' npx drizzle-kit migrate
   ```
   This also enables RLS and creates the private `evidence` bucket.
5. Authentication → URL Configuration:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `https://<your-app>.vercel.app/auth/callback`
6. Authentication → Email Templates → Magic Link: paste the body of `supabase/templates/magic_link.html` and set the subject to `ลิงก์เข้าสู่ระบบ หนี้ชัด`.
7. Authentication → Providers → Email: keep "Confirm email" off (magic link only), disable sign-ups if you want this to stay single-user after your first login.

## 2. Vercel

1. Import the repo. Framework: Next.js. Build command `npm run build`.
2. Environment variables (Production + Preview):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server only) |
   | `DATABASE_URL` | transaction pooler URI (port 6543) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` |
   | `TZ` | `Asia/Bangkok` |
3. Deploy. Open the URL on your phone, log in with your email, add to home screen.

## 3. After each schema change

```bash
npm run db:generate -- --name <change>
DATABASE_URL='<session pooler uri>' npx drizzle-kit migrate
git add src/infrastructure/db/migrations && git commit
```

## 4. Rollback

Vercel → Deployments → promote the previous deployment. Database migrations are forward-only; write a new migration to undo a change.
```

- [ ] **Step 3: Verify the Definition of Done**

Run the whole suite:

```bash
npm run lint && npm run typecheck && npm run test && npm run test:int && npm run build && npm run e2e
```

Expected: all green. Then open the spec and tick every item in section 11 that is verified. Leave "deploy บน Vercel + Supabase ใช้งานได้จริง" and "ล็อกอินด้วย magic link ได้บนมือถือจริง" unticked until the user has deployed and tested on a phone; note the remaining steps point at `docs/deploy.md`.

- [ ] **Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: add README, deployment runbook and Definition of Done status

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Spec coverage map

| Spec section | Tasks |
|---|---|
| 2 Decisions (hosted, Supabase, rules server-side, Clean Architecture, ledger anchor, immutable, magic link, Thai UI) | 1, 7–11, 12–15, 16 |
| 4 Data model (4 tables, numeric(12,2), enums, no updated_at on payments) | 12, 13 |
| 4 Immutable ledger (void/replace, correction rows, no double void) | 4, 10, 21 |
| 4 Ledger Balance formula and "ยอดหลังชำระ" ordering | 6, 11, 20 |
| 5 Screens: Login, Setup, Dashboard, List, New, Detail, More; 3-tab bottom nav | 15, 17, 18, 20, 19, 21, 22, 16 |
| 5 Record flow: auto-fill, camera/gallery, resize ≤1600px q0.85, optional slip warning, signed upload, transaction, redirect | 19, 9 |
| 5 Correct/void flows, evidence carry-over, history links | 10, 19, 21 |
| 6 Code structure and dependency rule | 1, all |
| 7 Tech: Next 15, shadcn, RHF+zod, Drizzle, Storage, `@supabase/ssr`, decimal.js, PWA, lint, tests | 1, 16, 17, 19, 12–14, 15, 22, 23 |
| 8 Error handling table | 17, 19 (zod + toasts), 9/10 (file cleanup), 4 (already voided), 15 (layout redirect, session expiry), 21 (signed URL refresh) |
| 9 Testing: in-memory unit, Postgres integration, Playwright 390×844 | 2–11, 12–14, 23 |
| 10 Deploy and env | 1 (.env.example), 24 |
| 11 Definition of Done | 24 |
