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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, query, orderBy, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import DateInput from "@/components/ui/DateInput";
import { generateAuditLog } from '@/lib/audit-log';
import type { Contract, Vehicle } from '@/lib/types';

const contractSchema = z.object({
  id: z.string().optional(),
  contractType: z.enum(['leasing', 'financing', 'purchase', 'warranty', 'maintenance', 'insurance', 'other']),
  providerName: z.string().min(1, 'Vertragspartner ist erforderlich.'),
  contractNumber: z.string().optional().nullable(),
  startDate: z.any().optional().nullable(),
  endDate: z.any().optional().nullable(),
  cancellationDeadline: z.any().optional().nullable(),
  monthlyCostEur: z.coerce.number().optional().nullable(),
  responsibleName: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
});

type ContractFormData = z.infer<typeof contractSchema>;

interface ContractFormSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  contractData?: Partial<Contract>;
}

const contractTypeTranslations: { [key: string]: string } = {
  leasing: 'Leasing',
  financing: 'Finanzierung',
  purchase: 'Kauf',
  warranty: 'Garantie',
  maintenance: 'Wartung',
  insurance: 'Versicherung',
  other: 'Sonstiges',
};

const defaultFormValues: Partial<ContractFormData> = {
    contractType: 'leasing',
    providerName: '',
    contractNumber: '',
    startDate: null,
    endDate: null,
    cancellationDeadline: null,
    monthlyCostEur: null,
    responsibleName: '',
    vehicleId: 'none',
    notes: '',
    summary: '',
};

export function ContractFormSheet({ isOpen, onOpenChange, contractData }: ContractFormSheetProps) {
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  const isEditMode = !!contractData?.id;

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: defaultFormValues as ContractFormData
  });

  const vehiclesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'vehicles'), orderBy('license_plate'));
  }, [firestore]);
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  useEffect(() => {
    if (isOpen && contractData) {
      form.reset({
        ...defaultFormValues,
        ...contractData,
        vehicleId: contractData.vehicleId || 'none',
      });
    } else if (isOpen) {
      form.reset(defaultFormValues as ContractFormData);
    }
  }, [contractData, isOpen, form]);

  const onSubmit = async (data: ContractFormData) => {
    if (!firestore || !session || !data.id) return;
    
    const { id, ...contractToSave } = data;
    const userName = session.name || 'unbekannt';

    try {
        const contractRef = doc(firestore, 'contracts', id);
        const originalDoc = await getDoc(contractRef);
        const originalData = originalDoc.data();

        const finalPayload = {
            ...contractToSave,
            vehicleId: data.vehicleId === 'none' ? null : data.vehicleId,
            updatedAt: serverTimestamp(),
        };

        await updateDoc(contractRef, finalPayload);
        await generateAuditLog(firestore, 'contract', id, originalData, finalPayload, userName, 'update');
        
        toast({
            title: 'Vertrag aktualisiert',
            description: 'Die Vertragsdaten wurden erfolgreich gespeichert.',
        });
        
        onOpenChange(false);
    } catch (error) {
        console.error("Error saving contract:", error);
        toast({
            variant: 'destructive',
            title: 'Fehler beim Speichern',
            description: "Es gab ein Problem beim Aktualisieren der Vertragsdaten."
        });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full h-full flex flex-col p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>Vertrag bearbeiten</SheetTitle>
          <SheetDescription>
            Aktualisieren Sie die Details des Vertrags und die Fahrzeugzuordnung.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="contractType" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Vertragsart *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                          {Object.entries(contractTypeTranslations).map(([key, value]) => (
                                              <SelectItem key={key} value={key}>{value}</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                          )} />
                          <FormField control={form.control} name="providerName" render={({ field }) => (
                              <FormItem><FormLabel>Partner *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="contractNumber" render={({ field }) => (
                              <FormItem><FormLabel>Vertragsnummer</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="monthlyCostEur" render={({ field }) => (
                              <FormItem><FormLabel>Monatliche Kosten (€)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Controller control={form.control} name="startDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Beginn</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                          <Controller control={form.control} name="endDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Ende</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                          <Controller control={form.control} name="cancellationDeadline" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Kündigungsfrist</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem> )} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="responsibleName" render={({ field }) => (
                              <FormItem><FormLabel>Zuständiger Mitarbeiter</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="vehicleId" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Zugeordnetes Fahrzeug</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? 'none'}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                          <SelectItem value="none">Kein Fahrzeug</SelectItem>
                                          {vehicles?.map(v => (
                                              <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make} {v.model})</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      </div>

                      <FormField control={form.control} name="summary" render={({ field }) => (
                          <FormItem><FormLabel>KI-Inhaltszusammenfassung</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} rows={6} /></FormControl><FormDescription>Diese Information wird vom Vertrags-Assistenten genutzt.</FormDescription><FormMessage /></FormItem>
                      )} />

                      <FormField control={form.control} name="notes" render={({ field }) => (
                          <FormItem><FormLabel>Interne Notizen</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} rows={3} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 p-6 border-t bg-background">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Speichert...' : 'Vertrag speichern'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}