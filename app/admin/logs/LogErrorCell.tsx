'use client';

import { useState } from 'react';
import Modal from '@/components/admin/Modal';
import { Eye } from 'lucide-react';

interface LogErrorCellProps {
    message: string;
    clientName: string;
    typeLabel: string;
}

export default function LogErrorCell({ message, clientName, typeLabel }: LogErrorCellProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!message || message === '—') {
        return <div className="text-slate-600 text-xs italic">Sin detalles</div>;
    }

    return (
        <>
            <div 
                onClick={() => setIsOpen(true)}
                className="group flex items-center gap-2 text-slate-500 text-xs font-mono max-w-[200px] cursor-pointer hover:text-[#E2A049] transition-all"
            >
                <span className="truncate flex-1">{message}</span>
                <Eye size={12} className="opacity-0 group-hover:opacity-100 shrink-0" />
            </div>

            <Modal 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)} 
                title="Detalle del Error"
            >
                <div className="space-y-4">
                    <div className="flex flex-col gap-1 border-b border-white/5 pb-4 mb-4">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Contexto</span>
                        <div className="text-white font-bold text-sm">
                            {clientName} <span className="text-slate-500 font-normal mx-2">|</span> 
                            <span className="text-[#E2A049]">{typeLabel}</span>
                        </div>
                    </div>

                    <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 shadow-inner">
                        <div className="text-[10px] text-rose-500/50 font-black uppercase tracking-widest mb-2">Mensaje del servidor</div>
                        <div className="font-mono text-xs text-rose-400 whitespace-pre-wrap break-words leading-relaxed">
                            {message}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="bg-white/5 hover:bg-white/10 text-slate-300 px-6 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
