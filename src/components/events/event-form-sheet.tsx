
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, query, orderBy, Timestamp, writeBatch, where, getDocs, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import DateInput from "@/components/ui/DateInput";
import { analyzeDamage, AnalyzeDamageOutput } from '@/ai/flows/analyze-damage-flow';
import Image from 'next/image';
import { Loader2, UploadCloud, X, Wand2, Calculator, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import ReactMarkdown from 'react-markdown';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { generateAuditLog } from '@/lib/audit-log';


const eventSchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().min(1, 'Fahrzeug ist erforderlich.'),
  driverId: z.string().optional().nullable(),
  type: z.enum(['inspection', 'repair', 'damage', 'tuv', 'au', 'uvv', 'tire_change', 'service', 'fuel', 'trip', 'other', 'verkehrsunfall']),
  title: z.string().min(1, 'Titel ist erforderlich.'),
  due_date: z.instanceof(Timestamp, { message: 'Datum ist erforderlich.' }).nullable(),
  odometer_km: z.coerce.number().min(0, 'Kilometerstand muss positiv sein.'),
  cost_eur: z.coerce.number().min(0, 'Kosten müssen positiv sein.').optional().nullable(),
  status: z.enum(['open', 'in_progress', 'done']).default('open'),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
  completed_by_name: z.string().optional().nullable(),
  completed_at: z.instanceof(Timestamp).optional().nullable(),
  police_involved: z.boolean().optional().default(false),
  police_case_number: z.string().optional(),
  fault: z.enum(['own', 'third_party', 'unknown']).optional().nullable(),
  third_party: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    license_plate: z.string().optional(),
    insurance_company: z.string().optional(),
    insurance_policy_number: z.string().optional(),
    vehicle_details: z.string().optional(),
  }).optional(),
  accident_sketch_data: z.array(z.any()).optional(),
  accident_sketch_image: z.string().optional(),
}).refine(data => !data.police_involved || (data.police_involved && data.police_case_number), {
    message: "Aktenzeichen ist erforderlich, wenn die Polizei involviert war.",
    path: ["police_case_number"],
});


export type VehicleEvent = z.infer<typeof eventSchema> & {
    created_at?: Timestamp,
    updated_at?: Timestamp,
    created_by_name?: string,
};
type Vehicle = { id: string; license_plate: string; make: string; model: string; mileage_km?: number; };
type Driver = { id: string; first_name: string; last_name: string; };

interface EventFormSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  eventData?: Partial<VehicleEvent>;
  prefilledData?: Partial<VehicleEvent>;
  allowedEventTypes: string[];
  title: string;
  description: string;
}

const eventTypeTranslations: { [key: string]: string } = {
  inspection: 'Inspektion',
  repair: 'Reparatur',
  damage: 'Schaden',
  verkehrsunfall: 'Verkehrsunfall',
  tuv: 'TÜV (HU)',
  au: 'AU',
  uvv: 'UVV-Prüfung',
  tire_change: 'Reifenwechsel',
  service: 'Service',
  fuel: 'Tanken',
  trip: 'Fahrt',
  other: 'Sonstiges',
};

const statusTranslations: { [key: string]: string } = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
};

const faultTranslations: { [key: string]: string } = {
    own: 'Eigenschuld',
    third_party: 'Fremdschuld',
    unknown: 'Unbekannt',
};

const defaultFormValues: Partial<VehicleEvent> = {
    vehicleId: '',
    driverId: null,
    type: 'service' as VehicleEvent['type'],
    title: '',
    due_date: null,
    odometer_km: 0,
    cost_eur: undefined,
    status: 'open' as VehicleEvent['status'],
    vendor: '',
    notes: '',
    images: [],
    police_involved: false,
    police_case_number: '',
    fault: null,
    third_party: {
      first_name: '',
      last_name: '',
      phone: '',
      license_plate: '',
      insurance_company: '',
      insurance_policy_number: '',
      vehicle_details: '',
    }
};

const reminderEventTypes = ['tuv', 'au', 'uvv', 'inspection', 'service'];

