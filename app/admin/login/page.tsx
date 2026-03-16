'use client';

import { useActionState } from 'react';
import { adminLogin } from '@/app/actions/admin/authActions';

const initialState = { error: undefined };

export default function AdminLoginPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string }>;
}) {
    const [state, formAction, isPending] = useActionState(
        async (_: any, formData: FormData) => {
            return adminLogin(formData);
        },
        initialState
    );

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Outfit', -apple-system, sans-serif",
            padding: '24px',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
            }}>
                {/* Logo / Brand */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '64px', height: '64px',
                        background: 'linear-gradient(135deg, #E2A049, #c8872e)',
                        borderRadius: '20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        fontSize: '28px',
                        boxShadow: '0 8px 32px rgba(226, 160, 73, 0.35)',
                    }}>🍸</div>
                    <h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>
                        Business Control Center
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                        Cocktails on Tap — Acceso Administrativo
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '36px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                }}>
                    <form action={formAction}>
                        <input type="hidden" name="from" value="" />

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                color: '#94a3b8',
                                fontSize: '12px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginBottom: '8px',
                            }}>
                                Contraseña de Acceso
                            </label>
                            <input
                                type="password"
                                name="password"
                                required
                                autoFocus
                                placeholder="••••••••••••"
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: state?.error ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: '#ffffff',
                                    fontSize: '16px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxSizing: 'border-box',
                                    fontFamily: 'inherit',
                                }}
                            />
                            {state?.error && (
                                <p style={{ color: '#f87171', fontSize: '13px', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ⚠️ {state.error}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: isPending
                                    ? 'rgba(226,160,73,0.5)'
                                    : 'linear-gradient(135deg, #E2A049, #c8872e)',
                                color: '#ffffff',
                                fontSize: '15px',
                                fontWeight: 800,
                                border: 'none',
                                borderRadius: '12px',
                                cursor: isPending ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                letterSpacing: '0.3px',
                                boxShadow: '0 4px 16px rgba(226,160,73,0.3)',
                                fontFamily: 'inherit',
                            }}
                        >
                            {isPending ? 'Verificando…' : 'Ingresar al Panel →'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', color: '#334155', fontSize: '11px', marginTop: '24px' }}>
                    Acceso restringido · Solo personal autorizado
                </p>
            </div>
        </div>
    );
}
