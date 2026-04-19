'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, deleteDoc, collection, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Euro, Pencil, Trash2, Info, FileText, History, FileUp } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
import { DriverFormSheet, type Driver } from '@/components/drivers/driver-form-sheet';
import AuditLogDisplay from '@/components/history/audit-log-display';
import DriverHistory from '@/components/drivers/driver-history';
import { EventFormSheet, VehicleEvent } from '@/components/events/event-form-sheet';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentManager } from '@/components/documents/document-manager';
import { UnifiedDocumentGrid } from '@/components/documents/unified-document-grid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const DetailItem = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode, icon?: React.ElementType }) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null;
    return (
        <div>
            <p className="text-sm font-medium text-muted-foreground flex items-center">{Icon && <Icon className="h-4 w-4 mr-2" />}{label}</p>
            <p className="text-base">{value}</p>
        </div>
    );
};

const formatCurrency = (value: number) => value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const formatDate = (ts: any) => {
    if (!ts) return null;
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(date, 'dd.MM.yyyy');
};

export default function DriverDetailPage() {
  const { id } = useParams();
  const driverId = Array.isArray(id) ? id[0] : id;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  
  const { drivers, vehicles, events, handovers, isLoading: isDashboardLoading } = useDashboardData();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VehicleEvent | undefined>(undefined);

  const driver = useMemo(() => drivers.find(d => d.id === driverId), [drivers, driverId]);
  const assignedVehicles = useMemo(() => vehicles.filter(v => driver?.assigned_vehicle_ids?.includes(v.id)), [vehicles, driver?.assigned_vehicle_ids]);
  const driverEvents = useMemo(() => events.filter(e => e.driverId === driverId), [events, driverId]);
  
  const totalCosts = useMemo(() => driverEvents.reduce((sum, event) => sum + (event.cost_eur || 0), 0), [driverEvents]);

  // Document counting logic
  const dDocsQ = useMemoFirebase(() => !firestore || !driverId ? null : query(collection(firestore, 'driver_documents'), where('driverId', '==', driverId)), [firestore, driverId]);
  const { data: dd, isLoading: isDL } = useCollection(dDocsQ);
  
  const docCount = useMemo(() => {
    const directDocs = dd?.length || 0;
    const eventFiles = driverEvents.reduce((a, e) => a + (e.images?.length || 0) + (e.accident_sketch_image ? 1 : 0), 0);
    const handoverFiles = handovers.filter(h => h.fromDriverId === driverId || h.toDriverId === driverId).reduce((a, h) => {
        let c = 0;
        if (h.requiredPhotos) c += Object.values(h.requiredPhotos).filter((p: any) => p.status === 'added').length;
        if (h.additionalPhotos) c += h.additionalPhotos.length;
        return a + c;
    }, 0);
    return directDocs + eventFiles + handoverFiles;
  }, [dd, driverEvents, handovers, driverId]);

  const historyCount = driverEvents.length;

  const isLoading = isDashboardLoading || isDL;

  const handleDeleteDriver = async () => {
    if (!firestore || !driver || !session) return;
    setIsDeleting(true);
    try {
        await generateAuditLog(firestore, 'driver', driver.id, driver, {}, session.name, 'delete');
        await deleteDoc(doc(firestore, 'drivers', driver.id));
        toast({ title: 'Fahrer gelöscht' });
        router.push('/fahrer');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
        setIsDeleting(false);
    }
  };

  if (isLoading && !driver) {
    return (
      <div className="space-y-6"><Skeleton className="h-10 w-1/3" /><Card><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">{Array.from({ length: 9 }).map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-6 w-2/3" /></div>))}</CardContent></Card></div>
    );
  }

  if (!driver) return <div>Fahrer nicht gefunden.</div>;

  return (
    <>
    <div className="space-y-6">
        <div className="flex justify-between items-start gap-4">
            <div><h1 className="text-3xl font-bold">{driver.first_name} {driver.last_name}</h1></div>
             <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" onClick={() => setIsSheetOpen(true)}><Pencil className="mr-2 h-4 w-4" />Bearbeiten</Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Löschen</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Fahrer löschen?</AlertDialogTitle><AlertDialogDescription>Der Datensatz wird unwiderruflich entfernt.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteDriver} disabled={isDeleting}>Endgültig löschen</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
      
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="mb-4">
            <TabsTrigger value="info"><Info className="h-4 w-4 mr-2" /> Infos</TabsTrigger>
            <TabsTrigger value="documents" className="relative">
                <FileText className="h-4 w-4 mr-2" /> Dokumente
                {docCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                        {docCount}
                    </Badge>
                )}
            </TabsTrigger>
            <TabsTrigger value="history" className="relative">
                <History className="h-4 w-4 mr-2" /> Historie
                {historyCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                        {historyCount}
                    </Badge>
                )}
            </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Persönliche Daten</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">
                    <DetailItem label="Vollständiger Name" value={`${driver.first_name} ${driver.last_name}`} />
                    <DetailItem label="Geburtsdatum" value={formatDate(driver.birth_date)} />
                    <DetailItem label="Angestellt seit" value={formatDate(driver.employment_start_date)} />
                    <DetailItem label="Zusteller" value={driver.carrier} />
                    <DetailItem label="Gesamtkosten" value={totalCosts > 0 ? formatCurrency(totalCosts) : '0,00 €'} icon={Euro} />
                </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Kontakt & Adresse</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8"><DetailItem label="E-Mail" value={driver.email} /><DetailItem label="Telefon" value={driver.phone} />{driver.address && <DetailItem label="Adresse" value={`${driver.address.street}, ${driver.address.zip} ${driver.address.city}`} />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Führerschein</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8"><DetailItem label="Nummer" value={driver.license_number} /><DetailItem label="Gültig bis" value={formatDate(driver.license_expiry_date)} /><DetailItem label="Klassen" value={driver.license_classes.join(', ')} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Zugewiesene Fahrzeuge</CardTitle></CardHeader><CardContent>{assignedVehicles.length > 0 ? (<ul className="space-y-3">{assignedVehicles.map(v => (<li key={v.id}><Link href={`/fahrzeuge/${v.id}`}><div className="flex justify-between items-center p-3 rounded-md border hover:bg-accent transition-colors"><div><p className="font-semibold">{v.make} {v.model}</p><p className="text-sm text-muted-foreground">{v.license_plate}</p></div></div></Link></li>))}</ul>) : <p className="text-sm text-muted-foreground">Keine Fahrzeuge zugewiesen.</p>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={() => setIsUploadOpen(true)}><FileUp className="mr-2 h-4 w-4" /> Dokument hochladen</Button>
            </div>
            <UnifiedDocumentGrid driverId={driverId} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
            <DriverHistory driverId={driverId} onEditEvent={(e) => { setEditingEvent(e); setIsEventSheetOpen(true); }} events={driverEvents} isLoading={false} />
            {driverId && <AuditLogDisplay entityId={driverId} entityType='driver' />}
        </TabsContent>
      </Tabs>
    </div>

    <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Dokument für {driver.first_name} {driver.last_name} hochladen</DialogTitle></DialogHeader>
            <DocumentManager entityId={driverId} entityType="driver" onClose={() => setIsUploadOpen(false)} />
        </DialogContent>
    </Dialog>

    <DriverFormSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} driverData={driver as any} />
    <EventFormSheet isOpen={isEventSheetOpen} onOpenChange={setIsEventSheetOpen} eventData={editingEvent} allowedEventTypes={['inspection', 'repair', 'tuv', 'au', 'uvv', 'tire_change', 'service', 'damage', 'verkehrsunfall', 'other']} title="Ereignis bearbeiten" description="Details aktualisieren." />
    </>
  );
}
