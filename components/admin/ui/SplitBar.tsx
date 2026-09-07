type SplitBarProps = {
    event: number;
    direct: number;
    showLabels?: boolean;
    className?: string;
};

export function SplitBar({ event, direct, showLabels = true, className = '' }: SplitBarProps) {
    const total = event + direct;
    const eventPct = total > 0 ? (event / total) * 100 : 0;
    const directPct = total > 0 ? (direct / total) * 100 : 0;

    return (
        <div className={className}>
            {showLabels && (
                <div className="flex justify-between text-[10px] font-bold mb-1.5">
                    <span className="text-chart-event">Eventos {eventPct.toFixed(0)}%</span>
                    <span className="text-chart-direct">Directas {directPct.toFixed(0)}%</span>
                </div>
            )}
            <div className="h-2 rounded-full overflow-hidden bg-white/5 flex">
                <div className="h-full bg-chart-event transition-all duration-500" style={{ width: `${eventPct}%` }} />
                <div className="h-full bg-chart-direct transition-all duration-500" style={{ width: `${directPct}%` }} />
            </div>
        </div>
    );
}
