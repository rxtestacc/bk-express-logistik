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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Loader2, UploadCloud, X, File as FileIcon } from 'lucide-react';
import { extractVehicleData } from '@/ai/flows/extract-vehicle-data-flow';
import type { VehicleFormData } from './vehicle-form-sheet';
import { Timestamp } from 'firebase/firestore';

interface VehicleUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDataExtracted: (data: Partial<VehicleFormData>) => void;
}

interface UploadedFile {
  preview: string;
  isImage: boolean;
  name: string;
}

export function VehicleUploadDialog({
  isOpen,
  onOpenChange,
  onDataExtracted,
}: VehicleUploadDialogProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFilesChange = (fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: UploadedFile[] = [];
    const filePromises = Array.from(fileList).map(file => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newFiles.push({
            preview: reader.result as string,
            isImage: file.type.startsWith('image/'),
            name: file.name
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then(() => {
      setFiles(prev => [...prev, ...newFiles]);
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFilesChange(event.dataTransfer.files);
  };
  
  const clearState = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };


  const handleExtract = async () => {
    if (files.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Keine Dateien ausgewählt',
        description: 'Bitte laden Sie mindestens ein Dokument hoch.',
      });
      return;
    }

    setIsExtracting(true);
    try {
      const dataUris = files.map(f => f.preview);
      const extractedData = await extractVehicleData({ photoDataUris: dataUris });

      const transformDate = (dateStr: string | undefined | null) => {
          return dateStr ? Timestamp.fromDate(new Date(dateStr)) : undefined;
      }

      const transformedData: Partial<VehicleFormData> = {
        ...extractedData,
        first_registration: transformDate(extractedData.first_registration),
        purchase_date: transformDate(extractedData.purchase_date),
        leasing_start: transformDate(extractedData.leasing_start),
        leasing_end: transformDate(extractedData.leasing_end),
        tuv_due: transformDate(extractedData.tuv_due),
        year: extractedData.year ? Number(extractedData.year) : undefined,
        power_kw: extractedData.power_kw ? Number(extractedData.power_kw) : undefined,
        purchase_price: extractedData.purchase_price ? Number(extractedData.purchase_price) : undefined,
        leasing_rate_eur: extractedData.leasing_rate_eur ? Number(extractedData.leasing_rate_eur) : undefined,
        leasing_annual_mileage: extractedData.leasing_annual_mileage ? Number(extractedData.leasing_annual_mileage) : undefined,
      };

      onDataExtracted(transformedData);
      toast({
        title: 'Daten erfolgreich extrahiert',
        description: 'Bitte überprüfen Sie die eingetragenen Daten.',
      });
      handleClose();
    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler bei der Extraktion',
        description:
          'Die Daten konnten nicht aus den Dokumenten extrahiert werden. Versuchen Sie es erneut oder geben Sie die Daten manuell ein.',
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
      <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => {
          if (isExtracting) {
            e.preventDefault();
          }
      }}>
        <DialogHeader>
          <DialogTitle>Dokumente hochladen</DialogTitle>
          <DialogDescription>
            Laden Sie Fotos von Fahrzeugschein, Kaufvertrag etc. hoch. Die KI wird versuchen, alle relevanten Daten automatisch auszulesen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4" onDragOver={handleDragOver} onDrop={handleDrop}>
            <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-accent"
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Dateien hochladen</span> oder hierher ziehen
                </p>
                </div>
                <Input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFilesChange(e.target.files)}
                    ref={fileInputRef}
                    multiple
                    disabled={isExtracting}
                />
            </label>

            {files.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-4">
                    {files.map((file, index) => (
                        <div key={index} className="relative group">
                            {file.isImage ? (
                                <Image src={file.preview} alt={`Vorschau ${index + 1}`} width={100} height={100} className="object-cover w-full h-full rounded-md aspect-square" />
                            ) : (
                                <div className="flex flex-col items-center justify-center w-full h-full rounded-md aspect-square bg-muted border p-2">
                                    <FileIcon className="w-8 h-8 text-muted-foreground" />
                                    <span className="text-xs text-center text-muted-foreground mt-2 truncate">{file.name}</span>
                                </div>
                            )}
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeFile(index)}
                                disabled={isExtracting}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isExtracting}>
            Abbrechen
          </Button>
          <Button onClick={handleExtract} disabled={files.length === 0 || isExtracting}>
            {isExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExtracting ? 'Extrahiere...' : 'Daten extrahieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
