"""
app_config.py — Manages the application-level configuration for MoneySplitter.

The config file itself is stored in the OS-appropriate "app settings" location:
  - Windows : %APPDATA%\MoneySplitter\app_config.json
  - macOS   : ~/Library/Application Support/MoneySplitter/app_config.json
  - Linux   : ~/.config/MoneySplitter/app_config.json

The default *data* directory (where group folders live) is:
  - Windows : %LOCALAPPDATA%\MoneySplitter
  - macOS   : ~/Library/Application Support/MoneySplitter/data
  - Linux   : ~/.local/share/MoneySplitter
"""

import os
import json
import platform

APP_NAME = "MoneySplitter"


def get_app_config_dir() -> str:
    """Returns the directory where app_config.json is stored (OS-appropriate)."""
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    elif system == "Darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config"))
    return os.path.join(base, APP_NAME)


def get_default_data_dir() -> str:
    """Returns the default data directory path (OS-appropriate)."""
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        return os.path.join(base, APP_NAME)
    elif system == "Darwin":
        return os.path.expanduser(f"~/Library/Application Support/{APP_NAME}/data")
    else:
        base = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
        return os.path.join(base, APP_NAME)


def _config_file_path() -> str:
    return os.path.join(get_app_config_dir(), "app_config.json")


def load_config() -> dict:
    """
    Reads the app config from disk. Returns a dict with defaults if the file
    does not exist or cannot be parsed.
    """
    path = _config_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"data_dir": get_default_data_dir()}


def save_config(config: dict) -> None:
    """Persists the config dict to disk, creating directories as needed."""
    config_dir = get_app_config_dir()
    os.makedirs(config_dir, exist_ok=True)
    path = _config_file_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)

def get_logged_in_user() -> str:
    """Gets the currently logged in user from the app config."""
    config = load_config()
    return config.get("logged_in_user")

def set_logged_in_user(username: str) -> None:
    """Sets or clears the currently logged in user."""
    config = load_config()
    if username:
        config["logged_in_user"] = username
    else:
        config.pop("logged_in_user", None)
    save_config(config)

def _user_prefs_file_path(username: str) -> str:
    prefs_dir = os.path.join(get_app_config_dir(), "users")
    os.makedirs(prefs_dir, exist_ok=True)
    # Sanitize username slightly for file paths
    safe_username = "".join(c for c in username if c.isalnum() or c in (' ', '.', '_', '-')).strip()
    return os.path.join(prefs_dir, f"{safe_username}_prefs.json")

def load_user_preferences(username: str) -> dict:
    """Loads user preferences from their isolated prefs file."""
    if not username:
        return {}
    path = _user_prefs_file_path(username)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_user_preferences(username: str, prefs: dict) -> None:
    """Saves user preferences to their isolated prefs file."""
    if not username:
        return
    path = _user_prefs_file_path(username)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(prefs, f, indent=4)
