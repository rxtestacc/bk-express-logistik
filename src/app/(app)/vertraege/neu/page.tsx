'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Timestamp, collection, serverTimestamp, query, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { generateAuditLog } from '@/lib/audit-log';
import { extractContractData } from '@/ai/flows/extract-contract-data-flow';
import type { Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import DateInput from '@/components/ui/DateInput';
import { Loader2, UploadCloud, Wand2, X, CheckCircle2, Keyboard, Car, Euro, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const timestampOrDate = z.any().optional().nullable();

const contractFormSchema = z.object({
  contractType: z.enum(['leasing', 'financing', 'purchase', 'warranty', 'maintenance', 'insurance', 'other']),
  providerName: z.string().min(1, "Vertragspartner ist erforderlich."),
  contractNumber: z.string().optional().nullable(),
  startDate: timestampOrDate,
  endDate: timestampOrDate,
  cancellationDeadline: timestampOrDate,
  monthlyCostEur: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().optional().nullable()),
  yearlyCostEur: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().optional().nullable()),
  oneTimeCostEur: z.preprocess((val) => (val === '' || val === null ? null : val), z.coerce.number().optional().nullable()),
  responsibleName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
type ContractFormData = z.infer<typeof contractFormSchema>;

const defaultFormValues: Partial<ContractFormData> = {
    contractType: 'leasing',
    providerName: '',
    contractNumber: '',
    startDate: null,
    endDate: null,
    cancellationDeadline: null,
    monthlyCostEur: null,
    yearlyCostEur: null,
    oneTimeCostEur: null,
    responsibleName: '',
    notes: '',
};

type ViewState = 'selection' | 'upload' | 'manual';

const contractTypeTranslations: { [key: string]: string } = {
  leasing: 'Leasing', financing: 'Finanzierung', purchase: 'Kauf', warranty: 'Garantie',
  maintenance: 'Wartung', insurance: 'Versicherung', other: 'Sonstiges',
};

export default function NewContractPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();

  const [viewState, setViewState] = useState<ViewState>('selection');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [matchedVehicleId, setMatchedVehicleId] = useState<string | null>(null);

  const form = useForm<ContractFormData>({ 
    resolver: zodResolver(contractFormSchema), 
    defaultValues: defaultFormValues as ContractFormData 
  });

  const { data: vehicles } = useCollection<Vehicle>(
    useMemoFirebase(() => firestore ? query(collection(firestore, 'vehicles')) : null, [firestore])
  );

  const onSubmit = async (data: ContractFormData) => {
    if (!firestore || !session) return;
    setIsProcessing(true);
    
    try {
      let documentRefData = null;
      
      if (uploadedFile) {
          const storagePath = `contracts/${Date.now()}_${uploadedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          
          setUploadProgress(10); 

          const formData = new FormData();
          formData.append('file', uploadedFile);
          formData.append('path', storagePath);

          const response = await fetch('/api/upload', {
              method: 'POST',
              body: formData
          });

          const result = await response.json();
          if (!result.success) {
              throw new Error(result.error || 'Server-Upload fehlgeschlagen.');
          }

          setUploadProgress(100);
          documentRefData = { 
              fileName: uploadedFile.name, 
              fileType: uploadedFile.type.includes('pdf') ? 'pdf' : 'image', 
              downloadUrl: result.downloadUrl,
              storagePath: result.path
          };
      }

      const toTs = (v: any) => {
          if (!v) return null;
          if (v instanceof Timestamp) return v;
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
      };

      const payload: any = {
        ...data,
        startDate: toTs(data.startDate),
        endDate: toTs(data.endDate),
        cancellationDeadline: toTs(data.cancellationDeadline),
        vehicleId: matchedVehicleId || null,
        contractStatus: 'active',
        matchStatus: matchedVehicleId ? 'verified' : 'unverified',
        summary: analysisResult?.summary || data.notes || '',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        createdByName: session.name,
        currency: 'EUR'
      };

      if (documentRefData) payload.documentRef = documentRefData;

      const newRef = doc(collection(firestore, 'contracts'));
      await setDoc(newRef, payload);
      
      generateAuditLog(firestore, 'contract', newRef.id, {}, payload, session.name, 'create');
      
      toast({ title: "Erfolg", description: "Vertrag wurde gespeichert." });
      router.push('/vertraege');
    } catch (error: any) {
      console.error("Save Error:", error);
      toast({ variant: 'destructive', title: "Fehler", description: error.message || "Speichern fehlgeschlagen." });
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile) return;
    setIsProcessing(true);
    setMatchedVehicleId(null);

    try {
      const dataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(uploadedFile);
      });

      const response = await extractContractData({ photoDataUris: [dataUri] });
      
      if (response.data) {
        setAnalysisResult(response.data);
        const res = response.data;
        
        form.reset({
            ...defaultFormValues,
            contractType: (res.contractType as any) || 'leasing',
            providerName: res.providerName || '',
            contractNumber: res.contractNumber || '',
            monthlyCostEur: res.monthlyCostEur || null,
            yearlyCostEur: res.yearlyCostEur || null,
            oneTimeCostEur: res.oneTimeCostEur || null,
            responsibleName: res.responsibleName || '',
            startDate: res.startDate ? Timestamp.fromDate(new Date(res.startDate)) : null,
            endDate: res.endDate ? Timestamp.fromDate(new Date(res.endDate)) : null,
            cancellationDeadline: res.cancellationDeadline ? Timestamp.fromDate(new Date(res.cancellationDeadline)) : null,
            notes: res.summary || '',
        });

        if (vehicles && (res.vin || res.licensePlate)) {
            const searchVin = res.vin?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const searchPlate = res.licensePlate?.replace(/[^a-z0-9]/gi, '').toUpperCase();

            const foundVehicle = vehicles.find(v => {
                const vVin = v.vin?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                const vPlate = v.license_plate?.replace(/[^a-z0-9]/gi, '').toUpperCase();
                return (searchVin && vVin === searchVin) || (searchPlate && vPlate.includes(searchPlate));
            });

            if (foundVehicle) {
                setMatchedVehicleId(foundVehicle.id);
                toast({ title: "Fahrzeug erkannt", description: `Zugeordnet zu ${foundVehicle.license_plate}` });
            }
        }
      }
    } catch (e) {
        console.error("Analysis Error:", e);
        toast({ variant: 'destructive', title: "Analyse-Fehler" });
    } finally { 
        setIsProcessing(false); 
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 px-4 md:px-0">
      <h1 className="text-3xl font-black tracking-tight">Neuer Vertrag</h1>
      
      {viewState === 'selection' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer border-2 hover:border-primary group transition-all" onClick={() => setViewState('upload')}>
              <CardContent className="p-10 text-center space-y-4">
                <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto group-hover:bg-primary/20 transition-colors">
                    <Wand2 className="h-12 w-12 text-primary" />
                </div>
                <div>
                    <p className="text-xl font-black tracking-tight">Datei-Upload & KI-Analyse</p>
                    <p className="text-sm text-muted-foreground mt-1">Lassen Sie die KI alle Felder automatisch ausfüllen.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer border-2 hover:border-primary group transition-all" onClick={() => setViewState('manual')}>
              <CardContent className="p-10 text-center space-y-4">
                <div className="p-4 bg-muted rounded-2xl w-fit mx-auto group-hover:bg-accent transition-colors">
                    <Keyboard className="h-12 w-12 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-xl font-black tracking-tight">Manuelle Eingabe</p>
                    <p className="text-sm text-muted-foreground mt-1">Geben Sie die Vertragsdaten von Hand ein.</p>
                </div>
              </CardContent>
            </Card>
          </div>
      ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => setViewState('selection')} className="font-bold">
                        <X className="mr-2 h-4 w-4" /> Abbrechen & Zurück
                    </Button>
                </div>

                {viewState === 'upload' && (
                    <Card className="border-2 border-dashed border-primary/20">
                        <CardContent className="p-6 space-y-4">
                            {!uploadedFile ? (
                                <label className="flex flex-col items-center justify-center w-full h-40 cursor-pointer bg-muted/30 hover:bg-primary/5 rounded-2xl transition-all">
                                    <UploadCloud className="h-10 w-10 mb-2 text-primary/60" />
                                    <span className="text-base font-bold">Vertrag (PDF oder Bild) auswählen</span>
                                    <p className="text-xs text-muted-foreground mt-1">Klicken oder hierher ziehen</p>
                                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && setUploadedFile(e.target.files[0])} />
                                </label>
                            ) : (
                                <div className="flex items-center justify-between p-5 bg-primary/5 rounded-2xl border border-primary/10">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-primary" />
                                        <span className="font-bold truncate max-w-[200px]">{uploadedFile.name}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => { setUploadedFile(null); setAnalysisResult(null); }} disabled={isProcessing} className="rounded-full">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                            {uploadedFile && !analysisResult && (
                                <Button type="button" onClick={handleAnalyze} disabled={isProcessing} className="w-full h-14 rounded-xl text-lg font-black shadow-lg">
                                    {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />} KI Analyse jetzt starten
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}

                {(analysisResult || viewState === 'manual' || (viewState === 'upload' && uploadedFile)) && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2">
                        <Card className="border-primary/10 shadow-lg">
                            <CardHeader className="bg-muted/30 border-b">
                                <p className="text-xs font-black uppercase tracking-widest text-primary">Vertragsdetails</p>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="contractType" render={({ field }) => ( <FormItem><FormLabel className="font-bold">Vertragsart *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl><SelectContent position="popper" className="z-[200]">{Object.entries(contractTypeTranslations).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></FormItem> )} />
                                <FormField control={form.control} name="providerName" render={({ field }) => ( <FormItem><FormLabel className="font-bold">Vertragspartner (Bank/Leasing/Vers.) *</FormLabel><FormControl><Input className="h-12 rounded-xl" {...field} /></FormControl></FormItem> )} />
                                <FormField control={form.control} name="contractNumber" render={({ field }) => ( <FormItem><FormLabel className="font-bold">Vertragsnummer</FormLabel><FormControl><Input className="h-12 rounded-xl" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                <FormField control={form.control} name="responsibleName" render={({ field }) => ( <FormItem><FormLabel className="font-bold flex items-center gap-2"><User className="h-3 w-3" /> Zuständiger Ansprechpartner</FormLabel><FormControl><Input className="h-12 rounded-xl" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                
                                <div className="space-y-4 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Controller control={form.control} name="startDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel className="font-bold">Beginn</FormLabel><DateInput value={field.value} onChange={field.onChange} /></FormItem> )} />
                                    <Controller control={form.control} name="endDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel className="font-bold">Enddatum</FormLabel><DateInput value={field.value} onChange={field.onChange} /></FormItem> )} />
                                    <Controller control={form.control} name="cancellationDeadline" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel className="font-bold">Kündigungsfrist</FormLabel><DateInput value={field.value} onChange={field.onChange} /></FormItem> )} />
                                </div>

                                <div className="md:col-span-2 pt-4 border-t mt-2">
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 font-bold">
                                            Zugehöriges Fahrzeug
                                            {matchedVehicleId && <Badge className="bg-status-green text-white h-5 px-2 rounded-lg font-black uppercase text-[10px]"><Car className="h-3 w-3 mr-1"/> KI Treffer</Badge>}
                                        </FormLabel>
                                        <Select value={matchedVehicleId || 'none'} onValueChange={(v) => setMatchedVehicleId(v === 'none' ? null : v)}>
                                            <SelectTrigger className={cn("h-12 rounded-xl", matchedVehicleId && "border-status-green ring-status-green/20")}>
                                                <SelectValue placeholder="Fahrzeug wählen..." />
                                            </SelectTrigger>
                                            <SelectContent position="popper" className="z-[200]">
                                                <SelectItem value="none">Kein Fahrzeug zugeordnet</SelectItem>
                                                {vehicles?.map(v => <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make} {v.model})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/10 shadow-lg">
                            <CardHeader className="bg-muted/30 border-b">
                                <p className="text-xs font-black uppercase tracking-widest text-primary">Kostenaufstellung & Notizen</p>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField control={form.control} name="monthlyCostEur" render={({ field }) => ( <FormItem><FormLabel className="font-bold flex items-center gap-2"><Euro className="h-3 w-3" /> Monatlich (€)</FormLabel><FormControl><Input className="h-12 rounded-xl" type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                <FormField control={form.control} name="yearlyCostEur" render={({ field }) => ( <FormItem><FormLabel className="font-bold">Jährlich (€)</FormLabel><FormControl><Input className="h-12 rounded-xl" type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                <FormField control={form.control} name="oneTimeCostEur" render={({ field }) => ( <FormItem><FormLabel className="font-bold">Einmalig (€)</FormLabel><FormControl><Input className="h-12 rounded-xl" type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl></FormItem> )} />
                                
                                <div className="md:col-span-3">
                                    <FormField control={form.control} name="notes" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">Notizen / KI-Zusammenfassung</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} rows={10} className="rounded-xl resize-none font-mono text-xs leading-relaxed" /></FormControl></FormItem>
                                    )} />
                                </div>
                            </CardContent>
                        </Card>

                        {uploadProgress > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                    <span>Übertragung</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <Progress value={uploadProgress} className="h-2 rounded-full" />
                            </div>
                        )}

                        <Button type="submit" disabled={isProcessing} className="w-full h-20 text-xl font-black rounded-2xl shadow-xl transition-all active:scale-95">
                            {isProcessing ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle2 className="mr-3 h-6 w-6" />} 
                            {isProcessing ? 'Verarbeite Daten...' : 'Vertrag endgültig speichern'}
                        </Button>
                    </div>
                )}
            </form>
          </Form>
      )}
    </div>
  );
}
