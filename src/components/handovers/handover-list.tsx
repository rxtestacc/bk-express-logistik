'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, ArrowUpDown, Edit, Hash, Trash2, Loader2, LayoutGrid, List, Calendar, User, Car } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DateRange } from './handover-list-toolbar';
import { HandoverStatusDialog } from './handover-status-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';
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

interface Handover {
  id: string;
  handoverAt: Timestamp;
  vehicleLabel: string;
  fromDriverName: string | null;
  toDriverName: string;
  status: 'draft' | 'completed' | 'new_damage' | 'in_review' | 'closed';
}

interface HandoverListProps {
  dateRange?: DateRange;
  vehicleId?: string;
  driverId?: string;
  status?: string;
}

type SortKey = 'handoverAt' | 'vehicleLabel' | 'fromDriverName' | 'toDriverName' | 'status' | 'id';
type ViewMode = 'grid' | 'list';

const statusTranslations: { [key: string]: string } = {
  draft: 'Entwurf',
  completed: 'Abgeschlossen',
  new_damage: 'Neuer Schaden',
  in_review: 'In Prüfung',
  closed: 'Archiviert'
};

const statusColors: { [key: string]: string } = {
  draft: 'bg-gray-400 text-white',
  completed: 'bg-status-green text-white',
  new_damage: 'bg-status-red text-white',
  in_review: 'bg-status-yellow text-black',
  closed: 'bg-gray-600 text-white'
};


