import { useState, useEffect } from 'react';
import { calculateBalances } from './bridge/pyodide';
import { Expense, CalculationResults } from './types';
import BillsTab from './components/BillsTab';
import BalancesTab from './components/BalancesTab';
import AddBillScreen from './components/AddBillScreen';
import MapTab from './components/MapTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Wallet, Map as MapIcon, Sun, Moon } from "lucide-react";
import { useTheme } from './components/theme-provider';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: '1', payer: 'Ariel', total_amount: '30.00', participants: ['Ariel', 'Bob', 'Charlie'], description: 'Pizza', currency: 'USD' },
    { id: '2', payer: 'Bob', total_amount: '15.00', participants: ['Bob', 'Charlie'], description: 'Drinks', currency: 'EUR' }
  ]);
  
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddBill, setShowAddBill] = useState(false);
  const { theme, setTheme } = useTheme();

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

  return (
    <div className="h-[100dvh] bg-muted/30 flex flex-col max-w-lg mx-auto shadow-2xl overflow-hidden border-x bg-background relative">
      <AnimatePresence mode="wait">
        {showAddBill && (
          <AddBillScreen 
            key="add-bill"
            onSave={handleAddExpense} 
            onCancel={() => setShowAddBill(false)} 
            availableUsers={availableUsers}
          />
        )}
      </AnimatePresence>

      <Tabs defaultValue="bills" className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center border-b border-border/40">
          <h1 className="text-xl font-black text-primary tracking-tighter">MoneySplitter</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-full w-8 h-8"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden relative">
          <TabsContent value="bills" className="h-full m-0 focus-visible:outline-none">
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="h-full overflow-hidden"
            >
              <BillsTab expenses={expenses} onAddClick={() => setShowAddBill(true)} />
            </motion.div>
          </TabsContent>
          
          <TabsContent value="balances" className="h-full m-0 focus-visible:outline-none">
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="h-full overflow-hidden"
            >
              <BalancesTab results={results} loading={loading} error={error} />
            </motion.div>
          </TabsContent>
          
          <TabsContent value="map" className="h-full m-0 focus-visible:outline-none">
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="h-full overflow-hidden"
            >
              <MapTab results={results} loading={loading} error={error} />
            </motion.div>
          </TabsContent>
        </main>

        {/* Bottom Navigation */}
        <nav className="shrink-0 bg-background/80 backdrop-blur-md border-t border-border/40 pb-safe px-6 py-3">
          <TabsList className="w-full grid grid-cols-3 h-14 bg-muted/50 p-1 rounded-2xl">
            <TabsTrigger value="bills" className="rounded-xl flex flex-col gap-0.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
              <Receipt className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Bills</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="rounded-xl flex flex-col gap-0.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
              <Wallet className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Bottom Line</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="rounded-xl flex flex-col gap-0.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
              <MapIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Map</span>
            </TabsTrigger>
          </TabsList>
        </nav>
      </Tabs>
    </div>
  );
}

export default App;
