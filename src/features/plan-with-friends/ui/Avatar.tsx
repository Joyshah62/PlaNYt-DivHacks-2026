import { cn } from "../bridge/ui";
import { AVATAR_HEX, type Avatar } from "../core/avatars";

const SIZES = { sm: "size-6 text-[13px]", md: "size-8 text-base", lg: "size-11 text-2xl" } as const;

export function AvatarBubble({ avatar, name, size = "md", dim = false, className }: { avatar: Avatar; name?: string; size?: keyof typeof SIZES; dim?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={name ?? avatar.emoji}
      title={name}
      className={cn("inline-grid shrink-0 place-items-center rounded-full border-2 border-background bg-muted transition", SIZES[size], dim && "opacity-40 grayscale", className)}
      style={{ boxShadow: `0 0 0 2px ${AVATAR_HEX[avatar.color]}` }}
    >
      <span aria-hidden>{avatar.emoji}</span>
    </span>
  );
}

export function AvatarStack({ people, size = "sm", dimmed = [] }: { people: { id: string; name: string; avatar: Avatar }[]; size?: keyof typeof SIZES; dimmed?: string[] }) {
  return (
    <span className="flex items-center pl-1.5">
      {people.map((p) => (
        <AvatarBubble key={p.id} avatar={p.avatar} name={p.name} size={size} dim={dimmed.includes(p.id)} className="-ml-1.5" />
      ))}
    </span>
  );
}
