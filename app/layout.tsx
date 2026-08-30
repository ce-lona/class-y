import type { Metadata } from "next";
import { Geist_Mono, Manrope, Newsreader, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { PwaRegister } from "@/components/pwa-register";
import { Providers } from "./providers";
import "./globals.css";

// UI-Headlines (Display, H1–H3, Section-Headlines)
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Nur für den "class-y"-Schriftzug (Logo-Komponente), nie als UI-Headline
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["500"],
});

// Fließtext
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "class-y",
  description: "Kurstracking für Trainer:innen und Studios",
  appleWebApp: {
    title: "class-y",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${manrope.variable} ${newsreader.variable} ${sourceSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>{children}</Providers>
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
