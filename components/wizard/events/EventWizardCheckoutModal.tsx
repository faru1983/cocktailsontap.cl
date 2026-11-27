'use client';

import React, { useEffect, useId, useMemo, useRef } from 'react';
import type { useWizard } from '@/hooks/useWizard';
import type { Comuna, Region } from '@/lib/types';
import { DEFAULT_REGION_CODE } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
    X,
    Users,
    AlertCircle,
    ArrowRight,
    FileText,
    CalendarCheck,
    MapPin,
    Wine,
    GlassWater,
} from 'lucide-react';
import QuoteSummaryProducts from '@/components/quote/QuoteSummaryProducts';
import { PORTATIL_MIN_LITERS, MURO_MIN_LITERS } from '@/lib/config';

interface Props {
    wizard: ReturnType<typeof useWizard>;
    comunas: Comuna[];
    regions: Region[];
    onClose: () => void;
    onChooseQuote: () => void;
    onChooseReserve: () => void;
}

/**
 * Modal limpio de resumen tipo carrito para /eventos:
 * - Detalle editable de los cócteles seleccionados ("Tu Barra")
 * - Selector opcional de comuna RM para precalcular traslado en vivo
 * - Elección clara de camino: "Enviar cotización formal" o "Generar reserva ahora"
 */
