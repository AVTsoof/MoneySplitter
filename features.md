# TODO

## Web PWA (Phase 12, in progress)

Stage A is complete. Remaining work:

- cloud: Supabase schema, RLS policies and pgTAP tests.
- cloud: magic-link auth and group invites.
- cloud: outbox push, delta pull, realtime sync across devices.
- deploy: Cloudflare Workers hosting.
- cleanup: delete the Streamlit app and Python runtime.

## Carried over from earlier phases

- core: subset-sum optimisation for minimal settlements (NP-hard, needs a Web Worker).
- core: partial settlement / "mark as paid" flow.
- core: forex risk when settling in a different currency than the expense was entered in.

# Implemented Features

## Python / Streamlit app

- core+app(streamlit): everything is a transaction (bill/transfer/etc.).
- core module supports transfering between users.
- base class Transaction for Expense and Transfer.
- UI shows a list of transactions (expenses and transfers).
- app: added an option to add a transfer between users.
- app: fixed: "bottom line" tab in streamlit app is updated when adding bills or transactions.
- app: Dept map "Select Currency for Map" shows all currency options from the settings.
- core+app: bill options support split equally and split unequally (exact amounts).
- app: PDF report generator containing transaction history, net balances, simplified settlements, exchange rates, and group settings.

## Web PWA (`web/`)

- build: Vite + React 19 + TypeScript + Tailwind v4 scaffold.
- build: Vitest, Testing Library and a husky pre-commit hook running lint and tests.
- test: golden fixtures dumped from the Python engine, used as the oracle for the port.
- core: split strategies ported (equal, exact, percentage) including cent-residue
  distribution, which can be negative when the base share rounds up.
- core: net balances per currency, and unified balances converted to a base currency.
  A currency with no exchange rate is skipped rather than assumed 1:1.
- core: debt simplification, greedy match-up per currency, ties broken by member name.
- core: currency conversion and the 157-currency registry.
- core: decimal arithmetic configured to match Python's context exactly.
- data: Dexie schema shaped like the future Postgres tables, with client-generated
  UUIDs, `updatedAt` and soft deletes.
- data: repository layer that is the UI's only data API; all writes hit IndexedDB and
  never await the network.
- app: seeded example group, responsive workspace, transaction entry and editing,
  participant and currency selection, balances, Smart Settle, member and group settings.
- app: interactive debt map, Frankfurter exchange-rate cache, and browser PDF export
  with RTL/Hebrew text ordering.
- pwa: installable service-worker shell with Playwright coverage for the manifest and
  offline reload after first use.

# Depracated Features

- io: Google Drive per-user CSV ledgers. Existed to work around Drive's lack of atomic
  writes; Postgres removes the constraint.
- auth: Google OAuth with the `drive.file` scope, replaced by Supabase Auth.
- sync: CRDTs / vector clocks for concurrent edits, replaced by per-row
  last-write-wins on `updated_at`.
