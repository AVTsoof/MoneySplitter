import { useState, useMemo } from 'react';
import { Expense } from '../types';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ReceiptText, CalendarDays, List, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import Avatar from "boring-avatars";
import { motion, AnimatePresence } from "framer-motion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface BillsTabProps {
  expenses: Expense[];
  onAddClick: () => void;
}

export default function BillsTab({ expenses, onAddClick }: BillsTabProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'day' | 'none'>('day');

  const processedExpenses = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    if (groupBy === 'none') {
      return [{ title: null, items: sorted }];
    }

    const groups: { [key: string]: Expense[] } = {};
    const groupOrder: string[] = [];

    sorted.forEach((e) => {
      const date = e.timestamp 
        ? new Date(e.timestamp).toLocaleDateString(undefined, { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
          }) 
        : 'Sometime';
      
      if (!groups[date]) {
        groups[date] = [];
        groupOrder.push(date);
      }
      groups[date].push(e);
    });

    return groupOrder.map(title => ({
      title,
      items: groups[title]
    }));
  }, [expenses, sortOrder, groupBy]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Sub-Header */}
      <div className="px-6 py-4 flex flex-col gap-4 bg-background/50 backdrop-blur-sm border-b border-border/10 shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Latest Activity</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">{expenses.length} Total</span>
        </div>
        
        <div className="flex justify-between items-center gap-2">
          <ToggleGroup type="single" value={groupBy} onValueChange={(val) => val && setGroupBy(val as 'day' | 'none')} className="bg-muted/30 p-0.5 rounded-lg border border-border/20" size="sm">
            <ToggleGroupItem value="day" className="px-2.5 text-[10px] font-bold uppercase tracking-tighter gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <CalendarDays className="w-3 h-3" />
              By Day
            </ToggleGroupItem>
            <ToggleGroupItem value="none" className="px-2.5 text-[10px] font-bold uppercase tracking-tighter gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <List className="w-3 h-3" />
              List
            </ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup type="single" value={sortOrder} onValueChange={(val) => val && setSortOrder(val as 'asc' | 'desc')} className="bg-muted/30 p-0.5 rounded-lg border border-border/20" size="sm">
            <ToggleGroupItem value="desc" className="px-2.5 text-[10px] font-bold uppercase tracking-tighter gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <ArrowDownWideNarrow className="w-3 h-3" />
              Newest
            </ToggleGroupItem>
            <ToggleGroupItem value="asc" className="px-2.5 text-[10px] font-bold uppercase tracking-tighter gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <ArrowUpWideNarrow className="w-3 h-3" />
              Oldest
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-32 scrollbar-hide">
        {expenses.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center"
          >
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <ReceiptText className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-lg font-medium">No bills yet.</p>
            <p className="text-sm">Tap the + to add your first expense.</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {processedExpenses.map((group, groupIdx) => (
              <div key={group.title || 'all'} className="space-y-3">
                {group.title && (
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                    {group.title}
                  </h3>
                )}
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {group.items.map((e, index) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <Card className="overflow-hidden border border-border/40 shadow-none hover:shadow-md hover:border-primary/20 transition-all cursor-pointer bg-card/30">
                          <CardContent className="p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-2xl overflow-hidden border bg-background flex-shrink-0">
                                <Avatar
                                  size={48}
                                  name={e.payer}
                                  variant="beam"
                                  colors={["#92A1C6", "#14647C", "#F0C987", "#D9A384", "#A7A145"]}
                                />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-foreground text-base truncate leading-tight mb-0.5">{e.description}</h3>
                                <p className="text-xs text-muted-foreground truncate">
                                  <span className="font-bold text-primary">{e.payer === 'You' ? 'You' : e.payer}</span> paid for {e.participants.length}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 pl-4">
                              <p className="text-lg font-black text-foreground tracking-tighter leading-none">{e.total_amount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{e.currency}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Action Button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
        <Button
          onClick={onAddClick}
          className="w-14 h-14 rounded-full shadow-2xl shadow-primary/40 transition-all pointer-events-auto active:scale-95"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
