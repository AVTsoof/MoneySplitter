import type { Transaction } from '../core/types'
import { getMembers, getShares, getTransactions } from './repository'
import type { Uuid } from './schema'

/**
 * The engine is keyed by member name, the database by member id. This is the
 * single place that bridges the two, so every view calculates from the stored
 * share rows rather than re-deriving splits.
 */
export async function loadGroupLedger(groupId: Uuid) {
  const [members, rows] = await Promise.all([getMembers(groupId), getTransactions(groupId)])
  const names = new Map(members.map((member) => [member.id, member.displayName]))

  const transactions: Transaction[] = await Promise.all(
    rows.map(async (row): Promise<Transaction> => {
      if (row.type === 'transfer') {
        return {
          kind: 'transfer',
          id: row.id,
          sender: names.get(row.senderMemberId!)!,
          receiver: names.get(row.receiverMemberId!)!,
          amount: row.amount,
          currency: row.currency,
          description: row.description,
        }
      }

      const shares = await getShares(row.id)
      return {
        kind: 'expense',
        id: row.id,
        payer: names.get(row.payerMemberId!)!,
        amount: row.amount,
        currency: row.currency,
        description: row.description,
        participants: shares.map((share) => names.get(share.memberId)!),
        strategy: {
          type: 'exact',
          amounts: Object.fromEntries(
            shares.map((share) => [names.get(share.memberId)!, share.amount]),
          ),
        },
      }
    }),
  )

  return { members, names, rows, transactions }
}
