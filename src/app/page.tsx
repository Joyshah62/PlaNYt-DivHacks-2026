import { preconnect } from "react-dom";
import "./home.css";
import { Colophon } from "@/components/home/Colophon";
import { edFonts } from "@/components/editorial/fonts";
import { HeroStage } from "@/components/home/HeroStage";
import { NeighborhoodStory } from "@/components/home/NeighborhoodStory";
import { PlanDemo } from "@/components/home/PlanDemo";

export default function Home() {
  preconnect("https://maps.googleapis.com");
  preconnect("https://maps.gstatic.com", { crossOrigin: "anonymous" });
  preconnect("https://tile.googleapis.com");
  return (
    <main className={`ed ${edFonts}`}>
      <noscript>
        <style>{`.ed-late,.ed-solid i{opacity:1!important;transform:none!important}.ed-knock{display:none}`}</style>
      </noscript>
      <HeroStage />
      <PlanDemo />
      <NeighborhoodStory />
      <Colophon />
    </main>
  );
}
