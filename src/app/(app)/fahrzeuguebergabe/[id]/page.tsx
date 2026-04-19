'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import AuditLogDisplay from '@/components/history/audit-log-display';
import { CheckCircle2, AlertCircle, XCircle, Edit, FileDown, Loader2, Hash, Maximize2, X, Trash2, Info, FolderOpen, FileUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import HandoverDamageHistoryMap from '@/components/handovers/handover-damage-history-map';
import DamageMap from '@/components/damage/damage-map';
import Image from 'next/image';
import { HandoverStatusDialog } from '@/components/handovers/handover-status-dialog';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { cn } from '@/lib/utils';
import { generateHandoverPdf } from '@/lib/handover-pdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedDocumentGrid } from '@/components/documents/unified-document-grid';
import { DocumentManager } from '@/components/documents/document-manager';

// --- Hilfsfunktionen für die Skizzen-Generierung ---
function simpleHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

const generateColorFromEventId = (eventId: string): string => {
  const hash = simpleHash(eventId);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col space-y-1 sm:flex-row sm:justify-between sm:space-y-0 py-2 border-b border-muted last:border-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="font-semibold text-sm sm:text-right">{value}</div>
    </div>
  );
};

const ChecklistItemDisplay = ({ item }: { item: any }) => {
    let Icon, colorClass, label;
    switch(item.state) {
        case 'ok': Icon = CheckCircle2; colorClass = 'text-green-600'; label = 'OK'; break;
        case 'missing': Icon = AlertCircle; colorClass = 'text-yellow-600'; label = 'Fehlt'; break;
        case 'defect': Icon = XCircle; colorClass = 'text-red-600'; label = 'Defekt'; break;
        default: Icon = AlertCircle; colorClass = 'text-gray-600'; label = '?';
    }
    return (
        <div className="flex items-start justify-between py-2.5 border-b last:border-b-0">
            <div>
                <p className="font-bold text-sm">{item.label}</p>
                {item.note && <p className="text-xs text-muted-foreground mt-0.5 italic">Notiz: {item.note}</p>}
            </div>
            <div className={cn("flex items-center gap-1.5 text-xs font-black uppercase tracking-tight", colorClass)}>
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
            </div>
        </div>
    )
}

const photoLabels: Record<string, string> = { front: 'Frontansicht', rear: 'Heckansicht', left: 'Fahrerseite', right: 'Beifahrerseite', mirror_left: 'Außenspiegel Links', mirror_right: 'Außenspiegel Rechts' };
const statusTranslations: Record<string, string> = { draft: 'Entwurf', completed: 'Abgeschlossen', new_damage: 'Neuer Schaden', in_review: 'In Prüfung', closed: 'Archiviert' };
const statusColors: Record<string, string> = { draft: 'bg-gray-400', completed: 'bg-status-green', new_damage: 'bg-status-red', in_review: 'bg-status-yellow text-black', closed: 'bg-gray-600' };

