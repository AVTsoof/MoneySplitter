# MoneySplitter

The private, simple way to split bills with friends.

> **Status: mid-migration.** The app is being rebuilt as an offline-first web PWA
> backed by Supabase, replacing the Streamlit app and its local CSV storage. Both
> versions live in this repo right now. See [dev.md](dev.md) Phase 12 for the
> task list, and [web/README.md](web/README.md) to work on the new app.
>
> | | Streamlit app (current) | Web PWA (in progress) |
> | --- | --- | --- |
> | Location | repo root | `web/` |
> | Run | `./run.sh` | `cd web && npm run dev` |
> | Storage | local CSV files | IndexedDB, syncing to Supabase |
> | Status | works, feature-complete | Stage A local UI complete; cloud sync pending |

## 🌟 Why MoneySplitter?
- **Privacy First:** Your data is yours. Groups are readable only by their members.
- **Works Offline:** Add a bill on a plane; it syncs when you land.
- **Smart Settle:** Tells you exactly who needs to pay who in the fewest steps possible.

## 📖 How to Use

### 1. Sign In
Pick your name, or sign in with a magic link once cloud sync lands. Nothing is
shared outside your group.

### 2. Start a Group
Create a group for your trip, dinner, or household utilities.
- Add members by name. They don't need an account to be included in a bill.
- Invite them later with a link to claim their spot.

### 3. Add a Bill
Tapping the **(+)** button allows you to quickly log an expense:
1. **How much?** Enter the amount.
2. **What for?** Add a quick note (e.g., "Pizza").
3. **Who was there?** Select who is splitting the cost.

### 4. Settle Up
Check **"The Bottom Line"** to see if you are owed money (Green) or owe money (Orange).
- Use **"The Map"** to see a visual guide of who needs to pay who.
- When you've paid someone back, just tap **"Paid Back"** to clear the record.

## 💡 Simple Terms
- **The Bottom Line:** The final amount you either owe or are owed.
- **Smart Settle:** A tool that reduces the number of people you need to pay.

---
*Safe. Private. Simple.*

## 💻 Running Locally

### Web PWA (`web/`)

Needs Node 22.12+.

```bash
cd web
npm install
npm run dev     # http://localhost:5173
npm test        # run the suite
```

Full details, conventions and gotchas are in [web/README.md](web/README.md).

### Streamlit app (repo root)

Needs Python 3.10+.

1. Setup the environment: `./bootstrap.sh`
   - Creates a virtual environment and installs `core/requirements.txt`.
2. Run the app: `./run.sh`

Windows: use `bootstrap.bat` and `run.bat`.

## 🗺️ Where things live

| Path | What it is |
| --- | --- |
| `web/` | The React PWA that will replace everything below |
| `web/README.md` | How to develop the web app: commands, conventions, gotchas |
| `core/` | Python math engine: splitting, balances, debt simplification |
| `io_layer/` | Python persistence: CSV, local filesystem, PDF |
| `bridge/` | Python orchestrator between the engine and storage |
| `app.py` | Streamlit UI |
| `dev.md` | Project context, conventions, and the phase-by-phase plan |
| `features.md` | What is implemented, pending, and deprecated |
| `docs/authorization.md` | The Supabase Row Level Security model |
| `examples/` | A sample group used for demos and seeding |

Start with [dev.md](dev.md) — it holds the architecture, the conventions every change is
expected to follow, and the current phase status.
