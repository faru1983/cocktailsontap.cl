'use client';

export interface QuoteSummaryReservationData {
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    comunaDisplay: string;
    eventTypeDisplay: string;
    guests: number;
    formattedDate: string;
    startTime: string;
    formattedPickupDate?: string;
    pickupTime?: string;
    comments?: string;
}

interface Props {
    data: QuoteSummaryReservationData;
}

export default function QuoteSummaryReservation({ data }: Props) {
    return (
        <div className="w-full bg-white rounded-[20px] p-4 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.07)] border border-brand-border">
            <div className="flex items-center gap-2 mb-6">
                <h2 className="text-[0.7rem] sm:text-[0.75rem] font-black text-primary uppercase tracking-[0.2em]">Información de Contacto</h2>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 mb-8 text-[0.875rem]">
                {/* Columna 1: Contacto */}
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <span className="font-bold text-brand-text-muted min-w-[85px]">Nombre:</span>
                        <span className="font-medium text-brand-text leading-tight">{data.clientName}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-bold text-brand-text-muted min-w-[85px]">Email:</span>
                        <span className="font-medium text-brand-text leading-tight break-all">{data.clientEmail}</span>
                    </div>
                    {data.clientPhone && (
                        <div className="flex items-start gap-2">
                            <span className="font-bold text-brand-text-muted min-w-[85px]">Celular:</span>
                            <span className="font-medium text-brand-text leading-tight">{data.clientPhone}</span>
                        </div>
                    )}
                    <div className="flex items-start gap-2">
                        <span className="font-bold text-brand-text-muted min-w-[85px]">Dirección:</span>
                        <span className="font-medium text-brand-text leading-tight break-all">
                            {data.clientAddress}{data.clientAddress && data.comunaDisplay ? ', ' : ''}{data.comunaDisplay}
                        </span>
                    </div>
                </div>

                {/* Columna 2: Evento / Despacho */}
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <span className="font-bold text-brand-text-muted min-w-[85px]">Servicio:</span>
                        <span className="font-medium text-brand-text leading-tight">
                            {data.eventTypeDisplay === 'Venta Directa' 
                                ? 'Venta Directa (Barril Desechable)' 
                                : `${data.eventTypeDisplay} (${data.guests} pers.)`
                            }
                        </span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-bold text-brand-text-muted min-w-[85px]">Fecha:</span>
                        <span className="font-medium text-brand-text leading-tight">
                            {data.formattedDate}
                            {data.startTime && data.startTime !== '--:--' && ` · (${data.startTime})`}
                        </span>
                    </div>
                    {data.formattedPickupDate && (
                        <div className="flex items-start gap-2">
                            <span className="font-bold text-brand-text-muted min-w-[85px]">Retiro:</span>
                            <span className="font-medium text-brand-text leading-tight">{data.formattedPickupDate} {data.pickupTime && ` · (${data.pickupTime})`}</span>
                        </div>
                    )}
                </div>
            </div>

            {data.comments && (
                <div className="p-4 bg-slate-50 rounded-xl border border-brand-border/50 italic text-brand-text-muted text-[0.9rem]">
                    Comentarios: {data.comments}
                </div>
            )}
        </div>
    );
}
