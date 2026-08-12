import { createServerClient } from '@/lib/supabaseServer';
import {
    getReminderCronSettings,
    listAnniversaryPendings,
    listRecentReminderLogs,
    listSuppressions,
} from '@/lib/services/reminderService';
import { formatVercelDailyCronTimeCL } from '@/lib/utils';
import RemindersClient from './RemindersClient';

type SearchParams = Promise<{ tab?: string }>;

export default async function RemindersPage({ searchParams }: { searchParams: SearchParams }) {
    const { tab } = await searchParams;
    const db = createServerClient();

    const [
        { data: quotes },
        { data: templates },
        suppressions,
        logs,
        cronSettings,
        anniversaryQuotes,
    ] = await Promise.all([
        db
            .from('quotes')
            .select('*, reminder_logs(sent_at, template_id, channel, status)')
            .eq('status', 'draft')
            .not('event_date', 'is', null)
            .order('event_date', { ascending: true }),
        db.from('reminder_templates').select('*').order('created_at', { ascending: false }),
        listSuppressions(),
        listRecentReminderLogs(150),
        getReminderCronSettings(),
        listAnniversaryPendings(),
    ]);

    return (
        <RemindersClient
            initialQuotes={quotes || []}
            initialAnniversaryQuotes={anniversaryQuotes}
            initialTemplates={templates || []}
            initialSuppressions={suppressions}
            initialLogs={logs}
            initialCron={cronSettings}
            initialTab={tab}
            cronChileTime={formatVercelDailyCronTimeCL()}
        />
    );
}
