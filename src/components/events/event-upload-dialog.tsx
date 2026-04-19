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
import { Loader2, UploadCloud, X, File as FileIcon } from 'lucide-react';
import { extractEventData } from '@/ai/flows/extract-event-data-flow';
import type { VehicleEvent } from './event-form-sheet';
import { Timestamp } from 'firebase/firestore';
import { Input } from '../ui/input';

interface EventUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDataExtracted: (data: Partial<VehicleEvent>) => void;
}

interface UploadedFile {
  preview: string;
  isImage: boolean;
  name: string;
}

export function EventUploadDialog({
  isOpen,
  onOpenChange,
  onDataExtracted,
}: EventUploadDialogProps) {
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

  const clearState = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      const response = await extractEventData({ photoDataUris: dataUris });

      if (response.error) {
        toast({
          variant: 'destructive',
          title: 'KI-Analyse fehlgeschlagen',
          description: response.error,
        });
        setIsExtracting(false);
        return;
      }

      const extractedData = response.data!;
      const transformedData: Partial<VehicleEvent> = {
        ...extractedData,
        due_date: extractedData.due_date ? Timestamp.fromDate(new Date(extractedData.due_date)) : undefined,
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
          'Die Daten konnten nicht aus dem Dokument extrahiert werden. Versuchen Sie es erneut oder geben Sie die Daten manuell ein.',
      });
    } finally {
      setIsExtracting(false);
    }
  };
  
  const handleClose = () => {
    clearState();
    onOpenChange(false);
  };
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFilesChange(event.dataTransfer.files);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => { if (isExtracting) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
          <DialogDescription>
            Laden Sie ein Foto Ihrer Rechnung oder Ihres Serviceberichts hoch. Die KI wird versuchen, die Daten automatisch auszulesen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4" onDragOver={handleDragOver} onDrop={handleDrop}>
            <div>
                <label
                    htmlFor="event-file-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-accent"
                >
                    <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Dateien hochladen</span> oder hierher ziehen
                    </p>
                    <Input
                        id="event-file-upload"
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFilesChange(e.target.files)}
                        multiple
                        ref={fileInputRef}
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
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
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
