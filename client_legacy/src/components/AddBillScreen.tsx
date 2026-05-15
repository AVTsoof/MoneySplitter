import { useState } from 'react';
import { Expense } from '../types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "boring-avatars";

interface AddBillScreenProps {
  onSave: (expense: Omit<Expense, 'id'>) => void;
  onCancel: () => void;
  availableUsers: string[];
}

export default function AddBillScreen({ onSave, onCancel, availableUsers }: AddBillScreenProps) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<string[]>(availableUsers);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => step > 1 ? setStep(s => s - 1) : onCancel();

  const handleSave = () => {
    onSave({
      payer: 'You', // Hardcoded for now, will be dynamic with Auth
      total_amount: amount,
      description,
      participants,
      currency: 'USD', // Default for now
    });
  };

  const toggleParticipant = (user: string) => {
    setParticipants(prev => 
      prev.includes(user) ? prev.filter(u => u !== user) : [...prev, user]
    );
  };

  const progress = (step / 3) * 100;

  return (
    <motion.div 
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-background z-50 flex flex-col p-6 max-w-lg mx-auto border-x shadow-2xl"
    >
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="text-muted-foreground hover:text-foreground">
          {step === 1 ? <X className="h-4 w-4 mr-2" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        <div className="flex-1 px-8">
           <Progress value={progress} className="h-1" />
        </div>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest w-12 text-right">{step}/3</span>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col justify-center"
            >
              <h2 className="text-3xl font-black text-foreground mb-6 tracking-tight">How much?</h2>
              <div className="flex items-center border-b-2 border-primary/20 focus-within:border-primary transition-colors pb-2">
                <span className="text-4xl font-black text-muted-foreground mr-4">$</span>
                <Input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-5xl font-black bg-transparent border-none outline-none shadow-none focus-visible:ring-0 p-0 h-auto text-foreground placeholder:text-muted/20"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col justify-center"
            >
              <h2 className="text-3xl font-black text-foreground mb-6 tracking-tight">What was it for?</h2>
              <Input
                autoFocus
                type="text"
                placeholder="e.g. Dinner, Rent, Pizza"
                className="text-2xl font-semibold bg-transparent border-none border-b-2 border-primary/10 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all pb-4 h-auto text-foreground placeholder:text-muted/20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <h2 className="text-3xl font-black text-foreground mb-6 tracking-tight">Who was there?</h2>
              <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2 scrollbar-hide">
                {availableUsers.map(user => (
                  <div 
                    key={user} 
                    onClick={() => toggleParticipant(user)}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-primary/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full overflow-hidden border bg-background">
                        <Avatar
                          size={40}
                          name={user}
                          variant="beam"
                          colors={["#92A1C6", "#14647C", "#F0C987", "#D9A384", "#A7A145"]}
                        />
                      </div>
                      <span className="text-lg font-semibold text-foreground">{user}</span>
                    </div>
                    <Checkbox
                      checked={participants.includes(user)}
                      onCheckedChange={() => toggleParticipant(user)}
                      className="h-6 w-6 rounded-full"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8">
        <Button
          disabled={step === 1 ? !amount : step === 2 ? !description : participants.length === 0}
          onClick={step === 3 ? handleSave : handleNext}
          size="lg"
          className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:shadow-2xl transition-all"
        >
          {step === 3 ? 'Save Bill' : 'Next'}
        </Button>
      </div>
    </motion.div>
  );
}
