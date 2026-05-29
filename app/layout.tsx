import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteNav } from "@/components/site-nav";
import { SkillForgeButton } from "@/components/forge/skill-forge";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Collapse — a framework for collapsing patterns into Claude artifacts",
  description:
    "Turn the patterns you understand into Claude Code skills. Three on-ramps (MDX lessons, Jupyter notebooks, your own ingestor), one template engine, skill files written to ~/.claude/skills/. MCP tool generation is the next output target.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SkillForgeButton />
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
