'use client';

import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye } from 'lucide-react';
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
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';

interface Handover {
  id: string;
  vehicleId: string;
  handoverAt: Timestamp;
  fromDriverName: string | null;
  toDriverName: string;
  status: 'draft' | 'completed' | 'new_damage' | 'in_review' | 'closed';
}

interface VehicleHandoversListProps {
  vehicleId: string;
}

export function VehicleHandoversList({ vehicleId }: VehicleHandoversListProps) {
  const router = useRouter();
  // Nutze zentrale Daten aus dem Provider statt eigene Listener zu erstellen
  const { handovers, isLoading } = useDashboardData();
  
  const filteredAndSortedHandovers = useMemo(() => {
    if (!handovers) return [];
    // Filter nach Fahrzeug und sortiere lokal (neueste zuerst)
    return handovers
        .filter(h => h.vehicleId === vehicleId)
        .sort((a, b) => {
            const getT = (ts: any) => ts instanceof Timestamp ? ts.toMillis() : (ts as any).seconds * 1000;
            return getT(b.handoverAt) - getT(a.handoverAt);
        });
  }, [handovers, vehicleId]);


  const handleViewDetails = (id: string) => {
    router.push(`/fahrzeuguebergabe/${id}`);
  };

  const statusTranslations: Record<string, string> = {
    draft: 'Entwurf',
    completed: 'Abgeschlossen',
    new_damage: 'Neuer Schaden',
    in_review: 'In Prüfung',
    closed: 'Archiviert'
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead>Von Fahrer</TableHead>
          <TableHead>An Fahrer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
            </TableRow>
        )) : filteredAndSortedHandovers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center">
              Für dieses Fahrzeug wurden keine Übergaben protokolliert.
            </TableCell>
          </TableRow>
        ) : filteredAndSortedHandovers.map((handover) => {
            const d = handover.handoverAt instanceof Timestamp ? handover.handoverAt.toDate() : new Date((handover.handoverAt as any).seconds * 1000);
            return (
                <TableRow 
                  key={handover.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewDetails(handover.id)}
                >
                    <TableCell>{format(d, "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de })}</TableCell>
                    <TableCell>{handover.fromDriverName || 'Unbekannt'}</TableCell>
                    <TableCell>{handover.toDriverName}</TableCell>
                    <TableCell>
                        <Badge variant={handover.status === 'completed' ? 'default' : 'secondary'}>
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
            );
        })}
      </TableBody>
    </Table>
  );
}
