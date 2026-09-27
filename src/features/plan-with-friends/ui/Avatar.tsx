import { AVATAR_HEX, type Avatar } from "../core/avatars";

const SIZES = { sm: "tr-avatar--sm", md: "tr-avatar--md", lg: "tr-avatar--lg" } as const;

export function AvatarBubble({ avatar, name, size = "md", dim = false, className }: { avatar: Avatar; name?: string; size?: keyof typeof SIZES; dim?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={name ?? avatar.emoji}
      title={name}
      className={`tr-avatar ${SIZES[size]} ${dim ? "dim" : ""} ${className ?? ""}`.trim()}
      style={{ boxShadow: `0 0 0 2px ${AVATAR_HEX[avatar.color]}` }}
    >
      <span aria-hidden>{avatar.emoji}</span>
    </span>
  );
}

export function AvatarStack({ people, size = "sm", dimmed = [] }: { people: { id: string; name: string; avatar: Avatar }[]; size?: keyof typeof SIZES; dimmed?: string[] }) {
  return (
    <span className="tr-avatar-stack">
      {people.map((p) => (
        <AvatarBubble key={p.id} avatar={p.avatar} name={p.name} size={size} dim={dimmed.includes(p.id)} />
      ))}
    </span>
  );
}
