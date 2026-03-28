import { createServerClient } from '@/lib/supabaseServer';
import SettingsClient from './SettingsClient';

async function getSettings() {
    const db = createServerClient();
    const [settingsRes, eventRes, comunasRes] = await Promise.all([
        db.from('admin_settings').select('key, value'),
        db.from('event_types').select('*').order('display_order', { ascending: true }),
        db.from('comunas').select('*').order('display_order', { ascending: true })
    ]);

    const data = settingsRes.data || [];
    const map: Record<string, string> = {};
    data.forEach((r: any) => { map[r.key] = r.value; });

    return { 
        reviewMode: map['review_mode'] || 'manual', 
        reviewTemplate: map['review_template'] || '',
        reviewLink: map['review_link'] || 'https://cocktailsontap.cl/google',
        eventTypes: eventRes.data || [],
        comunas: comunasRes.data || []
    };
}

export default async function SettingsPage() {
    const data = await getSettings();
    return <SettingsClient {...data} />;
}
