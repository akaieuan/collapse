import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-[13.5px] font-medium tracking-tight"
        >
          <span
            aria-hidden
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background text-[11px] font-semibold shadow-[0_1px_0_0_oklch(0_0_0/0.15)] transition-transform group-hover:-translate-y-[1px]"
          >
            <span className="absolute inset-0 rounded-md bg-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="relative">C</span>
          </span>
          <span className="font-mono text-[12.5px] uppercase tracking-[0.14em]">Collapse</span>
        </Link>
        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/">Concepts</NavLink>
            <NavLink href="/import">Import</NavLink>
            <NavLink href="/skills">Skills</NavLink>
          </nav>
          <span aria-hidden className="mx-2 h-5 w-px bg-border" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}
