'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Lock, User, ShieldCheck, Truck, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  userId: z.string().min(1, 'Benutzer ist erforderlich'),
  pin: z.string().min(1, 'PIN ist erforderlich'),
  rememberMe: z.boolean().default(false),
});

type PinLoginFormData = z.infer<typeof formSchema>;

interface PinUser {
  id: string;
  name: string;
  role: string;
}

export default function PinGate() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { setSession } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const appLogo = PlaceHolderImages.find(img => img.id === 'app-logo')?.imageUrl || 'https://picsum.photos/seed/bklogo/200/200';
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-dashboard')?.imageUrl || 'https://picsum.photos/seed/fleet/1200/800';

  useEffect(() => {
    setMounted(true);
  }, []);

  const pinsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pins'), where('active', '==', true));
  }, [firestore]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<PinUser>(pinsQuery);

  const form = useForm<PinLoginFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: '',
      pin: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: PinLoginFormData) => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Datenbankverbindung nicht bereit.' });
        return;
    }
    setIsLoading(true);
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
        setIsLoading(false);
        return;
      }

      const pinData = querySnapshot.docs[0].data();
      setSession({ name: pinData.name, role: pinData.role }, data.rememberMe);
      toast({ title: 'Erfolg', description: 'Anmeldung erfolgreich.' });
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Ein unerwarteter Fehler ist aufgetreten.' });
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-background">
      {/* Left Column: Visual Branding (Hidden on mobile) */}
      <div className="hidden lg:flex relative bg-sidebar overflow-hidden">
        <div className="absolute inset-0 z-0">
            <Image 
                src={heroImage} 
                alt="Fleet Background" 
                fill 
                className="object-cover opacity-40 grayscale-[0.2]"
                priority
                data-ai-hint="logistics fleet"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar/80 to-primary/20" />
        </div>
        
        <div className="relative z-10 p-16 flex flex-col justify-between h-full w-full">
            <div className="flex items-center gap-6 animate-in fade-in slide-in-from-left-4 duration-700">
                <div className="h-24 w-24 relative bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/10 shadow-2xl">
                    <Image src={appLogo} alt="Logo" fill className="object-contain p-1" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter">BK-Express</h2>
                    <p className="text-[11px] uppercase font-bold tracking-[0.2em] text-white/50">Fleet Control Center</p>
                </div>
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                <div className="space-y-2">
                    <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
                        Intelligenz für <br/> 
                        <span className="text-primary italic">Ihren Fuhrpark.</span>
                    </h1>
                    <p className="text-xl text-white/60 max-w-md font-medium leading-relaxed">
                        Die zentrale Plattform für Fahrzeuge, Fahrer und Verträge – vernetzt, automatisiert und KI-gestützt.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-6 pt-8 border-t border-white/10">
                    <div className="space-y-1">
                        <p className="text-3xl font-black text-white">100%</p>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Digitalisiert</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-3xl font-black text-white">24/7</p>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Echtzeit-Daten</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                <span>Automatisierte Dokumentenprüfung</span>
                <span className="h-1 w-1 bg-white/20 rounded-full" />
                <span>KI-Schadensanalyse</span>
            </div>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="flex flex-col items-center justify-center p-6 md:p-12 relative">
        {/* Mobile Header */}
        <div className="lg:hidden flex flex-col items-center mb-12 animate-in fade-in zoom-in duration-700">
            <div className="h-48 w-48 relative mb-2">
                <Image src={appLogo} alt="Logo" fill className="object-contain" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-60 -mt-4">Fuhrparkmanagement</p>
        </div>

        <div className="w-full max-w-[400px] space-y-10 animate-in fade-in slide-in-from-right-8 duration-700">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-black tracking-tight">Willkommen</h2>
            <p className="text-muted-foreground font-medium">Bitte identifizieren Sie sich für den Zugriff.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                        <User className="h-3 w-3 text-primary" /> Benutzer wählen
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading || isLoadingUsers}
                    >
                      <FormControl>
                        <SelectTrigger className="h-14 rounded-2xl text-base shadow-sm border-primary/10 bg-muted/30 focus:ring-primary/20">
                          <SelectValue placeholder={isLoadingUsers ? "Lade Benutzer..." : "Name auswählen"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.map(user => (
                          <SelectItem key={user.id} value={user.id} className="font-medium">{user.name}</SelectItem>
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
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                        <Lock className="h-3 w-3 text-primary" /> PIN-Code eingeben
                    </FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="••••••"
                          className="h-14 rounded-2xl text-center text-2xl tracking-[0.5em] shadow-sm border-primary/10 bg-muted/30 focus:ring-primary/20 group-hover:border-primary/30 transition-colors"
                          {...field}
                          disabled={isLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between px-1">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                          className="rounded-md"
                        />
                      </FormControl>
                      <FormLabel className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground cursor-pointer select-none">
                        Angemeldet bleiben
                      </FormLabel>
                    </FormItem>
                  )}
                />
                
                <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest opacity-60">
                    <ShieldCheck className="h-3 w-3" />
                    Secure Access
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-16 rounded-2xl text-lg font-black shadow-xl bg-primary hover:bg-primary/90 transition-all active:scale-[0.98] group" 
                disabled={isLoading || isLoadingUsers || !firestore}
              >
                {isLoading || isLoadingUsers ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                    <>
                        ZUGANG PRÜFEN
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-8 text-center space-y-4">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.2em] leading-relaxed">
                BK-Express Fuhrpark-System <br/>
                &copy; {new Date().getFullYear()} Alle Rechte vorbehalten
            </p>
            <div className="flex items-center justify-center gap-4 opacity-20">
                <Truck className="h-4 w-4" />
                <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
