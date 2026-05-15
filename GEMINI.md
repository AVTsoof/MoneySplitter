# GEMINI.md - MoneySplitter Project Context

This file provides instructional context for Gemini CLI interactions within the MoneySplitter project.

## Project Overview
**MoneySplitter** is a decentralized, serverless, and local-first debt-splitting application. It eliminates the need for a central database by using Google Drive as a persistence layer, where each user maintains an append-only CSV ledger. The application calculates net balances and optimizes debt settlements locally in the browser using a pure Python-based engine and Streamlit UI.

## Operational Protocol
- **Reactive Mode:** Wait for an explicit user directive before initiating any tasks, research, or phase updates. Do not perform proactive background work or "auto-start" any workflows upon session initialization unless specifically requested.

### Key Features
- **Decentralized Sync:** Google Drive-based event sourcing using per-user CSV files.
- **Smart Settle:** A greedy algorithm to minimize the number of transactions ($n-1$ for $n$ users).
- **Graph View:** A visual debt map showing the flow of money between participants.
- **Privacy-First:** Uses the restricted `https://www.googleapis.com/auth/drive.file` scope.
- **Multi-Currency & Forex:** Support for various currencies with real-time exchange rates.

## Technical Stack
- **Frontend & Logic:** Streamlit (Python) for a reactive, data-driven UI.
- **Engine:** Python (pure logic) for mathematical calculations and graph optimization.
- **Storage:** Google Drive API (CSV-as-a-database) accessed via Python client libraries.
- **Visualization:** `streamlit-agraph` or D3-based Streamlit components for the "Debt Map."
- **Hosting:** Streamlit Cloud or any Python-compatible host.

## Modular Architecture
The project follows a **Decoupled Modular Architecture**:
- **`split-core` (Python):** Pure mathematical logic (Splitting, Net Balances, Debt Simplification).
- **`split-io` (Python):** Persistence layer handling Google OAuth and Drive file operations using Python SDKs.
- **`split-bridge` (Python):** The orchestrator connecting the engine to the storage layer and managing session state.
- **`split-client` (Streamlit):** The presentation layer and user interaction built with Streamlit components.

## Building and Running
- Run `./bootstrap.sh` (or `bootstrap.bat`) to set up the Python virtual environment and install dependencies.
- Run `./run.sh` (or `run.bat`) to launch the Streamlit application.

## Development Conventions
- **Design Patterns:** Rigorously apply Strategy (for splitting), Command (for the ledger), Repository (for IO abstraction), and Adapter (for CSV parsing).
- **Local-First:** All state rehydration and balance calculations MUST happen client-side within the Streamlit session.
- **Immutable State:** Logic in `split-core` should avoid mutations.
- **UI Language:** Adhere to the "Simple Sharing" dictionary (e.g., use "The Bottom Line" instead of "Net Balance").
- **Incremental Phases:** Development follows the 10-phase "Agile Reconstruction Plan" outlined in `dev.md`.

## Key Files
- `dev.md`: The primary roadmap, architectural specification, and phase-by-phase development plan.
- `GEMINI.md`: This context file for AI-assisted development.

## Agents
- **Algorithm Developer:** When working on this project, operate as an Algorithm Developer, prioritizing mathematical rigor and clean logic in the core engine.
- **Phase Tracking:** Always update the status of phases in `dev.md` (e.g., mark as `[DONE]` or `[IN PROGRESS]`) as you complete tasks or start new ones.
