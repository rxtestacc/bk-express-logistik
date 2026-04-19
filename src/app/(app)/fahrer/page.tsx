'use client';

import { useState } from 'react';
import { PlusCircle, FileUp, Keyboard, Search, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DriverList } from '@/components/drivers/driver-list';
import { DriverFormSheet, Driver } from '@/components/drivers/driver-form-sheet';
import { DriverUploadDialog } from '@/components/drivers/driver-upload-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { DriverImportDialog } from '@/components/drivers/driver-import-dialog';
import { useToast } from '@/hooks/use-toast';


export default function FahrerPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChoiceDialogOpen, setIsChoiceDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<Driver> | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { toast } = useToast();
  const { drivers, isLoading } = useDashboardData();

  const handleAddDriverClick = () => {
    setEditingDriver(undefined);
    setPrefilledData(undefined);
    setIsChoiceDialogOpen(true);
  };
  
  const handleEditDriver = (driver: Driver) => {
    setPrefilledData(undefined);
    setEditingDriver(driver);
    setIsSheetOpen(true);
  };

  const handleManualEntry = () => {
    setPrefilledData(undefined);
    setEditingDriver(undefined);
    setIsChoiceDialogOpen(false);
    setIsSheetOpen(true);
  };
  
  const handlePhotoUpload = () => {
    setIsChoiceDialogOpen(false);
    setIsUploadDialogOpen(true);
  };

  const handleDataExtracted = (data: Partial<Driver>) => {
    setPrefilledData(data);
    setEditingDriver(undefined);
    setIsUploadDialogOpen(false);
    setIsSheetOpen(true);
  };


  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
    if (!isOpen) {
      setEditingDriver(undefined);
      setPrefilledData(undefined);
    }
  };

  const handleExport = () => {
    if (!drivers) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Export',
        description: 'Fahrerdaten konnten nicht geladen werden oder sind leer.',
      });
      return;
    }

    const headers = [
      'first_name', 'last_name', 'birth_date', 'email', 'phone', 'carrier',
      'address_street', 'address_zip', 'address_city', 'license_number', 'license_issue_date',
      'license_expiry_date', 'license_issue_country', 'license_classes',
      'nationality', 'birth_place', 'employment_start_date', 'employee_number', 'zsb', 'health_insurance'
    ];

    const toISOStringOrEmpty = (timestamp: any) => {
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString().split('T')[0];
      }
      return '';
    };

    const csvContent = [
      headers.join(','),
      ...drivers.map(d => [
        d.first_name,
        d.last_name,
        toISOStringOrEmpty(d.birth_date),
        d.email,
        d.phone,
        d.carrier,
        d.address?.street,
        d.address?.zip,
        d.address?.city,
        d.license_number,
        toISOStringOrEmpty(d.license_issue_date),
        toISOStringOrEmpty(d.license_expiry_date),
        d.license_issue_country,
        d.license_classes?.join(';'),
        d.nationality,
        d.birth_place,
        toISOStringOrEmpty(d.employment_start_date),
        d.employee_number,
        d.zsb,
        d.health_insurance
      ].map(field => `"${(field ?? '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `fahrer-export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold md:text-3xl">Fahrer</h1>
           <div className="flex flex-col sm:flex-row flex-1 max-w-2xl gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Fahrer durchsuchen..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
               <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="flex-1 sm:flex-none">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={!drivers || drivers.length === 0} className="flex-1 sm:flex-none">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button onClick={handleAddDriverClick} className="flex-1 sm:flex-none">
                <PlusCircle className="mr-2 h-4 w-4" />
                Neu
              </Button>
            </div>
          </div>
        </div>
        <DriverList onEditDriver={handleEditDriver} searchTerm={searchTerm} drivers={drivers} isLoading={isLoading} />
      </div>
      
      <Dialog open={isChoiceDialogOpen} onOpenChange={setIsChoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wie möchten Sie den Fahrer anlegen?</DialogTitle>
            <DialogDescription>
              Sie können die Daten manuell eingeben oder von einem Foto des Führerscheins automatisch auslesen lassen.
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
               <DialogClose />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <DriverUploadDialog 
        isOpen={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onDataExtracted={handleDataExtracted}
      />

      <DriverImportDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />

      <DriverFormSheet
        isOpen={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        driverData={editingDriver || prefilledData}
        isPrefilled={!!prefilledData}
      />
    </>
  );
}
