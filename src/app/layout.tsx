import type { Metadata } from "next";
import { JetBrains_Mono, Russo_One, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});
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
      className={`${sora.variable} ${jetbrainsMono.variable} ${russoOne.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
