
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, writeBatch } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, CheckCircle2, Loader2, RefreshCw, X, AlertTriangle, ArrowRight, Gauge } from 'lucide-react';
import Image from 'next/image';
import { generateAuditLog } from '@/lib/audit-log';

type Step = 'photo' | 'details' | 'finish';

interface MobileDamageReportWizardProps {
  vehicle: any;
}

export function MobileDamageReportWizard({ vehicle }: MobileDamageReportWizardProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<Step>('photo');
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [odometer, setOdometer] = useState<string>(vehicle.mileage_km?.toString() || '');

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const getCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Kamerazugriff fehlgeschlagen:', err);
      setHasCameraPermission(false);
    }
  }, []);

  useEffect(() => {
    if (currentStep === 'photo') {
      getCameraPermission();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentStep, getCameraPermission]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setImages(prev => [...prev, dataUrl]);
    toast({ title: 'Foto hinzugefügt', description: `${images.length + 1}. Bild erfasst.` });
  };

  const handleSave = async () => {
    if (!firestore || !session) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const odometerValue = parseInt(odometer) || 0;

      // Intelligent Mileage Update
      if (odometerValue > 0) {
          const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
          const vehicleSnap = await getDoc(vehicleRef);
          if (vehicleSnap.exists()) {
              const currentMileage = vehicleSnap.data().mileage_km || 0;
              if (odometerValue > currentMileage) {
                  batch.update(vehicleRef, {
                      mileage_km: odometerValue,
                      mileage_updated_at: serverTimestamp()
                  });
              }
          }
      }

      const payload = {
        vehicleId: vehicle.id,
        type: 'damage',
        title: title || `Schadensmeldung vom ${new Date().toLocaleDateString('de-DE')}`,
        due_date: serverTimestamp(),
        odometer_km: odometerValue,
        cost_eur: 0, 
        status: 'open',
        notes: description,
        images: images,
        created_by_name: session.name,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_via: 'mobile_scan'
      };

      const eventRef = doc(collection(firestore, 'vehicle_events'));
      batch.set(eventRef, payload);
      
      await batch.commit();
      await generateAuditLog(firestore, 'event', eventRef.id, {}, payload, session.name, 'create');
      
      setCurrentStep('finish');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Meldung konnte nicht gespeichert werden.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'photo':
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Fotos aufnehmen</h2>
              <p className="text-sm text-muted-foreground">Fotografieren Sie den Schaden aus verschiedenen Perspektiven.</p>
            </div>

            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                Live Kamera
              </div>
            </div>

            <Button onClick={capturePhoto} className="w-full h-20 rounded-2xl text-xl shadow-xl bg-primary hover:bg-primary/90" size="lg">
              <Camera className="mr-3 h-8 w-8" /> Foto aufnehmen
            </Button>

            {images.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Aufnahmen ({images.length})</h3>
                  <Button variant="ghost" size="sm" onClick={() => setImages([])} className="text-xs text-destructive">
                    <RefreshCw className="mr-1 h-3 w-3" /> Alle löschen
                  </Button>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted shadow-sm">
                      <Image src={img} alt={`Schaden ${i+1}`} layout="fill" objectFit="cover" />
                      <button 
                        onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => setCurrentStep('details')} 
                  className="w-full h-16 rounded-2xl bg-primary text-white shadow-lg text-lg"
                >
                  Weiter zur Beschreibung <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        );

      case 'details':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
                <h2 className="text-xl font-bold">Details zum Schaden</h2>
                <p className="text-sm text-muted-foreground">Bitte beschreiben Sie kurz, was passiert ist.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-bold"><Gauge className="h-4 w-4 text-primary" /> Kilometerstand (Tacho)</Label>
                <Input 
                  type="number" 
                  value={odometer} 
                  onChange={(e) => setOdometer(e.target.value)}
                  placeholder="Aktueller Stand"
                  className="h-12 text-lg rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Kurzer Betreff</Label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Kratzer Fahrertür"
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Beschreibung / Hergang</Label>
                <Textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Was ist passiert? Wo genau ist der Schaden?"
                  rows={5}
                  className="rounded-xl resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('photo')} className="h-14 rounded-xl">
                    Zurück
                </Button>
                <Button onClick={handleSave} disabled={isProcessing || !odometer || !title} className="h-14 rounded-xl shadow-xl bg-primary text-white">
                    {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                    Schaden melden
                </Button>
            </div>
          </div>
        );

      case 'finish':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center animate-in zoom-in-95 duration-500">
            <div className="bg-green-500 text-white p-6 rounded-full shadow-2xl shadow-green-500/30">
              <CheckCircle2 className="h-16 w-16" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Erfolgreich gemeldet!</h2>
              <p className="text-muted-foreground max-w-[250px] mx-auto">Die Schadensmeldung wurde gespeichert. Die Fuhrparkleitung wurde informiert.</p>
            </div>
            <Button onClick={() => router.push('/dashboard')} className="w-full h-14 rounded-2xl" variant="outline">
              Zum Dashboard
            </Button>
          </div>
        );
    }
  };

  if (hasCameraPermission === false) {
    return (
      <Card className="border-destructive shadow-lg animate-in fade-in">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle /> Kamera-Fehler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">Um einen Schaden mobil zu melden, benötigen wir Zugriff auf Ihre Kamera. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen Ihres Handys.</p>
        </CardContent>
        <CardFooter>
          <Button onClick={getCameraPermission} className="w-full h-12 rounded-xl">Zugriff erneut anfragen</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="max-w-md mx-auto h-full pb-10">
      {renderStep()}
    </div>
  );
}
