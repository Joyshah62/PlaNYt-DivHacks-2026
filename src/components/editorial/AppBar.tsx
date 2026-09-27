import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/** The masthead for app pages: the wordmark home, then any links and the theme toggle. */
export function AppBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="ed-appbar">
      <Link href="/" className="ed-wordmark ed-display">
        Roam
      </Link>
      <nav>
        {children}
        <ThemeToggle className="ed-theme" />
      </nav>
    </header>
  );
}
