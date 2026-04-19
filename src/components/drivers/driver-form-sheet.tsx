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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, addDoc, updateDoc, Timestamp, query, orderBy, getDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { Checkbox } from '../ui/checkbox';
import DateInput from "@/components/ui/DateInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generateAuditLog } from '@/lib/audit-log';
import { isPast, startOfDay } from 'date-fns';


const driverSchema = z.object({
  id: z.string().optional(),
  first_name: z.string().min(1, 'Vorname ist erforderlich.'),
  last_name: z.string().min(1, 'Nachname ist erforderlich.'),
  birth_date: z.instanceof(Timestamp, { message: 'Geburtsdatum ist erforderlich.' }).nullable(),
  email: z.string().email('Ungültige E-Mail-Adresse.').optional().or(z.literal('')),
  phone: z.string().min(1, 'Telefonnummer ist erforderlich.'),
  carrier: z.enum(['GLS', 'Hermes', 'Stadtbote']).optional().nullable(),
  address: z.object({
    street: z.string().min(1, 'Straße ist erforderlich.'),
    zip: z.string().min(1, 'PLZ ist erforderlich.'),
    city: z.string().min(1, 'Stadt ist erforderlich.'),
  }),
  license_number: z.string().optional(),
  license_issue_date: z.instanceof(Timestamp).optional().nullable(),
  license_expiry_date: z.instanceof(Timestamp).optional().nullable(),
  license_issue_country: z.string().optional(),
  license_classes: z.array(z.string()).min(1, 'Mindestens eine Führerscheinklasse auswählen.'),
  assigned_vehicle_ids: z.array(z.string()).optional(),
  nationality: z.string().optional(),
  birth_place: z.string().optional(),
  employment_start_date: z.instanceof(Timestamp).optional().nullable(),
  employee_number: z.string().optional(),
  zsb: z.string().optional(),
  health_insurance: z.string().optional(),
});

export type Driver = z.infer<typeof driverSchema> & {
  created_at?: Timestamp,
  updated_at?: Timestamp,
};

type Vehicle = { id: string; license_plate: string; make: string; model: string; };

interface DriverFormSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  driverData?: Partial<Driver>;
  isPrefilled?: boolean;
}

const defaultFormValues = {
    first_name: '',
    last_name: '',
    birth_date: null,
    email: '',
    phone: '',
    carrier: null,
    address: {
        street: '',
        zip: '',
        city: '',
    },
    license_number: '',
    license_issue_date: null,
    license_expiry_date: null,
    license_issue_country: '',
    license_classes: [],
    assigned_vehicle_ids: [],
    nationality: '',
    birth_place: '',
    employment_start_date: null,
    employee_number: '',
    zsb: '',
    health_insurance: '',
};

const allLicenseClasses = ['A', 'A1', 'A2', 'AM', 'B', 'BE', 'C', 'CE', 'C1', 'C1E', 'D', 'DE', 'D1', 'D1E', 'L', 'T'];

