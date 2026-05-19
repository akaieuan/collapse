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
  title: "Collapse — cross-stack patterns, collapsed into Claude skills",
  description:
    "Annotate the same concept across Next.js, Vue, Nuxt, and Qiskit. Each lesson collapses the cross-stack superposition into a Claude Code skill that guardrails AI generation in any of those stacks.",
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
