import { Clock, CheckCircle, ShoppingCart, XCircle, type LucideIcon } from 'lucide-react';
import type { QuoteStatus } from '@/lib/types';

export interface StatusBadgeConfig {
    label: string;
    color: string;
    icon: LucideIcon;
}

export const STATUS_CONFIG: Record<QuoteStatus, StatusBadgeConfig> = {
    draft: { label: 'Borrador', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    in_delivery: { label: 'En reparto', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: ShoppingCart },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
    completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
};
