'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, deleteDoc, updateDoc, serverTimestamp, Timestamp, collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { EventFormSheet, type VehicleEvent } from '@/components/events/event-form-sheet';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Mic, AlertCircle, Map as MapIcon, PlusCircle, FileDown, Loader2, Info, FolderOpen, FileUp } from 'lucide-react';
import AuditLogDisplay from '@/components/history/audit-log-display';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';
import DamageMapAuto from '@/components/damage/damage-map-auto';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AccidentSketchDisplay } from '@/components/events/accident-sketch-display';
import { AccidentSketchBuilder } from '@/components/events/accident-sketch-builder';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import Image from 'next/image';
import { generateEventPdf } from '@/lib/event-pdf';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedDocumentGrid } from '@/components/documents/unified-document-grid';
import { DocumentManager } from '@/components/documents/document-manager';

const DetailItem = ({ label, value }: { label: string; value?: React.ReactNode }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="text-base">{value}</div>
    </div>
  );
};

const formatDate = (ts: any, withTime: boolean = true) => {
  if (!ts) return '-';
  let date: Date;
  if (ts instanceof Timestamp) {
    date = ts.toDate();
  } else if (ts?.seconds !== undefined) {
    date = new Date(ts.seconds * 1000);
  } else {
    date = new Date(ts);
  }
  
  if (isNaN(date.getTime())) return '-';
  const formatString = withTime ? "dd. MMMM yyyy, HH:mm 'Uhr'" : "dd. MMMM yyyy";
  return format(date, formatString, { locale: de });
};

const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return null;
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const formatNumber = (value: number | undefined) => {
    if (value === undefined || value === null) return null;
    return value.toLocaleString('de-DE');
}

const eventTypeTranslations: Record<string, string> = {
  inspection: 'Inspektion', repair: 'Reparatur', damage: 'Schaden', verkehrsunfall: 'Verkehrsunfall',
  tuv: 'TÜV (HU)', au: 'AU', uvv: 'UVV-Prüfung', tire_change: 'Reifenwechsel',
  service: 'Service', fuel: 'Tanken', trip: 'Fahrt', other: 'Sonstiges',
};

const statusTranslations: Record<string, string> = { open: 'Offen', in_progress: 'In Bearbeitung', done: 'Erledigt' };
const statusColors: Record<string, string> = { open: 'bg-status-red', in_progress: 'bg-status-yellow text-black', done: 'bg-status-green' };
const faultTranslations: Record<string, string> = { own: 'Eigenschuld', third_party: 'Fremdschuld', unknown: 'Unbekannt' };

