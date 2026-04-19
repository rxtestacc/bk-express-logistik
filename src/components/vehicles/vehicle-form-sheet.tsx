
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { isPast, startOfDay } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { collection, serverTimestamp, doc, writeBatch, query, where, getDocs, Timestamp, getDoc } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import DateInput from "@/components/ui/DateInput";
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { generateAuditLog } from '@/lib/audit-log';

export const vehicleSchema = z.object({
  id: z.string().optional(),
  
  // Stammdaten
  vin: z.string().min(1, 'VIN ist erforderlich.'),
  license_plate: z.string().min(1, 'Kennzeichen ist erforderlich.'),
  make: z.string().min(1, 'Hersteller ist erforderlich.'),
  model: z.string().min(1, 'Modell ist erforderlich.'),
  first_registration: z.instanceof(Timestamp, { message: 'Erstzulassung ist erforderlich.' }).nullable(),
  mileage_km: z.coerce.number().min(0, 'Laufleistung muss positiv sein.'),
  
  // Technische Details (optional)
  hsn: z.string().optional(),
  tsn: z.string().optional(),
  variant: z.string().optional(),
  year: z.coerce.number().optional().nullable(),
  engine: z.string().optional(),
  fuel_type: z.enum(['Benzin', 'Diesel', 'Elektro', 'Hybrid', 'LPG', 'CNG']).optional().nullable(),
  power_kw: z.coerce.number().optional().nullable(),
  tire_size: z.string().optional(),
  color: z.string().optional(),
  
  // Status & Zuordnung
  status: z.enum(['aktiv', 'in_werkstatt', 'inaktiv']).default('aktiv'),
  carrier: z.enum(['GLS', 'Hermes', 'Stadtbote']).optional().nullable(),
  fleet_type: z.enum(['Ja', 'Überlassung']).optional().nullable(),
  location: z.string().optional(),
  notes: z.string().optional(),

  // Vertragsdetails (optional)
  acquisition_type: z.enum(['cash', 'leasing', 'financing']).optional().nullable(),

  // Barkauf
  purchase_date: z.instanceof(Timestamp).optional().nullable(),
  purchase_price: z.coerce.number().optional().nullable(),

  // Leasing / Finanzierung
  leasing_start: z.instanceof(Timestamp).optional().nullable(),
  leasing_end: z.instanceof(Timestamp).optional().nullable(),
  leasing_rate_eur: z.coerce.number().optional().nullable(),
  first_installment_date: z.instanceof(Timestamp).optional().nullable(),
  last_installment_date: z.instanceof(Timestamp).optional().nullable(),
  leasing_annual_mileage: z.coerce.number().optional().nullable(),
  leasing_company: z.string().optional(),
  
  financing_start: z.instanceof(Timestamp).optional().nullable(),
  financing_end: z.instanceof(Timestamp).optional().nullable(),
  financing_rate_eur: z.coerce.number().optional().nullable(),
  financing_bank: z.string().optional(),

  // Termine
  warranty_end: z.instanceof(Timestamp).optional().nullable(),
  tuv_due: z.instanceof(Timestamp, { message: 'TÜV-Fälligkeit ist ein Pflichtfeld.' }).nullable(),
});


export type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleFormSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  vehicleData?: Partial<VehicleFormData>;
}

const defaultFormValues: VehicleFormData = {
    vin: '',
    license_plate: '',
    make: '',
    model: '',
    mileage_km: 0,
    first_registration: null,
    status: 'aktiv',
    hsn: '',
    tsn: '',
    variant: '',
    year: null,
    engine: '',
    fuel_type: null,
    power_kw: null,
    tire_size: '',
    color: '',
    carrier: null,
    fleet_type: 'Ja',
    location: '',
    notes: '',
    acquisition_type: null,
    purchase_date: null,
    purchase_price: null,
    leasing_start: null,
    leasing_end: null,
    leasing_rate_eur: null,
    first_installment_date: null,
    last_installment_date: null,
    leasing_annual_mileage: null,
    leasing_company: '',
    financing_start: null,
    financing_end: null,
    financing_rate_eur: null,
    financing_bank: '',
    warranty_end: null,
    tuv_due: null,
};

