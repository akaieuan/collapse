"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react";

const ORDER = ["light", "dark", "system"] as const;
type ThemeKey = (typeof ORDER)[number];

const LABEL: Record<ThemeKey, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current = (mounted ? (theme as ThemeKey | undefined) : undefined) ?? "system";

  function cycle() {
    const idx = ORDER.indexOf(current);
    const next = ORDER[(idx + 1) % ORDER.length];
    setTheme(next);
  }

  const Icon = current === "dark" ? MoonIcon : current === "light" ? SunIcon : MonitorIcon;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[current]}. Click to cycle.`}
      title={`Theme: ${LABEL[current]} — click to cycle`}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span suppressHydrationWarning>{mounted ? LABEL[current] : "Theme"}</span>
    </button>
  );
}
