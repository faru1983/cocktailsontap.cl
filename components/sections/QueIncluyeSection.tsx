import { Wine, Droplets, Snowflake, Leaf, GlassWater, Martini, Infinity } from 'lucide-react';

const ITEMS = [
    { icon: Wine, label: 'Cócteles Previamente Seleccionados' },
    { icon: Droplets, label: 'Sistema de Dispensador autoservicio' },
    { icon: Snowflake, label: 'Hielo suficiente para todo el evento' },
    { icon: Leaf, label: 'Decoraciones (garnish) deshidratadas' },
    { icon: GlassWater, label: 'Préstamo de vasos y/o copas' },
    { icon: Martini, label: 'Accesorios de bar: hieleras, palas, pinzas y más' },
    { icon: Infinity, label: '¡Sin límite de tiempo! Tú indicas el horario de retiro' },
];


export default function QueIncluyeSection() {
    return (
        <section className="py-14 bg-brand-bg" id="que-incluye">
            <div className="max-w-[1200px] mx-auto px-6">
                <div className="text-center mb-12">
                    <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold text-brand-text">
                        ¿Qué incluye nuestro servicio?
                    </h2>
                    <div className="w-[60px] h-1 bg-gradient-to-r from-primary to-primary-dark rounded-[2px] mx-auto mt-4" />
                    <p className="max-w-[800px] mx-auto mt-6 text-brand-text-muted text-[1.1rem]">
                        Todo esto sin costos adicionales. Y nos encargamos de la instalación horas antes del inicio de tu evento
                        y del retiro una vez finalizado, para que tú solo te preocupes de disfrutar.
                    </p>
                </div>

                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-4xl mx-auto list-none">
                    {ITEMS.map((item, i) => (
                        <li
                            key={item.label}
                            className="bg-brand-card px-6 py-4 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-brand-border flex items-center gap-4 text-brand-text font-medium text-[1.05rem] transition-transform duration-300 hover:-translate-y-[2px] hover:shadow-[0_4px_15px_rgba(0,0,0,0.06)] hover:border-primary/50"
                        >
                            <item.icon className="text-primary w-6 h-6 text-center animate-pulse" style={{ animationDelay: `${i * 0.25}s` }} />

                            {item.label}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
