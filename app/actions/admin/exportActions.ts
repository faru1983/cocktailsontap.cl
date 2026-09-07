'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabaseServer';
import { validateSession } from '@/lib/adminAuth';
import {
    ExportConfigSchema,
    parseExportConfig,
    type ExportConfig,
} from '@/lib/exportSchemas';
import {
    buildExportFilename,
    countExportRows,
    previewExportData,
    runExport,
    serializeExport,
} from '@/lib/services/exportService';

async function checkAuth() {
    const isAuth = await validateSession();
    if (!isAuth) throw new Error('No autorizado. Sesión inválida.');
}

function slugify(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'preset';
}

export async function previewExport(raw: ExportConfig): Promise<{
    success: boolean;
    error?: string;
    rows?: Record<string, string>[];
    headers?: string[];
    columnKeys?: string[];
    total?: number;
}> {
    try {
        await checkAuth();
        const parsed = parseExportConfig(raw);
        if (!parsed.success) return { success: false, error: parsed.error };

        const { rows, headers, columnKeys, total } = await previewExportData(parsed.data);
        return { success: true, rows, headers, columnKeys, total };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al generar vista previa';
        return { success: false, error: msg };
    }
}

export async function getExportRowCount(raw: ExportConfig): Promise<{
    success: boolean;
    error?: string;
    total?: number;
}> {
    try {
        await checkAuth();
        const parsed = parseExportConfig(raw);
        if (!parsed.success) return { success: false, error: parsed.error };

        const total = await countExportRows(parsed.data);
        return { success: true, total };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al contar registros';
        return { success: false, error: msg };
    }
}

export async function generateExportFile(raw: ExportConfig): Promise<{
    success: boolean;
    error?: string;
    content?: string;
    mimeType?: string;
    filename?: string;
}> {
    try {
        await checkAuth();
        const parsed = parseExportConfig(raw);
        if (!parsed.success) return { success: false, error: parsed.error };

        const config = parsed.data;
        const { rows, headers, columnKeys } = await runExport(config);
        const serialized = serializeExport(rows, columnKeys, headers, config.format);

        return {
            success: true,
            content: serialized.content,
            mimeType: serialized.mimeType,
            filename: buildExportFilename(config),
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al generar export';
        return { success: false, error: msg };
    }
}

export async function saveExportPreset(name: string, raw: ExportConfig): Promise<{
    success: boolean;
    error?: string;
    id?: string;
}> {
    try {
        await checkAuth();
        const trimmed = name.trim();
        if (trimmed.length < 2) return { success: false, error: 'Nombre demasiado corto' };

        const parsed = ExportConfigSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || 'Configuración inválida' };
        }

        const id = slugify(trimmed);
        const key = `export_preset_${id}`;
        const db = createServerClient();

        const { error } = await db.from('site_settings').upsert(
            {
                key,
                value: JSON.stringify(parsed.data),
                category: 'exports',
                description: trimmed,
                is_active: true,
            },
            { onConflict: 'key' }
        );

        if (error) {
            console.error('saveExportPreset:', error);
            return { success: false, error: 'No se pudo guardar el preset' };
        }

        revalidatePath('/admin/exportar');
        return { success: true, id };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al guardar preset';
        return { success: false, error: msg };
    }
}

export async function deleteExportPreset(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await checkAuth();
        const slug = slugify(id);
        const db = createServerClient();
        const { error } = await db
            .from('site_settings')
            .delete()
            .eq('key', `export_preset_${slug}`);

        if (error) {
            console.error('deleteExportPreset:', error);
            return { success: false, error: 'No se pudo eliminar el preset' };
        }

        revalidatePath('/admin/exportar');
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al eliminar preset';
        return { success: false, error: msg };
    }
}
