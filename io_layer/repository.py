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
