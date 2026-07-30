import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Script from 'next/script';
import { SpeedInsights } from "@vercel/speed-insights/next";
import './globals.css';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import MetaPixel from '@/components/shared/MetaPixel';
import { SITE_URL, LOGO_URL, WHATSAPP_NUMBER } from '@/lib/config';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '600', '700', '800'], variable: '--font-outfit' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Cocktails on Tap Chile - Barra Móvil Autoservicio de Cócteles',
  description: 'Descubre la innovadora barra móvil autoservicio de cócteles, ideal para todo tipo de eventos en Chile.',
  keywords: 'cócteles en barril, barra móvil, barra de cócteles, eventos Santiago, barra autoservicio',
  authors: [{ name: 'Cocktails on Tap Chile' }],
  robots: 'index, follow',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Cocktails on Tap Chile - Barra Móvil Autoservicio',
    description: 'Barra móvil autoservicio de cócteles premium para tus eventos.',
    url: SITE_URL,
    type: 'website',
    images: [{ url: LOGO_URL }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cocktails on Tap Chile - Barra Móvil Autoservicio',
    description: 'Barra móvil autoservicio de cócteles premium para tus eventos.',
    images: [LOGO_URL],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': 'Cocktails on Tap Chile',
    'image': LOGO_URL,
    '@id': SITE_URL,
    'url': SITE_URL,
    'telephone': `+${WHATSAPP_NUMBER}`,
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Santiago, Chile',
      'addressLocality': 'Santiago',
      'addressRegion': 'Región Metropolitana',
      'addressCountry': 'CL',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': -33.4489,
      'longitude': -70.6693,
    },
    'openingHoursSpecification': {
      '@type': 'OpeningHoursSpecification',
      'dayOfWeek': [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      'opens': '00:00',
      'closes': '23:59',
    },
    'sameAs': [
      'https://instagram.com/cocktailsontap.chile',
    ],
  };

  return (
    <html lang="es" className={`${outfit.variable} scroll-smooth overflow-x-clip`}>
      <body className="font-sans text-brand-text bg-brand-bg antialiased overflow-x-clip">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Navbar />
        {children}
        <SpeedInsights />
        <Footer />

        <MetaPixel />

        {/* Google Analytics */}
        <Script strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=G-N4MLRD1LLD" />
        <Script id="ga" strategy="afterInteractive">{`
          window.dataLayer=window.dataLayer||[];
          function gtag(){dataLayer.push(arguments);}
          gtag('js',new Date());gtag('config','G-N4MLRD1LLD');
        `}</Script>
      </body>
    </html>
  );
}
