'use client';

import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Handshake, Car, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import ActionPincodeDialog from '@/components/scan/action-pincode-dialog';

type Vehicle = {
  id: string;
  license_plate: string;
  make: string;
  model: string;
};

type ActionType = 'reportDamage' | 'startHandover' | 'viewDetails';

export default function ScanVehiclePage() {
  const params = useParams();
  const vehicleId = params?.vehicleId as string;
  const firestore = useFirestore();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);

  const fetchVehicle = useCallback(async () => {
    if (!firestore || !vehicleId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
      const docRef = doc(firestore, 'vehicles', vId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setVehicle({ id: docSnap.id, ...docSnap.data() } as Vehicle);
      } else {
        setError('Fahrzeug in der Datenbank nicht gefunden.');
      }
    } catch (err) {
      console.error("Scan fetch error:", err);
      setError('Datenbank-Verbindung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  }, [firestore, vehicleId]);

  useEffect(() => {
    if (firestore && vehicleId) {
      fetchVehicle();
    }
  }, [firestore, vehicleId, fetchVehicle]);

  const handleActionClick = (action: ActionType) => {
    setSelectedAction(action);
    setIsPinDialogOpen(true);
  };

  const handlePinSuccess = () => {
    setIsPinDialogOpen(false);
    if (!vehicle) return;

    switch (selectedAction) {
      case 'reportDamage':
        router.push(`/scan/vehicle/${vehicle.id}/report-damage`);
        break;
      case 'startHandover':
        router.push(`/fahrzeuguebergabe/neu?vehicleId=${vehicle.id}`);
        break;
      case 'viewDetails':
        router.push(`/fahrzeuge/${vehicle.id}`);
        break;
    }
  };

  return (
    <main className="min-h-screen bg-muted flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold uppercase tracking-tight">Fahrzeug-Scan</h1>
        </div>

        <Card className="border-primary/20 shadow-xl overflow-hidden">
          <CardHeader className="bg-primary/5 text-center border-b">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Gescanntes Fahrzeug</CardTitle>
          </CardHeader>
          <CardContent className="text-center p-8">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-3/4 mx-auto rounded-full" />
                <Skeleton className="h-6 w-1/2 mx-auto" />
              </div>
            ) : vehicle ? (
              <div className="animate-in zoom-in-95 duration-300">
                <p className="text-4xl font-black tracking-tighter text-foreground mb-1">{vehicle.license_plate}</p>
                <p className="text-lg font-bold text-muted-foreground">{vehicle.make} {vehicle.model}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-destructive font-bold">{error || 'Fahrzeug nicht gefunden.'}</p>
                <Button variant="outline" size="sm" onClick={fetchVehicle}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Erneut versuchen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {vehicle && (
          <div className="space-y-4">
            <Button
              className="w-full h-20 text-lg font-black shadow-lg rounded-2xl transition-all active:scale-95"
              onClick={() => handleActionClick('reportDamage')}
            >
              <ShieldAlert className="mr-4 h-8 w-8" /> SCHADEN MELDEN
            </Button>
            <Button
              className="w-full h-20 text-lg font-black shadow-lg rounded-2xl transition-all active:scale-95 bg-status-green hover:bg-status-green/90"
              onClick={() => handleActionClick('startHandover')}
            >
              <Handshake className="mr-4 h-8 w-8" /> ÜBERGABE STARTEN
            </Button>
            <Button
              variant="outline"
              className="w-full h-20 text-lg font-black shadow-sm rounded-2xl bg-background transition-all active:scale-95"
              onClick={() => handleActionClick('viewDetails')}
            >
              <Car className="mr-4 h-8 w-8 text-primary" /> DETAILS ANZEIGEN
            </Button>
          </div>
        )}
      </div>

      <ActionPincodeDialog
        isOpen={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        onSuccess={handlePinSuccess}
      />
    </main>
  );
}
