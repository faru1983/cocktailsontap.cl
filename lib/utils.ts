const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

export function formatCurrency(n: number) {
    return CLP.format(n);
}

/**
 * Formatea un string como número de teléfono: +XXX-XXXXXXXX
 * Permite borrar libremente y aplica el guion solo cuando hay números después del prefijo.
 */
export function formatPhoneNumber(value: string): string {
    // Si borró todo, lo dejamos vacío para que el componente maneje el estado
    if (!value) return '';

    // Solo extraemos los números
    const numbers = value.replace(/[^\d]/g, '');

    // Si no hay números pero había algo (ej: el usuario escribió '+'), devolvemos '+'
    if (numbers.length === 0) return '+';

    // Si tiene el prefijo de Chile (+569)
    if (numbers.startsWith('569')) {
        // Mientras solo tenga el prefijo (o menos), no forzamos el guion para permitir borrado fluido
        if (numbers.length <= 3) return `+${numbers}`;

        // Cuando empieza a escribir el resto de los números, ponemos el guion
        return `+${numbers.slice(0, 3)}-${numbers.slice(3, 11)}`;
    }

    // Para cualquier otro código de país (o si el usuario está borrando el prefijo)
    if (numbers.length <= 3) return `+${numbers}`;
    return `+${numbers.slice(0, 3)}-${numbers.slice(3, 11)}`;
}
