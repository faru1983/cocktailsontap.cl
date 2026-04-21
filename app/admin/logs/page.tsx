import { createServerClient } from '@/lib/supabaseServer';
import RetryButton from './RetryButton';
import Link from 'next/link';
import { 
    RefreshCcw, Mail, Calendar, User, CheckCircle, XCircle, 
    AlertTriangle, Clock, ArrowUpDown
} from 'lucide-react';
import LogErrorCell from './LogErrorCell';


async function getSyncLogs(sort: string = 'created_at', order: string = 'desc') {
    const db = createServerClient();
    const { data } = await db.from('sync_logs')
        .select('*, quotes(client_name, client_lastname)')
        .order(sort, { ascending: order === 'asc' })
        .limit(100);
    return data || [];
}

const typeLabels: Record<string, { label: string, icon: any }> = {
    email_client: { label: 'Email Cliente', icon: Mail },
    email_admin: { label: 'Email Admin', icon: Mail },
    google_calendar: { label: 'Google Calendar', icon: Calendar },
    google_pickup: { label: 'Calendar Retiro', icon: Calendar },
    google_contact: { label: 'Google Contact', icon: User },
};

type SearchParams = Promise<{ sort?: string; order?: string }>;

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
    const { sort = 'created_at', order = 'desc' } = await searchParams;
    const logs = await getSyncLogs(sort, order);
    const failed = logs.filter((l: any) => l.status === 'failed');

    const sortFields = [
        { label: 'Fecha de Ejecución', field: 'created_at' },
        { label: 'Cliente Asociado', field: 'quote_id' }, 
        { label: 'Tipo de Proceso', field: 'type' },
        { label: 'Estado Actual', field: 'status' }
    ];

    const getSortLink = (field: string) => {
        const isCurrent = sort === field;
        const nextOrder = isCurrent && order === 'desc' ? 'asc' : 'desc';
        return `/admin/logs?sort=${field}&order=${nextOrder}`;
    };

    return (
        <div className="pb-16 w-full">
            {/* Header Simplified */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1 capitalize flex items-center gap-2">
                        Sincronización
                    </h1>
                </div>
            </div>

            {/* Health Indicator */}
            {failed.length === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-8 text-emerald-400 text-sm font-bold flex items-center gap-3 shadow-lg shadow-emerald-500/5">
                    <CheckCircle size={20} className="shrink-0" />
                    <span>Todos los sistemas operativos. No hay errores de sincronización pendientes.</span>
                </div>
            ) : (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 mb-8 text-rose-400 text-sm font-bold flex items-center gap-3 shadow-lg shadow-rose-500/5">
                    <AlertTriangle size={20} className="shrink-0" />
                    <span>Hemos detectado {failed.length} {failed.length === 1 ? 'proceso fallido' : 'procesos fallidos'} que requieren atención.</span>
                </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-white/[0.02]">
                            {sortFields.map(h => (
                                <th key={h.field} className="text-left px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                                    <Link href={getSortLink(h.field)} className={`flex items-center gap-2 transition-colors ${sort === h.field ? 'text-[#E2A049]' : 'hover:text-slate-300'}`}>
                                        {h.label}
                                        {sort === h.field && <ArrowUpDown size={12} className={order === 'asc' ? 'rotate-180' : ''} />}
                                    </Link>
                                </th>
                            ))}
                            <th className="text-left px-6 py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">Registro de Error</th>
                            <th className="px-6 py-4 border-b border-white/5"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-500 text-sm font-bold italic">Sin registros de sincronización disponibles.</td></tr>
                        ) : logs.map((log: any) => {
                            const TypeIcon = typeLabels[log.type]?.icon || RefreshCcw;
                            return (
                                <tr key={log.id} className="border-t border-white/[0.03] hover:bg-white/[0.01] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-tight">
                                            <Clock size={14} className="text-slate-500"/>
                                            {new Date(log.created_at).toLocaleString('es-CL')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-white font-bold text-sm">
                                            {log.quotes?.client_name} {log.quotes?.client_lastname || ''}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 bg-white/5 w-max px-3 py-1.5 rounded-lg text-slate-300 text-xs font-bold shadow-inner">
                                            <TypeIcon size={14} className="text-[#E2A049]" />
                                            {typeLabels[log.type]?.label || log.type}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                            log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                            log.status === 'retried' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 
                                            'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                        }`}>
                                            {log.status === 'success' ? <><CheckCircle size={10}/> OK</> : 
                                             log.status === 'retried' ? <><RefreshCcw size={10}/> Resuelto</> : 
                                             <><XCircle size={10}/> Fallo</>}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <LogErrorCell 
                                            message={log.error_msg} 
                                            clientName={`${log.quotes?.client_name} ${log.quotes?.client_lastname || ''}`}
                                            typeLabel={typeLabels[log.type]?.label || log.type}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {log.status === 'failed' && <RetryButton logId={log.id} />}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {logs.length === 0 ? (
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-10 text-center text-slate-500 font-bold text-sm shadow-xl">
                        Sin registros disponibles
                    </div>
                ) : logs.map((log: any) => {
                    const TypeIcon = typeLabels[log.type]?.icon || RefreshCcw;
                    return (
                        <div key={log.id} className={`bg-[#1e2433] rounded-2xl border p-5 shadow-xl transition-all active:scale-[0.98] relative overflow-hidden ${
                            log.status === 'failed' ? 'border-rose-500/30' : 'border-white/5 hover:border-white/10'
                        }`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                                    <Clock size={12}/> {new Date(log.created_at).toLocaleString('es-CL')}
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                    log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 
                                    log.status === 'retried' ? 'bg-sky-500/10 text-sky-400' : 
                                    'bg-rose-500/10 text-rose-400 shadow-md'
                                }`}>
                                    {log.status === 'success' ? 'OK' : log.status === 'retried' ? 'Resuelto' : 'Fallo'}
                                </span>
                            </div>
                            
                            <div className="mb-4">
                                <div className="text-white font-black text-lg leading-tight mb-1">
                                    {log.quotes?.client_name} {log.quotes?.client_lastname || ''}
                                </div>
                                <div className="flex items-center gap-2 text-[#E2A049] text-xs font-bold">
                                    <TypeIcon size={14} /> {typeLabels[log.type]?.label || log.type}
                                </div>
                            </div>

                            {log.error_msg && (
                                <div className="mt-4">
                                    <LogErrorCell 
                                        message={log.error_msg} 
                                        clientName={`${log.quotes?.client_name} ${log.quotes?.client_lastname || ''}`}
                                        typeLabel={typeLabels[log.type]?.label || log.type}
                                    />
                                </div>
                            )}

                            {log.status === 'failed' && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <RetryButton logId={log.id} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
