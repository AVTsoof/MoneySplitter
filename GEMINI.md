# GEMINI.md - MoneySplitter Project Context

This file provides instructional context for AI-assisted development in the MoneySplitter project.

## Project Overview

**MoneySplitter** is a local-first debt-splitting app. It calculates net balances and
minimises the number of payments needed to settle a group.

The project is **mid-migration (Phase 12)**. Read `dev.md` before planning any work.

- **Being built:** an offline-first React + TypeScript PWA in `web/`, backed by Supabase
  Postgres with Row Level Security and no custom API server.
- **Being retired:** the Streamlit app at the repo root, along with its Python engine and
  local-CSV storage. It still runs and is still the feature-complete version.

Earlier plans for Google Drive CSV storage (Phases 6-7) and Firebase (Phase 11) were
abandoned. Do not implement against them.

## Operational Protocol
- **Reactive Mode:** Wait for an explicit user directive before initiating any tasks, research, or phase updates. Do not perform proactive background work or "auto-start" any workflows upon session initialization unless specifically requested.

### Key Features
- **Smart Settle:** A greedy algorithm to minimize the number of transactions ($n-1$ for $n$ users).
- **Graph View:** A visual debt map showing the flow of money between participants.
- **Offline First:** Reads and writes hit local storage; the network is never on the interaction path.
- **Multi-Currency & Forex:** Support for various currencies with real-time exchange rates.

## Technical Stack

### Web PWA (`web/`) - the target
- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind v4.
- **Engine:** TypeScript port of the Python math engine, running in the browser.
- **Local store:** Dexie (IndexedDB). Source of truth for every read and write.
- **Cloud:** Supabase Postgres + Auth, called directly from the client with
  `@supabase/supabase-js`. Authorisation is Row Level Security, not an API server.
- **Hosting:** Cloudflare Workers static assets.
- **Testing:** Vitest, Testing Library, `fake-indexeddb`, pgTAP for RLS, Playwright for offline.

### Streamlit app (repo root) - being retired
- **Frontend & Logic:** Streamlit (Python).
- **Engine:** `core/` pure Python.
- **Storage:** local CSV files via `io_layer/`.

## Modular Architecture

The decoupled module boundaries carry over from the Python design:

| Python (retiring) | TypeScript (target) | Responsibility |
| --- | --- | --- |
| `core/` | `web/src/core/` | Pure math. Splitting, net balances, debt simplification. |
| `io_layer/` | `web/src/data/` | Persistence and schema. |
| `bridge/` | `web/src/data/repository.ts` | The single API the UI is allowed to call. |
| `app.py` | `web/src/features/` | Presentation. |

## Building and Running

- **Web PWA:** `cd web && npm install && npm run dev` (Node 22.12+). See `web/README.md`.
- **Streamlit app:** `./bootstrap.sh` then `./run.sh` (or the `.bat` equivalents).

## Development Conventions

- **Test-Driven:** Write the failing test first and confirm it fails for the right reason
  before writing implementation. The Python engine is the oracle for the port; golden
  fixtures live in `web/src/core/__tests__/fixtures/`.
- **Atomic Commits:** One subject per commit, suite green before committing, Conventional
  Commits format. Never `--no-verify`.
- **Design Patterns:** Rigorously apply Strategy (for splitting), Repository (for IO abstraction), and Adapter (for format conversion).
- **Local-First:** All balance calculations MUST happen client-side. The UI reads from
  local storage and never awaits the network.
- **Pure Core:** `web/src/core/` must not import React or Dexie, or touch `window`. The
  subset-sum solver will need a Web Worker later.
- **Money:** never a `number`. Use the configured `Decimal` from `web/src/core/money.ts`,
  which mirrors Python's decimal context. Amounts cross boundaries as strings.
- **Soft Deletes:** set `deletedAt`; never remove a row, or sync cannot propagate it.
- **Immutable State:** Logic in the core engine should avoid mutations.
- **UI Language:** Adhere to the "Simple Sharing" dictionary (e.g., use "The Bottom Line" instead of "Net Balance").
- **Incremental Phases:** Development follows the phased plan in `dev.md`.

## Key Files
- `dev.md`: The primary roadmap, architectural specification, and phase-by-phase development plan.
- `features.md`: What is implemented, pending, and deprecated.
- `web/README.md`: How to develop the web app, plus its conventions and gotchas.
- `docs/authorization.md`: The Supabase RLS model that replaced the Firebase design.
- `GEMINI.md`: This context file for AI-assisted development.

## Agents
- **Algorithm Developer:** When working on this project, operate as an Algorithm Developer, prioritizing mathematical rigor and clean logic in the core engine.
- **Phase Tracking:** Always update the status of phases in `dev.md` (e.g., mark as `[DONE]` or `[IN PROGRESS]`) as you complete tasks or start new ones.
