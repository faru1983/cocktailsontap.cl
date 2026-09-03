'use client';

import {
    formatPhoneDisplay,
    phoneInputToE164,
    digitsOnly,
    PHONE_PLACEHOLDER,
    CHILE_COUNTRY_PREFIX_E164,
    isChilePrefixOnly,
} from '@/lib/phone';

interface PhoneInputProps {
    id?: string;
    name?: string;
    value: string;
    onChange: (e164: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    autoComplete?: string;
}

/**
 * Input global de celular.
 * - Vacío: placeholder (+56 9 1234 5678)
 * - Al focus: inyecta prefijo país Chile (+56); el 9 móvil lo escribe el usuario
 * - Emite E.164 con '+' al padre (+56912345678)
 * - Permite CO (+57), PE (+51), VE (+58) borrando el prefijo
 */
export default function PhoneInput({
    id,
    name,
    value,
    onChange,
    onBlur,
    onFocus,
    required,
    disabled,
    className = '',
    style,
    placeholder = PHONE_PLACEHOLDER,
    autoComplete = 'tel',
}: PhoneInputProps) {
    const display = formatPhoneDisplay(value);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (!value || isChilePrefixOnly(value)) {
            onChange(CHILE_COUNTRY_PREFIX_E164);
        }
        onFocus?.();
        requestAnimationFrame(() => {
            const len = e.target.value.length;
            try {
                e.target.setSelectionRange(len, len);
            } catch {
                /* ignore */
            }
        });
    };

    const handleBlur = () => {
        // Si solo quedó el prefijo sin dígitos, limpiar para volver a mostrar placeholder
        if (isChilePrefixOnly(value)) {
            onChange('');
        }
        onBlur?.();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const digits = digitsOnly(raw);

        // Campo vacío → usuario empieza a tipear: asumir Chile salvo 51/56/57/58
        if (!value && digits) {
            if (/^(51|56|57|58)/.test(digits)) {
                onChange(phoneInputToE164(digits));
            } else if (digits.startsWith('9')) {
                onChange(phoneInputToE164(digits));
            } else {
                onChange(phoneInputToE164('56' + digits));
            }
            return;
        }

        onChange(phoneInputToE164(raw));
    };

    return (
        <input
            id={id}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete={autoComplete}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            value={display}
            onFocus={handleFocus}
            onChange={handleChange}
            onBlur={handleBlur}
            className={className}
            style={style}
        />
    );
}
