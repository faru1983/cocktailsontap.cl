'use client';

import { AlertCircle, CheckCircle2, Cloud, Loader2, RefreshCw } from 'lucide-react';
import type { DraftSaveStatus } from '@/hooks/useDraftQuoteAutoSave';

interface Props {
    status: DraftSaveStatus;
    error?: string | null;
    onRetry?: () => void;
}

export default function DraftSaveBadge({ status, error, onRetry }: Props) {
    if (status === 'saving' || status === 'pending') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 uppercase tracking-wider">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                Guardando...
            </span>
        );
    }

    if (status === 'saved') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                Guardado automático
            </span>
        );
    }

    if (status === 'empty_items') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 uppercase tracking-wider">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Agrega al menos 1 producto para guardar
            </span>
        );
    }

    if (status === 'error') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{error || 'Error al guardar'}</span>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1 underline font-black ml-1 cursor-pointer hover:text-red-900"
                    >
                        <RefreshCw className="w-2.5 h-2.5" /> Reintentar
                    </button>
                )}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 uppercase tracking-wider">
            <Cloud className="w-3 h-3 shrink-0" />
            Guardado automático
        </span>
    );
}
