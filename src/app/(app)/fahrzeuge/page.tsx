
'use client';

import { useState } from 'react';
import { PlusCircle, FileUp, Keyboard, Search, Upload, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VehicleList from '@/components/vehicles/vehicle-list';
import { VehicleFormSheet } from '@/components/vehicles/vehicle-form-sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { VehicleUploadDialog } from '@/components/vehicles/vehicle-upload-dialog';
import type { VehicleFormData } from '@/components/vehicles/vehicle-form-sheet';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { VehicleStatusFilter } from '@/components/vehicles/vehicle-status-filter';
import { VehicleCarrierFilter } from '@/components/vehicles/vehicle-carrier-filter';
import { VehicleImportDialog } from '@/components/vehicles/vehicle-import-dialog';
import Link from 'next/link';

export default function FahrzeugePage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChoiceDialogOpen, setIsChoiceDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [prefilledData, setPrefilledData] = useState<Partial<VehicleFormData> | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');

  // Daten effizient aus dem globalen Provider beziehen
  const { vehicles, drivers, handovers, isLoading } = useDashboardData();

  const handleAddVehicleClick = () => {
    setPrefilledData(undefined);
    setIsChoiceDialogOpen(true);
  };

  const handleManualEntry = () => {
    setPrefilledData(undefined);
    setIsChoiceDialogOpen(false);
    setIsSheetOpen(true);
  };
  
  const handlePhotoUpload = () => {
    setIsChoiceDialogOpen(false);
    setIsUploadDialogOpen(true);
  };

  const handleDataExtracted = (data: Partial<VehicleFormData>) => {
    setPrefilledData(data);
    setIsUploadDialogOpen(false);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
    if (!isOpen) {
      setPrefilledData(undefined);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold md:text-3xl">Fahrzeuge</h1>
           <div className="flex flex-col sm:flex-row flex-1 max-w-2xl gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Fahrzeuge durchsuchen..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/fahrzeuge/master-liste">
                <Button variant="outline" className="flex-shrink-0 border-primary/40 text-primary hover:bg-primary/5">
                  <LayoutList className="mr-2 h-4 w-4" />
                  Master Liste
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="flex-shrink-0">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button onClick={handleAddVehicleClick} className="flex-shrink-0 w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Fahrzeug hinzufügen
              </Button>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <VehicleStatusFilter 
            vehicles={vehicles}
            selectedStatus={statusFilter}
            onStatusChange={setStatusFilter}
          />
          <VehicleCarrierFilter
            vehicles={vehicles}
            selectedCarrier={carrierFilter}
            onCarrierChange={setCarrierFilter}
          />
        </div>
        
        <VehicleList 
          vehicles={vehicles}
          drivers={drivers}
          handovers={handovers}
          isLoading={isLoading}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          carrierFilter={carrierFilter}
        />
      </div>

      <Dialog open={isChoiceDialogOpen} onOpenChange={setIsChoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wie möchten Sie das Fahrzeug anlegen?</DialogTitle>
            <DialogDescription>
              Sie können die Daten manuell eingeben oder von einem Foto des Fahrzeugscheins automatisch auslesen lassen.
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VehicleUploadDialog 
        isOpen={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onDataExtracted={handleDataExtracted}
      />

      <VehicleImportDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
      
      <VehicleFormSheet 
        isOpen={isSheetOpen} 
        onOpenChange={handleSheetOpenChange}
        vehicleData={prefilledData}
      />
    </>
  );
}
