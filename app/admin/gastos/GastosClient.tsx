'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    PlusCircle, CreditCard, Smartphone, Banknote, Trash2, CalendarDays, 
    Tag, Edit2, X, Plus, ChevronUp, ChevronDown, Settings, ListFilter,
    Check, Wallet, ArrowRight, ShieldCheck, HelpCircle, FolderPlus, 
    MoreHorizontal, Search, MessageSquare, AlertCircle, Pencil
} from 'lucide-react';
import { 
    addExpense, deleteExpense, updateExpense,
    addExpenseCategory, updateExpenseCategory,
    addExpenseSubcategory, updateExpenseSubcategory,
    addPaymentMethod, updatePaymentMethod, deletePaymentMethod
} from '@/app/actions/admin/gastosActions';

interface Category { id: string; name: string; is_active: boolean; }
interface Subcategory { id: string; category_id: string; name: string; is_active: boolean; }
interface PaymentMethod { id: string; name: string; is_active: boolean; }
interface Expense {
    id: string;
    amount: number;
    expense_date: string;
    payment_method: string;
    notes: string;
    category_name: string;
    subcategory_name: string;
    category_id: string;
    subcategory_id: string;
}

const getPaymentIcon = (method: string) => {
    if (method === 'Tarjeta') return <CreditCard size={18} />;
    if (method === 'Efectivo') return <Banknote size={18} />;
    return <Smartphone size={18} />;
};

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

