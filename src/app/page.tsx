import { preconnect } from "react-dom";
import "./home.css";
import { Colophon } from "@/components/home/Colophon";
import { edFonts } from "@/components/home/fonts";
import { HeroStage } from "@/components/home/HeroStage";
import { NeighborhoodStory } from "@/components/home/NeighborhoodStory";
import { PlanDemo } from "@/components/home/PlanDemo";

// Runs while the HTML is parsed, before first paint: repeat visits in this session, reduced
// motion and lite devices start with the intro already finished (no flash of the cover).
const SKIP_INTRO = `try{var n=navigator,c=n.connection;if(sessionStorage.getItem('roam_intro')||matchMedia('(prefers-reduced-motion: reduce)').matches||(c&&c.saveData)||(n.deviceMemory&&n.deviceMemory<=2))document.documentElement.dataset.intro='skip'}catch(e){}`;

export default function Home() {
  preconnect("https://maps.googleapis.com");
  preconnect("https://maps.gstatic.com", { crossOrigin: "anonymous" });
  preconnect("https://tile.googleapis.com");
  return (
    <main className={`ed ${edFonts}`}>
      <script dangerouslySetInnerHTML={{ __html: SKIP_INTRO }} />
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
