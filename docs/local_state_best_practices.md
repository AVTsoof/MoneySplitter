# Local State Best Practices in Streamlit Desktop Apps

> **Scope: the Streamlit app only, which is being retired in Phase 12.**
>
> This describes filesystem-based state for a desktop Python app. None of it applies to
> the web PWA in `web/`, which runs in a browser and has no filesystem access:
>
> | Concern | Streamlit (below) | Web PWA |
> | --- | --- | --- |
> | Group and transaction data | CSV under a data directory | IndexedDB via Dexie, synced to Supabase |
> | Signed-in identity | `logged_in_user` in `app_config.json` | Supabase Auth session |
> | Per-user preferences | `users/{name}_prefs.json` | `localStorage` |
>
> The one idea that does carry over is the split between installation-level state and
> per-user preferences, and the rule that the UI never touches storage directly.

When building a "Local-First" or desktop-oriented application using Streamlit, state persistence requires a different approach than traditional web applications. Because the application runs on the user's local machine, relying on browser `localStorage` or `cookies` is unnecessary and often brittle. Instead, state should be managed via the local filesystem using OS-standard paths.

This document outlines the best practices for distinguishing between **App-Level Configuration** and **Per-User Preferences**.

---

## 1. App-Level Configuration (Global State)

App-level configuration represents the state of the *installation* on a specific machine. It applies globally regardless of who is currently using the UI, or it remembers who was last using the UI.

### What it stores:
- **Logged-in User**: The identity of the person currently using the application on this machine.
- **Data Directory**: The absolute path to where all application data (like the `LocalFileSystemIO` groups) is stored.
- **Network Settings**: API keys (like Frankfurter API configurations) or sync frequency preferences.

### Where it belongs:
Data should be stored in an OS-appropriate application data directory to ensure it is not deleted accidentally and does not clutter the user's Documents folder.
- **Windows**: `%APPDATA%\YourAppName\app_config.json`
- **macOS**: `~/Library/Application Support/YourAppName/app_config.json`
- **Linux**: `~/.config/YourAppName/app_config.json`

### Example Structure (`app_config.json`):
```json
{
    "data_dir": "C:\\Users\\Alice\\AppData\\Local\\YourAppName",
    "logged_in_user": "Alice"
}
```

---

## 2. Per-User Preferences (Isolated State)

Per-user preferences represent the individual settings for a specific person. Because MoneySplitter can have multiple users logging in on the same machine (e.g., Alice logs out, Bob logs in), their preferences must not overwrite each other.

### What it stores:
- **Last Opened Group**: Automatically resume where the user left off.
- **UI Preferences**: Theme settings, preferred sort order, or default currency.
- **Favorite Currencies**: A list of currencies the user interacts with most often.

### Where it belongs:
User preferences should be isolated into separate files. A clean approach is to store them in a `users/` subdirectory within the main configuration folder.
- **Path**: `%APPDATA%\YourAppName\users\<username>_prefs.json`

### Example Structure (`users/Alice_prefs.json`):
```json
{
    "last_opened_group": "europe_trip_2026",
    "base_currency": "USD",
    "favorite_currencies": ["USD", "EUR", "GBP"]
}
```

---

## 3. Architectural Rules & Implementation Workflow

To maintain the "Decoupled Modular Architecture" of the application, the Streamlit UI layer should never perform file system operations directly. 

1. **Decoupled Logic**: 
   The logic for fetching and updating configuration files belongs in a dedicated configuration module (e.g., `config/app_config.py`). The Streamlit application (`app.py`) should only call getter and setter functions.
   
2. **Rehydration Flow (Auto-Login)**:
   - On Streamlit startup, `app.py` initializes the `UserSession`.
   - The session initialization code reads the global `app_config.json` to see if a `logged_in_user` exists.
   - If a user exists, the session reads `users/<logged_in_user>_prefs.json` to see if a `last_opened_group` exists.
   - If both exist, the UI bypasses the Login and Group Selection screens, providing a seamless "desktop app" experience.

3. **State Updates**:
   - When the user explicitly clicks "Log Out", the UI calls `UserSession.logout()`, which clears `logged_in_user` from the global config file.
   - When the user clicks "Change Group", the UI calls `UserSession.switch_group()`, which clears `last_opened_group` from their personal preferences file.
