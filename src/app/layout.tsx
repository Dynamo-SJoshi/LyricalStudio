import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// SF Pro can't be redistributed, so we rely on the system font stack
// (-apple-system renders SF Pro on Apple devices) and fall back to these.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  weight: ["400", "700", "900"],
  preload: false,
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "700", "900"],
  preload: false,
});

export const metadata: Metadata = {
  title: "LyricalStudio",
  description:
    "An open-source music player with kinetic lyric animations, inspired by the Cotodama Lyric Speaker.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoJP.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      {/* extensions (e.g. ColorZilla) add attributes to <body> before React loads */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
