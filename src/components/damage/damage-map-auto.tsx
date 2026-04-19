'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import DamageMap from '@/components/damage/damage-map';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type EventDoc = {
  vehicleId?: string;
  // ...weitere Felder egal
};

export default function DamageMapAuto() {
  const params = useParams();
  const eventId = (params?.id as string) || '';
  const firestore = useFirestore();

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!firestore || !eventId) return;

        // Wir versuchen nacheinander gängige Collections:
        const candidates = ['vehicle_events', 'events', 'ereignisse'];
        let foundVehicleId: string | null = null;

        for (const col of candidates) {
          const ref = doc(firestore, col, eventId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as EventDoc;
            if (data?.vehicleId) {
              foundVehicleId = data.vehicleId;
              break;
            }
          }
        }

        if (!mounted) return;

        if (foundVehicleId) {
          setVehicleId(foundVehicleId);
          setState('ready');
        } else {
          setState('error');
        }
      } catch (error) {
        console.error("Error fetching vehicle data for damage map:", error);
        if (mounted) setState('error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [firestore, eventId]);

  if (state === 'loading') {
    return (
      <Card>
        <CardHeader><CardTitle>Schadenskizze</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === 'error' || !vehicleId) {
    return (
      <Card>
        <CardHeader><CardTitle>Schadenskizze</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Konnte das Ereignis oder die zugehörige Fahrzeug-ID nicht laden.
        </CardContent>
      </Card>
    );
  }

  // Alles vorhanden → echte Karte rendern
  return (
    <DamageMap
      vehicleId={vehicleId}
      eventId={eventId}
      vehicleKind="transporter"
      defaultView="left"
      canEdit
    />
  );
}
