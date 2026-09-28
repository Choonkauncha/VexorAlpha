import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./glass.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vexor — AI Security Agent",
  description:
    "Vexor is an autonomous offensive-security agent: recon, exploit, and patch in one loop. Paste code, a repo URL, or a CVE id and get a multi-level vulnerability analysis with verifiable hotfix patches.",
  keywords: [
    "Vexor", "security agent", "vulnerability analysis", "penetration testing",
    "OWASP", "CVE", "code audit", "hotfix patch", "defensive security",
  ],
  authors: [{ name: "Vexor" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Vexor — AI Security Agent",
    description: "Autonomous offensive-security agent — recon, exploit, and patch in one loop.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
