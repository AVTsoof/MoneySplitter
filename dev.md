2026-05-15 13:16:45

## Project Context & Conventions

**MoneySplitter** is a local-first debt-splitting app. It calculates net balances and
minimises the number of payments needed to settle a group.

The project is **mid-migration (Phase 12)**. Read that phase before planning any work.

- **Being built:** an offline-first React + TypeScript PWA in `web/`, backed by Supabase
  Postgres with Row Level Security and no custom API server.
- **Being retired:** the Streamlit app at the repo root, along with its Python engine and
  local-CSV storage. It still runs and is still the feature-complete version.

Earlier plans for Google Drive CSV storage (Phases 6-7) and Firebase (Phase 11) were
abandoned. Do not implement against them.

### Technical Stack

| | Web PWA (`web/`) — target | Streamlit app (root) — retiring |
| --- | --- | --- |
| UI | React 19 + TypeScript + Vite 8 + Tailwind v4 | Streamlit (Python) |
| Engine | TypeScript port, runs in the browser | `core/` pure Python |
| Storage | Dexie (IndexedDB), source of truth for every read and write | local CSV via `io_layer/` |
| Cloud | Supabase Postgres + Auth, called directly with `@supabase/supabase-js` | none |
| Authorisation | Postgres Row Level Security (see `docs/authorization.md`) | none |
| Hosting | Cloudflare Workers static assets | Streamlit Cloud (never deployed) |
| Testing | Vitest, Testing Library, `fake-indexeddb`, pgTAP, Playwright | pytest |

### Modular Architecture

The decoupled module boundaries carry over from the Python design:

| Python (retiring) | TypeScript (target) | Responsibility |
| --- | --- | --- |
| `core/` | `web/src/core/` | Pure math. Splitting, net balances, debt simplification. |
| `io_layer/` | `web/src/data/` | Persistence and schema. |
| `bridge/` | `web/src/data/repository.ts` | The single API the UI is allowed to call. |
| `app.py` | `web/src/features/` | Presentation. |

Per-module responsibilities and the design patterns each must apply are specified in
"Modular Architecture & Design Pattern Specification" near the end of this document.

### Development Conventions

- **Test-Driven:** Write the failing test first and confirm it fails for the right reason
  before writing implementation. The Python engine is the oracle for the port; golden
  fixtures live in `web/src/core/__tests__/fixtures/`.
- **Atomic Commits:** One subject per commit, suite green before committing, Conventional
  Commits format. Never `--no-verify`.
- **Design Patterns:** Rigorously apply Strategy (for splitting), Repository (for IO
  abstraction), and Adapter (for format conversion).
- **Local-First:** All balance calculations MUST happen client-side. The UI reads from
  local storage and never awaits the network.
- **Pure Core:** `web/src/core/` must not import React or Dexie, or touch `window`. The
  subset-sum solver will need a Web Worker later.
- **Money:** never a `number`. Use the configured `Decimal` from `web/src/core/money.ts`,
  which mirrors Python's decimal context. Amounts cross boundaries as strings.
- **Reporting Currency:** the group's `defaultCurrency` is the display currency for balances, Smart Settle, and the debt map. Views use only the cached quote from the Rates page; if a foreign currency has no cached rate, it is skipped rather than assumed 1:1 or fetched during a local read. Transaction rows retain their original amount and append a cached default-currency conversion in parentheses only when different.
- **Member Colors:** every group member stores a palette color. New members receive the first unused color; the picker cannot select a color held by another member in the same group. Reuse `MemberBadge` for every rendered member name; it presents a bordered swatch beside the name, keeping it readable on both themes. Native select options remain plain text because browsers do not consistently support rich, accessible option content. Green and red remain reserved for balance states. The 12-color palette excludes green and red and never uses member color as small text, preserving the WCAG 2.1 4.5:1 text-contrast target.
- **Soft Deletes:** set `deletedAt`; never remove a row, or sync cannot propagate it.
- **Immutable State:** Logic in the core engine should avoid mutations.
- **UI Language:** Adhere to the "Simple Sharing" dictionary (e.g., use "The Bottom Line"
  instead of "Net Balance").
