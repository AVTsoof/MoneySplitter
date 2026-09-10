import type { Edge, Node } from '@xyflow/react'
import type { Settlement } from '../../core/debtSimplifier'
import type { GroupMember } from '../../data/schema'

export function buildDebtMap(
  members: GroupMember[],
  settlementsByCurrency: Record<string, Settlement[]>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes = members.map((member, index) => {
    const angle = (index / Math.max(members.length, 1)) * Math.PI * 2
    return {
      id: member.displayName,
      position: { x: 250 + Math.cos(angle) * 170, y: 180 + Math.sin(angle) * 120 },
      data: { label: member.displayName },
      style: { borderColor: member.color },
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
