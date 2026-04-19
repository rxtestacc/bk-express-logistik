
'use client';

import { useRouter } from 'next/navigation';
import { useHandoverState } from '../handover-state-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, serverTimestamp, Timestamp, writeBatch, query, where, getDocs, doc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Loader2, AlertCircle, UploadCloud, X, Camera } from 'lucide-react';
import { useState } from 'react';
import { generateAuditLog } from '@/lib/audit-log';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AdditionalPhotoCamera } from './additional-photo-camera';


/**
 * Erstellt ein neues Bild mit einem Informations-Footer am unteren Rand.
 * Mit dynamischer Schriftgrößenanpassung für volle Lesbarkeit.
 */
async function stampImageWithMetadata(base64Image: string, text: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            const footerHeight = Math.max(80, Math.round(img.height * 0.15));
            canvas.width = img.width;
            canvas.height = img.height + footerHeight;

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            let fontSize = Math.round(footerHeight * 0.35);
            ctx.font = `bold ${fontSize}px "Inter", "Helvetica", sans-serif`;
            
            let metrics = ctx.measureText(text);
            const maxTextWidth = canvas.width * 0.95;
            
            while (metrics.width > maxTextWidth && fontSize > 12) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px "Inter", "Helvetica", sans-serif`;
                metrics = ctx.measureText(text);
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.fillText(text, canvas.width / 2, img.height + (footerHeight / 2));
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = (err) => reject(err);
        img.src = base64Image;
    });
}

function AdditionalPhotoManager({ onFilesAdded, onTakePhoto, disabled }: { onFilesAdded: (files: FileList) => void, onTakePhoto: () => void, disabled: boolean }) {
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) {
        onFilesAdded(event.dataTransfer.files);
    }
  };
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" onDragOver={handleDragOver} onDrop={handleDrop}>
        <label
          htmlFor="additional-photo-upload"
          className={cn("flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg bg-muted", !disabled && "cursor-pointer hover:bg-accent")}
        >
          <UploadCloud className="w-12 h-12 mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            <span className="font-semibold">Dateien hochladen</span><br />oder hierher ziehen
          </p>
          <Input
            id="additional-photo-upload"
            type="file"
            className="hidden"
            onChange={(e) => e.target.files && onFilesAdded(e.target.files)}
            multiple
            accept="image/*"
            disabled={disabled}
          />
        </label>
        <div
            onClick={disabled ? undefined : onTakePhoto}
            className={cn(
              "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg bg-muted",
              !disabled && "cursor-pointer hover:bg-accent"
            )}
        >
             <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold">Foto aufnehmen</span>
              </p>
        </div>
    </div>
  );
}


type PhotoKey = 'front' | 'rear' | 'left' | 'right' | 'mirror_left' | 'mirror_right';

const photoLabels: Record<PhotoKey, string> = {
  front: 'Frontansicht',
  rear: 'Heckansicht',
  left: 'Fahrerseite',
  right: 'Beifahrerseite',
  mirror_left: 'Außenspiegel Links',
  mirror_right: 'Außenspiegel Rechts',
};


const DetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => {
    if (!value) return null;
    return (
        <div className="flex justify-between items-start py-1 border-b border-muted last:border-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-right">{value}</p>
        </div>
    )
}

export function HandoverStep8Summary() {
  const { handoverData, setHandoverData } = useHandoverState();
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Robuste Kennzeichen-Extraktion
  const getPlate = () => {
    const label = handoverData.vehicleLabel || '';
    if (!label) return 'Unbekannt';
    return label.includes('(') ? label.split('(')[0].trim() : label;
  };

  const plate = getPlate();

  const handleAddPhotos = async (fileList: FileList) => {
    if (!session) return;
    setIsProcessingPhotos(true);
    const newPhotos: { url: string; metadataText: string }[] = [];
    const files = Array.from(fileList);

    for (const file of files) {
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const now = new Date();
            const dateStr = format(now, 'dd.MM.yyyy', { locale: de });
            const timeStr = format(now, 'HH:mm', { locale: de });
            const stampText = `Zusatzfoto | KENZ: ${plate} | DATUM: ${dateStr} | UHR: ${timeStr} Uhr`;
            
            const stampedImage = await stampImageWithMetadata(dataUrl, stampText);
            newPhotos.push({ url: stampedImage, metadataText: stampText });
        } catch(e) {
            console.error("Error processing file", file.name, e);
            toast({ variant: 'destructive', title: 'Fehler bei Bildverarbeitung', description: `Datei ${file.name} konnte nicht verarbeitet werden.`});
        }
    }

    setHandoverData(prev => ({
      ...prev,
      additionalPhotos: [...prev.additionalPhotos, ...newPhotos]
    }));
    setIsProcessingPhotos(false);
  };
  
  const handlePhotoCaptured = async (base64Image: string) => {
    if (!session) return;
    setIsProcessingPhotos(true);
    try {
        const now = new Date();
        const dateStr = format(now, 'dd.MM.yyyy', { locale: de });
        const timeStr = format(now, 'HH:mm', { locale: de });
        const stampText = `Zusatzfoto | KENZ: ${plate} | DATUM: ${dateStr} | UHR: ${timeStr} Uhr`;
        
        const stampedImage = await stampImageWithMetadata(base64Image, stampText);
        
        setHandoverData(prev => ({
          ...prev,
          additionalPhotos: [...prev.additionalPhotos, { url: stampedImage, metadataText: stampText }]
        }));

    } catch (e) {
        console.error("Error processing captured photo", e);
        toast({ variant: 'destructive', title: 'Fehler bei Bildverarbeitung'});
    } finally {
        setIsProcessingPhotos(false);
    }
  };


  const removeAdditionalPhoto = (index: number) => {
    setHandoverData(prev => ({
        ...prev,
        additionalPhotos: prev.additionalPhotos.filter((_, i) => i !== index)
    }));
  };

  const handleComplete = async () => {
    if (!firestore || !session) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Keine Verbindung zur Datenbank.' });
        return;
    }

    // Grundlegende Validierung der Pflichtfelder vor dem Batch
    if (!handoverData.vehicleId || !handoverData.toDriverId) {
        toast({ variant: 'destructive', title: 'Unvollständig', description: 'Bitte wählen Sie Fahrzeug und Empfänger aus.' });
        return;
    }

    setIsSaving(true);
    const batch = writeBatch(firestore);

    try {
        const handoverRef = doc(collection(firestore, 'vehicle_handovers'));
        const newHandoverId = handoverRef.id;

        const finalStatus = handoverData.newDamageEventId ? 'new_damage' : 'completed';
        
        // Bereinige Daten von undefined/null für Firestore
        const finalData = {
            ...handoverData,
            status: finalStatus,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdByName: session.name,
            handoverAt: handoverData.handoverAt || Timestamp.now(),
        };
        
        // Entferne temporäre ID vor dem Speichern
        delete (finalData as any).newDamageEventId;

        batch.set(handoverRef, finalData);

        // 1. Verarbeitung neuer Schäden (falls vorhanden)
        if (handoverData.newDamageEventId) {
            const markersQuery = query(
                collection(firestore, 'damage_markers'),
                where('eventId', '==', handoverData.newDamageEventId)
            );
            const markersSnapshot = await getDocs(markersQuery);

            if (!markersSnapshot.empty) {
                const damageEventRef = doc(collection(firestore, 'vehicle_events'));
                const damageEvent = {
                    vehicleId: handoverData.vehicleId,
                    driverId: handoverData.toDriverId, 
                    type: 'damage',
                    title: `Schaden bei Übergabe am ${format(handoverData.handoverAt.toDate(), 'dd.MM.yy')}`,
                    due_date: handoverData.handoverAt,
                    odometer_km: handoverData.odometerKm || 0,
                    cost_eur: 0, 
                    status: 'open',
                    notes: `Dieser Schadensfall wurde während der Fahrzeugübergabe (ID: ${newHandoverId}) erfasst.${handoverData.notes ? '\n\nZusatznotiz: ' + handoverData.notes : ''}`,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                    created_by_name: session.name,
                };
                batch.set(damageEventRef, damageEvent);
                
                // Marker auf das neue Event umbiegen
                markersSnapshot.forEach(markerDoc => {
                    batch.update(markerDoc.ref, { eventId: damageEventRef.id });
                });
            }
        }
        
        // 2. Fahrer-Fahrzeug-Zuweisung & Kilometer-Intelligenz aktualisieren
        if (handoverData.vehicleId) {
            const vehicleRef = doc(firestore, 'vehicles', handoverData.vehicleId);
            
            // Intelligent Mileage Update
            if (handoverData.odometerKm) {
                const vehicleSnap = await getDoc(vehicleRef);
                if (vehicleSnap.exists()) {
                    const currentMileage = vehicleSnap.data().mileage_km || 0;
                    if (handoverData.odometerKm > currentMileage) {
                        batch.update(vehicleRef, {
                            mileage_km: handoverData.odometerKm,
                            mileage_updated_at: serverTimestamp()
                        });
                    }
                }
            }

            // Neuer Fahrer erhält das Fahrzeug
            if (handoverData.toDriverId && typeof handoverData.toDriverId === 'string' && handoverData.toDriverId.length > 0) {
                const toDriverRef = doc(firestore, 'drivers', handoverData.toDriverId);
                batch.update(toDriverRef, {
                    assigned_vehicle_ids: arrayUnion(handoverData.vehicleId)
                });
            }
            
            // Alter Fahrer verliert das Fahrzeug (falls bekannt)
            if (handoverData.fromDriverId && typeof handoverData.fromDriverId === 'string' && handoverData.fromDriverId.length > 0) {
                const fromDriverRef = doc(firestore, 'drivers', handoverData.fromDriverId);
                batch.update(fromDriverRef, {
                    assigned_vehicle_ids: arrayRemove(handoverData.vehicleId)
                });
            }
        }
        
        await batch.commit();
        
        // Audit Log entkoppelt ausführen
        generateAuditLog(firestore, 'handover' as any, newHandoverId, {}, finalData, session.name, 'create').catch((e) => {
            console.error("Audit log failed for handover:", e);
        });
        
        toast({ title: 'Erfolg', description: 'Das Übergabeprotokoll wurde gespeichert.'});
        router.push(`/fahrzeuguebergabe/${newHandoverId}`);

    } catch (error: any) {
        console.error("Critical handover save error:", error);
        toast({ 
            variant: 'destructive', 
            title: 'Fehler beim Abschluss', 
            description: 'Das System konnte die Daten nicht speichern. Bitte prüfen Sie Ihre Verbindung.' 
        });
        setIsSaving(false);
    }
  };

  const checklistIssues = handoverData.checklist.filter(item => item.state !== 'ok');
  const photoEntries = Object.entries(handoverData.requiredPhotos) as [PhotoKey, any][];


  return (
    <>
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Zusammenfassung & Abschluss</h2>
        <p className="text-muted-foreground">
          Bitte überprüfen Sie alle Daten vor dem Abschluss der Übergabe.
        </p>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="bg-primary/5 pb-4"><CardTitle className="text-base">Übersicht & Fahrer</CardTitle></CardHeader>
        <CardContent className="pt-4 space-y-1">
            <DetailItem label="Fahrzeug" value={handoverData.vehicleLabel} />
            <DetailItem label="Abgebender Fahrer" value={handoverData.fromDriverName || 'Nicht angegeben'} />
            <DetailItem label="Übernehmender Fahrer" value={handoverData.toDriverName} />
            <DetailItem label="Datum/Uhrzeit" value={format(handoverData.handoverAt.toDate(), "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de })} />
            <DetailItem label="Kilometerstand" value={`${handoverData.odometerKm || 0} km`} />
        </CardContent>
      </Card>
      
       <Card className="shadow-sm">
        <CardHeader className="pb-4"><CardTitle className="text-base">Zustandsprüfung</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-3">
            <DetailItem label="Vorschäden bestätigt" value={handoverData.existingDamageConfirmed ? 'Ja' : 'Abweichungen protokolliert'} />
            {handoverData.notes && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm italic border-l-4 border-primary">
                    "{handoverData.notes}"
                </div>
            )}
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader className="pb-4"><CardTitle className="text-base">Pflichtfotos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photoEntries.map(([key, photo]) => (
                <div key={key} className="space-y-1">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">{photoLabels[key]}</p>
                    {photo.status === 'added' && photo.url ? (
                        <div className="aspect-video relative rounded-md overflow-hidden border shadow-sm group">
                             <Image src={photo.url} alt={photo.metadataText || key} layout="fill" objectFit="cover" />
                        </div>
                    ) : (
                        <div className="aspect-video flex flex-col items-center justify-center bg-muted rounded-md p-2 text-center border border-dashed">
                            <AlertCircle className="h-5 w-5 text-amber-500 mb-1" />
                            <p className="text-[9px] font-medium text-muted-foreground">{photo.placeholderNote || 'Nicht erfasst'}</p>
                        </div>
                    )}
                </div>
            ))}
        </CardContent>
    </Card>

      {handoverData.checklistEnabled && (
        <Card className="shadow-sm">
            <CardHeader className="pb-4"><CardTitle className="text-base">Checkliste</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
                {checklistIssues.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-amber-600 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Festgestellte Mängel:</p>
                        <ul className="space-y-1">
                            {checklistIssues.map(item => (
                                <li key={item.key} className="text-xs p-2 bg-muted rounded-md flex justify-between">
                                    <span className="font-bold">{item.label}:</span>
                                    <span className={item.state === 'defect' ? 'text-destructive font-black' : 'text-amber-600 font-black'}>
                                        {item.state === 'defect' ? 'DEFEKT' : 'FEHLT'}
                                        {item.note && <span className="text-muted-foreground font-normal ml-1">({item.note})</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-green-600 py-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <p className="font-bold text-sm">Alle Ausstattungspunkte sind in Ordnung.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-4"><CardTitle className="text-base">Zusätzliche Fotos (optional)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <AdditionalPhotoManager 
                onFilesAdded={handleAddPhotos}
                onTakePhoto={() => setIsCameraOpen(true)}
                disabled={isProcessingPhotos || isSaving} 
            />
            {isProcessingPhotos && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /><span>Verarbeite Bilder...</span></div>}
            
            {handoverData.additionalPhotos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    {handoverData.additionalPhotos.map((photo, index) => (
                        <div key={index} className="relative group">
                            <div className="aspect-video relative rounded-md overflow-hidden border shadow-sm">
                                <Image src={photo.url} alt={photo.metadataText} layout="fill" objectFit="cover" />
                            </div>
                            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg opacity-0 group-hover:opacity-100" onClick={() => removeAdditionalPhoto(index)} disabled={isSaving}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
      </Card>


      <Button onClick={handleComplete} disabled={isSaving || isProcessingPhotos} className="w-full h-16 text-xl rounded-2xl shadow-xl bg-primary hover:bg-primary/90">
        {(isSaving || isProcessingPhotos) ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : null}
        {isSaving ? 'Speichere Protokoll...' : isProcessingPhotos ? 'Verarbeite Bilder...' : 'Übergabe jetzt abschließen'}
      </Button>
    </div>
    <AdditionalPhotoCamera
      isOpen={isCameraOpen}
      onOpenChange={setIsCameraOpen}
      onPhotoCaptured={handlePhotoCaptured}
    />
    </>
  );
}
