'use client';

import { useMemo, useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
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
import { MoreHorizontal, Pencil, Eye, QrCode, ArrowUpDown, Car, User, MapPin, LayoutGrid, List } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { VehicleFormSheet } from './vehicle-form-sheet';
import type { VehicleFormData } from './vehicle-form-sheet';
import VehicleQRCodeDialog from './vehicle-qr-code-dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Vehicle = VehicleFormData & { id: string };

interface Handover {
  id: string;
  vehicleId: string;
  toDriverId: string;
  handoverAt: Timestamp;
  status: 'completed' | 'draft';
}

interface Driver {
    id: string;
    first_name: string;
    last_name: string;
}

interface VehicleListProps {
  vehicles: Vehicle[] | null;
  drivers: Driver[] | null;
  handovers: Handover[] | null;
  isLoading: boolean;
  searchTerm: string;
  statusFilter: string;
  carrierFilter: string;
}

type SortKey = 'license_plate' | 'make' | 'model' | 'driver' | 'carrier' | 'vin' | 'status';
type ViewMode = 'grid' | 'list';

export default function VehicleList({ 
    vehicles, 
    drivers,
    handovers,
    isLoading, 
    searchTerm, 
    statusFilter, 
    carrierFilter 
}: VehicleListProps) {
  const router = useRouter();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | undefined>(undefined);
  const [qrCodeVehicle, setQrCodeVehicle] = useState<Vehicle | undefined>(undefined);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'make', direction: 'asc' });
  
  const driversMap = useMemo(() => new Map(drivers?.map(d => [d.id, {name: `${d.first_name} ${d.last_name}`, id: d.id}])), [drivers]);

  // Load saved view mode
  useEffect(() => {
    const savedMode = localStorage.getItem('bkexpress_vehicle_view_mode') as ViewMode;
    if (savedMode && ['grid', 'list'].includes(savedMode)) {
        setViewMode(savedMode);
    }
  }, []);

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('bkexpress_vehicle_view_mode', mode);
  };

  const vehicleDriversMap = useMemo(() => {
      if (!handovers || !driversMap) return new Map();

      const latestHandovers = new Map<string, Handover>();
      handovers.forEach(h => {
          if (!h.vehicleId) return;
          const existing = latestHandovers.get(h.vehicleId);
          if (!existing || h.handoverAt.toMillis() > existing.handoverAt.toMillis()) {
              latestHandovers.set(h.vehicleId, h);
          }
      });

      const vehicleToDriverMap = new Map<string, {name: string, id: string}>();
      latestHandovers.forEach((handover, vehicleId) => {
          if (handover.toDriverId) {
              const driver = driversMap.get(handover.toDriverId);
              if (driver) {
                  vehicleToDriverMap.set(vehicleId, driver);
              }
          }
      });
      return vehicleToDriverMap;
  }, [handovers, driversMap]);

  const filteredAndSortedVehicles = useMemo(() => {
    if (!vehicles) return [];
    
    let filtered = [...vehicles];

    if (statusFilter) {
      filtered = filtered.filter(vehicle => vehicle.status === statusFilter);
    }

    if (carrierFilter) {
      filtered = filtered.filter(vehicle => vehicle.carrier === carrierFilter);
    }
    
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filtered = filtered.filter((vehicle) => {
        const driver = vehicleDriversMap.get(vehicle.id);
        return (
          vehicle.license_plate?.toLowerCase().includes(lowercasedFilter) ||
          vehicle.make?.toLowerCase().includes(lowercasedFilter) ||
          vehicle.model?.toLowerCase().includes(lowercasedFilter) ||
          vehicle.vin?.toLowerCase().includes(lowercasedFilter) ||
          vehicle.carrier?.toLowerCase().includes(lowercasedFilter) ||
          (driver && driver.name.toLowerCase().includes(lowercasedFilter))
        );
      });
    }

    return filtered.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;
        
        let comparison = 0;

        if (sortConfig.key === 'driver') {
            aValue = vehicleDriversMap.get(a.id)?.name || '';
            bValue = vehicleDriversMap.get(b.id)?.name || '';
            comparison = (aValue as string).localeCompare(bValue as string);
        } else {
            aValue = (a as any)[sortConfig.key] || '';
            bValue = (b as any)[sortConfig.key] || '';
             if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            }
        }
        
        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [vehicles, searchTerm, statusFilter, carrierFilter, sortConfig, vehicleDriversMap]);

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
  
  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsSheetOpen(true);
  };
  
  const handleViewDetails = (vehicleId: string) => {
    router.push(`/fahrzeuge/${vehicleId}`);
  };

  const handleShowQrCode = (vehicle: Vehicle) => {
    setQrCodeVehicle(vehicle);
    setIsQrCodeDialogOpen(true);
  };
  
  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
    if (!isOpen) {
      setEditingVehicle(undefined);
    }
  }

  const getStatusVariant = (status: Vehicle['status']) => {
    switch (status) {
      case 'aktiv':
        return 'default';
      case 'in_werkstatt':
        return 'secondary';
      default:
        return 'outline';
    }
  };
  
  const statusTranslations: { [key: string]: string } = {
      aktiv: 'Aktiv',
      in_werkstatt: 'In Werkstatt',
      inaktiv: 'Inaktiv',
  }

  return (
    <>
    <Card className="border-none shadow-none md:border md:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Fuhrparkliste</CardTitle>
            <CardDescription className="hidden md:block">Eine Übersicht über alle Fahrzeuge in Ihrem Fuhrpark.</CardDescription>
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
                        <Card key={i} className="p-4 space-y-3">
                            <Skeleton className="h-6 w-1/3" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-10 w-full" />
                        </Card>
                    ))
                ) : filteredAndSortedVehicles.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                        Keine Fahrzeuge gefunden.
                    </div>
                ) : (
                    filteredAndSortedVehicles.map((vehicle) => {
                        const driver = vehicleDriversMap.get(vehicle.id);
                        return (
                            <Card 
                                key={vehicle.id} 
                                className="overflow-hidden border-primary/10 active:scale-[0.98] transition-transform cursor-pointer"
                                onClick={() => handleViewDetails(vehicle.id)}
                            >
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-black tracking-tight">{vehicle.license_plate}</span>
                                                <Badge variant={getStatusVariant(vehicle.status)} className="text-[10px] h-5 px-1.5 font-bold uppercase">
                                                    {statusTranslations[vehicle.status]}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground">{vehicle.make} {vehicle.model}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleShowQrCode(vehicle); }}>
                                            <QrCode className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Fahrer</p>
                                            <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                                <User className="h-3 w-3 text-primary" />
                                                {driver ? driver.name : 'Nicht zugeordnet'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Zusteller</p>
                                            <div className="flex items-center gap-1.5 text-xs font-bold">
                                                <MapPin className="h-3 w-3 text-primary" />
                                                {vehicle.carrier || '-'}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        ) : (
            /* --- LIST VIEW --- */
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('license_plate')}>
                        <div className="flex items-center">Kennzeichen {getSortIcon('license_plate')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('make')}>
                        <div className="flex items-center">Hersteller {getSortIcon('make')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('model')}>
                        <div className="flex items-center">Modell {getSortIcon('model')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('driver')}>
                        <div className="flex items-center">Fahrer {getSortIcon('driver')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('carrier')}>
                        <div className="flex items-center">Zusteller {getSortIcon('carrier')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('vin')}>
                        <div className="flex items-center">VIN {getSortIcon('vin')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('status')}>
                        <div className="flex items-center">Status {getSortIcon('status')}</div>
                    </TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                    {!isLoading && filteredAndSortedVehicles.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                        Keine Fahrzeuge gefunden.
                        </TableCell>
                    </TableRow>
                    )}
                    {!isLoading &&
                    filteredAndSortedVehicles.map((vehicle) => {
                        const driver = vehicleDriversMap.get(vehicle.id);
                        const carrierClass =
                        vehicle.carrier === 'Hermes'
                            ? 'bg-blue-50/50 dark:bg-blue-900/20'
                            : vehicle.carrier === 'GLS'
                            ? 'bg-amber-50/50 dark:bg-amber-950/50'
                            : '';
                        return (
                        <TableRow 
                        key={vehicle.id} 
                        className={cn("cursor-pointer hover:bg-muted/50", carrierClass)}
                        onClick={() => handleViewDetails(vehicle.id)}
                        >
                        <TableCell className="font-medium">{vehicle.license_plate}</TableCell>
                        <TableCell>{vehicle.make}</TableCell>
                        <TableCell>{vehicle.model}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                            {driver ? (
                                <Link href={`/fahrer/${driver.id}`} className="hover:underline">{driver.name}</Link>
                            ) : (
                                <span className="text-muted-foreground">-</span>
                            )}
                        </TableCell>
                        <TableCell>{vehicle.carrier || '-'}</TableCell>
                        <TableCell>{vehicle.vin}</TableCell>
                        <TableCell>
                            {vehicle.status && (
                                <Badge variant={getStatusVariant(vehicle.status)}>
                                {statusTranslations[vehicle.status] || vehicle.status}
                                </Badge>
                            )}
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
                                <DropdownMenuItem onClick={() => handleViewDetails(vehicle.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Details anzeigen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(vehicle)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShowQrCode(vehicle)}>
                                <QrCode className="mr-2 h-4 w-4" />
                                QR-Code anzeigen
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
     <VehicleFormSheet 
        isOpen={isSheetOpen} 
        onOpenChange={handleSheetOpenChange}
        vehicleData={editingVehicle}
      />
      {qrCodeVehicle && (
        <VehicleQRCodeDialog
          vehicle={qrCodeVehicle}
          open={isQrCodeDialogOpen}
          onOpenChange={setIsQrCodeDialogOpen}
        />
      )}
    </>
  );
}
