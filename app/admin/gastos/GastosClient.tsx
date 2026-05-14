'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    CreditCard, Smartphone, Banknote, Trash2,
    Edit2, X, Plus, List, Check, Wallet, FolderPlus,
    Search, Pencil, Layers, Save, CalendarDays,
    ArrowLeft, ArrowRight, Receipt, Hash, Calculator, PieChart
} from 'lucide-react';
import { 
    addExpense, deleteExpense, updateExpense,
    addExpenseCategory, updateExpenseCategory,
    addExpenseSubcategory, updateExpenseSubcategory,
    addPaymentMethod, updatePaymentMethod
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
interface MonthlyStats {
    total: number;
    count: number;
    average: number;
    revenue: number;
    profit: number;
    topCategoryName: string;
    topCategoryAmount: number;
    categoryTotals: Array<[string, number]>;
}
const MONTH_OPTIONS = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
];

const getPaymentIcon = (method: string) => {
    if (method === 'Tarjeta') return <CreditCard size={18} />;
    if (method === 'Efectivo') return <Banknote size={18} />;
    return <Smartphone size={18} />;
};

const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
type Tab = 'list' | 'cats' | 'pay';
type ActionResult = { success: boolean; error?: string };

const parseTab = (value: string | null): Tab => {
    if (value === 'cats' || value === 'pay') return value;
    return 'list';
};

