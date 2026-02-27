import HeroSection from '@/components/sections/HeroSection';
import InstagramSection from '@/components/sections/InstagramSection';
import StepsSection from '@/components/sections/StepsSection';
import DispensadoresSection from '@/components/sections/DispensadoresSection';
import QueIncluyeSection from '@/components/sections/QueIncluyeSection';
import CoctelesSection from '@/components/sections/CoctelesSection';
import FloatingCta from '@/components/FloatingCta';

export default function HomePage() {
  return (
    <main data-page="home">
      <HeroSection />
      <InstagramSection />
      <StepsSection />
      <DispensadoresSection />
      <QueIncluyeSection />
      <CoctelesSection />
      <FloatingCta />
    </main>
  );
}
