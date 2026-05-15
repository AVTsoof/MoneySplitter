import { useState, useEffect } from 'react';
import { CalculationResults } from '../types';
import DebtMap from './DebtMap';

interface MapTabProps {
  results: CalculationResults | null;
  loading: boolean;
  error?: string | null;
}

export default function MapTab({ results, loading, error }: MapTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  const currencies = results ? Object.keys(results.transactions) : [];

  useEffect(() => {
    if (currencies.length > 0 && !selectedCurrency) {
      // Default to USD if available, else the first one
      if (currencies.includes('USD')) {
        setSelectedCurrency('USD');
      } else {
        setSelectedCurrency(currencies[0]);
      }
    }
  }, [currencies, selectedCurrency]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Visualizing debts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6 text-red-500">
        <p className="font-bold">Error loading map</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!results || currencies.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400 text-center">
        <p className="text-lg">No debts to map.</p>
        <p className="text-sm">Add some bills to see the flow of money.</p>
      </div>
    );
  }

  const currentTransactions = selectedCurrency ? results.transactions[selectedCurrency] : [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-lg font-bold text-gray-800">The Debt Map</h2>
          <p className="text-xs text-gray-500">Who needs to pay who.</p>
        </div>
        
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {currencies.map(curr => (
            <button
              key={curr}
              onClick={() => setSelectedCurrency(curr)}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                selectedCurrency === curr 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {curr}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden relative">
        {selectedCurrency && (
          currentTransactions.length > 0 ? (
            <div className="h-full w-full">
              <DebtMap transactions={currentTransactions} height={500} />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-gray-300 italic p-10 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              All square in {selectedCurrency}!
            </div>
          )
        )}
      </div>
    </div>
  );
}
