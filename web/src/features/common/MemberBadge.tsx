import type { GroupMember } from '../../data/schema'
import './MemberBadge.css'

type MemberBadgeProps = {
  member: GroupMember
}

export function MemberBadge({ member }: MemberBadgeProps) {
  return (
    <span className="member-badge">
      <span
        aria-label={`${member.displayName} color`}
        className="member-badge-swatch"
        style={{ backgroundColor: member.color }}
      />
      <span>{member.displayName}</span>
    </span>
  )
}
