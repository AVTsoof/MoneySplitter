import type { Edge, Node } from '@xyflow/react'
import type { Settlement } from '../../core/debtSimplifier'

export function buildDebtMap(
  members: string[],
  settlementsByCurrency: Record<string, Settlement[]>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes = members.map((member, index) => {
    const angle = (index / Math.max(members.length, 1)) * Math.PI * 2
    return {
      id: member,
      position: { x: 250 + Math.cos(angle) * 170, y: 180 + Math.sin(angle) * 120 },
      data: { label: member },
    }
  })

  const edges = Object.entries(settlementsByCurrency).flatMap(([currency, settlements]) =>
    settlements.map((settlement) => ({
      id: `${currency}-${settlement.from}-${settlement.to}`,
      source: settlement.from,
      target: settlement.to,
      label: `${settlement.amount} ${currency}`,
      animated: true,
    })),
  )

  return { nodes, edges }
}