async function createOrUpdateReminder(
    batch: any,
    firestore: any,
    vehicleId: string,
    kind: 'leasing_end' | 'warranty_end' | 'financing_end' | 'tuv',
    dueDate: Timestamp | null | undefined
) {
    const remindersRef = collection(firestore, 'reminders');
    const q = query(remindersRef, where('vehicleId', '==', vehicleId), where('kind', '==', kind));
    const existingReminders = await getDocs(q);

    if (dueDate && !isPast(startOfDay(dueDate.toDate()))) {
        const reminderData = {
            vehicleId,
            kind,
            due_date: dueDate,
            status: 'open',
            sourceEventId: vehicleId
        };

        if (existingReminders.empty) {
            const newReminderRef = doc(remindersRef);
            batch.set(newReminderRef, reminderData);
        } else {
            const reminderDoc = existingReminders.docs[0];
            batch.update(reminderDoc.ref, reminderData);
        }
    } else {
        existingReminders.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
}

const formatLicensePlate = (plate: string): string => {
  if (!plate) return '';
  return plate.toUpperCase();
};


export function VehicleFormSheet({ isOpen, onOpenChange, vehicleData }: VehicleFormSheetProps) {
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  const isEditMode = !!vehicleData?.id;

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: defaultFormValues,
  });
  
  const acquisitionType = form.watch('acquisition_type');

  useEffect(() => {
    if (isOpen) {
        if (vehicleData) {
            const formData: Partial<VehicleFormData> = { ...vehicleData };
            // Ensure all date fields are Timestamps if they exist
            (Object.keys(formData) as Array<keyof VehicleFormData>).forEach(key => {
                if (key.includes('date') || key.includes('registration') || key.includes('due') || key.includes('end') || key.includes('start')) {
                    const value = formData[key];
                    if (value && !(value instanceof Timestamp)) {
                        // @ts-ignore
                        formData[key] = Timestamp.fromDate(new Date(value as any));
                    }
                }
            });
            form.reset({ ...defaultFormValues, ...formData });
        } else {
            form.reset(defaultFormValues);
        }
    }
  }, [vehicleData, isOpen, form]);

  const onSubmit = async (data: VehicleFormData) => {
    if (!firestore || !session) return;
    
    const formattedData = {
        ...data,
        license_plate: formatLicensePlate(data.license_plate),
    };
    
    const cleanedData = Object.fromEntries(
        Object.entries(formattedData).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    
    const { id, ...vehicleToSave } = cleanedData;
    const batch = writeBatch(firestore);
    const userName = session.name || 'unbekannt';

    try {
        const vehicleId = isEditMode && id ? id : doc(collection(firestore, 'vehicles')).id;
        const vehicleRef = doc(firestore, 'vehicles', vehicleId);

        if (isEditMode && id) {
            const originalDoc = await getDoc(vehicleRef);
            const originalData = originalDoc.data();
            
            batch.update(vehicleRef, { ...vehicleToSave, mileage_updated_at: serverTimestamp() });
            await generateAuditLog(firestore, 'vehicle', id, originalData, vehicleToSave, userName, 'update');
        } else {
            const vehicleWithMeta = { ...vehicleToSave, mileage_updated_at: serverTimestamp(), open_tasks_count: 0, total_costs_eur: 0, next_due_events: {} };
            batch.set(vehicleRef, vehicleWithMeta);
            await generateAuditLog(firestore, 'vehicle', vehicleId, {}, vehicleWithMeta, userName, 'create');
        }
        
        await createOrUpdateReminder(batch, firestore, vehicleId, 'leasing_end', data.leasing_end);
        await createOrUpdateReminder(batch, firestore, vehicleId, 'warranty_end', data.warranty_end);
        await createOrUpdateReminder(batch, firestore, vehicleId, 'financing_end', data.financing_end);
        await createOrUpdateReminder(batch, firestore, vehicleId, 'tuv', data.tuv_due);

        await batch.commit();

        toast({
            title: isEditMode ? 'Fahrzeug aktualisiert' : 'Fahrzeug gespeichert',
            description: `${formattedData.make} ${formattedData.model} wurde erfolgreich ${isEditMode ? 'aktualisiert' : 'hinzugefügt'}.`,
        });

        form.reset();
        onOpenChange(false);
    } catch (error) {
        console.error("Error saving vehicle and reminders:", error);
        toast({
            variant: "destructive",
            title: "Fehler beim Speichern",
            description: "Es gab ein Problem beim Speichern des Fahrzeugs."
        });
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) form.reset(defaultFormValues);
    onOpenChange(open);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full h-full flex flex-col p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>{isEditMode ? 'Fahrzeug bearbeiten' : 'Neuen Fahrzeug hinzufügen'}</SheetTitle>
          <SheetDescription>{isEditMode ? 'Aktualisieren Sie die Fahrzeugdetails.' : 'Füllen Sie die Details des neuen Fahrzeugs aus.'}</SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 py-4">
                      <h3 className="text-lg font-medium">Stammdaten</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="license_plate" render={({ field }) => ( <FormItem><FormLabel>Kennzeichen *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="vin" render={({ field }) => ( <FormItem><FormLabel>VIN *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="make" render={({ field }) => ( <FormItem><FormLabel>Fabrikat (Hersteller) *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="model" render={({ field }) => ( <FormItem><FormLabel>Modell *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <Controller control={form.control} name="first_registration" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Erstzulassung *</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="mileage_km" render={({ field }) => ( <FormItem><FormLabel>Laufleistung (km) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Fuhrparkstatus</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="aktiv">Aktiv</SelectItem><SelectItem value="in_werkstatt">In Werkstatt</SelectItem><SelectItem value="inaktiv">Inaktiv</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="carrier" render={({ field }) => ( <FormItem><FormLabel>Auftraggeber</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Wählen..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="GLS">GLS</SelectItem><SelectItem value="Hermes">Hermes</SelectItem><SelectItem value="Stadtbote">Stadtbote</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="fleet_type" render={({ field }) => ( <FormItem><FormLabel>Fuhrpark (Klassifizierung)</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'Ja'}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Ja">Ja</SelectItem><SelectItem value="Überlassung">Überlassung</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                      </div>

                      <h3 className="text-lg font-medium pt-4">Technische Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="hsn" render={({ field }) => ( <FormItem><FormLabel>HSN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="tsn" render={({ field }) => ( <FormItem><FormLabel>TSN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="variant" render={({ field }) => ( <FormItem><FormLabel>Variante</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="year" render={({ field }) => ( <FormItem><FormLabel>Baujahr</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="engine" render={({ field }) => ( <FormItem><FormLabel>Motor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="fuel_type" render={({ field }) => ( <FormItem><FormLabel>Kraftstoff</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Wählen..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="Benzin">Benzin</SelectItem><SelectItem value="Diesel">Diesel</SelectItem><SelectItem value="Elektro">Elektro</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem><SelectItem value="LPG">LPG</SelectItem><SelectItem value="CNG">CNG</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="power_kw" render={({ field }) => ( <FormItem><FormLabel>Leistung (kW)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="tire_size" render={({ field }) => ( <FormItem><FormLabel>Reifengröße (z.B. 225/55 R17)</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="color" render={({ field }) => ( <FormItem><FormLabel>Farbe</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                      </div>
                      
                      <h3 className="text-lg font-medium pt-4">Garantie &amp; Termine</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Controller control={form.control} name="tuv_due" render={({ field }) => ( 
                              <FormItem className="flex flex-col">
                                  <FormLabel>TÜV fällig bis *</FormLabel>
                                  <DateInput 
                                      value={field.value} 
                                      onChange={field.onChange} 
                                      showMonthYearPicker
                                      dateFormat="MM/yyyy"
                                      placeholder="MM/JJJJ"
                                  />
                                  <FormMessage />
                              </FormItem> 
                          )} />
                          <Controller control={form.control} name="warranty_end" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Garantieende</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                           <FormField control={form.control} name="location" render={({ field }) => ( <FormItem><FormLabel>Standort</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                      </div>

                      <h3 className="text-lg font-medium pt-4">Vertrags- &amp; Kaufdetails</h3>
                      <FormField control={form.control} name="acquisition_type" render={({ field }) => (
                          <FormItem className="space-y-3">
                          <FormLabel>Art des Erwerbs</FormLabel>
                          <FormControl>
                              <RadioGroup onValueChange={field.onChange} value={field.value ?? ""} className="flex flex-col md:flex-row gap-4">
                                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="cash" /></FormControl><FormLabel className="font-normal">Barkauf</FormLabel></FormItem>
                                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="leasing" /></FormControl><FormLabel className="font-normal">Leasing</FormLabel></FormItem>
                                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="financing" /></FormControl><FormLabel className="font-normal">Finanzierung</FormLabel></FormItem>
                              </RadioGroup>
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )} />
                      
                      {/* Conditional Fields */}
                      <div className="border p-4 rounded-md mt-4 space-y-4">
                          {acquisitionType === 'cash' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                                  <Controller control={form.control} name="purchase_date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Zulassung BK (Kaufdatum)</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                                  <FormField control={form.control} name="purchase_price" render={({ field }) => ( <FormItem><FormLabel>Investition (Kaufpreis €)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                              </div>
                          )}
                          {(acquisitionType === 'leasing' || acquisitionType === 'financing') && (
                               <div className="space-y-4 animate-in fade-in">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <Controller control={form.control} name="purchase_date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Zulassung BK</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                                      <FormField control={form.control} name="purchase_price" render={({ field }) => ( <FormItem><FormLabel>Investition (€)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <FormField control={form.control} name="leasing_company" render={({ field }) => ( <FormItem><FormLabel>Leasinggeber / Bank</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                     <FormField control={form.control} name="leasing_rate_eur" render={({ field }) => ( <FormItem><FormLabel>Rate (Monatlich €)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                                     <Controller control={form.control} name="first_installment_date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Ersterate (Datum)</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                                     <Controller control={form.control} name="last_installment_date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Schlussrate (Datum)</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                                     <Controller control={form.control} name="leasing_end" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Vertragsende</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                                     <FormField control={form.control} name="leasing_annual_mileage" render={({ field }) => ( <FormItem><FormLabel>Laufleistung / Jahr (km)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                                  </div>
                              </div>
                          )}
                          {!acquisitionType && (
                              <div className="text-center text-muted-foreground py-8">Bitte wählen Sie eine Erwerbsart aus.</div>
                          )}
                      </div>
                      
                       <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notizen</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 p-6 border-t bg-background">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Speichert...' : 'Fahrzeug speichern'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
