import { createServerClient } from '@/lib/supabaseServer';
import SettingsClient from './SettingsClient';

async function getSettings() {
    const db = createServerClient();
    const { data } = await db.from('admin_settings').select('key, value');
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    return { reviewMode: map['review_mode'] || 'manual', reviewTemplate: map['review_template'] || '' };
}

export default async function SettingsPage() {
    const { reviewMode, reviewTemplate } = await getSettings();
    return <SettingsClient reviewMode={reviewMode} reviewTemplate={reviewTemplate} />;
}
