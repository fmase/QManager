import type { Metadata } from "next";
import "./globals.css";

// import Euclid from "next/font/local";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";

// Google Fonts can be imported from remote
const manrope = Manrope({
  variable: "--font-euclid",
  subsets: ["latin"],
});

// Font files can be colocated inside of `app`
// const euclid = Euclid({
//   variable: "--font-euclid",
//   src: [
//     {
//       path: "./fonts/EuclidCircularB-Light.woff2",
//       weight: "300",
//       style: "normal",
//     },
//     {
//       path: "./fonts/EuclidCircularB-Regular.woff2",
//       weight: "400",
//       style: "normal",
//     },
//     {
//       path: "./fonts/EuclidCircularB-Medium.woff2",
//       weight: "500",
//       style: "normal",
//     },
//     {
//       path: "./fonts/EuclidCircularB-SemiBold.woff2",
//       weight: "600",
//       style: "normal",
//     },
//     {
//       path: "./fonts/EuclidCircularB-Bold.woff2",
//       weight: "700",
//       style: "normal",
//     },
//     {
//       path: "./fonts/EuclidCircularB-Italic.woff2",
//       weight: "400",
//       style: "italic",
//     },
//   ],
// });

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
      <body className={`${manrope.variable} ${manrope.className} antialiased`}>
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
      </body>
    </html>
  );
}
