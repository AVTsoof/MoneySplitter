import { useState, useEffect } from 'react'
import { calculateBalances } from './bridge/pyodide'

interface Expense {
  id: string
  payer: string
  total_amount: string
  participants: string[]
  description: string
}

function App() {
  const [expenses] = useState<Expense[]>([
    { id: '1', payer: 'Ariel', total_amount: '30.00', participants: ['Ariel', 'Bob', 'Charlie'], description: 'Pizza' },
    { id: '2', payer: 'Bob', total_amount: '15.00', participants: ['Bob', 'Charlie'], description: 'Drinks' }
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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">MoneySplitter</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4">Expenses</h2>
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="flex justify-between border-b pb-2">
                <span>{e.description} ({e.payer} paid)</span>
                <span className="font-mono">${e.total_amount}</span>
              </div>
            ))}
          </div>
          <button 
            onClick={handleCalculate}
            disabled={loading}
            className="mt-6 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? 'Calculating...' : 'Calculate Balances'}
          </button>
        </div>

        {results && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Net Balances</h2>
              <div className="space-y-2">
                {Object.entries(results.balances).map(([user, bal]: [string, any]) => (
                  <div key={user} className="flex justify-between">
                    <span>{user}</span>
                    <span className={parseFloat(bal) >= 0 ? 'text-green-600' : 'text-orange-600'}>
                      {parseFloat(bal) >= 0 ? '+' : ''}{bal}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Smart Settle</h2>
              <div className="space-y-2">
                {results.transactions.map((t: any, i: number) => (
                  <div key={i} className="text-sm">
                    <span className="font-semibold">{t.from}</span> pays <span className="font-semibold">{t.to}</span> 
                    <span className="ml-2 font-mono text-blue-600">${t.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
