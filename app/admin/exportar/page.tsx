import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminAuth';
import ExportClient from './ExportClient';
import { BUILTIN_PRESETS, loadSavedExportPresets } from '@/lib/services/exportService';

export const metadata: Metadata = {
    title: 'Exportar — Admin | Cocktails on Tap',
};

export const dynamic = 'force-dynamic';

export default async function ExportarPage() {
    await requireAdmin();
    const db = createServerClient();

    const [savedPresets, comunasRes] = await Promise.all([
        loadSavedExportPresets(db),
        db.from('comunas').select('name').eq('is_active', true).order('name', { ascending: true }),
    ]);

    const comunas = (comunasRes.data || []).map((c) => c.name).filter(Boolean);

    return (
        <div className="pb-16 w-full space-y-6">
            <div>
                <h1 className="text-white text-2xl md:text-3xl font-black mb-1">Exportar datos</h1>
                <p className="text-slate-500 text-sm">
                    Clientes y cotizaciones con campos, filtros y formatos configurables (Meta Ads, Mailchimp, Excel).
                </p>
            </div>
            <ExportClient
                builtinPresets={BUILTIN_PRESETS}
                savedPresets={savedPresets}
                comunas={comunas}
            />
        </div>
    );
}
