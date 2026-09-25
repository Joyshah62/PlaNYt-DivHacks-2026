import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

/** Display face for headlines and headline numbers; Geist does the rest. */
const display = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RentCheck NYC",
  description: "Building records, neighborhood and commute for any NYC apartment, read through your own priorities.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
