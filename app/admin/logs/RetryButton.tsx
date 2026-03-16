'use client';

import { useTransition, useState } from 'react';
import { retrySyncLog } from '@/app/actions/admin/adminActions';

export default function RetryButton({ logId }: { logId: string }) {
    const [isPending, startTransition] = useTransition();
    const [done, setDone] = useState(false);

    const handleRetry = () => {
        startTransition(async () => {
            const res = await retrySyncLog(logId);
            if (res.success) setDone(true);
        });
    };

    if (done) return <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 600 }}>✅ Reintentado</span>;

    return (
        <button onClick={handleRetry} disabled={isPending} style={{
            padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            opacity: isPending ? 0.5 : 1,
        }}>
            {isPending ? '…' : '↻ Reintentar'}
        </button>
    );
}
