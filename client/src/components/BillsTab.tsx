import { Expense } from '../types';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ReceiptText } from "lucide-react";

interface BillsTabProps {
  expenses: Expense[];
  onAddClick: () => void;
}

export default function BillsTab({ expenses, onAddClick }: BillsTabProps) {
  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto space-y-4 pb-24 px-1">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <ReceiptText className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-lg font-medium">No bills yet.</p>
            <p className="text-sm">Tap the + to add your first expense.</p>
          </div>
        ) : (
          [...expenses].reverse().map(e => (
            <Card key={e.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {e.payer.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground leading-none mb-1">{e.description}</h3>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-primary">{e.payer === 'You' ? 'You' : e.payer}</span> paid
                      <span className="mx-1">•</span>
                      {e.participants.length} people
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{e.total_amount} {e.currency}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button
        onClick={onAddClick}
        size="icon"
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl transition-all z-10"
        aria-label="Add Bill"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