async function manageEventReminder(
    firestore: any,
    event: VehicleEvent,
    eventId: string
) {
    const batch = writeBatch(firestore);
    const reminderQuery = query(collection(firestore, 'reminders'), where('sourceEventId', '==', eventId));
    const existingReminders = await getDocs(reminderQuery);

    const shouldHaveReminder = 
        event.due_date &&
        reminderEventTypes.includes(event.type) && 
        event.status !== 'done' && 
        !isPast(startOfDay(event.due_date.toDate()));

    if (shouldHaveReminder) {
        const reminderData = {
            vehicleId: event.vehicleId,
            kind: event.type,
            due_date: event.due_date,
            status: 'open',
            sourceEventId: eventId,
        };

        if (existingReminders.empty) {
            const newReminderRef = doc(collection(firestore, 'reminders'));
            batch.set(newReminderRef, reminderData);
        } else {
            const reminderDoc = existingReminders.docs[0];
            batch.update(reminderDoc.ref, reminderData);
        }
    } else {
        existingReminders.forEach(doc => batch.delete(doc.ref));
    }
    await batch.commit();
}


export function EventFormSheet({ isOpen, onOpenChange, eventData, allowedEventTypes, title, description, prefilledData }: EventFormSheetProps) {
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  const isEditMode = !!eventData?.id;

  const [damageImages, setDamageImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeDamageOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<VehicleEvent>({
    resolver: zodResolver(eventSchema),
    defaultValues: defaultFormValues as VehicleEvent
  });

  const eventType = form.watch('type');
  const policeInvolved = form.watch('police_involved');
  
  const vehiclesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'vehicles'), orderBy('license_plate'));
  }, [firestore]);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  const driversQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'drivers'), orderBy('last_name'));
  }, [firestore]);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const clearDamageAnalysisState = () => {
    setDamageImages([]);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      clearDamageAnalysisState();
      let dataToReset;
      const initialData = eventData || prefilledData;
      if (initialData) {
        dataToReset = {
          ...defaultFormValues,
          ...initialData,
        };
        if (initialData.images) {
            setDamageImages(initialData.images);
        }
      } else {
        dataToReset = {
          ...defaultFormValues,
          type: allowedEventTypes[0] as VehicleEvent['type'],
        };
      }
      form.reset(dataToReset);
    }
  }, [eventData, prefilledData, isOpen, form, allowedEventTypes]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPreviews: string[] = [];
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === files.length) {
            const allImages = [...damageImages, ...newPreviews];
            setDamageImages(allImages);
            form.setValue('images', allImages);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    const updated = damageImages.filter((_, i) => i !== index);
    setDamageImages(updated);
    form.setValue('images', updated);
  };
  
  const handleAnalyzeDamage = async () => {
      if (damageImages.length === 0) {
          toast({ variant: 'destructive', title: 'Keine Bilder', description: 'Bitte laden Sie zuerst Bilder des Schadens hoch.' });
          return;
      }
      setIsAnalyzing(true);
      setAnalysisResult(null);
      try {
          const result = await analyzeDamage({ photoDataUris: damageImages });
          setAnalysisResult(result);
          
          // Extrahiere numerischen Wert aus Kosten-String (z.B. "1500-2000 EUR")
          const firstPrice = result.costEstimate.match(/\d+/);
          if (firstPrice) {
              form.setValue('cost_eur', parseFloat(firstPrice[0]), { shouldValidate: true });
          }

          const currentNotes = form.getValues('notes') || '';
          const newNotes = `### KI-SCHADENSANALYSE\n${result.damageAnalysis}\n\n**Kostenschätzung:** ${result.costEstimate}\n\n---\n\n${currentNotes}`;
          form.setValue('notes', newNotes, { shouldValidate: true });

          toast({ title: 'KI-Analyse abgeschlossen', description: 'Daten wurden ins Formular übernommen.' });

      } catch (error) {
          console.error("Damage analysis error:", error);
          toast({ variant: 'destructive', title: 'Analyse fehlgeschlagen' });
      } finally {
          setIsAnalyzing(false);
      }
  };


  const onSubmit = async (data: VehicleEvent) => {
    if (!firestore || !session) return;
    
    const isNowDone = data.status === 'done';
    const wasPreviouslyDone = eventData?.status === 'done';
    const statusChanged = data.status !== eventData?.status;


    let completionData: Partial<VehicleEvent> = {};
    if (isNowDone && !wasPreviouslyDone) {
        completionData = {
            completed_by_name: session.name,
            completed_at: serverTimestamp() as Timestamp,
        };
    } else if (!isNowDone && wasPreviouslyDone) {
         completionData = {
            completed_by_name: null,
            completed_at: null,
        };
    }
    
    const eventDataToSend = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    
    const { id, ...eventToSave } = eventDataToSend;
    const userName = session.name || 'unbekannt';

    try {
        const batch = writeBatch(firestore);
        
        // Intelligent Mileage Update Logic
        if (data.odometer_km > 0) {
            const vehicleRef = doc(firestore, 'vehicles', data.vehicleId);
            const vehicleSnap = await getDoc(vehicleRef);
            if (vehicleSnap.exists()) {
                const currentVehicleMileage = vehicleSnap.data().mileage_km || 0;
                // Only update if the new value is higher
                if (data.odometer_km > currentVehicleMileage) {
                    batch.update(vehicleRef, {
                        mileage_km: data.odometer_km,
                        mileage_updated_at: serverTimestamp()
                    });
                }
            }
        }

        if (isEditMode && id) {
            const eventRef = doc(firestore, 'vehicle_events', id);
            const originalDoc = await getDoc(eventRef);
            const originalData = originalDoc.data();

            const finalData = { ...eventToSave, ...completionData, updated_at: serverTimestamp() };
            batch.update(eventRef, finalData);

            if (statusChanged) {
                const markersQuery = query(collection(firestore, 'damage_markers'), where('eventId', '==', id));
                const markersSnapshot = await getDocs(markersQuery);
                markersSnapshot.forEach(markerDoc => {
                    batch.update(markerDoc.ref, { status: data.status });
                });
            }
            
            await batch.commit();
            await generateAuditLog(firestore, 'event', id, originalData, finalData, userName, 'update');
            await manageEventReminder(firestore, data, id);
            
            toast({
                title: 'Ereignis aktualisiert',
                description: `Das Ereignis "${data.title}" wurde erfolgreich aktualisiert.`,
            });
        } else {
            const finalData = {
              ...eventToSave,
              ...completionData,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
              created_by_name: session.name,
            };
            const newEventRef = doc(collection(firestore, 'vehicle_events'));
            batch.set(newEventRef, finalData);
            
            await batch.commit();
            await generateAuditLog(firestore, 'event', newEventRef.id, {}, finalData, userName, 'create');
            await manageEventReminder(firestore, { ...data, id: newEventRef.id }, newEventRef.id);
            
            toast({
                title: 'Ereignis gespeichert',
                description: `Das Ereignis "${data.title}" wurde hinzugefügt.`,
            });
        }
        
        form.reset();
        onOpenChange(false);
        
    } catch (error) {
        console.error("Error saving event:", error);
        toast({
            variant: 'destructive',
            title: 'Fehler beim Speichern'
        });
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset(defaultFormValues as VehicleEvent);
      clearDamageAnalysisState();
    }
    onOpenChange(open);
  };
  
  const isDamageForm = allowedEventTypes.includes('damage') || allowedEventTypes.includes('verkehrsunfall');
  const status = form.watch('status');

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full h-full flex flex-col p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {description}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 py-4">
                      {isEditMode && (
                          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 transition-all">
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={status === 'done'}
                                  onCheckedChange={(checked) => {
                                    form.setValue('status', checked ? 'done' : 'open');
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-base font-black text-green-800 dark:text-green-200">
                                DIESES EREIGNIS ALS ERLEDIGT MARKIEREN
                              </FormLabel>
                            </FormItem>
                          </div>
                      )}
                      
                      <Card className="border-primary/10">
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="vehicleId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold">Fahrzeug *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Fahrzeug wählen..."/></SelectTrigger></FormControl>
                                        <SelectContent position="popper" className="z-[200]">
                                            {vehicles?.map(v => (
                                                <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make} {v.model})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold">Ereignis-Typ *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent position="popper" className="z-[200]">
                                            {allowedEventTypes.map(type => (
                                                <SelectItem key={type} value={type}>{eventTypeTranslations[type] || type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                      </Card>

                      <FormField control={form.control} name="title" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold">Betreff / Titel *</FormLabel><FormControl><Input className="h-11 rounded-xl font-bold" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Controller
                            control={form.control}
                            name="due_date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="font-bold">{isDamageForm ? 'Schadensdatum *' : 'Termin / Datum *'}</FormLabel>
                                <DateInput value={field.value} onChange={field.onChange} />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField control={form.control} name="status" render={({ field }) => (
                              <FormItem>
                                  <FormLabel className="font-bold">Status *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger></FormControl>
                                      <SelectContent position="popper" className="z-[200]">
                                          {Object.entries(statusTranslations).map(([key, value]) => (
                                              <SelectItem key={key} value={key}>{value}</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                           )} />
                          <FormField control={form.control} name="odometer_km" render={({ field }) => (
                              <FormItem><FormLabel className="font-bold">Aktueller Kilometerstand *</FormLabel><FormControl><Input type="number" className="h-11 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="cost_eur" render={({ field }) => (
                              <FormItem><FormLabel className="font-bold">Gesamtkosten (€)</FormLabel><FormControl><Input type="number" step="0.01" className="h-11 rounded-xl font-bold" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="vendor" render={({ field }) => (
                              <FormItem><FormLabel className="font-bold">Werkstatt / Dienstleister</FormLabel><FormControl><Input className="h-11 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="driverId" render={({ field }) => (
                              <FormItem>
                                  <FormLabel className="font-bold">Zugeordneter Fahrer</FormLabel>
                                  <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'}>
                                      <FormControl><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Fahrer auswählen..."/></SelectTrigger></FormControl>
                                      <SelectContent position="popper" className="z-[200]">
                                          <SelectItem value="none">Nicht zugeordnet</SelectItem>
                                          {drivers?.map(d => (
                                              <SelectItem key={d.id} value={d.id}>{d.last_name}, {d.first_name}</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      </div>

                      {(isDamageForm || eventType === 'verkehrsunfall') && (
                          <div className="space-y-4 pt-4 border-t">
                               <h3 className="text-base font-black uppercase tracking-widest text-primary">Schadensdetails</h3>
                               
                               <FormField control={form.control} name="fault" render={({ field }) => (
                                  <FormItem className="space-y-3">
                                  <FormLabel className="font-bold">Schuldfrage</FormLabel>
                                  <FormControl>
                                      <RadioGroup onValueChange={field.onChange} value={field.value ?? ""} className="flex flex-col md:flex-row gap-4">
                                          {Object.entries(faultTranslations).map(([key, value]) => (
                                              <FormItem key={key} className="flex items-center space-x-3 space-y-0">
                                                  <FormControl><RadioGroupItem value={key} /></FormControl>
                                                  <FormLabel className="font-normal">{value}</FormLabel>
                                              </FormItem>
                                          ))}
                                      </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                  </FormItem>
                              )} />
                              <FormField
                                  control={form.control}
                                  name="police_involved"
                                  render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border p-4 bg-muted/20">
                                      <FormControl>
                                          <Checkbox
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                          />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                          <FormLabel className="font-bold">Polizei involviert?</FormLabel>
                                      </div>
                                      </FormItem>
                                  )}
                              />
                              {policeInvolved && (
                                  <FormField
                                      control={form.control}
                                      name="police_case_number"
                                      render={({ field }) => (
                                          <FormItem className="animate-in fade-in">
                                              <FormLabel className="font-bold">Aktenzeichen der Polizei</FormLabel>
                                              <FormControl>
                                                  <Input placeholder="Aktenzeichen eingeben..." className="h-11 rounded-xl" {...field} />
                                              </FormControl>
                                              <FormMessage />
                                          </FormItem>
                                      )}
                                  />
                              )}
                          </div>
                      )}
                      
                      {eventType === 'verkehrsunfall' && (
                           <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="item-1" className="border-none">
                                  <AccordionTrigger className="bg-muted/30 p-4 rounded-xl hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-4 w-4 text-primary" />
                                        <span className="font-black uppercase tracking-widest text-xs">Daten des Unfallgegners</span>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="p-4 border rounded-xl mt-2 space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                           <FormField control={form.control} name="third_party.first_name" render={({ field }) => ( <FormItem><FormLabel>Vorname</FormLabel><FormControl><Input className="h-10 rounded-lg" {...field} /></FormControl></FormItem> )} />
                                           <FormField control={form.control} name="third_party.last_name" render={({ field }) => ( <FormItem><FormLabel>Nachname</FormLabel><FormControl><Input className="h-10 rounded-lg" {...field} /></FormControl></FormItem> )} />
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <FormField control={form.control} name="third_party.phone" render={({ field }) => ( <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input className="h-10 rounded-lg" type="tel" {...field} /></FormControl></FormItem> )} />
                                          <FormField control={form.control} name="third_party.license_plate" render={({ field }) => ( <FormItem><FormLabel>Kennzeichen</FormLabel><FormControl><Input className="h-10 rounded-lg" {...field} /></FormControl></FormItem> )} />
                                      </div>
                                      <FormField control={form.control} name="third_party.vehicle_details" render={({ field }) => ( <FormItem><FormLabel>Fahrzeugdetails (Marke, Modell, Farbe)</FormLabel><FormControl><Input className="h-10 rounded-lg" {...field} /></FormControl></FormItem> )} />
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <FormField control={form.control} name="third_party.insurance_company" render={({ field }) => ( <FormItem><FormLabel>Versicherung</FormLabel><FormControl><Input className="h-10 rounded-lg" {...field} /></FormControl></FormItem> )} />
                                          <FormField control={form.control} name="third_party.insurance_policy_number" render={({ field }) => ( <FormItem><FormLabel>Versicherungsnummer</FormLabel><FormControl><Input className="h-10 rounded-lg" {...field} /></FormControl></FormItem> )} />
                                      </div>
                                  </AccordionContent>
                              </AccordionItem>
                          </Accordion>
                      )}


                       <FormField control={form.control} name="notes" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold">Detaillierte Analyse / Notizen (Markdown)</FormLabel><FormControl><Textarea {...field} rows={10} className="rounded-xl font-mono text-xs leading-relaxed" /></FormControl><FormMessage /></FormItem>
                      )} />

                      {isDamageForm && (
                          <div className="space-y-4 pt-4 border-t">
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-black uppercase tracking-widest text-primary">Beweisfotos</h3>
                                {damageImages.length > 0 && (
                                    <Button type="button" size="sm" variant="outline" onClick={handleAnalyzeDamage} disabled={isAnalyzing} className='rounded-full border-primary/20 text-primary'>
                                        {isAnalyzing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Calculator className="mr-2 h-3 w-3" />}
                                        KI-Schnellanalyse
                                    </Button>
                                )}
                              </div>
                               <div>
                                  <label
                                      htmlFor="damage-file-upload"
                                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer bg-muted/20 hover:bg-primary/5 transition-all"
                                  >
                                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      <UploadCloud className="w-8 h-8 mb-2 text-primary/40" />
                                      <p className="text-sm font-bold">Bilder hinzufügen</p>
                                      <p className="text-xs text-muted-foreground mt-1">Fotos vom Schaden oder Unfallort</p>
                                      </div>
                                      <Input
                                          id="damage-file-upload"
                                          type="file"
                                          className="hidden"
                                          onChange={handleFileChange}
                                          accept="image/*"
                                          multiple
                                          ref={fileInputRef}
                                          disabled={isAnalyzing}
                                      />
                                  </label>
                                  {damageImages.length > 0 && (
                                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-4">
                                          {damageImages.map((src, index) => (
                                              <div key={index} className="relative group aspect-square">
                                                  <Image src={src} alt={`Schadensbild ${index + 1}`} width={100} height={100} className="object-cover w-full h-full rounded-xl border shadow-sm" />
                                                  <Button
                                                      variant="destructive"
                                                      size="icon"
                                                      className="absolute -top-1 -right-1 h-6 w-6 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                      onClick={() => removeImage(index)}
                                                      disabled={isAnalyzing}
                                                  >
                                                      <X className="h-3 w-3" />
                                                  </Button>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>

                              {(isAnalyzing || analysisResult) && (
                                  <Card className="border-2 border-primary/20 bg-primary/5">
                                      <CardHeader className="pb-2">
                                          <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <Wand2 className="h-3 w-3" /> KI Analyse-Ergebnis
                                          </CardTitle>
                                      </CardHeader>
                                      <CardContent className='text-sm'>
                                          {isAnalyzing ? (
                                              <div className="space-y-3">
                                                  <Skeleton className="h-4 w-3/4" />
                                                  <Skeleton className="h-20 w-full" />
                                              </div>
                                          ) : analysisResult && (
                                              <div className='space-y-4'>
                                                  <div className="flex items-center gap-2 text-lg font-black text-primary">
                                                      <Calculator className="h-5 w-5" />
                                                      {analysisResult.costEstimate}
                                                  </div>
                                                  <div className="prose prose-sm dark:prose-invert max-w-none bg-background/50 p-4 rounded-xl border shadow-inner">
                                                      <ReactMarkdown>
                                                          {analysisResult.damageAnalysis}
                                                      </ReactMarkdown>
                                                  </div>
                                              </div>
                                          )}
                                      </CardContent>
                                  </Card>
                              )}
                          </div>
                      )}
                  </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 p-6 border-t bg-background">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} className="rounded-xl font-bold">Abbrechen</Button>
                <Button type="submit" disabled={form.formState.isSubmitting || isAnalyzing} className="rounded-xl px-8 font-black uppercase tracking-widest">
                  {form.formState.isSubmitting ? 'Wird gespeichert...' : 'Ereignis speichern'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
