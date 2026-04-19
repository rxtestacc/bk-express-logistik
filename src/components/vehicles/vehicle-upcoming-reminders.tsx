'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { kindIcons } from '@/components/calendar/utils';
import { Badge } from '../ui/badge';
import { Calendar, MoreHorizontal, Eye } from 'lucide-react';
import type { VehicleEvent } from '@/components/events/event-form-sheet';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useRouter } from 'next/navigation';

interface Reminder {
  id: string;
  kind: string;
  due_date: Timestamp;
  status: string;
  vehicleId: string;
}

interface ProcessedEntry {
  id: string;
  kind: string;
  due_date: Timestamp;
  daysLeft: number;
  urgency: 'overdue' | 'high' | 'medium' | 'low';
  icon: React.ElementType;
  source: 'reminder' | 'event';
  title: string;
}

interface VehicleUpcomingRemindersProps {
  vehicleId: string;
}

const reminderKindTranslations: Record<string, string> = {
  service: 'Service',
  hu: 'Hauptuntersuchung (TÜV)',
  au: 'Abgasuntersuchung',
  uvv: 'UVV-Prüfung',
  leasing_end: 'Leasing-Ende',
  warranty_end: 'Garantie-Ende',
  financing_end: 'Finanzierungs-Ende',
  tire_change: 'Reifenwechsel',
  inspection: 'Inspektion',
  tuv: 'TÜV (HU)',
  driver_license_expiry: 'Führerscheinablauf',
  other: 'Sonstiges',
  damage: 'Schaden',
  verkehrsunfall: 'Verkehrsunfall',
  repair: 'Reparatur',
};

const getSafeDate = (ts: any): Date | null => {
    if (!ts) return null;
    try {
        if (ts instanceof Timestamp) return ts.toDate();
        if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
        if (typeof ts.seconds === 'number') return new Timestamp(ts.seconds, ts.nanoseconds || 0).toDate();
        const d = new Date(ts);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        console.error("Error parsing date in vehicle reminders:", e);
        return null;
    }
};

const UrgencyBadge = ({ reminder }: { reminder: ProcessedEntry }) => {
    let text = `Fällig in ${reminder.daysLeft} Tagen`;
    let className = 'bg-yellow-500 hover:bg-yellow-500/80 text-black'; // Medium

    if (reminder.urgency === 'overdue') {
        text = `Seit ${Math.abs(reminder.daysLeft)} Tag${Math.abs(reminder.daysLeft) !== 1 ? 'en' : ''} überfällig`;
        return <Badge variant="destructive" className="whitespace-nowrap">{text}</Badge>;
    }
    if (reminder.urgency === 'high') {
       if (reminder.daysLeft === 0) {
         text = 'Heute fällig';
       }
       className = 'bg-orange-500 hover:bg-orange-500/80 text-white';
    }

    return <Badge className={cn(className, 'whitespace-nowrap')}>{text}</Badge>;
}

export default function VehicleUpcomingReminders({ vehicleId }: VehicleUpcomingRemindersProps) {
  const firestore = useFirestore();
  const router = useRouter();

  // Vereinfachte Abfrage ohne orderBy um Index-Fehler zu vermeiden
  const remindersQuery = useMemoFirebase(() => {
    if (!firestore || !vehicleId) return null;
    return query(
      collection(firestore, 'reminders'),
      where('vehicleId', '==', vehicleId)
    );
  }, [firestore, vehicleId]);
  
  const openEventsQuery = useMemoFirebase(() => {
    if (!firestore || !vehicleId) return null;
    return query(
        collection(firestore, 'vehicle_events'),
        where('vehicleId', '==', vehicleId)
    );
  }, [firestore, vehicleId]);

  const { data: remindersRaw, isLoading: isLoadingReminders } = useCollection<Reminder>(remindersQuery);
  const { data: eventsRaw, isLoading: isLoadingEvents } = useCollection<VehicleEvent>(openEventsQuery);

  const isLoading = isLoadingReminders || isLoadingEvents;

  const processedEntries = useMemo(() => {
    const allEntries: ProcessedEntry[] = [];
    const now = startOfDay(new Date());

    // Clientseitige Filterung und Aufbereitung
    (remindersRaw || [])
      .filter(r => r.status === 'open')
      .forEach((rem) => {
        const d = getSafeDate(rem.due_date);
        if (!d) return;
        
        const dueDate = startOfDay(d);
        const daysLeft = differenceInCalendarDays(dueDate, now);
        const kindKey = rem.kind as string;

        let urgency: ProcessedEntry['urgency'] = 'low';
        if (daysLeft < 0) urgency = 'overdue';
        else if (daysLeft <= 7) urgency = 'high';
        else if (daysLeft <= 30) urgency = 'medium';

        allEntries.push({
            ...rem,
            title: reminderKindTranslations[kindKey] || kindKey,
            daysLeft,
            urgency,
            icon: (kindIcons as any)[kindKey] ?? kindIcons['other'],
            source: 'reminder',
        });
    });

    (eventsRaw || [])
      .filter(e => e.status === 'open' || e.status === 'in_progress')
      .forEach((event) => {
        const d = getSafeDate(event.due_date);
        if (!d) return;

        const dueDate = startOfDay(d);
        const daysLeft = differenceInCalendarDays(dueDate, now);
        const kindKey = event.type as string;

        let urgency: ProcessedEntry['urgency'] = 'low';
        if (daysLeft < 0) urgency = 'overdue';
        else if (daysLeft <= 7) urgency = 'high';
        else if (daysLeft <= 30) urgency = 'medium';

        allEntries.push({
            id: event.id!,
            kind: event.type,
            due_date: event.due_date as Timestamp,
            title: event.title,
            daysLeft,
            urgency,
            icon: (kindIcons as any)[kindKey] ?? kindIcons['other'],
            source: 'event'
        });
    });
    
    // Clientseitige Sortierung nach Datum
    return allEntries.sort((a, b) => {
        const da = getSafeDate(a.due_date)?.getTime() || 0;
        const db = getSafeDate(b.due_date)?.getTime() || 0;
        return da - db;
    });

  }, [remindersRaw, eventsRaw]);

  const handleNavigate = (entry: ProcessedEntry) => {
    if (entry.source === 'event') {
        router.push(`/ereignisse/${entry.id}`);
    } else {
        router.push(`/fahrzeuge/${vehicleId}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anstehende Termine &amp; Fristen</CardTitle>
        <CardDescription>Eine Übersicht aller offenen und zukünftigen Termine für dieses Fahrzeug.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : processedEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-48">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">Keine offenen Termine</p>
            <p className="text-sm text-muted-foreground">Für dieses Fahrzeug sind aktuell keine Termine oder Fristen hinterlegt.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Art des Termins</TableHead>
                <TableHead>Fälligkeitsdatum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedEntries.map((entry) => {
                const date = getSafeDate(entry.due_date);
                return (
                  <TableRow key={`${entry.id}-${entry.source}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <entry.icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{entry.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        {date ? format(date, 'dd. MMMM yyyy', { locale: de }) : '-'}
                    </TableCell>
                    <TableCell>
                      <UrgencyBadge reminder={entry} />
                    </TableCell>
                     <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Menü öffnen</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleNavigate(entry)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Details anzeigen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}