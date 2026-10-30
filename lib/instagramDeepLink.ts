import {
    INSTAGRAM_PROFILE_URL,
    INSTAGRAM_USERNAME,
    QR_ACTIVACION_REEL_SHORTCODE,
    QR_ACTIVACION_REEL_URL,
} from '@/lib/config';

const IG_SHORTCODE_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export interface InstagramDeepLinkTargets {
    webUrl: string;
    iosAppUrl: string;
    androidIntentUrl: string;
}

export type QrClientPlatform = 'ios' | 'android' | 'redirect_web';

/**
 * Convierte un shortcode público de Instagram (ej. "DfIICbCANvA") a su Media ID
 * numérico de 64 bits ("4019498018263849920") usado por `instagram://media?id=...` en iOS.
 */
export function instagramShortcodeToMediaId(shortcode: string): string | null {
    const clean = shortcode.trim();
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(clean)) return null;

    let id = BigInt(0);
    for (const char of clean) {
        const index = IG_SHORTCODE_ALPHABET.indexOf(char);
        if (index === -1) return null;
        id = id * BigInt(64) + BigInt(index);
    }
    return id.toString();
}

export function getInstagramReelDeepLinks(
    shortcode: string = QR_ACTIVACION_REEL_SHORTCODE
): InstagramDeepLinkTargets {
    const code = shortcode.trim();
    const webUrl =
        code === QR_ACTIVACION_REEL_SHORTCODE
            ? QR_ACTIVACION_REEL_URL
            : `https://www.instagram.com/reels/${code}/`;
    const mediaId = instagramShortcodeToMediaId(code);
    const iosAppUrl = mediaId
        ? `instagram://media?id=${mediaId}`
        : `https://www.instagram.com/reel/${code}/`;
    const androidIntentUrl = `intent://www.instagram.com/reels/${code}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;

    return {
        webUrl,
        iosAppUrl,
        androidIntentUrl,
    };
}

export function getInstagramProfileDeepLinks(
    username: string = INSTAGRAM_USERNAME
): InstagramDeepLinkTargets {
    const cleanUser = username.trim().replace(/^@/, '');
    const webUrl =
        cleanUser === INSTAGRAM_USERNAME
            ? INSTAGRAM_PROFILE_URL
            : `https://www.instagram.com/${encodeURIComponent(cleanUser)}/`;
    const iosAppUrl = `instagram://user?username=${encodeURIComponent(cleanUser)}`;
    const androidIntentUrl = `intent://instagram.com/_u/${encodeURIComponent(cleanUser)}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;

    return {
        webUrl,
        iosAppUrl,
        androidIntentUrl,
    };
}

/**
 * Clasifica el User-Agent para decidir si redirigir en servidor (Desktop, bots,
 * o navegador interno de la propia app Instagram) o renderizar el puente nativo móvil.
 */
export function detectQrPlatform(userAgent: string | null): QrClientPlatform {
    if (!userAgent) return 'redirect_web';

    // Si ya viene desde dentro de la app de Instagram o es un crawler de previsualización,
    // redirigimos directo por HTTP 307 sin pantalla intermedia.
    if (
        /Instagram|bot|crawler|spider|facebookexternalhit|meta-externalagent|WhatsApp|Twitterbot|Slackbot|TelegramBot|Discordbot/i.test(
            userAgent
        )
    ) {
        return 'redirect_web';
    }

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
        return 'ios';
    }

    if (/Android/i.test(userAgent)) {
        return 'android';
    }

    return 'redirect_web';
}
