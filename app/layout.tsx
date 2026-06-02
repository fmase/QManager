import type { Metadata } from "next";
import "./globals.css";

import localFont from "next/font/local";
// import { Manrope } from "next/font/google";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";

// Google Fonts can be imported from remote
// const manrope = Manrope({
//   variable: "--font-manrope",
//   subsets: ["latin"],
// });

// Font files can be colocated inside of `app`
const euclid = localFont({
  variable: "--font-euclid",
  src: [
    {
      path: "./fonts/EuclidCircularB-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/EuclidCircularB-Italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: "QManager",
  description:
    "QManager is a modern web-based GUI for managing Quectel modems — from APN and band locking to advanced diagnostics and cellular device management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${euclid.variable} ${euclid.className} antialiased`}>
        {/* reducedMotion="user" makes every motion/react animation in the app
            honor prefers-reduced-motion automatically: transform/layout movement
            collapses to instant while opacity is preserved, so the UI stays
            intentional (a clean cross-fade) rather than broken. This is the
            single global switch the motion system relies on. */}
        <MotionConfig reducedMotion="user">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <I18nProvider>
              {children}
              <Toaster />
            </I18nProvider>
          </ThemeProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
