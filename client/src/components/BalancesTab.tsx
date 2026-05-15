import { CalculationResults } from '../types';

interface BalancesTabProps {
  results: CalculationResults | null;
  loading: boolean;
  error?: string | null;
}

export default function BalancesTab({ results, loading, error }: BalancesTabProps) {
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Crunching the numbers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-800 font-bold text-lg mb-2">Calculation failed</p>
        <p className="text-gray-500 text-sm mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-blue-600 font-bold hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!results || Object.keys(results.balances).length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400 text-center">
        <p className="text-lg">No math to show yet.</p>
        <p className="text-sm">Add some bills to see the bottom line.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-10 pb-10">
      {Object.keys(results.balances).map(currency => (
        <div key={currency} className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{currency} Ledger</h2>
            <div className="h-px flex-1 bg-gray-100"></div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Net Balances Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50">
              <h3 className="text-sm font-bold text-gray-400 mb-6 uppercase tracking-wider">The Bottom Line</h3>
              <div className="space-y-4">
                {Object.entries(results.balances[currency]).map(([user, bal]) => {
                  const val = parseFloat(bal);
                  if (Math.abs(val) < 0.01) return null;
                  return (
                    <div key={user} className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-700">{user === 'You' ? 'You' : user}</span>
                      <div className="text-right">
                        <span className={`text-xl font-black ${val >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
                          {val >= 0 ? '+' : ''}{bal}
                        </span>
                        <p className="text-[10px] text-gray-300 uppercase font-bold">{val >= 0 ? 'is owed' : 'owes'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Smart Settle Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50">
              <h3 className="text-sm font-bold text-gray-400 mb-6 uppercase tracking-wider">Smart Settle</h3>
              <div className="space-y-3">
                {results.transactions[currency].length === 0 ? (
                  <p className="text-gray-400 italic text-center py-4">Everything is square!</p>
                ) : (
                  results.transactions[currency].map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-50">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-800">{t.from}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span className="font-bold text-gray-800">{t.to}</span>
                      </div>
                      <span className="font-black text-blue-600 text-lg">${t.amount}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
