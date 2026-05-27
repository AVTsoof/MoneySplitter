import unittest

from core.constants import get_currency_symbol
from core.currency_data import get_supported_currency_codes, get_currency_name


class TestCurrencyData(unittest.TestCase):
    def test_supported_currency_codes_include_core_currencies(self):
        codes = get_supported_currency_codes()
        self.assertIn("USD", codes)
        self.assertIn("EUR", codes)
        self.assertIn("ILS", codes)
        self.assertIn("HUF", codes)

    def test_currency_name_returns_expected_name(self):
        self.assertEqual(get_currency_name("USD"), "United States Dollar")
        self.assertEqual(get_currency_name("HUF"), "Hungarian Forint")

    def test_currency_symbol_fallbacks_to_code(self):
        self.assertEqual(get_currency_symbol("HUF"), "HUF ")


if __name__ == "__main__":
    unittest.main()
