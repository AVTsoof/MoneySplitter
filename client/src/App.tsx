import { useState } from 'react'
import { calculateBalances } from './bridge/pyodide'
import DebtMap from './components/DebtMap'

interface Expense {
  id: string
  payer: string
  total_amount: string
  participants: string[]
  description: string
  currency: string
}

function App() {
  const [expenses] = useState<Expense[]>([
    { id: '1', payer: 'Ariel', total_amount: '30.00', participants: ['Ariel', 'Bob', 'Charlie'], description: 'Pizza', currency: 'USD' },
    { id: '2', payer: 'Bob', total_amount: '15.00', participants: ['Bob', 'Charlie'], description: 'Drinks', currency: 'EUR' }
  ])
  
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleCalculate = async () => {
    setLoading(true)
    try {
      const res = await calculateBalances(JSON.stringify(expenses))
      setResults(res)
    } catch (err) {
      console.error(err)
      alert('Error calculating balances. See console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-600 mb-6 text-center">MoneySplitter</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6 border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Recent Bills</h2>
          <div className="space-y-3">
            {expenses.map(e => (
              <div key={e.id} className="flex justify-between items-center border-b border-gray-50 pb-2">
                <div>
                  <span className="font-medium text-gray-700">{e.description}</span>
                  <span className="text-sm text-gray-500 ml-2">({e.payer} paid)</span>
                </div>
                <span className="font-mono font-semibold text-gray-900">{e.total_amount} {e.currency}</span>
              </div>
            ))}
          </div>
          <button 
            onClick={handleCalculate}
            disabled={loading}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300"
          >
            {loading ? 'Crunching Numbers...' : 'Calculate The Bottom Line'}
          </button>
        </div>

        {results && (
          <div className="space-y-8">
            {Object.keys(results.balances).map(currency => (
              <div key={currency} className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200"></div>
                  <h2 className="text-lg font-bold text-gray-400 uppercase tracking-widest">{currency} Ledger</h2>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Net Balances</h3>
                    <div className="space-y-3">
                      {Object.entries(results.balances[currency]).map(([user, bal]: [string, any]) => (
                        <div key={user} className="flex justify-between items-center">
                          <span className="text-gray-600">{user}</span>
                          <span className={`font-mono font-bold ${parseFloat(bal) >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                            {parseFloat(bal) >= 0 ? '+' : ''}{bal}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Smart Settle</h3>
                    <div className="space-y-3">
                      {results.transactions[currency].length === 0 ? (
                        <p className="text-gray-400 italic">Everything is settled!</p>
                      ) : (
                        results.transactions[currency].map((t: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm bg-blue-50 p-2 rounded border border-blue-100">
                            <span>
                              <span className="font-bold text-blue-900">{t.from}</span>
                              <span className="mx-2 text-blue-400">→</span>
                              <span className="font-bold text-blue-900">{t.to}</span>
                            </span>
                            <span className="font-mono font-bold text-blue-700">${t.amount}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {results.transactions[currency].length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Debt Map ({currency})</h3>
                    <DebtMap transactions={results.transactions[currency]} width={896} height={400} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
