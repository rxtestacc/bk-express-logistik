'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  userId: z.string().min(1, 'Benutzer ist erforderlich'),
  pin: z.string().min(1, 'PIN ist erforderlich'),
});

type PinLoginFormData = z.infer<typeof formSchema>;

interface PinUser {
  id: string;
  name: string;
  role: string;
}

interface ActionPincodeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function ActionPincodeDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: ActionPincodeDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { setSession } = useSession();
  const [isChecking, setIsChecking] = useState(false);

  // Stabile Abfrage
  const pinsQuery = useMemoFirebase(() => {
    if (!firestore || !isOpen) return null;
    return query(collection(firestore, 'pins'), where('active', '==', true));
  }, [firestore, isOpen]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<PinUser>(pinsQuery);

  const form = useForm<PinLoginFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: '',
      pin: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
        form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = async (data: PinLoginFormData) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'System nicht bereit' });
      return;
    }
    setIsChecking(true);
    try {
      const q = query(
        collection(firestore, 'pins'),
        where('__name__', '==', data.userId),
        where('pin', '==', data.pin),
        where('active', '==', true)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: 'PIN oder Benutzer ungültig.',
        });
      } else {
        const pinData = querySnapshot.docs[0].data();
        setSession({ name: pinData.name, role: pinData.role });
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('PIN check error:', error);
      toast({
        variant: 'destructive',
        title: 'Systemfehler',
        description: 'Zugang konnte nicht geprüft werden.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
          "sm:max-w-md",
          "top-[15%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]"
      )}>
        <DialogHeader>
          <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">Identifizierung</DialogTitle>
          <DialogDescription className="text-center">
            Bitte wählen Sie Ihren Namen und geben Sie Ihre PIN ein.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
             <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Benutzer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isChecking || isLoadingUsers}>
                    <FormControl>
                      <SelectTrigger className="h-12 rounded-xl text-base bg-background">
                        <SelectValue placeholder={isLoadingUsers ? "Lade Benutzer..." : "Wählen Sie Ihren Namen"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper" sideOffset={4} className="z-[150]">
                      {users?.map(user => (
                        <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">PIN</FormLabel>
                  <FormControl>
                    <Input 
                        type="password" 
                        inputMode="numeric" 
                        pattern="[0-9]*" 
                        placeholder="Ihre PIN" 
                        className="h-12 rounded-xl text-center text-xl tracking-[0.5em] bg-background" 
                        {...field} 
                        disabled={isChecking}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex flex-col gap-2">
                <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-black shadow-lg" disabled={isChecking || isLoadingUsers || !firestore}>
                    {isChecking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'BESTÄTIGEN'}
                </Button>
                <Button type="button" variant="ghost" className="w-full h-10 font-bold text-muted-foreground" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
