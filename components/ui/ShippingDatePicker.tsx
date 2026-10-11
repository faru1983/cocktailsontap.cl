'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, Lock } from 'lucide-react';
import type { ShippingMethodConfig } from '@/lib/shippingMethods';
import {
    getMinSelectableDate,
    isDateBlocked,
    isWeekdayAllowed,
    validateShippingDate,
} from '@/lib/shippingMethods';

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

interface Props {
    id?: string;
    value: string; // 'YYYY-MM-DD'
    onChange: (date: string) => void;
    methodConfig?: ShippingMethodConfig | null;
    fallbackOffsetDays?: number;
    placeholder?: string;
    required?: boolean;
    label?: string;
    helperText?: string;
    className?: string;
    onErrorChange?: (error: string | null) => void;
}

export default function ShippingDatePicker({
    id,
    value,
    onChange,
    methodConfig,
    fallbackOffsetDays = 2,
    placeholder = 'Selecciona una fecha',
    required = false,
    label,
    helperText,
    className = '',
    onErrorChange,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerWrapperRef = useRef<HTMLDivElement>(null);

    const minDate = useMemo(
        () => getMinSelectableDate(methodConfig, fallbackOffsetDays),
        [methodConfig, fallbackOffsetDays]
    );

    // Mes inicial: si hay valor válido se muestra ese mes, si no, el mes de minDate
    const initialDate = useMemo(() => {
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [y, m] = value.split('-').map(Number);
            return new Date(y, m - 1, 1);
        }
        if (minDate && /^\d{4}-\d{2}-\d{2}$/.test(minDate)) {
            const [y, m] = minDate.split('-').map(Number);
            return new Date(y, m - 1, 1);
        }
        return new Date();
    }, [value, minDate]);

    const [viewDate, setViewDate] = useState<Date>(initialDate);

    // Mantener sincronizado viewDate si cambia value externamente
    useEffect(() => {
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [y, m] = value.split('-').map(Number);
            setViewDate(new Date(y, m - 1, 1));
        }
    }, [value]);

    // Validación reactiva
    const validationError = useMemo(() => {
        if (!value) return null;
        return validateShippingDate(value, methodConfig, fallbackOffsetDays);
    }, [value, methodConfig, fallbackOffsetDays]);

    useEffect(() => {
        if (onErrorChange) {
            onErrorChange(validationError);
        }
    }, [validationError, onErrorChange]);

    // Cerrar popover al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Detección dinámica de espacio para abrir hacia arriba o hacia abajo (flip)
    const updatePlacement = useCallback(() => {
        if (!triggerWrapperRef.current) return;
        const rect = triggerWrapperRef.current.getBoundingClientRect();
        const popoverHeight = 340; // Altura estimada del popover

        const spaceBelowViewport = window.innerHeight - rect.bottom;
        const spaceAboveViewport = rect.top;

        // Detectar si está dentro de un contenedor scrollable (ej. modal con overflow-y-auto)
        const scrollParent = triggerWrapperRef.current.closest('.overflow-y-auto, [data-scroll-container]');
        let spaceBelowScroll = spaceBelowViewport;
        let spaceAboveScroll = spaceAboveViewport;

        if (scrollParent) {
            const parentRect = scrollParent.getBoundingClientRect();
            spaceBelowScroll = parentRect.bottom - rect.bottom;
            spaceAboveScroll = rect.top - parentRect.top;
        }

        const effectiveBelow = Math.min(spaceBelowViewport, spaceBelowScroll);
        const effectiveAbove = Math.max(spaceAboveViewport, spaceAboveScroll);

        // Si hacia abajo hay menos de popoverHeight y hacia arriba hay más espacio, abrir hacia arriba
        if (effectiveBelow < popoverHeight && effectiveAbove > effectiveBelow) {
            setPlacement('top');
        } else {
            setPlacement('bottom');
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            updatePlacement();
            window.addEventListener('resize', updatePlacement);
            window.addEventListener('scroll', updatePlacement, true);
            return () => {
                window.removeEventListener('resize', updatePlacement);
                window.removeEventListener('scroll', updatePlacement, true);
            };
        }
    }, [isOpen, updatePlacement]);

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    // Límites de navegación: no retroceder antes del mes de minDate
    const [minYear, minMonthNum] = (minDate || '').split('-').map(Number);
    const canGoPrev = minDate
        ? currentYear > minYear || (currentYear === minYear && currentMonth > minMonthNum - 1)
        : true;

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canGoPrev) return;
        setViewDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(new Date(currentYear, currentMonth + 1, 1));
    };

    // Construcción de la grilla de días del mes
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Día de inicio (0=Lun, 6=Dom)
    const firstDayRaw = new Date(currentYear, currentMonth, 1).getDay();
    const startWeekday = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

    const daysGrid = useMemo(() => {
        const days: Array<{
            dayNumber: number;
            dateStr: string;
            isCurrentMonth: boolean;
            isBlocked: boolean;
            isWeekdayOff: boolean;
            isPastOrTooSoon: boolean;
            isDisabled: boolean;
            isSelected: boolean;
            isToday: boolean;
        }> = [];

        // Relleno de días vacíos previos
        for (let i = 0; i < startWeekday; i++) {
            days.push({
                dayNumber: 0,
                dateStr: '',
                isCurrentMonth: false,
                isBlocked: false,
                isWeekdayOff: false,
                isPastOrTooSoon: false,
                isDisabled: true,
                isSelected: false,
                isToday: false,
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // Días reales del mes
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isPastOrTooSoon = Boolean(minDate && dateStr < minDate);
            const isBlocked = isDateBlocked(dateStr, methodConfig);
            const isWeekdayOff = !isWeekdayAllowed(dateStr, methodConfig);
            const isDisabled = isPastOrTooSoon || isBlocked || isWeekdayOff;
            const isSelected = value === dateStr;
            const isToday = dateStr === todayStr;

            days.push({
                dayNumber: d,
                dateStr,
                isCurrentMonth: true,
                isBlocked,
                isWeekdayOff,
                isPastOrTooSoon,
                isDisabled,
                isSelected,
                isToday,
            });
        }

        return days;
    }, [currentYear, currentMonth, daysInMonth, startWeekday, minDate, methodConfig, value]);

    // Texto descriptivo para la fecha seleccionada en español natural
    const formattedDisplay = useMemo(() => {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const [y, m, d] = value.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d, 12, 0, 0);
        const weekday = dateObj.toLocaleDateString('es-CL', { weekday: 'long' });
        const month = dateObj.toLocaleDateString('es-CL', { month: 'long' });
        const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        return `${capitalizedWeekday}, ${d} de ${month} de ${y}`;
    }, [value]);

    const handleSelectDate = (dateStr: string) => {
        onChange(dateStr);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`flex flex-col ${className}`}>
            {label && (
                <label htmlFor={id} className="block font-bold mb-1 text-brand-text text-[0.8rem]">
                    {label} {required && <span className="text-primary">*</span>}
                </label>
            )}

            <div ref={triggerWrapperRef} className="relative">
                {/* Input Trigger Button */}
                <button
                    id={id}
                    type="button"
                    onClick={() => {
                        updatePlacement();
                        setIsOpen(!isOpen);
                    }}
                    className={`w-full p-2.5 border rounded-xl flex items-center justify-between text-left transition-all bg-white shadow-sm cursor-pointer select-none outline-none ${
                        validationError
                            ? 'border-red-400 ring-2 ring-red-100'
                            : isOpen
                            ? 'border-primary ring-2 ring-primary/10'
                            : 'border-slate-200 hover:border-slate-300'
                    }`}
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Calendar className={`w-4 h-4 shrink-0 ${validationError ? 'text-red-500' : 'text-primary'}`} />
                        <span
                            className={`text-sm truncate ${
                                formattedDisplay
                                    ? 'text-brand-text font-medium'
                                    : 'text-slate-400 font-normal'
                            }`}
                        >
                            {formattedDisplay || placeholder}
                        </span>
                    </div>
                    <div className="flex items-center shrink-0 ml-2">
                        <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                                isOpen ? 'rotate-180 text-primary' : ''
                            }`}
                        />
                    </div>
                </button>

                {/* Popover del Calendario */}
                {isOpen && (
                    <div
                        className={`absolute left-0 w-full sm:w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 animate-fade-in ${
                            placement === 'top'
                                ? 'bottom-full mb-1.5'
                                : 'top-full mt-1.5'
                        }`}
                    >
                    {/* Header: Mes, Año y Controles */}
                    <div className="flex items-center justify-between mb-3 px-1">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            disabled={!canGoPrev}
                            aria-label="Mes anterior"
                            className={`p-1.5 rounded-lg border transition-all ${
                                canGoPrev
                                    ? 'hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'
                                    : 'text-slate-300 border-transparent cursor-not-allowed opacity-40'
                            }`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h4 className="font-bold text-sm text-brand-text capitalize select-none">
                            {MONTH_NAMES[currentMonth]} {currentYear}
                        </h4>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            aria-label="Mes siguiente"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Días de la semana */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                        {WEEKDAY_HEADERS.map((dayName) => (
                            <div
                                key={dayName}
                                className="text-[0.68rem] font-medium text-slate-400 uppercase select-none"
                            >
                                {dayName}
                            </div>
                        ))}
                    </div>

                    {/* Grilla de Días */}
                    <div className="grid grid-cols-7 gap-1 place-items-center">
                        {daysGrid.map((day, idx) => {
                            if (!day.isCurrentMonth) {
                                return <div key={`empty-${idx}`} className="h-8 w-8" />;
                            }

                            if (day.isBlocked) {
                                return (
                                    <div
                                        key={day.dateStr}
                                        title="Fecha bloqueada: sin disponibilidad de despacho"
                                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-normal bg-red-50 text-red-400 line-through cursor-not-allowed select-none relative"
                                    >
                                        <span>{day.dayNumber}</span>
                                        <Lock className="w-2.5 h-2.5 text-red-500 absolute -top-0.5 -right-0.5" />
                                    </div>
                                );
                            }

                            if (day.isDisabled) {
                                return (
                                    <div
                                        key={day.dateStr}
                                        title={day.isPastOrTooSoon ? 'Fecha no cumple la anticipación mínima' : 'Día no disponible para entrega'}
                                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-normal text-slate-300 cursor-not-allowed select-none"
                                    >
                                        {day.dayNumber}
                                    </div>
                                );
                            }

                            return (
                                <button
                                    key={day.dateStr}
                                    type="button"
                                    onClick={() => handleSelectDate(day.dateStr)}
                                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all cursor-pointer select-none ${
                                        day.isSelected
                                            ? 'bg-primary text-white font-bold shadow-sm shadow-primary/30'
                                            : day.isToday
                                            ? 'border border-primary text-primary font-semibold hover:bg-primary/10'
                                            : 'text-slate-700 font-medium hover:bg-primary/10 hover:text-primary'
                                    }`}
                                >
                                    {day.dayNumber}
                                </button>
                            );
                        })}
                    </div>

                    {/* Leyenda y Ayuda */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[0.68rem] text-slate-400 font-normal select-none">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span>Disponible</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                            <span className="text-red-500">Bloqueado</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                            <span>No hábil</span>
                        </div>
                    </div>
                </div>
            )}
            </div>

            {/* Mensajes de validación / ayuda */}
            {validationError ? (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{validationError}</span>
                </p>
            ) : helperText ? (
                <p className="mt-1 text-xs text-slate-400">{helperText}</p>
            ) : null}
        </div>
    );
}
