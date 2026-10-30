import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import InstagramDeepLinkBridge from '@/components/shared/InstagramDeepLinkBridge';
import {
    detectQrPlatform,
    getInstagramReelDeepLinks,
} from '@/lib/instagramDeepLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Cómo activar tu barril | Cocktails on Tap',
    description: 'Tutorial paso a paso para activar tu barril Cocktails on Tap.',
    robots: {
        index: false,
        follow: false,
    },
};

export default async function QrActivacionPage() {
    const links = getInstagramReelDeepLinks();
    const userAgent = (await headers()).get('user-agent');
    const platform = detectQrPlatform(userAgent);

    if (platform === 'redirect_web') {
        redirect(links.webUrl);
    }

    return (
        <InstagramDeepLinkBridge
            platform={platform}
            title="¿Cómo activar tu barril?"
            subtitle="Si la aplicación no se abre automáticamente, toca el botón para ver el tutorial."
            buttonLabel="Abrir video en Instagram"
            iosAppUrl={links.iosAppUrl}
            androidIntentUrl={links.androidIntentUrl}
            webUrl={links.webUrl}
        />
    );
}
