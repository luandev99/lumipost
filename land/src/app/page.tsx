import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import NetworkMarquee from "@/components/NetworkMarquee";
import ProductScroll from "@/components/ProductScroll";
import Manifesto from "@/components/Manifesto";
import Features from "@/components/Features";
import FormatsRail from "@/components/FormatsRail";
import Pricing from "@/components/Pricing";
import Faq from "@/components/Faq";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NetworkMarquee />
        <ProductScroll />
        <Manifesto />
        <Features />
        <FormatsRail />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
