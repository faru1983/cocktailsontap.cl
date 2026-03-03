export default function CotizarLoading() {
    return (
        <main className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-brand-text-muted font-bold tracking-tight text-lg animate-pulse">
                Preparando tu experiencia...
            </p>
        </main>
    );
}
