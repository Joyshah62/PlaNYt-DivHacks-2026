import type { Metadata } from "next";
import "./globals.css";
import "./editorial.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BRAND } from "@/lib/plan/display";

export const metadata: Metadata = {
  title: `${BRAND.name} · ${BRAND.tagline}`,
  description: "Plan a day in New York around travel time, opening hours, and neighborhood crowds.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description: "Plan a day in New York around travel time, opening hours, and neighborhood crowds.",
    images: [{ url: "/brand/og.png", width: 1600, height: 900, alt: `${BRAND.name} — ${BRAND.tagline}` }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description: "Plan a day in New York around travel time, opening hours, and neighborhood crowds.",
    images: ["/brand/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browsers and extensions (Chrome autofill, password managers) tag the page before
    // React hydrates; those attributes are theirs, not a rendering bug.
    <html
      suppressHydrationWarning
      lang="en"
      data-scroll-behavior="smooth"
      className="min-h-dvh w-full antialiased"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('roam_theme');const p=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&p)){document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');}else{document.documentElement.classList.add('light');document.documentElement.classList.remove('dark');}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh w-full flex flex-col bg-background">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
