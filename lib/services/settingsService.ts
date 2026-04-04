import { createServerClient } from '@/lib/supabaseServer';

export interface SiteSetting {
    id: string;
    key: string;
    value: string;
    category: string;
    is_active: boolean;
    description: string | null;
}

export class SettingsService {
    /**
     * Obtiene una configuración específica de la base de datos.
     */
    static async getSetting(key: string): Promise<SiteSetting | null> {
        try {
            const db = createServerClient();
            const { data, error } = await db
                .from('site_settings')
                .select('*')
                .eq('key', key)
                .single();

            if (error) {
                console.error(`Error fetching setting ${key}:`, error);
                return null;
            }
            return data;
        } catch (err) {
            console.error(`Unexpected error fetching setting ${key}:`, err);
            return null;
        }
    }

    /**
     * Obtiene todas las configuraciones de una categoría.
     */
    static async getByCategory(category: string): Promise<SiteSetting[]> {
        try {
            const db = createServerClient();
            const { data, error } = await db
                .from('site_settings')
                .select('*')
                .eq('category', category);

            if (error) {
                console.error(`Error fetching settings for category ${category}:`, error);
                return [];
            }
            return data || [];
        } catch (err) {
            console.error(`Unexpected error fetching settings for category ${category}:`, err);
            return [];
        }
    }

    /**
     * Reemplaza variables en una plantilla usando un objeto de datos.
     * Ejemplo: template "Hola {{nombre}}" con {nombre: "Juan"} -> "Hola Juan"
     */
    static resolveTemplate(template: string, variables: Record<string, any>): string {
        return template.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
            const val = variables[key.trim()];
            return val !== undefined ? String(val) : match;
        });
    }

    /**
     * Método de conveniencia para obtener un valor resuelto directamente.
     * Si no encuentra la configuración o está desactivada, devuelve un fallback (opcional).
     */
    static async getResolvedValue(key: string, variables: Record<string, any>, fallback?: string): Promise<string> {
        const setting = await this.getSetting(key);
        if (!setting || !setting.is_active) {
            return fallback || '';
        }
        return this.resolveTemplate(setting.value, variables);
    }
}
