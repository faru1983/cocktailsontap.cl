'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import {
  FB_PIXEL_ID,
  isMetaPixelHostAllowed,
  pageview,
  shouldTrackMetaPath,
  trackLandingViewContent,
} from '@/lib/fpixel';

/**
 * Pixel solo en producción (cocktailsontap.cl) y rutas públicas (no /admin).
 * PageView en cada navegación; ViewContent solo en /eventos y /barriles.
 */
export default function MetaPixel() {
  const pathname = usePathname() ?? '';
  const pathOk = shouldTrackMetaPath(pathname);
  const [hostOk, setHostOk] = useState(false);
  const initDoneRef = useRef(false);

  useEffect(() => {
    setHostOk(isMetaPixelHostAllowed());
  }, []);

  useEffect(() => {
    if (!hostOk || !pathOk) return;
    if (typeof window === 'undefined' || !window.fbq) return;
    if (!initDoneRef.current) {
      window.fbq('init', FB_PIXEL_ID);
      initDoneRef.current = true;
    }
    pageview();
    trackLandingViewContent(pathname);
  }, [pathname, pathOk, hostOk]);

  if (!hostOk || !pathOk) return null;

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window === 'undefined' || !window.fbq) return;
        if (!initDoneRef.current) {
          window.fbq('init', FB_PIXEL_ID);
          initDoneRef.current = true;
          pageview();
          trackLandingViewContent(pathname);
        }
      }}
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
        `,
      }}
    />
  );
}
