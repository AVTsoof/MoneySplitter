# MoneySplitter Web

React + TypeScript PWA that replaces the Streamlit app. Works fully offline: all
reads and writes go to IndexedDB, and Supabase sync is added later behind the
same seam.

## Requirements

Node 22.12+ (developed on v22.23.2). No Python, no backend, no Docker.

## Commands

Run from `web/`.

| Command                 | What it does                           |
| ----------------------- | -------------------------------------- |
| `npm install`           | Install dependencies                   |
| `npm run dev`           | Dev server on http://localhost:5173    |
| `npm test`              | Run the suite once                     |
| `npm run test:watch`    | Watch mode                             |
| `npm run test:coverage` | Coverage for `src/core` and `src/data` |
| `npm run build`         | Type-check then production build       |
| `npm run lint`          | ESLint                                 |
| `npm run format`        | Prettier                               |

Nothing needs configuring to start developing. `.env.local` is only required
once cloud sync lands; copy `.env.example` and fill it in then.

## Layout

```
src/
  core/     Pure math. No DOM, no React, no Dexie.
  data/     Dexie schema + repository. The only module the UI may talk to.
  test/     Vitest setup
```

### `src/core`

Ported from the Python engine one-to-one: split strategies, ledger balances,
debt simplification, currency conversion.

Nothing here may import React or Dexie, or touch `window`. Phase 5's subset-sum
solver is NP-hard and will need a Web Worker; keeping this layer pure means
moving it is a one-line change rather than a refactor.

### `src/data`

`repository.ts` is the entire data API for the UI. Components never open Dexie
directly. Writes land in IndexedDB immediately and never await the network, so
the UI stays responsive offline.

Row types in `schema.ts` are deliberately shaped like the future Postgres
tables, not like whatever is convenient for IndexedDB. That is what makes cloud
sync an additive change instead of a rewrite.

## Conventions

**Money is never a `number`.** Use `Decimal` from `src/core/money.ts`, which is
configured to mirror Python's decimal context: 28 significant digits, HALF_EVEN
for intermediate arithmetic. Rounding to 2dp always passes `ROUND_HALF_UP`
explicitly via `to2dp`, matching the Python `quantize(..., ROUND_HALF_UP)` calls.
Importing `decimal.js` directly bypasses this and will silently diverge.

**Amounts cross boundaries as strings**: `"10.00"`, not `10`. PostgREST returns
`numeric` as a JS number, so always rebuild with `new Decimal(String(value))`.

**Deletes are soft.** Set `deletedAt`; never remove the row. A hard delete
cannot be propagated to another device during sync.

**Every mutation bumps `updatedAt`.** Sync resolves conflicts by comparing it,
so an edit that leaves it untouched would lose to a stale remote row.

**IDs are client-generated** (`crypto.randomUUID()`), which makes an offline
insert idempotent when it is later pushed.

## Testing

Test-first, always. Write the test, run it, confirm it fails _because the
feature is missing_ rather than from a typo, then write the minimal code to pass.

The Python engine is the oracle. `src/core/__tests__/fixtures/*.json` are golden
vectors dumped from it; regenerate with:

```bash
cd .. && python3 scripts/dump_golden_fixtures.py
```

Prefer real code to mocks. Dexie is tested against `fake-indexeddb`, not a stub.

**Mutation-audit anything subtle.** Break the logic, confirm the suite fails,
restore it. This caught a debt-simplifier tie-break with no real coverage: JS
`sort` is stable, so the fixture had been passing for the wrong reason.

A pre-commit hook runs lint-staged plus Vitest on staged files. Do not use
`--no-verify`.

## Gotchas

- Vitest config needs `defineConfig` from `vitest/config`, not `vite`, or `tsc`
  rejects the `test` key.
- Import any library stylesheet **after** `@import 'tailwindcss'` in
  `src/index.css`, and only from that file, or Tailwind v4 overrides it. This
  will matter for `@xyflow/react` when the debt map lands.
- Fixture JSON infers optional keys across cases with different member sets.
  Cast the array once (`as unknown as Case[]`) instead of at each call site.
- Compare money by value, not string. Python prints `Decimal('1.0')` as `"1.0"`;
  decimal.js prints `"1"`. Same number.
