# GEMINI.md - MoneySplitter Project Context

This file provides instructional context for Gemini CLI interactions within the MoneySplitter project.

## Project Overview
**MoneySplitter** is a decentralized, serverless, and local-first debt-splitting application. It eliminates the need for a central database by using Google Drive as a persistence layer, where each user maintains an append-only CSV ledger. The application calculates net balances and optimizes debt settlements locally in the browser using a Python-based engine.

## Operational Protocol
- **Reactive Mode:** Wait for an explicit user directive before initiating any tasks, research, or phase updates. Do not perform proactive background work or "auto-start" any workflows upon session initialization unless specifically requested.

### Key Features
- **Decentralized Sync:** Google Drive-based event sourcing using per-user CSV files.
- **Smart Settle:** A greedy algorithm to minimize the number of transactions ($n-1$ for $n$ users).
- **Graph View:** A visual debt map showing the flow of money between participants.
- **Privacy-First:** Uses the restricted `https://www.googleapis.com/auth/drive.file` scope.
- **Multi-Currency & Forex:** Support for various currencies with real-time exchange rates.

## Technical Stack
- **Frontend:** React (JavaScript/TypeScript) for a reactive UI.
- **Engine:** Python (via **Pyodide/WebAssembly**) for complex mathematical logic and graph theory.
- **Storage:** Google Drive API (CSV-as-a-database).
- **Visualization:** `react-force-graph-2d` / D3.js for the "Debt Map."
- **Hosting:** Vercel (Static Site Hosting).

## Modular Architecture
The project follows a **Decoupled Modular Architecture**:
- **`split-core` (Python):** Pure mathematical logic (Splitting, Net Balances, Debt Simplification).
- **`split-io` (JS):** Persistence layer handling Google OAuth and Drive file operations.
- **`split-bridge` (JS/Python):** The orchestrator connecting the engine to the storage layer.
- **`split-client` (React):** The presentation layer and user interaction.

## Building and Running
*Note: The project is currently in the planning/reconstruction phase. No source code is present yet.*

- **TODO:** Document `npm install` and `npm run dev` once the React structure is initialized.
- **TODO:** Document Python environment setup for `split-core` development.

## Development Conventions
- **Design Patterns:** Rigorously apply Strategy (for splitting), Command (for the ledger), Repository (for IO abstraction), and Adapter (for CSV parsing).
- **Local-First:** All state rehydration and balance calculations MUST happen client-side.
- **Immutable State:** Logic in `split-core` should avoid mutations.
- **UI Language:** Adhere to the "Simple Sharing" dictionary (e.g., use "The Bottom Line" instead of "Net Balance").
- **Incremental Phases:** Development follows the 10-phase "Agile Reconstruction Plan" outlined in `dev.md`.

## Key Files
- `dev.md`: The primary roadmap, architectural specification, and phase-by-phase development plan.
- `GEMINI.md`: This context file for AI-assisted development.

## Agents
- **Algorithm Developer:** When working on this project, operate as an Algorithm Developer, prioritizing mathematical rigor and clean logic in the core engine.
- **Phase Tracking:** Always update the status of phases in `dev.md` (e.g., mark as `[DONE]` or `[IN PROGRESS]`) as you complete tasks or start new ones.

