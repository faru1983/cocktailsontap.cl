'use client';

export default function SortSelect({ name, defaultValue, children, className, style }: { name: string; defaultValue?: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <select
            name={name}
            defaultValue={defaultValue}
            className={className}
            style={style}
            onChange={(e) => (e.target.form as HTMLFormElement).submit()}
        >
            {children}
        </select>
    );
}
