'use client';

import { useState, useRef } from 'react';
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
import Image from 'next/image';
import { Loader2, UploadCloud, X } from 'lucide-react';
import { extractDriverData } from '@/ai/flows/extract-driver-data-flow';
import type { Driver } from './driver-form-sheet';
import { Timestamp } from 'firebase/firestore';
import { Input } from '../ui/input';

interface DriverUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDataExtracted: (data: Partial<Driver>) => void;
}

const ImageUploader = ({ title, onFileChange, preview, onClear, disabled }: { title: string; onFileChange: (file: File) => void; preview: string | null; onClear: () => void, disabled: boolean; }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileChange(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
        onFileChange(file);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-center">{title}</h3>
      {preview ? (
        <div className="relative">
          <Image src={preview} alt={`${title} Vorschau`} width={200} height={125} className="rounded-md object-contain w-full" />
          <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={onClear} disabled={disabled}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          <label htmlFor={`upload-${title}`} className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-accent">
            <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center">
              <span className="font-semibold">Hochladen</span> oder hierher ziehen
            </p>
            <Input id={`upload-${title}`} type="file" className="hidden" ref={inputRef} onChange={handleFileChange} />
          </label>
        </div>
      )}
    </div>
  );
};


export function DriverUploadDialog({
  isOpen,
  onOpenChange,
  onDataExtracted,
}: DriverUploadDialogProps) {
  const [frontImage, setFrontImage] = useState<{ file: File | null, preview: string | null }>({ file: null, preview: null });
  const [backImage, setBackImage] = useState<{ file: File | null, preview: string | null }>({ file: null, preview: null });
  const [isExtracting, setIsExtracting] = useState(false);
  const { toast } = useToast();
  
  const handleFileChange = (setter: typeof setFrontImage) => (file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          setter({ file, preview: reader.result as string });
      };
      reader.readAsDataURL(file);
  };
  
  const clearState = () => {
      setFrontImage({ file: null, preview: null });
      setBackImage({ file: null, preview: null });
  }

  const handleExtract = async () => {
    if (!frontImage.preview) {
      toast({ variant: 'destructive', title: 'Vorderseite fehlt', description: 'Bitte laden Sie ein Bild der Vorderseite des Führerscheins hoch.' });
      return;
    }

    setIsExtracting(true);
    try {
      const extractedData = await extractDriverData({
        frontImageUri: frontImage.preview,
        backImageUri: backImage.preview,
      });

      const transformDate = (dateStr: string | undefined | null) => {
          return dateStr ? Timestamp.fromDate(new Date(dateStr)) : undefined;
      }

      const transformedData: Partial<Driver> = {
        ...extractedData,
        birth_date: transformDate(extractedData.birth_date),
        license_issue_date: transformDate(extractedData.license_issue_date),
        license_expiry_date: transformDate(extractedData.license_expiry_date),
      };

      onDataExtracted(transformedData);
      toast({
        title: 'Daten erfolgreich extrahiert',
        description: 'Bitte überprüfen und vervollständigen Sie die Daten.',
      });
      handleClose();
    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler bei der Extraktion',
        description:
          'Die Daten konnten nicht extrahiert werden. Versuchen Sie es erneut oder geben Sie die Daten manuell ein.',
      });
    } finally {
      setIsExtracting(false);
    }
  };
  
  const handleClose = () => {
    clearState();
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => {
          if (isExtracting) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle>Führerschein hochladen</DialogTitle>
          <DialogDescription>
            Laden Sie Fotos der Vorder- und Rückseite des Führerscheins hoch.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <ImageUploader 
                title="Vorderseite"
                preview={frontImage.preview}
                onFileChange={handleFileChange(setFrontImage)}
                onClear={() => setFrontImage({ file: null, preview: null })}
                disabled={isExtracting}
            />
             <ImageUploader 
                title="Rückseite (optional)"
                preview={backImage.preview}
                onFileChange={handleFileChange(setBackImage)}
                onClear={() => setBackImage({ file: null, preview: null })}
                disabled={isExtracting}
            />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isExtracting}>
            Abbrechen
          </Button>
          <Button onClick={handleExtract} disabled={!frontImage.file || isExtracting}>
            {isExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExtracting ? 'Extrahiere...' : 'Daten extrahieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
