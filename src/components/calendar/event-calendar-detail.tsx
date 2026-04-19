'use client';

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarEvent, Holiday } from './event-calendar';
import { reminderKindTranslations, reminderKindColors, kindIcons } from './utils';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { PartyPopper, CalendarDays, ExternalLink, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';


interface EventCalendarDetailProps {
    selectedDay: Date | undefined;
    events: CalendarEvent[];
    holidays: Holiday[];
    isLoading: boolean;
}

export function EventCalendarDetail({ selectedDay, events, holidays, isLoading }: EventCalendarDetailProps) {
    const router = useRouter();

    if (!selectedDay) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 opacity-50">
                <CalendarDays className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-medium">Wählen Sie einen Tag aus, um die Details anzuzeigen.</p>
            </div>
        );
    }

    const selectedDayStr = selectedDay.toISOString().split('T')[0];
    const holidayOnDay = holidays.find(h => h.date.toISOString().split('T')[0] === selectedDayStr);
    
    const handleNavigate = (event: CalendarEvent) => {
        if (event.link) {
            router.push(event.link);
            return;
        }
        const link = event.vehicleId ? `/fahrzeuge/${event.vehicleId}` : event.driverId ? `/fahrer/${event.driverId}` : null;
        if (link) {
            router.push(link);
        }
    }

    const totalItems = events.length + (holidayOnDay ? 1 : 0);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="space-y-1">
                <h3 className="text-2xl font-bold text-foreground">
                    {format(selectedDay, 'dd.', { locale: de })}
                </h3>
                <p className="text-muted-foreground font-medium capitalize">
                    {format(selectedDay, 'EEEE, MMMM yyyy', { locale: de })}
                </p>
            </div>
            
            <div className="flex-1 space-y-4">
                {isLoading && (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </div>
                )}
                
                {!isLoading && totalItems === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-background/50 rounded-xl border-2 border-dashed">
                        <p className="text-sm">Keine Ereignisse geplant.</p>
                    </div>
                )}
                
                {!isLoading && totalItems > 0 && (
                    <div className="space-y-3">
                        {holidayOnDay && (
                             <div className="p-4 rounded-xl border bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50 shadow-sm animate-in fade-in zoom-in-95">
                                <div className="flex items-center gap-4">
                                    <div className="bg-yellow-500 text-white p-2 rounded-lg shadow-md">
                                        <PartyPopper className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-yellow-900 dark:text-yellow-200">
                                            Feiertag
                                        </p>
                                        <p className="text-sm text-yellow-800 dark:text-yellow-300/80">
                                            {holidayOnDay.name}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {events.map(event => {
                            const Icon = kindIcons[event.kind] || CalendarDays;
                            const reference = event.vehicle ? `${event.vehicle.make} ${event.vehicle.model}` : 'Allgemein';
                            const plate = event.vehicle ? event.vehicle.license_plate : '';
                            const title = event.title || reminderKindTranslations[event.kind] || event.kind;

                            return (
                                <div key={event.id} className="group p-4 rounded-xl border bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-md animate-in slide-in-from-right-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className={cn("p-2 rounded-lg text-white shadow-sm mt-0.5", reminderKindColors[event.kind] || 'bg-gray-400')}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-sm leading-tight">
                                                    {title}
                                                </p>
                                                {event.vehicle ? (
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                        <Car className="h-3 w-3" />
                                                        <span>{plate}</span>
                                                        <span className="opacity-50">•</span>
                                                        <span>{reference}</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground">{reference}</p>
                                                )}
                                            </div>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleNavigate(event)}>
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Button size="sm" variant="secondary" className="w-full text-xs font-semibold h-8" onClick={() => handleNavigate(event)}>
                                            Details öffnen
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            
            <div className="pt-4 mt-auto border-t text-[10px] text-muted-foreground font-medium uppercase tracking-widest text-center">
                BK-Express Flottenmanagement
            </div>
        </div>
    );
}
