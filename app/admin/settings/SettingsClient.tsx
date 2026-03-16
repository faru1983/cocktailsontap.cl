'use client';

import { useState, useTransition } from 'react';
import { saveAdminSettings } from '@/app/actions/admin/adminActions';

export default function SettingsClient({ reviewMode, reviewTemplate }: { reviewMode: string; reviewTemplate: string }) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const [mode, setMode] = useState(reviewMode);
    const [template, setTemplate] = useState(reviewTemplate);

    const handleSave = (formData: FormData) => {
        startTransition(async () => {
            const res = await saveAdminSettings(formData);
            if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        });
    };

    return (
        <div>
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 4px' }}>Configuración</h1>
                <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Módulo de Post-Venta y Review</p>
            </div>

            <div style={{ background: '#1e2433', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '28px', maxWidth: '640px' }}>
                <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700, margin: '0 0 20px' }}>⭐ Email de Review / Agradecimiento</h2>
                <form action={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Mode */}
                    <div>
                        <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                            Modo de envío
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {[{ v: 'manual', l: 'Manual (botón en la cotización)' }, { v: 'auto', l: 'Automático (al marcar Completada)' }].map(opt => (
                                <label key={opt.v} style={{
                                    flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer',
                                    border: `2px solid ${mode === opt.v ? '#E2A049' : 'rgba(255,255,255,0.08)'}`,
                                    background: mode === opt.v ? 'rgba(226,160,73,0.08)' : 'rgba(255,255,255,0.03)',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                }}>
                                    <input type="radio" name="review_mode" value={opt.v} checked={mode === opt.v} onChange={() => setMode(opt.v)} style={{ accentColor: '#E2A049' }} />
                                    <span style={{ color: mode === opt.v ? '#E2A049' : '#94a3b8', fontSize: '13px', fontWeight: 600 }}>{opt.l}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Template */}
                    <div>
                        <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                            Mensaje del Email <span style={{ color: '#475569' }}>· Usa {'{nombre}'} para el nombre del cliente</span>
                        </label>
                        <textarea
                            name="review_template"
                            value={template}
                            onChange={e => setTemplate(e.target.value)}
                            rows={8}
                            style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
                        />
                        <p style={{ color: '#475569', fontSize: '12px', margin: '6px 0 0' }}>
                            El botón de "Dejar reseña en Google" se añade automáticamente al final del mensaje.
                        </p>
                    </div>

                    <button type="submit" disabled={isPending} style={{ alignSelf: 'flex-start', padding: '11px 22px', background: saved ? 'rgba(52,211,153,0.8)' : 'linear-gradient(135deg, #E2A049, #c8872e)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                        {isPending ? 'Guardando…' : saved ? '✅ Guardado' : 'Guardar Configuración'}
                    </button>
                </form>
            </div>
        </div>
    );
}
