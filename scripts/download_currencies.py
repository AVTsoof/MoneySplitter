import json
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CURRENCY_DATA_FILE = DATA_DIR / "currencies.json"
SOURCE_URL = "https://openexchangerates.org/api/currencies.json"


def download_currency_file(dest: Path = CURRENCY_DATA_FILE, source: str = SOURCE_URL) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading currency metadata from {source}...")
    req = urllib.request.Request(source, headers={"User-Agent": "MoneySplitter/1.0"})
    with urllib.request.urlopen(req, timeout=15) as response:
        content = response.read().decode("utf-8")
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("Downloaded currency metadata is not a valid JSON object.")
    with dest.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, sort_keys=True, ensure_ascii=False)
    print(f"Saved currency metadata to {dest}")


if __name__ == "__main__":
    download_currency_file()
