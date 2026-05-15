import { CalculationResults } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium">Crunching the numbers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <p className="text-foreground font-bold text-lg mb-2">Calculation failed</p>
        <p className="text-muted-foreground text-sm mb-6">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!results || Object.keys(results.balances).length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
        <Wallet className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">No math to show yet.</p>
        <p className="text-sm">Add some bills to see the bottom line.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-8 pb-10">
      {Object.keys(results.balances).map(currency => (
        <div key={currency} className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{currency} Ledger</span>
            <Separator className="flex-1" />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Net Balances Card */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> The Bottom Line
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(results.balances[currency]).map(([user, bal], idx, arr) => {
                  const val = parseFloat(bal);
                  if (Math.abs(val) < 0.01) return null;
                  return (
                    <div key={user}>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-lg font-semibold text-foreground">{user === 'You' ? 'You' : user}</span>
                        <div className="text-right">
                          <span className={`text-xl font-black ${val >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
                            {val >= 0 ? '+' : ''}{bal}
                          </span>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                            {val >= 0 ? 'is owed' : 'owes'}
                          </p>
                        </div>
                      </div>
                      {idx < arr.length - 1 && <Separator className="mt-4 opacity-50" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Smart Settle Card */}
            <Card className="border-none shadow-sm bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Smart Settle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.transactions[currency].length === 0 ? (
                  <p className="text-muted-foreground italic text-center py-4">Everything is square!</p>
                ) : (
                  results.transactions[currency].map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-background rounded-xl border shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{t.from}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-bold text-foreground text-sm">{t.to}</span>
                      </div>
                      <span className="font-black text-primary text-lg">{t.amount} {currency}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}
