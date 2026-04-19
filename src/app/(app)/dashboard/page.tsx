'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ClipboardList, Users, ShieldAlert, BadgeCheck, Sparkles, TrendingUp, Euro, UserCircle, ArrowRight, Clock, Car as CarIcon, Mic, User, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UpcomingReminders } from '@/components/dashboard/upcoming-reminders';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { useMemo, useState } from 'react';
import { format, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import Link from 'next/link';
import { UpcomingContracts } from '@/components/dashboard/upcoming-contracts';
import { Button } from '@/components/ui/button';
import { GlobalAIAssistant } from '@/components/ai/global-ai-assistant';
import { useSession } from '@/hooks/use-session';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// --- Helper Functions ---
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

const getKpiColor = (value: number, isOverdue: boolean) => {
    if (isOverdue && value > 0) return 'text-red-500';
    return 'text-muted-foreground';
};


// --- Main Dashboard Component ---
export default function DashboardPage() {
    const { kpis, incidentTrend, monthlyCosts, tasks, vehicles, isLoading } = useDashboardData();
    const { session } = useSession();
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

    // --- Chart Data Processing ---
    const monthlyCostsData = useMemo(() => {
        if (!monthlyCosts) return [];
        return [
            { name: 'Leasing', Kosten: monthlyCosts.leasing, fill: 'hsl(var(--primary))' },
            { name: 'Finanzierung', Kosten: monthlyCosts.financing, fill: 'hsl(var(--primary) / 0.7)' },
            { name: 'Wartung', Kosten: monthlyCosts.maintenance, fill: 'hsl(var(--primary) / 0.4)' },
            { name: 'Schäden', Kosten: monthlyCosts.damages, fill: 'hsl(var(--destructive))' }
        ];
    }, [monthlyCosts]);

    const myOpenTasks = useMemo(() => {
        if (!tasks || !session) return [];
        return tasks
            .filter(t => t.status !== 'done' && t.assignee_name === session.name)
            .slice(0, 6); // Zeige bis zu 6 Aufgaben im Grid
    }, [tasks, session]);

    const vehiclesMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);

    const kpiCards = [
        { title: 'Schäden', icon: ShieldAlert, value: kpis.openDamagesCount, subValue: 'Offen', color: kpis.openDamagesCount > 0 ? 'text-red-500 font-bold' : 'text-muted-foreground', href: '/schaeden' },
        { 
            title: 'Aufgaben', 
            icon: ClipboardList, 
            value: kpis.openTasksCount, 
            subValue: kpis.myOpenTasksCount > 0 ? `${kpis.myOpenTasksCount} für mich` : `${kpis.overdueTasksCount} überfällig`, 
            color: kpis.myOpenTasksCount > 0 ? 'text-primary font-bold' : getKpiColor(kpis.overdueTasksCount, true), 
            href: '/aufgaben' 
        },
        { title: 'Fahrer', icon: Users, value: kpis.totalDriversCount, subValue: 'Registriert', color: '', href: '/fahrer' },
        { title: 'Termine', icon: BadgeCheck, value: kpis.openRemindersCount, subValue: `${kpis.overdueRemindersCount} überfällig`, color: getKpiColor(kpis.overdueRemindersCount, true), href: '/kalender' },
    ];
    
    return (
        <>
        <div className="flex flex-col gap-4 md:gap-6">
            <div className="flex items-center justify-between gap-4 px-1 md:px-0">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">Willkommen zurück, <span className="font-bold text-foreground">{session?.name}</span></p>
                </div>
                <Button 
                    onClick={() => setIsAIAssistantOpen(true)}
                    className="bg-primary shadow-lg hover:bg-primary/90 h-10 md:h-11 px-3 md:px-6 rounded-xl animate-in fade-in slide-in-from-top-2 duration-500"
                >
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Flotten-KI fragen</span>
                    <span className="sm:hidden">KI</span>
                </Button>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {kpiCards.map((kpi, index) => (
                   <Link href={kpi.href} key={index}>
                    <Card className="transition-all hover:shadow-md active:scale-95 hover:bg-accent h-full border-primary/10">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-6 pb-1 md:pb-2">
                            <CardTitle className="text-[10px] md:text-sm font-black uppercase tracking-widest text-muted-foreground/70">
                                {kpi.title}
                            </CardTitle>
                            <kpi.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary/60" />
                        </CardHeader>
                        <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                            {isLoading ? (
                                <div className='space-y-1'>
                                    <Skeleton className="h-6 md:h-8 w-1/2" />
                                    <Skeleton className="h-3 md:h-4 w-3/4" />
                                </div>
                            ) : (
                                <>
                                    <div className="text-xl md:text-3xl font-black tracking-tighter">{kpi.value}</div>
                                    <p className={`text-[10px] md:text-xs truncate ${kpi.color || 'text-muted-foreground font-medium'}`}>
                                        {kpi.subValue}
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                   </Link>
                ))}
            </div>

            {/* Optimized Personal Tasks Section */}
            <Card className="border-primary/20 shadow-lg w-full bg-gradient-to-br from-background to-primary/5">
                <CardHeader className="pb-4 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            Meine aktuellen Aufgaben
                        </CardTitle>
                        <CardDescription className="text-xs uppercase font-bold tracking-widest mt-1">Dir persönlich zugewiesen</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="text-primary font-bold">
                        <Link href="/aufgaben">Alle anzeigen <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-6">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Skeleton className="h-32 w-full rounded-2xl" />
                            <Skeleton className="h-32 w-full rounded-2xl" />
                            <Skeleton className="h-32 w-full rounded-2xl" />
                        </div>
                    ) : myOpenTasks.length === 0 ? (
                        <div className="py-12 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-primary/10">
                            <div className="p-4 bg-primary/5 rounded-full w-fit mx-auto mb-3">
                                <BadgeCheck className="h-8 w-8 text-primary/40" />
                            </div>
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em]">Hervorragend! Alles erledigt.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myOpenTasks.map(task => {
                                const v = task.vehicleId ? vehiclesMap.get(task.vehicleId) : null;
                                const isOverdue = task.due_date && isPast(task.due_date.toDate());
                                
                                return (
                                    <Link href={`/aufgaben/${task.id}`} key={task.id}>
                                        <div className={cn(
                                            "group p-4 rounded-2xl border bg-card hover:border-primary/50 hover:shadow-xl transition-all flex flex-col justify-between gap-4 h-full relative overflow-hidden",
                                            isOverdue ? "border-destructive/30 bg-destructive/[0.02]" : "border-primary/10"
                                        )}>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className="text-sm font-black leading-tight line-clamp-2 tracking-tight group-hover:text-primary transition-colors">
                                                        {task.title}
                                                    </p>
                                                    {isOverdue && <Badge variant="destructive" className="h-5 px-1.5 text-[8px] uppercase font-black animate-pulse">Überfällig</Badge>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline" className="text-[9px] px-2 h-5 font-black uppercase tracking-tighter bg-muted/50 border-primary/5 text-muted-foreground">
                                                        <Clock className="h-2.5 w-2.5 mr-1" />
                                                        {format(task.due_date.toDate(), 'dd. MMM', { locale: de })}
                                                    </Badge>
                                                    {v && (
                                                        <Badge variant="outline" className="text-[9px] px-2 h-5 font-black uppercase tracking-tighter border-primary/20 text-primary bg-primary/5">
                                                            <CarIcon className="h-2.5 w-2.5 mr-1" />
                                                            {v.license_plate}
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Meta Info: Creator and Creation Date */}
                                                <div className="pt-2 flex flex-col gap-1 opacity-70">
                                                    <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                                                        <User className="h-2 w-2" />
                                                        <span>Zugewiesen von: {task.created_by_name || 'System'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                                                            <Calendar className="h-2 w-2" />
                                                            <span>Am: {task.created_at ? format(task.created_at.toDate(), 'dd.MM.yyyy HH:mm', { locale: de }) : '-'}</span>
                                                        </div>
                                                        {(task as any).created_via === 'voice' && (
                                                            <div className="flex items-center gap-1 text-[7px] font-black uppercase text-primary">
                                                                <Mic className="h-2 w-2" /> KI
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-primary/5">
                                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Details ansehen</span>
                                                <ArrowRight className="h-4 w-4 text-primary/40 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Upcoming Reminders - Full Width */}
            <div className="w-full">
                <UpcomingReminders />
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6">
                <UpcomingContracts />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <Card className="col-span-1 border-primary/10">
                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-base md:text-lg flex items-center gap-2 font-black">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Vorfall-Trend
                        </CardTitle>
                        <CardDescription className="text-xs">Letzte 3 Monate im Vergleich.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 md:p-6 pt-0">
                         {isLoading ? (
                            <Skeleton className="h-[200px] md:h-[250px] w-full rounded-xl" />
                        ) : (
                             <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={incidentTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip 
                                        cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }}
                                        contentStyle={{ borderRadius: 'var(--radius)', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                    <Bar name="Schäden" dataKey="damages" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                                    <Bar name="Unfälle" dataKey="accidents" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-1 border-primary/10">
                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-base md:text-lg flex items-center gap-2 font-black">
                            <Euro className="h-5 w-5 text-primary" />
                            Fixkosten (Monat)
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {format(new Date(), 'MMMM yyyy', { locale: de })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 md:p-6 pt-0">
                         {isLoading ? (
                            <Skeleton className="h-[200px] md:h-[250px] w-full rounded-xl" />
                        ) : (
                             <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={monthlyCostsData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={80} tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <Tooltip
                                        cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }}
                                        formatter={(value: number) => [formatCurrency(value), 'Kosten']}
                                        contentStyle={{ borderRadius: 'var(--radius)', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                    />
                                    <Bar dataKey="Kosten" barSize={30} radius={[0, 4, 4, 0]}>
                                         {monthlyCostsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>

        <GlobalAIAssistant 
            isOpen={isAIAssistantOpen}
            onOpenChange={setIsAIAssistantOpen}
        />
        </>
    );
}
