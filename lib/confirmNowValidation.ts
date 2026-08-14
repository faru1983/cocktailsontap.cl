import type { WizardState } from '@/lib/types';
import { isValidPhoneE164 } from '@/lib/phone';

/** Campos obligatorios al confirmar reserva de evento (wizard/admin). */
export function validateConfirmNowState(state: WizardState): string | null {
    if (state.serviceType === 'direct') return null;
    if (!isValidPhoneE164(state.contact.phone)) {
        return 'Celular inválido. Usa formato +56 9 ...';
    }
    if ((state.contact.lastName || '').trim().length < 2) {
        return 'Apellido es obligatorio.';
    }
    if ((state.contact.address || '').trim().length < 5) {
        return 'Dirección obligatoria (mín. 5 caracteres).';
    }
    if (!(state.contact.region || '').trim()) {
        return 'Selecciona una región.';
    }
    if (!(state.contact.comuna || '').trim()) {
        return 'Selecciona una comuna.';
    }
    if (state.contact.comuna === 'Otra' && !(state.contact.otherComuna || '').trim()) {
        return 'Especifica la comuna.';
    }
    if (!(state.eventData.startTime || '').trim()) {
        return 'Hora de inicio obligatoria.';
    }
    if (!(state.eventData.pickupDate || '').trim()) {
        return 'Fecha de retiro obligatoria.';
    }
    const sameDay = state.eventData.pickupDate === state.eventData.date;
    if (!sameDay && !(state.eventData.pickupTime || '').trim()) {
        return 'Hora de retiro obligatoria.';
    }
    return null;
}
