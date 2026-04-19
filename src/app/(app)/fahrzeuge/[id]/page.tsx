'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, deleteDoc, Timestamp, collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInMonths, differenceInDays, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import VehicleHistory from '@/components/vehicles/vehicle-history';
import VehicleEvents from '@/components/vehicles/vehicle-events';
import VehicleUpcomingReminders from '@/components/vehicles/vehicle-upcoming-reminders';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { EventFormSheet, type VehicleEvent } from '@/components/events/event-form-sheet';
import { VehicleFormSheet } from '@/components/vehicles/vehicle-form-sheet';
import { Button } from '@/components/ui/button';
import { 
  Pencil, 
  Trash2, 
  User, 
  FolderSearch, 
  History, 
  Info, 
  Map as MapIcon, 
  RefreshCw, 
  ClipboardList, 
  QrCode, 
  Euro, 
  Calendar, 
  Settings, 
  ShieldCheck, 
  Maximize2, 
  Zap, 
  Gauge, 
  Fuel, 
  Palette, 
  Landmark, 
  FileCheck,
  Car,
  MapPin,
  TrendingUp,
  Clock,
  Disc,
  ShieldAlert
} from 'lucide-react';
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
import VehicleQRCodeDialog from '@/components/vehicles/vehicle-qr-code-dialog';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentManager } from '@/components/documents/document-manager';
import { UnifiedDocumentGrid } from '@/components/documents/unified-document-grid';
import VehicleDamageMap from '@/components/vehicles/vehicle-damage-map';
import { cn } from '@/lib/utils';

/**
 * Robuste Hilfsfunktion zur Datumsextraktion.
 */