export function HandoverList({ dateRange, vehicleId, driverId, status }: HandoverListProps) {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState<Handover | null>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [handoverToDelete, setHandoverToDelete] = useState<Handover | null>(null);

  // Load saved view mode
  useEffect(() => {
    const savedMode = localStorage.getItem('bkexpress_handover_view_mode') as ViewMode;
    if (savedMode && ['grid', 'list'].includes(savedMode)) {
        setViewMode(savedMode);
    }
  }, []);

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('bkexpress_handover_view_mode', mode);
  };

  const handoversQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'vehicle_handovers'), orderBy('handoverAt', 'desc'));
  }, [firestore]);

  const { data: handovers, isLoading } = useCollection<Handover>(handoversQuery);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'handoverAt', direction: 'desc' });

  const filteredAndSortedHandovers = useMemo(() => {
    if (!handovers) return [];

    let filtered = handovers;
    
    if (dateRange?.from) {
        filtered = filtered.filter(h => h.handoverAt.toDate() >= dateRange.from!);
    }
    if (dateRange?.to) {
        filtered = filtered.filter(h => h.handoverAt.toDate() <= dateRange.to!);
    }
    if (vehicleId) {
        filtered = filtered.filter(h => (h as any).vehicleId === vehicleId);
    }
    if (driverId) {
        filtered = filtered.filter(h => (h as any).fromDriverId === driverId || (h as any).toDriverId === driverId);
    }
    if (status) {
        filtered = filtered.filter(h => h.status === status);
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      let comparison = 0;

      if (aValue instanceof Timestamp && bValue instanceof Timestamp) {
        comparison = aValue.toMillis() - bValue.toMillis();
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

  }, [handovers, dateRange, vehicleId, driverId, status, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  const handleViewDetails = (id: string) => {
    router.push(`/fahrzeuguebergabe/${id}`);
  };
  
  const handleOpenStatusDialog = (handover: Handover) => {
    setSelectedHandover(handover);
    setStatusDialogOpen(true);
  };

  const handleDelete = async () => {
      if (!firestore || !handoverToDelete || !session) return;
      setIsDeleting(true);
      try {
          await deleteDoc(doc(firestore, 'vehicle_handovers', handoverToDelete.id));
          await generateAuditLog(firestore, 'handover' as any, handoverToDelete.id, handoverToDelete, {}, session.name, 'delete');
          toast({ title: 'Protokoll gelöscht' });
      } catch (e) {
          console.error("Error deleting handover:", e);
          toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
      } finally {
          setIsDeleting(false);
          setHandoverToDelete(null);
      }
  }


  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Übergabeprotokolle</CardTitle>
            <CardDescription className="hidden md:block">Verwalten Sie Ihre Fahrzeugübergaben und deren Status.</CardDescription>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl shrink-0">
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
      </CardHeader>
      <CardContent className="p-0">
        {viewMode === 'grid' ? (
            /* --- GRID VIEW --- */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />) : 
                  filteredAndSortedHandovers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                        Keine Übergaben gefunden.
                    </div>
                  ) :
                  filteredAndSortedHandovers.map(h => (
                    <Card key={h.id} className="overflow-hidden hover:border-primary/50 transition-all cursor-pointer relative" onClick={() => handleViewDetails(h.id)}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] font-mono">#{h.id.slice(0,8)}</Badge>
                                        <Badge className={cn("text-[9px] font-black uppercase", statusColors[h.status])}>{statusTranslations[h.status]}</Badge>
                                    </div>
                                    <h4 className="font-bold text-sm leading-tight flex items-center gap-2"><Car className="h-3.5 w-3.5 text-primary" /> {h.vehicleLabel}</h4>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Datum</p>
                                    <p className="text-xs font-bold">{format(h.handoverAt.toDate(), "dd.MM.yyyy", { locale: de })}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
                                <div className="space-y-0.5">
                                    <p className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Von</p>
                                    <p className="font-bold truncate">{h.fromDriverName || 'Unbekannt'}</p>
                                </div>
                                <div className="space-y-0.5 text-right">
                                    <p className="text-muted-foreground flex items-center gap-1 justify-end"><User className="h-3 w-3" /> An</p>
                                    <p className="font-bold truncate">{h.toDriverName}</p>
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
                <TableHead className="w-[100px] cursor-pointer" onClick={() => requestSort('id')}>
                    <div className="flex items-center">ID {getSortIcon('id')}</div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('handoverAt')}>
                    <div className="flex items-center">Datum {getSortIcon('handoverAt')}</div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('vehicleLabel')}>
                    <div className="flex items-center">Fahrzeug {getSortIcon('vehicleLabel')}</div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('fromDriverName')}>
                    <div className="flex items-center">Von {getSortIcon('fromDriverName')}</div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('toDriverName')}>
                    <div className="flex items-center">An {getSortIcon('toDriverName')}</div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('status')}>
                    <div className="flex items-center">Status {getSortIcon('status')}</div>
                </TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                ))}
                {!isLoading && filteredAndSortedHandovers.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                    Keine Übergaben für die aktuellen Filter gefunden.
                    </TableCell>
                </TableRow>
                )}
                {!isLoading && filteredAndSortedHandovers.map((handover) => (
                    <TableRow 
                    key={handover.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDetails(handover.id)}
                    >
                        <TableCell className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                            #{handover.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{format(handover.handoverAt.toDate(), "dd.MM.yyyy, HH:mm", { locale: de })}</TableCell>
                        <TableCell className="font-medium">{handover.vehicleLabel}</TableCell>
                        <TableCell>{handover.fromDriverName || 'Unbekannt'}</TableCell>
                        <TableCell>{handover.toDriverName}</TableCell>
                        <TableCell>
                            <Badge className={cn("whitespace-nowrap", statusColors[handover.status])}>
                            {statusTranslations[handover.status] || handover.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Menü öffnen</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewDetails(handover.id)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Details anzeigen
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenStatusDialog(handover)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Status ändern
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => setHandoverToDelete(handover)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Löschen
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        )}
      </CardContent>
    </Card>

    <AlertDialog open={!!handoverToDelete} onOpenChange={(open) => !open && setHandoverToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Protokoll löschen?</AlertDialogTitle>
                <AlertDialogDescription>Diese Aktion entfernt das Übergabeprotokoll unwiderruflich.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Löschen"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <HandoverStatusDialog
      isOpen={statusDialogOpen}
      onOpenChange={setStatusDialogOpen}
      handover={selectedHandover}
    />
    </>
  );
}
