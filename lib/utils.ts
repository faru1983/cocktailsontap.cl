const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

export function formatCurrency(n: number) {
    return CLP.format(n);
}
