import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

export function EmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: LucideIcon }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="p-3 rounded-2xl bg-white/5 text-slate-500">
                <Icon size={22} />
            </div>
            <p className="text-slate-500 text-sm italic max-w-xs">{message}</p>
        </div>
    );
}
