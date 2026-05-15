import os
import json
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

    def save_exchange_rates(self, rates: dict) -> None:
        file_path = os.path.join(self.base_dir, "exchange_rates.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(rates, f, indent=4)

    def get_exchange_rates(self) -> dict:
        file_path = os.path.join(self.base_dir, "exchange_rates.json")
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save_group_settings(self, group_id: str, settings: dict) -> None:
        group_dir = self._get_group_dir(group_id)
        file_path = os.path.join(group_dir, "group_settings.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4)

    def get_group_settings(self, group_id: str) -> dict:
        group_dir = self._get_group_dir(group_id)
        file_path = os.path.join(group_dir, "group_settings.json")
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def list_groups(self) -> List[str]:
        groups = []
        if not os.path.exists(self.base_dir):
            return groups
        for entry in os.listdir(self.base_dir):
            if os.path.isdir(os.path.join(self.base_dir, entry)):
                groups.append(entry)
        return groups

    def update_event(self, group_id: str, user_id: str, tx_id: str, new_csv_row: str) -> bool:
        group_dir = self._get_group_dir(group_id)
        file_path = os.path.join(group_dir, f"events_{user_id}.csv")
        if not os.path.exists(file_path):
            return False

        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        updated = False
        new_lines = []
        for line in lines:
            # Check if this line's first CSV field matches the target tx_id
            stripped = line.strip()
            if stripped and stripped.split(",")[0].strip('"') == tx_id:
                new_lines.append(new_csv_row + "\n")
                updated = True
            else:
                new_lines.append(line)

        if updated:
            with open(file_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)

        return updated

    def delete_event(self, group_id: str, tx_id: str) -> bool:
        group_dir = self._get_group_dir(group_id)
        deleted = False
        for filename in os.listdir(group_dir):
            if filename.startswith("events_") and filename.endswith(".csv"):
                file_path = os.path.join(group_dir, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                new_lines = []
                for line in lines:
                    stripped = line.strip()
                    if stripped and stripped.split(",")[0].strip('"') == tx_id:
                        deleted = True  # Skip this line (delete it)
                    else:
                        new_lines.append(line)

                if len(new_lines) != len(lines):
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.writelines(new_lines)
        return deleted

    def load_example_group(self, group_id: str = "example_group", examples_dir: str = "examples/example_group"):
        """Copies the example group from the examples folder to .data/group_id."""
        import shutil
        group_dir = self._get_group_dir(group_id)
        if os.path.exists(examples_dir):
            for filename in os.listdir(examples_dir):
                src = os.path.join(examples_dir, filename)
                dst = os.path.join(group_dir, filename)
                if os.path.isfile(src):
                    shutil.copy2(src, dst)
