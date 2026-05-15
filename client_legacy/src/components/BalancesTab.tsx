import { CalculationResults } from '../types';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, ArrowRight, Wallet, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BalancesTabProps {
  results: CalculationResults | null;
  loading: boolean;
  error?: string | null;
}

export default function BalancesTab({ results, loading, error }: BalancesTabProps) {
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Crunching the numbers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center mb-4 border border-destructive/20">
          <AlertCircle className="h-8 w-8" />
        </div>
        <p className="text-foreground font-black text-xl tracking-tight mb-2">Calculation failed</p>
        <p className="text-muted-foreground text-sm mb-6">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="rounded-2xl px-8">
          Retry
        </Button>
      </div>
    );
  }

  if (!results || Object.keys(results.balances).length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
        <Wallet className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-bold text-foreground">No math to show yet.</p>
        <p className="text-sm">Add some bills to see the bottom line.</p>
      </div>
    );
  }

  // Calculate high-level summary for 'You'
  const currencies = Object.keys(results.balances);
  const yourSummaries = currencies.map(curr => {
    const bal = parseFloat(results.balances[curr]['You'] || '0');
    return { curr, bal };
  });

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Status Header */}
      <div className="px-6 py-6 bg-primary text-primary-foreground shrink-0 rounded-b-[2.5rem] shadow-xl shadow-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Your Status</p>
          <div className="space-y-1">
            {yourSummaries.map(s => (
              <div key={s.curr} className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tighter">
                  {s.bal >= 0 ? '+' : ''}{s.bal.toFixed(2)}
                </span>
                <span className="text-sm font-bold opacity-60">{s.curr}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-10 scrollbar-hide space-y-10">
        {currencies.map(currency => (
          <div key={currency} className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{currency} Ledger</span>
              <Separator className="flex-1 opacity-10" />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Net Balances Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                  <div className="w-1 h-3 bg-primary rounded-full" /> Net Balances
                </h3>
                <Card className="border border-border/40 shadow-none bg-card/20 rounded-3xl overflow-hidden">
                  <CardContent className="p-0 divide-y divide-border/10">
                    {Object.entries(results.balances[currency]).map(([user, bal]) => {
                      const val = parseFloat(bal);
                      if (Math.abs(val) < 0.01 && user !== 'You') return null;
                      return (
                        <div key={user} className="flex justify-between items-center p-4">
                          <span className="text-base font-bold text-foreground">{user === 'You' ? 'You' : user}</span>
                          <div className="text-right">
                            <span className={`text-lg font-black tracking-tight ${val >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
                              {val >= 0 ? '+' : ''}{bal}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Settlement Plan Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                   <Sparkles className="w-3 h-3 text-primary" /> Settlement Plan
                </h3>
                <div className="space-y-3">
                  {results.transactions[currency].length === 0 ? (
                    <div className="py-8 text-center bg-muted/20 rounded-3xl border border-dashed border-border/40">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Everyone is square!</p>
                    </div>
                  ) : (
                    results.transactions[currency].map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-card border border-border/40 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">From</span>
                            <span className="font-bold text-foreground text-sm">{t.from}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-primary opacity-40 mx-1" />
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">To</span>
                            <span className="font-bold text-foreground text-sm">{t.to}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-primary text-xl tracking-tighter">{t.amount}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">{currency}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