- **Incremental Phases:** Development follows the phased plan below.

Per-file conventions and gotchas for the web app are in `web/README.md`.

### Working Protocol

Applies to contributors and AI assistants alike.

- **Reactive Mode:** Wait for an explicit directive before starting tasks, research, or
  phase updates. No proactive background work or auto-started workflows.
- **Algorithm Developer mindset:** Prioritise mathematical rigor and clean logic in the
  core engine over convenience elsewhere.
- **Phase Tracking:** Always update phase status below (`[DONE]`, `[IN PROGRESS]`,
  `[SUPERSEDED BY ...]`) as work starts or completes.

---

## Agile Reconstruction Plan

This plan follows an incremental development cycle, prioritizing the mathematical engine and ledger logic. As an **Algorithm Developer**, you may find the transition from simple list-based accounting to graph-based optimization particularly interesting.

---

### [DONE] Phase 1: The Basic Transactional Ledger (MVP)

**Objective:** Create a functional person-to-person IOU system.

* **Core Logic:** Implement the atomic unit of the app: the **Expense**.
* **Calculation Focus:** $1:n$ splitting logic.
* **Equal Split:** If user $A$ pays $X$ for $k$ participants, each participant owes $A$ an amount of $X/k$.
* **Rounding Correction:** In a $10.00 / 3$ split, the engine must handle the floating-point residue (e.g., $3.33, 3.33, 3.34$) so that $\sum (\text{split amounts}) = X$.


* **Data Structure:** A flat ledger of transactions where each entry is: `{payer_id, total_amount, participants: {user_id: share}}`.

---

### [DONE] Phase 2: Group Aggregation & Net Balances

**Objective:** Move from "who paid for what" to "what is the bottom line."

* **Core Logic:** The **Net Balance Engine**. Instead of tracking 50 individual meals, calculate a single "Net Balance" for each user in a group.
* **Calculation Focus:** The Net Balance Formula.
* For any user $u$ in group $G$, let $P_i$ be the amount paid by $u$ for expense $i$, and $S_i$ be $u$'s share of that expense.
* The net balance $B_u$ is defined as:

$$B_u = \sum_{i \in G} (P_i - S_i)$$


* **Constraint:** The sum of all balances in a group must always be zero: $\sum_{u \in G} B_u = 0$.


* **Algorithm:** A single $O(n)$ pass over the transaction history to populate a hash map of `{user_id: net_balance}`.

---

### [DONE] Phase 3: The Debt Simplification Engine

**Objective:** Minimize the number of transactions required to settle a group.

* **Core Logic:** Implementing the "Simplify Debts" feature. This is where the app transforms from a calculator into an optimization tool.
* **Calculation Focus:** **Greedy Match-Up Algorithm.**
1. Identify all "Debtors" ($B_u < 0$) and "Creditors" ($B_u > 0$).
2. Use two **Max-Heaps** (or priority queues) to store the absolute values of these balances.
3. Pop the `Max_Debtor` and `Max_Creditor`.
4. Create a transaction: `Max_Debtor` pays `Max_Creditor` the amount $min(|B_{debtor}|, B_{creditor})$.
5. Update balances and push back into heaps if the balance is still non-zero.
6. Repeat until all balances are zero.


* **Complexity:** This produces at most $n-1$ transactions for $n$ users.

---

### [DONE] Phase 4: Advanced Splitting & Multi-Currency

**Objective:** Handle real-world complexity (unequal shares and Forex).

* **Core Logic:** **Strategy Pattern** for splitting and **Forex Translation**.
* **Calculation Focus:**
* **Unequal Splits:** Support splitting by percentages, exact amounts, or "shares". [DONE: ExactSplitStrategy implemented]
* **Multi-Currency Support:**
* Each group maintains a ledger per currency.
* To provide a "Total Balance," the engine must fetch real-time exchange rates. [DONE: dynamic Frankfurter API integration]
* **Forex Risk Calculation:** When settling a USD debt in EUR, the system must account for the rate at the time of settlement vs. time of entry.





---

### Phase 5: Optimization & Conflict Resolution

