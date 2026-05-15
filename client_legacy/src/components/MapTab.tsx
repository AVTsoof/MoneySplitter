import { useState, useEffect } from 'react';
import { CalculationResults } from '../types';
import DebtMap from './DebtMap';
import { Loader2, Map as MapIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
      if (currencies.includes('USD')) {
        setSelectedCurrency('USD');
      } else {
        setSelectedCurrency(currencies[0]);
      }
    }
  }, [currencies, selectedCurrency]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Visualizing debts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center mb-4 border border-destructive/20">
          <AlertCircle className="h-8 w-8" />
        </div>
        <p className="text-foreground font-black text-xl tracking-tight mb-2">Map Error</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  if (!results || currencies.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center px-10">
        <MapIcon className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-bold text-foreground">No debts to map.</p>
        <p className="text-sm">Add some bills to see the flow of money.</p>
      </div>
    );
  }

  const currentTransactions = selectedCurrency ? results.transactions[selectedCurrency] : [];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Sub-Header */}
      <div className="px-6 py-4 flex flex-col gap-4 bg-background shrink-0 border-b border-border/10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">The Debt Map</h2>
            <p className="text-[10px] font-bold text-primary opacity-60">Visual flow of money</p>
          </div>
          
          {currencies.length > 1 && (
            <ToggleGroup 
              value={selectedCurrency ? [selectedCurrency] : []} 
              onValueChange={(v) => v.length > 0 && setSelectedCurrency(v[0])}
              className="bg-muted/50 p-1 rounded-xl"
            >
              {currencies.map(curr => (
                <ToggleGroupItem 
                  key={curr} 
                  value={curr} 
                  className="text-[10px] font-black uppercase h-8 px-4 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  {curr}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      </div>
      
      {/* Map Container */}
      <div className="flex-1 relative bg-muted/5">
        {selectedCurrency && (
          currentTransactions.length > 0 ? (
            <div className="absolute inset-0">
              <DebtMap transactions={currentTransactions} height={600} />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
              <CheckCircle2 className="h-12 w-12 mb-4 opacity-20 text-primary" />
              <p className="font-bold text-foreground">All square in {selectedCurrency}!</p>
              <p className="text-sm">No transactions needed to settle up.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
