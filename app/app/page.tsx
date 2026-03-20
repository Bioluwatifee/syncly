import Navbar            from "@/components/layout/Navbar";
import Footer            from "@/components/layout/Footer";
import Hero              from "@/components/sections/Hero";
import DemoSection       from "@/components/sections/DemoSection";
import StepsSection      from "@/components/sections/StepsSection";
import EarlyAccessSection from "@/components/sections/EarlyAccessSection";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <DemoSection />
        <StepsSection />
        <EarlyAccessSection />
      </main>
      <Footer />
    </>
  );
}
