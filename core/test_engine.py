import unittest
from decimal import Decimal
from engine import EqualSplitStrategy, PercentageSplitStrategy, ShareSplitStrategy, Expense, Ledger, Transfer

class TestMoneySplitter(unittest.TestCase):
    def test_equal_split_no_residue(self):
        strategy = EqualSplitStrategy()
        shares = strategy.calculate_shares(Decimal('30.00'), ['A', 'B', 'C'])
        self.assertEqual(shares['A'], Decimal('10.00'))
        self.assertEqual(shares['B'], Decimal('10.00'))
        self.assertEqual(shares['C'], Decimal('10.00'))
        self.assertEqual(sum(shares.values()), Decimal('30.00'))

    def test_percentage_split(self):
        # 60/40 split of 10.00
        strategy = PercentageSplitStrategy({"A": Decimal("60"), "B": Decimal("40")})
        shares = strategy.calculate_shares(Decimal("10.00"), ["A", "B"])
        self.assertEqual(shares["A"], Decimal("6.00"))
        self.assertEqual(shares["B"], Decimal("4.00"))

    def test_percentage_split_with_residue(self):
        # 10.00 split 33.33%, 33.33%, 33.34%
        # Actually let's try 1/3, 1/3, 1/3 which is 33.33 each, residue 0.01
        strategy = PercentageSplitStrategy({"A": Decimal("33.33"), "B": Decimal("33.33"), "C": Decimal("33.34")})
        shares = strategy.calculate_shares(Decimal("10.00"), ["A", "B", "C"])
        self.assertEqual(sum(shares.values()), Decimal("10.00"))

    def test_percentage_invalid_sum(self):
        strategy = PercentageSplitStrategy({"A": Decimal("50"), "B": Decimal("40")})
        with self.assertRaises(ValueError):
            strategy.calculate_shares(Decimal("10.00"), ["A", "B"])

    def test_share_split(self):
        # 2:1 split of 30.00
        strategy = ShareSplitStrategy({"A": Decimal("2"), "B": Decimal("1")})
        shares = strategy.calculate_shares(Decimal("30.00"), ["A", "B"])
        self.assertEqual(shares["A"], Decimal("20.00"))
        self.assertEqual(shares["B"], Decimal("10.00"))

    def test_share_split_with_residue(self):
        # 1:1:1 split of 10.00
        strategy = ShareSplitStrategy({"A": 1, "B": 1, "C": 1})
        shares = strategy.calculate_shares(Decimal("10.00"), ["A", "B", "C"])
        self.assertEqual(sum(shares.values()), Decimal("10.00"))
        self.assertEqual(len(set(shares.values())), 2) # Two 3.33 and one 3.34

    def test_expense_serialization(self):
        strategy = PercentageSplitStrategy({"A": 50, "B": 50})
        expense = Expense("1", "A", Decimal("10.00"), ["A", "B"], "Lunch", strategy, currency="USD")
        data = expense.to_dict()
        self.assertEqual(data["type"], "expense")
        self.assertEqual(data["strategy"]["type"], "percentage")
        self.assertEqual(data["strategy"]["percentages"]["A"], "50")
        self.assertEqual(data["shares"]["A"], "5.00")

    def test_transfer_serialization(self):
        transfer = Transfer("2", "A", "B", Decimal("5.00"), "USD", "Payback")
        data = transfer.to_dict()
        self.assertEqual(data["type"], "transfer")
        self.assertEqual(data["sender"], "A")
        self.assertEqual(data["receiver"], "B")
        self.assertEqual(data["amount"], "5.00")

    def test_equal_split_with_residue(self):
        strategy = EqualSplitStrategy()
        # 10.00 / 3 = 3.33, 3.33, 3.34
        shares = strategy.calculate_shares(Decimal('10.00'), ['A', 'B', 'C'])
        self.assertEqual(sum(shares.values()), Decimal('10.00'))
        # One of them should have 3.34
        self.assertEqual(sorted(list(shares.values())), [Decimal('3.33'), Decimal('3.33'), Decimal('3.34')])

    def test_ledger_balances(self):
        ledger = Ledger()
        # A pays 10 for A, B, C (USD default)
        ledger.add_transaction(Expense("1", "A", Decimal("10.00"), ["A", "B", "C"], "Pizza"))
        
        multi_balances = ledger.get_net_balances()
        self.assertIn("USD", multi_balances)
        balances = multi_balances["USD"]
        
        # A paid 10, owes 3.33 or 3.34. Net should be ~6.66
        # Sum of balances must be 0
        self.assertEqual(sum(balances.values()), Decimal('0'))
        
        self.assertTrue(balances["A"] > 0)
        self.assertTrue(balances["B"] < 0)
        self.assertTrue(balances["C"] < 0)

    def test_transfer_balance(self):
        ledger = Ledger()
        # A sends 5 USD to B
        ledger.add_transaction(Transfer("1", "A", "B", Decimal("5.00"), "USD"))
        balances = ledger.get_net_balances()["USD"]
        # A paid out, so A is "owed" 5.00 (positive balance)
        # B received, so B "owes" 5.00 (negative balance)
        self.assertEqual(balances["A"], Decimal("5.00"))
        self.assertEqual(balances["B"], Decimal("-5.00"))

    def test_multi_currency_ledger(self):
        ledger = Ledger()
        # A pays 10 USD for A, B, C
        ledger.add_transaction(Expense("1", "A", Decimal("10.00"), ["A", "B", "C"], "Pizza", currency="USD"))
        # B pays 15 EUR for B, C
        ledger.add_transaction(Expense("2", "B", Decimal("15.00"), ["B", "C"], "Drinks", currency="EUR"))
        
        multi_balances = ledger.get_net_balances()
        self.assertIn("USD", multi_balances)
        self.assertIn("EUR", multi_balances)
        
        usd = multi_balances["USD"]
        eur = multi_balances["EUR"]
        
        self.assertEqual(sum(usd.values()), Decimal("0"))
        self.assertEqual(sum(eur.values()), Decimal("0"))
        
        # In EUR: B paid 15, B owes 7.50, C owes 7.50
        self.assertEqual(eur["B"], Decimal("7.50"))
        self.assertEqual(eur["C"], Decimal("-7.50"))

    def test_unified_balances(self):
        ledger = Ledger()
        ledger.add_transaction(Expense("1", "A", Decimal("10.00"), ["A", "B"], "Lunch", currency="USD"))
        ledger.add_transaction(Expense("2", "B", Decimal("10.00"), ["A", "B"], "Dinner", currency="EUR"))
        
        # Rates relative to USD: 1 EUR = 1.1 USD
        rates = {"EUR": Decimal("1.1")}
        unified = ledger.get_unified_balances("USD", rates)
        
        # A's USD balance: +5.00
        # A's EUR balance: -5.00 -> -5.50 USD
        # A's Unified: -0.50 USD
        self.assertEqual(unified["A"], Decimal("-0.50"))
        self.assertEqual(unified["B"], Decimal("0.50"))

    def test_debt_simplification(self):
        from engine import DebtSimplifier
        # A owes B 10, B owes C 10
        # Result should be: A owes C 10
        balances = {"USD": {
            "A": Decimal("-10.00"),
            "B": Decimal("0.00"),
            "C": Decimal("10.00")
        }}
        multi_transactions = DebtSimplifier.simplify(balances)
        transactions = multi_transactions["USD"]
        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["from"], "A")
        self.assertEqual(transactions[0]["to"], "C")
        self.assertEqual(transactions[0]["amount"], "10.00")

    def test_complex_simplification(self):
        from engine import DebtSimplifier
        # A owes B 10, A owes C 5, D owes B 5
        # Balances: A: -15, B: +15, C: +5, D: -5
        balances = {"USD": {
            "A": Decimal("-15.00"),
            "B": Decimal("15.00"),
            "C": Decimal("5.00"),
            "D": Decimal("-5.00")
        }}
        multi_transactions = DebtSimplifier.simplify(balances)
        transactions = multi_transactions["USD"]
        # Greedy should give:
        # A pays B 15
        # D pays C 5
        self.assertEqual(len(transactions), 2)
        
        # Verify total amount matches
        total_transferred = sum(Decimal(t["amount"]) for t in transactions)
        self.assertEqual(total_transferred, Decimal("20.00"))

if __name__ == '__main__':
    unittest.main()