export default function EventDetailPage() {
  const { id } = useParams();
  const eventId = Array.isArray(id) ? id[0] : id;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  
  const { events, vehicles, drivers, isLoading: isDashboardLoading } = useDashboardData();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSketchEditorOpen, setIsSketchEditorOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);
  const vehicle = useMemo(() => vehicles.find(v => v.id === event?.vehicleId), [vehicles, event?.vehicleId]);
  const driver = useMemo(() => drivers.find(d => d.id === event?.driverId), [drivers, event?.driverId]);

  // Document counting logic
  const vDocsQ = useMemoFirebase(() => !firestore || !eventId ? null : query(collection(firestore, 'vehicle_documents'), where('relatedEntityId', '==', eventId)), [firestore, eventId]);
  const dDocsQ = useMemoFirebase(() => !firestore || !eventId ? null : query(collection(firestore, 'driver_documents'), where('relatedEntityId', '==', eventId)), [firestore, eventId]);
  const { data: vd, isLoading: isVL } = useCollection(vDocsQ);
  const { data: dd, isLoading: isDL } = useCollection(dDocsQ);
  
  const photoCount = (event?.images?.length || 0) + (event?.accident_sketch_image ? 1 : 0);
  const docCount = (vd?.length || 0) + (dd?.length || 0) + photoCount;

  const isLoading = isDashboardLoading || isVL || isDL;

  const handleDeleteEvent = async () => {
    if (!firestore || !event || !session) return;
    setIsDeleting(true);
    try {
        await generateAuditLog(firestore, 'event', event.id, event, {}, session.name, 'delete');
        await deleteDoc(doc(firestore, 'vehicle_events', event.id));
        toast({ title: 'Ereignis gelöscht', description: `"${event.title}" wurde entfernt.` });
        router.push(['damage', 'verkehrsunfall', 'other'].includes(event.type) ? '/schaeden' : '/wartung');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
        setIsDeleting(false);
    }
  };

  const handleSaveSketch = (sketchData: any[], sketchImage: string) => {
      if (!firestore || !event || !session) return;
      const eventRef = doc(firestore, 'vehicle_events', event.id);
      const updateData = { accident_sketch_data: sketchData, accident_sketch_image: sketchImage, updated_at: serverTimestamp() };

      updateDoc(eventRef, updateData)
        .then(async () => {
            await generateAuditLog(firestore, 'event', event.id, { accident_sketch_data: event.accident_sketch_data }, updateData, session.name, 'update');
            toast({ title: 'Skizze gespeichert' });
            setIsSketchEditorOpen(false);
        })
        .catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: eventRef.path, operation: 'update', requestResourceData: updateData }));
        });
  };

  const handleDownloadPdf = async () => {
    if (!event || !vehicle) return;
    setIsGeneratingPdf(true);
    try {
        await generateEventPdf({
            ...event,
            vehiclePlate: vehicle.license_plate,
            vehicleDetails: `${vehicle.make} ${vehicle.model}`,
            driverName: driver ? `${driver.first_name} ${driver.last_name}` : 'Unbekannt'
        });
    } catch (e) {
        console.error("PDF generation failed:", e);
        toast({ variant: 'destructive', title: 'Fehler', description: 'PDF konnte nicht erstellt werden.' });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  if (isLoading && !event) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <div className="space-y-6"><Card><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">{Array.from({ length: 8 }).map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-6 w-2/3" /></div>))}</CardContent></Card></div>
      </div>
    );
  }

  if (!event) return <div>Ereignis nicht gefunden.</div>;
  
  const isAccident = event.type === 'verkehrsunfall';
  const isDamageEvent = ['damage', 'verkehrsunfall'].includes(event.type);
  const isDone = event.status === 'done';
  const isVoiceCreated = (event as any).created_via === 'voice';

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">{event.title}{isVoiceCreated && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1"><Mic className="h-3 w-3" /> KI-Erfasst</Badge>}</h1>
            <p className="text-xl text-muted-foreground">{eventTypeTranslations[event.type] || event.type}</p>
        </div>
         <div className="flex gap-2 flex-shrink-0">
             <Button variant="outline" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Export (PDF)
             </Button>
             <Button variant="outline" onClick={() => setIsSheetOpen(true)}><Pencil className="mr-2 h-4 w-4" />Bearbeiten</Button>
            <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Löschen</Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle><AlertDialogDescription>Das Ereignis "{event.title}" wird endgültig gelöscht.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteEvent} disabled={isDeleting}>{isDeleting ? 'Lösche...' : 'Endgültig löschen'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
      </div>

      {isVoiceCreated && <Alert className="bg-amber-50 border-amber-200 text-amber-800"><AlertCircle className="h-4 w-4" /><AlertTitle>KI-generierter Entwurf</AlertTitle><AlertDescription>Prüfen Sie insbesondere Kilometerstand, Kosten und Datum.</AlertDescription></Alert>}
      
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="mb-4">
            <TabsTrigger value="info"><Info className="h-4 w-4 mr-2" /> Details</TabsTrigger>
            <TabsTrigger value="documents" className="relative">
                <FolderOpen className="h-4 w-4 mr-2" /> Dokumente & Anhänge
                {docCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                        {docCount}
                    </Badge>
                )}
            </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Details zum Vorfall</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                        <DetailItem label="Datum" value={formatDate(event.due_date)} />
                        <DetailItem label="Status" value={<Badge className={cn('text-white', statusColors[event.status])}>{statusTranslations[event.status] || event.status}</Badge>} />
                        <DetailItem label="Kosten" value={formatCurrency(event.cost_eur)} />
                        <DetailItem label="Kilometerstand" value={`${formatNumber(event.odometer_km)} km`} />
                        <DetailItem label="Werkstatt / Dienstleister" value={event.vendor} />
                        {driver && <DetailItem label="Fahrer" value={<Link href={`/fahrer/${driver.id}`} className="text-primary hover:underline">{driver.first_name} {driver.last_name}</Link>} />}
                        <DetailItem label="Schuldfrage" value={event.fault ? faultTranslations[event.fault] : '-'} />
                        <DetailItem label="Polizei involviert" value={event.police_involved ? 'Ja' : 'Nein'} />
                        {event.police_involved && <DetailItem label="Aktenzeichen" value={event.police_case_number} />}
                        <DetailItem label="Erstellt von" value={event.created_by_name || '-'} />
                        {isDone && event.completed_by_name && <DetailItem label="Erledigt von" value={event.completed_by_name} />}
                        {isDone && event.completed_at && <DetailItem label="Erledigt am" value={formatDate(event.completed_at, true)} />}
                    </CardContent>
                </Card>

                <Card><CardHeader><CardTitle>Zugehöriges Fahrzeug</CardTitle></CardHeader><CardContent>{vehicle ? <Link href={`/fahrzeuge/${vehicle.id}`}><div className="flex justify-between items-center p-3 rounded-md border hover:bg-accent transition-colors"><div><p className="font-semibold">{vehicle.make} {vehicle.model}</p><p className="text-sm text-muted-foreground">{vehicle.license_plate}</p></div></div></Link> : <p className="text-sm text-muted-foreground">Keine Infos verfügbar.</p>}</CardContent></Card>

                {isAccident && (
                    <div className="space-y-6">
                        {event.accident_sketch_image ? <AccidentSketchDisplay imageUrl={event.accident_sketch_image} eventTitle={event.title} vehiclePlate={vehicle?.license_plate || 'Unbekannt'} onEdit={() => setIsSketchEditorOpen(true)} /> : (
                            <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2"><MapIcon className="h-5 w-5 text-primary" />Unfallskizze erstellen</CardTitle><CardDescription>Grafische Darstellung für die Versicherung.</CardDescription></CardHeader><CardContent><Button onClick={() => setIsSketchEditorOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Jetzt Skizze erstellen</Button></CardContent></Card>
                        )}
                    </div>
                )}

                {event.images && event.images.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Fotodokumentation</CardTitle>
                            <CardDescription>{event.images.length} Bilder erfasst.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {event.images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border shadow-sm group hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => window.open(img, '_blank')}>
                                        <Image src={img} alt={`Schadensfoto ${idx + 1}`} fill className="object-cover" />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isAccident && event.third_party && (
                    <Card><CardHeader><CardTitle>Daten des Unfallgegners</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8"><DetailItem label="Name" value={`${event.third_party.first_name || ''} ${event.third_party.last_name || ''}`.trim()} /><DetailItem label="Telefon" value={event.third_party.phone} /><DetailItem label="Kennzeichen" value={event.third_party.license_plate} /><DetailItem label="Fahrzeug" value={event.third_party.vehicle_details} /><DetailItem label="Versicherung" value={event.third_party.insurance_company} /><DetailItem label="Versicherungsnummer" value={event.third_party.insurance_policy_number} /></CardContent></Card>
                )}

                {event.notes && <Card><CardHeader><CardTitle>Notizen & Analyse</CardTitle></CardHeader><CardContent><p className="text-base whitespace-pre-wrap">{event.notes}</p></CardContent></Card>}
                {isDamageEvent && <DamageMapAuto />}
                {eventId && <AuditLogDisplay entityId={eventId} entityType='event' />}
            </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-primary/10">
                <div>
                    <h3 className="font-bold text-sm">Dokumente zum Ereignis</h3>
                    <p className="text-xs text-muted-foreground">Fügen Sie Gutachten, Rechnungen oder weitere Fotos hinzu.</p>
                </div>
                <Button onClick={() => setIsUploadDialogOpen(true)} className="rounded-xl h-10">
                    <FileUp className="mr-2 h-4 w-4" /> Dokument hinzufügen
                </Button>
            </div>
            
            <UnifiedDocumentGrid relatedEntityId={eventId} />
        </TabsContent>
      </Tabs>
    </div>

    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Dokument für dieses Ereignis hochladen</DialogTitle></DialogHeader>
            <DocumentManager 
                entityId={event?.vehicleId || undefined} 
                entityType="vehicle" 
                relatedEntityId={eventId}
                relatedEntityType="event"
                onClose={() => setIsUploadDialogOpen(false)} 
            />
        </DialogContent>
    </Dialog>

    <Dialog open={isSketchEditorOpen} onOpenChange={setIsSketchEditorOpen}><DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full flex flex-col p-0 border-none shadow-2xl"><DialogHeader className="p-6 border-b bg-muted/30"><DialogTitle>Unfallskizze Editor</DialogTitle></DialogHeader><div className="flex-1 overflow-hidden p-6"><AccidentSketchBuilder initialData={event.accident_sketch_data} onSave={handleSaveSketch} onCancel={() => setIsSketchEditorOpen(false)} /></div></DialogContent></Dialog>
    <EventFormSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} eventData={event as any} allowedEventTypes={[event.type]} title="Ereignis bearbeiten" description="Aktualisieren Sie die Details dieses Ereignisses." />
    </>
  );
}