**Objective:** Scalability and high-fidelity accounting.

* **Core Logic:** **Atomic Settlements** and **Sub-group Optimization**.
* **Calculation Focus:**
* **The Subset Sum Optimization (NP-Hard):** For absolute minimal transactions, search for sub-groups whose balances sum to zero. For example, if A owes B $10 and C owes D $10, they can be settled in two separate 1:1 pairs rather than a chain of 3 payments. This is a variation of the *Partition Problem*.
* **Partial Settlements:** Logic to handle when a user pays back *some* of their debt without clearing the entire balance sheet.
* **Concurrent Edit Resolution:** Using Vector Clocks or CRDTs (Conflict-free Replicated Data Types) to handle multiple users adding expenses to the same group simultaneously without desyncing the balance sheet.



### Feature Evolution Summary

| Phase | Feature | Key Mathematical Concept |
| --- | --- | --- |
| **1** | 1:1 Splits | Division & Rounding Residue |
| **2** | Net Balances | Arithmetic Summation ($\sum$) |
| **3** | Simplify Debts | Greedy Heuristics / Priority Queues |
| **4** | Forex & Shares | Weighted Averages & Rate Conversion |
| **5** | Optimal Settlement | Subset Sum Problem (NP-Hard) |

---

### [SUPERSEDED BY PHASE 12] Phase 6: Decentralized Web Architecture & Drive Synchronization

**Objective:** Transition the application to a web-based, serverless architecture using Google Drive as the sole backend, with local CSV files functioning as the database.

* **Authentication & Permissions:** Implement Google OAuth 2.0 restricted strictly to the `[https://www.googleapis.com/auth/drive.file](https://www.googleapis.com/auth/drive.file)` scope. This ensures the app can only read, write, and see files or folders it explicitly created, maintaining absolute user privacy.
* **Directory Structure:**
* `/{App_Root_Folder}/`
* `/Group_1_ID/`
* `/Group_2_ID/`





### The Synchronization Strategy: Distributed Event Sourcing

To achieve transparent, behind-the-scenes synchronization between multiple users without a central database, the system must overcome file-level write collisions (e.g., two users modifying the same CSV at the exact same millisecond).

**1. Shared Folder Propagation**

* When User A creates a group, the app creates a subfolder in User A's Drive.
* Using the Google Drive Permissions API, the app automatically shares this specific subfolder with the Google accounts of the other group members, granting "Writer" access.
* Because the app operates under the `drive.file` scope for all users, the shared folder becomes visible to the app instances of Users B and C.

**2. Multi-File Append-Only Ledgers (Conflict Avoidance)**

* To prevent CSV lockouts and conflicted copies, **do not use a single master CSV**.
* Instead, inside the shared group folder, the app generates a distinct CSV for each user:
* `events_userA.csv`
* `events_userB.csv`


* **Write Operations:** When User A adds an expense, deletes a record, or settles a debt, the web app appends a new row *only* to `events_userA.csv`.
* **Row Structure:** `[Event_ID, UNIX_Timestamp, Action_Type, Payer_ID, Amount, Participants_JSON, Hash_Signature]`

**3. Client-Side State Rehydration & Calculation**

* **Read Operations:** When any user opens the web app, the client fetches all `events_*.csv` files present in the group subfolder.
* **The Merge Algorithm:**
1. The app parses all CSVs into memory.
2. It concatenates the rows and sorts them chronologically using the `UNIX_Timestamp`.
3. This creates a single, immutable, time-ordered ledger of every action taken by the group.


* **Execution:** The mathematical engine (developed in Phases 2 and 3) processes this unified chronological ledger from top to bottom. It calculates the current net balances and runs the debt simplification algorithm locally in the browser.

**4. Polling and Webhooks for Live Sync**

* **Push Notifications:** Utilize the Google Drive Push Notifications API. The app registers a webhook channel for the specific group subfolder.
* **Real-time Update:** When User A's app appends a row to `events_userA.csv`, Google Drive fires a notification. User B's web app detects the change in the folder, fetches only the modified CSV, re-sorts the in-memory ledger, and mathematically recalculates the balances instantly without requiring a page refresh.

