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

export async function calculateBalances(expensesJson: string) {
  const py = await initPyodide();
  
  const script = `
import json
from decimal import Decimal
from engine import Ledger, Expense, DebtSimplifier

expenses_data = json.loads('${expensesJson}')
ledger = Ledger()

for e in expenses_data:
    expense = Expense(
        id=e['id'],
        payer=e['payer'],
        total_amount=Decimal(e['total_amount']),
        participants=e['participants'],
        description=e['description']
    )
    ledger.add_expense(expense)

balances = ledger.get_net_balances()
simplified = DebtSimplifier.simplify(balances)

# Convert balances to strings for JSON serialization
serializable_balances = {k: str(v) for k, v in balances.items()}

json.dumps({
    "balances": serializable_balances,
    "transactions": simplified
})
`;
  const result = await py.runPythonAsync(script);
  return JSON.parse(result);
}
