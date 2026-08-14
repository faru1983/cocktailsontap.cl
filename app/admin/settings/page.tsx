import { createServerClient } from '@/lib/supabaseServer';
import SettingsClient from './SettingsClient';

async function getSettings() {
    const db = createServerClient();
    const [settingsRes, eventRes, regionsRes, comunasRes, siteSettingsRes] = await Promise.all([
        db.from('admin_settings').select('key, value'),
        db.from('event_types').select('*').order('display_order', { ascending: true }),
        db.from('regions').select('*').order('display_order', { ascending: true }),
        db.from('comunas').select('*').order('display_order', { ascending: true }),
        db.from('site_settings').select('*').order('category', { ascending: true })
    ]);

    const data = settingsRes.data || [];
    const map: Record<string, string> = {};
    data.forEach((r: any) => { map[r.key] = r.value; });

    return { 
        reviewMode: map['review_mode'] || 'manual', 
        reviewTemplate: map['review_template'] || '',
        reviewLink: map['review_link'] || '',
        eventTypes: eventRes.data || [],
        regions: regionsRes.data || [],
        comunas: comunasRes.data || [],
        siteSettings: siteSettingsRes.data || []
    };
}

export default async function SettingsPage() {
    const data = await getSettings();
    return <SettingsClient {...data} />;
}
