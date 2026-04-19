'use client';
import { cn } from "@/lib/utils";

type PhotoGuidanceImageProps = {
  view: 'front' | 'rear' | 'left' | 'right' | 'mirror_left' | 'mirror_right';
  className?: string;
};

export function PhotoGuidanceImage({ view, className }: PhotoGuidanceImageProps) {
  return (
    <div className={cn("w-48 h-32 mx-auto border-2 border-dashed rounded-md p-2", className)}>
        <svg viewBox="0 0 100 60" className="w-full h-full">
            <defs>
                <style>{`.highlight { fill: hsl(var(--primary) / 0.5); }`}</style>
            </defs>
            {/* Car body */}
            <rect x="10" y="20" width="80" height="30" rx="5" fill="hsl(var(--muted-foreground))" opacity="0.3" />
            {/* Roof */}
            <path d="M25 20 L30 10 L70 10 L75 20 Z" fill="hsl(var(--muted-foreground))" opacity="0.3" />
            
            {/* Highlights */}
            {view === 'front' && <rect x="9" y="19" width="3" height="32" className="highlight" />}
            {view === 'rear' && <rect x="88" y="19" width="3" height="32" className="highlight" />}
            {view === 'left' && <rect x="10" y="19" width="80" height="3" className="highlight" />}
            {view === 'right' && <rect x="10" y="48" width="80" height="3" className="highlight" />}
            {view === 'mirror_left' && <circle cx="28" cy="18" r="4" className="highlight" />}
            {view === 'mirror_right' && <circle cx="72" cy="18" r="4" className="highlight" />}
        </svg>
    </div>
  );
}