---

### [SUPERSEDED BY PHASE 12] Phase 7: Google OAuth 2.0 & Restricted Scopes

To enable login and file access, you will utilize **Google Identity Services (GIS)**. This allows you to treat the user’s Google Account as the unique identifier for the `events_user.csv` files.

* **The "Least Privilege" Scope:** Use exactly `[https://www.googleapis.com/auth/drive.file](https://www.googleapis.com/auth/drive.file)`.
* **Mechanism:** When the user authenticates, the app *cannot* see their existing photos, docs, or emails. It can only see folders and files **that the app itself creates**.
* **User Trust:** This is a "Non-Sensitive" scope, meaning it doesn't require a complex Google security audit, making it perfect for a free, personal project.


* **The Auth Flow:** Use the **Authorization Code Flow**. The app receives a temporary code, exchanges it for an `access_token` (to call the Drive API) and a `refresh_token` (to keep the user logged in without re-prompting).

---

### [SUPERSEDED BY PHASE 12] Phase 8: Zero-Cost Hosting Strategy

Since this app is non-commercial and handles no payments, you can host it entirely for free using Python-specific hosting or generic cloud platforms.

| Provider | Why it fits | Limitations |
| --- | --- | --- |
| **Streamlit Cloud** | Native support for Streamlit apps; direct integration with GitHub. | Limited resources for high-traffic apps (not an issue here). |
| **Hugging Face Spaces** | Excellent for Python/Streamlit hosting with built-in versioning. | Public by default (requires configuration for privacy). |
| **Railway / Render** | Great for small Python services with persistent storage options. | May have small monthly costs for "Pro" features. |

**Recommendation:** Use **Streamlit Cloud**. It provides a seamless deployment experience from GitHub and handles the Python environment and SSL automatically.

---

### [SUPERSEDED BY PHASE 12] Phase 9: Technical Stack (UI Selection: Streamlit)

**Decision Record:** Streamlit has been selected as the primary UI framework, replacing the legacy React/JavaScript implementation. This shift consolidates the entire stack into pure Python, significantly reducing architectural complexity and eliminating the need for a JS/Python bridge (Pyodide).

To leverage your **Python** knowledge and ensure rapid development, the application uses **Streamlit**.

* **Frontend & Logic: Streamlit (Python)**
* **Why:** Streamlit allows building highly interactive, data-driven web applications using only Python. This eliminates the need for a JavaScript/TypeScript frontend and simplifies the bridge between the UI and the mathematical engine.
* **Architecture:** The application runs as a Python script. State is managed via `st.session_state`.
* **Deployment:** Can be hosted on Streamlit Cloud, Hugging Face, or any Python-compatible server.


* **Logic Engine: split-core (Python)**
* **Why:** Pure Python implementation of debt-simplification and ledger-sorting logic. Integrated directly into the Streamlit app.


* **Data Handling: Pandas (Python)**
* **Why:** Industry standard for data manipulation, used for parsing and analyzing the chronological ledger.



---

### Conceptual Reference: The "Local-First" Model

This architecture is a variation of the **"Local-First" software movement**. A real-world reference for this "Files-as-Database" approach is **Excalidraw+Google Drive**. Excalidraw allows you to "Save to Drive," where it creates a specific folder and stores your drawings as `.excalidraw` (JSON) files. It manages the sync transparently: when you open the app, it simply reads the file from your Drive, similar to how your app will read the group's CSV folder to "rehydrate" the state.

---

## The "Simple Sharing" Dictionary

To keep the app accessible, all technical or financial jargon is replaced with everyday language.

| Technical Term | Simple App Term | Definition for the User |
| --- | --- | --- |
| **Authentication** | **Sign In** | Using your Google account to open your vault. |
| **Transaction/Expense** | **Bill** | Anything you paid for that others need to share. |
| **Net Balance** | **The Bottom Line** | The final amount you either owe or are owed. |
| **Settlement** | **Paid Back** | Telling the app you’ve handed over the cash. |
| **Debt Simplification** | **Smart Settle** | A feature that reduces the number of people you need to pay. |
| **Permissions** | **Folder Access** | Allowing the app to save your bills to your Google Drive. |

