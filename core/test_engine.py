import unittest
from decimal import Decimal
from engine import EqualSplitStrategy, Expense, Ledger

class TestMoneySplitter(unittest.TestCase):
    def test_equal_split_no_residue(self):
        strategy = EqualSplitStrategy()
        shares = strategy.calculate_shares(Decimal('30.00'), ['A', 'B', 'C'])
        self.assertEqual(shares['A'], Decimal('10.00'))
        self.assertEqual(shares['B'], Decimal('10.00'))
        self.assertEqual(shares['C'], Decimal('10.00'))
        self.assertEqual(sum(shares.values()), Decimal('30.00'))

    def test_equal_split_with_residue(self):
        strategy = EqualSplitStrategy()
        # 10.00 / 3 = 3.33, 3.33, 3.34
        shares = strategy.calculate_shares(Decimal('10.00'), ['A', 'B', 'C'])
        self.assertEqual(sum(shares.values()), Decimal('10.00'))
        # One of them should have 3.34
        self.assertEqual(sorted(list(shares.values())), [Decimal('3.33'), Decimal('3.33'), Decimal('3.34')])

    def test_ledger_balances(self):
        ledger = Ledger()
        # A pays 10 for A, B, C
        ledger.add_expense(Expense("1", "A", Decimal("10.00"), ["A", "B", "C"], "Pizza"))
        
        balances = ledger.get_net_balances()
        # A paid 10, owes 3.33 or 3.34. Net should be ~6.66
        # Sum of balances must be 0
        self.assertEqual(sum(balances.values()), Decimal('0'))
        
        # B owes A 3.33
        # C owes A 3.33 or 3.34
        self.assertTrue(balances["A"] > 0)
        self.assertTrue(balances["B"] < 0)
        self.assertTrue(balances["C"] < 0)

    def test_debt_simplification(self):
        from engine import DebtSimplifier
        # A owes B 10, B owes C 10
        # Result should be: A owes C 10
        balances = {
            "A": Decimal("-10.00"),
            "B": Decimal("0.00"),
            "C": Decimal("10.00")
        }
        transactions = DebtSimplifier.simplify(balances)
        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["from"], "A")
        self.assertEqual(transactions[0]["to"], "C")
        self.assertEqual(transactions[0]["amount"], "10.00")

    def test_complex_simplification(self):
        from engine import DebtSimplifier
        # A owes B 10, A owes C 5, D owes B 5
        # Balances: A: -15, B: +15, C: +5, D: -5
        balances = {
            "A": Decimal("-15.00"),
            "B": Decimal("15.00"),
            "C": Decimal("5.00"),
            "D": Decimal("-5.00")
        }
        transactions = DebtSimplifier.simplify(balances)
        # Greedy should give:
        # A pays B 15
        # D pays C 5
        self.assertEqual(len(transactions), 2)
        
        # Verify total amount matches
        total_transferred = sum(Decimal(t["amount"]) for t in transactions)
        self.assertEqual(total_transferred, Decimal("20.00"))

if __name__ == '__main__':
    unittest.main()
