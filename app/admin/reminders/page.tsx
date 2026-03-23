import { createServerClient } from '@/lib/supabaseServer';
import RemindersClient from './RemindersClient';

export default async function RemindersPage() {
    const db = createServerClient();
    
    // Fetch draft quotes with future event dates
    const { data: quotes } = await db
        .from('quotes')
        .select('*, reminder_logs(sent_at, template_id, channel)')
        .eq('status', 'draft')
        .not('event_date', 'is', null)
        .order('event_date', { ascending: true });

    // Fetch templates
    const { data: templates } = await db
        .from('reminder_templates')
        .select('*')
        .order('created_at', { ascending: false });

    return <RemindersClient initialQuotes={quotes || []} initialTemplates={templates || []} />;
}
