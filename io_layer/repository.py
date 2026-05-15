from abc import ABC, abstractmethod
from typing import List

class TransactionRepository(ABC):
    """
    Abstract base class for the Persistence Layer.
    This defines the interface for interacting with the append-only multi-file CSV database.
    """

    @abstractmethod
    def fetch_events(self, group_id: str) -> List[str]:
        """
        Fetches all event rows from the group's storage.
        
        Args:
            group_id: The unique identifier for the group.
            
        Returns:
            A list of raw CSV row strings across all user files in the group.
        """
        pass

    @abstractmethod
    def append_event(self, group_id: str, user_id: str, event_csv_row: str) -> None:
        """
        Appends a single event row to the user's specific append-only CSV file.
        
        Args:
            group_id: The unique identifier for the group.
            user_id: The ID of the user creating the event.
            event_csv_row: The formatted CSV string representing the event.
        """
        pass

    @abstractmethod
    def save_exchange_rates(self, rates: dict) -> None:
        """
        Saves the current exchange rates to storage.
        
        Args:
            rates: Dictionary containing exchange rate data and metadata.
        """
        pass

    @abstractmethod
    def get_exchange_rates(self) -> dict:
        """
        Retrieves the current exchange rates from storage.
        
        Returns:
            Dictionary containing exchange rate data and metadata, or empty dict if not found.
        """
        pass

    @abstractmethod
    def save_group_settings(self, group_id: str, settings: dict) -> None:
        """
        Saves the settings for a specific group.
        """
        pass

    @abstractmethod
    def get_group_settings(self, group_id: str) -> dict:
        """
        Retrieves the settings for a specific group.
        """
        pass

    @abstractmethod
    def list_groups(self) -> List[str]:
        """
        Returns a list of all group IDs available in storage.
        """
        pass

    @abstractmethod
    def update_event(self, group_id: str, user_id: str, tx_id: str, new_csv_row: str) -> bool:
        """
        Replaces an existing event row (matched by tx_id) in the user's CSV file.

        Args:
            group_id: The unique identifier for the group.
            user_id: The ID of the user who owns the event.
            tx_id: The transaction ID of the event to replace.
            new_csv_row: The new formatted CSV string.

        Returns:
            True if the event was found and replaced, False otherwise.
        """
        pass

    @abstractmethod
    def delete_event(self, group_id: str, tx_id: str) -> bool:
        """
        Removes an event row (matched by tx_id) from all user CSV files in the group.

        Args:
            group_id: The unique identifier for the group.
            tx_id: The transaction ID of the event to remove.

        Returns:
            True if the event was found and removed, False otherwise.
        """
        pass
