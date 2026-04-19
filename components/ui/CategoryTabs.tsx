'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  children?: React.ReactNode; // Espacio extra para el carrito o botones
  stickyTop?: string; // Valor de 'top' para sticky (ej: 'top-0' o 'top-[85px]')
  fullWidth?: boolean; // Si debe romper el contenedor padre para ir de borde a borde
}

const CategoryTabs = React.forwardRef<HTMLDivElement, CategoryTabsProps>(({ 
  categories, 
  activeCategory, 
  onCategoryChange, 
  children,
  stickyTop = 'top-0',
  fullWidth = false
}, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Verificar si hay scroll horizontal para mostrar los degradados (fades)
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const canScrollLeft = el.scrollLeft > 5;
      const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 5;
      setShowLeftFade(canScrollLeft);
      setShowRightFade(canScrollRight);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      // Ejecutar inicial y en cambios de ventana
      checkScroll();
      window.addEventListener('resize', checkScroll);
      
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [checkScroll, categories]);

  // Asegurar que el botón activo sea visible al cambiar
  useEffect(() => {
    const activeBtn = scrollContainerRef.current?.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  return (
    <div 
      ref={ref} 
      className={`sticky ${stickyTop} z-50 bg-white/95 backdrop-blur-md border-b border-brand-border/50 shadow-sm transition-all duration-300
        ${fullWidth ? '-mx-4 sm:-mx-6 lg:-mx-8' : ''}
      `}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 py-2.5">
          
          {/* Contenedor con degradados laterales */}
          <div className="relative flex-1 min-w-0 overflow-hidden">
            
            {/* Fade Izquierdo */}
            <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeftFade ? 'opacity-100' : 'opacity-0'}`} />
            
            {/* Contenedor de scroll */}
            <div 
              ref={scrollContainerRef}
              className="flex gap-2 overflow-x-auto pb-1 scrollbar-none hide-scrollbar scroll-smooth"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            >
              {categories.map((cat) => {
                const isActive = cat === activeCategory;
                return (
                  <button
                    key={cat}
                    type="button"
                    data-active={isActive}
                    onClick={() => onCategoryChange(cat)}
                    className={`px-5 py-2.5 rounded-full border-2 font-bold text-[0.9rem] whitespace-nowrap transition-all duration-300 cursor-pointer flex-shrink-0
                      ${isActive
                        ? 'bg-primary border-primary text-white shadow-[0_4px_12px_rgba(226,160,73,0.3)] scale-100'
                        : 'bg-white border-brand-border text-brand-text hover:bg-primary/5 hover:border-primary/50 hover:text-primary active:scale-95'
                      }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Fade Derecho */}
            <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRightFade ? 'opacity-100' : 'opacity-0'}`} />
          </div>

          {/* Slot para el carrito o elementos adicionales */}
          {children && (
            <div className="flex-shrink-0 pl-2 border-l border-brand-border/30">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CategoryTabs;