export default function GastosClient({ 
    categories, 
    subcategories, 
    initialExpenses,
    paymentMethods,
    selectedMonth,
    currentMonth,
    monthLabel,
    previousMonth,
    nextMonth,
    monthlyStats
}: { 
    categories: Category[]; 
    subcategories: Subcategory[]; 
    initialExpenses: Expense[];
    paymentMethods: PaymentMethod[];
    selectedMonth: string;
    currentMonth: string;
    monthLabel: string;
    previousMonth: string;
    nextMonth: string;
    monthlyStats: MonthlyStats;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [tab, setTab] = useState<Tab>(parseTab(searchParams.get('tab')));

    useEffect(() => {
        const currentTab = searchParams.get('tab');
        if (currentTab !== tab) {
            const params = new URLSearchParams(searchParams);
            params.set('tab', tab);
            params.set('month', selectedMonth);
            router.replace(`/admin/gastos?${params.toString()}`, { scroll: false });
        }
    }, [tab, router, searchParams, selectedMonth]);

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

    const [isCreateCatOpen, setIsCreateCatOpen] = useState(false);
    const [isCreateSubOpen, setIsCreateSubOpen] = useState(false);
    const [isCreatePayOpen, setIsCreatePayOpen] = useState(false);
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-');
    const currentYear = Number(currentMonth.split('-')[0]);
    const yearOptions = Array.from({ length: 7 }, (_, i) => String(currentYear - 3 + i));

    useEffect(() => {
        setExpenses(initialExpenses);
    }, [initialExpenses]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const matchesCat = !filterCat || e.category_id === filterCat;
            const matchesSearch = !searchTerm || 
                e.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.subcategory_name?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [expenses, filterCat, searchTerm]);

    const navigateToMonth = (month: string) => {
        if (!month) return;
        const params = new URLSearchParams(searchParams);
        params.set('month', month);
        params.set('tab', tab);
        router.replace(`/admin/gastos?${params.toString()}`, { scroll: false });
    };
    const handleYearChange = (year: string) => navigateToMonth(`${year}-${selectedMonthNum}`);
    const handleMonthChange = (monthNum: string) => navigateToMonth(`${selectedYear}-${monthNum}`);

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
                const expenseMonth = data.expense_date.slice(0, 7);
                if (expenseMonth !== selectedMonth) navigateToMonth(expenseMonth);
                else router.refresh();
                setIsCreateOpen(false);
                setEditingExpense(null);
            } else if ((res as ActionResult).error) {
                alert((res as ActionResult).error);
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

    const handleAddCat = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newCatName) return;
        startTransition(async () => {
            const res = await addExpenseCategory(newCatName);
            if (res.success) { setNewCatName(''); setIsCreateCatOpen(false); refreshData(); }
            else if ((res as ActionResult).error) alert((res as ActionResult).error);
        });
    };

    const handleAddSub = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newSubName || !selectedCatForSub) return;
        startTransition(async () => {
            const res = await addExpenseSubcategory(selectedCatForSub, newSubName);
            if (res.success) { setNewSubName(''); setIsCreateSubOpen(false); refreshData(); }
            else if ((res as ActionResult).error) alert((res as ActionResult).error);
        });
    };

    const toggleCat = (cat: Category) => {
        const msg = cat.is_active ? `¿Deseas DESACTIVAR la categoría "${cat.name}"?` : `¿Reactivar categoría "${cat.name}"?`;
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

    const handleAddPay = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newPayName) return;
        startTransition(async () => {
            const res = await addPaymentMethod(newPayName);
            if (res.success) { setNewPayName(''); setIsCreatePayOpen(false); refreshData(); }
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
        <div className="pb-16 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1">Gestión de Gastos</h1>
                    <p className="text-slate-500 text-sm">Administra desembolsos y configura familias de costos</p>
                </div>
                <button 
                    className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-lg shadow-[#E2A049]/10"
                    onClick={() => handleOpenCreate()}
                >
                   <Plus size={18} /> Declarar Gasto
                </button>
            </div>

            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-4 md:p-5 mb-6 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#E2A049]/10 rounded-xl text-[#E2A049]">
                            <CalendarDays size={20} />
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Periodo activo</div>
                            <div className="text-white font-black text-lg capitalize">{monthLabel}</div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => navigateToMonth(previousMonth)} className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-[#E2A049]/40 transition-colors flex items-center justify-center cursor-pointer" title="Mes anterior">
                                <ArrowLeft size={16} />
                            </button>
                            <button onClick={() => navigateToMonth(currentMonth)} className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-slate-300 hover:text-[#E2A049] hover:border-[#E2A049]/40 transition-colors text-xs font-black cursor-pointer">
                                Este mes
                            </button>
                            <button onClick={() => navigateToMonth(nextMonth)} className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-[#E2A049]/40 transition-colors flex items-center justify-center cursor-pointer" title="Mes siguiente">
                                <ArrowRight size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <select value={selectedYear} onChange={e => handleYearChange(e.target.value)} className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#E2A049] transition-colors text-sm">
                                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                            <select value={selectedMonthNum} onChange={e => handleMonthChange(e.target.value)} className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#E2A049] transition-colors text-sm">
                                {MONTH_OPTIONS.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-1.5 border-b border-white/5 mb-8 pb-3">
                <button className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${tab === 'list' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setTab('list')}>Gastos</button>
                <button className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${tab === 'cats' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setTab('cats')}>Categorías</button>
                <button className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${tab === 'pay' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setTab('pay')}>Pagos</button>
            </div>

            {tab === 'list' && (
                <div className="animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-2 border-t-sky-400 p-4 shadow-xl">
                            <Hash size={17} className="text-sky-400 mb-3" />
                            <div className="text-white text-lg md:text-xl font-black">{monthlyStats.count}</div>
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Movimientos</div>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-2 border-t-rose-400 p-4 shadow-xl">
                            <Receipt size={17} className="text-rose-400 mb-3" />
                            <div className="text-white text-lg md:text-xl font-black truncate" title={formatCLP(monthlyStats.total)}>{formatCLP(monthlyStats.total)}</div>
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Gastos Total Mes</div>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-2 border-t-emerald-400 p-4 shadow-xl">
                            <Calculator size={17} className="text-emerald-400 mb-3" />
                            <div className="text-white text-lg md:text-xl font-black truncate" title={formatCLP(monthlyStats.revenue)}>{formatCLP(monthlyStats.revenue)}</div>
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Ingresos del mes</div>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 border-t-2 border-t-[#E2A049] p-4 shadow-xl">
                            <PieChart size={17} className="text-[#E2A049] mb-3" />
                            <div className={`text-white text-lg md:text-xl font-black truncate ${monthlyStats.profit >= 0 ? 'text-sky-400' : 'text-rose-400'}`} title={formatCLP(monthlyStats.profit)}>{formatCLP(monthlyStats.profit)}</div>
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest truncate">Utilidad del mes</div>
                        </div>
                    </div>

                    {monthlyStats.categoryTotals.length > 0 && (
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 mb-6 shadow-xl">
                            <div className="flex items-center gap-2 mb-4">
                                <Layers size={16} className="text-[#E2A049]" />
                                <h3 className="text-white text-sm font-black">Desglose por categoria</h3>
                            </div>
                            <div className="space-y-4">
                                {monthlyStats.categoryTotals.map(([name, amount]) => {
                                    const pct = monthlyStats.total ? (amount / monthlyStats.total) * 100 : 0;
                                    return (
                                        <div key={name}>
                                            <div className="flex justify-between items-baseline gap-3 mb-2">
                                                <span className="text-slate-200 text-xs font-bold truncate">{name}</span>
                                                <span className="text-[#E2A049] text-xs font-black whitespace-nowrap">{formatCLP(amount)} <span className="text-slate-500">({pct.toFixed(1)}%)</span></span>
                                            </div>
                                            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#E2A049] rounded-full" style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6">
                        <select className="flex-1 min-w-[160px] bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                            <option value="">Todas las Categorías</option>
                            {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex-2 min-w-[200px] relative">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                             <input className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" placeholder="Buscar en notas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02]">
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Fecha</th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Familia / Sub</th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Medio</th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Monto</th>
                                    <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Notas</th>
                                    <th className="text-right py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 px-6 text-center text-slate-500 text-sm font-bold">
                                            Sin gastos para los filtros seleccionados en este periodo.
                                        </td>
                                    </tr>
                                )}
                                {filteredExpenses.map(e => (
                                    <tr key={e.id} className="border-t border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 px-6 text-slate-400 text-[13px]">{new Date(e.expense_date + 'T12:00:00').toLocaleDateString('es-CL')}</td>
                                        <td className="py-4 px-6">
                                            <div className="text-[#E2A049] font-bold text-[13px]">{e.category_name}</div>
                                            <div className="text-[11px] text-slate-500">{e.subcategory_name}</div>
                                        </td>
                                        <td className="py-4 px-6 text-slate-400 text-[13px]">{e.payment_method}</td>
                                        <td className="py-4 px-6 text-white font-black text-sm">{formatCLP(e.amount)}</td>
                                        <td className="py-4 px-6 text-slate-500 text-[13px] italic truncate max-w-[200px]" title={e.notes}>{e.notes || '—'}</td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleOpenCreate(e)} className="p-2 text-slate-500 hover:text-[#E2A049] transition-colors bg-transparent border-none cursor-pointer"><Pencil size={15} /></button>
                                                <button onClick={() => handleDeleteExpense(e.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 mt-4 md:hidden">
                        {filteredExpenses.length === 0 && (
                            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-8 text-center text-slate-500 text-sm font-bold">
                                Sin gastos para los filtros seleccionados en este periodo.
                            </div>
                        )}
                        {filteredExpenses.map(e => (
                            <div key={e.id} className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-lg">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{new Date(e.expense_date + 'T12:00:00').toLocaleDateString('es-CL')}</div>
                                        <div className="text-white font-black text-lg">{formatCLP(e.amount)}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenCreate(e)} className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all"><Pencil size={16}/></button>
                                        <button onClick={() => handleDeleteExpense(e.id)} className="p-2.5 bg-red-500/5 rounded-xl text-red-400/70 hover:text-red-400 transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[#E2A049] text-xs font-black uppercase tracking-tight flex items-center gap-2"><Layers size={12}/> {e.category_name}</div>
                                    <div className="text-slate-200 text-sm font-semibold">{e.subcategory_name}</div>
                                </div>
                                {e.notes && <div className="mt-4 p-3 bg-black/20 rounded-xl border border-white/5 text-slate-500 text-xs italic">{e.notes}</div>}
                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-slate-600 text-[10px] font-bold uppercase tracking-widest"><CreditCard size={10}/> {e.payment_method}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'cats' && (
                <div className="animate-in fade-in duration-500 space-y-10">
                    <section className="bg-[#1e2433] rounded-2xl border border-white/5 p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-white text-lg font-black flex items-center gap-3"><Layers className="text-[#E2A049]" size={20}/> Familia de Gastos</h3>
                            <button className="bg-[#E2A049]/10 text-[#E2A049] hover:bg-[#E2A049]/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2" onClick={() => setIsCreateCatOpen(true)}>
                                <Plus size={14}/> Añadir
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {categories.map(c => (
                                <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${c.is_active ? 'bg-white/[0.03] border-white/5 hover:border-[#E2A049]/30 shadow-lg shadow-black/20' : 'bg-red-500/5 border-red-500/10 opacity-60'}`}>
                                    {editingCatId === c.id ? (
                                        <div className="flex items-center gap-2 w-full">
                                            <input className="flex-1 bg-black/30 border border-[#E2A049] rounded-lg px-3 py-1 text-sm text-white" value={editingCatName} onChange={e => setEditingCatName(e.target.value)} autoFocus />
                                            <button onClick={() => saveCatName(c.id)} className="text-emerald-400 p-0 hover:scale-110"><Check size={18}/></button>
                                            <button onClick={() => setEditingCatId(null)} className="text-rose-400 p-0 hover:scale-110"><X size={18}/></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm tracking-tight">{c.name}</span>
                                                {!c.is_active && <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest mt-1">Inactiva</span>}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => handleEditCat(c)} className="text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer"><Edit2 size={14}/></button>
                                                <button onClick={() => toggleCat(c)} className={`transition-colors bg-transparent border-none cursor-pointer ${c.is_active ? 'text-slate-600 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}>{c.is_active ? <Trash2 size={16}/> : <Check size={18}/>}</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-[#1e2433] rounded-2xl border border-white/5 p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-white text-lg font-black flex items-center gap-3"><List className="text-sky-400" size={20}/> Subcategorías e Ítems</h3>
                            <button className="bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2" onClick={() => setIsCreateSubOpen(true)}>
                                <Plus size={14}/> Añadir
                            </button>
                        </div>
                        <div className="space-y-6">
                            {categories.map(cat => (
                                <div key={cat.id} className={`p-6 rounded-2xl border ${cat.is_active ? 'bg-black/10 border-white/5' : 'bg-red-500/5 border-red-500/10 opacity-50 grayscale'}`}>
                                    <div className="flex items-center justify-between mb-5">
                                        <div className={`text-[10px] font-black uppercase tracking-[2px] flex items-center gap-2 ${cat.is_active ? 'text-[#E2A049]' : 'text-slate-600'}`}><FolderPlus size={14}/> {cat.name}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {subcategories.filter(s => s.category_id === cat.id).map(sub => (
                                            <div key={sub.id}>
                                                {editingSubId === sub.id ? (
                                                    <div className="flex items-center gap-2 bg-black/40 border border-sky-400 rounded-xl px-3 py-1.5 shadow-2xl">
                                                        <input className="bg-transparent border-none outline-none text-xs text-white p-0 w-24" value={editingSubName} onChange={e => setEditingSubName(e.target.value)} autoFocus />
                                                        <button onClick={() => saveSubName(sub.id)} className="text-emerald-400 p-0"><Check size={14}/></button>
                                                        <button onClick={() => setEditingSubId(null)} className="text-rose-400 p-0"><X size={14}/></button>
                                                    </div>
                                                ) : (
                                                    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all border ${sub.is_active ? 'bg-white/5 border-white/5 text-slate-200 hover:border-sky-400/50 hover:bg-white/10' : 'bg-red-500/10 border-red-500/10 text-rose-400'}`}>
                                                        <span className="text-xs font-bold leading-none">{sub.name}</span>
                                                        <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                                                            <button onClick={() => handleEditSub(sub)} className="p-0.5 text-slate-500 hover:text-white transition-colors"><Pencil size={12} /></button>
                                                            <button onClick={() => toggleSub(sub)} className={`p-0.5 transition-colors ${sub.is_active ? 'text-slate-600 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}>{sub.is_active ? <X size={14} /> : <Check size={14} />}</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {tab === 'pay' && (
                <div className="animate-in fade-in duration-500">
                    <section className="bg-[#1e2433] rounded-2xl border border-white/5 p-8 shadow-2xl">
                         <div className="flex items-center justify-between mb-8">
                             <h3 className="text-white text-lg font-black flex items-center gap-3"><Wallet size={20} className="text-emerald-400" /> Medios de Pago Activos</h3>
                             <button className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2" onClick={() => setIsCreatePayOpen(true)}>
                                 <Plus size={14}/> Añadir
                             </button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {paymentMethods.map(pm => (
                                 <div key={pm.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${pm.is_active ? 'bg-white/[0.03] border-white/5 hover:border-emerald-500/30 shadow-lg shadow-black/20' : 'bg-red-500/5 border-red-500/10 opacity-50'}`}>
                                     {editingPayId === pm.id ? (
                                        <div className="flex items-center gap-2 w-full">
                                            <input className="flex-1 bg-black/40 border border-emerald-500 rounded-lg px-3 py-1.5 text-white text-sm" value={editingPayName} onChange={e => setEditingPayName(e.target.value)} autoFocus />
                                            <button onClick={() => savePayName(pm.id)} className="text-emerald-400 p-0 hover:scale-110 transition-transform"><Check size={20}/></button>
                                            <button onClick={() => setEditingPayId(null)} className="text-rose-400 p-0 hover:scale-110 transition-transform"><X size={20}/></button>
                                        </div>
                                     ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 bg-black/20 rounded-xl text-emerald-400 shadow-inner">{getPaymentIcon(pm.name)}</div>
                                                <div>
                                                    <span className="text-white font-bold tracking-tight">{pm.name}</span>
                                                    {!pm.is_active && <div className="text-[10px] text-rose-500 font-black uppercase mt-0.5 tracking-widest">Inactivo</div>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => handleEditPay(pm)} className="text-slate-500 hover:text-white transition-colors bg-transparent border-none p-1 cursor-pointer"><Edit2 size={15} /></button>
                                                <button onClick={() => togglePay(pm)} className={`transition-colors bg-transparent border-none p-1 cursor-pointer ${pm.is_active ? 'text-slate-600 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}>{pm.is_active ? <Trash2 size={16}/> : <Check size={18}/>}</button>
                                            </div>
                                        </>
                                     )}
                                 </div>
                             ))}
                         </div>
                    </section>
                </div>
            )}

            {isCreateOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => { setIsCreateOpen(false); setEditingExpense(null); }}></div>
                    <form className="relative w-full max-w-lg bg-[#161b27] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200" onSubmit={handleAddExpense}>
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
                            <h2 className="text-white text-xl font-black flex items-center gap-3"><Banknote className="text-[#E2A049]" size={24}/> {editingExpense ? 'Editar Gasto' : 'Declarar Gasto'}</h2>
                            <button type="button" onClick={() => { setIsCreateOpen(false); setEditingExpense(null); }} className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"><X size={20}/></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Fecha de Transacción</label>
                                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors" type="date" name="expense_date" required defaultValue={editingExpense?.expense_date || new Date().toISOString().split('T')[0]} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Familia Principal</label>
                                    <select className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm" name="category_id" required defaultValue={editingExpense?.category_id || ""} onChange={e => setSelectedCatForSub(e.target.value)}>
                                        <option value="">Elegir catálogo...</option>
                                        {categories.filter(c => c.is_active || c.id === editingExpense?.category_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Ítem / Artículo</label>
                                    <select className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm disabled:opacity-30" name="subcategory_id" required defaultValue={editingExpense?.subcategory_id || ""} disabled={!selectedCatForSub && !editingExpense}>
                                        <option value="">Elegir ítem...</option>
                                        {subcategories.filter(s => (s.is_active || s.id === editingExpense?.subcategory_id) && s.category_id === (selectedCatForSub || editingExpense?.category_id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Monto de Operación (CLP)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">$</span>
                                    <input className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors placeholder:text-slate-800" type="number" name="amount" required placeholder="0" defaultValue={editingExpense?.amount || ""} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Medio Utilizado</label>
                                <select className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 transition-colors text-sm" name="payment_method" required defaultValue={editingExpense?.payment_method || ""}>
                                    <option value="">Seleccionar transacción...</option>
                                    {paymentMethods.filter(p => p.is_active || p.name === editingExpense?.payment_method).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Notas de Auditoría</label>
                                <textarea className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors text-sm resize-none" name="notes" rows={3} placeholder="Detalles, facturas o comentarios..." defaultValue={editingExpense?.notes || ""}></textarea>
                            </div>
                            <button type="submit" className="w-full bg-[#E2A049] text-black py-4 rounded-2xl font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-3 disabled:opacity-50" disabled={isPending}>
                                <Save size={18}/>
                                {isPending ? 'Procesando...' : editingExpense ? 'Guardar Cambios' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isCreateCatOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setIsCreateCatOpen(false)}></div>
                    <form className="relative w-full max-w-md bg-[#161b27] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200" onSubmit={handleAddCat}>
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h2 className="text-white text-lg font-black flex items-center gap-3"><Layers className="text-[#E2A049]" size={20}/> Añadir Categoría</h2>
                            <button type="button" onClick={() => setIsCreateCatOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"><X size={18}/></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Nombre de la Categoría</label>
                                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E2A049] transition-colors" placeholder="Ventas, Logística..." value={newCatName} onChange={e => setNewCatName(e.target.value)} required autoFocus />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsCreateCatOpen(false)} className="flex-1 bg-white/5 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform">Cancelar</button>
                                <button type="submit" disabled={isPending || !newCatName} className="flex-1 bg-[#E2A049] text-black py-3 rounded-xl font-black text-sm active:scale-95 transition-transform disabled:opacity-50">Guardar</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {isCreateSubOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setIsCreateSubOpen(false)}></div>
                    <form className="relative w-full max-w-md bg-[#161b27] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200" onSubmit={handleAddSub}>
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h2 className="text-white text-lg font-black flex items-center gap-3"><List className="text-sky-400" size={20}/> Añadir Ítem</h2>
                            <button type="button" onClick={() => setIsCreateSubOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"><X size={18}/></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Familia Principal</label>
                                <select className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-sky-400 transition-colors text-sm" value={selectedCatForSub} onChange={e => setSelectedCatForSub(e.target.value)} required>
                                    <option value="">Seleccionar familia...</option>
                                    {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Nombre del Ítem</label>
                                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-sky-400 transition-colors" placeholder="Ej: Fletes, Insumos barra..." value={newSubName} onChange={e => setNewSubName(e.target.value)} required />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsCreateSubOpen(false)} className="flex-1 bg-white/5 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform">Cancelar</button>
                                <button type="submit" disabled={isPending || !newSubName || !selectedCatForSub} className="flex-1 bg-sky-500 text-white py-3 rounded-xl font-black text-sm active:scale-95 transition-transform disabled:opacity-50">Guardar</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {isCreatePayOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setIsCreatePayOpen(false)}></div>
                    <form className="relative w-full max-w-md bg-[#161b27] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200" onSubmit={handleAddPay}>
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h2 className="text-white text-lg font-black flex items-center gap-3"><Wallet className="text-emerald-400" size={20}/> Añadir Medio de Pago</h2>
                            <button type="button" onClick={() => setIsCreatePayOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"><X size={18}/></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Nombre del Medio de Pago</label>
                                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors" placeholder="Ej: Zelle, Transferencia..." value={newPayName} onChange={e => setNewPayName(e.target.value)} required autoFocus />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsCreatePayOpen(false)} className="flex-1 bg-white/5 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform">Cancelar</button>
                                <button type="submit" disabled={isPending || !newPayName} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-sm active:scale-95 transition-transform disabled:opacity-50">Guardar</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
