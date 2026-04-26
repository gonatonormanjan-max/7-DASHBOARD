import type { Metadata } from "next";
import { Suspense } from "react";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { FlashToast } from "@/components/ui/flash-toast";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "7-Dashboard",
  description: "Internal inventory operations and warehouse control center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <Toaster />
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
