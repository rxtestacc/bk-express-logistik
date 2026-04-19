'use client';

import { useMemo, useState, useEffect } from 'react';
import { Timestamp, doc, deleteDoc } from 'firebase/firestore';
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
import { format, differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, Pencil, FileText, AlertCircle, CheckCircle2, Trash2, Loader2, LayoutGrid, List, Car, Euro, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import type { Contract, Vehicle } from '@/lib/types';
import type { DateRange } from './contract-list-toolbar';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { useFirestore } from '@/firebase';
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


interface ContractListProps {
  dateRange: DateRange | undefined;
  vehicleId: string;
  contractType: string;
  providerName: string;
  contractStatus: string;
  matchStatus: string;
  onEditContract?: (contract: Contract) => void;
}

const contractTypeTranslations: { [key: string]: string } = {
    leasing: 'Leasing',
    financing: 'Finanzierung',
    purchase: 'Kauf',
    warranty: 'Garantie',
    maintenance: 'Wartung',
    insurance: 'Versicherung',
    other: 'Sonstiges',
};

const contractStatusColors: { [key: string]: string } = {
    active: 'bg-status-green',
    expiring_soon: 'bg-status-yellow text-black',
    expired: 'bg-status-red',
};

const matchStatusTranslations: { [key: string]: string } = {
    unverified: 'Ungeprüft',
    verified: 'Geprüft',
    corrected: 'Korrigiert',
};
const matchStatusIcons = {
    unverified: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    verified: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    corrected: <Pencil className="h-4 w-4 text-blue-500" />,
}

type ViewMode = 'grid' | 'list';

const formatDate = (timestamp: Timestamp | undefined | null) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date((timestamp as any).seconds * 1000);
    return format(date, 'dd.MM.yyyy');
};

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}