---

## UI Design: The Three-Screen Flow

The interface follows a "Mobile-First" vertical stack. There are no sidebars or hidden menus—only a back button and a home button.

### 1. The Entryway (Login)

* **Visuals:** A clean white background with a single "Sign in with Google" button.
* **Text:** "Safe & Private. We only see the folder we create for you. No passwords to remember."

### 2. The Living Room (Group List)

* **Visuals:** A simple vertical list of your active groups (e.g., "Budapest Trip," "Home Utilities").
* **The "Bottom Line" Summary:** Next to each group name, a color-coded number:
* **Green:** "You are owed $50"
* **Orange:** "You owe $20"
* **Grey:** "Settle up" (Zero balance)


* **Primary Action:** A large floating **(+)** button at the bottom labeled **"New Group."**

### 3. The Group View (Bills & Math)

This screen is divided into two clear tabs at the top: **"Bills"** and **"Who Owes Who."**

* **Tab A: Bills (The History)**
* A chronological list of every expense.
* **Entry Style:** "You paid $60 for Dinner" (Yesterday).
* Tapping an entry shows the simple math: "$60 split between 3 people = $20 each."


* **Tab B: Who Owes Who (The Math)**
* This is the simplified result of the Smart Settle algorithm.
* **List Style:** "Ariel needs to pay You $20."
* **Action:** A "Paid Back" button next to each name to clear the debt.



---

## The "Add a Bill" Process (Step-by-Step)

Instead of a complicated form with 20 options, the user is guided through three quick questions:

1. **"How much?"** (Number pad opens automatically).
2. **"What was it for?"** (Short text box, e.g., "Pizza").
3. **"Who was there?"** (Checkboxes for group members. Defaults to "Everyone").

---

## Visual Design Language

* **Colors:** Use only three meaningful colors.
* **Green** for money coming in.
* **Orange** for money going out.
* **Blue** for buttons and navigation.


* **Fonts:** Large, sans-serif typography (e.g., Inter or Roboto) for high readability.
* **Reference Style:** The design follows the **"Settle Up"** or **"Splid"** philosophy—minimalist utility where the data is the hero, not the interface decorations.

---

### [DONE] Phase 10: The Visual Debt Map (Graph View)

This phase introduces a spatial representation of the group's finances, making it easier to grasp the "flow" of money at a glance.


### 1. Visual Components

* **Nodes (The Bubbles):**
* Circles displaying the user's Google Profile image.
* **Fallback:** If no image is available, display a two-letter acronym (e.g., "AF" for Ariel Feldman) in a high-contrast color.
* **Node Scaling:** Optionally scale the size of the bubble slightly based on the absolute value of their net balance $|B_u|$, making the largest creditors and debtors more prominent.


* **Edges (The Debt Arrows):**
* Directed arrows pointing from **Debtor** $\to$ **Creditor**.
* **Labeling:** The arrow displays the simplified amount (e.g., "$50") in the center of the line.
* **Thickness:** The line thickness (stroke-width) scales proportionally with the amount, providing an immediate visual cue for the largest debts.



### 2. The Logic Integration

The Graph View does not display the raw history; it visualizes the output of the **Smart Settle Algorithm** (Phase 3).

* **Input:** The optimized list of $n-1$ transactions.
* **Mapping:**
* Each transaction `{from: UserA, to: UserB, amount: X}` becomes a directed edge in the graph.
* Since the algorithm minimizes edges, the graph remains clean and avoids "spaghetti" lines between every user.



### 3. Interaction & UX

* **Force-Directed Layout:** Use a "Physics Engine" (Force-directed graph) so bubbles naturally bounce away from each other and settle into a balanced configuration.
* **Draggable Nodes:** Users can grab a bubble and move it to reorganize the view; the arrows follow the bubbles elastically.
* **Focus State:** Tapping a bubble highlights only the arrows connected to that specific person, dimming the rest of the graph to reduce visual noise.

### 4. Technical Tools

To implement this within the Streamlit stack:

