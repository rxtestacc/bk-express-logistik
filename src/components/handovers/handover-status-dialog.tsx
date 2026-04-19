'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { generateAuditLog } from '@/lib/audit-log';
import { useEffect } from 'react';

// Assuming Handover type is available
interface Handover {
  id: string;
  status: 'draft' | 'completed' | 'new_damage' | 'in_review' | 'closed';
  // other fields...
}

interface HandoverStatusDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  handover: Handover | null;
}

const statusChangeSchema = z.object({
  status: z.enum(['completed', 'new_damage', 'in_review', 'closed']),
  statusNotes: z.string().optional(),
});

type StatusChangeFormData = z.infer<typeof statusChangeSchema>;

const statusOptions: Record<StatusChangeFormData['status'], string> = {
  new_damage: 'Neuer Schaden',
  in_review: 'In Prüfung',
  completed: 'Abgeschlossen',
  closed: 'Archiviert',
};

export function HandoverStatusDialog({ isOpen, onOpenChange, handover }: HandoverStatusDialogProps) {
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();

  const form = useForm<StatusChangeFormData>({
    resolver: zodResolver(statusChangeSchema),
  });

  useEffect(() => {
    if (handover) {
      form.reset({
        status: handover.status === 'draft' ? 'completed' : handover.status,
        statusNotes: '',
      });
    }
  }, [handover, form, isOpen]);

  const onSubmit = async (data: StatusChangeFormData) => {
    if (!firestore || !session || !handover) return;

    try {
      const handoverRef = doc(firestore, 'vehicle_handovers', handover.id);
      const updateData = {
        status: data.status,
        statusNotes: data.statusNotes || null,
        updatedAt: serverTimestamp(),
      };
      
      const originalData = { status: handover.status };
      const newData = { status: data.status, statusNotes: data.statusNotes };

      await updateDoc(handoverRef, updateData);
      
      await generateAuditLog(
        firestore,
        'handover',
        handover.id,
        originalData,
        newData,
        session.name,
        'update'
      );

      toast({
        title: 'Status aktualisiert',
        description: 'Der Status der Übergabe wurde erfolgreich geändert.',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating handover status:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Aktualisieren',
        description: 'Der Status konnte nicht geändert werden.',
      });
    }
  };

  if (!handover) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status der Übergabe ändern</DialogTitle>
          <DialogDescription>
            Ändern Sie den aktuellen Status des Übergabeprotokolls.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Neuer Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Status auswählen..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(statusOptions).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notiz (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Fügen Sie eine kurze Notiz zur Statusänderung hinzu..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Speichert...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
