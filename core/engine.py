from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Set

class SplitStrategy(ABC):
    @abstractmethod
    def calculate_shares(self, total_amount: Decimal, participants: List[str]) -> Dict[str, Decimal]:
        pass

    @abstractmethod
    def to_dict(self) -> Dict:
        pass

class EqualSplitStrategy(SplitStrategy):
    def calculate_shares(self, total_amount: Decimal, participants: List[str]) -> Dict[str, Decimal]:
        if not participants:
            return {}
        
        num_participants = len(participants)
        # Calculate base share rounding down to 2 decimal places
        base_share = (total_amount / num_participants).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        shares = {p: base_share for p in participants}
        
        # Calculate the residue
        total_calculated = base_share * num_participants
        residue = total_amount - total_calculated
        
        # Distribute residue (pennies) to the first N participants
        if residue != 0:
            # residue is in Decimal('0.01') units usually
            # number of pennies to distribute
            pennies = int(residue * 100)
            step = 1 if pennies > 0 else -1
            
            for i in range(0, pennies, step):
                p = participants[abs(i) % num_participants]
                shares[p] += Decimal('0.01') * step
                
        return shares

    def to_dict(self) -> Dict:
        return {"type": "equal"}

class PercentageSplitStrategy(SplitStrategy):
    def __init__(self, percentages: Dict[str, Decimal]):
        self.percentages = {k: Decimal(str(v)) for k, v in percentages.items()}

    def calculate_shares(self, total_amount: Decimal, participants: List[str]) -> Dict[str, Decimal]:
        if not participants:
            return {}
        
        if sum(self.percentages.values()) != Decimal('100'):
            raise ValueError("Percentages must sum to 100")
        
        shares = {}
        for p in participants:
            percentage = self.percentages.get(p, Decimal('0'))
            shares[p] = (total_amount * percentage / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        residue = total_amount - sum(shares.values())
        if residue != 0:
            pennies = int(residue * 100)
            step = 1 if pennies > 0 else -1
            for i in range(0, pennies, step):
                # Distribute residue to participants who are part of the percentage map
                p = participants[abs(i) % len(participants)]
                shares[p] += Decimal('0.01') * step
        return shares

    def to_dict(self) -> Dict:
        return {
            "type": "percentage",
            "percentages": {k: str(v) for k, v in self.percentages.items()}
        }

class ShareSplitStrategy(SplitStrategy):
    def __init__(self, shares: Dict[str, Decimal]):
        self.shares = {k: Decimal(str(v)) for k, v in shares.items()}

    def calculate_shares(self, total_amount: Decimal, participants: List[str]) -> Dict[str, Decimal]:
        if not participants:
            return {}
            
        total_shares = sum(self.shares.values())
        if total_shares == 0:
            return {p: Decimal('0') for p in participants}
            
        res_shares = {}
        for p in participants:
            share_weight = self.shares.get(p, Decimal('0'))
            res_shares[p] = (total_amount * share_weight / total_shares).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
        residue = total_amount - sum(res_shares.values())
        if residue != 0:
            pennies = int(residue * 100)
            step = 1 if pennies > 0 else -1
            for i in range(0, pennies, step):
                p = participants[abs(i) % len(participants)]
                res_shares[p] += Decimal('0.01') * step
        return res_shares

    def to_dict(self) -> Dict:
        return {
            "type": "share",
            "shares": {k: str(v) for k, v in self.shares.items()}
        }

class Expense:
    """
    Represents an atomic unit of expense.
    Follows the Command pattern for immutability and event sourcing.
    """
    def __init__(self, id: str, payer: str, total_amount: Decimal, participants: List[str], description: str, strategy: SplitStrategy = None):
        self.id = id
        self.payer = payer
        self.total_amount = Decimal(str(total_amount))
        self.participants = participants
        self.description = description
        self.strategy = strategy or EqualSplitStrategy()
        
        # Calculate shares immediately
        self.shares = self.strategy.calculate_shares(self.total_amount, self.participants)

    def to_dict(self):
        return {
            "id": self.id,
            "payer": self.payer,
            "total_amount": str(self.total_amount),
            "participants": self.participants,
            "description": self.description,
            "shares": {k: str(v) for k, v in self.shares.items()},
            "strategy": self.strategy.to_dict()
        }

import heapq

class DebtSimplifier:
    """
    Minimizes the number of transactions required to settle balances.
    Uses a Greedy Match-Up Algorithm with Max-Heaps.
    """
    @staticmethod
    def simplify(balances: Dict[str, Decimal]) -> List[Dict]:
        # Filter zero balances and separate into debtors and creditors
        # Python's heapq is a min-heap, so we use negative values for max-heap behavior
        debtors = [] # (-abs_balance, user_id)
        creditors = [] # (-balance, user_id)
        
        for user, balance in balances.items():
            if balance < Decimal('0'):
                # balance is -10, so -balance is 10, -10 is stored
                heapq.heappush(debtors, (-float(abs(balance)), user))
            elif balance > Decimal('0'):
                # balance is 10, -10 is stored
                heapq.heappush(creditors, (-float(balance), user))
        
        transactions = []
        
        while debtors and creditors:
            neg_debt_val, debtor_id = heapq.heappop(debtors)
            neg_cred_val, creditor_id = heapq.heappop(creditors)
            
            debt_val = -neg_debt_val
            cred_val = -neg_cred_val
            
            # Transaction amount is the minimum of the two
            amount = min(debt_val, cred_val)
            amount_dec = Decimal(str(round(amount, 2)))
            
            if amount_dec > 0:
                transactions.append({
                    "from": debtor_id,
                    "to": creditor_id,
                    "amount": "{:.2f}".format(amount_dec)
                })
            
            # Update remaining balances
            remaining_debt = debt_val - amount
            remaining_cred = cred_val - amount
            
            if remaining_debt > 0.001: # Use a small epsilon for float comparison
                heapq.heappush(debtors, (-remaining_debt, debtor_id))
            if remaining_cred > 0.001:
                heapq.heappush(creditors, (-remaining_cred, creditor_id))

        return transactions
class Ledger:
    """
    A collection of expenses.
    """
    def __init__(self):
        self.expenses: List[Expense] = []

    def add_expense(self, expense: Expense):
        self.expenses.append(expense)

    def get_net_balances(self) -> Dict[str, Decimal]:
        balances = {}
        
        for expense in self.expenses:
            # Payer is credited the total amount
            balances[expense.payer] = balances.get(expense.payer, Decimal('0')) + expense.total_amount
            
            # Each participant is debited their share
            for user, share in expense.shares.items():
                balances[user] = balances.get(user, Decimal('0')) - share
                
        return balances
