"""Export the legacy example ledger as the web app's static seed fixture."""

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "examples" / "example_group"
OUTPUT = ROOT / "web" / "src" / "data" / "seed" / "exampleGroup.json"


def main() -> None:
    settings = json.loads((SOURCE / "group_settings.json").read_text())
    transactions = []

    for path in sorted(SOURCE.glob("events_*.csv")):
        with path.open(newline="") as file:
            for row in csv.reader(file):
                transactions.append(json.loads(row[3]))

    transactions.sort(key=lambda transaction: transaction["timestamp"])
    payload = {"settings": settings, "transactions": transactions}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()