'use client';

import { useState, useTransition } from 'react';
import { saveAdminSettings } from '@/app/actions/admin/adminActions';

export default function SettingsClient({ reviewMode, reviewTemplate, reviewLink }: { reviewMode: string; reviewTemplate: string; reviewLink: string }) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const [mode, setMode] = useState(reviewMode);
    const [template, setTemplate] = useState(reviewTemplate);
    const [link, setLink] = useState(reviewLink);

    const handleSave = (formData: FormData) => {
        startTransition(async () => {
            const res = await saveAdminSettings(formData);
            if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        });
    };

    const [testEmail, setTestEmail] = useState('');
    const [testResult, setTestResult] = useState<{ s: boolean; m: string } | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    const handleTest = async () => {
        if (!testEmail) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            const { sendTestReviewEmail } = await import('@/app/actions/admin/adminActions');
            const res = await sendTestReviewEmail(testEmail, template, link);
            if (res.success) {
                setTestResult({ s: true, m: 'Email de prueba enviado.' });
                setTimeout(() => setTestResult(null), 4000);
            } else {
                setTestResult({ s: false, m: res.error || 'Error al enviar.' });
            }
        } catch (e) {
            setTestResult({ s: false, m: 'Error de conexión.' });
        } finally {
            setIsTesting(false);
        }
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
                    {/* Review Link */}
                    <div>
                        <label style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                            Link de Reseña (Google/TripAdvisor/etc)
                        </label>
                        <input
                            type="url"
                            name="review_link"
                            value={link}
                            onChange={e => setLink(e.target.value)}
                            placeholder="https://g.page/r/your-code/review"
                            style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        />
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

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <button type="submit" disabled={isPending} style={{ padding: '11px 22px', background: saved ? 'rgba(52,211,153,0.8)' : 'linear-gradient(135deg, #E2A049, #c8872e)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                            {isPending ? 'Guardando…' : saved ? '✅ Guardado' : 'Guardar Configuración'}
                        </button>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                                type="email" 
                                placeholder="Email de prueba…" 
                                value={testEmail}
                                onChange={e => setTestEmail(e.target.value)}
                                style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px', outline: 'none', width: '180px' }}
                            />
                            <button 
                                type="button" 
                                onClick={handleTest}
                                disabled={isTesting || !testEmail}
                                style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                {isTesting ? 'Enviando…' : 'Enviar Prueba'}
                            </button>
                        </div>
                    </div>
                    {testResult && (
                        <div style={{ fontSize: '12px', fontWeight: 600, color: testResult.s ? '#34d399' : '#f87171', marginTop: '-12px', textAlign: 'right' }}>
                            {testResult.m}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
