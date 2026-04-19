'use client';

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { VehicleEvent } from '@/components/events/event-form-sheet';
import { useMemo } from 'react';
import { Button } from '../ui/button';
import { MoreHorizontal, Pencil, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';

interface VehicleEventsProps {
    vehicleId: string;
    filterText: string;
    eventTypes: string[];
    onEditEvent: (event: VehicleEvent) => void;
}

export const eventTypeTranslations: { [key: string]: string } = {
  inspection: 'Inspektion', repair: 'Reparatur', damage: 'Schaden', verkehrsunfall: 'Verkehrsunfall',
  tuv: 'TÜV (HU)', au: 'AU', uvv: 'UVV-Prüfung', tire_change: 'Reifenwechsel',
  service: 'Service', fuel: 'Tanken', trip: 'Fahrt', other: 'Sonstiges',
};

const statusTranslations: { [key: string]: string } = { open: 'Offen', in_progress: 'In Bearbeitung', done: 'Erledigt' };
const statusColors: { [key: string]: string } = { open: 'bg-status-red', in_progress: 'bg-status-yellow text-black', done: 'bg-status-green' };

const formatDate = (ts: any) => {
  if (!ts) return '-';
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000);
  return format(date, 'dd.MM.yyyy');
};

export default function VehicleEvents({ vehicleId, filterText, eventTypes, onEditEvent }: VehicleEventsProps) {
  const router = useRouter();
  const { events, isLoading } = useDashboardData();

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter(e => {
        if (e.vehicleId !== vehicleId || !eventTypes.includes(e.type)) return false;
        const term = filterText.toLowerCase();
        if (term && !e.title.toLowerCase().includes(term)) return false;
        return true;
    }).sort((a, b) => {
        const da = a.due_date instanceof Timestamp ? a.due_date.toMillis() : (a.due_date as any).seconds * 1000;
        const db = b.due_date instanceof Timestamp ? b.due_date.toMillis() : (b.due_date as any).seconds * 1000;
        return db - da;
    });
  }, [events, vehicleId, filterText, eventTypes]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Kosten</TableHead>
          <TableHead className="text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : 
          filteredEvents.map((event) => (
            <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/ereignisse/${event.id}`)}>
              <TableCell>{formatDate(event.due_date)}</TableCell>
              <TableCell className="font-medium">{event.title}</TableCell>
              <TableCell>{eventTypeTranslations[event.type] || event.type}</TableCell>
              <TableCell><Badge className={cn('text-white', statusColors[event.status])}>{statusTranslations[event.status] || event.status}</Badge></TableCell>
              <TableCell>{(event.cost_eur || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</TableCell>
              <TableCell className="text-right" onClick={x => x.stopPropagation()}>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/ereignisse/${event.id!}`)}><Eye className="mr-2 h-4 w-4" />Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditEvent(event)}><Pencil className="mr-2 h-4 w-4" />Bearbeiten</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        }
      </TableBody>
    </Table>
  );
}
