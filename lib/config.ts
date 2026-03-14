/**
 * Configuración centralizada del proyecto.
 * Importar desde aquí en vez de leer process.env directamente en cada archivo.
 */

/** URL base del sitio. En producción: https://cocktailsontap.cl */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cocktailsontap.cl';

/**
 * URL del logo, forzando siempre la URL de producción para emails
 * (Gmail no puede acceder a localhost al previsualizar correos).
 */
export const LOGO_URL = SITE_URL.includes('localhost')
    ? 'https://cocktailsontap.cl/assets/logo2.webp'
    : `${SITE_URL}/assets/logo2.webp`;

/** Datos de contacto y administración */
export const CONTACT_EMAIL = 'contacto@cocktailsontap.cl';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'contacto@cocktailsontap.cl';
export const FROM_EMAIL = 'Cocktails on Tap <contacto@cocktailsontap.cl>';

/** WhatsApp Business */
export const WHATSAPP_URL = 'https://wa.me/56929672978';
export const WHATSAPP_LABEL = '+56 9 2967 2978';

/** Costo de instalación del Muro de Coctelería (en CLP) */
export const MURO_INSTALLATION_COST = 50_000;

/** Liters mínimos para poder elegir el Muro de Coctelería */
export const MURO_MIN_LITERS = 30;

/** Tamaños compatibles con el Muro (en litros). El 5L no es compatible. */
export const MURO_COMPATIBLE_SIZES = [10, 20, 30];

/** Timezone del proyecto (Chile) */
export const PROJECT_TIMEZONE = 'America/Santiago';
