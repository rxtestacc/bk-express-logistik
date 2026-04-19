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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, query, orderBy, Timestamp, addDoc, updateDoc, writeBatch, getDoc, where } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import DateInput from "@/components/ui/DateInput";
import { Checkbox } from '../ui/checkbox';
import { generateAuditLog } from '@/lib/audit-log';
import { Skeleton } from '@/components/ui/skeleton';
import { Wand2, Loader2, Sparkles } from 'lucide-react';
import { refineText } from '@/ai/flows/refine-text-flow';

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Titel ist erforderlich.'),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'done']).default('open'),
  due_date: z.instanceof(Timestamp, { message: 'Fälligkeitsdatum ist erforderlich.' }).nullable(),
  assignee_name: z.string().min(1, 'Zuständiger ist erforderlich'),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  completed_by_name: z.string().optional().nullable(),
  completed_at: z.instanceof(Timestamp).optional().nullable(),
});

export type Task = z.infer<typeof taskSchema> & {
    created_at?: Timestamp,
    updated_at?: Timestamp,
    created_by_name?: string,
};
type Vehicle = { id: string; license_plate: string; make: string; model: string; };
type PinUser = { id: string; name: string; role: string; active: boolean; };

interface TaskFormSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  taskData?: Task;
}

const statusTranslations: { [key: string]: string } = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
};

const defaultFormValues: Partial<Task> = {
    title: '',
    description: '',
    status: 'open' as Task['status'],
    due_date: null,
    assignee_name: '',
    vehicleId: '',
    driverId: '',
};

