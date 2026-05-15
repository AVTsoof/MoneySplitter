from typing import List, Dict
from core.engine import Ledger, Transaction, GroupSettings
from io_layer.repository import TransactionRepository
from io_layer.csv_adapter import CSVAdapter

class Bridge:
    """
    Orchestrator connecting the UI to the Core Engine and Persistence Layer.
    """
    def __init__(self, repository: TransactionRepository, current_user_id: str, group_id: str = "default_group", settings: GroupSettings = None):
        self.repository = repository
        self.current_user_id = current_user_id
        self.group_id = group_id
        self.settings = settings or GroupSettings(default_currency='USD', active_currencies={'USD', 'EUR', 'ILS'})
        self.ledger = Ledger(self.settings)
        self.refresh()

    def refresh(self):
        """Fetches all events from the repository, sorts them, and reconstructs the Ledger."""
        raw_events = self.repository.fetch_events(self.group_id)
        transactions = []
        
        for row in raw_events:
            tx = CSVAdapter.csv_row_to_transaction(row)
            if tx:
                transactions.append(tx)
                
        # Sort chronologically by timestamp
        transactions.sort(key=lambda tx: tx.timestamp)
        
        # Reconstruct ledger
        self.ledger.transactions = transactions

    def add_transaction(self, tx: Transaction):
        """Adds a transaction locally, appends to CSV, and refreshes state."""
        # Convert to CSV row
        csv_row = CSVAdapter.transaction_to_csv_row(tx)
        
        # Append to user's specific append-only file
        self.repository.append_event(self.group_id, self.current_user_id, csv_row)
        
        # Update local state
        self.refresh()

    def delete_transaction(self, tx_id: str):
        """
        Since this is an append-only ledger, a true delete isn't fully implemented 
        in a simple file-append model without a deletion-event pattern (tombstone).
        For this prototype phase, if deletion is requested we rewrite the whole state.
        In a robust event-sourcing model, we would append a 'delete' action row.
        For simplicity, we will ignore deletes or mock them out in the short term.
        """
        pass # Placeholder for Event Sourcing Tombstone action.

    def update_transaction(self, tx: Transaction):
        """Placeholder for Event Sourcing Update action."""
        pass

    def get_transactions(self) -> List[Transaction]:
        return self.ledger.transactions

    def get_net_balances(self) -> Dict:
        return self.ledger.get_net_balances()
