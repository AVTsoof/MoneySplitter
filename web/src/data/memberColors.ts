export const MEMBER_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#ea580c',
  '#d97706',
  '#0891b2',
  '#0284c7',
  '#4f46e5',
  '#9333ea',
  '#be185d',
  '#c2410c',
] as const

export type MemberColor = (typeof MEMBER_COLORS)[number]

export function firstUnusedMemberColor(used: Iterable<string>): MemberColor {
  const usedColors = new Set(used)
  const color = MEMBER_COLORS.find((candidate) => !usedColors.has(candidate))
  if (!color) throw new Error('All member colors are in use.')
  return color
}