export default function EventWizardCheckoutModal({
    wizard,
    comunas,
    regions,
    onClose,
    onChooseQuote,
    onChooseReserve,
}: Props) {
    const { state, updateContact } = wizard;
    const dialogRef = useRef<HTMLDialogElement>(null);
    const pressedOutsideRef = useRef(false);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (!dialog.open) {
            dialog.showModal();
        }
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summaryData = useMemo(
        () => wizard.calculateSummaryData(),
        [state.selections, state.dispenser, state.contact.comuna]
    );

    const rmComunas = useMemo(() => {
        const eventRegionCodes = new Set(
            regions.filter((r) => r.isActive && r.availableForEvents).map((r) => r.code)
        );
        return comunas
            .filter(
                (c) =>
                    c.isActive &&
                    c.name !== 'Otra' &&
                    (eventRegionCodes.size > 0
                        ? eventRegionCodes.has(c.regionCode)
                        : c.regionCode === DEFAULT_REGION_CODE)
            )
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }, [comunas, regions]);

    const minRequiredLiters = state.dispenser === 'muro' ? MURO_MIN_LITERS : PORTATIL_MIN_LITERS;
    const minLitersMet = summaryData.totalLiters >= minRequiredLiters;
    const hasItems = summaryData.items.length > 0;
    const canContinue = minLitersMet && hasItems;
    const hasComuna = Boolean(state.contact.comuna);

    const summaryForView = {
        ...summaryData,
        guests: state.consumption.guests,
        canHaveMuro: summaryData.canHaveMuro,
    };

    const isPointerOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>) => {
        const dialog = dialogRef.current;
        if (!dialog) return false;
        const rect = dialog.getBoundingClientRect();
        return (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
        );
    };

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
            onPointerDown={(e) => {
                pressedOutsideRef.current = isPointerOutsideDialog(e);
            }}
            onPointerUp={(e) => {
                if (pressedOutsideRef.current && isPointerOutsideDialog(e)) {
                    onClose();
                }
                pressedOutsideRef.current = false;
            }}
            {...({ closedby: 'any' } as Record<string, string>)}
            className="m-auto font-sans text-brand-text bg-slate-50 rounded-2xl sm:rounded-3xl w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-2xl shadow-2xl max-h-[94dvh] p-0 border-0 open:flex flex-col overflow-hidden overscroll-contain backdrop:bg-black/60 backdrop:backdrop-blur-sm backdrop:overflow-hidden backdrop:overscroll-contain animate-fade-in"
        >
            {/* Header */}
            <div className="flex justify-between items-start shrink-0 p-4 sm:p-6 pb-3 pr-12 bg-white border-b border-brand-border/70">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[0.68rem] font-black uppercase tracking-wider mb-1">
                        <Wine className="w-3 h-3" />
                        <span>Resumen de tu evento</span>
                    </div>
                    <h1 id={titleId} className="text-lg sm:text-2xl font-black text-brand-text leading-tight m-0">
                        Tu Barra Seleccionada
                    </h1>
                </div>
                <button
                    type="button"
                    aria-label="Cerrar resumen de barra"
                    onClick={onClose}
                    className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 bg-slate-50 rounded-full border border-brand-border text-brand-text-muted hover:text-brand-text transition-all hover:bg-slate-100 z-10 cursor-pointer"
                >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
                {/* Context strip */}
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary/5 text-primary rounded-xl px-3 py-2 text-xs font-semibold border border-primary/10 text-center">
                    <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <strong className="font-extrabold">{state.consumption.guests} invitados</strong>
                    </span>
                    <span className="text-primary/30">•</span>
                    <strong className="font-extrabold">
                        {state.dispenser === 'muro' ? 'Muro de Coctelería' : 'Dispensador Portátil'}
                    </strong>
                    <span className="text-primary/30">•</span>
                    <strong className="font-extrabold">
                        {summaryForView.totalLiters}L ({summaryForView.totalCocktails} cócteles)
                    </strong>
                </div>

                {/* Optional quick comuna selector to preview shipping */}
                <div className="bg-white rounded-2xl border border-brand-border p-3.5 sm:p-4 shadow-xs">
                    <label
                        htmlFor="cart-comuna-select"
                        className="flex items-center justify-between gap-2 text-xs font-extrabold text-brand-text mb-1.5"
                    >
                        <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            <span>¿En qué comuna es tu evento?</span>
                        </span>
                        <span className="text-[0.68rem] font-semibold text-brand-text-muted">
                            Región Metropolitana
                        </span>
                    </label>
                    <select
                        id="cart-comuna-select"
                        value={state.contact.comuna}
                        onChange={(e) => {
                            updateContact('region', DEFAULT_REGION_CODE);
                            updateContact('comuna', e.target.value);
                        }}
                        className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-base sm:text-sm font-semibold text-brand-text transition-colors"
                    >
                        <option value="">Selecciona comuna para calcular el traslado...</option>
                        {rmComunas.map((c) => (
                            <option key={c.name} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Bar items + Totals */}
                <QuoteSummaryProducts
                    data={summaryForView}
                    title="Tu Barra"
                    compact
                    isEditable
                    onUpdateQuantity={wizard.updateQuantity}
                    onAddProductsClick={onClose}
                    hasComuna={hasComuna}
                    pendingShippingLabel="Elige comuna arriba para calcular"
                />

                {/* Included note */}
                <div className="flex items-start gap-2.5 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl px-4 py-3 text-xs sm:text-sm text-emerald-900">
                    <GlassWater className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="leading-snug m-0">
                        <strong className="font-bold">Incluido sin costo ($0):</strong> hielo abundante, garnish deshidratado, accesorios de bar y vasos a elección.
                    </p>
                </div>
            </div>

            {/* Footer: Choose your path */}
            <div className="shrink-0 bg-white border-t border-brand-border p-4 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-4">
                {!minLitersMet && (
                    <div
                        role="alert"
                        className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                            Mínimo {minRequiredLiters}L para{' '}
                            {state.dispenser === 'muro' ? 'el Muro de Coctelería' : 'el Dispensador Portátil'}.
                        </span>
                    </div>
                )}

                <p className="text-xs font-extrabold uppercase tracking-wider text-brand-text-muted text-center">
                    ¿Cómo quieres continuar? · Total {formatCurrency(summaryData.totalPrice)}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!canContinue}
                        onClick={onChooseQuote}
                        className="group min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-primary text-white font-bold text-base transition-all hover:bg-primary-dark active:scale-[0.98] shadow-[0_4px_15px_rgba(226,160,73,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>Generar Cotización</span>
                    </button>

                    <button
                        type="button"
                        disabled={!canContinue}
                        onClick={onChooseReserve}
                        className="group min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-brand-text text-white font-bold text-base transition-all hover:bg-black active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <CalendarCheck className="w-4 h-4 text-primary shrink-0" />
                        <span>Reservar Ahora</span>
                        <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                </div>
            </div>
        </dialog>
    );
}
