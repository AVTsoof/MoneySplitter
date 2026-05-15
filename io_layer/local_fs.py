import os
from typing import List
from .repository import TransactionRepository

class LocalFileSystemIO(TransactionRepository):
    """
    Concrete implementation of TransactionRepository using the local file system.
    This simulates the decentralized Google Drive architecture by creating
    a '.data/group_id/' folder and appending to 'events_user_id.csv' files.
    """
    def __init__(self, base_dir: str = ".data"):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_group_dir(self, group_id: str) -> str:
        group_dir = os.path.join(self.base_dir, group_id)
        os.makedirs(group_dir, exist_ok=True)
        return group_dir

    def fetch_events(self, group_id: str) -> List[str]:
        group_dir = self._get_group_dir(group_id)
        events = []
        for filename in os.listdir(group_dir):
            if filename.startswith("events_") and filename.endswith(".csv"):
                file_path = os.path.join(group_dir, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    events.extend(f.readlines())
        return [e.strip() for e in events if e.strip()]

    def append_event(self, group_id: str, user_id: str, event_csv_row: str) -> None:
        group_dir = self._get_group_dir(group_id)
        file_path = os.path.join(group_dir, f"events_{user_id}.csv")
        with open(file_path, "a", encoding="utf-8") as f:
            f.write(event_csv_row + "\n")
