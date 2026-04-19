'use client';

import { useState } from 'react';
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
import { VoiceTaskDialog } from '@/components/tasks/voice-task-dialog';

export default function WartungPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChoiceDialogOpen, setIsChoiceDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VehicleEvent | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<VehicleEvent> | undefined>(undefined);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');

  const maintenanceEventTypes = ['inspection', 'repair', 'tuv', 'au', 'uvv', 'tire_change', 'service'];

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
          <h1 className="text-2xl font-semibold md:text-3xl">Wartung & Service</h1>
          <div className='flex gap-2'>
            <Button variant="outline" onClick={() => setIsVoiceDialogOpen(true)} className="border-primary/40 hover:border-primary text-primary bg-primary/5">
              <Mic className="mr-2 h-4 w-4" />
              Per Sprache
            </Button>
            <Button onClick={handleAddEventClick} className="flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" />
              Neuer Eintrag
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
            eventTypes={maintenanceEventTypes} 
            onEditEvent={handleEditEvent} 
            searchTerm={searchTerm}
            vehicleId={selectedVehicle}
        />
      </div>

      <Dialog open={isChoiceDialogOpen} onOpenChange={setIsChoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wie möchten Sie den Eintrag anlegen?</DialogTitle>
            <DialogDescription>
              Sie können die Daten manuell eingeben oder von einem Dokument (z.B. Rechnung) automatisch auslesen lassen.
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
        eventData={editingEvent || prefilledData}
        allowedEventTypes={maintenanceEventTypes}
        title={editingEvent ? "Eintrag bearbeiten" : "Neuer Wartungseintrag"}
        description={editingEvent ? "Aktualisieren Sie die Details des Eintrags." : "Erfassen Sie eine neue Wartung oder einen Service-Eintrag."}
      />

      <VoiceTaskDialog 
        isOpen={isVoiceDialogOpen}
        onOpenChange={setIsVoiceDialogOpen}
        mode="maintenance"
      />
    </>
  );
}
