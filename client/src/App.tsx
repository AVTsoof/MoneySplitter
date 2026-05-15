import { useState, useEffect } from 'react';
import { calculateBalances } from './bridge/pyodide';
import { Expense, CalculationResults } from './types';
import BillsTab from './components/BillsTab';
import BalancesTab from './components/BalancesTab';
import AddBillScreen from './components/AddBillScreen';
import MapTab from './components/MapTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Wallet, Map as MapIcon } from "lucide-react";

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: '1', payer: 'Ariel', total_amount: '30.00', participants: ['Ariel', 'Bob', 'Charlie'], description: 'Pizza', currency: 'USD' },
    { id: '2', payer: 'Bob', total_amount: '15.00', participants: ['Bob', 'Charlie'], description: 'Drinks', currency: 'EUR' }
  ]);
  
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddBill, setShowAddBill] = useState(false);

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
    <div className="min-h-screen bg-muted/30 flex flex-col max-w-lg mx-auto shadow-2xl h-screen overflow-hidden border-x bg-background">
      {/* Header */}
      <header className="px-6 pt-10 pb-4 shrink-0 bg-background">
        <h1 className="text-2xl font-black text-primary tracking-tight">MoneySplitter</h1>
      </header>

      <Tabs defaultValue="bills" className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs Navigation */}
        <div className="px-6 bg-background">
          <TabsList className="w-full grid grid-cols-3 h-12 bg-muted/50 p-1">
            <TabsTrigger value="bills" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Receipt className="w-4 h-4 mr-2 hidden sm:block" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Bills</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Wallet className="w-4 h-4 mr-2 hidden sm:block" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Bottom Line</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <MapIcon className="w-4 h-4 mr-2 hidden sm:block" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Map</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden relative">
          <TabsContent value="bills" className="h-full m-0 p-6 focus-visible:outline-none">
            <BillsTab expenses={expenses} onAddClick={() => setShowAddBill(true)} />
          </TabsContent>
          
          <TabsContent value="balances" className="h-full m-0 p-6 overflow-y-auto focus-visible:outline-none">
            <BalancesTab results={results} loading={loading} error={error} />
          </TabsContent>
          
          <TabsContent value="map" className="h-full m-0 p-6 focus-visible:outline-none">
            <MapTab results={results} loading={loading} error={error} />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}

export default App;
