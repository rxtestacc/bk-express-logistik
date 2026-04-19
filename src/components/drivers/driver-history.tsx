'use client';

import { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VehicleHistoryToolbar } from '@/components/vehicles/vehicle-history-toolbar';
import type { VehicleEvent } from '@/components/events/event-form-sheet';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '../ui/button';
import { MoreHorizontal, Pencil, Eye, ArrowUpDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';

interface DriverHistoryProps {
  driverId: string;
  onEditEvent: (event: VehicleEvent) => void;
  events: VehicleEvent[] | null;
  isLoading: boolean;
}

const allEventTypes = ['inspection', 'repair', 'damage', 'tuv', 'au', 'uvv', 'tire_change', 'service', 'verkehrsunfall', 'other'];

export default function DriverHistory({ driverId, onEditEvent, events: propsEvents, isLoading: propsIsLoading }: DriverHistoryProps) {
  const [filterText, setFilterText] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  
  // Nutze zentrale Daten aus dem Provider
  const { events: contextEvents, isLoading: contextIsLoading } = useDashboardData();
  
  const isLoading = propsIsLoading || contextIsLoading;
  const events = propsEvents || contextEvents || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ereignishistorie des Fahrers</CardTitle>
        <CardDescription>
          Eine Übersicht aller erfassten Ereignisse, die diesem Fahrer zugeordnet sind.
        </CardDescription>
      </CardHeader>
      <CardContent>
         <VehicleHistoryToolbar
              filterText={filterText}
              setFilterText={setFilterText}
              availableTypes={allEventTypes}
              selectedTypes={selectedTypes}
              setSelectedTypes={setSelectedTypes}
            />
          <div className="mt-4">
            <DriverEvents 
                driverId={driverId}
                events={events}
                isLoading={isLoading}
                filterText={filterText}
                eventTypes={selectedTypes.length > 0 ? selectedTypes : allEventTypes}
                onEditEvent={onEditEvent}
            />
          </div>
      </CardContent>
    </Card>
  );
}


interface DriverEventsProps {
    driverId: string;
    events: VehicleEvent[] | null;
    isLoading: boolean;
    filterText: string;
    eventTypes: string[];
    onEditEvent: (event: VehicleEvent) => void;
}

export const eventTypeTranslations: { [key: string]: string } = {
  inspection: 'Inspektion',
  repair: 'Reparatur',
  damage: 'Schaden',
  verkehrsunfall: 'Verkehrsunfall',
  tuv: 'TÜV (HU)',
  au: 'AU',
  uvv: 'UVV-Prüfung',
  tire_change: 'Reifenwechsel',
  service: 'Service',
  fuel: 'Tanken',
  trip: 'Fahrt',
  other: 'Sonstiges',
};

const statusTranslations: { [key: string]: string } = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
};

const statusColors: { [key: string]: string } = {
  open: 'bg-status-red hover:bg-status-red/80',
  in_progress: 'bg-status-yellow hover:bg-status-yellow/80 text-black',
  done: 'bg-status-green hover:bg-status-green/80',
};

type SortKey = 'due_date' | 'title' | 'type' | 'status' | 'cost_eur';


function DriverEvents({ driverId, events, isLoading, filterText, eventTypes, onEditEvent }: DriverEventsProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'due_date', direction: 'desc' });

  const filteredAndSortedEvents = useMemo(() => {
    if (!events) return [];
    
    let filtered = events.filter(event => {
        if (event.driverId !== driverId) return false;
        if (!eventTypes.includes(event.type)) return false;

        const term = filterText.toLowerCase();
        if (term) {
            const tMatch = event.title.toLowerCase().includes(term);
            const yMatch = (eventTypeTranslations[event.type] || event.type).toLowerCase().includes(term);
            const vMatch = event.vendor?.toLowerCase().includes(term);
            if (!tMatch && !yMatch && !vMatch) return false;
        }
        
        return true;
    });

    return filtered.sort((a, b) => {
        const getV = (obj: any, key: string) => {
            const val = obj[key];
            if (key === 'due_date' && val) return val instanceof Timestamp ? val.toMillis() : val.seconds * 1000;
            return val;
        };
        const aV = getV(a, sortConfig.key);
        const bV = getV(b, sortConfig.key);
        let comp = 0;

        if (typeof aV === 'string' && typeof bV === 'string') comp = aV.localeCompare(bV);
        else if (typeof aV === 'number' && typeof bV === 'number') comp = aV - bV;
        else if (!aV) comp = -1;
        else if (!bV) comp = 1;

        return sortConfig.direction === 'asc' ? comp : -comp;
    });
  }, [events, driverId, filterText, eventTypes, sortConfig]);

  const requestSort = (key: SortKey) => {
    let dir: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') dir = 'desc';
    setSortConfig({ key, direction: dir });
  };
  
  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  const formatDate = (ts: any) => {
    if (!ts) return '-';
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, 'dd.MM.yyyy');
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className='cursor-pointer hover:bg-accent' onClick={() => requestSort('due_date')}>
            <div className='flex items-center'>Datum {getSortIcon('due_date')}</div>
          </TableHead>
          <TableHead className='cursor-pointer hover:bg-accent' onClick={() => requestSort('title')}>
            <div className='flex items-center'>Titel {getSortIcon('title')}</div>
          </TableHead>
          <TableHead className='cursor-pointer hover:bg-accent' onClick={() => requestSort('type')}>
            <div className='flex items-center'>Typ {getSortIcon('type')}</div>
          </TableHead>
          <TableHead className='cursor-pointer hover:bg-accent' onClick={() => requestSort('status')}>
            <div className='flex items-center'>Status {getSortIcon('status')}</div>
          </TableHead>
           <TableHead className='cursor-pointer hover:bg-accent' onClick={() => requestSort('cost_eur')}>
            <div className='flex items-center'>Kosten {getSortIcon('cost_eur')}</div>
          </TableHead>
          <TableHead className="text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ?
          Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
          )) : filteredAndSortedEvents.length === 0 ? (
          <TableRow><TableCell colSpan={6} className="h-24 text-center">Keine passenden Einträge gefunden.</TableCell></TableRow>
        ) : filteredAndSortedEvents.map((event) => (
            <TableRow 
              key={event.id} 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/ereignisse/${event.id!}`)}
            >
              <TableCell>{formatDate(event.due_date)}</TableCell>
              <TableCell className="font-medium">{event.title}</TableCell>
              <TableCell>{eventTypeTranslations[event.type] || event.type}</TableCell>
              <TableCell>
                {event.status && (
                    <Badge className={cn('text-white', statusColors[event.status])}>
                    {statusTranslations[event.status] || event.status}
                    </Badge>
                )}
              </TableCell>
               <TableCell>
                {(event.cost_eur || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/ereignisse/${event.id!}`)}><Eye className="mr-2 h-4 w-4" />Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditEvent(event)}><Pencil className="mr-2 h-4 w-4" />Bearbeiten</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
