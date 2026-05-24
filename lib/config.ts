/**
 * Configuración centralizada del proyecto.
 * Importar desde aquí en vez de leer process.env directamente en cada archivo.
 * 
 * NOTA DE SEGURIDAD: Los valores reales deben estar en el archivo .env.local 
 * o en las variables de entorno de Vercel. Los valores aquí son solo fallbacks genéricos.
 */

/** URL base del sitio. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ejemplo.cl';

/**
 * URL del logo, forzando siempre la URL de producción para emails
 */
export const LOGO_URL = SITE_URL.includes('localhost')
    ? 'https://cocktailsontap.cl/assets/logo2.webp'
    : `${SITE_URL}/assets/logo2.webp`;

/** Datos de contacto y administración (Leídos de env) */
export const CONTACT_EMAIL = process.env.ADMIN_EMAIL ?? 'contacto@ejemplo.cl';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@ejemplo.cl';
export const FROM_EMAIL = `Cocktails on Tap <${ADMIN_EMAIL}>`;

/** WhatsApp Business */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '56900000000';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
export const WHATSAPP_LABEL = '+56 9 ' + (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.slice(3) || '0000 0000');

/** Costo de instalación del Muro de Coctelería (en CLP) */
export const MURO_INSTALLATION_COST = 50_000;

/** Litros mínimos para poder elegir el Muro de Coctelería */
export const MURO_MIN_LITERS = 30;

/** Litros mínimos para poder elegir el Dispensador Portátil */
export const PORTATIL_MIN_LITERS = 10;

/** Tamaños compatibles con el Muro (en litros). El 5L no es compatible. */
export const MURO_COMPATIBLE_SIZES = [10, 20, 30];

/** Timezone del proyecto (Chile) */
export const PROJECT_TIMEZONE = 'America/Santiago';
