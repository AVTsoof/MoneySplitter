import { useLiveQuery } from 'dexie-react-hooks'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import { getNetBalances } from '../../core/ledger'
import { getCachedExchangeRates } from '../../data/exchangeRates'
import { loadGroupLedger } from '../../data/groupLedger'
import { getGroup } from '../../data/repository'
import type { Uuid } from '../../data/schema'
import { buildDefaultCurrencyDebtMap } from './debtMap'
import './MapTab.css'

type MapTabProps = {
  groupId: Uuid
}

export function MapTab({ groupId }: MapTabProps) {
  const map = useLiveQuery(async () => {
    const [group, ledger] = await Promise.all([getGroup(groupId), loadGroupLedger(groupId)])
    if (!group) return null
    const rates = await getCachedExchangeRates(group.defaultCurrency)
    return buildDefaultCurrencyDebtMap(
      ledger.members,
      getNetBalances(ledger.transactions),
      group.defaultCurrency,
      rates,
    )
  }, [groupId])

  if (!map) return <p>Loading map...</p>

  return (
    <div className="debt-map" aria-label="Debt map">
      <ReactFlow nodes={map.nodes} edges={map.edges} fitView nodesDraggable>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
