import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import InstagramDeepLinkBridge from '@/components/shared/InstagramDeepLinkBridge';
import { INSTAGRAM_USERNAME } from '@/lib/config';
import {
    detectQrPlatform,
    getInstagramProfileDeepLinks,
} from '@/lib/instagramDeepLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: `@${INSTAGRAM_USERNAME} | Cocktails on Tap`,
    description: 'Síguenos en Instagram @cocktailsontap.chile',
    robots: {
        index: false,
        follow: false,
    },
};

export default async function QrProfilePage() {
    const links = getInstagramProfileDeepLinks();
    const userAgent = (await headers()).get('user-agent');
    const platform = detectQrPlatform(userAgent);

    if (platform === 'redirect_web') {
        redirect(links.webUrl);
    }

    return (
        <InstagramDeepLinkBridge
            platform={platform}
            title={`@${INSTAGRAM_USERNAME}`}
            subtitle="Si la aplicación no se abre automáticamente, toca el botón para ir a nuestro perfil."
            buttonLabel="Abrir en Instagram"
            iosAppUrl={links.iosAppUrl}
            androidIntentUrl={links.androidIntentUrl}
            webUrl={links.webUrl}
        />
    );
}
