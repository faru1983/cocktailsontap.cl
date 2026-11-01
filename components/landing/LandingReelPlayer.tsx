'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    RotateCcw,
    Sparkles,
    ArrowDown,
} from 'lucide-react';

interface LandingReelPlayerProps {
    id: string;
    src: string;
    poster: string;
    variant: 'showcase' | 'explainer';
    lazy?: boolean;
    badgeText: string;
    durationHint?: string;
    bottomCaption?: string;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
}

function formatSeconds(sec: number): string {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const whole = Math.floor(sec);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function LandingReelPlayer({
    id,
    src,
    poster,
    variant,
    lazy = false,
    badgeText,
    durationHint = '0:50',
    bottomCaption,
    secondaryActionLabel,
    onSecondaryAction,
}: LandingReelPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hydratedRef = useRef<boolean>(!lazy);
    const userPausedRef = useRef<boolean>(false);
    const hasUnmutedOnceRef = useRef<boolean>(false);
    const reducedMotionRef = useRef<boolean>(false);

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [showPausedOverlay, setShowPausedOverlay] = useState<boolean>(false);
    const [isMuted, setIsMuted] = useState<boolean>(true);
    const [progress, setProgress] = useState<number>(0);
    const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
    const [durationSec, setDurationSec] = useState<number>(0);

    const hydrateMedia = useCallback(() => {
        const video = videoRef.current;
        if (!video || hydratedRef.current) return;

        if (video.dataset.poster) {
            video.poster = video.dataset.poster;
            delete video.dataset.poster;
        }
        if (video.dataset.src) {
            video.src = video.dataset.src;
            delete video.dataset.src;
        }
        video.preload = 'metadata';
        video.load();
        hydratedRef.current = true;
    }, []);

    const announceUnmute = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cot:reel-unmute', { detail: { id } }));
        }
    }, [id]);

    // Sync reduced motion preference + mutual audio exclusion across players
    useEffect(() => {
        const video = videoRef.current;
        if (!video || typeof window === 'undefined') return;

        video.muted = true;

        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        const applyReducedMotion = (prefersReduced: boolean) => {
            reducedMotionRef.current = prefersReduced;
            if (prefersReduced && videoRef.current) {
                videoRef.current.removeAttribute('autoplay');
                videoRef.current.pause();
                setShowPausedOverlay(true);
            }
        };

        applyReducedMotion(mql.matches);
        const onMotionChange = (e: MediaQueryListEvent) => applyReducedMotion(e.matches);
        mql.addEventListener('change', onMotionChange);

        const onOtherUnmute = (e: Event) => {
            const custom = e as CustomEvent<{ id?: string }>;
            if (custom.detail?.id && custom.detail.id !== id && videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
            }
        };
        window.addEventListener('cot:reel-unmute', onOtherUnmute);

        return () => {
            mql.removeEventListener('change', onMotionChange);
            window.removeEventListener('cot:reel-unmute', onOtherUnmute);
        };
    }, [id]);

    // Lazy media fallback (when HTMLMediaElement.prototype.loading is unsupported) + viewport play/pause
    useEffect(() => {
        const video = videoRef.current;
        if (!video || typeof window === 'undefined') return;

        let loadObserver: IntersectionObserver | null = null;

        if (lazy) {
            const supportsLazyMedia = Object.hasOwn(HTMLMediaElement.prototype, 'loading');
            if (supportsLazyMedia) {
                hydrateMedia();
            } else if (typeof IntersectionObserver !== 'undefined') {
                loadObserver = new IntersectionObserver(
                    (entries, obs) => {
                        for (const entry of entries) {
                            if (!entry.isIntersecting) continue;
                            hydrateMedia();
                            obs.unobserve(entry.target);
                        }
                    },
                    { rootMargin: '280px 0px' }
                );
                loadObserver.observe(video);
            } else {
                hydrateMedia();
            }
        }

        let playObserver: IntersectionObserver | null = null;
        if (typeof IntersectionObserver !== 'undefined') {
            playObserver = new IntersectionObserver(
                (entries) => {
                    const entry = entries[0];
                    if (!entry) return;

                    if (entry.isIntersecting) {
                        if (!reducedMotionRef.current && !userPausedRef.current && hydratedRef.current) {
                            video.play().catch(() => setShowPausedOverlay(true));
                        }
                    } else if (!video.paused) {
                        video.pause();
                    }
                },
                { threshold: 0.25 }
            );
            playObserver.observe(video);
        } else if (!lazy && !reducedMotionRef.current) {
            video.play().catch(() => setShowPausedOverlay(true));
        }

        return () => {
            loadObserver?.disconnect();
            playObserver?.disconnect();
        };
    }, [lazy, hydrateMedia]);

    const handleStartExplainerWithSound = () => {
        const video = videoRef.current;
        if (!video) return;
        hydrateMedia();
        announceUnmute();
        userPausedRef.current = false;
        if (!hasUnmutedOnceRef.current) {
            video.currentTime = 0;
            hasUnmutedOnceRef.current = true;
        }
        video.muted = false;
        setIsMuted(false);
        video.play().catch(() => {});
    };

    const handleToggleMute = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        hydrateMedia();

        if (video.muted) {
            if (variant === 'explainer' && !hasUnmutedOnceRef.current) {
                handleStartExplainerWithSound();
                return;
            }
            announceUnmute();
            userPausedRef.current = false;
            video.muted = false;
            setIsMuted(false);
            if (video.paused) {
                video.play().catch(() => {});
            }
        } else {
            video.muted = true;
            setIsMuted(true);
        }
    };

    const handleTogglePlay = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        hydrateMedia();

        if (video.paused) {
            userPausedRef.current = false;
            setShowPausedOverlay(false);
            video.play().catch(() => setShowPausedOverlay(true));
        } else {
            userPausedRef.current = true;
            setShowPausedOverlay(true);
            video.pause();
        }
    };

    const handleRestartWithSound = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        hydrateMedia();
        announceUnmute();
        hasUnmutedOnceRef.current = true;
        userPausedRef.current = false;
        video.currentTime = 0;
        video.muted = false;
        setIsMuted(false);
        video.play().catch(() => {});
    };

    const handleVideoSurfaceClick = () => {
        if (variant === 'explainer' && isMuted) {
            handleStartExplainerWithSound();
            return;
        }
        handleTogglePlay();
    };

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video || !video.duration) return;
        setCurrentTimeSec(video.currentTime);
        setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
    };

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;
        if (Number.isFinite(video.duration) && video.duration > 0) {
            setDurationSec(video.duration);
        }
        // If lazy video hydrated while already visible in viewport, start silent preview
        if (lazy && !reducedMotionRef.current && !userPausedRef.current && video.paused) {
            const rect = video.getBoundingClientRect();
            const inView = rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15;
            if (inView) {
                video.play().catch(() => setShowPausedOverlay(true));
            }
        }
    };

    const formattedDuration = durationSec > 0 ? formatSeconds(durationSec) : durationHint;

    return (
        <div className="w-full max-w-[330px] sm:max-w-[365px] rounded-[1.85rem] bg-zinc-900/95 border border-white/15 p-2.5 sm:p-3 shadow-[0_25px_70px_rgba(0,0,0,0.75)]">
            {/* 9:16 Vertical Reel Canvas — clean center/bottom so burned-in captions are never covered */}
            <div
                onClick={handleVideoSurfaceClick}
                className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden bg-zinc-950 cursor-pointer select-none group"
            >
                <video
                    ref={videoRef}
                    width={405}
                    height={720}
                    autoPlay={!lazy}
                    muted
                    loop
                    playsInline
                    preload={lazy ? 'none' : 'metadata'}
                    poster={lazy ? undefined : poster}
                    src={lazy ? undefined : src}
                    data-poster={lazy ? poster : undefined}
                    data-src={lazy ? src : undefined}
                    {...(lazy ? ({ loading: 'lazy' } as React.VideoHTMLAttributes<HTMLVideoElement>) : {})}
                    onPlay={() => {
                        setIsPlaying(true);
                        setShowPausedOverlay(false);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full h-full object-fill"
                />

                {/* Subtle top-only vignette for top HUD legibility (leaves center & subtitles 100% clear) */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/75 via-black/30 to-transparent"
                />

                {/* Stories-style live progress bar */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-2.5 inset-x-3 h-1 rounded-full bg-white/25 overflow-hidden"
                >
                    <div
                        className="h-full bg-primary transition-[width] duration-150 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Top HUD Bar */}
                <div className="absolute top-5 inset-x-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-[0.68rem] font-extrabold text-amber-300">
                        <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>{badgeText}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleTogglePlay}
                            aria-label={isPlaying ? 'Pausar video' : 'Reproducir video'}
                            className="w-8 h-8 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                            {isPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleToggleMute}
                            aria-label={isMuted ? 'Activar sonido del video' : 'Silenciar video'}
                            className={`h-8 px-2.5 rounded-full backdrop-blur-md border text-[0.68rem] font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                isMuted
                                    ? 'bg-black/65 hover:bg-black/85 border-white/20 text-white'
                                    : 'bg-primary text-slate-950 border-primary shadow-md'
                            }`}
                        >
                            {isMuted ? (
                                <>
                                    <VolumeX className="w-3.5 h-3.5 shrink-0" />
                                    <span>{variant === 'explainer' ? 'Audio OFF' : 'Audio'}</span>
                                </>
                            ) : (
                                <>
                                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Audio ON</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Center play indicator ONLY when paused by user, Low Power Mode, or reduced-motion */}
                {showPausedOverlay && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                        <div className="w-14 h-14 rounded-full bg-primary/95 text-slate-950 flex items-center justify-center shadow-[0_8px_30px_rgba(226,160,73,0.5)]">
                            <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
                        </div>
                    </div>
                )}
            </div>

            {/* Docked Control Footer Below Video — Zero overlap with video frame or captions */}
            {variant === 'showcase' ? (
                <div className="mt-2.5 px-1 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={handleToggleMute}
                        className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer min-w-0"
                    >
                        {isMuted ? (
                            <VolumeX className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : (
                            <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">
                            {bottomCaption || (isMuted ? 'Toca para escuchar ambiente' : 'Sonido ambiente activo')}
                        </span>
                    </button>

                    {secondaryActionLabel && onSecondaryAction && (
                        <button
                            type="button"
                            onClick={onSecondaryAction}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-primary hover:text-slate-950 border border-white/15 text-[0.68rem] font-black text-amber-300 transition-colors cursor-pointer shrink-0"
                        >
                            <span>{secondaryActionLabel}</span>
                            <ArrowDown className="w-3 h-3 shrink-0" />
                        </button>
                    )}
                </div>
            ) : (
                <div className="mt-2.5">
                    {isMuted ? (
                        <button
                            type="button"
                            onClick={handleStartExplainerWithSound}
                            className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-primary to-[#d98a2b] hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(226,160,73,0.3)] transition-all active:scale-98 cursor-pointer"
                        >
                            <Volume2 className="w-4 h-4 shrink-0" />
                            <span>Escuchar explicación desde el inicio ({formattedDuration})</span>
                        </button>
                    ) : (
                        <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleTogglePlay}
                                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    {isPlaying ? (
                                        <>
                                            <Pause className="w-3.5 h-3.5 fill-current" />
                                            <span>Pausar</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                            <span>Seguir</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRestartWithSound}
                                    title="Volver al inicio"
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                    aria-label="Reiniciar explicación desde cero"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={handleToggleMute}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[0.7rem] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <VolumeX className="w-3.5 h-3.5" />
                                    <span>Silenciar</span>
                                </button>
                            </div>

                            <span className="text-[0.7rem] font-mono font-bold text-zinc-400 tabular-nums shrink-0">
                                {formatSeconds(currentTimeSec)} / {formattedDuration}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
