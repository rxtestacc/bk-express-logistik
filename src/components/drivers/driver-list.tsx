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
import { MoreHorizontal, Pencil, Phone, Mail, Eye, ArrowUpDown, User, Car, CalendarClock, LayoutGrid, List } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Driver } from './driver-form-sheet';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';

interface DriverListProps {
    onEditDriver: (driver: Driver) => void;
    searchTerm: string;
    drivers: Driver[] | null;
    isLoading: boolean;
}

type SortKey = 'last_name' | 'carrier' | 'license_expiry_date';
type ViewMode = 'grid' | 'list';

export function DriverList({ onEditDriver, searchTerm, drivers, isLoading }: DriverListProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'last_name', direction: 'asc' });
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const { vehicles } = useDashboardData();
  const vehiclesMap = useMemo(() => new Map(vehicles?.map(v => [v.id, v])), [vehicles]);
  
  // Load saved view mode
  useEffect(() => {
    const savedMode = localStorage.getItem('bkexpress_driver_view_mode') as ViewMode;
    if (savedMode && ['grid', 'list'].includes(savedMode)) {
        setViewMode(savedMode);
    }
  }, []);

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('bkexpress_driver_view_mode', mode);
  };

  const filteredAndSortedDrivers = useMemo(() => {
    if (!drivers) return [];

    let filtered = drivers;
    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        filtered = drivers.filter(driver => 
            `${driver.first_name} ${driver.last_name}`.toLowerCase().includes(lowercasedFilter) ||
            driver.email?.toLowerCase().includes(lowercasedFilter) ||
            driver.phone?.toLowerCase().includes(lowercasedFilter) ||
            driver.carrier?.toLowerCase().includes(lowercasedFilter)
        );
    }
    
    return filtered.sort((a, b) => {
        const key = sortConfig.key;
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        let comparison = 0;

        if (key === 'license_expiry_date') {
            const getVal = (d: Driver) => {
                const ts = d.license_expiry_date;
                if (!ts) return null;
                return ts instanceof Timestamp ? ts.toMillis() : (ts as any).seconds * 1000;
            };
            const valA = getVal(a);
            const valB = getVal(b);
            if (valA === null && valB !== null) comparison = 1;
            else if (valA !== null && valB === null) comparison = -1;
            else if (valA !== null && valB !== null) comparison = valA - valB;
        } else {
            const valA = a[key] || '';
            const valB = b[key] || '';
            if (typeof valA === 'string' && typeof valB === 'string') {
                comparison = valA.localeCompare(valB, 'de', { sensitivity: 'base' });
            }
        }
        
        return comparison * direction;
    });

  }, [drivers, searchTerm, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) {
          return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
      }
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  const handleViewDetails = (driverId: string) => {
    router.push(`/fahrer/${driverId}`);
  };

  const getExpiryBadge = (ts: any) => {
    if (!ts) return null;
    const date = ts instanceof Timestamp ? ts.toDate() : new Date((ts as any).seconds * 1000);
    const daysLeft = differenceInCalendarDays(date, startOfDay(new Date()));
    
    if (daysLeft < 0) return <Badge variant="destructive" className="text-[10px] font-black uppercase">Abgelaufen</Badge>;
    if (daysLeft <= 30) return <Badge className="bg-orange-500 text-white text-[10px] font-black uppercase">Bald fällig</Badge>;
    return null;
  };

  return (
    <Card className="border-none shadow-none md:border md:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Fahrerliste</CardTitle>
            <CardDescription className="hidden md:block">Eine Übersicht aller registrierten Fahrer.</CardDescription>
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
      <CardContent className="p-0 md:p-6">
        {viewMode === 'grid' ? (
            /* --- GRID VIEW --- */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1 md:px-0">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="p-4 space-y-2">
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-4 w-3/4" />
                        </Card>
                    ))
                ) : filteredAndSortedDrivers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                        Keine Fahrer gefunden.
                    </div>
                ) : (
                    filteredAndSortedDrivers.map((driver) => (
                        <Card 
                            key={driver.id} 
                            className="overflow-hidden border-primary/10 active:scale-[0.98] transition-transform cursor-pointer"
                            onClick={() => handleViewDetails(driver.id!)}
                        >
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-black tracking-tight">{driver.first_name} {driver.last_name}</span>
                                            {getExpiryBadge(driver.license_expiry_date)}
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{driver.carrier || 'Privat / Sonstiges'}</p>
                                    </div>
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        {driver.phone && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/5" onClick={(e) => { e.stopPropagation(); window.location.href=`tel:${driver.phone}`; }}><Phone className="h-3.5 w-3.5" /></Button>}
                                        {driver.email && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/5" onClick={(e) => { e.stopPropagation(); window.location.href=`mailto:${driver.email}`; }}><Mail className="h-3.5 w-3.5" /></Button>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Fahrzeug</p>
                                        <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                            <Car className="h-3 w-3 text-primary" />
                                            {driver.assigned_vehicle_ids?.length ? vehiclesMap.get(driver.assigned_vehicle_ids[0])?.license_plate : 'Keins'}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">FS Gültig bis</p>
                                        <div className="flex items-center gap-1.5 text-xs font-bold">
                                            <CalendarClock className="h-3 w-3 text-primary" />
                                            {driver.license_expiry_date ? format(driver.license_expiry_date.toDate(), 'dd.MM.yy') : '-'}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        ) : (
            /* --- LIST VIEW --- */
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('last_name')}>
                        <div className='flex items-center'>Name {getSortIcon('last_name')}</div>
                    </TableHead>
                    <TableHead>Zugewiesenes Fahrzeug</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('carrier')}>
                        <div className='flex items-center'>Zusteller {getSortIcon('carrier')}</div>
                    </TableHead>
                    <TableHead>Führerscheinklassen</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('license_expiry_date')}>
                        <div className='flex items-center'>FS Gültig bis {getSortIcon('license_expiry_date')}</div>
                    </TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ?
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                    )) : filteredAndSortedDrivers.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                        Keine Fahrer gefunden.
                        </TableCell>
                    </TableRow>
                    ) :
                    filteredAndSortedDrivers.map((driver) => {
                        let expiryDateCell: React.ReactNode = '-';
                        if (driver.license_expiry_date) {
                            const ts = driver.license_expiry_date;
                            const date = ts instanceof Timestamp ? ts.toDate() : new Date((ts as any).seconds * 1000);
                            const daysLeft = differenceInCalendarDays(date, startOfDay(new Date()));
                            let colorClass = '';
                            let infoText = '';
                    
                            if (daysLeft < 0) {
                                colorClass = 'text-red-600 font-semibold';
                                infoText = `Abgelaufen seit ${Math.abs(daysLeft)} Tagen`;
                            } else if (daysLeft <= 30) {
                                colorClass = 'text-red-600 font-semibold';
                                infoText = daysLeft === 0 ? 'Heute fällig' : `in ${daysLeft} Tagen`;
                            } else if (daysLeft <= 180) {
                                colorClass = 'text-yellow-600';
                                infoText = `in ${daysLeft} Tagen`;
                            } else {
                                colorClass = 'text-green-600';
                                infoText = `in ${daysLeft} Tagen`;
                            }
                            
                            expiryDateCell = (
                                <div>
                                    <span className={colorClass}>{format(date, 'dd.MM.yyyy', { locale: de })}</span>
                                    {infoText && <div className={cn("text-xs", colorClass)}>{infoText}</div>}
                                </div>
                            );
                        }
                        
                        return (
                        <TableRow 
                        key={driver.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(driver.id!)}
                        >
                        <TableCell className="font-medium">{driver.last_name}, {driver.first_name}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                            {driver.assigned_vehicle_ids && driver.assigned_vehicle_ids.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {driver.assigned_vehicle_ids.map(vehicleId => {
                                        const vehicle = vehiclesMap.get(vehicleId);
                                        if (!vehicle) return <div key={vehicleId} className="text-xs text-muted-foreground">{vehicleId}</div>;
                                        return (
                                            <Link key={vehicleId} href={`/fahrzeuge/${vehicleId}`} className="text-sm hover:underline">
                                                {vehicle.license_plate}
                                            </Link>
                                        )
                                    })}
                                </div>
                            ) : (
                                <span className="text-muted-foreground">-</span>
                            )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                                {driver.email && (
                                    <a href={`mailto:${driver.email}`} className="flex items-center gap-2 text-sm hover:underline">
                                        <Mail className="h-3 w-3" /> {driver.email}
                                    </a>
                                )}
                                <a href={`tel:${driver.phone}`} className="flex items-center gap-2 text-sm hover:underline">
                                    <Phone className="h-3 w-3" /> {driver.phone}
                                </a>
                            </div>
                        </TableCell>
                        <TableCell>{driver.carrier || '-'}</TableCell>
                        <TableCell>{driver.license_classes.join(', ')}</TableCell>
                        <TableCell>{expiryDateCell}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Menü öffnen</span>
                                <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(driver.id!)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Details anzeigen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEditDriver(driver)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Bearbeiten
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                </Table>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
