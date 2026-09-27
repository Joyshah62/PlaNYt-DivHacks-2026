import type { Metadata } from "next";
import "./globals.css";
import "./editorial.css";
import { TooltipProvider } from "@/components/ui/tooltip";

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
