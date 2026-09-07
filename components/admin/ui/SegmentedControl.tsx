'use client';

type SegmentedOption<T extends string> = {
    value: T;
    label: string;
};

type SegmentedControlProps<T extends string> = {
    value: T;
    options: SegmentedOption<T>[];
    onChange: (value: T) => void;
    ariaLabel: string;
    className?: string;
    size?: 'sm' | 'md';
};

export function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
    ariaLabel,
    className = '',
    size = 'md',
}: SegmentedControlProps<T>) {
    const pad = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs';

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={`inline-flex flex-wrap gap-1 rounded-xl border border-admin-border bg-black/20 p-1 ${className}`}
        >
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(opt.value)}
                        className={`rounded-lg font-bold transition-all cursor-pointer border-none ${pad} ${
                            active
                                ? 'bg-primary/15 text-primary shadow-sm'
                                : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
