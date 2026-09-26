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
  title: "Roam NYC · Plan a day in New York around the crowds",
  description: "Pick or describe the places you want to see. Roam orders them around travel time, opening hours and subway-ridership crowd levels.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browsers and extensions (Chrome autofill, password managers) tag the page before
    // React hydrates; those attributes are theirs, not a rendering bug.
    <html
      suppressHydrationWarning
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
