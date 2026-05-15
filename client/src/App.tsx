import { useState, useEffect } from 'react';
import { calculateBalances } from './bridge/pyodide';
import { Expense, CalculationResults } from './types';
import BillsTab from './components/BillsTab';
import BalancesTab from './components/BalancesTab';
import AddBillScreen from './components/AddBillScreen';
import MapTab from './components/MapTab';

function App() {
  const [activeTab, setActiveTab] = useState<'bills' | 'balances' | 'map'>('bills');
  const [showAddBill, setShowAddBill] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: '1', payer: 'Ariel', total_amount: '30.00', participants: ['Ariel', 'Bob', 'Charlie'], description: 'Pizza', currency: 'USD' },
    { id: '2', payer: 'Bob', total_amount: '15.00', participants: ['Bob', 'Charlie'], description: 'Drinks', currency: 'EUR' }
  ]);
  
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available users for the group (mocked for now)
  const availableUsers = ['You', 'Ariel', 'Bob', 'Charlie', 'David'];

  useEffect(() => {
    const runCalculation = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await calculateBalances(JSON.stringify(expenses));
        setResults(res);
      } catch (err: any) {
        console.error('Calculation error:', err);
        setError(err.message || 'Failed to calculate balances');
      } finally {
        setLoading(false);
      }
    };

    runCalculation();
  }, [expenses]);

  const handleAddExpense = (newExpense: Omit<Expense, 'id'>) => {
    const expenseWithId: Expense = {
      ...newExpense,
      id: Math.random().toString(36).substr(2, 9),
    };
    setExpenses([...expenses, expenseWithId]);
    setShowAddBill(false);
  };

  if (showAddBill) {
    return (
      <AddBillScreen 
        onSave={handleAddExpense} 
        onCancel={() => setShowAddBill(false)} 
        availableUsers={availableUsers}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto shadow-xl h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 pt-10 pb-4 border-b border-gray-100 shrink-0">
        <h1 className="text-2xl font-black text-blue-600 tracking-tight">MoneySplitter</h1>
      </header>

      {/* Tabs Navigation */}
      <nav className="bg-white flex px-6 border-b border-gray-100 shrink-0">
        <button
          onClick={() => setActiveTab('bills')}
          className={`flex-1 py-4 text-[10px] font-black transition-all border-b-2 ${
            activeTab === 'bills' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
          }`}
        >
          BILLS
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`flex-1 py-4 text-[10px] font-black transition-all border-b-2 ${
            activeTab === 'balances' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
          }`}
        >
          THE BOTTOM LINE
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-4 text-[10px] font-black transition-all border-b-2 ${
            activeTab === 'map' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
          }`}
        >
          THE MAP
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full w-full p-6 flex flex-col">
          {activeTab === 'bills' && (
            <BillsTab expenses={expenses} onAddClick={() => setShowAddBill(true)} />
          )}
          {activeTab === 'balances' && (
            <BalancesTab results={results} loading={loading} error={error} />
          )}
          {activeTab === 'map' && (
            <MapTab results={results} loading={loading} error={error} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
