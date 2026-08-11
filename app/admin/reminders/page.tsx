import { createServerClient } from '@/lib/supabaseServer';
import {
    getReminderCronSettings,
    listRecentReminderLogs,
    listSuppressions,
} from '@/lib/services/reminderService';
import RemindersClient from './RemindersClient';

export default async function RemindersPage() {
    const db = createServerClient();

    const [{ data: quotes }, { data: templates }, suppressions, logs, cronSettings] =
        await Promise.all([
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
        ]);

    return (
        <RemindersClient
            initialQuotes={quotes || []}
            initialTemplates={templates || []}
            initialSuppressions={suppressions}
            initialLogs={logs}
            initialCron={cronSettings}
        />
    );
}
