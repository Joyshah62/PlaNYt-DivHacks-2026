import Link from "next/link";
import { AddressSearch } from "@/components/AddressSearch";

export function SiteHeader({ search = true, wide = false, children }: { search?: boolean; wide?: boolean; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl print:hidden">
      <div className={`mx-auto flex h-16 items-center gap-6 ${wide ? "px-5 sm:px-8" : "max-w-7xl px-4 sm:px-6"}`}>
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-foreground font-display text-lg text-background">R</span>
          <span>
            RentCheck <span className="font-display text-lg font-normal text-muted-foreground italic">NYC</span>
          </span>
        </Link>
        {children}
        {search && (
          <div className="ml-auto hidden w-full max-w-sm md:block">
            <AddressSearch size="compact" />
          </div>
        )}
      </div>
    </header>
  );
}
