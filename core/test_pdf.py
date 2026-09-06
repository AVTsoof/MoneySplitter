import unittest
from decimal import Decimal
from datetime import datetime
from core.engine import Expense, EqualSplitStrategy
from io_layer.pdf_adapter import PDFReportGenerator

class TestPDFReportGenerator(unittest.TestCase):
    def test_pdf_generation_smoke(self):
        # Setup simple mock data
        group_name = "Ski Trip"
        members = ["Alice", "Bob", "Charlie"]
        
        pdf = PDFReportGenerator(group_name, members)
        
        # Create mock transactions
        txs = [
            Expense(
                id="1",
                payer="Alice",
                total_amount=Decimal("120.00"),
                participants=["Alice", "Bob", "Charlie"],
                description="Ski Rental",
                strategy=EqualSplitStrategy(),
                currency="USD",
                timestamp=datetime(2026, 5, 25, 10, 0)
            ),
            Expense(
                id="2",
                payer="Bob",
                total_amount=Decimal("45.00"),
                participants=["Alice", "Bob"],
                description="Lunch",
                strategy=EqualSplitStrategy(),
                currency="USD",
                timestamp=datetime(2026, 5, 25, 13, 0)
            )
        ]
        
        pdf.add_transactions_section(txs)
        
        balances = {"Alice": Decimal("42.50"), "Bob": Decimal("-17.50"), "Charlie": Decimal("-25.00")}
        pdf.add_balances_section(balances, "USD")
        
        simplified_debts = [
            {"from": "Bob", "to": "Alice", "amount": "17.50"},
            {"from": "Charlie", "to": "Alice", "amount": "25.00"}
        ]
        pdf.add_settlements_section(simplified_debts, "USD")
        
        exchange_rates = {
            "timestamp": datetime.now().timestamp(),
            "rates": {"EUR": 0.92, "ILS": 3.75, "USD": 1.0}
        }
        pdf.add_exchange_rates_section(exchange_rates)
        
        settings_dict = {
            "name": group_name,
            "default_currency": "USD",
            "active_currencies": ["USD", "EUR", "ILS"]
        }
        pdf.add_settings_summary_section(settings_dict)
        
        pdf_bytes = pdf.generate_pdf_bytes()
        self.assertGreater(len(pdf_bytes), 0)

    def test_pdf_generation_hebrew_unicode(self):
        # Hebrew group name, members, and transactions (including the letter 'ת')
        group_name = "טיול לצפון"
        members = ["דני", "תמר", "יוסי"]
        
        pdf = PDFReportGenerator(group_name, members)
        
        txs = [
            Expense(
                id="1",
                payer="תמר",
                total_amount=Decimal("120.00"),
                participants=["דני", "תמר", "יוסי"],
                description="קניות בסופר (כולל תבלינים)",
                strategy=EqualSplitStrategy(),
                currency="ILS",
                timestamp=datetime(2026, 5, 25, 10, 0)
            ),
            Expense(
                id="2",
                payer="דני",
                total_amount=Decimal("45.00"),
                participants=["תמר", "דני"],
                description="ארוחת צהריים",
                strategy=EqualSplitStrategy(),
                currency="ILS",
                timestamp=datetime(2026, 5, 25, 13, 0)
            )
        ]
        
        pdf.add_transactions_section(txs, default_currency="ILS")
        
        balances = {"תמר": Decimal("57.50"), "דני": Decimal("-12.50"), "יוסי": Decimal("-45.00")}
        pdf.add_balances_section(balances, "ILS")
        
        simplified_debts = [
            {"from": "דני", "to": "תמר", "amount": "12.50"},
            {"from": "יוסי", "to": "תמר", "amount": "45.00"}
        ]
        pdf.add_settlements_section(simplified_debts, "ILS")
        
        exchange_rates = {
            "timestamp": datetime.now().timestamp(),
            "rates": {"EUR": 0.92, "ILS": 3.75, "USD": 1.0}
        }
        pdf.add_exchange_rates_section(exchange_rates, active_currencies=["USD", "ILS"], default_currency="ILS")
        
        settings_dict = {
            "name": group_name,
            "default_currency": "ILS",
            "active_currencies": ["USD", "ILS"]
        }
        pdf.add_settings_summary_section(settings_dict)
        
        pdf_bytes = pdf.generate_pdf_bytes()
        self.assertGreater(len(pdf_bytes), 0)

if __name__ == '__main__':
    unittest.main()
