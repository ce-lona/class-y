import { Geist_Mono, Manrope, Newsreader, Source_Sans_3 } from "next/font/google";

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

/** CSS-Variablen aller Schriften, für `<html className>` (Root-Layout + global-error). */
export const fontVariables = `${manrope.variable} ${newsreader.variable} ${sourceSans.variable} ${geistMono.variable}`;
