'use client';

interface SelectFieldProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
    children: React.ReactNode;
    placeholder?: string;
}

/**
 * Componente select reutilizable con estilos consistentes con el design system.
 * Reemplaza la solución anterior con un SVG en base64 hardcodeado directamente
 * en las clases de Tailwind — una solución frágil y difícil de mantener.
 */
export default function SelectField({ id, value, onChange, className = '', children, placeholder }: SelectFieldProps) {
    return (
        <div className="relative">
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full p-4 border-2 border-brand-border rounded-2xl text-[1rem] font-sans transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 appearance-none pr-10 bg-white ${value ? 'text-brand-text' : 'text-brand-text-muted'} ${className}`}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {children}
            </select>
            {/* Chevron icon — reemplaza el SVG en base64 incrustado en clases Tailwind */}
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="w-5 h-5 text-brand-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );
}
