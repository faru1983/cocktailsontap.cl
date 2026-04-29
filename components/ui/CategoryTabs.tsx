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

  // Función para scroll manual mediante flechas
  const scrollManual = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.6;
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      // Ejecutar inicial y en cambios de ventana
      checkScroll();
      window.addEventListener('resize', checkScroll);
      
      // Pequeño bounce de descubrimiento al cargar
      setTimeout(() => {
        if (el.scrollWidth > el.clientWidth) {
          el.scrollBy({ left: 40, behavior: 'smooth' });
          setTimeout(() => {
            el.scrollBy({ left: -40, behavior: 'smooth' });
          }, 400);
        }
      }, 800);

      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [checkScroll, categories]);

  // Asegurar que el botón activo sea visible al cambiar
  const isFirstRender = useRef(true);
  useEffect(() => {
    const activeBtn = scrollContainerRef.current?.querySelector('[data-active="true"]') as HTMLElement;
    const container = scrollContainerRef.current;
    
    if (activeBtn && container) {
      // Evitar scroll en la carga inicial si es el primer elemento (no es necesario y evita saltos de página)
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }

      const scrollLeft = activeBtn.offsetLeft - (container.clientWidth / 2) + (activeBtn.clientWidth / 2);
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [activeCategory]);

  return (
    <div 
      ref={ref} 
      className={`sticky ${stickyTop} z-50 bg-white/95 backdrop-blur-md border-b border-brand-border/50 shadow-sm transition-all duration-300
        ${fullWidth ? 'w-[100vw] ml-[calc(50%-50vw)]' : ''}
      `}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4 py-2.5">
          
          {/* Contenedor con degradados laterales y flechas */}
          <div className="relative flex-1 min-w-0 overflow-hidden group">
            
            {/* Control Izquierdo (Fade + Flecha) */}
            <div className={`absolute left-0 top-0 bottom-0 z-20 flex items-center transition-all duration-300 pointer-events-none ${showLeftFade ? 'opacity-100' : 'opacity-0'}`}>
              <div className="w-12 h-full bg-gradient-to-r from-white via-white/80 to-transparent" />
              <button 
                onClick={() => scrollManual('left')}
                className="absolute left-0 w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md border border-brand-border/50 text-primary pointer-events-auto hover:bg-primary hover:text-white transition-colors ml-1"
                aria-label="Scroll izquierda"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
            
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
              {/* Espaciador final para permitir que el último item no quede tapado por el fade/flecha derecho */}
              <div className="w-8 flex-shrink-0" />
            </div>

            {/* Control Derecho (Fade + Flecha) */}
            <div className={`absolute right-0 top-0 bottom-0 z-20 flex items-center transition-all duration-300 pointer-events-none ${showRightFade ? 'opacity-100' : 'opacity-0'}`}>
              <div className="w-12 h-full bg-gradient-to-l from-white via-white/80 to-transparent" />
              <button 
                onClick={() => scrollManual('right')}
                className="absolute right-0 w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md border border-brand-border/50 text-primary pointer-events-auto hover:bg-primary hover:text-white transition-colors mr-1"
                aria-label="Scroll derecha"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Slot para el carrito o elementos adicionales */}
          {children && (
            <div className="flex-shrink-0 pl-2 border-l border-brand-border/30 cart-button-target">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CategoryTabs;
