'use client';

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Eye, ArrowUpDown, Trash2, AlertTriangle, ListChecks, Mic, LayoutGrid, List, Calendar, Car, Euro } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { Timestamp, writeBatch, doc, getDoc } from 'firebase/firestore';
import type { VehicleEvent } from './event-form-sheet';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { EventStatusFilter } from './event-status-filter';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { useFirestore } from '@/firebase';

interface EventListProps {
    eventTypes: string[];
    onEditEvent: (event: VehicleEvent) => void;
    searchTerm?: string;
    vehicleId?: string;
}

const eventTypeTranslations: { [key: string]: string } = {
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

const statusOrder: { [key: string]: number } = {
  open: 1,
  in_progress: 2,
  done: 3,
};

type SortKey = 'due_date' | 'vehicle' | 'title' | 'type' | 'status' | 'cost_eur';
type ViewMode = 'grid' | 'list';

export function EventList({ eventTypes, onEditEvent, searchTerm = '', vehicleId = '' }: EventListProps) {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'due_date', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Load saved view mode
  useEffect(() => {
    const savedMode = localStorage.getItem('bkexpress_event_view_mode') as ViewMode;
    if (savedMode && ['grid', 'list'].includes(savedMode)) {
        setViewMode(savedMode);
    }
  }, []);

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('bkexpress_event_view_mode', mode);
  };

  const { events, vehicles, isLoading } = useDashboardData();

  const vehiclesMap = useMemo(() => new Map(vehicles?.map(v => [v.id, v])), [vehicles]);
  
  const getVehicleName = (vId: string) => {
      const v = vehiclesMap.get(vId);
      if (!v) return vId;
      return `${v.license_plate} (${v.make} ${v.model})`;
  }

  const sortedAndFilteredEvents = useMemo(() => {
    if (!events) return [];
    
    let filtered = events.filter(e => eventTypes.includes(e.type));
    
    if (vehicleId) {
        filtered = filtered.filter(e => e.vehicleId === vehicleId);
    }
    
    if (statusFilter) {
        if (statusFilter === 'verkehrsunfall') {
            filtered = filtered.filter(e => e.type === 'verkehrsunfall');
        } else {
            filtered = filtered.filter(e => e.status === statusFilter);
        }
    }
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(e => 
            e.title.toLowerCase().includes(term) ||
            getVehicleName(e.vehicleId).toLowerCase().includes(term)
        );
    }

    return filtered.sort((a, b) => {
      if (!statusFilter) {
        const sA = statusOrder[a.status] || 99;
        const sB = statusOrder[b.status] || 99;
        if (sA !== sB) return sA - sB;
      }

      let aV, bV;
      if (sortConfig.key === 'vehicle') {
          aV = getVehicleName(a.vehicleId);
          bV = getVehicleName(b.vehicleId);
      } else {
          aV = (a as any)[sortConfig.key];
          bV = (b as any)[sortConfig.key];
      }

      let comp = 0;
      if (aV instanceof Timestamp && bV instanceof Timestamp) {
          comp = aV.toMillis() - bV.toMillis();
      } else if (typeof aV === 'string' && typeof bV === 'string') {
          comp = aV.localeCompare(bV);
      } else if (typeof aV === 'number' && typeof bV === 'number') {
          comp = aV - bV;
      }
      
      return sortConfig.direction === 'asc' ? comp : -comp;
    });
  }, [events, eventTypes, statusFilter, searchTerm, vehiclesMap, sortConfig, vehicleId]);

  const requestSort = (key: SortKey) => {
    let dir: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') dir = 'desc';
    setSortConfig({ key, direction: dir });
  };
  
  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !session) return;
    setIsBulkDeleting(true);
    const ids = idToDelete ? [idToDelete] : selectedIds;
    try {
      const batch = writeBatch(firestore);
      for (const id of ids) {
        const ref = doc(firestore, 'vehicle_events', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await generateAuditLog(firestore, 'event', id, snap.data(), {}, session.name, 'delete');
          batch.delete(ref);
        }
      }
      await batch.commit();
      toast({ title: ids.length === 1 ? 'Gelöscht' : `${ids.length} gelöscht` });
      setSelectedIds([]);
      setIdToDelete(null);
      setIsSelectionMode(false);
    } catch (e) {
      console.error("Error deleting events:", e);
      toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
    } finally {
      setIsBulkDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '-';
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, 'dd.MM.yyyy');
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Ereignisse</CardTitle></div>
        <div className="flex gap-2">
          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl shrink-0 mr-2">
                <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8 rounded-lg", viewMode === 'grid' && "bg-background shadow-sm")}
                    onClick={() => updateViewMode('grid')}
                    title="Rasteransicht"
                >
                    <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8 rounded-lg", viewMode === 'list' && "bg-background shadow-sm")}
                    onClick={() => updateViewMode('list')}
                    title="Listenansicht"
                >
                    <List className="h-4 w-4" />
                </Button>
            </div>

          {!isSelectionMode ? (
            <Button variant="outline" size="sm" onClick={() => setIsSelectionMode(true)} className="rounded-xl h-10"><ListChecks className="h-4 w-4 mr-2" />Auswählen</Button>
          ) : (
            <div className="flex gap-2">
              {selectedIds.length > 0 && <Button variant="destructive" size="sm" onClick={() => { setIdToDelete(null); setIsDeleteDialogOpen(true); }} className="rounded-xl h-10"><Trash2 className="h-4 w-4 mr-2" />{selectedIds.length} löschen</Button>}
              <Button variant="ghost" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="rounded-xl h-10 border">Abbrechen</Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <EventStatusFilter events={sortedAndFilteredEvents} selectedStatus={statusFilter} onStatusChange={setStatusFilter} />
        
        {viewMode === 'grid' ? (
            /* --- GRID VIEW --- */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />) : 
                  sortedAndFilteredEvents.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed">
                        Keine Einträge gefunden.
                    </div>
                  ) :
                  sortedAndFilteredEvents.map(e => (
                    <Card key={e.id} className={cn("overflow-hidden hover:border-primary/50 transition-all cursor-pointer relative", e.status === 'done' && "opacity-60 grayscale-[0.5]", selectedIds.includes(e.id!) && "ring-2 ring-primary")} onClick={() => isSelectionMode ? (setSelectedIds(prev => prev.includes(e.id!) ? prev.filter(i => i !== e.id) : [...prev, e.id!])) : router.push(`/ereignisse/${e.id}`)}>
                        {isSelectionMode && <div className="absolute top-3 right-3 z-10"><Checkbox checked={selectedIds.includes(e.id!)} /></div>}
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm leading-tight flex items-center gap-2">{e.title}{(e as any).created_via === 'voice' && <Mic className="h-3 w-3 text-primary" />}</h4>
                                    <Badge className={cn('text-[9px] font-black uppercase', statusColors[e.status])}>{statusTranslations[e.status]}</Badge>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Datum</p>
                                    <p className="text-xs font-bold">{formatDate(e.due_date)}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
                                <div className="space-y-0.5">
                                    <p className="text-muted-foreground flex items-center gap-1"><Car className="h-3 w-3" /> FZG</p>
                                    <p className="font-bold truncate">{getVehicleName(e.vehicleId).split('(')[0]}</p>
                                </div>
                                <div className="space-y-0.5 text-right">
                                    <p className="text-muted-foreground flex items-center gap-1 justify-end"><Euro className="h-3 w-3" /> Kosten</p>
                                    <p className="font-bold">{(e.cost_eur ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                  ))
                }
            </div>
        ) : (
            /* --- LIST VIEW --- */
            <Table>
            <TableHeader>
                <TableRow>
                {isSelectionMode && <TableHead className="w-10"><Checkbox checked={selectedIds.length > 0 && selectedIds.length === sortedAndFilteredEvents.length} onCheckedChange={() => setSelectedIds(selectedIds.length === sortedAndFilteredEvents.length ? [] : sortedAndFilteredEvents.map(e => e.id!))} /></TableHead>}
                <TableHead className='cursor-pointer' onClick={() => requestSort('due_date')}><div className='flex items-center'>Datum {getSortIcon('due_date')}</div></TableHead>
                <TableHead className='cursor-pointer' onClick={() => requestSort('vehicle')}><div className='flex items-center'>Fahrzeug {getSortIcon('vehicle')}</div></TableHead>
                <TableHead className='cursor-pointer' onClick={() => requestSort('title')}><div className='flex items-center'>Titel {getSortIcon('title')}</div></TableHead>
                <TableHead className='cursor-pointer' onClick={() => requestSort('type')}><div className='flex items-center'>Typ {getSortIcon('type')}</div></TableHead>
                <TableHead className='cursor-pointer' onClick={() => requestSort('status')}><div className='flex items-center'>Status {getSortIcon('status')}</div></TableHead>
                <TableHead className='cursor-pointer' onClick={() => requestSort('cost_eur')}><div className='flex items-center'>Kosten {getSortIcon('cost_eur')}</div></TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : 
                sortedAndFilteredEvents.map(e => (
                    <TableRow key={e.id} className={cn("cursor-pointer hover:bg-muted/50", e.status === 'done' && "opacity-60", selectedIds.includes(e.id!) && "bg-muted")} onClick={() => isSelectionMode ? (setSelectedIds(prev => prev.includes(e.id!) ? prev.filter(i => i !== e.id) : [...prev, e.id!])) : router.push(`/ereignisse/${e.id}`)}>
                    {isSelectionMode && <TableCell onClick={x => { x.stopPropagation(); setSelectedIds(prev => prev.includes(e.id!) ? prev.filter(i => i !== e.id) : [...prev, e.id!]); }}><Checkbox checked={selectedIds.includes(e.id!)} /></TableCell>}
                    <TableCell>{formatDate(e.due_date)}</TableCell>
                    <TableCell>{getVehicleName(e.vehicleId)}</TableCell>
                    <TableCell className="font-medium"><div className="flex items-center gap-2">{e.title}{(e as any).created_via === 'voice' && <Mic className="h-3 w-3 text-primary animate-pulse" />}</div></TableCell>
                    <TableCell>{eventTypeTranslations[e.type] || e.type}</TableCell>
                    <TableCell><Badge className={cn('text-white', statusColors[e.status])}>{statusTranslations[e.status] || eventTypeTranslations[e.type]}</Badge></TableCell>
                    <TableCell>{(e.cost_eur ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</TableCell>
                    <TableCell className="text-right" onClick={x => x.stopPropagation()}>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/ereignisse/${e.id}`)}><Eye className="mr-2 h-4 w-4" />Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditEvent(e)}><Pencil className="mr-2 h-4 w-4" />Bearbeiten</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => { setIdToDelete(e.id!); setIsDeleteDialogOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                ))
                }
            </TableBody>
            </Table>
        )}
      </CardContent>
    </Card>
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Löschen bestätigen</AlertDialogTitle><AlertDialogDescription>Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={isBulkDeleting}>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive" disabled={isBulkDeleting}>Löschen</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
