import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listGroups, seedExampleGroup } from './data/repository'
import { BalancesTab } from './features/balances/BalancesTab'
import { MapTab } from './features/map/MapTab'
import { RatesTab } from './features/rates/RatesTab'
import { SettlementsTab } from './features/settlements/SettlementsTab'
import { SettingsTab } from './features/settings/SettingsTab'
import { TransactionsTab } from './features/transactions/TransactionsTab'
import './App.css'

const tabs = ['Transactions', 'Balances', 'Settle Up', 'Map', 'Rates', 'Settings'] as const
type Tab = (typeof tabs)[number]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Transactions')
  const groups = useLiveQuery(listGroups, [])

  useEffect(() => {
    void seedExampleGroup()
  }, [])

  if (!groups) {
    return <main className="app-loading">Loading your ledger...</main>
  }

  const group = groups[0]
  if (!group) {
    return <main className="app-loading">No groups yet.</main>
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">MoneySplitter</p>
        <div className="group-title">
          <div>
            <h1>{group.name}</h1>
            <p>{group.activeCurrencies.join(' / ')} ledger</p>
          </div>
          <button className="group-switcher" type="button" aria-label="Choose group">
            Groups
          </button>
        </div>
      </header>

      <section className="workspace" aria-label={`${group.name} workspace`}>
        <div className="tab-list" role="tablist" aria-label="Group workspace">
          {tabs.map((tab) => (
            <button
              key={tab}
              className="tab"
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls="workspace-panel"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <section id="workspace-panel" className="workspace-panel" role="tabpanel">
          <p className="panel-kicker">{activeTab}</p>
          <h2>{activeTab}</h2>
          {activeTab === 'Transactions' ? (
            <TransactionsTab groupId={group.id} />
          ) : activeTab === 'Balances' ? (
            <BalancesTab groupId={group.id} />
          ) : activeTab === 'Settle Up' ? (
            <SettlementsTab groupId={group.id} />
          ) : activeTab === 'Rates' ? (
            <RatesTab groupId={group.id} />
          ) : activeTab === 'Map' ? (
            <MapTab groupId={group.id} />
          ) : activeTab === 'Settings' ? (
            <SettingsTab groupId={group.id} />
          ) : (
            <p>
              {activeTab} for {group.name} will appear here.
            </p>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
