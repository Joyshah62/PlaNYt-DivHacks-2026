import { IBM_Plex_Mono, Instrument_Serif, Newsreader } from "next/font/google";

// Loaded here, not in the root layout, so only the home page downloads them.
const display = Instrument_Serif({ variable: "--ed-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
const text = Newsreader({ variable: "--ed-text", subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--ed-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const edFonts = `${display.variable} ${text.variable} ${mono.variable}`;
