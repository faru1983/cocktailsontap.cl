'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Banknote,
    CalendarDays,
    Check,
    CreditCard,
    Loader2,
    Plus,
    RotateCcw,
    Smartphone,
    X,
    Zap,
} from 'lucide-react';
import { addExpense } from '@/app/actions/admin/gastosActions';
import type { QuickExpenseMeta, QuickExpensePreset } from '@/lib/services/quickExpenseService';

function getChileDateOffset(daysOffset = 0): string {
    const base = new Date(Date.now() + daysOffset * 86_400_000);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(base);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
}

function formatAmountDisplay(digits: string): string {
    if (!digits) return '';
    const n = Number(digits);
    if (!Number.isFinite(n) || n <= 0) return '';
    return new Intl.NumberFormat('es-CL').format(n);
}

function PaymentIcon({ method }: { method: string }) {
    if (method === 'Tarjeta') return <CreditCard size={14} />;
    if (method === 'Efectivo') return <Banknote size={14} />;
    return <Smartphone size={14} />;
}

const AMOUNT_STEPS = [5000, 10000, 20000, 50000] as const;

export default function QuickExpenseMobile({ meta }: { meta: QuickExpenseMeta }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const amountInputRef = useRef<HTMLInputElement>(null);
    const [isPending, startTransition] = useTransition();

    const todayStr = useMemo(() => getChileDateOffset(0), []);
    const yesterdayStr = useMemo(() => getChileDateOffset(-1), []);

    const [open, setOpen] = useState(false);
    const [amountDigits, setAmountDigits] = useState('');
    const [categoryId, setCategoryId] = useState(() => meta.presets[0]?.category_id || meta.categories[0]?.id || '');
    const [subcategoryId, setSubcategoryId] = useState(() => {
        if (meta.presets[0]?.subcategory_id) return meta.presets[0].subcategory_id;
        const firstCat = meta.categories[0]?.id;
        const subs = meta.subcategories.filter((s) => s.category_id === firstCat);
        return subs.length === 1 ? subs[0].id : '';
    });
    const [paymentMethod, setPaymentMethod] = useState(
        () => meta.presets[0]?.payment_method || meta.paymentMethods[0]?.name || 'Tarjeta'
    );
    const [expenseDate, setExpenseDate] = useState(todayStr);
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [notes, setNotes] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const visibleSubcategories = useMemo(
        () => meta.subcategories.filter((s) => s.category_id === categoryId),
        [meta.subcategories, categoryId]
    );

    useEffect(() => {
        if (searchParams.get('quickExpense') === '1') {
            setOpen(true);
            const url = new URL(window.location.href);
            url.searchParams.delete('quickExpense');
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => {
            amountInputRef.current?.focus();
        }, 120);
        return () => clearTimeout(timer);
    }, [open]);

    const handleSelectCategory = (id: string) => {
        setCategoryId(id);
        setErrorMsg(null);
        const subs = meta.subcategories.filter((s) => s.category_id === id);
        if (subs.length === 1) {
            setSubcategoryId(subs[0].id);
        } else if (!subs.some((s) => s.id === subcategoryId)) {
            setSubcategoryId('');
        }
    };

    const handleApplyPreset = (preset: QuickExpensePreset) => {
        setCategoryId(preset.category_id);
        setSubcategoryId(preset.subcategory_id);
        setPaymentMethod(preset.payment_method);
        setErrorMsg(null);
        amountInputRef.current?.focus();
    };

    const handleAddAmount = (delta: number) => {
        const current = Number(amountDigits || '0');
        setAmountDigits(String(current + delta));
        setErrorMsg(null);
    };

    const handleSave = (keepOpen: boolean) => {
        const amount = Number(amountDigits);
        if (!Number.isFinite(amount) || amount <= 0) {
            setErrorMsg('Ingresa un monto mayor a $0');
            amountInputRef.current?.focus();
            return;
        }
        if (!categoryId || !subcategoryId) {
            setErrorMsg('Elige categoría y subcategoría');
            return;
        }
        if (!paymentMethod) {
            setErrorMsg('Elige un medio de pago');
            return;
        }

        setErrorMsg(null);
        startTransition(async () => {
            const res = await addExpense({
                amount,
                payment_method: paymentMethod,
                expense_date: expenseDate || todayStr,
                category_id: categoryId,
                subcategory_id: subcategoryId,
                notes: notes.trim() || undefined,
            });

            if (!res.success) {
                setErrorMsg(res.error || 'No se pudo guardar el gasto');
                return;
            }

            router.refresh();

            if (keepOpen) {
                setAmountDigits('');
                setNotes('');
                setSuccessMsg('Gasto guardado — listo para el siguiente');
                setTimeout(() => setSuccessMsg(null), 2200);
                setTimeout(() => amountInputRef.current?.focus(), 60);
            } else {
                setSuccessMsg('Gasto guardado');
                setTimeout(() => {
                    setOpen(false);
                    setSuccessMsg(null);
                    setAmountDigits('');
                    setNotes('');
                }, 600);
            }
        });
    };

    if (meta.categories.length === 0) return null;

    return (
        <div className="lg:hidden">
            {!open && (
                <button
                    type="button"
                    onClick={() => {
                        setExpenseDate(getChileDateOffset(0));
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setOpen(true);
                    }}
                    aria-label="Registrar gasto rápido"
                    className="fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-slate-950 font-black text-sm shadow-[0_10px_30px_rgba(226,160,73,0.35)] active:scale-95 transition-transform cursor-pointer border-none"
                >
                    <Plus size={18} strokeWidth={2.75} />
                    <span>Gasto</span>
                </button>
            )}

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm animate-fade-in"
                    onClick={() => !isPending && setOpen(false)}
                >
                    <div
                        className="w-full max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-admin-sidebar border-t border-white/10 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
                                    <Zap size={16} />
                                </div>
                                <h2 className="text-base font-extrabold text-white m-0">Gasto rápido</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => !isPending && setOpen(false)}
                                aria-label="Cerrar"
                                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white border-none cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {meta.presets.length > 0 && (
                            <div className="mb-3">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Tus frecuentes
                                </div>
                                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                                    {meta.presets.map((preset) => {
                                        const active =
                                            categoryId === preset.category_id &&
                                            subcategoryId === preset.subcategory_id &&
                                            paymentMethod === preset.payment_method;
                                        return (
                                            <button
                                                key={preset.key}
                                                type="button"
                                                onClick={() => handleApplyPreset(preset)}
                                                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                    active
                                                        ? 'bg-primary/20 border-primary text-primary'
                                                        : 'bg-admin-surface border-white/10 text-slate-300'
                                                }`}
                                            >
                                                <span>{preset.subcategory_name}</span>
                                                <span className="text-[10px] opacity-65">· {preset.payment_method}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Monto protagonista */}
                        <div className="rounded-2xl bg-admin-bg border border-white/10 p-3 mb-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
                                    <span className="text-2xl font-black text-primary">$</span>
                                    <input
                                        ref={amountInputRef}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="0"
                                        value={formatAmountDisplay(amountDigits)}
                                        onChange={(e) => {
                                            const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 8);
                                            setAmountDigits(onlyDigits);
                                            setErrorMsg(null);
                                        }}
                                        className="w-full bg-transparent text-3xl font-black text-white placeholder:text-slate-600 focus:outline-none border-none p-0"
                                    />
                                </div>
                                {amountDigits && (
                                    <button
                                        type="button"
                                        onClick={() => setAmountDigits('')}
                                        aria-label="Limpiar monto"
                                        className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border-none cursor-pointer"
                                    >
                                        <RotateCcw size={15} />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-1.5 mt-2.5 overflow-x-auto hide-scrollbar">
                                {AMOUNT_STEPS.map((step) => (
                                    <button
                                        key={step}
                                        type="button"
                                        onClick={() => handleAddAmount(step)}
                                        className="shrink-0 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
                                    >
                                        +${(step / 1000).toFixed(0)}k
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Fecha + Medio de pago */}
                        <div className="grid grid-cols-1 gap-2.5 mb-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                                    <CalendarDays size={13} /> Fecha:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExpenseDate(todayStr);
                                        setShowCustomDate(false);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                                        expenseDate === todayStr && !showCustomDate
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-admin-surface border-white/10 text-slate-400'
                                    }`}
                                >
                                    Hoy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExpenseDate(yesterdayStr);
                                        setShowCustomDate(false);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                                        expenseDate === yesterdayStr && !showCustomDate
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-admin-surface border-white/10 text-slate-400'
                                    }`}
                                >
                                    Ayer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomDate((v) => !v)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                                        showCustomDate || (expenseDate !== todayStr && expenseDate !== yesterdayStr)
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-admin-surface border-white/10 text-slate-400'
                                    }`}
                                >
                                    {expenseDate !== todayStr && expenseDate !== yesterdayStr ? expenseDate : 'Otro'}
                                </button>
                                {showCustomDate && (
                                    <input
                                        type="date"
                                        value={expenseDate}
                                        onChange={(e) => setExpenseDate(e.target.value)}
                                        className="ml-auto rounded-lg bg-admin-bg border border-white/15 px-2.5 py-1 text-xs text-white"
                                    />
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                                {meta.paymentMethods.map((pm) => {
                                    const active = paymentMethod === pm.name;
                                    return (
                                        <button
                                            key={pm.id}
                                            type="button"
                                            onClick={() => setPaymentMethod(pm.name)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                                                active
                                                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                                                    : 'bg-admin-surface border-white/10 text-slate-400'
                                            }`}
                                        >
                                            <PaymentIcon method={pm.name} />
                                            <span>{pm.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Categoría */}
                        <div className="mb-2.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Categoría
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {meta.categories.map((cat) => {
                                    const active = categoryId === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => handleSelectCategory(cat.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                                                active
                                                    ? 'bg-primary text-slate-950 border-primary'
                                                    : 'bg-admin-surface border-white/10 text-slate-300'
                                            }`}
                                        >
                                            {cat.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Subcategoría */}
                        {visibleSubcategories.length > 0 && (
                            <div className="mb-3">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Subcategoría
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {visibleSubcategories.map((sub) => {
                                        const active = subcategoryId === sub.id;
                                        return (
                                            <button
                                                key={sub.id}
                                                type="button"
                                                onClick={() => {
                                                    setSubcategoryId(sub.id);
                                                    setErrorMsg(null);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                                                    active
                                                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                                                        : 'bg-admin-bg border-white/10 text-slate-400'
                                                }`}
                                            >
                                                {sub.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Nota opcional */}
                        <input
                            type="text"
                            maxLength={200}
                            placeholder="Detalle o proveedor (opcional)"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full rounded-xl bg-admin-bg border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/60 mb-3"
                        />

                        {errorMsg && (
                            <div className="mb-3 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300">
                                {errorMsg}
                            </div>
                        )}

                        {successMsg && (
                            <div className="mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                <Check size={15} /> {successMsg}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleSave(false)}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-slate-950 border-none cursor-pointer disabled:opacity-60"
                            >
                                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                Guardar gasto
                            </button>
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleSave(true)}
                                className="px-4 flex items-center justify-center gap-1 rounded-xl bg-admin-surface border border-white/15 py-3 text-sm font-bold text-slate-200 cursor-pointer disabled:opacity-60"
                            >
                                <Plus size={15} /> Otro
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