* **Streamlit Agraph (`streamlit-agraph`):** A high-performance Streamlit component that enables graph visualization using a physics engine.
* **NetworkX:** Used on the backend to manage the graph structure and pass data to `streamlit-agraph`.

### 5. Terminology for the User

Instead of "Directed Acyclic Graph," the button for this page is labeled **"Show the Map."**

* **Key:** "Arrows show who needs to pay who. The bigger the arrow, the bigger the bill."

---

### [SUPERSEDED BY PHASE 12] Phase 11: Firebase Architecture & Firestore Integration

Never implemented. Supabase was chosen instead: Postgres Row Level Security expresses
group membership as a plain SQL predicate, whereas Firestore rules bill a document read
for every `exists()` lookup and cannot be tested with a SQL test harness.

**Objective:** Evaluate and potentially migrate to a Firebase-backed architecture for robust multi-tenant authentication, data modeling, and security.

* **Firebase Google Authentication:** Abstract OAuth 2.0 flows using the Google Sign-In SDK. Securely propagate the Identity Token (JWT) through client-side database interactions.
* **Firestore Data Modeling:** Implement Isolated Document Metadata pattern for group separation (`/users/{userId}`, `/groups/{groupId}`, etc.).
* **Security Rules:** Enforce multi-tenant separation using server-side Firestore security rules (ownership verification and dynamic group membership lookups).
* **Cost Optimization:** Design structural queries strictly within security allowances ("Rules Are Not Filters") and cache group memberships locally to preserve the Spark Free Plan's 50k reads/day limit.

*For full technical details, see `docs/firebase_auth_architecture.md`.*

---

2026-05-15 13:46:12

## Modular Architecture & Design Pattern Specification

> The `split-*` names below are the original Python modules. The same boundaries and
> patterns apply to the TypeScript port; see the mapping table in "Project Context &
> Conventions" at the top of this document.

To ensure scalability and maintainability, the application follows a **Decoupled Modular Architecture**. Each component is a "Black Box" that interacts with others through strictly defined interfaces, allowing the **Engine** to be run as a standalone Python CLI script or integrated into the Web UI.

---

### 1. `split-core` (The Engine)

**Role:** Pure mathematical logic and business rules. It has zero knowledge of the internet, browsers, or file systems.

* **Key Responsibilities:** Splitting logic, Net Balance calculation, Debt Simplification (Graph Theory).
* **Design Patterns:**
* **Strategy Pattern:** Used for splitting methods. The `Expense` object accepts a `SplitStrategy` (e.g., `EqualSplit`, `PercentageSplit`, `ShareSplit`). This allows adding new splitting logic without modifying the core expense class.
* **Command Pattern:** Every transaction is treated as a "Command" object. This facilitates the "Append-Only" ledger requirement and makes implementing **Undo/Redo** functionality trivial by reversing the operation.
* **Immutable State:** Calculations return new state objects rather than mutating existing data, preventing side effects during complex graph optimizations.



### 2. `split-io` (The Persistence Layer)

**Role:** The gateway to the external world (Google Drive and CSV files).

* **Key Responsibilities:** Authentication, Folder/File CRUD, CSV Serialization/Deserialization.
* **Design Patterns:**
* **Repository Pattern:** Abstracts the data source. The rest of the app asks the `TransactionRepository` for data. Whether that data comes from Google Drive, a local `.csv` file, or an in-memory mock for testing, the interface remains identical.
* **Adapter Pattern:** Converts the raw CSV rows (Strings) into the typed Objects/Dicts required by the `split-core`. If you ever switch from CSV to JSON or SQLite, you only change the Adapter.



### 3. `split-bridge` (The Orchestrator)

**Role:** The "Glue" that connects the Engine to the Persistence layer.

* **Key Responsibilities:** Fetching files via `split-io`, passing them to `split-core` for calculation, and returning the results to the UI.
* **Design Patterns:**
* **Facade Pattern:** Provides a simple API for the UI. Instead of the UI calling five different modules to add a bill, it calls `Bridge.addExpense()`, which handles the internal coordination.
* **Dependency Injection (DI):** The Bridge is "injected" with a specific IO implementation. This allows you to run a **CLI Tool** by injecting a `LocalFileIO` class instead of the `GoogleDriveIO` class.



