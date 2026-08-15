'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import QuoteSummaryProducts, { type QuoteSummaryData } from '@/components/quote/QuoteSummaryProducts';

interface Props {
    data: QuoteSummaryData;
    isEditable?: boolean;
    onUpdateQuantity?: (id: string, size: string, delta: number) => void;
    onAddProductsClick?: () => void;
    onChangeDispenser?: () => void;
    hasComuna?: boolean;
}

/**
 * Carrito del checkout: accordion colapsado en móvil, listado completo en desktop.
 */
export default function CheckoutCartSection({
    data,
    isEditable,
    onUpdateQuantity,
    onAddProductsClick,
    onChangeDispenser,
    hasComuna,
}: Props) {
    const [open, setOpen] = useState(false);
    const itemLabel = data.items.length === 1 ? 'ítem' : 'ítems';

    const listProps = {
        data,
        isEditable,
        onUpdateQuantity,
        onAddProductsClick,
        onChangeDispenser,
        compact: true,
        hasComuna,
    };

    return (
        <>
            <div className="lg:hidden">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 bg-white rounded-2xl border border-brand-border px-4 py-3 text-left cursor-pointer"
                >
                    <span className="font-extrabold text-brand-text text-sm">
                        {data.items.length} {itemLabel}
                        <span className="text-brand-text-muted font-bold"> · </span>
                        <span className="text-primary">{formatCurrency(data.totalPrice)}</span>
                    </span>
                    <ChevronDown
                        className={`w-5 h-5 text-brand-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </button>
                {open && (
                    <div className="mt-3">
                        <QuoteSummaryProducts {...listProps} hideTotals />
                    </div>
                )}
            </div>
            <div className="hidden lg:block">
                <QuoteSummaryProducts {...listProps} />
            </div>
        </>
    );
}
