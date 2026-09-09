"""Dumps golden vectors from the Python engine so the TypeScript port can be
verified against the original implementation. Deleted in Stage C with the rest
of the Python code."""

import json
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.engine import (  # noqa: E402
    CurrencyConverter,
    DebtSimplifier,
    EqualSplitStrategy,
    ExactSplitStrategy,
    Expense,
    Ledger,
    PercentageSplitStrategy,
    Transfer,
)

OUT = os.path.join(
    os.path.dirname(__file__), "..", "web", "src", "core", "__tests__", "fixtures"
)


def dec(d):
    return str(d)


def shares_of(strategy, total, participants):
    return {k: dec(v) for k, v in strategy.calculate_shares(Decimal(total), participants).items()}


def equal_split_cases():
    cases = [
        ("no residue", "30.00", ["A", "B", "C"]),
        ("positive residue of one penny", "10.00", ["A", "B", "C"]),
        ("negative residue on tiny amount", "0.05", ["A", "B", "C"]),
        ("negative residue of one penny", "10.00", ["A", "B", "C", "D", "E", "F", "G"]),
        ("negative residue of two pennies", "10.00", ["A", "B", "C", "D", "E", "F"]),
        ("negative total", "-10.00", ["A", "B", "C"]),
        ("single participant", "7.77", ["A"]),
        ("example group train fare", "70.0", ["Alice", "Ariel", "Bob", "Charlie", "David"]),
    ]
    return [
        {
            "name": name,
            "total": total,
            "participants": ps,
            "expected": shares_of(EqualSplitStrategy(), total, ps),
        }
        for name, total, ps in cases
    ]


def exact_split_cases():
    return [
        {
            "name": "exact amounts",
            "total": "30.00",
            "participants": ["A", "B"],
            "amounts": {"A": "10.00", "B": "20.00"},
            "expected": shares_of(
                ExactSplitStrategy({"A": Decimal("10.00"), "B": Decimal("20.00")}),
                "30.00",
                ["A", "B"],
            ),
        },
        {
            "name": "participant missing from amounts gets zero",
            "total": "30.00",
            "participants": ["A", "B", "C"],
            "amounts": {"A": "10.00", "B": "20.00"},
            "expected": shares_of(
                ExactSplitStrategy({"A": Decimal("10.00"), "B": Decimal("20.00")}),
                "30.00",
                ["A", "B", "C"],
            ),
        },
        {
            "name": "example group dinner with one pricier share",
            "total": "175.0",
            "participants": ["Alice", "Ariel", "Bob", "Charlie", "David"],
            "amounts": {
                "Alice": "30.0",
                "Ariel": "30.0",
                "Bob": "30.0",
                "Charlie": "55.0",
                "David": "30.0",
            },
            "expected": shares_of(
                ExactSplitStrategy(
                    {
                        "Alice": Decimal("30.0"),
                        "Ariel": Decimal("30.0"),
                        "Bob": Decimal("30.0"),
                        "Charlie": Decimal("55.0"),
                        "David": Decimal("30.0"),
                    }
                ),
                "175.0",
                ["Alice", "Ariel", "Bob", "Charlie", "David"],
            ),
        },
    ]


def percentage_split_cases():
    return [
        {
            "name": "sixty forty",
            "total": "10.00",
            "participants": ["A", "B"],
            "percentages": {"A": "60", "B": "40"},
            "expected": shares_of(
                PercentageSplitStrategy({"A": Decimal("60"), "B": Decimal("40")}),
                "10.00",
                ["A", "B"],
            ),
        },
        {
            "name": "thirds with residue",
            "total": "10.00",
            "participants": ["A", "B", "C"],
            "percentages": {"A": "33.33", "B": "33.33", "C": "33.34"},
            "expected": shares_of(
                PercentageSplitStrategy(
                    {"A": Decimal("33.33"), "B": Decimal("33.33"), "C": Decimal("33.34")}
                ),
                "10.00",
                ["A", "B", "C"],
            ),
        },
    ]


