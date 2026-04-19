'use client';

import { useHandoverState } from '../handover-state-provider';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

interface Vehicle {
    id: string;
    license_plate: string;
    make: string;
    model: string;
}

export function HandoverStep1Vehicle() {
  const { handoverData, setHandoverData } = useHandoverState();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const preselectedVehicleId = searchParams.get('vehicleId');

  const vehiclesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'vehicles'), orderBy('license_plate'));
  }, [firestore]);

  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesQuery);

  const handleVehicleSelect = (vehicleId: string) => {
    const selectedVehicle = vehicles?.find(v => v.id === vehicleId);
    if (selectedVehicle) {
      setHandoverData(prev => ({
        ...prev,
        vehicleId: selectedVehicle.id,
        vehicleLabel: `${selectedVehicle.license_plate} (${selectedVehicle.make} ${selectedVehicle.model})`,
      }));
    }
  };

  useEffect(() => {
    if (preselectedVehicleId && vehicles) {
        handleVehicleSelect(preselectedVehicleId);
    }
  }, [preselectedVehicleId, vehicles]);

  return (
    <div className="max-w-md mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-center">Fahrzeug auswählen</h2>
        <p className="text-center text-muted-foreground">
            Wählen Sie das Fahrzeug aus, das übergeben werden soll.
        </p>
      
        {isLoading ? (
            <Skeleton className="h-10 w-full" />
        ) : (
            <Select onValueChange={handleVehicleSelect} value={handoverData.vehicleId ?? ''}>
                <SelectTrigger className="text-base">
                    <SelectValue placeholder="Fahrzeug nach Kennzeichen suchen..." />
                </SelectTrigger>
                <SelectContent>
                    {vehicles?.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                            {v.license_plate} ({v.make} {v.model})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        )}
      
        <Button variant="outline" className="w-full" disabled>
            <QrCode className="mr-2 h-4 w-4" />
            Per QR-Code scannen (kommt später)
        </Button>

        {handoverData.vehicleLabel && (
            <Card className="mt-4 animate-in fade-in">
                <CardHeader>
                    <CardTitle>Ausgewähltes Fahrzeug</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg font-medium">{handoverData.vehicleLabel}</p>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
