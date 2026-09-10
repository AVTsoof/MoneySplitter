import { useLiveQuery } from 'dexie-react-hooks'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import { getNetBalances } from '../../core/ledger'
import { simplifyDebts } from '../../core/debtSimplifier'
import { loadGroupLedger } from '../../data/groupLedger'
import type { Uuid } from '../../data/schema'
import { buildDebtMap } from './debtMap'
import './MapTab.css'

type MapTabProps = {
  groupId: Uuid
}

export function MapTab({ groupId }: MapTabProps) {
  const map = useLiveQuery(async () => {
    const { members, transactions } = await loadGroupLedger(groupId)
    return buildDebtMap(
      members.map((member) => member.displayName),
      simplifyDebts(getNetBalances(transactions)),
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
