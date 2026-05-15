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
    // Dynamically load the script if not present
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
    document.head.appendChild(script);
    await new Promise((resolve) => (script.onload = resolve));
  }

  pyodide = await window.loadPyodide();
  
  // Load the engine code
  const response = await fetch('/engine.py');
  const code = await response.text();
  await pyodide.runPythonAsync(code);
  
  return pyodide;
}

export async function calculateBalances(expensesJson: string, defaultCurrency: string = 'USD') {
  const py = await initPyodide();
  
  const script = `
import json
from decimal import Decimal
from engine import Ledger, Expense, DebtSimplifier, GroupSettings

expenses_data = json.loads('${expensesJson}')
settings = GroupSettings(default_currency='${defaultCurrency}')
ledger = Ledger(settings=settings)

for e in expenses_data:
    expense = Expense(
        id=e['id'],
        payer=e['payer'],
        total_amount=Decimal(e['total_amount']),
        participants=e['participants'],
        description=e['description'],
        currency=e.get('currency')
    )
    ledger.add_expense(expense)

multi_balances = ledger.get_net_balances()
multi_simplified = DebtSimplifier.simplify(multi_balances)

# Convert Decimal balances to strings for JSON serialization
serializable_balances = {}
for curr, balances in multi_balances.items():
    serializable_balances[curr] = {k: str(v) for k, v in balances.items()}

json.dumps({
    "balances": serializable_balances,
    "transactions": multi_simplified
})
`;
  const result = await py.runPythonAsync(script);
  return JSON.parse(result);
}
