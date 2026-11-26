import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PerkRadar · Software Freebies & Deals",
  description: "Track deals and giveaways from seven public sources, refreshed every two hours. Listings are not individually verified.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8fa",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-[#f7f8fa] font-sans text-[#292d34] antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
