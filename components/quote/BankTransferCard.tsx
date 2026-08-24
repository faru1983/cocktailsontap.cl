'use client';

import { useState, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';
import { BANK_TRANSFER_FIELDS, getBankTransferCopyText, isBankTransferMonoField } from '@/lib/config';
import { copyToClipboard, formatCurrency } from '@/lib/utils';

type Variant = 'green' | 'amber' | 'neutral';

const VARIANT_STYLES: Record<Variant, string> = {
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    neutral: 'bg-slate-50 border-brand-border text-brand-text',
};

type Props = {
    amount?: number;
    amountLabel?: string;
    variant?: Variant;
    className?: string;
    footer?: React.ReactNode;
};

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex justify-between gap-3 text-[0.75rem] leading-snug">
            <span className="text-brand-text-muted shrink-0">{label}</span>
            <span className={`font-semibold text-right break-all ${mono ? 'select-all tabular-nums' : ''}`}>
                {value}
            </span>
        </div>
    );
}

export default function BankTransferCard({
    amount,
    amountLabel,
    variant = 'green',
    className = '',
    footer,
}: Props) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const ok = await copyToClipboard(getBankTransferCopyText());
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className={`w-full max-w-sm mx-auto border rounded-xl p-3 ${VARIANT_STYLES[variant]} ${className}`}>
            {amount !== undefined && amountLabel && (
                <div className="text-center mb-2.5 pb-2 border-b border-current/10">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wide opacity-70">{amountLabel}</p>
                    <p className="text-lg font-black">{formatCurrency(amount)}</p>
                </div>
            )}

            <div className="space-y-1">
                {BANK_TRANSFER_FIELDS.map((field) => (
                    <Row
                        key={field.label}
                        label={field.label}
                        value={field.value}
                        mono={isBankTransferMonoField(field.label)}
                    />
                ))}
            </div>

            <button
                type="button"
                onClick={() => void handleCopy()}
                className="w-full mt-2.5 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/80 border border-current/15 rounded-lg text-[0.7rem] font-bold transition-all active:scale-[0.98]"
            >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado' : 'Copiar datos'}
            </button>

            {footer && (
                <div className="mt-2.5 pt-2.5 border-t border-current/10 flex flex-col items-center gap-2">
                    {footer}
                </div>
            )}
        </div>
    );
}
