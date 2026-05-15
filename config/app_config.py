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
