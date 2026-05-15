2026-05-15 13:16:45

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
* **Unequal Splits:** Support splitting by percentages, exact amounts, or "shares" (e.g., User A has 2 shares, User B has 1).
* **Multi-Currency Support:**
* Each group maintains a ledger per currency.
* To provide a "Total Balance," the engine must fetch real-time exchange rates.
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

### [IN PROGRESS] Phase 6: Decentralized Web Architecture & Drive Synchronization

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

### [IN PROGRESS] Phase 7: Google OAuth 2.0 & Restricted Scopes

To enable login and file access, you will utilize **Google Identity Services (GIS)**. This allows you to treat the user’s Google Account as the unique identifier for the `events_user.csv` files.

* **The "Least Privilege" Scope:** Use exactly `[https://www.googleapis.com/auth/drive.file](https://www.googleapis.com/auth/drive.file)`.
* **Mechanism:** When the user authenticates, the app *cannot* see their existing photos, docs, or emails. It can only see folders and files **that the app itself creates**.
* **User Trust:** This is a "Non-Sensitive" scope, meaning it doesn't require a complex Google security audit, making it perfect for a free, personal project.


* **The Auth Flow:** Use the **Authorization Code Flow**. The app receives a temporary code, exchanges it for an `access_token` (to call the Drive API) and a `refresh_token` (to keep the user logged in without re-prompting).

---

### Phase 8: Zero-Cost Hosting Strategy

Since this app is non-commercial and handles no payments, you can host it entirely for free using **Static Site Hosting**.

| Provider | Why it fits | Limitations |
| --- | --- | --- |
| **Vercel** | Industry standard for modern web apps; extremely fast deployment from GitHub. | 100GB bandwidth/mo (plenty for CSVs). |
| **Cloudflare Pages** | No limit on bandwidth or seat count; built-in DDoS protection. | Slightly more technical setup for "Functions." |
| **GitHub Pages** | Dead simple; fits perfectly if your code is already in a repository. | No server-side logic (not needed for this architecture). |

**Recommendation:** Use **Vercel**. It provides an automated SSL certificate and handles the "Single Page Application" routing (making the URL look like `[app.com/group/123](https://app.com/group/123)`) out of the box.

---

### [IN PROGRESS] Phase 9: Technical Stack (The "Algorithm Developer" Choice)

To leverage your **Python** knowledge while building a high-performance web app, you should use a **Hybrid WASM Architecture**.

* **Frontend UI: React (JavaScript/TypeScript)**
* **Why:** You need a reactive interface that updates the balance sheet the moment a CSV syncs. JavaScript is the native language of the browser and is required for the "Google Identity" and "Drive API" libraries.


* **Logic Engine: Pyodide (Python in the Browser)**
* **Why:** You can write your complex debt-simplification and ledger-sorting logic in **Python**. **Pyodide** is a port of CPython to WebAssembly (WASM).
* **Implementation:** Your React UI handles the buttons and Google login, then passes the raw CSV data into a Python worker. The Python code runs the math (using `Pandas` if needed) and returns the final balances to the UI.


* **CSV Parsing: Papa Parse (JS)**
* **Why:** It is the fastest browser-based library for converting CSV strings into JSON objects for your Python engine to digest.



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

## Phase 10: The Visual Debt Map (Graph View)

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

### 4. Technical Tools (Browser-Side)

To implement this within the React/Python stack:

* **React Force Graph (`react-force-graph-2d`):** A lightweight, high-performance wrapper for D3.js that handles the canvas rendering and physics.
* **D3-Force:** If you prefer more granular control, use the raw D3 physics module to calculate $x,y$ coordinates for your SVG bubbles.

### 5. Terminology for the User

Instead of "Directed Acyclic Graph," the button for this page is labeled **"Show the Map."**

* **Key:** "Arrows show who needs to pay who. The bigger the arrow, the bigger the bill."

---

2026-05-15 13:46:12

## Modular Architecture & Design Pattern Specification

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

**Role:** The React-based Web UI.

* **Key Responsibilities:** Rendering the Bill list, the Debt Map (Graph View), and handling user input.
* **Design Patterns:**
* **Observer Pattern:** The UI "subscribes" to the data state. When the `split-io` detects a change in a Google Drive file, the state updates, and the UI re-renders automatically.
* **Composite Pattern:** UI elements (Buttons, Inputs, List Items) are built as small, reusable components that compose larger views.



---

### 5. Deployment & Infrastructure

**Role:** Managing the lifecycle and hosting of the code.

* **Modular Concept:** **Infrastructure as Code (IaC)**.
* **Components:**
* **CI/CD Pipeline (GitHub Actions):** Automatically runs Python unit tests for the `split-core` and linting for the `split-client` on every push.
* **Edge Hosting (Vercel):** Hosts the static assets.
* **Environment Configuration:** Separation of "Development" and "Production" API keys for Google OAuth via `.env` files.



---

### Summary of Module Interactions

| Module | Input | Output | Dependency |
| --- | --- | --- | --- |
| **`split-core`** | List of Events | Calculated Balances | None (Standalone) |
| **`split-io`** | Drive API Signals | Raw CSV Strings | Google GIS Library |
| **`split-bridge`** | User Actions | Unified State | `core` + `io` |
| **`split-client`** | User Clicks | Visual Feedback | `bridge` |

---

