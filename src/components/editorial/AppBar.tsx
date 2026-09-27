import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BRAND } from "@/lib/plan/display";

/** The masthead for app pages: the wordmark home, then any links and the theme toggle. */
export function AppBar({ children, home = "/" }: { children?: React.ReactNode; /** Where the wordmark goes: the planner, for people signed in. */ home?: string }) {
  return (
    <header className="ed-appbar">
      <Link href={home} className="ed-wordmark ed-display">
        {BRAND.name}
      </Link>
      <nav>
        {children}
        <ThemeToggle className="ed-theme" />
      </nav>
    </header>
  );
}