### 4. `split-client` (The Presentation Layer)

**Role:** The Streamlit-based UI.

* **Key Responsibilities:** Rendering the Bill list, the Debt Map (Graph View), and handling user input.
* **Design Patterns:**
* **Observer Pattern:** The UI "subscribes" to the data state (via Streamlit's reactive model). When the `split-io` detects a change in a Google Drive file, the state updates, and the UI re-renders automatically.
* **Composite Pattern:** UI elements are built as reusable Streamlit components and functions that compose larger views.



---

### 5. Deployment & Infrastructure

**Role:** Managing the lifecycle and hosting of the code.

* **Modular Concept:** **Infrastructure as Code (IaC)**.
* **Components:**
* **CI/CD Pipeline (GitHub Actions):** Automatically runs Python unit tests for the `split-core` and quality checks on every push.
* **Streamlit Cloud:** Hosts the application and handles the environment.
* **Environment Configuration:** Management of API keys for Google OAuth via Streamlit Secrets or `.env` files.



---

### Summary of Module Interactions

| Module | Input | Output | Dependency |
| --- | --- | --- | --- |
| **`split-core`** | List of Events | Calculated Balances | None (Standalone) |
| **`split-io`** | Drive API Signals | Raw CSV Strings | Python Google SDK |
| **`split-bridge`** | User Actions | Unified State | `core` + `io` |
| **`split-client`** | User Interactions | Visual Feedback | `bridge` |

---


---

### [IN PROGRESS] Phase 12: Serverless PWA Migration (Supabase + React)

**Objective:** Replace the Streamlit app with an offline-first React PWA backed by
Supabase Postgres, and retire the Python runtime entirely.

**Why this supersedes Phases 6-9 and 11.** Phases 6 and 7 built on Google Drive, where the
per-user `events_{user}.csv` design existed for one reason: Drive cannot do atomic
writes, so a single shared file would corrupt under concurrent edits. Postgres removes
that constraint, which collapses three derived decisions at once:

* Append-only event log -> normalised relational tables.
* Client-side CSV merge and re-sort -> SQL plus Row Level Security.
* CRDTs / vector clocks (Phase 5) -> unnecessary. A ledger is append-dominant and rows
  carry client-generated UUIDs, so per-row last-write-wins loses nothing.

Phase 9 chose Streamlit to avoid a JS bridge. That trade no longer holds: a real
offline PWA needs a service worker and IndexedDB, which Streamlit cannot provide
because every interaction round-trips to the Python server.

#### Target stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite 8 + Tailwind v4 |
| Local store | Dexie (IndexedDB), source of truth for all reads and writes |
| Cloud | Supabase Postgres + Auth, accessed directly with `@supabase/supabase-js` |
| Authorisation | Postgres Row Level Security. No custom API server. |
| Hosting | Cloudflare Workers static assets |
| Engine | TypeScript port of `split-core`, running in the browser |

#### Sequencing

Stage A ships a fully working local-only app so the UI can be reviewed and restyled
before any cloud work starts. Stage B adds sync. Stage C deploys and deletes Python.

#### Stage A - local-only PWA (no Supabase, no auth)

* [DONE] Scaffold Vite + React + TypeScript in `web/`
* [DONE] Tailwind v4, Vitest, Testing Library, husky + lint-staged pre-commit gate
* [DONE] Freeze golden fixtures from the Python engine (`scripts/dump_golden_fixtures.py`)
* [DONE] Port split strategies (equal / exact / percentage) incl. residue handling
* [DONE] Port ledger net balances and unified multi-currency balances
* [DONE] Port debt simplifier (greedy match-up, per currency)
* [DONE] Port currency conversion and the 157-currency registry
* [DONE] Dexie schema shaped like the future Postgres tables
* [DONE] Repository layer over Dexie - the UI's only data API
* [DONE] Seed the example group on first run
* [DONE] App shell: routing, mobile-first layout, bottom tab bar
* [DONE] Transactions tab (list, add bill, add transfer, edit, delete, running balances)
* [DONE] Balances + settlements tab
* [DONE] Debt map tab (`@xyflow/react`)
* [DONE] Rates tab
* [DONE] Settings tab (members, currencies, delete group)
* [DONE] Playwright specs for offline use and PWA install
* [DONE] PDF report in-browser (`pdfmake` + `bidi-js` for RTL)
* [DONE] Exchange rates from Frankfurter with a 24h cache

**Stage A complete:** app is usable at `localhost:5173`, including offline reload after
its first visit. Review and restyle it before Stage B begins.

#### Stage B - Supabase sync, auth, multi-device

* [DONE] Postgres schema mirroring `web/src/data/schema.ts`
* [DONE] pgTAP RLS suites (`supabase test db`)
* [DONE] RLS policies and grants
* [DONE] Supabase client module (`web/src/data/supabase.ts`), absent env = local-only
* [DONE] Server-authoritative `updated_at` + overlap-window pull cursor
* [TODO] Supabase Auth (magic link)
* [IN PROGRESS] Group invite + member claim flow - DB side done (`public.claim_invite`), UI pending
* [TODO] Outbox push with backoff and idempotent upsert
* [TODO] Delta pull on `updated_at`, last-write-wins, Realtime subscription
* [TODO] Shared exchange-rate cache table

#### Stage C - deploy and decommission

* [TODO] Cloudflare Workers deploy config
* [TODO] Delete `app.py`, `bridge/`, `io_layer/`, `config/`, `core/*.py`, bootstrap scripts
* [TODO] Rewrite root README, replace the Firebase architecture doc with a Supabase RLS doc

#### Data model

Normalised, with members as rows rather than free-text names:

```
profiles(id, display_name)
groups(id, name, default_currency, active_currencies[], created_by, updated_at, deleted_at)
group_members(id, group_id, display_name, user_id NULL, unique(group_id, display_name))
transactions(id, group_id, type, amount numeric(18,2), currency, description, occurred_at,
             payer_member_id, sender_member_id, receiver_member_id, split_strategy jsonb,
             updated_at, deleted_at)
transaction_shares(transaction_id, member_id, amount)
exchange_rates(base, rates jsonb, fetched_at)
group_invites(token, group_id, member_id, expires_at)
```

`group_members.user_id` is nullable so a guest who never signs up still works; an
invited user claims their row later. Renaming a member becomes one `UPDATE` instead of
rewriting every stored transaction, as the CSV implementation required.

#### Invariants that must not regress

* Every row carries a client-generated UUID, `updated_at`, and (where applicable)
  `deleted_at`. Deletes are soft or sync cannot propagate them.
* `updated_at` is set by a Postgres trigger, never by the client. A device with a
  skewed clock would otherwise stamp a row below a cursor another device has already
  passed, and that row would never be pulled. This makes conflict resolution
  last-writer-to-sync-wins rather than last-editor-wins; accepted, because a ledger
  is append-dominant and the alternative silently loses rows.
* The pull cursor is the pair `(updated_at, id)`, and every pull re-reads
  `PULL_OVERLAP_MS` behind its own cursor. A timestamp is assigned before its
  transaction commits, so a row can appear after the cursor has moved past it.
* Balances still sum to exactly zero per currency after every transaction.
* Decimal arithmetic mirrors Python's context (28 digits, HALF_EVEN) with an explicit
  HALF_UP when rounding money to 2dp.

#### Known RLS traps (verified against Supabase docs, Sep 2026)

* A `group_members` policy that queries `group_members` raises `42P17 infinite
  recursion`. Break the cycle with a `security definer` function returning
  `setof uuid`, in a private unexposed schema, with `set search_path = ''`.
* Since May 2026 new projects no longer auto-expose `public` tables to the Data API,
  and this is enforced on existing projects from Oct 2026. Migrations must contain
  explicit `grant` statements or `supabase-js` fails with `42501` before RLS runs.
* Wrap helpers in `(select ...)` so the planner caches them per statement.
* RLS is not a filter. Client queries must still scope by `group_id`.
