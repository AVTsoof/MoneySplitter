from typing import List, Dict
import urllib.request
import json
from datetime import datetime, timezone

from core.engine import Ledger, Transaction, GroupSettings
from io_layer.repository import TransactionRepository
from io_layer.csv_adapter import CSVAdapter

class Bridge:
    """
    Orchestrator connecting the UI to the Core Engine and Persistence Layer.
    """
    def __init__(self, repository: TransactionRepository, current_user_id: str, group_id: str = None, settings: GroupSettings = None):
        self.repository = repository
        self.current_user_id = current_user_id
        self.group_id = group_id
        
        if group_id:
            # Try to load existing settings
            existing_settings = self.repository.get_group_settings(group_id)
            if existing_settings:
                self.settings = GroupSettings.from_dict(existing_settings)
            else:
                self.settings = settings or GroupSettings()
                self.save_settings()
        else:
            self.settings = settings or GroupSettings()
            
        self.ledger = Ledger(self.settings)
        self.update_exchange_rates(force=False)
        if group_id:
            self.refresh()

    def update_exchange_rates(self, force: bool = False, timeout: float = 5.0) -> bool:
        """
        Fetches current exchange rates from Frankfurter API and saves them locally.
        If force is False, only fetches if the rates file doesn't exist or is older than 24 hours.
        Returns True if successful, False if failed/timed out.
        """
        current_rates = self.get_exchange_rates()
        last_updated = current_rates.get("timestamp", 0)
        now = datetime.now(timezone.utc).timestamp()
        
        # 86400 seconds = 24 hours
        if not force and current_rates and (now - last_updated < 86400):
            return True

        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
            req = urllib.request.Request("https://api.frankfurter.app/latest?base=USD", headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    rates = data.get("rates", {})
                    # Frankfurter returns rates base USD, but doesn't include USD: 1.0 itself.
                    rates["USD"] = 1.0
                    
                    rates_data = {
                        "timestamp": now,
                        "rates": rates
                    }
                    self.repository.save_exchange_rates(rates_data)
                    return True
                return False
        except Exception as e:
            print(f"Error fetching exchange rates: {e}")
            return False

    def get_exchange_rates(self) -> dict:
        return self.repository.get_exchange_rates()

    def save_settings(self):
        """Saves the current group settings to the repository."""
        if self.group_id:
            self.repository.save_group_settings(self.group_id, self.settings.to_dict())

    def switch_group(self, new_group_id: str):
        """Switches the active group and reloads data."""
        self.group_id = new_group_id
        existing_settings = self.repository.get_group_settings(new_group_id)
        if existing_settings:
            self.settings = GroupSettings.from_dict(existing_settings)
        else:
            self.settings = GroupSettings()
            self.save_settings()
        
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
        Removes a transaction from the persistent store by rewriting the affected CSV file(s)
        without the matching row, then refreshes the in-memory ledger.
        """
        self.repository.delete_event(self.group_id, tx_id)
        self.refresh()

    def update_transaction(self, tx: Transaction):
        """
        Replaces an existing transaction in the persistent store.
        Tries the current user's file first; if not found, falls back to scanning
        all user files in the group. Refreshes the in-memory ledger afterwards.
        """
        new_csv_row = CSVAdapter.transaction_to_csv_row(tx)

        # Try updating in the current user's file first
        updated = self.repository.update_event(
            self.group_id, self.current_user_id, tx.id, new_csv_row
        )

        # If not found there, scan all other user files in the group
        if not updated:
            existing_settings = self.repository.get_group_settings(self.group_id)
            members = existing_settings.get("members", []) if existing_settings else []
            for member in members:
                if member != self.current_user_id:
                    updated = self.repository.update_event(
                        self.group_id, member, tx.id, new_csv_row
                    )
                    if updated:
                        break

        self.refresh()
        return updated

    def get_transactions(self) -> List[Transaction]:
        return self.ledger.transactions

    def get_net_balances(self) -> Dict:
        return self.ledger.get_net_balances()
