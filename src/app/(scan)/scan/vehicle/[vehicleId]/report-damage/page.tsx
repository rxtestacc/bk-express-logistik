
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { MobileDamageReportWizard } from '@/components/scan/mobile-damage-report-wizard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function MobileReportDamagePage() {
  const { vehicleId } = useParams();
  const firestore = useFirestore();
  const router = useRouter();

  const vehicleRef = useMemoFirebase(() => {
    if (!firestore || !vehicleId) return null;
    return doc(firestore, 'vehicles', Array.isArray(vehicleId) ? vehicleId[0] : vehicleId);
  }, [firestore, vehicleId]);

  const { data: vehicle, isLoading } = useDoc<any>(vehicleRef);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center space-y-4 text-center">
        <p className="text-destructive font-semibold">Fahrzeug nicht gefunden.</p>
        <Button onClick={() => router.back()}>Zurück</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Schaden melden</h1>
          <p className="text-xs text-muted-foreground">{vehicle.license_plate} - {vehicle.make} {vehicle.model}</p>
        </div>
      </header>
      
      <main className="p-4">
        <MobileDamageReportWizard vehicle={vehicle} />
      </main>
    </div>
  );
}
