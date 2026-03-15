import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Script from 'next/script';
import { SpeedInsights } from "@vercel/speed-insights/next";
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';


const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '600', '700', '800'], variable: '--font-outfit' });


export const metadata: Metadata = {
  title: 'Cocktails on Tap Chile - Barra Móvil Autoservicio de Cócteles',
  description: 'Descubre la innovadora barra móvil autoservicio de cócteles, ideal para todo tipo de eventos en Chile.',
  keywords: 'cócteles en barril, barra móvil, barra de cócteles, eventos Santiago, barra autoservicio',
  authors: [{ name: 'Cocktails on Tap Chile' }],
  robots: 'index, follow',
  openGraph: {
    title: 'Cocktails on Tap Chile - Barra Móvil Autoservicio',
    description: 'Barra móvil autoservicio de cócteles premium para tus eventos.',
    url: 'https://cocktailsontap.cl/',
    type: 'website',
    images: [{ url: 'https://cocktailsontap.cl/assets/logo2.webp' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${outfit.variable} scroll-smooth overflow-x-clip`}>
      <body className="font-sans text-brand-text bg-brand-bg antialiased overflow-x-clip">
        <Navbar />
        {children}
        <SpeedInsights />
        <Footer />

        {/* Meta Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','1739547250109039');fbq('track','PageView');
        `}</Script>

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
