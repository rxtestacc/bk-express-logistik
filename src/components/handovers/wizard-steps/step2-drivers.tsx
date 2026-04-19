'use client';

import { useHandoverState } from '../handover-state-provider';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';

interface Driver {
    id: string;
    first_name: string;
    last_name: string;
}

export function HandoverStep2Drivers() {
  const { handoverData, setHandoverData } = useHandoverState();
  const firestore = useFirestore();
  const [isFromDriverUnknown, setIsFromDriverUnknown] = useState(handoverData.fromDriverId === null);

  const driversQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'drivers'), orderBy('last_name'));
  }, [firestore]);

  const { data: drivers, isLoading } = useCollection<Driver>(driversQuery);

  const handleFromDriverSelect = (driverId: string) => {
    const selectedDriver = drivers?.find(d => d.id === driverId);
    if (selectedDriver) {
      setHandoverData(prev => ({
        ...prev,
        fromDriverId: selectedDriver.id,
        fromDriverName: `${selectedDriver.first_name} ${selectedDriver.last_name}`,
      }));
    }
  };
  
  const handleToDriverSelect = (driverId: string) => {
    const selectedDriver = drivers?.find(d => d.id === driverId);
    if (selectedDriver) {
      setHandoverData(prev => ({
        ...prev,
        toDriverId: selectedDriver.id,
        toDriverName: `${selectedDriver.first_name} ${selectedDriver.last_name}`,
      }));
    }
  };

  const handleUnknownDriverChange = (checked: boolean) => {
      setIsFromDriverUnknown(checked);
      if (checked) {
          setHandoverData(prev => ({
              ...prev,
              fromDriverId: null,
              fromDriverName: 'Unbekannt',
          }))
      } else {
           setHandoverData(prev => ({
              ...prev,
              fromDriverId: '', // Reset to force a selection
              fromDriverName: '',
          }))
      }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-center">Fahrer auswählen</h2>
        <p className="text-center text-muted-foreground">
            Wählen Sie den abgebenden und den übernehmenden Fahrer aus.
        </p>
      
        {isLoading ? (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        ) : (
            <div className="space-y-4">
                <div>
                    <Label htmlFor="fromDriver">Abgebender Fahrer</Label>
                    <Select onValueChange={handleFromDriverSelect} value={handoverData.fromDriverId ?? ''} disabled={isFromDriverUnknown}>
                        <SelectTrigger id="fromDriver" className="text-base">
                            <SelectValue placeholder="Fahrer auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {drivers?.map(d => (
                                <SelectItem key={d.id} value={d.id}>
                                    {d.last_name}, {d.first_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <div className="flex items-center space-x-2 mt-2">
                        <Checkbox id="unknown-driver" checked={isFromDriverUnknown} onCheckedChange={handleUnknownDriverChange} />
                        <Label htmlFor="unknown-driver" className="text-sm font-normal">
                            Vorheriger Fahrer unbekannt
                        </Label>
                    </div>
                </div>
                 <div>
                    <Label htmlFor="toDriver">Übernehmender Fahrer (Pflichtfeld)</Label>
                    <Select onValueChange={handleToDriverSelect} value={handoverData.toDriverId ?? ''}>
                        <SelectTrigger id="toDriver" className="text-base">
                            <SelectValue placeholder="Fahrer auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {drivers?.map(d => (
                                <SelectItem key={d.id} value={d.id}>
                                    {d.last_name}, {d.first_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        )}

        {(handoverData.fromDriverName || handoverData.toDriverName) && (
            <Card className="mt-4 animate-in fade-in">
                <CardHeader>
                    <CardTitle>Ausgewählte Fahrer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {handoverData.fromDriverName && <p className="text-md">Von: <span className="font-medium">{handoverData.fromDriverName}</span></p>}
                    {handoverData.toDriverName && <p className="text-md">An: <span className="font-medium">{handoverData.toDriverName}</span></p>}
                </CardContent>
            </Card>
        )}
    </div>
  );
}