const getSafeDate = (ts: any): Date | null => {
    if (!ts) return null;
    try {
        if (ts instanceof Timestamp) return ts.toDate();
        if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
        if (typeof ts.seconds === 'number') return new Timestamp(ts.seconds, ts.nanoseconds || 0).toDate();
        const d = new Date(ts);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
};

const safeFormatDate = (ts: any) => {
    const date = getSafeDate(ts);
    if (!date) return '-';
    return format(date, 'dd.MM.yyyy', { locale: de });
};

/**
 * Berechnet die Restlaufzeit in Monaten und Tagen.
 */
const getRemainingDuration = (endDateTs: any) => {
    const end = getSafeDate(endDateTs);
    if (!end) return null;
    
    const now = new Date();
    if (end < now) return 'Beendet / Abgelaufen';

    const months = differenceInMonths(end, now);
    const dateAfterMonths = addMonths(now, months);
    const days = differenceInDays(end, dateAfterMonths);

    const parts = [];
    if (months > 0) parts.push(`${months} Monat${months > 1 ? 'e' : ''}`);
    if (days > 0) parts.push(`${days} Tag${days > 1 ? 'e' : ''}`);
    
    return parts.length > 0 ? parts.join(' ') : 'Heute fällig';
};

const DetailItem = ({ label, value, icon: Icon, className }: { label: string; value: React.ReactNode, icon?: any, className?: string }) => {
    if (value === null || value === undefined || value === '' || value === 0) return null;
    return (
        <div className={cn("group flex flex-col gap-1.5 p-3 rounded-xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/50", className)}>
            <div className="flex items-center gap-2">
                {Icon && <Icon className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors" />}
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">{label}</p>
            </div>
            <div className="text-[13px] font-black tracking-tight text-foreground/90">{value}</div>
        </div>
    );
};

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || value === 0) return null;
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const formatNumber = (value: number | undefined) => {
    if (value === undefined || value === null) return null;
    return value.toLocaleString('de-DE');
};

const maintenanceEventTypes = ['inspection', 'repair', 'tuv', 'au', 'uvv', 'tire_change', 'service'];
const damageEventTypes = ['damage', 'verkehrsunfall', 'other'];

export default function VehicleDetailPage() {
  const { id } = useParams();
  const vehicleId = Array.isArray(id) ? id[0] : id;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  
  const [vehicle, setVehicle] = useState<any>(null);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  const { handovers, drivers, events, contracts, isLoading: isDashboardLoading } = useDashboardData();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VehicleEvent | undefined>(undefined);
  const [isVehicleSheetOpen, setIsVehicleSheetOpen] = useState(false);
  const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);

  // Document counting logic
  const vDocsQ = useMemoFirebase(() => !firestore || !vehicleId ? null : query(collection(firestore, 'vehicle_documents'), where('vehicleId', '==', vehicleId)), [firestore, vehicleId]);
  const { data: vd, isLoading: isVLoading } = useCollection(vDocsQ);
  
  const docCount = useMemo(() => {
    if (!vehicle) return 0;
    const directDocs = vd?.length || 0;
    const eventFiles = events.filter(e => e.vehicleId === vehicleId).reduce((a, e) => a + (e.images?.length || 0) + (e.accident_sketch_image ? 1 : 0), 0);
    const handoverFiles = handovers.filter(h => h.vehicleId === vehicleId).reduce((a, h) => {
        let c = 0;
        if (h.requiredPhotos) c += Object.values(h.requiredPhotos).filter((p: any) => p.status === 'added').length;
        if (h.additionalPhotos) c += h.additionalPhotos.length;
        return a + c;
    }, 0);
    const contractDocs = contracts.filter(c => c.vehicleId === vehicleId && c.documentRef).length;
    return directDocs + eventFiles + handoverFiles + contractDocs;
  }, [vd, events, handovers, contracts, vehicleId, vehicle]);

  const maintenanceCount = useMemo(() => 
    events.filter(e => e.vehicleId === vehicleId && maintenanceEventTypes.includes(e.type)).length,
    [events, vehicleId]
  );

  const damageCount = useMemo(() => 
    events.filter(e => e.vehicleId === vehicleId && damageEventTypes.includes(e.type)).length,
    [events, vehicleId]
  );

  const handoverCount = useMemo(() => 
    handovers.filter(h => h.vehicleId === vehicleId).length,
    [handovers, vehicleId]
  );

  const historyTotal = maintenanceCount + damageCount + handoverCount;

  const fetchVehicle = useCallback(async () => {
    if (!firestore || !vehicleId) return;
    setIsLoadingVehicle(true);
    try {
      const docRef = doc(firestore, 'vehicles', vehicleId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setVehicle({ id: docSnap.id, ...docSnap.data() });
        setVehicleError(null);
      } else {
        setVehicleError('Fahrzeug nicht gefunden.');
      }
    } catch (e: any) {
      console.error("Error fetching vehicle:", e);
      setVehicleError('Fehler beim Laden des Fahrzeugs.');
    } finally {
      setIsLoadingVehicle(false);
    }
  }, [firestore, vehicleId]);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  const latestHandover = useMemo(() => {
    const vHandovers = handovers.filter(h => h.vehicleId === vehicleId && h.status === 'completed');
    if (vHandovers.length === 0) return null;
    return vHandovers.sort((a, b) => {
        const ta = getSafeDate(a.handoverAt)?.getTime() || 0;
        const tb = getSafeDate(b.handoverAt)?.getTime() || 0;
        return tb - ta;
    })[0];
  }, [handovers, vehicleId]);

  const currentDriver = useMemo(() => {
    if (!latestHandover?.toDriverId) return null;
    return drivers.find(d => d.id === latestHandover.toDriverId);
  }, [drivers, latestHandover]);

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setIsEventSheetOpen(true);
  };
  
  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsEventSheetOpen(isOpen);
    if (!isOpen) setEditingEvent(undefined);
  };

  const handleDeleteVehicle = async () => {
    if (!firestore || !vehicle || !session) return;
    setIsDeleting(true);
    try {
        await generateAuditLog(firestore, 'vehicle', vehicle.id, vehicle, {}, session.name, 'delete');
        await deleteDoc(doc(firestore, 'vehicles', vehicle.id));
        toast({ title: 'Fahrzeug gelöscht' });
        router.push('/fahrzeuge');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
        setIsDeleting(false);
    }
  };

  if (isLoadingVehicle || isVLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="space-y-6">
            <Card><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
            <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (vehicleError || !vehicle) {
    return (
      <div className="p-8 text-center bg-card rounded-lg border border-destructive/20">
        <p className="text-destructive font-bold mb-4">{vehicleError || 'Fahrzeug konnte nicht geladen werden.'}</p>
        <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => router.push('/fahrzeuge')}>Zurück</Button>
            <Button onClick={fetchVehicle}><RefreshCw className="mr-2 h-4 w-4" /> Erneut versuchen</Button>
        </div>
      </div>
    );
  }
  
  const powerInPs = vehicle.power_kw ? Math.round(vehicle.power_kw * 1.35962) : null;
  const acquisitionLabels = { cash: 'Barkauf', leasing: 'Leasing', financing: 'Finanzierung' };
  
  const remainingDuration = (vehicle.acquisition_type === 'leasing' || vehicle.acquisition_type === 'financing')
    ? getRemainingDuration(vehicle.leasing_end || vehicle.financing_end)
    : null;

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tight">{vehicle.make} {vehicle.model}</h1>
                    <Badge variant={vehicle.status === 'aktiv' ? 'default' : 'secondary'} className={cn("uppercase font-black text-[10px]", vehicle.status === 'aktiv' ? "bg-status-green" : "bg-status-yellow text-black")}>
                        {vehicle.status}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 text-xl text-muted-foreground mt-1">
                    <Badge variant="outline" className="text-lg py-1 px-3 border-primary/30 bg-primary/5 font-mono font-black">{vehicle.license_plate}</Badge>
                    {currentDriver && (
                    <>
                        <span className="mx-1 text-gray-300">|</span>
                        <Link href={`/fahrer/${currentDriver.id}`} className="flex items-center gap-2 text-base text-primary hover:underline font-bold">
                            <User className="h-5 w-5" />
                            <span>{currentDriver.first_name} {currentDriver.last_name}</span>
                        </Link>
                    </>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold"
                    onClick={() => setIsQrCodeDialogOpen(true)}
                >
                    <QrCode className="mr-2 h-4 w-4" />
                    ID Code
                </Button>
                <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 font-bold"
                    onClick={() => router.push(`/scan/vehicle/${vehicleId}/report-damage`)}
                >
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Schaden melden
                </Button>
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsVehicleSheetOpen(true)} 
                    className="rounded-xl font-bold"
                >
                    <Pencil className="mr-2 h-4 w-4" />Bearbeiten
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="rounded-xl font-bold"><Trash2 className="mr-2 h-4 w-4" />Löschen</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Fahrzeug wirklich löschen?</AlertDialogTitle>
                            <AlertDialogDescription>Diese Aktion entfernt das Fahrzeug unwiderruflich aus der Datenbank.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteVehicle} disabled={isDeleting}>Endgültig löschen</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
        
        <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex mb-4 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="details" className="rounded-lg data-[state=active]:shadow-sm"><Info className="h-4 w-4 mr-2" /> Details</TabsTrigger>
                <TabsTrigger value="documents" className="relative rounded-lg data-[state=active]:shadow-sm">
                    <FolderSearch className="h-4 w-4 mr-2" /> Dokumente
                    {docCount > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                            {docCount}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="history" className="relative rounded-lg data-[state=active]:shadow-sm">
                    <History className="h-4 w-4 mr-2" /> Historie
                    {historyTotal > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                            {historyTotal}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="damage" className="relative rounded-lg data-[state=active]:shadow-sm">
                    <MapIcon className="h-4 w-4 mr-2" /> Schäden
                    {damageCount > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                            {damageCount}
                        </Badge>
                    )}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-6">
                        {/* Stammdaten & Technik */}
                        <Card className="border-none shadow-xl ring-1 ring-border/50 bg-card/50 backdrop-blur-sm overflow-hidden rounded-2xl">
                            <CardHeader className="bg-muted/30 border-b py-4 px-6">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary/80">
                                    <Settings className="h-3.5 w-3.5" />
                                    Stammdaten & Technik
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6 space-y-8">
                                {/* Group 1: Identifikation */}
                                <div>
                                    <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.25em] mb-3 ml-1">Identifikation</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                                        <DetailItem icon={ClipboardList} label="Kennzeichen" value={vehicle.license_plate} />
                                        <DetailItem icon={Zap} label="VIN (Fahrgestell-Nr.)" value={vehicle.vin} className="col-span-2" />
                                        <DetailItem icon={FileCheck} label="HSN / TSN" value={vehicle.hsn && vehicle.tsn ? `${vehicle.hsn} / ${vehicle.tsn}` : (vehicle.hsn || vehicle.tsn)} />
                                    </div>
                                </div>

                                {/* Group 2: Fahrzeugspezifikation */}
                                <div>
                                    <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.25em] mb-3 ml-1">Fahrzeugdaten</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                                        <DetailItem icon={Car} label="Hersteller" value={vehicle.make} />
                                        <DetailItem icon={Car} label="Modell" value={vehicle.model} />
                                        <DetailItem icon={Car} label="Variante" value={vehicle.variant} />
                                        <DetailItem icon={Calendar} label="Baujahr" value={vehicle.year} />
                                        <DetailItem icon={Palette} label="Farbe" value={vehicle.color} />
                                        <DetailItem icon={Disc} label="Reifengröße" value={vehicle.tire_size} />
                                        <DetailItem icon={Calendar} label="Erstzulassung" value={safeFormatDate(vehicle.first_registration)} />
                                    </div>
                                </div>

                                {/* Group 3: Antrieb */}
                                <div>
                                    <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.25em] mb-3 ml-1">Antrieb & Leistung</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                                        <DetailItem icon={Zap} label="Leistung" value={vehicle.power_kw ? `${vehicle.power_kw} kW / ${powerInPs} PS` : null} />
                                        <DetailItem icon={Settings} label="Motor / Hubraum" value={vehicle.engine} />
                                        <DetailItem icon={Fuel} label="Kraftstoffart" value={vehicle.fuel_type} />
                                    </div>
                                </div>

                                {/* Group 4: Status & Einsatz */}
                                <div>
                                    <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.25em] mb-3 ml-1">Operativer Status</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                                        <DetailItem 
                                            icon={Gauge} 
                                            label="Akt. Laufleistung" 
                                            value={
                                                <div className="flex flex-col">
                                                    <span>{formatNumber(vehicle.mileage_km)} km</span>
                                                    {vehicle.mileage_updated_at && (
                                                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
                                                            <Clock className="h-2 w-2" /> Stand: {safeFormatDate(vehicle.mileage_updated_at)}
                                                        </span>
                                                    )}
                                                </div>
                                            } 
                                        />
                                        <DetailItem icon={User} label="Auftraggeber" value={vehicle.carrier} />
                                        <DetailItem icon={ShieldCheck} label="Fuhrpark-Typ" value={vehicle.fleet_type} />
                                        <DetailItem icon={MapPin} label="Aktueller Standort" value={vehicle.location} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Kauf & Vertrag */}
                        <Card className="border-none shadow-xl ring-1 ring-border/50 bg-card/50 backdrop-blur-sm overflow-hidden rounded-2xl">
                            <CardHeader className="bg-muted/30 border-b py-4 px-6">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary/80">
                                    <Euro className="h-3.5 w-3.5" />
                                    Anschaffung & Vertrag
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                                    <DetailItem icon={FileCheck} label="Erwerbsart" value={acquisitionLabels[vehicle.acquisition_type as keyof typeof acquisitionLabels] || '-'} />
                                    <DetailItem icon={Calendar} label="Zulassung BK (Kauf)" value={safeFormatDate(vehicle.purchase_date)} />
                                    <DetailItem icon={Euro} label="Investition" value={formatCurrency(vehicle.purchase_price)} />
                                    <DetailItem icon={Landmark} label="Partner / Bank" value={vehicle.leasing_company || vehicle.financing_bank} />
                                    
                                    {(vehicle.acquisition_type === 'leasing' || vehicle.acquisition_type === 'financing') && (
                                        <>
                                            <DetailItem icon={TrendingUp} label="Rate (Mtl.)" value={formatCurrency(vehicle.leasing_rate_eur || vehicle.financing_rate_eur)} />
                                            <DetailItem icon={Calendar} label="Vertragsbeginn" value={safeFormatDate(vehicle.leasing_start || vehicle.financing_start)} />
                                            <DetailItem icon={Calendar} label="Vertragsende" value={safeFormatDate(vehicle.leasing_end || vehicle.financing_end)} />
                                            <DetailItem 
                                                icon={Clock} 
                                                label="Restlaufzeit" 
                                                value={remainingDuration} 
                                                className="border-primary/20 bg-primary/5 shadow-inner" 
                                            />
                                            <DetailItem icon={Calendar} label="Ersterate" value={safeFormatDate(vehicle.first_installment_date)} />
                                            <DetailItem icon={Calendar} label="Schlussrate" value={safeFormatDate(vehicle.last_installment_date)} />
                                            <DetailItem icon={Gauge} label="Kilometerlimit / Jahr" value={vehicle.leasing_annual_mileage ? `${formatNumber(vehicle.leasing_annual_mileage)} km` : null} />
                                        </>
                                    )}
                                    <DetailItem icon={ShieldCheck} label="Nächster TÜV" value={safeFormatDate(vehicle.tuv_due)} />
                                    <DetailItem icon={ShieldCheck} label="Garantie bis" value={safeFormatDate(vehicle.warranty_end)} />
                                </div>
                                {vehicle.notes && (
                                    <div className="mt-6 pt-6 border-t border-border/40">
                                        <DetailItem icon={ClipboardList} label="Interne Notizen" value={vehicle.notes} className="col-span-full" />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="w-full">
                    <VehicleUpcomingReminders vehicleId={vehicleId} />
                </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-8">
                <Card className="border-primary/20 shadow-sm">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="flex items-center gap-2 text-lg font-black"><FolderSearch className="h-5 w-5 text-primary" />Zentrales Dokumenten-Archiv</CardTitle>
                        <CardDescription>Alle digitalisierten Unterlagen, Verträge und Fotos zu diesem Fahrzeug.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <UnifiedDocumentGrid vehicleId={vehicleId} />
                    </CardContent>
                </Card>
                <Card className="border-dashed border-2">
                    <CardHeader><CardTitle className="text-base font-bold">Neues Dokument hinzufügen</CardTitle></CardHeader>
                    <CardContent><DocumentManager entityId={vehicleId} entityType="vehicle" /></CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
                <VehicleHistory vehicleId={vehicleId} onEditEvent={handleEditEvent} />
                {vehicleId && <AuditLogDisplay entityId={vehicleId} entityType='vehicle' />}
            </TabsContent>

            <TabsContent value="damage" className="space-y-6">
                <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-lg font-black">
                                    <MapIcon className="h-5 w-5 text-primary" />
                                    Grafische Schadenskarte
                                </CardTitle>
                                <CardDescription>Übersicht aller lokalisierten Beschädigungen am Fahrzeug.</CardDescription>
                            </div>
                            <Link href={`/scan/vehicle/${vehicleId}/report-damage`}>
                                <Button variant="outline" size="sm" className="rounded-xl font-bold">
                                    <MapIcon className="mr-2 h-4 w-4" /> Schaden mobil erfassen
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-6">
                        <div className="border rounded-2xl overflow-hidden shadow-inner bg-slate-50">
                             <VehicleDamageMap vehicleId={vehicleId} />
                        </div>
                        
                        <div className="space-y-4">
                            <h3 className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                                <ClipboardList className="h-5 w-5 text-primary" />
                                Ereignisliste (Schäden & Unfälle)
                            </h3>
                            <VehicleEvents 
                                vehicleId={vehicleId} 
                                filterText="" 
                                eventTypes={['damage', 'verkehrsunfall', 'other']} 
                                onEditEvent={handleEditEvent} 
                            />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>

      <EventFormSheet isOpen={isEventSheetOpen} onOpenChange={handleSheetOpenChange} eventData={editingEvent} allowedEventTypes={['inspection', 'repair', 'tuv', 'au', 'uvv', 'tire_change', 'service', 'damage', 'verkehrsunfall', 'other']} title="Ereignis bearbeiten" description="Aktualisieren Sie die Details dieses Ereignisses." />
      <VehicleFormSheet 
        isOpen={isVehicleSheetOpen} 
        onOpenChange={setIsVehicleSheetOpen} 
        vehicleData={vehicle as any} 
      />
      
      {/* QR Code Dialog Trigger */}
      <VehicleQRCodeDialog
        vehicle={vehicle}
        open={isQrCodeDialogOpen}
        onOpenChange={setIsQrCodeDialogOpen}
        isTrigger={true}
      />
    </>
  );
}
