'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, FileIcon, Table as TableIcon, CheckCircle2 } from 'lucide-react';
import { Input } from '../ui/input';
import { useFirestore } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { writeBatch, collection, doc, serverTimestamp, Timestamp, getDocs } from 'firebase/firestore';
import { extractVehiclesFromDocument } from '@/ai/flows/extract-vehicles-from-document-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

type ViewState = 'upload' | 'processing' | 'preview' | 'saving';

interface VehicleImportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function VehicleImportDialog({ isOpen, onOpenChange }: VehicleImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [extractedVehicles, setExtractedVehicles] = useState<any[]>([]);
  const [existingVins, setExistingVins] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const firestore = useFirestore();
  const { session } = useSession();
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
    }
  };

  const handleProcessFile = async () => {
    if (!file || !firestore) return;
    setViewState('processing');
    
    try {
      // 1. Fetch existing VINs to check for duplicates
      const snapshot = await getDocs(collection(firestore, 'vehicles'));
      const vins = new Set(snapshot.docs.map(doc => (doc.data() as any).vin?.toLowerCase()).filter(Boolean));
      setExistingVins(vins);

      // 2. AI Analysis via FileReader
      const reader = new FileReader();
      reader.onloadend = async () => {
          try {
            const documentDataUri = reader.result as string;
            const response = await extractVehiclesFromDocument({ documentDataUri });

            if (response.error) {
              toast({ variant: 'destructive', title: 'Fehler bei der Analyse', description: response.error });
              setViewState('upload');
              return;
            }

            if (!response.data || response.data.vehicles.length === 0) {
              toast({
                  variant: 'destructive',
                  title: 'Keine Fahrzeuge gefunden',
                  description: 'Die KI konnte keine Fahrzeugdaten extrahieren.'
              });
              setViewState('upload');
              return;
            }
            
            setExtractedVehicles(response.data.vehicles);
            setViewState('preview');
          } catch(e: any) {
             console.error('[AI ANALYSIS ERROR] Vehicle Import:', e);
             toast({ variant: 'destructive', title: 'Fehler', description: 'Server-Kommunikation fehlgeschlagen.' });
             setViewState('upload');
          }
      };
      reader.readAsDataURL(file);
    } catch (error) {
       console.error("File processing error:", error);
       toast({ variant: 'destructive', title: 'Fehler', description: 'Die Datei konnte nicht gelesen werden.' });
       setViewState('upload');
    }
  };

  const handleSaveImport = async () => {
      if (!firestore || !session || extractedVehicles.length === 0) return;

      setViewState('saving');
      try {
          const batch = writeBatch(firestore);
          const vehiclesCollection = collection(firestore, 'vehicles');
          const remindersCollection = collection(firestore, 'reminders');

          let importedCount = 0;

          for (const vData of extractedVehicles) {
              if (vData.vin && existingVins.has(vData.vin.toLowerCase())) continue;

              const vehicleRef = doc(vehiclesCollection);
              const vehicleId = vehicleRef.id;
              const parseDate = (d?: string) => d ? Timestamp.fromDate(new Date(d)) : null;

              const finalData = {
                  ...vData,
                  license_plate: vData.license_plate?.toUpperCase() || 'UNBEKANNT',
                  status: 'aktiv',
                  mileage_km: vData.mileage_km || 0,
                  first_registration: parseDate(vData.first_registration),
                  tuv_due: parseDate(vData.tuv_due),
                  created_at: serverTimestamp(),
                  updated_at: serverTimestamp(),
                  mileage_updated_at: serverTimestamp(),
                  open_tasks_count: 0,
                  total_costs_eur: 0,
                  next_due_events: {},
              };
              
              batch.set(vehicleRef, finalData);
              
              if (finalData.tuv_due) {
                  batch.set(doc(remindersCollection), {
                      vehicleId,
                      kind: 'tuv',
                      due_date: finalData.tuv_due,
                      status: 'open',
                      sourceEventId: vehicleId
                  });
              }
              importedCount++;
          }

          if (importedCount > 0) {
              await batch.commit();
              toast({ title: 'Import erfolgreich', description: `${importedCount} neue Fahrzeuge hinzugefügt.` });
          } else {
              toast({ title: 'Keine neuen Fahrzeuge', description: 'Alle Fahrzeuge bereits vorhanden.' });
          }
          handleClose();
      } catch (error) {
          console.error("Error saving vehicles:", error);
          toast({ variant: 'destructive', title: 'Fehler beim Speichern' });
          setViewState('preview');
      }
  }

  const handleClose = () => {
      setFile(null);
      setExtractedVehicles([]);
      setViewState('upload');
      onOpenChange(false);
  };
  
  const isProcessing = viewState === 'processing' || viewState === 'saving';

  return (
    <Dialog open={isOpen} onOpenChange={isProcessing ? () => {} : handleClose}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Fahrzeuge importieren</DialogTitle>
          <DialogDescription>
            Laden Sie eine Excel- oder CSV-Datei hoch. VIN-Dubletten werden automatisch erkannt.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            {viewState === 'upload' && (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-accent transition-colors">
                  <UploadCloud className="w-12 h-12 mb-4 text-muted-foreground" />
                  <p className="text-lg font-semibold">{file ? file.name : 'Tabelle wählen'}</p>
                  <Input type="file" accept=".csv, .xlsx, .xls, .pdf" className="hidden" onChange={handleFileChange} />
              </label>
            )}
            {isProcessing && (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">KI analysiert Daten...</p>
                </div>
            )}
            {viewState === 'preview' && (
              <ScrollArea className="h-[50vh] w-full border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Kennzeichen</TableHead>
                      <TableHead>Fahrzeug</TableHead>
                      <TableHead>VIN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedVehicles.map((v, index) => {
                      const isDuplicate = v.vin && existingVins.has(v.vin.toLowerCase());
                      return (
                        <TableRow key={index} className={cn(isDuplicate && "opacity-50 bg-muted/30")}>
                          <TableCell>
                            {isDuplicate ? <Badge variant="outline" className="text-amber-600">Dublette</Badge> : <Badge variant="outline" className="text-green-600">Neu</Badge>}
                          </TableCell>
                          <TableCell className="font-bold">{v.license_plate || '-'}</TableCell>
                          <TableCell>{v.make} {v.model}</TableCell>
                          <TableCell className="font-mono text-xs">{v.vin || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={handleClose} disabled={isProcessing}>Abbrechen</Button>
            {viewState === 'upload' && <Button onClick={handleProcessFile} disabled={!file || isProcessing}>Analysieren</Button>}
            {viewState === 'preview' && <Button onClick={handleSaveImport} disabled={isProcessing}><CheckCircle2 className="mr-2 h-4 w-4" /> Import starten</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