export default function HandoverDetailPage() {
  const { id } = useParams();
  const handoverId = Array.isArray(id) ? id[0] : id;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  const { handovers, isLoading: isDashboardLoading } = useDashboardData();
  
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string, title: string } | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const handover = useMemo(() => handovers.find(h => h.id === handoverId), [handovers, handoverId]);
  const protocolNumber = useMemo(() => handoverId?.slice(0, 8).toUpperCase(), [handoverId]);

  // Document counting logic
  const vDocsQ = useMemoFirebase(() => !firestore || !handoverId ? null : query(collection(firestore, 'vehicle_documents'), where('relatedEntityId', '==', handoverId)), [firestore, handoverId]);
  const dDocsQ = useMemoFirebase(() => !firestore || !handoverId ? null : query(collection(firestore, 'driver_documents'), where('relatedEntityId', '==', handoverId)), [firestore, handoverId]);
  const { data: vd, isLoading: isVL } = useCollection(vDocsQ);
  const { data: dd, isLoading: isDL } = useCollection(dDocsQ);
  
  const photoCount = useMemo(() => {
      const addedRequired = Object.values(handover?.requiredPhotos || {}).filter((p: any) => p.status === 'added').length;
      const additional = handover?.additionalPhotos?.length || 0;
      return addedRequired + additional;
  }, [handover]);

  const docCount = (vd?.length || 0) + (dd?.length || 0) + photoCount;

  const isLoading = isDashboardLoading || isVL || isDL;
  
  const handleDeleteHandover = async () => {
    if (!firestore || !handover || !session) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'vehicle_handovers', handover.id));
        await generateAuditLog(firestore, 'handover' as any, handover.id, handover, {}, session.name, 'delete');
        toast({ title: 'Protokoll gelöscht' });
        router.push('/fahrzeuguebergabe');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
        setIsDeleting(false);
    }
  }

  const handleDownloadPdf = async () => {
    if (!handover || !firestore) return;
    setIsGeneratingPdf(true);
    
    try {
        const legendData: { title: string, color: string, date: string }[] = [];

        const generateSketch = async () => {
            if (!handover.vehicleId) return undefined;
            
            const markersQ = query(collection(firestore, 'damage_markers'), where('vehicleId', '==', handover.vehicleId));
            const markersSnap = await getDocs(markersQ);
            const allMarkers = markersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            
            if (allMarkers.length === 0) return undefined;

            const eventIds = [...new Set(allMarkers.map(m => m.eventId))].filter(Boolean);
            const eventsSnap = await getDocs(query(collection(firestore, 'vehicle_events'), where('__name__', 'in', eventIds.slice(0, 30))));
            const eventsMap = new Map(eventsSnap.docs.map(d => [d.id, d.data()]));
            
            const handoverMillis = handover.handoverAt.toMillis ? handover.handoverAt.toMillis() : new Date(handover.handoverAt).getTime();
            
            const validMarkers = allMarkers.filter(m => {
                const event = eventsMap.get(m.eventId);
                if (!event) return false;
                const eventDateTs = (event.due_date as any)?.toMillis ? event.due_date.toMillis() : new Date(event.due_date).getTime();
                return eventDateTs <= handoverMillis;
            });

            if (validMarkers.length === 0) return undefined;

            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            if (!ctx) return undefined;

            const bgImg = new window.Image();
            bgImg.src = '/vehicle-views/transporter-sheet.png';
            await new Promise((resolve) => { bgImg.onload = resolve; });

            const canvasW = 1280;
            const canvasH = 720;
            const imgRatio = bgImg.width / bgImg.height;
            const targetRatio = canvasW / canvasH;
            
            let dw, dh, dx, dy;
            if (imgRatio > targetRatio) {
                dw = canvasW;
                dh = canvasW / imgRatio;
                dx = 0;
                dy = (canvasH - dh) / 2;
            } else {
                dh = canvasH;
                dw = canvasH * imgRatio;
                dx = (canvasW - dw) / 2;
                dy = 0;
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvasW, canvasH);
            ctx.drawImage(bgImg, dx, dy, dw, dh);

            const seenEventsInLegend = new Set<string>();

            validMarkers.forEach(m => {
                const color = generateColorFromEventId(m.eventId);
                const event = eventsMap.get(m.eventId);
                
                if (event && !seenEventsInLegend.has(m.eventId)) {
                    legendData.push({
                        title: event.title || 'Unbenannt',
                        color: color,
                        date: event.due_date ? format(event.due_date.toDate ? event.due_date.toDate() : new Date(event.due_date), 'dd.MM.yy') : 'N/A'
                    });
                    seenEventsInLegend.add(m.eventId);
                }

                ctx.beginPath();
                ctx.arc((m.xPct / 100) * canvasW, (m.yPct / 100) * canvasH, 10, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            return canvas.toDataURL('image/png');
        };

        const sketchUrl = await generateSketch();

        await generateHandoverPdf({
            ...(handover as any),
            damageSketchUrl: sketchUrl,
            damageLegend: legendData
        });
    } catch (e) {
        console.error("PDF Generierung fehlgeschlagen", e);
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  if (isLoading && !handover) {
    return (<div className="space-y-6"><div className="space-y-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/3" /></div><Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /></CardContent></Card></div>);
  }

  if (!handover) return <div>Übergabeprotokoll nicht gefunden.</div>;
  
  const checklistIssues = handover.checklistEnabled ? handover.checklist?.filter((item: any) => item.state !== 'ok') || [] : [];
  const photoEntries = handover.requiredPhotos ? Object.entries(handover.requiredPhotos) : [];

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1 font-mono">
                    <Hash className="h-3 w-3" /> {protocolNumber}
                </Badge>
                <h1 className="text-3xl font-bold">Übergabeprotokoll</h1>
            </div>
            <p className="text-muted-foreground">{handover.vehicleLabel} am {format(handover.handoverAt.toDate(), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="shadow-sm">
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Protokoll (PDF)
            </Button>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(true)} className="shadow-sm">
                <Edit className="mr-2 h-4 w-4" /> Status ändern
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="shadow-sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Löschen
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Protokoll löschen?</AlertDialogTitle>
                        <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten dieses Protokolls werden entfernt.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteHandover} className="bg-destructive" disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Jetzt löschen"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="mb-4">
            <TabsTrigger value="info"><Info className="h-4 w-4 mr-2" /> Details</TabsTrigger>
            <TabsTrigger value="documents" className="relative">
                <FolderOpen className="h-4 w-4 mr-2" /> Anhänge & Dokumente
                {docCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border-none shadow-none">
                        {docCount}
                    </Badge>
                )}
            </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader className="bg-muted/30 pb-4"><CardTitle className="text-base">Allgemeine Informationen</CardTitle></CardHeader>
                        <CardContent className="pt-4">
                            <DetailItem label="Protokoll-Nummer" value={`#${protocolNumber}`} />
                            <DetailItem label="Fahrzeug" value={handover.vehicleLabel} />
                            <DetailItem label="Abgebender Fahrer" value={handover.fromDriverName || 'Unbekannt'} />
                            <DetailItem label="Übernehmender Fahrer" value={handover.toDriverName} />
                            <DetailItem label="Kilometerstand" value={`${handover.odometerKm?.toLocaleString('de-DE') || 'N/A'} km`} />
                            <DetailItem label="Status" value={<Badge className={cn('text-white font-bold', statusColors[handover.status])}>{statusTranslations[handover.status] || handover.status}</Badge>} />
                            {handover.statusNotes && <DetailItem label="Notiz zum Status" value={handover.statusNotes} />}
                        </CardContent>
                    </Card>
                    
                    {handover.vehicleId && <HandoverDamageHistoryMap vehicleId={handover.vehicleId} handoverTimestamp={handover.handoverAt} />}
                    
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4"><CardTitle className="text-base">Zustandsprüfung</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                            <DetailItem label="Vorschäden bestätigt" value={handover.existingDamageConfirmed ? 'Ja' : 'Nein'} />
                            {handover.notes && (
                                <div className="mt-4 p-4 bg-muted/50 rounded-xl border border-dashed text-sm italic">
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Kommentar des Bearbeiters</p>
                                    {handover.notes}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {handover.status === 'completed' && handover.vehicleId && (
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4"><CardTitle className="text-base">Bei Übergabe erfasste neue Schäden</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                            <DamageMap vehicleId={handover.vehicleId} eventId={handoverId} canEdit={false} />
                        </CardContent>
                    </Card>
                    )}

                    {handover.checklistEnabled && (
                        <Card className="shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base">Checkliste Ausstattung</CardTitle>
                                <CardDescription>{checklistIssues.length === 0 ? "Alle Ausstattungspunkte sind vollständig." : `${checklistIssues.length} Abweichung(en) festgestellt.`}</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {handover.checklist?.map((item: any) => <ChecklistItemDisplay key={item.key} item={item} />)}
                            </CardContent>
                        </Card>
                    )}
                    {handoverId && <AuditLogDisplay entityId={handoverId} entityType='handover' />}
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <Card className="shadow-sm sticky top-24">
                        <CardHeader className="pb-4"><CardTitle className="text-base">Fotodokumentation</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 gap-5">
                            {photoEntries.map(([key, photo]: [string, any]) => (
                                <div key={key} className="space-y-1.5">
                                    <p className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">{photoLabels[key] || key}</p>
                                    {photo.status === 'added' && photo.url ? (
                                        <div 
                                            onClick={() => setViewingPhoto({ url: photo.url, title: photoLabels[key] || key })}
                                            className="block aspect-video relative rounded-xl overflow-hidden border shadow-sm group transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            <Image src={photo.url} alt={key} layout="fill" objectFit="cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-white/90 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold text-black shadow-lg">
                                                    <Maximize2 className="h-3.5 w-3.5" />
                                                    Anzeigen
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-video flex flex-col items-center justify-center bg-muted rounded-xl text-center border-2 border-dashed">
                                            <AlertCircle className="h-6 w-6 text-amber-500 mb-1" />
                                            <p className="text-[10px] font-bold text-muted-foreground px-4">{photo.placeholderNote || 'Nicht erfasst'}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            {handover.additionalPhotos && handover.additionalPhotos.length > 0 && (
                                <div className="space-y-3 pt-4 border-t">
                                    <p className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Zusätzliche Fotos</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {handover.additionalPhotos.map((photo: any, idx: number) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => setViewingPhoto({ url: photo.url, title: `Zusatzfoto ${idx + 1}` })}
                                                className="aspect-square relative rounded-lg overflow-hidden border shadow-sm group cursor-pointer"
                                            >
                                                <Image src={photo.url} alt={`Zusatzfoto ${idx + 1}`} layout="fill" objectFit="cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Maximize2 className="h-4 w-4 text-white" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-primary/10">
                <div>
                    <h3 className="font-bold text-sm">Weitere Anhänge</h3>
                    <p className="text-xs text-muted-foreground">Laden Sie zusätzliche Dokumente oder Fotos zu diesem Protokoll hoch.</p>
                </div>
                <Button onClick={() => setIsUploadDialogOpen(true)} className="rounded-xl h-10">
                    <FileUp className="mr-2 h-4 w-4" /> Anhang hinzufügen
                </Button>
            </div>
            
            <UnifiedDocumentGrid relatedEntityId={handoverId} />
        </TabsContent>
      </Tabs>
    </div>

    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Anhang für dieses Protokoll hochladen</DialogTitle></DialogHeader>
            <DocumentManager 
                entityId={handover?.vehicleId || undefined} 
                entityType="vehicle" 
                relatedEntityId={handoverId}
                relatedEntityType="handover"
                onClose={() => setIsUploadDialogOpen(false)} 
            />
        </DialogContent>
    </Dialog>

    <Dialog open={!!viewingPhoto} onOpenChange={(open) => !open && setViewingPhoto(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-black/95 shadow-2xl flex flex-col items-center justify-center overflow-hidden">
            <DialogHeader className="sr-only"><DialogTitle>{viewingPhoto?.title}</DialogTitle></DialogHeader>
            <div className="absolute top-4 right-4 z-50">
                <Button variant="ghost" size="icon" onClick={() => setViewingPhoto(null)} className="text-white hover:bg-white/20 rounded-full">
                    <X className="h-6 w-6" />
                </Button>
            </div>
            {viewingPhoto && (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                    <img 
                        src={viewingPhoto.url} 
                        alt={viewingPhoto.title} 
                        className="max-w-full max-h-[85vh] object-contain rounded-sm"
                    />
                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-bold border border-white/10">
                        {viewingPhoto.title}
                    </div>
                </div>
            )}
        </DialogContent>
    </Dialog>

    <HandoverStatusDialog isOpen={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen} handover={handover as any} />
    </>
  );
}
