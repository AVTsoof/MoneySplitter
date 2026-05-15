import { useState, useEffect } from 'react';
import { CalculationResults } from '../types';
import DebtMap from './DebtMap';
import { Card } from "@/components/ui/card";
import { Loader2, Map as MapIcon, CheckCircle2 } from "lucide-react";
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
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium">Visualizing debts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6 text-destructive">
        <p className="font-bold">Error loading map</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!results || currencies.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
        <MapIcon className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">No debts to map.</p>
        <p className="text-sm">Add some bills to see the flow of money.</p>
      </div>
    );
  }

  const currentTransactions = selectedCurrency ? results.transactions[selectedCurrency] : [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-foreground">The Debt Map</h2>
          <p className="text-xs text-muted-foreground">Who needs to pay who.</p>
        </div>
        
        {currencies.length > 1 && (
          <ToggleGroup 
            type="single" 
            value={selectedCurrency || ""} 
            onValueChange={(v) => v && setSelectedCurrency(v)}
            className="bg-muted/50 p-1 rounded-lg"
          >
            {currencies.map(curr => (
              <ToggleGroupItem 
                key={curr} 
                value={curr} 
                className="text-[10px] font-black uppercase h-7 px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                {curr}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>
      
      <Card className="flex-1 bg-background rounded-3xl shadow-sm border overflow-hidden relative">
        {selectedCurrency && (
          currentTransactions.length > 0 ? (
            <div className="h-full w-full">
              <DebtMap transactions={currentTransactions} height={500} />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground italic p-10 text-center">
              <CheckCircle2 className="h-12 w-12 mb-4 opacity-20 text-primary" />
              <p className="font-semibold text-foreground not-italic">All square in {selectedCurrency}!</p>
              <p className="text-sm">No transactions needed to settle up.</p>
            </div>
          )
        )}
      </Card>
    </div>
  );
}
