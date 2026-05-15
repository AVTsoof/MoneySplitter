// Pyodide bridge to run Python engine in the browser
declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodide: any = null;

export async function initPyodide() {
  if (pyodide) return pyodide;

  if (!window.loadPyodide) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
    document.head.appendChild(script);
    await new Promise((resolve) => (script.onload = resolve));
  }

  pyodide = await window.loadPyodide();
  
  // Load the engine code and write it to the virtual filesystem
  const response = await fetch('/engine.py');
  const code = await response.text();
  pyodide.FS.writeFile('engine.py', code);
  
  return pyodide;
}

export async function calculateBalances(expensesJson: string, defaultCurrency: string = 'USD') {
  const py = await initPyodide();
  
  // Pass the JSON data via globals
  py.globals.set('EXPENSES_JSON', expensesJson);
  py.globals.set('DEFAULT_CURRENCY', defaultCurrency);
  
  // Mock exchange rates (1 EUR = 1.1 USD, 1 GBP = 1.25 USD, etc.)
  // In a real app, these would be fetched from an API
  const mockRates = {
    'USD': 1.0,
    'EUR': 1.1,
    'GBP': 1.25,
    'ILS': 0.27
  };
  py.globals.set('EXCHANGE_RATES_JSON', JSON.stringify(mockRates));
  
  const script = `
import json
from decimal import Decimal
from engine import Ledger, Expense, DebtSimplifier, GroupSettings

expenses_data = json.loads(EXPENSES_JSON)
rates_data = json.loads(EXCHANGE_RATES_JSON)
exchange_rates = {k: Decimal(str(v)) for k, v in rates_data.items()}

settings = GroupSettings(default_currency=DEFAULT_CURRENCY)
ledger = Ledger(settings=settings)

# Track all currencies mentioned in expenses
active_currencies = set([DEFAULT_CURRENCY])

for e in expenses_data:
    curr = e.get('currency', DEFAULT_CURRENCY)
    active_currencies.add(curr)
    expense = Expense(
        id=e['id'],
        payer=e['payer'],
        total_amount=Decimal(e['total_amount']),
        participants=e['participants'],
        description=e['description'],
        currency=curr
    )
    ledger.add_expense(expense)

# For each active currency, calculate a UNIFIED view
# This makes the graph topology identical across currencies, only scaling the values
results_balances = {}
results_transactions = {}

for base_curr in active_currencies:
    # Convert all other currency rates to be relative to base_curr
    # If base is EUR and we have rate {EUR: 1.1 USD}, then 1 USD = 1/1.1 EUR
    base_rate_to_usd = exchange_rates.get(base_curr, Decimal('1'))
    relative_rates = {curr: rate / base_rate_to_usd for curr, rate in exchange_rates.items()}
    
    unified_balances = ledger.get_unified_balances(base_curr, relative_rates)
    
    # Format for JSON
    results_balances[base_curr] = {k: str(v) for k, v in unified_balances.items()}
    
    # Simplify debts for this unified view
    # DebtSimplifier expects {curr: {user: balance}}
    results_transactions[base_curr] = DebtSimplifier._simplify_single_currency(unified_balances)

json.dumps({
    "balances": results_balances,
    "transactions": results_transactions
})
`;
  const result = await py.runPythonAsync(script);
  return JSON.parse(result);
}
