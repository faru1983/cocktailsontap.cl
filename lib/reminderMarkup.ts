/**
 * Marcado de negrita en plantillas de recordatorio.
 * Sintaxis: **texto** → email <strong> / WhatsApp *texto*
 * Sirve para plantillas de canal email, WhatsApp o ambos.
 */

export type ReminderMarkupChannel = 'email' | 'whatsapp';

/**
 * Convierte **texto** al formato del canal.
 * No anida: el interior se toma hasta el primer cierre `**`.
 */
export function applyReminderBoldMarkup(
    text: string,
    channel: ReminderMarkupChannel
): string {
    return String(text || '').replace(/\*\*([^*]+)\*\*/g, (_match, inner: string) => {
        const trimmed = String(inner);
        if (channel === 'email') return `<strong>${trimmed}</strong>`;
        return `*${trimmed}*`;
    });
}
