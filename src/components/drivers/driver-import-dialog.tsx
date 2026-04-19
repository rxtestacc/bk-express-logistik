
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
import { UploadCloud, Loader2, FileIcon, Table as TableIcon } from 'lucide-react';
import { Input } from '../ui/input';
import { useFirestore } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { writeBatch, collection, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { extractDriversFromDocument } from '@/ai/flows/extract-drivers-from-document-flow';
import type { Driver } from './driver-form-sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';

type ViewState = 'upload' | 'processing' | 'preview' | 'saving';

interface DriverImportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function DriverImportDialog({ isOpen, onOpenChange }: DriverImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [extractedDrivers, setExtractedDrivers] = useState<any[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { session } = useSession();
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleProcessFile = async () => {
    if (!file) return;
    setViewState('processing');
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
          try {
            const documentDataUri = reader.result as string;
            const response = await extractDriversFromDocument({ documentDataUri });

            if (response.error) {
              toast({ variant: 'destructive', title: 'Fehler', description: response.error });
              setViewState('upload');
              return;
            }

            if (!response.data || response.data.drivers.length === 0) {
              toast({ variant: 'destructive', title: 'Keine Daten', description: 'Keine Fahrer gefunden.' });
              setViewState('upload');
              return;
            }
            
            setExtractedDrivers(response.data.drivers);
            setViewState('preview');
          } catch(e) {
             toast({ variant: 'destructive', title: 'Analysefehler' });
             setViewState('upload');
          }
      };
      reader.readAsDataURL(file);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Datei-Fehler' });
       setViewState('upload');
    }
  };

  const handleSaveImport = async () => {
      if (!firestore || !session || extractedDrivers.length === 0) return;
      setViewState('saving');
      try {
          const batch = writeBatch(firestore);
          const driversCollection = collection(firestore, 'drivers');

          for (const d of extractedDrivers) {
              const driverRef = doc(driversCollection);
              
              const parseDate = (val: any) => {
                  if (!val) return null;
                  const date = new Date(val);
                  return isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
              };

              const finalData = {
                  ...d,
                  first_name: d.first_name || 'Unbekannt',
                  last_name: d.last_name || 'Unbekannt',
                  phone: d.phone || '00000',
                  license_classes: d.license_classes ? d.license_classes.split(',').map((s: any) => s.trim()) : [],
                  birth_date: parseDate(d.birth_date),
                  address: {
                      street: d.address_street || '',
                      zip: d.address_zip || '',
                      city: d.address_city || '',
                  },
                  created_at: serverTimestamp(),
                  updated_at: serverTimestamp(),
              };
              batch.set(driverRef, finalData);
          }
          await batch.commit();
          toast({ title: 'Import erfolgreich', description: `${extractedDrivers.length} Fahrer importiert.` });
          handleClose();
      } catch (error) {
          console.error("Save import error:", error);
          toast({ variant: 'destructive', title: 'Speicherfehler' });
          setViewState('preview');
      }
  }

  const handleClose = () => {
      setFile(null);
      setExtractedDrivers([]);
      setViewState('upload');
      onOpenChange(false);
  };
  
  const isProcessing = viewState === 'processing' || viewState === 'saving';

  return (
    <Dialog open={isOpen} onOpenChange={isProcessing ? () => {} : handleClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader><DialogTitle>Fahrer importieren</DialogTitle></DialogHeader>
        <div className="py-4">
            {viewState === 'upload' && (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-accent transition-colors">
                  <UploadCloud className="w-12 h-12 mb-4 text-muted-foreground" />
                  <p className="text-lg font-semibold">{file ? file.name : 'Tabelle wählen'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Unterstützt .xlsx, .xls, .csv, .pdf</p>
                  <Input 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileChange} 
                    accept=".xlsx, .xls, .csv, .pdf, image/*"
                  />
              </label>
            )}
            {isProcessing && (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="font-medium">Verarbeitung läuft...</p>
                </div>
            )}
            {viewState === 'preview' && (
              <ScrollArea className="h-96 w-full border rounded-md">
                <Table>
                  <TableHeader className="bg-muted sticky top-0"><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Telefon</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {extractedDrivers.map((d, i) => (
                      <TableRow key={i}><TableCell>{d.first_name} {d.last_name}</TableCell><TableCell>{d.email || '-'}</TableCell><TableCell>{d.phone || '-'}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={handleClose} disabled={isProcessing}>Abbrechen</Button>
            {viewState === 'upload' && <Button onClick={handleProcessFile} disabled={!file || isProcessing}>Datei analysieren</Button>}
            {viewState === 'preview' && <Button onClick={handleSaveImport} disabled={isProcessing}>Import starten</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
