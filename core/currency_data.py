from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, List

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CURRENCY_DATA_FILE = DATA_DIR / "currencies.json"

DEFAULT_CURRENCY_DATA: Dict[str, Dict[str, str]] = {
    "USD": {"name": "United States Dollar"},
    "EUR": {"name": "Euro"},
    "ILS": {"name": "Israeli New Shekel"},
}


def _load_currency_file() -> Dict[str, Dict[str, str]]:
    try:
        with CURRENCY_DATA_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, dict):
                return data
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return {}


def get_currency_metadata() -> Dict[str, Dict[str, str]]:
    data = _load_currency_file()
    if not data:
        return DEFAULT_CURRENCY_DATA.copy()
    return data


def get_supported_currency_codes() -> List[str]:
    return sorted(get_currency_metadata().keys())


def get_currency_name(currency_code: str) -> str:
    return get_currency_metadata().get(currency_code, {}).get("name", currency_code)
