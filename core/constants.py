from typing import Dict

CURRENCY_SYMBOLS: Dict[str, str] = {
    'USD': '$',
    'EUR': '€',
    'ILS': '₪',
}

def get_currency_symbol(currency_code: str) -> str:
    """Returns the symbol for a given currency code, or the code itself if not found."""
    return CURRENCY_SYMBOLS.get(currency_code, f"{currency_code} ")
