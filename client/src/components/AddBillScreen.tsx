import { useState } from 'react';
import { Expense } from '../types';

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

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex justify-between items-center mb-8">
        <button onClick={handleBack} className="text-blue-600 font-medium">
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        <span className="text-gray-400 text-sm font-medium">Step {step} of 3</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col">
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">How much?</h2>
            <div className="flex items-center">
              <span className="text-4xl font-bold text-gray-400 mr-2">$</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                className="text-5xl font-bold bg-transparent border-none outline-none w-full text-gray-900 placeholder-gray-200"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">What was it for?</h2>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Dinner, Rent, Pizza"
              className="text-3xl font-medium bg-transparent border-b-2 border-gray-100 pb-2 outline-none w-full text-gray-900 placeholder-gray-200 focus:border-blue-500 transition-colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Who was there?</h2>
            <div className="space-y-3 overflow-y-auto max-h-[60vh]">
              {availableUsers.map(user => (
                <label key={user} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <span className="text-lg font-medium text-gray-700">{user}</span>
                  <input
                    type="checkbox"
                    checked={participants.includes(user)}
                    onChange={() => toggleParticipant(user)}
                    className="w-6 h-6 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        disabled={step === 1 ? !amount : step === 2 ? !description : participants.length === 0}
        onClick={step === 3 ? handleSave : handleNext}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:bg-gray-200 disabled:shadow-none"
      >
        {step === 3 ? 'Save Bill' : 'Next'}
      </button>
    </div>
  );
}
