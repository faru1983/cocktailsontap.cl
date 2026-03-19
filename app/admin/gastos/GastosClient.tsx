'use client';

import React, { useState, useMemo } from 'react';
import { PlusCircle, Search, CreditCard, Smartphone, Banknote, Trash2, CalendarDays, Tag } from 'lucide-react';
import { addExpense, deleteExpense } from '@/app/actions/admin/gastosActions';

interface Category { id: string; name: string; is_active: boolean; }
interface Subcategory { id: string; category_id: string; name: string; is_active: boolean; }
interface Expense {
    id: string;
    amount: number;
    expense_date: string;
    payment_method: string;
    notes: string;
    category_name: string;
    subcategory_name: string;
}

export default function GastosClient({ 
    categories, 
    subcategories, 
    initialExpenses 
}: { 
    categories: Category[]; 
    subcategories: Subcategory[]; 
    initialExpenses: Expense[];
}) {
    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form state
    const [amount, setAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('Transferencia');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
    const [notes, setNotes] = useState('');

    // Derived
    const filteredSubcategories = useMemo(() => {
        if (!selectedCategoryId) return [];
        return subcategories.filter(sub => sub.category_id === selectedCategoryId);
    }, [selectedCategoryId, subcategories]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !selectedCategoryId || !selectedSubcategoryId) return;
        setIsLoading(true);

        try {
            await addExpense({
                amount: Number(amount),
                payment_method: paymentMethod,
                expense_date: expenseDate,
                category_id: selectedCategoryId,
                subcategory_id: selectedSubcategoryId,
                notes
            });
            // Update local state optimisticially or just reload the window?
            // Next.js Server Actions with revalidatePath will refresh the route when the modal closes or just by doing a router.refresh()
            window.location.reload(); 
        } catch (error) {
            console.error(error);
            alert('Error al guardar el gasto.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este gasto? Esto afectará tus estadísticas.')) return;
        try {
            await deleteExpense(id);
            setExpenses(prev => prev.filter(e => e.id !== id));
        } catch (er) {
            console.error(er);
            alert('Error al eliminar');
        }
    };

    const getPaymentIcon = (method: string) => {
        if (method === 'Tarjeta') return <CreditCard size={14} />;
        if (method === 'Efectivo') return <Banknote size={14} />;
        return <Smartphone size={14} />;
    };

    return (
        <div style={{ paddingBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 800, margin: 0 }}>💸 Gastos</h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0' }}>Registra y controla tus costos operativos.</p>
                </div>
                <button 
                    onClick={() => {
                        setSelectedCategoryId('');
                        setSelectedSubcategoryId('');
                        setAmount('');
                        setNotes('');
                        setIsModalOpen(true);
                    }}
                    style={{
                        background: '#E2A049', color: '#111827', border: 'none', borderRadius: '12px',
                        padding: '12px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(226,160,73,0.3)'
                    }}
                >
                    <PlusCircle size={18} /> Nuevo Gasto
                </button>
            </div>

            {/* Lista Historial */}
            <div style={{ background: '#1e2433', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '16px', fontWeight: 600 }}>Últimos Gastos Registrados</h3>
                </div>
                {expenses.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Aún no hay gastos registrados.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>Fecha</th>
                                <th style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>Categoría</th>
                                <th style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>Monto</th>
                                <th style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>Medio</th>
                                <th style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map(exp => (
                                <tr key={exp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '16px 20px', color: '#f1f5f9', fontSize: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CalendarDays size={14} color="#94a3b8"/> {new Date(exp.expense_date).toLocaleDateString('es-CL')}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>{exp.subcategory_name}</div>
                                        <div style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}><Tag size={12}/> {exp.category_name}</div>
                                        {exp.notes && <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px', fontStyle: 'italic' }}>"{exp.notes}"</div>}
                                    </td>
                                    <td style={{ padding: '16px 20px', color: '#f43f5e', fontSize: '14px', fontWeight: 700 }}>
                                        - {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(exp.amount)}
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>
                                            {getPaymentIcon(exp.payment_method)} {exp.payment_method}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                        <button onClick={() => handleDelete(exp.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }} title="Eliminar Gasto">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Ingreso Rápido (Optimizado para Celular) */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => !isLoading && setIsModalOpen(false)} />
                    
                    <div style={{ position: 'relative', width: '100%', maxWidth: '450px', background: '#1e2433', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <h2 style={{ margin: '0 0 20px 0', color: '#f1f5f9', fontSize: '20px', fontWeight: 700 }}>Nuevo Gasto</h2>
                        
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Monto Grande */}
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Monto a Pagar ($)</label>
                                <input 
                                    type="number" required min="1"
                                    value={amount} onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0"
                                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: '#f1f5f9', fontSize: '24px', fontWeight: 800, outline: 'none' }}
                                />
                            </div>

                            {/* Fecha */}
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Fecha del Gasto</label>
                                <input 
                                    type="date" required
                                    value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }}
                                />
                            </div>

                            {/* Categoría (Familia) */}
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Tipo de Gasto (Familia)</label>
                                <select 
                                    required value={selectedCategoryId} 
                                    onChange={(e) => { setSelectedCategoryId(e.target.value); setSelectedSubcategoryId(''); }}
                                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#f1f5f9', fontSize: '14px', outline: 'none', appearance: 'none' }}
                                >
                                    <option value="" disabled>Selecciona la familia...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            {/* Subcategoría (Item Específico) */}
                            {selectedCategoryId && (
                                <div>
                                    <label style={{ display: 'block', color: '#E2A049', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Ítem Específico</label>
                                    <select 
                                        required value={selectedSubcategoryId} 
                                        onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(226,160,73,0.05)', border: '1px solid rgba(226,160,73,0.3)', borderRadius: '12px', padding: '12px', color: '#f1f5f9', fontSize: '14px', outline: 'none', appearance: 'none' }}
                                    >
                                        <option value="" disabled>¿Qué pagaste exactamente?</option>
                                        {filteredSubcategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Método de Pago (Radio Cards) */}
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>¿Cómo lo pagaste?</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {['Transferencia', 'Tarjeta', 'Efectivo'].map(method => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => setPaymentMethod(method)}
                                            style={{
                                                padding: '10px 4px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                                background: paymentMethod === method ? 'rgba(59,130,246,0.15)' : '#0f172a',
                                                border: paymentMethod === method ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)',
                                                color: paymentMethod === method ? '#3b82f6' : '#94a3b8',
                                            }}
                                        >
                                            {getPaymentIcon(method)}
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Nota Opcional */}
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Nota / Descripción (Opcional)</label>
                                <input 
                                    type="text"
                                    value={notes} onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ej. Bencina evento Falabella"
                                    maxLength={80}
                                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="button" onClick={() => !isLoading && setIsModalOpen(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontWeight: 600, cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isLoading || !amount || !selectedSubcategoryId} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#E2A049', color: '#111827', fontWeight: 700, cursor: (isLoading || !amount || !selectedSubcategoryId) ? 'not-allowed' : 'pointer', opacity: (isLoading || !amount || !selectedSubcategoryId) ? 0.6 : 1 }}>
                                    {isLoading ? 'Guardando...' : 'Guardar Gasto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
