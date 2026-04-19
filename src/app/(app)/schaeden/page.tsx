'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, FileUp, Keyboard, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventList } from '@/components/events/event-list';
import { EventFormSheet, VehicleEvent } from '@/components/events/event-form-sheet';
import { EventListToolbar } from '@/components/events/event-list-toolbar';
import { EventUploadDialog } from '@/components/events/event-upload-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useSearchParams } from 'next/navigation';
import { VoiceTaskDialog } from '@/components/tasks/voice-task-dialog';

export default function SchaedenPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChoiceDialogOpen, setIsChoiceDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VehicleEvent | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<VehicleEvent> | undefined>(undefined);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  
  const searchParams = useSearchParams();
  const vehicleIdFromScan = searchParams.get('vehicleId');

  const damageEventTypes = ['damage', 'verkehrsunfall', 'other'];
  
  useEffect(() => {
    if (vehicleIdFromScan) {
      setPrefilledData({ vehicleId: vehicleIdFromScan, type: 'damage' });
      setIsSheetOpen(true);
    }
  }, [vehicleIdFromScan]);

  const handleAddEventClick = () => {
    setEditingEvent(undefined);
    setPrefilledData(undefined);
    setIsChoiceDialogOpen(true);
  };
  
  const handleEditEvent = (event: VehicleEvent) => {
    setPrefilledData(undefined);
    setEditingEvent(event);
    setIsSheetOpen(true);
  };
  
  const handleManualEntry = () => {
    setPrefilledData(undefined);
    setEditingEvent(undefined);
    setIsChoiceDialogOpen(false);
    setIsSheetOpen(true);
  };
  
  const handlePhotoUpload = () => {
    setIsChoiceDialogOpen(false);
    setIsUploadDialogOpen(true);
  };
  
  const handleDataExtracted = (data: Partial<VehicleEvent>) => {
    setPrefilledData(data);
    setEditingEvent(undefined);
    setIsUploadDialogOpen(false);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
    if (!isOpen) {
      setEditingEvent(undefined);
      setPrefilledData(undefined);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold md:text-3xl">Schäden & Vorfälle</h1>
          <div className='flex gap-2'>
            <Button variant="outline" onClick={() => setIsVoiceDialogOpen(true)} className="border-primary/40 hover:border-primary text-primary bg-primary/5">
              <Mic className="mr-2 h-4 w-4" />
              Spracheingabe
            </Button>
            <Button onClick={handleAddEventClick} className="flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" />
              Neuer Vorfall
            </Button>
          </div>
        </div>
         <EventListToolbar 
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedVehicle={selectedVehicle}
            setSelectedVehicle={setSelectedVehicle}
        />
        <EventList 
            eventTypes={damageEventTypes} 
            onEditEvent={handleEditEvent} 
            searchTerm={searchTerm}
            vehicleId={selectedVehicle}
        />
      </div>
      
      <Dialog open={isChoiceDialogOpen} onOpenChange={setIsChoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wie möchten Sie den Vorfall erfassen?</DialogTitle>
            <DialogDescription>
              Sie können die Daten manuell eingeben oder von einem Dokument (z.B. Rechnung, Gutachten) automatisch auslesen lassen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleManualEntry}>
                  <Keyboard className="mr-2 h-4 w-4" />
                  Manuell eingeben
              </Button>
              <Button onClick={handlePhotoUpload}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Per Foto-Upload
              </Button>
              <DialogClose className="hidden" />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <EventUploadDialog 
        isOpen={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onDataExtracted={handleDataExtracted}
      />

      <EventFormSheet
        isOpen={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        eventData={editingEvent}
        prefilledData={prefilledData}
        allowedEventTypes={damageEventTypes}
        title={editingEvent ? "Vorfall bearbeiten" : (prefilledData?.title || "Neuer Vorfall")}
        description={editingEvent ? "Bearbeiten Sie die Details des Vorfalls." : (prefilledData ? "Überprüfen und vervollständigen Sie die ausgelesenen Daten." : "Erfassen Sie einen neuen Schaden oder sonstigen Vorfall.")}
      />

      <VoiceTaskDialog 
        isOpen={isVoiceDialogOpen}
        onOpenChange={setIsVoiceDialogOpen}
        mode="damage"
      />
    </>
  );
}
