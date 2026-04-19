'use client';

import React from 'react';
import { useMultitasking, type OpenTask } from './multitasking-context';
import { cn } from '@/lib/utils';
import { 
    X, 
    Plus, 
    LayoutDashboard, 
    Car, 
    User, 
    ClipboardList, 
    ShieldAlert, 
    FileText, 
    Search,
    ChevronUp,
    FolderOpen,
    Handshake,
    Calendar,
    Wrench,
    Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { usePathname, useRouter } from 'next/navigation';

const typeIcons: Record<OpenTask['type'] | string, any> = {
    dashboard: LayoutDashboard,
    vehicle: Car,
    driver: User,
    task: ClipboardList,
    event: ShieldAlert,
    contract: FileText,
    other: FileText,
    'fahrzeuguebergabe': Handshake,
    'dokumente': FolderOpen,
    'kalender': Calendar,
    'wartung': Wrench,
    'schaeden': ShieldAlert
};

const typeColors: Record<OpenTask['type'] | string, string> = {
    dashboard: 'text-blue-500',
    vehicle: 'text-indigo-500',
    driver: 'text-green-500',
    task: 'text-orange-500',
    event: 'text-red-500',
    contract: 'text-purple-500',
    other: 'text-slate-500',
    'fahrzeuguebergabe': 'text-emerald-500',
    'dokumente': 'text-blue-400',
    'kalender': 'text-rose-500',
    'wartung': 'text-amber-600',
    'schaeden': 'text-red-600'
};

const typeLabels: Record<OpenTask['type'] | string, string> = {
    vehicle: 'Fahrzeug',
    driver: 'Fahrer',
    task: 'Aufgabe',
    event: 'Ereignis',
    contract: 'Vertrag',
    dashboard: 'Dashboard',
    'fahrzeuguebergabe': 'Übergabe',
    'dokumente': 'Archiv',
    'kalender': 'Kalender',
    'wartung': 'Wartung',
    'schaeden': 'Schäden',
    other: 'Ansicht'
};

export function Taskbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { tasks, activeTaskId, removeTask, switchTask } = useMultitasking();
    const { vehicles, drivers, tasks: allTasks, events, contracts } = useDashboardData();

    const isDashboardActive = pathname === '/dashboard';

    const getTaskTitle = (task: OpenTask) => {
        const pathParts = task.path.split('/');
        const id = pathParts.pop();

        if (task.path === '/dashboard') return 'Dashboard';
        if (task.path === '/fahrzeuge') return 'Fahrzeuge';
        if (task.path === '/fahrer') return 'Fahrer';
        if (task.path === '/aufgaben') return 'Aufgaben';
        if (task.path === '/ereignisse') return 'Ereignisse';
        if (task.path === '/vertraege') return 'Verträge';
        if (task.path === '/fahrzeuguebergabe') return 'Übergaben';
        if (task.path === '/dokumente') return 'Dokumente';
        if (task.path === '/kalender') return 'Kalender';
        if (task.path === '/wartung') return 'Wartung';
        if (task.path === '/schaeden') return 'Schäden';

        if (!id) return task.title;

        switch (task.type) {
            case 'vehicle': 
                const v = vehicles.find(v => v.id === id);
                return v ? v.license_plate : task.title;
            case 'driver':
                const d = drivers.find(d => d.id === id);
                return d ? `${d.first_name} ${d.last_name}` : task.title;
            case 'task':
                const t = allTasks.find(t => t.id === id);
                return t ? t.title : task.title;
            case 'event':
                const e = events.find(e => e.id === id);
                return e ? e.title : task.title;
            case 'contract':
                const c = contracts.find(c => c.id === id);
                return c ? (c.providerName || 'Vertrag') : task.title;
            default: return task.title;
        }
    };

    return (
        <div className="relative z-50 w-full border-t bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shadow-[0_-4px_30px_-5px_rgba(0,0,0,0.2)]">
            <div className="flex items-center h-14 px-2 gap-1 overflow-hidden max-w-screen-2xl mx-auto">
                
                <TooltipProvider>
                    {/* Fixed Home Button */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div 
                                onClick={() => router.push('/dashboard')}
                                className={cn(
                                    "flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-200 cursor-pointer shrink-0",
                                    isDashboardActive 
                                        ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                                        : "text-muted-foreground hover:bg-muted/60"
                                )}
                            >
                                <Home className={cn("h-5 w-5", isDashboardActive ? "text-white" : "text-primary")} />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="font-bold">Dashboard</TooltipContent>
                    </Tooltip>

                    <div className="h-8 w-px bg-border/60 mx-2 shrink-0" />

                    <ScrollArea className="flex-1 w-full whitespace-nowrap overflow-hidden">
                        <div className="flex items-center gap-1.5 h-14">
                            {tasks.map((task) => {
                                const isActive = activeTaskId === task.id;
                                const pathParts = task.path.split('/');
                                const pathKey = pathParts[1];
                                const Icon = typeIcons[pathKey] || typeIcons[task.type] || FileText;
                                const iconColor = typeColors[pathKey] || typeColors[task.type] || typeColors.other;
                                const fullTitle = getTaskTitle(task);
                                const displayTitle = fullTitle.length > 15 ? fullTitle.substring(0, 12) + '...' : fullTitle;
                                const label = typeLabels[pathKey] || typeLabels[task.type] || typeLabels.other;

                                return (
                                    <Tooltip key={task.id}>
                                        <TooltipTrigger asChild>
                                            <div 
                                                className={cn(
                                                    "group relative flex items-center h-11 px-4 rounded-xl transition-all duration-200 cursor-pointer select-none",
                                                    isActive 
                                                        ? "bg-primary text-primary-foreground shadow-lg scale-[1.02] z-10" 
                                                        : "text-muted-foreground hover:bg-muted/60 border border-transparent hover:border-primary/10"
                                                )}
                                                onClick={() => switchTask(task.id)}
                                            >
                                                <div className={cn(
                                                    "p-1.5 rounded-lg mr-2.5",
                                                    isActive ? "bg-white/20" : "bg-muted/50"
                                                )}>
                                                    <Icon className={cn("h-4 w-4", isActive ? "text-white" : iconColor)} />
                                                </div>
                                                
                                                <span className={cn(
                                                    "text-xs font-black tracking-tight mr-2.5 truncate max-w-[140px]",
                                                    isActive ? "text-white" : "text-foreground/80"
                                                )}>
                                                    {displayTitle}
                                                </span>
                                                
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                                                    className={cn(
                                                        "ml-auto p-1 rounded-full transition-all",
                                                        isActive ? "text-white/60 hover:text-white hover:bg-white/20" : "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                                                    )}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>

                                                {isActive && (
                                                    <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-white/80 rounded-full" />
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="flex flex-col gap-0.5 p-2 bg-zinc-900 text-white border-zinc-800 shadow-2xl">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">{label}</span>
                                            <span className="text-xs font-bold">{fullTitle}</span>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                        <ScrollBar orientation="horizontal" className="hidden" />
                    </ScrollArea>
                </TooltipProvider>

                <div className="h-8 w-px bg-border/60 mx-2 shrink-0" />

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-11 w-11 rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all duration-200 shrink-0 shadow-sm"
                                onClick={() => {
                                    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                                    document.dispatchEvent(event);
                                }}
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="font-bold">Suche / Neu (Cmd+K)</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}
