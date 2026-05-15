from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Set, Optional

class GroupSettings:
    def __init__(self, default_currency: str = 'USD', active_currencies: Set[str] = None, members: List[str] = None, name: str = None):
        self.default_currency = default_currency
        self.active_currencies = active_currencies or {default_currency}
        self.members = members or []
        self.name = name

    def to_dict(self) -> Dict:
        d = {
            "default_currency": self.default_currency,
            "active_currencies": list(self.active_currencies),
            "members": self.members
        }
        if self.name is not None:
            d["name"] = self.name
        return d

    @classmethod
    def from_dict(cls, data: Dict) -> 'GroupSettings':
        return cls(
            default_currency=data.get('default_currency', 'USD'),
            active_currencies=set(data.get('active_currencies', ['USD'])),
            members=data.get('members', []),
            name=data.get('name', None)
        )

class UserPreferences:
    def __init__(self, favorite_currencies: List[str] = None, base_currency: str = 'USD'):
        self.favorite_currencies = favorite_currencies or ['USD']
        self.base_currency = base_currency

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

class ExactSplitStrategy(SplitStrategy):
    def __init__(self, amounts: Dict[str, Decimal]):
        self.amounts = {k: Decimal(str(v)) for k, v in amounts.items()}

    def calculate_shares(self, total_amount: Decimal, participants: List[str]) -> Dict[str, Decimal]:
        if sum(self.amounts.values()) != total_amount:
            raise ValueError(f"Sum of individual amounts ({sum(self.amounts.values())}) must equal total amount ({total_amount})")
        
        # Ensure all participants have an entry, even if 0
        shares = {p: self.amounts.get(p, Decimal('0')) for p in participants}
        return shares

    def to_dict(self) -> Dict:
        return {
            "type": "exact",
            "amounts": {k: str(v) for k, v in self.amounts.items()}
        }

from datetime import datetime

class Transaction(ABC):
    """
    Base class for all financial operations.
    """
    def __init__(self, id: str, amount: Decimal, currency: str, description: str, timestamp: datetime = None):
        self.id = id
        self.amount = Decimal(str(amount))
        self.currency = currency
        self.description = description
        self.timestamp = timestamp or datetime.now()

    @abstractmethod
    def to_dict(self) -> Dict:
        pass

    @abstractmethod
    def apply_to_balances(self, balances: Dict[str, Decimal]):
        pass

class Expense(Transaction):
    """
    Represents an atomic unit of expense.
    """
    def __init__(self, id: str, payer: str, total_amount: Decimal, participants: List[str], description: str, strategy: SplitStrategy = None, currency: str = None, timestamp: datetime = None):
        super().__init__(id, total_amount, currency, description, timestamp)
        self.payer = payer
        self.participants = participants
        self.strategy = strategy or EqualSplitStrategy()
        
        # Calculate shares immediately
        self.shares = self.strategy.calculate_shares(self.amount, self.participants)

    def to_dict(self):
        return {
            "type": "expense",
            "id": self.id,
            "payer": self.payer,
            "total_amount": str(self.amount),
            "currency": self.currency,
            "participants": self.participants,
            "description": self.description,
            "shares": {k: str(v) for k, v in self.shares.items()},
            "strategy": self.strategy.to_dict(),
            "timestamp": self.timestamp.isoformat()
        }

    def apply_to_balances(self, balances: Dict[str, Decimal]):
        # Payer is credited the total amount
        balances[self.payer] = balances.get(self.payer, Decimal('0')) + self.amount
        
        # Each participant is debited their share
        for user, share in self.shares.items():
            balances[user] = balances.get(user, Decimal('0')) - share

class Transfer(Transaction):
    """
    Represents a direct transfer of money from one user to another.
    """
    def __init__(self, id: str, sender: str, receiver: str, amount: Decimal, currency: str, description: str = "Transfer", timestamp: datetime = None):
        super().__init__(id, amount, currency, description, timestamp)
        self.sender = sender
        self.receiver = receiver

    def to_dict(self):
        return {
            "type": "transfer",
            "id": self.id,
            "sender": self.sender,
            "receiver": self.receiver,
            "amount": str(self.amount),
            "currency": self.currency,
            "description": self.description,
            "timestamp": self.timestamp.isoformat()
        }

    def apply_to_balances(self, balances: Dict[str, Decimal]):
        # Sender is credited (they paid out, so they are "owed" this by the system/receiver)
        # Actually, in this ledger system, 'balance > 0' means 'owed money'.
        # If I send money to you, I am owed that money back by the system/you.
        balances[self.sender] = balances.get(self.sender, Decimal('0')) + self.amount
        balances[self.receiver] = balances.get(self.receiver, Decimal('0')) - self.amount