export default function GastosClient({ 
    categories, 
    subcategories, 
    initialExpenses,
    paymentMethods 
}: { 
    categories: Category[]; 
    subcategories: Subcategory[]; 
    initialExpenses: Expense[];
    paymentMethods: PaymentMethod[];
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [tab, setTab] = useState<'list' | 'cats' | 'pay'>((searchParams.get('tab') as any) || 'list');

    useEffect(() => {
        const currentTab = searchParams.get('tab');
        if (currentTab !== tab) {
            const params = new URLSearchParams(searchParams);
            params.set('tab', tab);
            router.replace(`/admin/gastos?${params.toString()}`, { scroll: false });
        }
    }, [tab, router, searchParams]);

    const [expenses, setExpenses] = useState(initialExpenses);
    const [filterCat, setFilterCat] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    const [newCatName, setNewCatName] = useState('');
    const [newSubName, setNewSubName] = useState('');
    const [selectedCatForSub, setSelectedCatForSub] = useState('');
    const [newPayName, setNewPayName] = useState('');

    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editingCatName, setEditingCatName] = useState('');
    
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [editingSubName, setEditingSubName] = useState('');

    const [editingPayId, setEditingPayId] = useState<string | null>(null);
    const [editingPayName, setEditingPayName] = useState('');

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const matchesCat = !filterCat || e.category_id === filterCat;
            const matchesSearch = !searchTerm || 
                e.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.subcategory_name?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [expenses, filterCat, searchTerm]);

    const handleOpenCreate = (expense: Expense | null = null) => {
        setEditingExpense(expense);
        setIsCreateOpen(true);
    };

    const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = {
            amount: Number(fd.get('amount')),
            payment_method: String(fd.get('payment_method')),
            expense_date: String(fd.get('expense_date')),
            category_id: String(fd.get('category_id')),
            subcategory_id: String(fd.get('subcategory_id')),
            notes: String(fd.get('notes') || '')
        };
        startTransition(async () => {
            let res;
            if (editingExpense) res = await updateExpense(editingExpense.id, data);
            else res = await addExpense(data);

            if (res.success) {
                if (editingExpense) {
                   router.refresh(); 
                } else {
                   const newExp = (res as any).data;
                   if (newExp) setExpenses([newExp, ...expenses]);
                   else router.refresh();
                }
                setIsCreateOpen(false);
                setEditingExpense(null);
            } else if ((res as any).error) {
                alert((res as any).error);
            }
        });
    };

    const handleDeleteExpense = (id: string) => {
        if (!confirm('¿Eliminar este gasto permanentemente?')) return;
        startTransition(async () => {
            const res = await deleteExpense(id);
            if (res.success) setExpenses(expenses.filter(e => e.id !== id));
        });
    };

    const refreshData = () => router.refresh();

    const handleAddCat = async () => {
        if (!newCatName) return;
        startTransition(async () => {
            const res = await addExpenseCategory(newCatName);
            if (res.success) { setNewCatName(''); refreshData(); }
            else if ((res as any).error) alert((res as any).error);
        });
    };

    const handleAddSub = async () => {
        if (!newSubName || !selectedCatForSub) return;
        startTransition(async () => {
            const res = await addExpenseSubcategory(selectedCatForSub, newSubName);
            if (res.success) { setNewSubName(''); refreshData(); }
            else if ((res as any).error) alert((res as any).error);
        });
    };

    const toggleCat = (cat: Category) => {
        const msg = cat.is_active ? `¿Deseas DESACTIVAR la categoría "${cat.name}"? Los productos asociados seguirán existiendo pero no podrán seleccionarse en nuevos gastos.` : `¿Reactivar categoría "${cat.name}"?`;
        if (!confirm(msg)) return;
        startTransition(async () => {
            const res = await updateExpenseCategory(cat.id, { is_active: !cat.is_active });
            if (res.success) refreshData();
        });
    };

    const handleEditCat = (cat: Category) => {
        setEditingCatId(cat.id);
        setEditingCatName(cat.name);
    };

    const saveCatName = async (id: string) => {
        if (!editingCatName) return setEditingCatId(null);
        startTransition(async () => {
            const res = await updateExpenseCategory(id, { name: editingCatName });
            if (res.success) { setEditingCatId(null); refreshData(); }
        });
    };

    const handleEditSub = (sub: Subcategory) => {
        setEditingSubId(sub.id);
        setEditingSubName(sub.name);
    };

    const saveSubName = async (id: string) => {
        if (!editingSubName) return setEditingSubId(null);
        startTransition(async () => {
            const res = await updateExpenseSubcategory(id, { name: editingSubName });
            if (res.success) { setEditingSubId(null); refreshData(); }
        });
    };

    const toggleSub = (sub: Subcategory) => {
        const msg = sub.is_active ? `¿Deseas DESACTIVAR el ítem "${sub.name}"?` : `¿Reactivar ítem "${sub.name}"?`;
        if (!confirm(msg)) return;
        startTransition(async () => {
            const res = await updateExpenseSubcategory(sub.id, { is_active: !sub.is_active });
            if (res.success) refreshData();
        });
    };

    const handleAddPay = async () => {
        if (!newPayName) return;
        startTransition(async () => {
            const res = await addPaymentMethod(newPayName);
            if (res.success) { setNewPayName(''); refreshData(); }
        });
    };

    const handleEditPay = (pm: PaymentMethod) => {
        setEditingPayId(pm.id);
        setEditingPayName(pm.name);
    };

    const savePayName = async (id: string) => {
        if (!editingPayName) return setEditingPayId(null);
        startTransition(async () => {
            const res = await updatePaymentMethod(id, { name: editingPayName });
            if (res.success) { setEditingPayId(null); refreshData(); }
        });
    };

    const togglePay = (pm: PaymentMethod) => {
        const msg = pm.is_active ? `¿Desactivar el medio de pago "${pm.name}"?` : `¿Reactivar medio de pago "${pm.name}"?`;
        if (!confirm(msg)) return;
        startTransition(async () => {
            const res = await updatePaymentMethod(pm.id, { is_active: !pm.is_active });
            if (res.success) refreshData();
        });
    };

    return (
        <div style={{ paddingBottom: '60px' }}>
            <style>{`
                .gp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
                .gp-title h1 { color: #f1f5f9; fontSize: 24px; fontWeight: 900; margin: 0 0 4px; }
                .gp-title p { color: #475569; fontSize: 13px; margin: 0; }
                
                .simple-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 20px; transition: border-color 0.2s; }
                .simple-card:hover { border-color: rgba(226,160,73,0.3); }

                .tabs-row { 
                    display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.06); 
                    padding-bottom: 12px; overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; 
                }
                .tabs-row::-webkit-scrollbar { display: none; }
                .tab-btn { padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: #64748b; background: none; border: none; transition: all 0.2s; white-space: nowrap; }
                .tab-btn.active { background: rgba(226,160,73,0.12); color: #E2A049; }
                
                .gp-table-wrap { display: none; background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; margin-top: 16px; }
                .gp-cards { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
                .gp-card { background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 16px; }
                
                .gp-table th { padding: 12px 20px; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .gp-table td { padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.03); color: #94a3b8; font-size: 13px; }

                @media(min-width: 768px) { 
                    .gp-table-wrap { display: block; } 
                    .gp-cards { display: none !important; } 
                }
                
                .btn-primary { background: #E2A049; color: #1a1b26; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; transition: transform 0.2s; }
                .btn-primary:active { transform: scale(0.96); }
                
                .input-field { background: #00000033; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: #fff; outline: none; font-size: 14px; width: 100%; transition: border 0.2s; }
                .input-field:focus { border-color: #E2A049; }
                
                .cat-tile { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; transition: all 0.2s; }
                .cat-tile:hover { background: rgba(255,255,255,0.04); }
                .cat-tile.inactive { opacity: 0.4; filter: grayscale(0.8); }

                .item-btn { 
                    font-size: 11px; padding: 6px 12px; display: flex; align-items: center; gap: 8px;
                    background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05);
                    color: #f1f5f9; border-radius: 8px; cursor: pointer; transition: all 0.15s;
                }
                .item-btn:hover { border-color: #E2A049; background: rgba(226,160,73,0.05); }
                .item-btn.inactive { color: #f87171; border-color: rgba(248,113,113,0.2); background: rgba(248,113,113,0.02); }
            `}</style>

            <div className="gp-header">
                <div className="gp-title">
                    <h1>Gestión de Gastos</h1>
                    <p>Administra desembolsos y configura familias de costos</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenCreate()}>
                   + Declarar Gasto
                </button>
            </div>

            <div className="tabs-row">
                <button className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>Listado de Egresos</button>
                <button className={`tab-btn ${tab === 'cats' ? 'active' : ''}`} onClick={() => setTab('cats')}>Artículos & Familias</button>
                <button className={`tab-btn ${tab === 'pay' ? 'active' : ''}`} onClick={() => setTab('pay')}>Medios de Pago</button>
            </div>

            {tab === 'list' && (
                <div className="animate-fade-in">
                    {/* Filters Row */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <select className="input-field" style={{ flex: '1', minWidth: '160px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                            <option value="">Todas las Categorías</option>
                            {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <input className="input-field" style={{ flex: '2', minWidth: '200px' }} placeholder="Buscar en notas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="gp-table-wrap">
                        <table className="gp-table" width="100%" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th align="left">Fecha</th>
                                    <th align="left">Familia / Sub</th>
                                    <th align="left">Medio</th>
                                    <th align="left">Monto</th>
                                    <th align="left">Notas</th>
                                    <th align="right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.map(e => (
                                    <tr key={e.id}>
                                        <td>{new Date(e.expense_date + 'T12:00:00').toLocaleDateString('es-CL')}</td>
                                        <td>
                                            <div style={{ color: '#E2A049', fontWeight: 700 }}>{e.category_name}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{e.subcategory_name}</div>
                                        </td>
                                        <td>{e.payment_method}</td>
                                        <td style={{ color: '#fff', fontWeight: 800 }}>{formatCLP(e.amount)}</td>
                                        <td title={e.notes}>{e.notes?.substring(0, 30)}{e.notes?.length > 30 ? '...' : ''}</td>
                                        <td align="right">
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => handleOpenCreate(e)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px' }}><Pencil size={16} /></button>
                                                <button onClick={() => handleDeleteExpense(e.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '8px' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="gp-cards">
                        {filteredExpenses.map(e => (
                            <div key={e.id} className="gp-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(e.expense_date + 'T12:00:00').toLocaleDateString('es-CL')}</div>
                                    <div style={{ color: '#E2A049', fontWeight: 800 }}>{formatCLP(e.amount)}</div>
                                </div>
                                <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700 }}>{e.category_name} &gt; {e.subcategory_name}</div>
                                {e.notes && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>{e.notes}</p>}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                                    <div style={{ color: '#475569', fontSize: '12px' }}>{e.payment_method}</div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={() => handleOpenCreate(e)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Pencil size={16}/></button>
                                        <button onClick={() => handleDeleteExpense(e.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'cats' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px' }}>
                        {/* Categories management */}
                        <div className="simple-card">
                            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: '#f1f5f9' }}>Familias de Gastos</h3>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                <input className="input-field" placeholder="Nueva Categoría (Ej: Ventas, Insumos)..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                                <button className="btn-primary" onClick={handleAddCat}>Añadir</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {categories.map(c => (
                                    <div key={c.id} className={`cat-tile ${!c.is_active ? 'inactive' : ''}`}>
                                        {editingCatId === c.id ? (
                                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                                <input className="input-field" style={{ padding: '6px 10px' }} value={editingCatName} onChange={e => setEditingCatName(e.target.value)} autoFocus />
                                                <button onClick={() => saveCatName(c.id)} style={{ color: '#34d399', background: 'none', border: 'none' }}><Check size={18}/></button>
                                                <button onClick={() => setEditingCatId(null)} style={{ color: '#f87171', background: 'none', border: 'none' }}><X size={18}/></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>{c.name}</span>
                                                    {!c.is_active && <span style={{ fontSize: '10px', background: '#f87171', color: '#fff', padding: '1px 6px', borderRadius: '4px' }}>INACTIVA</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <button onClick={() => handleEditCat(c)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={16}/></button>
                                                    <button onClick={() => toggleCat(c)} style={{ color: c.is_active ? '#f87171' : '#34d399', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                        {c.is_active ? <X size={18}/> : <Check size={18}/>}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Subcategories / Items */}
                        <div className="simple-card">
                            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: '#f1f5f9' }}>Subcategorías / Ítems</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 2fr auto', gap: '8px', marginBottom: '20px' }}>
                                <select className="input-field" value={selectedCatForSub} onChange={e => setSelectedCatForSub(e.target.value)}>
                                    <option value="">Elegir Categoría...</option>
                                    {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input className="input-field" placeholder="Nombre Ítem (Ej: Compra de Licor)..." value={newSubName} onChange={e => setNewSubName(e.target.value)} />
                                <button className="btn-primary" onClick={handleAddSub}>+</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                {categories.map(cat => (
                                    <div key={cat.id} style={{ background: 'rgba(0,0,0,0.1)', padding: '16px', borderRadius: '12px', opacity: cat.is_active ? 1 : 0.6, border: cat.is_active ? '1px solid transparent' : '1px dashed rgba(255,255,255,0.1)' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 900, color: cat.is_active ? '#E2A049' : '#64748b', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <FolderPlus size={12}/> {cat.name}
                                            </div>
                                            {!cat.is_active && <span style={{ fontSize: '9px', opacity: 0.5 }}>CATEGORÍA INACTIVA</span>}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {subcategories.filter(s => s.category_id === cat.id).map(sub => (
                                                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {editingSubId === sub.id ? (
                                                        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '8px', border: '1px solid #E2A049' }}>
                                                            <input className="input-field" style={{ padding: '2px 6px', fontSize: '11px', width: '100px' }} value={editingSubName} onChange={e => setEditingSubName(e.target.value)} autoFocus />
                                                            <button onClick={() => saveSubName(sub.id)} style={{ color: '#34d399', background: 'none', border: 'none' }}><Check size={14}/></button>
                                                            <button onClick={() => setEditingSubId(null)} style={{ color: '#f87171', background: 'none', border: 'none' }}><X size={14}/></button>
                                                        </div>
                                                    ) : (
                                                        <div className={`item-btn ${!sub.is_active ? 'inactive' : ''}`}>
                                                            <span onClick={() => toggleSub(sub)} style={{ cursor: 'pointer' }}>{sub.name}</span>
                                                            <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.1)' }}></div>
                                                            <button onClick={() => handleEditSub(sub)} style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', cursor: 'pointer' }}>
                                                                <Pencil size={11} />
                                                            </button>
                                                            <button onClick={() => toggleSub(sub)} style={{ background: 'none', border: 'none', padding: 0, color: sub.is_active ? '#10b981' : '#f87171', cursor: 'pointer' }}>
                                                                {sub.is_active ? <Check size={11} /> : <X size={11} />}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {subcategories.filter(s => s.category_id === cat.id).length === 0 && <span style={{ fontSize: '10px', color: '#334155', fontStyle: 'italic' }}>Sin items registrados</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'pay' && (
                <div className="animate-fade-in">
                    <div className="simple-card">
                         <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: '#f1f5f9' }}>Medios de Pago Gastos</h3>
                         <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                            <input className="input-field" placeholder="Nuevo medio (ej: Zelle, Caja Chica)..." value={newPayName} onChange={e => setNewPayName(e.target.value)} />
                            <button className="btn-primary" onClick={handleAddPay}>Añadir</button>
                         </div>
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                             {paymentMethods.map(pm => (
                                 <div key={pm.id} className="cat-tile" style={{ opacity: pm.is_active ? 1 : 0.5 }}>
                                     {editingPayId === pm.id ? (
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                            <input className="input-field" style={{ padding: '6px 10px' }} value={editingPayName} onChange={e => setEditingPayName(e.target.value)} autoFocus />
                                            <button onClick={() => savePayName(pm.id)} style={{ color: '#34d399', background: 'none', border: 'none' }}><Check size={18}/></button>
                                            <button onClick={() => setEditingPayId(null)} style={{ color: '#f87171', background: 'none', border: 'none' }}><X size={18}/></button>
                                        </div>
                                     ) : (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {getPaymentIcon(pm.name)}
                                                <span style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9' }}>{pm.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button onClick={() => handleEditPay(pm)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={16}/></button>
                                                <button onClick={() => togglePay(pm)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: pm.is_active ? '#f87171' : '#34d399' }}>
                                                    {pm.is_active ? <X size={18}/> : <Check size={18}/>}
                                                </button>
                                            </div>
                                        </>
                                     )}
                                 </div>
                             ))}
                         </div>
                    </div>
                </div>
            )}

            {/* CREATE / EDIT MODAL */}
            {isCreateOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }} onClick={() => { setIsCreateOpen(false); setEditingExpense(null); }}></div>
                    <form className="simple-card" style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: 'auto', background: '#161b27' }} onSubmit={handleAddExpense}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>{editingExpense ? 'Editar Gasto' : 'Declarar Gasto'}</h2>
                            <button type="button" onClick={() => { setIsCreateOpen(false); setEditingExpense(null); }} style={{ background: 'none', border: 'none', color: '#64748b' }}><X size={20}/></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Fecha</label>
                                <input className="input-field" type="date" name="expense_date" required defaultValue={editingExpense?.expense_date || new Date().toISOString().split('T')[0]} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Categoría</label>
                                    <select className="input-field" name="category_id" required defaultValue={editingExpense?.category_id || ""} onChange={e => setSelectedCatForSub(e.target.value)}>
                                        <option value="">Elegir...</option>
                                        {categories.filter(c => c.is_active || c.id === editingExpense?.category_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Ítem / Sub</label>
                                    <select className="input-field" name="subcategory_id" required defaultValue={editingExpense?.subcategory_id || ""} disabled={!selectedCatForSub && !editingExpense}>
                                        <option value="">Elegir...</option>
                                        {subcategories.filter(s => (s.is_active || s.id === editingExpense?.subcategory_id) && s.category_id === (selectedCatForSub || editingExpense?.category_id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Monto (CLP)</label>
                                <input className="input-field" type="number" name="amount" required placeholder="Ej: 50000" defaultValue={editingExpense?.amount || ""} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Medio de Pago</label>
                                <select className="input-field" name="payment_method" required defaultValue={editingExpense?.payment_method || ""}>
                                    <option value="">Elegir...</option>
                                    {paymentMethods.filter(p => p.is_active || p.name === editingExpense?.payment_method).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Notas</label>
                                <textarea className="input-field" name="notes" rows={3} placeholder="Detalles del gasto..." style={{ resize: 'none' }} defaultValue={editingExpense?.notes || ""}></textarea>
                            </div>
                            <button type="submit" className="btn-primary" style={{ marginTop: '10px', padding: '14px' }} disabled={isPending}>
                                {isPending ? 'Procesando...' : editingExpense ? '💾 Guardar Cambios' : '💾 Persistir Gasto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