export function TaskFormSheet({ isOpen, onOpenChange, taskData }: TaskFormSheetProps) {
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  const isEditMode = !!taskData?.id;
  const [isPolishing, setIsPolishing] = useState(false);

  const form = useForm<Task>({
    resolver: zodResolver(taskSchema),
    defaultValues: defaultFormValues
  });
  
  const vehiclesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'vehicles'), orderBy('license_plate'));
  }, [firestore]);

  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  const pinsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pins'), where('active', '==', true));
  }, [firestore]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<PinUser>(pinsQuery);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && taskData) {
        form.reset({
          ...taskData,
        });
      } else {
        form.reset(defaultFormValues);
      }
    }
  }, [taskData, isEditMode, isOpen, form]);

  const handlePolishText = async () => {
    const currentDesc = form.getValues('description');
    const currentTitle = form.getValues('title');
    
    if (!currentDesc && !currentTitle) {
        toast({ title: 'Hinweis', description: 'Geben Sie zuerst einen Text ein, den die KI verbessern soll.' });
        return;
    }

    setIsPolishing(true);
    try {
        // Wir verbessern primär die Beschreibung, da dort meist die Fehler liegen
        if (currentDesc) {
            const result = await refineText({ text: currentDesc });
            form.setValue('description', result.refinedText, { shouldValidate: true, shouldDirty: true });
        }
        
        // Wenn der Titel sehr kurz oder fehlerhaft ist, können wir ihn auch "polieren"
        if (currentTitle && currentTitle.length > 3) {
            const result = await refineText({ text: currentTitle });
            form.setValue('title', result.refinedText, { shouldValidate: true, shouldDirty: true });
        }

        toast({ title: 'KI-Veredelung erfolgreich', description: 'Rechtschreibung und Stil wurden optimiert.' });
    } catch (error) {
        console.error("Polish error:", error);
        toast({ variant: 'destructive', title: 'Fehler', description: 'KI-Verbesserung momentan nicht verfügbar.' });
    } finally {
        setIsPolishing(false);
    }
  };

  const onSubmit = async (data: Task) => {
    if (!firestore || !session) return;
    
    const isNowDone = data.status === 'done';
    const wasPreviouslyDone = taskData?.status === 'done';
    
    let completionData: Partial<Task> = {};
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

    const taskDataToSend = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    const { id, ...taskToSave } = taskDataToSend;
    const userName = session.name || 'unbekannt';

    try {
        if (isEditMode && id) {
            const taskRef = doc(firestore, 'tasks', id);
            const originalDoc = await getDoc(taskRef);
            const originalData = originalDoc.data();

            const finalData = { ...taskToSave, ...completionData, updated_at: serverTimestamp() };
            await updateDoc(taskRef, finalData);

            await generateAuditLog(firestore, 'task', id, originalData, finalData, userName, 'update');
            
            toast({
                title: 'Aufgabe aktualisiert',
                description: `Die Aufgabe "${data.title}" wurde erfolgreich aktualisiert.`,
            });
        } else {
            const finalData = {
              ...taskToSave,
              ...completionData,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
              created_by_name: session.name,
            };
            const newDocRef = await addDoc(collection(firestore, 'tasks'), finalData);
            
            await generateAuditLog(firestore, 'task', newDocRef.id, {}, finalData, userName, 'create');

            toast({
                title: 'Aufgabe gespeichert',
                description: `Die Aufgabe "${data.title}" wurde hinzugefügt.`,
            });
        }
        
        form.reset();
        onOpenChange(false);
        
    } catch (error) {
        console.error("Error saving task:", error);
        toast({
            variant: 'destructive',
            title: 'Fehler beim Speichern',
            description: "Es gab ein Problem beim Speichern der Aufgabe."
        });
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset(defaultFormValues);
    }
    onOpenChange(open);
  };
  
  const status = form.watch('status');

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full h-full flex flex-col p-0">
        <SheetHeader className="p-6 pb-2 relative">
          <div className="flex justify-between items-start pr-8">
            <div className="space-y-1">
                <SheetTitle>{isEditMode ? 'Aufgabe bearbeiten' : 'Neue Aufgabe erstellen'}</SheetTitle>
                <SheetDescription>
                    {isEditMode ? 'Aktualisieren Sie die Details der Aufgabe.' : 'Erfassen Sie alle relevanten Informationen zur neuen Aufgabe.'}
                </SheetDescription>
            </div>
            <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="absolute top-6 right-12 border-primary/30 text-primary hover:bg-primary/5 rounded-full shadow-sm animate-in fade-in zoom-in duration-500"
                onClick={handlePolishText}
                disabled={isPolishing}
            >
                {isPolishing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
                KI-Veredelung
            </Button>
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 py-4">
                      {isEditMode && (
                          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={status === 'done'}
                                  onCheckedChange={(checked) => {
                                    form.setValue('status', checked ? 'done' : 'open');
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-base font-semibold text-green-800 dark:text-green-200">
                                Als erledigt markieren
                              </FormLabel>
                            </FormItem>
                          </div>
                      )}
                      <FormField control={form.control} name="title" render={({ field }) => (
                          <FormItem><FormLabel>Titel *</FormLabel><FormControl><Input {...field} placeholder="Was ist zu tun?" /></FormControl><FormMessage /></FormItem>
                      )} />
                      
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Controller
                            control={form.control}
                            name="due_date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Fällig bis *</FormLabel>
                                <DateInput 
                                  value={field.value} 
                                  onChange={field.onChange} 
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField control={form.control} name="status" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Status *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                      <SelectContent>
                                          {Object.entries(statusTranslations).map(([key, value]) => (
                                              <SelectItem key={key} value={key}>{value}</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                           )} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="assignee_name" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Zuständig *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                          <SelectTrigger>
                                              <SelectValue placeholder={isLoadingUsers ? "Lade Benutzer..." : "Benutzer auswählen..."} />
                                          </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                          {isLoadingUsers ? (
                                              <div className="p-2 space-y-2">
                                                  <Skeleton className="h-8 w-full" />
                                                  <Skeleton className="h-8 w-full" />
                                              </div>
                                          ) : users && users.length > 0 ? (
                                              users.map(user => (
                                                  <SelectItem key={user.id} value={user.name}>{user.name}</SelectItem>
                                              ))
                                          ) : (
                                              <div className="p-2 text-sm text-muted-foreground text-center">Keine aktiven Benutzer gefunden</div>
                                          )}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                          )} />

                          <FormField control={form.control} name="vehicleId" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Fahrzeug (optional)</FormLabel>
                                  <Select
                                      onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)}
                                      value={field.value ?? 'none'}
                                  >
                                      <FormControl><SelectTrigger><SelectValue placeholder="Fahrzeug wählen..."/></SelectTrigger></FormControl>
                                      <SelectContent position="popper" className="z-[200]">
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
                      
                       <FormField control={form.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Beschreibung</FormLabel>
                            <FormControl>
                                <Textarea 
                                    {...field} 
                                    rows={8} 
                                    placeholder="Geben Sie hier Details zur Aufgabe ein. Nutzen Sie die KI-Veredelung oben rechts, um den Text zu professionalisieren." 
                                    className="resize-none"
                                />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                      )} />
                  </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 p-6 border-t bg-background">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
                <Button type="submit" disabled={form.formState.isSubmitting || isPolishing}>
                  {form.formState.isSubmitting ? 'Speichert...' : 'Aufgabe speichern'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