import heapq

class DebtSimplifier:
    """
    Minimizes the number of transactions required to settle balances.
    Uses a Greedy Match-Up Algorithm with Max-Heaps.
    Supports multi-currency balances by simplifying each currency independently.
    """
    @staticmethod
    def simplify(multi_balances: Dict[str, Dict[str, Decimal]]) -> Dict[str, List[Dict]]:
        results = {}
        for currency, balances in multi_balances.items():
            results[currency] = DebtSimplifier._simplify_single_currency(balances)
        return results

    @staticmethod
    def _simplify_single_currency(balances: Dict[str, Decimal]) -> List[Dict]:
        # Filter zero balances and separate into debtors and creditors
        debtors = [] # (-abs_balance, user_id)
        creditors = [] # (-balance, user_id)
        
        for user, balance in balances.items():
            if balance < Decimal('-0.001'):
                heapq.heappush(debtors, (-float(abs(balance)), user))
            elif balance > Decimal('0.001'):
                heapq.heappush(creditors, (-float(balance), user))
        
        transactions = []
        
        while debtors and creditors:
            neg_debt_val, debtor_id = heapq.heappop(debtors)
            neg_cred_val, creditor_id = heapq.heappop(creditors)
            
            debt_val = -neg_debt_val
            cred_val = -neg_cred_val
            
            amount = min(debt_val, cred_val)
            amount_dec = Decimal(str(round(amount, 2)))
            
            if amount_dec > 0:
                transactions.append({
                    "from": debtor_id,
                    "to": creditor_id,
                    "amount": "{:.2f}".format(amount_dec)
                })
            
            remaining_debt = debt_val - amount
            remaining_cred = cred_val - amount
            
            if remaining_debt > 0.001:
                heapq.heappush(debtors, (-remaining_debt, debtor_id))
            if remaining_cred > 0.001:
                heapq.heappush(creditors, (-remaining_cred, creditor_id))

        return transactions
class Ledger:
    """
    A collection of transactions (expenses and transfers).
    """
    def __init__(self, settings: GroupSettings = None):
        self.transactions: List[Transaction] = []
        self.settings = settings or GroupSettings()

    def add_transaction(self, transaction: Transaction):
        if transaction.currency is None:
            transaction.currency = self.settings.default_currency
        self.transactions.append(transaction)

    def get_net_balances(self) -> Dict[str, Dict[str, Decimal]]:
        """
        Returns balances per currency: {currency: {user: balance}}
        """
        multi_balances = {}
        
        for tx in self.transactions:
            currency = tx.currency
            if currency not in multi_balances:
                multi_balances[currency] = {}
            
            balances = multi_balances[currency]
            tx.apply_to_balances(balances)
                
        return multi_balances

    def get_unified_balances(self, base_currency: str, exchange_rates: Dict[str, Decimal]) -> Dict[str, Decimal]:
        """
        Translates all per-currency balances into a single base currency.
        exchange_rates should be {from_currency: rate_to_base}
        e.g., if base is USD and we have EUR, rate should be 1.1 (1 EUR = 1.1 USD)
        """
        multi_balances = self.get_net_balances()
        unified = {}
        
        for currency, balances in multi_balances.items():
            rate = Decimal('1')
            if currency != base_currency:
                rate = exchange_rates.get(currency)
                if rate is None:
                    # If rate is missing, we can't unify this currency accurately
                    # For now, we'll skip or assume 1:1 with a warning (or just skip)
                    continue
            
            for user, balance in balances.items():
                converted_balance = (balance * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                unified[user] = unified.get(user, Decimal('0')) + converted_balance
                
        return unified

class CurrencyConverter:
    """
    Handles pure currency exchange rate calculations.
    """
    @staticmethod
    def get_exchange_rate(rates_dict: Dict[str, float], from_curr: str, to_curr: str) -> Decimal:
        if from_curr == to_curr:
            return Decimal('1.0')
        if not rates_dict:
            return Decimal('1.0')
            
        rate_from = Decimal(str(rates_dict.get(from_curr, 1.0)))
        rate_to = Decimal(str(rates_dict.get(to_curr, 1.0)))
        
        if rate_from == Decimal('0'):
            return Decimal('1.0')
            
        return rate_to / rate_from
