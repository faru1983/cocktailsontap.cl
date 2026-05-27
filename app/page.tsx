import HeroSection from '@/components/sections/HeroSection';
import InstagramSection from '@/components/sections/InstagramSection';
import StepsSection from '@/components/sections/StepsSection';
import DispensadoresSection from '@/components/sections/DispensadoresSection';
import QueIncluyeSection from '@/components/sections/QueIncluyeSection';
import CoctelesSection from '@/components/sections/CoctelesSection';
import FloatingCta from '@/components/shared/FloatingCta';
import { fetchAllProductData } from '@/lib/serverData';

// Server Component: precarga productos y categorías con caché de 5 minutos.
// Ambas llamadas a Supabase (home + /cotizar) comparten la misma caché.
export default async function HomePage() {
  const { products, categories } = await fetchAllProductData();

  return (
    <main data-page="home">
      <HeroSection />
      <InstagramSection />
      <StepsSection />
      <DispensadoresSection />
      <QueIncluyeSection />
      <CoctelesSection products={products} categories={categories} />
      <FloatingCta />
    </main>
  );
}