def error_cases():
    return [
        {
            "name": "exact amounts must equal total",
            "strategy": {"type": "exact", "amounts": {"A": "10.00", "B": "10.00"}},
            "total": "30.00",
            "participants": ["A", "B"],
        },
        {
            "name": "percentages must sum to one hundred",
            "strategy": {"type": "percentage", "percentages": {"A": "50", "B": "40"}},
            "total": "10.00",
            "participants": ["A", "B"],
        },
    ]


def build(tx):
    if tx["kind"] == "expense":
        strategy = EqualSplitStrategy()
        spec = tx.get("strategy", {"type": "equal"})
        if spec["type"] == "exact":
            strategy = ExactSplitStrategy({k: Decimal(v) for k, v in spec["amounts"].items()})
        elif spec["type"] == "percentage":
            strategy = PercentageSplitStrategy(
                {k: Decimal(v) for k, v in spec["percentages"].items()}
            )
        return Expense(
            tx["id"],
            tx["payer"],
            Decimal(tx["amount"]),
            tx["participants"],
            tx.get("description", ""),
            strategy,
            currency=tx["currency"],
        )
    return Transfer(
        tx["id"],
        tx["sender"],
        tx["receiver"],
        Decimal(tx["amount"]),
        tx["currency"],
        tx.get("description", "Transfer"),
    )


def ledger_cases():
    scenarios = [
        {
            "name": "single equal expense",
            "transactions": [
                {
                    "kind": "expense",
                    "id": "1",
                    "payer": "A",
                    "amount": "10.00",
                    "currency": "USD",
                    "participants": ["A", "B", "C"],
                    "strategy": {"type": "equal"},
                }
            ],
        },
        {
            "name": "transfer credits sender and debits receiver",
            "transactions": [
                {
                    "kind": "transfer",
                    "id": "1",
                    "sender": "A",
                    "receiver": "B",
                    "amount": "5.00",
                    "currency": "USD",
                }
            ],
        },
        {
            "name": "multi currency ledger",
            "transactions": [
                {
                    "kind": "expense",
                    "id": "1",
                    "payer": "A",
                    "amount": "10.00",
                    "currency": "USD",
                    "participants": ["A", "B", "C"],
                    "strategy": {"type": "equal"},
                },
                {
                    "kind": "expense",
                    "id": "2",
                    "payer": "B",
                    "amount": "15.00",
                    "currency": "EUR",
                    "participants": ["B", "C"],
                    "strategy": {"type": "equal"},
                },
            ],
        },
        {
            "name": "expense then partial repayment",
            "transactions": [
                {
                    "kind": "expense",
                    "id": "1",
                    "payer": "Alice",
                    "amount": "70.0",
                    "currency": "EUR",
                    "participants": ["Alice", "Ariel", "Bob", "Charlie", "David"],
                    "strategy": {"type": "equal"},
                },
                {
                    "kind": "transfer",
                    "id": "2",
                    "sender": "Bob",
                    "receiver": "Alice",
                    "amount": "14.00",
                    "currency": "EUR",
                },
            ],
        },
    ]
    out = []
    for s in scenarios:
        ledger = Ledger()
        for tx in s["transactions"]:
            ledger.add_transaction(build(tx))
        balances = ledger.get_net_balances()
        out.append(
            {
                "name": s["name"],
                "transactions": s["transactions"],
                "expected": {
                    cur: {u: dec(b) for u, b in bal.items()} for cur, bal in balances.items()
                },
            }
        )
    return out


