import { Expense } from '../types';

interface BillsTabProps {
  expenses: Expense[];
  onAddClick: () => void;
}

export default function BillsTab({ expenses, onAddClick }: BillsTabProps) {
  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto space-y-4 pb-24">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg">No bills yet.</p>
            <p className="text-sm">Tap the + to add your first expense.</p>
          </div>
        ) : (
          [...expenses].reverse().map(e => (
            <div key={e.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex justify-between items-center group active:scale-[0.98] transition-transform">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{e.description}</h3>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-blue-600">{e.payer === 'You' ? 'You' : e.payer}</span> paid
                  <span className="mx-1">•</span>
                  {e.participants.length} people
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">{e.total_amount} {e.currency}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total</p>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={onAddClick}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all z-10"
        aria-label="Add Bill"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
