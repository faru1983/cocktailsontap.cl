'use client';

import React, { useState, useMemo } from 'react';
import { 
    PlusCircle, CreditCard, Smartphone, Banknote, Trash2, CalendarDays, 
    Tag, Edit2, X, Plus, ChevronUp, ChevronDown, Settings, ListFilter,
    Check, Wallet, ArrowRight, ShieldCheck, HelpCircle, FolderPlus
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

type SortKey = 'date' | 'amount' | 'category' | 'method' | 'notes';

// Helper to get YYYY-MM-DD in local time
const getLocalISODate = (date = new Date()) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

const getPaymentIcon = (method: string) => {
    if (method === 'Tarjeta') return <CreditCard size={18} />;
    if (method === 'Efectivo') return <Banknote size={18} />;
    return <Smartphone size={18} />;
};

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
    const [activeTab, setActiveTab] = useState<'list' | 'config'>('list');
    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Sort state
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Form state
    const [amount, setAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(() => getLocalISODate());
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
    const [notes, setNotes] = useState('');

    // Derived
    const filteredSubcategories = useMemo(() => {
        if (!selectedCategoryId) return [];
        return subcategories.filter(sub => sub.category_id === selectedCategoryId && sub.is_active);
    }, [selectedCategoryId, subcategories]);

    const sortedExpenses = useMemo(() => {
        return [...expenses].sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortKey) {
                case 'date': valA = a.expense_date; valB = b.expense_date; break;
                case 'amount': valA = a.amount; valB = b.amount; break;
                case 'category': valA = a.subcategory_name; valB = b.subcategory_name; break;
                case 'method': valA = a.payment_method; valB = b.payment_method; break;
                case 'notes': valA = a.notes; valB = b.notes; break;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [expenses, sortKey, sortOrder]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    const openCreateModal = () => {
        setIsEditing(false);
        setEditingId(null);
        setSelectedCategoryId('');
        setSelectedSubcategoryId('');
        setAmount('');
        setNotes('');
        setExpenseDate(getLocalISODate());
        setSelectedPaymentMethod(paymentMethods.find(p => p.is_active)?.name || paymentMethods[0]?.name || '');
        setIsModalOpen(true);
    };

    const openEditModal = (exp: Expense) => {
        setIsEditing(true);
        setEditingId(exp.id);
        setSelectedCategoryId(exp.category_id || '');
        setSelectedSubcategoryId(exp.subcategory_id || '');
        setAmount(exp.amount.toString());
        setNotes(exp.notes || '');
        setExpenseDate(exp.expense_date);
        setSelectedPaymentMethod(exp.payment_method);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !selectedSubcategoryId) return;
        setIsLoading(true);
        try {
            const data = {
                amount: Number(amount),
                payment_method: selectedPaymentMethod,
                expense_date: expenseDate,
                category_id: selectedCategoryId,
                subcategory_id: selectedSubcategoryId,
                notes
            };
            if (isEditing && editingId) {
                await updateExpense(editingId, data);
            } else {
                await addExpense(data);
            }
            window.location.reload(); 
        } catch (error) {
            console.error(error);
            alert('Error al guardar el gasto.');
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
        try {
            await deleteExpense(id);
            setExpenses(prev => prev.filter(e => e.id !== id));
        } catch (er) {
            console.error(er);
            alert('Error al eliminar');
        }
    };

    const formatDateForDisplay = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="pb-10 animate-fade-in px-4 md:px-0 max-w-7xl mx-auto">
            {/* Tab Navigation - Premium Styled */}
            <div className="flex justify-center sm:justify-start mb-10">
                <div className="inline-flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/50 backdrop-blur-md shadow-2xl">
                    <button 
                        onClick={() => setActiveTab('list')} 
                        className={`flex items-center gap-2.5 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'list' ? 'bg-primary text-slate-950 shadow-xl shadow-primary/30 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <ListFilter size={18} /> Historial
                    </button>
                    <button 
                        onClick={() => setActiveTab('config')} 
                        className={`flex items-center gap-2.5 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'config' ? 'bg-primary text-slate-950 shadow-xl shadow-primary/30 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Settings size={18} /> Ajustes
                    </button>
                </div>
            </div>

            {activeTab === 'list' ? (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                        <div>
                            <h1 className="text-4xl font-black text-slate-100 flex items-center gap-3">
                                <span className="bg-primary/20 p-2 rounded-2xl text-primary"><Wallet size={32} /></span>
                                Libro de Gastos
                            </h1>
                            <p className="text-slate-500 text-sm mt-2 font-medium">Control centralizado de egresos y costos operativos.</p>
                        </div>
                        <button 
                            onClick={openCreateModal} 
                            className="group w-full sm:w-auto bg-primary text-slate-900 px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-primary-dark transition-all shadow-2xl shadow-primary/20 active:scale-95"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" /> Registrar Gasto
                        </button>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/50 rounded-[2.5rem] overflow-hidden backdrop-blur-xl shadow-3xl">
                        {expenses.length === 0 ? (
                            <div className="py-32 flex flex-col items-center gap-4">
                                <div className="bg-slate-800/50 p-6 rounded-full text-slate-600"><Banknote size={48} /></div>
                                <p className="text-slate-500 font-bold italic tracking-wide">Aún no hay registros financieros este mes.</p>
                            </div>
                        ) : (
                            <>
                                {/* Table for Large Screens */}
                                <div className="hidden lg:block">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-950/40 text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] border-b border-slate-800/50">
                                                <th onClick={() => toggleSort('date')} className="px-8 py-6 cursor-pointer hover:text-primary transition-colors group">
                                                    <div className="flex items-center gap-2">Fecha {sortKey === 'date' && (sortOrder === 'asc' ? <ChevronUp size={14} className="text-primary"/> : <ChevronDown size={14} className="text-primary"/>)}</div>
                                                </th>
                                                <th onClick={() => toggleSort('category')} className="px-8 py-6 cursor-pointer hover:text-primary transition-colors">
                                                    <div className="flex items-center gap-2">Concepto {sortKey === 'category' && (sortOrder === 'asc' ? <ChevronUp size={14} className="text-primary"/> : <ChevronDown size={14} className="text-primary"/>)}</div>
                                                </th>
                                                <th onClick={() => toggleSort('amount')} className="px-8 py-6 cursor-pointer hover:text-primary transition-colors">
                                                    <div className="flex items-center gap-2">Monto {sortKey === 'amount' && (sortOrder === 'asc' ? <ChevronUp size={14} className="text-primary"/> : <ChevronDown size={14} className="text-primary"/>)}</div>
                                                </th>
                                                <th onClick={() => toggleSort('method')} className="px-8 py-6 cursor-pointer hover:text-primary transition-colors">
                                                    <div className="flex items-center gap-2">Pago {sortKey === 'method' && (sortOrder === 'asc' ? <ChevronUp size={14} className="text-primary"/> : <ChevronDown size={14} className="text-primary"/>)}</div>
                                                </th>
                                                <th className="px-8 py-6 text-right">Gesti&oacute;n</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/30">
                                            {sortedExpenses.map(exp => (
                                                <tr key={exp.id} className="hover:bg-slate-800/30 transition-all duration-300 group">
                                                    <td className="px-8 py-6 text-slate-400 text-sm font-bold tabular-nums">
                                                        {formatDateForDisplay(exp.expense_date)}
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="text-slate-100 text-base font-black tracking-tight group-hover:text-primary transition-colors">{exp.subcategory_name}</div>
                                                        <div className="text-slate-500 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mt-1">
                                                            <Tag size={10} className="text-slate-600" /> {exp.category_name}
                                                        </div>
                                                        {exp.notes && (
                                                            <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800/50 text-slate-400 text-[11px] font-medium italic inline-block max-w-xs truncate">
                                                                &ldquo;{exp.notes}&rdquo;
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="text-rose-500 font-black text-lg tabular-nums flex items-baseline gap-1">
                                                            <span className="text-xs opacity-50 font-medium">CLP</span>
                                                            {new Intl.NumberFormat('es-CL').format(exp.amount)}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800/80 text-slate-400 text-[10px] font-black uppercase tracking-tight shadow-inner">
                                                            <span className="text-primary/70">{getPaymentIcon(exp.payment_method)}</span>
                                                            {exp.payment_method}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                                                            <button 
                                                                onClick={() => openEditModal(exp)} 
                                                                className="p-3 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-2xl transition-all border border-transparent hover:border-emerald-500/20"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(exp.id)} 
                                                                className="p-3 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/20"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Cards for Mobile */}
                                <div className="lg:hidden divide-y divide-slate-800/50">
                                    {sortedExpenses.map(exp => (
                                        <div key={exp.id} className="p-8 flex flex-col gap-6 active:bg-slate-800/40 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">{formatDateForDisplay(exp.expense_date)}</div>
                                                    <div className="text-slate-100 font-black text-xl tracking-tight leading-none mt-1">{exp.subcategory_name}</div>
                                                    <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                                        <Tag size={10} className="text-primary/50" /> {exp.category_name}
                                                    </div>
                                                </div>
                                                <div className="text-rose-500 font-black text-xl tabular-nums">
                                                    -${new Intl.NumberFormat('es-CL').format(exp.amount)}
                                                </div>
                                            </div>
                                            
                                            {exp.notes && (
                                                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 shadow-inner">
                                                    <p className="text-slate-400 text-xs italic font-medium leading-relaxed">&ldquo;{exp.notes}&rdquo;</p>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center bg-slate-950/30 p-3 rounded-2xl border border-slate-800/20">
                                                <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 font-black text-[9px] uppercase tracking-tighter text-slate-400 border border-slate-800">
                                                    {getPaymentIcon(exp.payment_method)} {exp.payment_method}
                                                </span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => openEditModal(exp)} className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20"><Edit2 size={18} /></button>
                                                    <button onClick={() => handleDelete(exp.id)} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20"><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </>
            ) : (
                <ConfigZone 
                    categories={categories} 
                    subcategories={subcategories} 
                    paymentMethods={paymentMethods} 
                />
            )}

            {/* Modal - Full Premium Design */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl transition-opacity" onClick={() => !isLoading && setIsModalOpen(false)} />
                    
                    <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-[2.5rem] overflow-hidden shadow-4xl animate-slide-up max-h-[95vh] flex flex-col">
                        <div className="px-8 py-7 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div>
                                <h2 className="text-2xl font-black text-slate-100 tracking-tight">
                                    {isEditing ? 'Editar Registro' : 'Nuevo Registro'}
                                </h2>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Gesti&oacute;n de egresos administrativos</p>
                            </div>
                            <button onClick={() => !isLoading && setIsModalOpen(false)} className="p-3 text-slate-500 hover:text-white transition-all bg-slate-800/50 hover:bg-slate-800 rounded-2xl"><X size={24} /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                            <div className="space-y-3">
                                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] pl-2 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div> Monto Total
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-700 group-focus-within:text-primary transition-colors">$</span>
                                    <input 
                                        type="number" required min="1" autoFocus
                                        value={amount} onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full pl-14 pr-8 py-8 bg-slate-950 border-2 border-slate-800 group-hover:border-slate-700 focus:border-primary/50 rounded-[1.5rem] text-slate-100 text-4xl font-black focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-800 tabular-nums focus:scale-[1.02]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] pl-2">Fecha Gasto</label>
                                    <input 
                                        type="date" required 
                                        value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} 
                                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all active:scale-95" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] pl-2">Familia</label>
                                    <select 
                                        required value={selectedCategoryId} 
                                        onChange={(e) => { setSelectedCategoryId(e.target.value); setSelectedSubcategoryId(''); }} 
                                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 text-sm font-bold focus:outline-none focus:border-primary/50 appearance-none cursor-pointer hover:bg-slate-900 transition-colors"
                                    >
                                        <option value="" disabled>Seleccione...</option>
                                        {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {selectedCategoryId && (
                                <div className="space-y-2 animate-slide-down">
                                    <label className="text-primary/70 text-[10px] font-black uppercase tracking-widest pl-2 font-black tracking-[0.2em] flex items-center gap-2">
                                        <Tag size={12} /> &Iacute;tem Detallado
                                    </label>
                                    <div className="flex flex-wrap gap-2 p-4 bg-primary/5 border border-primary/20 rounded-3xl">
                                        {filteredSubcategories.map(sub => (
                                            <button
                                                key={sub.id} type="button"
                                                onClick={() => setSelectedSubcategoryId(sub.id)}
                                                className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all ${selectedSubcategoryId === sub.id ? 'bg-primary text-slate-950 shadow-lg scale-110' : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
                                            >
                                                {sub.name}
                                            </button>
                                        ))}
                                        {filteredSubcategories.length === 0 && <span className="text-slate-600 text-xs italic font-medium py-1">No hay &iacute;tems activos en esta familia.</span>}
                                    </div>
                                    <input type="hidden" required value={selectedSubcategoryId} />
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] pl-2 flex items-center gap-2">
                                    <CreditCard size={12} /> Forma de Pago
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {paymentMethods.filter(p => p.is_active).map(method => (
                                        <button
                                            key={method.id} type="button"
                                            onClick={() => setSelectedPaymentMethod(method.name)}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${selectedPaymentMethod === method.name ? 'bg-primary/10 border-primary text-primary scale-[1.03] shadow-lg shadow-primary/10' : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700'}`}
                                        >
                                            <span className={selectedPaymentMethod === method.name ? 'text-primary' : 'text-slate-700'}>{getPaymentIcon(method.name)}</span>
                                            <span className="text-[10px] font-black uppercase tracking-tighter">{method.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] pl-2">Notas adicionales</label>
                                <textarea 
                                    rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} 
                                    placeholder="Detalles sobre el gasto..." 
                                    className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-3xl text-slate-200 text-sm font-medium focus:outline-none focus:border-primary/40 resize-none shadow-inner" 
                                />
                            </div>

                            <button 
                                type="submit" disabled={isLoading || !amount || !selectedSubcategoryId} 
                                className="w-full py-6 rounded-3xl bg-primary text-slate-950 font-black text-base uppercase tracking-widest hover:bg-primary-dark transition-all shadow-[0_15px_30px_-10px_rgba(var(--color-primary),0.4)] disabled:opacity-20 active:scale-95"
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-3 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"></div>
                                        Procesando...
                                    </span>
                                ) : (isEditing ? 'Actualizar Registro' : 'Confirmar Gasto')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function ConfigZone({ categories, subcategories, paymentMethods }: { categories: Category[], subcategories: Subcategory[], paymentMethods: PaymentMethod[] }) {
    const [subTab, setSubTab] = useState<'cats' | 'pays'>('cats');
    const [isLoading, setIsLoading] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newPayName, setNewPayName] = useState('');
    const [selectedCatForSub, setSelectedCatForSub] = useState('');
    const [newSubName, setNewSubName] = useState('');

    const handleAddCat = async () => { if (!newCatName) return; setIsLoading(true); try { await addExpenseCategory(newCatName); setNewCatName(''); } finally { setIsLoading(false); window.location.reload(); } };
    const handleAddSub = async () => { if (!newSubName || !selectedCatForSub) return; setIsLoading(true); try { await addExpenseSubcategory(selectedCatForSub, newSubName); setNewSubName(''); } finally { setIsLoading(false); window.location.reload(); } };
    const handleAddPay = async () => { if (!newPayName) return; setIsLoading(true); try { await addPaymentMethod(newPayName); setNewPayName(''); } finally { setIsLoading(false); window.location.reload(); } };

    const toggleCat = async (c: Category) => { setIsLoading(true); await updateExpenseCategory(c.id, c.name, !c.is_active); window.location.reload(); };
    const toggleSub = async (s: Subcategory) => { setIsLoading(true); await updateExpenseSubcategory(s.id, s.name, !s.is_active); window.location.reload(); };
    const togglePay = async (p: PaymentMethod) => { setIsLoading(true); await updatePaymentMethod(p.id, p.name, !p.is_active); window.location.reload(); };
    const removePay = async (p: PaymentMethod) => { if (confirm('¿Eliminar definitivamente?')) { setIsLoading(true); await deletePaymentMethod(p.id); window.location.reload(); } };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fade-in">
            <div className="lg:col-span-1 space-y-3">
                <button 
                    onClick={() => setSubTab('cats')} 
                    className={`group w-full text-left px-6 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-between transition-all border ${subTab === 'cats' ? 'bg-primary text-slate-950 border-primary shadow-2xl shadow-primary/20 scale-105' : 'bg-slate-900/40 text-slate-500 border-slate-800 shadow-xl hover:text-slate-300 hover:bg-slate-900/60'}`}
                >
                    Familias &Iacute;tems <Tag size={20} className={subTab === 'cats' ? 'text-slate-900' : 'text-slate-700 group-hover:text-primary transition-colors'} />
                </button>
                <button 
                    onClick={() => setSubTab('pays')} 
                    className={`group w-full text-left px-6 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-between transition-all border ${subTab === 'pays' ? 'bg-primary text-slate-950 border-primary shadow-2xl shadow-primary/20 scale-105' : 'bg-slate-900/40 text-slate-500 border-slate-800 shadow-xl hover:text-slate-300 hover:bg-slate-900/60'}`}
                >
                    Metodologías <CreditCard size={20} className={subTab === 'pays' ? 'text-slate-900' : 'text-slate-700 group-hover:text-primary transition-colors'} />
                </button>
                
                <div className="hidden lg:block p-8 bg-slate-900/40 rounded-[2.5rem] mt-8 border border-slate-800/50 shadow-inner">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="bg-slate-800 p-4 rounded-full text-primary/40"><ShieldCheck size={32} /></div>
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest leading-loose">Configuraci&oacute;n Central de Finanzas. Activa o desactiva opciones seg&uacute;n la temporada.</p>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3 space-y-10 animate-slide-up">
                {subTab === 'cats' ? (
                    <div className="space-y-12">
                        {/* Categories Create */}
                        <div className="space-y-5">
                            <h3 className="text-2xl font-black text-slate-100 flex items-center gap-3"><FolderPlus size={24} className="text-primary" /> Crear Familia de Gastos</h3>
                            <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2rem] p-4 flex flex-col sm:flex-row gap-3 shadow-2xl backdrop-blur-md">
                                <input 
                                    type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} 
                                    placeholder="Eje: Personal, Log&iacute;stica, Marketing..." 
                                    className="flex-1 bg-slate-950 border-2 border-slate-800 rounded-[1.2rem] px-6 py-4 text-slate-100 font-bold focus:outline-none focus:border-primary/40 transition-all placeholder:text-slate-800" 
                                />
                                <button 
                                    disabled={isLoading || !newCatName} onClick={handleAddCat} 
                                    className="bg-primary text-slate-950 px-10 py-4 rounded-[1.2rem] font-black text-sm uppercase tracking-widest hover:bg-primary-dark transition-all disabled:opacity-30 active:scale-95"
                                >
                                    {isLoading ? '...' : 'Añadir'}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 px-1">
                                {categories.map(c => (
                                    <button 
                                        key={c.id} onClick={() => toggleCat(c)}
                                        className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-tighter border-2 transition-all ${c.is_active ? 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10' : 'bg-slate-900/50 border-slate-800 text-slate-700 grayscale hover:grayscale-0'}`}
                                    >
                                        {c.name} {c.is_active ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-rose-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Subcategories Management */}
                        <div className="space-y-5">
                            <h3 className="text-2xl font-black text-slate-100 flex items-center gap-3"><ListFilter size={24} className="text-primary" /> Art&iacute;culos y Conceptos</h3>
                            <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2.5rem] p-8 space-y-8 shadow-2xl backdrop-blur-md border-t-white/[0.03]">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-5 space-y-2">
                                        <label className="text-slate-600 text-[10px] font-black uppercase tracking-widest pl-3">Seleccionar Familia</label>
                                        <select 
                                            value={selectedCatForSub} onChange={e => setSelectedCatForSub(e.target.value)} 
                                            className="w-full bg-slate-950 border-2 border-slate-800 rounded-[1.2rem] px-5 py-4 text-slate-200 font-bold focus:outline-none focus:border-primary/40 appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled>Elegir Familia...</option>
                                            {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="lg:col-span-5 space-y-2">
                                        <label className="text-slate-600 text-[10px] font-black uppercase tracking-widest pl-3">Nuevo Art&iacute;culo</label>
                                        <input 
                                            type="text" value={newSubName} onChange={e => setNewSubName(e.target.value)} 
                                            placeholder="Eje: Hielo, Bencina, Bartender..." 
                                            className="w-full bg-slate-950 border-2 border-slate-800 rounded-[1.2rem] px-6 py-4 text-slate-100 font-bold focus:outline-none focus:border-primary/40 placeholder:text-slate-800 transition-all" 
                                        />
                                    </div>
                                    <div className="lg:col-span-2 flex items-end">
                                        <button 
                                            disabled={isLoading || !newSubName || !selectedCatForSub} onClick={handleAddSub} 
                                            className="w-full group bg-slate-100 text-slate-950 h-[4.2rem] rounded-[1.2rem] font-black flex items-center justify-center hover:bg-primary transition-all disabled:opacity-10 active:scale-95"
                                        >
                                            <Plus size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {categories.filter(c => c.is_active).map(cat => (
                                        <div key={cat.id} className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800/80 shadow-inner group">
                                            <div className="text-[10px] font-black text-primary/40 uppercase tracking-[0.25em] mb-4 flex items-center justify-between">
                                                {cat.name} <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {subcategories.filter(s => s.category_id === cat.id).map(sub => (
                                                    <button 
                                                        key={sub.id} onClick={() => toggleSub(sub)}
                                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-2 ${sub.is_active ? 'bg-slate-800/80 border-slate-700 text-slate-100 hover:border-primary/40 hover:scale-105 shadow-md shadow-black/40' : 'bg-transparent border-slate-900 text-slate-800 line-through'}`}
                                                    >
                                                        {sub.name}
                                                    </button>
                                                ))}
                                                {subcategories.filter(s => s.category_id === cat.id).length === 0 && <span className="text-slate-800 text-[10px] uppercase font-black tracking-widest italic py-4 w-full text-center">Sin &iacute;tems configurados.</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-10">
                        <h3 className="text-2xl font-black text-slate-100 flex items-center gap-3"><HelpCircle size={24} className="text-primary" /> Medios de Liquidaci&oacute;n</h3>
                        <div className="bg-slate-900 rounded-[3rem] p-10 border-2 border-slate-800 shadow-4xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-20 bg-primary/5 rounded-full -translate-y-20 translate-x-20 blur-3xl"></div>
                            
                            <div className="relative z-10 flex flex-col sm:flex-row gap-4 mb-14">
                                <div className="flex-1 relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-emerald-500 rounded-3xl opacity-20 group-focus-within:opacity-50 transition-opacity blur-md"></div>
                                    <input 
                                        type="text" value={newPayName} onChange={e => setNewPayName(e.target.value)} 
                                        placeholder="TIPO DE PAGO (EJ: D&Eacute;BITO, ZEBRA, ETC...)" 
                                        className="relative w-full bg-slate-950 border border-slate-800 rounded-[1.5rem] px-8 py-6 text-xl font-black text-slate-100 focus:outline-none placeholder:text-slate-900 uppercase tracking-widest" 
                                    />
                                </div>
                                <button 
                                    disabled={isLoading || !newPayName} onClick={handleAddPay} 
                                    className="px-10 py-6 bg-primary text-slate-950 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-3xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
                                >
                                    Confirmar
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
                                {paymentMethods.map(pm => (
                                    <div key={pm.id} className={`group relative p-8 rounded-[2rem] border-2 transition-all duration-500 ${pm.is_active ? 'bg-slate-950 border-slate-800 hover:border-primary/50 shadow-2xl' : 'bg-black/40 border-slate-900 opacity-40 shadow-inner'}`}>
                                        <div className="flex justify-between items-center mb-6">
                                            <div className={`p-4 rounded-2xl ${pm.is_active ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20 scale-110' : 'bg-slate-900 text-slate-700'}`}>
                                                {getPaymentIcon(pm.name)}
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => togglePay(pm)} className={`p-2 rounded-xl transition-all ${pm.is_active ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-600 hover:text-emerald-500'}`}><Check size={18}/></button>
                                                <button onClick={() => removePay(pm)} className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                        <div className={`text-xl font-black tracking-tight ${pm.is_active ? 'text-slate-100' : 'text-slate-800'}`}>{pm.name}</div>
                                        <div className={`text-[9px] font-black mt-1 tracking-[0.2em] ${pm.is_active ? 'text-primary/70' : 'text-slate-900'}`}>{pm.is_active ? 'ACTIVO' : 'EXTINTO'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