def unified_cases():
    ledger = Ledger()
    ledger.add_transaction(
        build(
            {
                "kind": "expense",
                "id": "1",
                "payer": "A",
                "amount": "10.00",
                "currency": "USD",
                "participants": ["A", "B"],
                "strategy": {"type": "equal"},
            }
        )
    )
    ledger.add_transaction(
        build(
            {
                "kind": "expense",
                "id": "2",
                "payer": "B",
                "amount": "20.00",
                "currency": "EUR",
                "participants": ["A", "B"],
                "strategy": {"type": "equal"},
            }
        )
    )
    transactions = [
        {
            "kind": "expense",
            "id": "1",
            "payer": "A",
            "amount": "10.00",
            "currency": "USD",
            "participants": ["A", "B"],
            "strategy": {"type": "equal"},
        },
        {
            "kind": "expense",
            "id": "2",
            "payer": "B",
            "amount": "20.00",
            "currency": "EUR",
            "participants": ["A", "B"],
            "strategy": {"type": "equal"},
        },
    ]
    with_rate = ledger.get_unified_balances("USD", {"EUR": Decimal("1.1")})
    # A currency with no rate is skipped entirely rather than assumed 1:1.
    without_rate = ledger.get_unified_balances("USD", {})
    return [
        {
            "name": "converts eur into usd base",
            "transactions": transactions,
            "baseCurrency": "USD",
            "rates": {"EUR": "1.1"},
            "expected": {u: dec(b) for u, b in with_rate.items()},
        },
        {
            "name": "skips currency with missing rate",
            "transactions": transactions,
            "baseCurrency": "USD",
            "rates": {},
            "expected": {u: dec(b) for u, b in without_rate.items()},
        },
    ]


def simplify_cases():
    scenarios = [
        {
            "name": "three members one creditor",
            "balances": {"USD": {"A": "6.66", "B": "-3.33", "C": "-3.33"}},
        },
        {
            "name": "already settled",
            "balances": {"USD": {"A": "0", "B": "0"}},
        },
        {
            "name": "two creditors two debtors",
            "balances": {"USD": {"A": "50.00", "B": "30.00", "C": "-60.00", "D": "-20.00"}},
        },
        {
            "name": "multi currency simplified independently",
            "balances": {
                "EUR": {"Alice": "56.00", "Ariel": "-14.00", "Bob": "-14.00", "Charlie": "-14.00", "David": "-14.00"},
                "USD": {"Alice": "-25.00", "Bob": "25.00"},
            },
        },
        {
            "name": "equal debts tie broken by member name",
            "balances": {"USD": {"A": "10.00", "B": "-5.00", "C": "-5.00"}},
        },
        {
            "name": "dust below threshold is ignored",
            "balances": {"USD": {"A": "0.0005", "B": "-0.0005"}},
        },
    ]
    out = []
    for s in scenarios:
        multi = {
            cur: {u: Decimal(v) for u, v in bal.items()} for cur, bal in s["balances"].items()
        }
        out.append(
            {"name": s["name"], "balances": s["balances"], "expected": DebtSimplifier.simplify(multi)}
        )
    return out


def exchange_rate_cases():
    rates = {"USD": 1.0, "EUR": 0.92, "GBP": 0.78}
    pairs = [
        ("USD", "USD"),
        ("USD", "EUR"),
        ("EUR", "USD"),
        ("EUR", "GBP"),
        ("USD", "JPY"),
    ]
    return [
        {
            "name": f"{a} to {b}",
            "rates": {k: str(v) for k, v in rates.items()},
            "from": a,
            "to": b,
            "expected": dec(CurrencyConverter.get_exchange_rate(rates, a, b)),
        }
        for a, b in pairs
    ] + [
        {
            "name": "empty rate table falls back to one",
            "rates": {},
            "from": "USD",
            "to": "EUR",
            "expected": dec(CurrencyConverter.get_exchange_rate({}, "USD", "EUR")),
        }
    ]


def main():
    os.makedirs(OUT, exist_ok=True)
    bundles = {
        "equal-split.json": equal_split_cases(),
        "exact-split.json": exact_split_cases(),
        "percentage-split.json": percentage_split_cases(),
        "split-errors.json": error_cases(),
        "net-balances.json": ledger_cases(),
        "unified-balances.json": unified_cases(),
        "debt-simplification.json": simplify_cases(),
        "exchange-rates.json": exchange_rate_cases(),
    }
    for filename, data in bundles.items():
        path = os.path.join(OUT, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"wrote {len(data)} cases to {os.path.relpath(path)}")


if __name__ == "__main__":
    main()