export function ContractList({ dateRange, vehicleId, contractType, providerName, contractStatus, matchStatus, onEditContract }: ContractListProps) {
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { session } = useSession();
    const { contracts, vehicles, isLoading } = useDashboardData();
    
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [isDeleting, setIsDeleting] = useState(false);
    const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);

    // Load saved view mode
    useEffect(() => {
        const savedMode = localStorage.getItem('bkexpress_contract_view_mode') as ViewMode;
        if (savedMode && ['grid', 'list'].includes(savedMode)) {
            setViewMode(savedMode);
        }
    }, []);

    const updateViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('bkexpress_contract_view_mode', mode);
    };

    const vehiclesMap = useMemo(() => new Map(vehicles?.map(v => [v.id, v])), [vehicles]);

    const filteredAndSortedContracts = useMemo(() => {
        if (!contracts) return [];
        
        let filtered = contracts.filter(c => {
            if (vehicleId && c.vehicleId !== vehicleId) return false;
            if (contractType && c.contractType !== contractType) return false;
            if (providerName && c.providerName !== providerName) return false;
            if (contractStatus && c.contractStatus !== contractStatus) return false;
            if (matchStatus && c.matchStatus !== matchStatus) return false;
            if (dateRange?.from) {
                const checkDate = c.endDate || c.cancellationDeadline;
                if (!checkDate) return false;
                const d = checkDate instanceof Timestamp ? checkDate.toDate() : new Date((checkDate as any).seconds * 1000);
                if (d < dateRange.from) return false;
            }
            if (dateRange?.to) {
                const checkDate = c.endDate || c.cancellationDeadline;
                if (!checkDate) return false;
                const d = checkDate instanceof Timestamp ? checkDate.toDate() : new Date((checkDate as any).seconds * 1000);
                if (d > dateRange.to) return false;
            }
            return true;
        });

        return filtered.sort((a,b) => {
            const now = new Date();
            const getD = (ts: any) => ts ? (ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000)) : null;
            
            const dateA = getD(a.cancellationDeadline) || getD(a.endDate);
            const dateB = getD(b.cancellationDeadline) || getD(b.endDate);
            
            const daysToA = dateA ? differenceInCalendarDays(dateA, now) : Infinity;
            const daysToB = dateB ? differenceInCalendarDays(dateB, now) : Infinity;
            
            return (daysToA < 0 ? Infinity : daysToA) - (daysToB < 0 ? Infinity : daysToB);
        });

    }, [contracts, vehicleId, contractType, providerName, contractStatus, matchStatus, dateRange]);


    const handleViewDetails = (contractId: string) => {
        router.push(`/vertraege/${contractId}`);
    };

    const handleDelete = async () => {
        if (!firestore || !contractToDelete || !session) return;
        setIsDeleting(true);
        try {
            if (contractToDelete.documentRef?.storagePath) {
                await fetch('/api/delete-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: contractToDelete.documentRef.storagePath })
                });
            }
            await deleteDoc(doc(firestore, 'contracts', contractToDelete.id));
            await generateAuditLog(firestore, 'contract', contractToDelete.id, contractToDelete, {}, session.name, 'delete');
            toast({ title: 'Vertrag gelöscht' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
        } finally {
            setIsDeleting(false);
            setContractToDelete(null);
        }
    }

    return (
        <>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle>Verträge</CardTitle>
                    <CardDescription className="hidden md:block">Übersicht aller Leasing-, Garantie- und Versicherungsverträge.</CardDescription>
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
            <CardContent>
                 {viewMode === 'grid' ? (
                     /* --- GRID VIEW --- */
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                         {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />) :
                          filteredAndSortedContracts.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                                Keine Verträge gefunden.
                            </div>
                          ) :
                          filteredAndSortedContracts.map(c => {
                              const vehicle = c.vehicleId ? vehiclesMap.get(c.vehicleId) : null;
                              return (
                                <Card key={c.id} className="overflow-hidden hover:border-primary/50 transition-all cursor-pointer relative" onClick={() => handleViewDetails(c.id)}>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <Badge className={cn("text-[9px] font-black uppercase", contractStatusColors[c.contractStatus])}>{c.contractStatus}</Badge>
                                                <h4 className="font-bold text-sm leading-tight">{c.providerName || 'Unbekannter Partner'}</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">{contractTypeTranslations[c.contractType]}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ende</p>
                                                <p className="text-xs font-bold">{formatDate(c.endDate)}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
                                            <div className="space-y-0.5">
                                                <p className="text-muted-foreground flex items-center gap-1"><Car className="h-3 w-3" /> FZG</p>
                                                <p className="font-bold truncate">{vehicle?.license_plate || 'Keins'}</p>
                                            </div>
                                            <div className="space-y-0.5 text-right">
                                                <p className="text-muted-foreground flex items-center gap-1 justify-end"><Euro className="h-3 w-3" /> Monatlich</p>
                                                <p className="font-bold">{formatCurrency(c.monthlyCostEur)}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                              )
                          })
                         }
                     </div>
                 ) : (
                     /* --- LIST VIEW --- */
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Fahrzeug</TableHead>
                                <TableHead>Vertragsart</TableHead>
                                <TableHead>Partner</TableHead>
                                <TableHead>Laufzeit</TableHead>
                                <TableHead>Kosten</TableHead>
                                <TableHead>Zuordnung</TableHead>
                                <TableHead className="text-right">Aktionen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && filteredAndSortedContracts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        Keine Verträge für die aktuellen Filter gefunden.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredAndSortedContracts.map((c) => {
                                const vehicle = c.vehicleId ? vehiclesMap.get(c.vehicleId) : null;
                                const now = new Date();
                                const getD = (ts: any) => ts ? (ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000)) : null;
                                
                                const dateEnd = getD(c.endDate);
                                const dateCancel = getD(c.cancellationDeadline);
                                
                                const daysUntilEnd = dateEnd ? differenceInCalendarDays(dateEnd, now) : null;
                                const daysUntilCancellation = dateCancel ? differenceInCalendarDays(dateCancel, now) : null;

                                return (
                                    <TableRow 
                                    key={c.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleViewDetails(c.id)}
                                    >
                                        <TableCell>
                                            <Badge className={cn('text-white', contractStatusColors[c.contractStatus])}>
                                                {c.contractStatus === 'expiring_soon' ? 'Läuft aus' : c.contractStatus === 'expired' ? 'Abgelaufen' : 'Aktiv'}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                {daysUntilEnd !== null && daysUntilEnd >= 0 && <div>{`Endet in ${daysUntilEnd} Tagen`}</div>}
                                                {daysUntilCancellation !== null && daysUntilCancellation >= 0 && <div>{`Kündigung in ${daysUntilCancellation} Tagen`}</div>}
                                            </div>
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            {vehicle ? (
                                                <Link href={`/fahrzeuge/${vehicle.id}`} className="font-medium hover:underline">
                                                    {vehicle.license_plate}
                                                    <div className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model}</div>
                                                </Link>
                                            ) : (
                                                <span className='text-muted-foreground'>N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{contractTypeTranslations[c.contractType] || c.contractType}</TableCell>
                                        <TableCell>{c.providerName || '-'}</TableCell>
                                        <TableCell>{formatDate(c.startDate)} - {formatDate(c.endDate)}</TableCell>
                                        <TableCell>{formatCurrency(c.monthlyCostEur)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className='flex items-center gap-2'>
                                                {matchStatusIcons[c.matchStatus]}
                                                {matchStatusTranslations[c.matchStatus]}
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
                                                    <DropdownMenuItem onClick={() => handleViewDetails(c.id)}>
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        Vertragsdetails
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onEditContract?.(c)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Bearbeiten
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setContractToDelete(c)}>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Löschen
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

        <AlertDialog open={!!contractToDelete} onOpenChange={(open) => !open && setContractToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Vertrag löschen?</AlertDialogTitle>
                    <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Löschen"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
