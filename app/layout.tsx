import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { PwaRegister } from "@/components/pwa-register";
import { fontVariables } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

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
      className={`${fontVariables} h-full antialiased`}
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
