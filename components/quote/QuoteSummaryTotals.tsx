'use client';

import { formatCurrency } from '@/lib/utils';
import type { QuoteSummaryData } from '@/components/quote/QuoteSummaryProducts';
import { getBlueExpressShippingLine } from '@/lib/blueExpress';

interface Props {
    data: QuoteSummaryData;
    isEditable?: boolean;
    onChangeDispenser?: () => void;
    compact?: boolean;
    /** Sin comuna: no mostrar una tarifa de RM por defecto. */
    hasComuna?: boolean;
}

/**
 * Subtotal, flete, instalación y TOTAL.
 * Lo usan el resumen de cotización y el footer del checkout móvil.
 */
export default function QuoteSummaryTotals({
    data,
    isEditable = false,
    onChangeDispenser,
    compact = false,
    hasComuna = true,
}: Props) {
    const isDesechable = data.dispenserLabel.toLowerCase().includes('desechable');
    const shippingPending = !hasComuna || data.shippingLabel === 'Por calcular';
    const shippingName =
        data.shippingCarrier === 'blue_express'
            ? getBlueExpressShippingLine(data.blueExpressZone)
            : 'Transporte';
    const shippingValue = shippingPending
        ? 'Elige comuna para calcular'
        : data.shippingLabel;

    return (
        <div className="flex flex-col">
            <div className="flex justify-between py-1 text-[0.95rem] font-medium text-brand-text-muted">
                <span>Subtotal</span>
                <span className="font-bold text-brand-text">{formatCurrency(data.totalNormalPrice)}</span>
            </div>
            {data.totalDiscount > 0 && (
                <div className="flex justify-between py-1 text-[0.95rem] font-bold text-[#16a34a]">
                    <span>Descuento</span>
                    <span>-{formatCurrency(data.totalDiscount)}</span>
                </div>
            )}
            {data.manualDiscount > 0 && (
                <div className="flex justify-between py-1 text-[0.95rem] font-bold text-[#f87171]">
                    <span>Descuento Extra</span>
                    <span>-{formatCurrency(data.manualDiscount)}</span>
                </div>
            )}
            <div className="flex justify-between py-1 text-[0.95rem] font-medium text-brand-text-muted gap-3">
                <span className="shrink-0">{shippingName}</span>
                <span
                    className={`font-bold text-right ${
                        shippingPending
                            ? 'text-brand-text-muted'
                            : data.shippingCost === 0
                              ? 'text-primary'
                              : 'text-brand-text'
                    }`}
                >
                    {shippingValue}
                </span>
            </div>
            {!isDesechable && (
                <div className="flex justify-between py-2 text-[0.95rem] font-medium text-brand-text-muted items-center">
                    <div className="flex items-center gap-2">
                        <span>{data.dispenserLabel}</span>
                        {isEditable && data.canHaveMuro && onChangeDispenser && (
                            <button
                                type="button"
                                onClick={onChangeDispenser}
                                className="text-xs font-black text-primary hover:underline border-none bg-transparent p-0 cursor-pointer"
                            >
                                ({data.dispenserLabel.includes('Muro') ? 'Cambiar a Dispensador' : 'Cambiar a Muro'})
                            </button>
                        )}
                    </div>
                    <span className={`font-bold ${data.installationCost === 0 ? 'text-primary' : 'text-brand-text'}`}>
                        {data.installationCost === 0 ? '¡Gratis!' : formatCurrency(data.installationCost)}
                    </span>
                </div>
            )}
            <div
                className={`flex justify-between items-center ${
                    compact ? 'pt-3 mt-2 border-t border-primary/20' : 'pt-4 mt-2 border-t-2 border-primary'
                }`}
            >
                <span className={`font-black text-brand-text ${compact ? 'text-[0.9rem]' : 'text-[1rem]'}`}>TOTAL</span>
                <span className={`font-black text-primary ${compact ? 'text-xl sm:text-2xl' : 'text-2xl'}`}>
                    {formatCurrency(data.totalPrice)}
                </span>
            </div>
            <p className={`text-brand-text-muted font-medium m-0 ${compact ? 'text-[0.7rem] pt-1' : 'text-[0.75rem] pt-1.5'}`}>
                Valores netos. No incluyen IVA.
            </p>
        </div>
    );
}
