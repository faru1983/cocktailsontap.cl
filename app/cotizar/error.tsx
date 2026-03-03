'use client';

import { AlertCircle } from 'lucide-react';

export default function CotizarError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <main className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="p-4 bg-red-100 rounded-full">
                <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-brand-text">No pudimos cargar el cotizador</h2>
            <p className="text-brand-text-muted text-[0.95rem] max-w-md">
                {error.message ?? 'Ocurrió un error inesperado. Por favor intenta nuevamente.'}
            </p>
            <button
                type="button"
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-[0.95rem] hover:bg-primary-dark transition-all"
                onClick={reset}
            >
                Reintentar
            </button>
        </main>
    );
}
