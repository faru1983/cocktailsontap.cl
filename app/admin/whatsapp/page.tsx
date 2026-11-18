import { requireAdmin } from '@/lib/adminAuth';
import { WHATSAPP_LABEL } from '@/lib/config';
import {
    getWhatsappNotificationSettings,
    isDeskcommConfigured,
    listWhatsappNotificationLogs,
} from '@/lib/services/deskcommService';
import WhatsappClient from './WhatsappClient';

export default async function AdminWhatsappPage() {
    await requireAdmin();

    const [settings, logs] = await Promise.all([
        getWhatsappNotificationSettings(),
        listWhatsappNotificationLogs(100),
    ]);
    const connection = isDeskcommConfigured();

    return (
        <WhatsappClient
            initialSettings={settings}
            initialLogs={logs}
            connection={connection}
            whatsappLabel={WHATSAPP_LABEL}
        />
    );
}
