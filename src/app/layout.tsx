import type { Metadata } from "next";
import { Geist, Geist_Mono, Russo_One } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const russoOne = Russo_One({ variable: "--font-russo", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TippCasino",
  description: "Tippelj sportmeccsekre, gyűjts pontokat, versenyezz barátaiddal!",
  verification: {
    google: "Mn_9WXGKwrwZDZiKXfzbCFmTQ-qRzUfvWEbJ0JuVXsY",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="hu"
      className={`${geistSans.variable} ${geistMono.variable} ${russoOne.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
