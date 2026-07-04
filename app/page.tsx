import CarbonHero from "./components/CarbonHero";
import CarbonFeatures from "./components/CarbonFeatures";
import Timeline from "./components/Timeline";
import FaqAccordion from "./components/FaqAccordion";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center overflow-hidden">
      <CarbonHero />
      <CarbonFeatures />
      <Timeline />
      <FaqAccordion />
    </div>
  );
}