async function createOrUpdateDriverReminder(
    batch: any,
    firestore: any,
    driverId: string,
    kind: 'driver_license_expiry',
    dueDate: Timestamp | null | undefined
) {
    const remindersRef = collection(firestore, 'reminders');
    const q = query(remindersRef, where('driverId', '==', driverId), where('kind', '==', kind));
    const existingReminders = await getDocs(q);

    if (dueDate && !isPast(startOfDay(dueDate.toDate()))) {
        const reminderData = {
            driverId,
            kind,
            due_date: dueDate,
            status: 'open' as 'open',
            sourceEventId: driverId 
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


export function DriverFormSheet({ isOpen, onOpenChange, driverData, isPrefilled = false }: DriverFormSheetProps) {
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  const isEditMode = !!driverData?.id;

  const form = useForm<z.infer<typeof driverSchema>>({
    resolver: zodResolver(driverSchema),
    defaultValues: defaultFormValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'license_classes'
  });

  const vehiclesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'vehicles'), orderBy('license_plate')) : null, [firestore]);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  useEffect(() => {
    if (isOpen) {
      if (driverData) {
        const dataToReset = {
            ...defaultFormValues,
            ...driverData,
            license_classes: driverData.license_classes || [],
            assigned_vehicle_ids: driverData.assigned_vehicle_ids || [],
        };
        form.reset(dataToReset);
      } else {
        form.reset(defaultFormValues);
      }
    }
  }, [driverData, isOpen, form]);

  const onSubmit = async (data: z.infer<typeof driverSchema>) => {
    if (!firestore || !session) return;
    
    const { id, ...driverToSave } = data;
    const userName = session.name || 'unbekannt';

    try {
        const batch = writeBatch(firestore);
        const driverId = isEditMode && id ? id : doc(collection(firestore, 'drivers')).id;
        const driverRef = doc(firestore, 'drivers', driverId);

        if (isEditMode && id) {
            const originalDoc = await getDoc(driverRef);
            const originalData = originalDoc.data();
            const finalData = { ...driverToSave, updated_at: serverTimestamp() };
            batch.update(driverRef, finalData);
            await createOrUpdateDriverReminder(batch, firestore, driverId, 'driver_license_expiry', data.license_expiry_date);
            await batch.commit();
            await generateAuditLog(firestore, 'driver', id, originalData, finalData, userName, 'update');
            toast({
                title: 'Fahrer aktualisiert',
                description: `Die Daten von ${data.first_name} ${data.last_name} wurden erfolgreich aktualisiert.`,
            });
        } else {
            const finalData = { ...driverToSave, created_at: serverTimestamp(), updated_at: serverTimestamp() };
            batch.set(driverRef, finalData);
            await createOrUpdateDriverReminder(batch, firestore, driverId, 'driver_license_expiry', data.license_expiry_date);
            await batch.commit();
            await generateAuditLog(firestore, 'driver', driverId, {}, finalData, userName, 'create');
            toast({
                title: 'Fahrer gespeichert',
                description: `${data.first_name} ${data.last_name} wurde erfolgreich hinzugefügt.`,
            });
        }
        
        form.reset();
        onOpenChange(false);
        
    } catch (error) {
        console.error("Error saving driver:", error);
        toast({
            variant: 'destructive',
            title: 'Fehler beim Speichern',
            description: "Es gab ein Problem beim Speichern der Fahrerdaten."
        });
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset(defaultFormValues);
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full h-full flex flex-col p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>{isEditMode ? 'Fahrer bearbeiten' : 'Neuen Fahrer anlegen'}</SheetTitle>
          <SheetDescription>
            {isEditMode ? 'Aktualisieren Sie die Daten des Fahrers.' : isPrefilled ? 'Überprüfen und vervollständigen Sie die ausgelesenen Daten.' : 'Erfassen Sie alle relevanten Informationen zum neuen Fahrer.'}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 py-4">
                      <h3 className="text-lg font-medium">Persönliche Daten</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="first_name" render={({ field }) => (
                              <FormItem><FormLabel>Vorname *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="last_name" render={({ field }) => (
                              <FormItem><FormLabel>Nachname *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <Controller
                            control={form.control}
                            name="birth_date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Geburtsdatum *</FormLabel>
                                  <DateInput 
                                    value={field.value} 
                                    onChange={field.onChange} 
                                  />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField control={form.control} name="birth_place" render={({ field }) => (
                              <FormItem><FormLabel>Geburtsort</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                           <FormField control={form.control} name="nationality" render={({ field }) => (
                              <FormItem><FormLabel>Nationalität</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <Controller
                            control={form.control}
                            name="employment_start_date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Angestellt seit</FormLabel>
                                  <DateInput 
                                    value={field.value} 
                                    onChange={field.onChange} 
                                  />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField control={form.control} name="employee_number" render={({ field }) => (
                              <FormItem><FormLabel>Mitarbeiternummer</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="zsb" render={({ field }) => (
                              <FormItem><FormLabel>ZSB</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="health_insurance" render={({ field }) => (
                              <FormItem><FormLabel>Krankenkasse</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                      </div>
                       <h3 className="text-lg font-medium pt-4">Kontaktdaten & Zuordnung</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField control={form.control} name="email" render={({ field }) => (
                              <FormItem><FormLabel>E-Mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                           <FormField control={form.control} name="phone" render={({ field }) => (
                              <FormItem><FormLabel>Telefon *</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="carrier" render={({ field }) => ( <FormItem><FormLabel>Zusteller</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Wählen..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="GLS">GLS</SelectItem><SelectItem value="Hermes">Hermes</SelectItem><SelectItem value="Stadtbote">Stadtbote</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                      </div>
                       <h3 className="text-lg font-medium pt-4">Adresse</h3>
                       <FormField control={form.control} name="address.street" render={({ field }) => (
                          <FormItem><FormLabel>Straße & Hausnummer *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="address.zip" render={({ field }) => (
                              <FormItem><FormLabel>PLZ *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="address.city" render={({ field }) => (
                              <FormItem><FormLabel>Stadt *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                      </div>

                      <h3 className="text-lg font-medium pt-4">Führerschein & Fahrzeuge</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="license_number" render={({ field }) => (
                              <FormItem><FormLabel>Führerscheinnummer</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                           <FormField control={form.control} name="license_issue_country" render={({ field }) => (
                              <FormItem><FormLabel>Ausstellungsland</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                           <Controller
                            control={form.control}
                            name="license_issue_date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Ausstellungsdatum</FormLabel>
                                  <DateInput 
                                    value={field.value} 
                                    onChange={field.onChange} 
                                  />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <Controller
                            control={form.control}
                            name="license_expiry_date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Gültig bis</FormLabel>
                                  <DateInput 
                                    value={field.value} 
                                    onChange={field.onChange} 
                                  />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                       <FormField
                          control={form.control}
                          name="license_classes"
                          render={() => (
                              <FormItem>
                                  <div className="mb-4">
                                  <FormLabel>Führerscheinklassen *</FormLabel>
                                  <FormDescription>Wählen Sie alle zutreffenden Klassen aus.</FormDescription>
                                  </div>
                                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                  {allLicenseClasses.map((item) => (
                                      <FormField
                                      key={item}
                                      control={form.control}
                                      name="license_classes"
                                      render={({ field }) => {
                                          return (
                                          <FormItem
                                              key={item}
                                              className="flex flex-row items-start space-x-3 space-y-0"
                                          >
                                              <FormControl>
                                              <Checkbox
                                                  checked={field.value?.includes(item)}
                                                  onCheckedChange={(checked) => {
                                                  return checked
                                                      ? field.onChange([...(field.value || []), item])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                          (value) => value !== item
                                                          )
                                                      )
                                                  }}
                                              />
                                              </FormControl>
                                              <FormLabel className="font-normal">
                                              {item}
                                              </FormLabel>
                                          </FormItem>
                                          )
                                      }}
                                      />
                                  ))}
                                  </div>
                                  <FormMessage />
                              </FormItem>
                          )}
                          />

                      <FormField
                          control={form.control}
                          name="assigned_vehicle_ids"
                          render={() => (
                              <FormItem>
                                  <div className="mb-4">
                                  <FormLabel>Zugewiesene Fahrzeuge (optional)</FormLabel>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                  {vehicles?.map((vehicle) => (
                                      <FormField
                                      key={vehicle.id}
                                      control={form.control}
                                      name="assigned_vehicle_ids"
                                      render={({ field }) => {
                                          return (
                                          <FormItem
                                              key={vehicle.id}
                                              className="flex flex-row items-start space-x-3 space-y-0"
                                          >
                                              <FormControl>
                                              <Checkbox
                                                  checked={field.value?.includes(vehicle.id)}
                                                  onCheckedChange={(checked) => {
                                                  return checked
                                                      ? field.onChange([...(field.value || []), vehicle.id])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                          (value) => value !== vehicle.id
                                                          )
                                                      )
                                                  }}
                                              />
                                              </FormControl>
                                              <FormLabel className="font-normal">
                                              {vehicle.license_plate} ({vehicle.make} {vehicle.model})
                                              </FormLabel>
                                          </FormItem>
                                          )
                                      }}
                                      />
                                  ))}
                                  </div>
                                  <FormMessage />
                              </FormItem>
                          )}
                          />
                  </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 p-6 border-t bg-background">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Speichert...' : 'Fahrer speichern'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}