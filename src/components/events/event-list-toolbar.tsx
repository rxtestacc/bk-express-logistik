'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Car, Search } from 'lucide-react';

interface EventListToolbarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedVehicle: string;
  setSelectedVehicle: (vehicleId: string) => void;
}

type Vehicle = { id: string; license_plate: string; make: string; model: string; };

export function EventListToolbar({
  searchTerm,
  setSearchTerm,
  selectedVehicle,
  setSelectedVehicle,
}: EventListToolbarProps) {

  const firestore = useFirestore();
  const vehiclesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'vehicles'), orderBy('license_plate')) : null, [firestore]);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);


  return (
    <div className="flex items-center justify-between gap-4 py-4 border-t border-b">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ereignisse durchsuchen..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
         <Car className="h-4 w-4 text-muted-foreground" />
         <Select value={selectedVehicle || 'all'} onValueChange={(value) => setSelectedVehicle(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Nach Fahrzeug filtern..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Alle Fahrzeuge</SelectItem>
                {vehicles?.map(vehicle => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.license_plate} ({vehicle.make} {vehicle.model})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
    </div>
  );
}
