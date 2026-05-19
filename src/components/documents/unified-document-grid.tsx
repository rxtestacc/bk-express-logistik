'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { 
    FileText, 
    FileIcon, 
    ExternalLink, 
    Clock, 
    Car, 
    ShieldAlert, 
    Handshake, 
    FileText as ContractIcon,
    Search,
    Files,
    ChevronRight,
    Download,
    ListChecks,
    Trash2,
    X,
    LayoutDashboard,
    User,
    Link as LinkIcon,
    ClipboardList,
    LayoutGrid,
    List,
    Archive
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UnifiedDocumentFile {
    url: string;
    title: string;
    fileType: string;
    fileSize?: number;
    storagePath?: string;
}

interface DocumentBundle {
    id: string;
    title: string;
    category: string;
    sourceType: 'manual' | 'contract' | 'event' | 'handover';
    sourceTitle: string;
    sourceId: string;
    sourceCollection: 'vehicle_documents' | 'driver_documents' | 'general_documents' | 'other';
    uploadedAt: Timestamp;
    uploadedByName: string;
    files: UnifiedDocumentFile[];
    isGeneral: boolean;
    vehicleId?: string;
    driverId?: string;
    licensePlate?: string;
    driverName?: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
    relatedTitle?: string;
}

type ViewMode = 'grid' | 'list';

const sourceIcons = {
    manual: FileText,
    contract: ContractIcon,
    event: ShieldAlert,
    handover: Handshake,
};

const sourceColors = {
    manual: 'bg-blue-100 text-blue-700',
    contract: 'bg-purple-100 text-purple-700',
    event: 'bg-red-100 text-red-700',
    handover: 'bg-green-100 text-green-700',
};

const sourceLabels = {
    manual: 'Dokument',
    contract: 'Vertrag',
    event: 'Ereignis',
    handover: 'Übergabe',
};

const getMillis = (ts: any) => {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds !== undefined) return ts.seconds * 1000;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

export function UnifiedDocumentGrid({ vehicleId, driverId, relatedEntityId, showVehicleInfo = false }: { vehicleId?: string; driverId?: string; relatedEntityId?: string; showVehicleInfo?: boolean }) {
    const firestore = useFirestore();
    const { session } = useSession();
    const { toast } = useToast();
    const router = useRouter();
    const { vehicles, drivers, events, contracts, handovers, tasks, isLoading: isDashboardLoading } = useDashboardData();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSourceType, setActiveSourceType] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedBundleIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const savedMode = localStorage.getItem('bkexpress_doc_view_mode') as ViewMode;
        if (savedMode && ['grid', 'list'].includes(savedMode)) {
            setViewMode(savedMode);
        }
    }, []);

    const updateViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('bkexpress_doc_view_mode', mode);
    };

    const vehicleDocsQuery = useMemoFirebase(() => {
        if (!firestore || driverId) return null;
        if (vehicleId) return query(collection(firestore, 'vehicle_documents'), where('vehicleId', '==', vehicleId), orderBy('uploaded_at', 'desc'));
        return query(collection(firestore, 'vehicle_documents'), orderBy('uploaded_at', 'desc'));
    }, [firestore, vehicleId, driverId]);

    const driverDocsQuery = useMemoFirebase(() => {
        if (!firestore || vehicleId) return null;
        if (driverId) return query(collection(firestore, 'driver_documents'), where('driverId', '==', driverId), orderBy('uploaded_at', 'desc'));
        return query(collection(firestore, 'driver_documents'), orderBy('uploaded_at', 'desc'));
    }, [firestore, vehicleId, driverId]);
    
    const generalDocsQuery = useMemoFirebase(() => {
        if (!firestore || vehicleId || driverId) return null;
        return query(collection(firestore, 'general_documents'), orderBy('uploaded_at', 'desc'));
    }, [firestore, vehicleId, driverId]);

    const { data: vDocs, isLoading: isVLoading } = useCollection(vehicleDocsQuery);
    const { data: dDocs, isLoading: isDLoading } = useCollection(driverDocsQuery);
    const { data: gDocs, isLoading: isGLoading } = useCollection(generalDocsQuery);

    const getSourceUrl = (bundle: DocumentBundle) => {
        if (bundle.isGeneral) {
            return `/dokumente/general/${bundle.sourceId}?source=${bundle.sourceCollection}`;
        }

        switch (bundle.sourceType) {
            case 'contract': return `/vertraege/${bundle.sourceId}`;
            case 'event': return `/ereignisse/${bundle.sourceId}`;
            case 'handover': return `/fahrzeuguebergabe/${bundle.sourceId}`;
            case 'manual': 
                if (bundle.relatedEntityType === 'task') return `/aufgaben/${bundle.relatedEntityId}`;
                if (bundle.relatedEntityType === 'contract') return `/vertraege/${bundle.relatedEntityId}`;
                if (bundle.relatedEntityType === 'event') return `/ereignisse/${bundle.relatedEntityId}`;
                if (bundle.relatedEntityType === 'handover') return `/fahrzeuguebergabe/${bundle.relatedEntityId}`;
                if (bundle.vehicleId) return `/fahrzeuge/${bundle.vehicleId}`;
                if (bundle.driverId) return `/fahrer/${bundle.driverId}`;
                return '#';
            default: return '#';
        }
    };

    const documentBundles = useMemo((): DocumentBundle[] => {
        const bundlesMap = new Map<string, DocumentBundle>();
        const vMap = new Map(vehicles.map(v => [v.id, v]));
        const drMap = new Map(drivers.map(d => [d.id, d]));

        const getRelatedTitle = (id?: string, type?: string) => {
            if (!id || !type) return undefined;
            switch(type) {
                case 'task': return tasks.find(t => t.id === id)?.title;
                case 'contract': {
                    const c = contracts.find(c => c.id === id);
                    return c ? `${c.providerName || 'Vertrag'}` : undefined;
                }
                case 'event': return events.find(e => e.id === id)?.title;
                case 'handover': {
                    const h = handovers.find(h => h.id === id);
                    return h ? `Übergabe ${h.toDriverName}` : undefined;
                }
                default: return undefined;
            }
        };

        const addToFileBundle = (
            bundleData: Omit<DocumentBundle, 'id' | 'files' | 'relatedTitle'>,
            file: UnifiedDocumentFile,
        ) => {
            const { sourceId, sourceType } = bundleData;
            const bundleKey = `${sourceType}-${sourceId}`;
            if (!bundlesMap.has(bundleKey)) {
                 bundlesMap.set(bundleKey, {
                    ...bundleData,
                    id: bundleKey,
                    files: [],
                    relatedTitle: getRelatedTitle(bundleData.relatedEntityId, bundleData.relatedEntityType)
                });
            }
            bundlesMap.get(bundleKey)!.files.push(file);
        };

        vDocs?.forEach(d => {
            const isLegacyGeneral = d.vehicleId === 'general';
            const v = isLegacyGeneral ? null : (d.vehicleId ? vMap.get(d.vehicleId) : null);
            addToFileBundle({
                sourceId: d.id, 
                sourceType: 'manual',
                sourceCollection: 'vehicle_documents',
                title: d.title, 
                category: d.category, 
                sourceTitle: isLegacyGeneral ? 'Allgemein' : 'Dokument', 
                uploadedAt: d.uploaded_at, 
                uploadedByName: d.uploaded_by_name,
                isGeneral: isLegacyGeneral,
                vehicleId: isLegacyGeneral ? undefined : d.vehicleId,
                licensePlate: v?.license_plate,
                relatedEntityId: d.relatedEntityId, 
                relatedEntityType: d.relatedEntityType
            }, { url: d.downloadUrl, title: d.title, fileType: d.fileType, storagePath: d.storagePath });
        });

        dDocs?.forEach(d => {
            const dr = d.driverId ? drMap.get(d.driverId) : null;
            addToFileBundle({
                sourceId: d.id, 
                sourceType: 'manual', 
                sourceCollection: 'driver_documents',
                title: d.title, 
                category: d.category, 
                sourceTitle: 'Dokument', 
                uploadedAt: d.uploaded_at, 
                uploadedByName: d.uploaded_by_name,
                isGeneral: false,
                driverId: d.driverId,
                driverName: dr ? `${dr.first_name} ${dr.last_name}` : undefined,
                relatedEntityId: d.relatedEntityId, 
                relatedEntityType: d.relatedEntityType
            }, { url: d.downloadUrl, title: d.title, fileType: d.fileType, storagePath: d.storagePath });
        });
        
        gDocs?.forEach(d => {
            addToFileBundle({
                sourceId: d.id, 
                sourceType: 'manual', 
                sourceCollection: 'general_documents',
                title: d.title, 
                category: d.category, 
                sourceTitle: 'Allgemein', 
                uploadedAt: d.uploaded_at, 
                uploadedByName: d.uploaded_by_name,
                isGeneral: true,
                relatedEntityId: d.relatedEntityId, 
                relatedEntityType: d.relatedEntityType
            }, { url: d.downloadUrl, title: d.title, fileType: d.fileType, storagePath: d.storagePath });
        });

        contracts.forEach(c => {
            if (c.documentRef && (!vehicleId || c.vehicleId === vehicleId)) {
                const v = c.vehicleId ? vMap.get(c.vehicleId) : null;
                addToFileBundle({
                    sourceId: c.id, 
                    sourceType: 'contract', 
                    sourceCollection: 'other',
                    title: `Vertrag: ${c.providerName || c.contractType}`, 
                    category: c.contractType, 
                    sourceTitle: c.providerName || 'Partner', 
                    uploadedAt: c.createdAt, 
                    uploadedByName: c.createdByName,
                    isGeneral: false,
                    vehicleId: c.vehicleId || undefined,
                    licensePlate: v?.license_plate
                }, { url: c.documentRef.downloadUrl, title: 'Original-Dokument', fileType: c.documentRef.fileType });
            }
        });

        events.forEach(e => {
            if (!vehicleId || e.vehicleId === vehicleId) {
                const v = vMap.get(e.vehicleId);
                const dr = e.driverId ? drMap.get(e.driverId) : null;
                
                if (e.images && e.images.length > 0) {
                    e.images.forEach((img, idx) => {
                        addToFileBundle({
                            sourceId: e.id, 
                            sourceType: 'event', 
                            sourceCollection: 'other',
                            title: e.title, 
                            category: 'Ereignis', 
                            sourceTitle: 'Foto', 
                            uploadedAt: e.created_at || e.due_date, 
                            uploadedByName: e.created_by_name || 'System',
                            isGeneral: false,
                            vehicleId: e.vehicleId, 
                            licensePlate: v?.license_plate, 
                            driverId: e.driverId, 
                            driverName: dr ? `${dr.first_name} ${dr.last_name}` : undefined
                        }, { url: img, title: `Foto ${idx + 1}`, fileType: 'image/jpeg' });
                    });
                }

                if (e.accident_sketch_image) {
                    addToFileBundle({
                       sourceId: e.id, 
                       sourceType: 'event', 
                       sourceCollection: 'other',
                       title: e.title, 
                       category: 'Ereignis', 
                       sourceTitle: 'Unfallskizze', 
                       uploadedAt: e.created_at || e.due_date, 
                       uploadedByName: e.created_by_name || 'System',
                       isGeneral: false,
                       vehicleId: e.vehicleId, 
                       licensePlate: v?.license_plate, 
                       driverId: e.driverId, 
                       driverName: dr ? `${dr.first_name} ${dr.last_name}` : undefined
                    }, { url: e.accident_sketch_image, title: 'Unfallskizze', fileType: 'image/png' });
                }
            }
        });

        handovers.forEach(h => {
            const isRelevant = (!vehicleId && !driverId) || (vehicleId && h.vehicleId === vehicleId) || (driverId && (h.fromDriverId === driverId || h.toDriverId === driverId));
            if (isRelevant) {
                const plate = h.vehicleLabel?.split(' ')[0];
                if (h.requiredPhotos) {
                    Object.entries(h.requiredPhotos).forEach(([key, photo]: [string, any]) => {
                        if (photo.url) {
                            addToFileBundle({
                                sourceId: h.id, 
                                sourceType: 'handover', 
                                sourceCollection: 'other',
                                title: `Übergabe: ${h.toDriverName}`, 
                                category: 'Übergabe', 
                                sourceTitle: 'Übergabefoto', 
                                uploadedAt: h.handoverAt, 
                                uploadedByName: h.createdByName || 'System',
                                isGeneral: false,
                                vehicleId: h.vehicleId, 
                                licensePlate: plate, 
                                driverId: h.toDriverId, 
                                driverName: h.toDriverName
                            }, { url: photo.url, title: key, fileType: 'image/jpeg' });
                        }
                    });
                }
            }
        });

        let allBundles = Array.from(bundlesMap.values());

        if (relatedEntityId) {
            allBundles = allBundles.filter(b => 
                b.sourceId === relatedEntityId || 
                b.relatedEntityId === relatedEntityId
            );
        }

        return allBundles.sort((a, b) => getMillis(b.uploadedAt) - getMillis(a.uploadedAt));
    }, [vDocs, dDocs, gDocs, vehicles, drivers, contracts, events, handovers, tasks, vehicleId, driverId, relatedEntityId]);

    const sourceTypeCounts = useMemo(() => {
        const counts: Record<string, number> = { all: documentBundles.length, manual: 0, contract: 0, event: 0, handover: 0 };
        documentBundles.forEach(b => {
            if (counts[b.sourceType] !== undefined) {
                counts[b.sourceType]++;
            }
        });
        return counts;
    }, [documentBundles]);

    const filteredBundles = useMemo(() => {
        return documentBundles.filter(bundle => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = bundle.title.toLowerCase().includes(term) || 
                                 (bundle.sourceTitle && bundle.sourceTitle.toLowerCase().includes(term)) ||
                                 bundle.licensePlate?.toLowerCase().includes(term) ||
                                 bundle.driverName?.toLowerCase().includes(term) ||
                                 bundle.relatedTitle?.toLowerCase().includes(term);
            
            const matchesType = activeSourceType === 'all' || bundle.sourceType === activeSourceType;
            return matchesSearch && matchesType;
        });
    }, [documentBundles, searchTerm, activeSourceType]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    
    const handleArchive = async (bundle: DocumentBundle) => {
        if (!bundle.isGeneral) {
             toast({ variant: 'destructive', title: 'Aktion nicht möglich', description: 'Nur allgemeine Dokumente können hier archiviert werden.' });
            return;
        };
        if (!firestore || !session) return;
        const docRef = doc(firestore, bundle.sourceCollection, bundle.sourceId);
        try {
            await updateDoc(docRef, { status: 'archiviert' });
            await generateAuditLog(firestore, 'document', bundle.sourceId, {}, {status: 'archiviert'}, session.name, 'update');
            toast({ title: 'Dokument archiviert' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Fehler beim Archivieren' });
        }
    };

    const handleDeleteConfirm = async () => {
        if (!firestore || !session || selectedBundleIds.length === 0) return;
        
        setIsDeleting(true);
        const batch = writeBatch(firestore);
        
        try {
            for (const bundleId of selectedBundleIds) {
                const bundle = documentBundles.find(b => b.id === bundleId);
                if (!bundle) continue;

                if (bundle.sourceType === 'manual') {
                    const docRef = doc(firestore, bundle.sourceCollection, bundle.sourceId);
                    
                    const mainFile = bundle.files[0];
                    if (mainFile.storagePath) {
                        try {
                            await fetch('/api/delete-file', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: mainFile.storagePath })
                            });
                        } catch (e) {
                            console.warn("Storage deletion failed", e);
                        }
                    }
                    
                    batch.delete(docRef);
                    await generateAuditLog(firestore, 'document' as any, bundle.sourceId, { title: bundle.title }, {}, session.name, 'delete');
                } else if (bundle.sourceType === 'event') {
                    // This part remains, as events are not general docs
                }
            }
            await batch.commit();
            toast({ title: 'Erfolgreich gelöscht', description: `${selectedBundleIds.length} Einträge wurden entfernt.` });
            setSelectedIds([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error("Delete Error:", error);
            toast({ variant: 'destructive', title: 'Löschen fehlgeschlagen' });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
        }
    };

    if (isDashboardLoading || isVLoading || isDLoading || isGLoading) {
        return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>;
    }

    return (
        <div className="space-y-6">
            {/* UI from previous correct version is restored here. The logic changes above will make it work. */}
            <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
                 <div className="relative flex-1 w-full max-w-xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Kennzeichen, Fahrer oder Titel suchen..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 border-none bg-muted/50 rounded-xl"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto">
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl shrink-0 mr-2">
                        <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className={cn("h-8 w-8 rounded-lg", viewMode === 'grid' && "bg-background shadow-sm")} onClick={() => updateViewMode('grid')} title="Rasteransicht">
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className={cn("h-8 w-8 rounded-lg", viewMode === 'list' && "bg-background shadow-sm")} onClick={() => updateViewMode('list')} title="Listenansicht">
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    {!isSelectionMode ? (
                        <Button variant="outline" size="sm" onClick={() => setIsSelectionMode(true)} className="h-8 rounded-full border-primary/20 shrink-0">
                            <ListChecks className="h-4 w-4 mr-2" /> Auswählen
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2 shrink-0">
                            <Button variant="destructive" size="sm" disabled={selectedBundleIds.length === 0} onClick={() => setIsDeleteDialogOpen(true)} className="h-8 rounded-full">
                                <Trash2 className="h-4 w-4 mr-2" /> {selectedBundleIds.length} löschen
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="h-8 rounded-full border">
                                <X className="h-4 w-4 mr-2" /> Abbrechen
                            </Button>
                        </div>
                    )}
                    {!relatedEntityId && (
                        <>
                            <div className="h-6 w-px bg-border mx-2 shrink-0" />
                            <div className="flex items-center gap-1">
                                <Button variant={activeSourceType === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveSourceType('all')} className="h-8 text-xs rounded-full shrink-0">
                                    Alle ({sourceTypeCounts.all})
                                </Button>
                                {Object.entries(sourceLabels).map(([key, label]) => (
                                    <Button 
                                        key={key}
                                        variant={activeSourceType === key ? 'secondary' : 'ghost'} 
                                        size="sm" 
                                        onClick={() => setActiveSourceType(key)}
                                        className={cn("h-8 text-xs rounded-full shrink-0", activeSourceType === key && sourceColors[key as keyof typeof sourceColors])}>
                                        {label} ({sourceTypeCounts[key] || 0})
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {filteredBundles.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-muted/5 opacity-60">
                    <Files className="h-16 w-16 mb-4 text-muted-foreground/30" />
                    <p className="text-lg font-medium">Keine Dokumente gefunden</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredBundles.map((bundle) => {
                        const SourceIcon = sourceIcons[bundle.sourceType] || FileIcon;
                        const firstFile = bundle.files[0];
                        const isImage = firstFile?.fileType.startsWith('image/');
                        const isSelected = selectedBundleIds.includes(bundle.id);
                        const sourceUrl = getSourceUrl(bundle);
                        const canDelete = bundle.sourceType === 'manual' || bundle.sourceType === 'event';

                        return (
                            <Card 
                                key={bundle.id} 
                                className={cn("group overflow-hidden hover:border-primary/50 transition-all shadow-md relative cursor-pointer", isSelected && "ring-2 ring-primary border-primary", isSelectionMode && !canDelete && "opacity-40 cursor-not-allowed")}
                                onClick={() => isSelectionMode && canDelete ? toggleSelection(bundle.id) : !isSelectionMode && router.push(sourceUrl)}>
                                {isSelectionMode && canDelete && (
                                    <div className="absolute top-3 right-3 z-20 scale-125">
                                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(bundle.id)} onClick={(e) => e.stopPropagation()} />
                                    </div>
                                )}
                                <div className="relative aspect-video bg-slate-100 group-hover:bg-slate-200 transition-colors">
                                    {isImage ? (
                                        <img src={firstFile.url} alt={bundle.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                            <FileText className="h-12 w-12 text-muted-foreground/40" />
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{firstFile?.fileType.split('/')[1] || 'DOC'}</span>
                                        </div>
                                    )}
                                    {!isSelectionMode && (
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button size="sm" variant="secondary" className="rounded-full shadow-lg h-8 text-[10px]" asChild>
                                                    <a href={firstFile.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3 w-3 mr-1.5" />Anzeigen</a>
                                                </Button>
                                                {sourceUrl !== '#' && (
                                                    <Button size="sm" variant="outline" className="rounded-full shadow-lg bg-white/10 text-white border-white/20 hover:bg-white/20 h-8 text-[10px]" onClick={(e) => { e.stopPropagation(); router.push(sourceUrl); }}>
                                                        <LayoutDashboard className="h-3 w-3 mr-1.5" />
                                                        Details
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <Badge className={cn("absolute top-3 left-3 border-none shadow-sm", sourceColors[bundle.sourceType])}>
                                        <SourceIcon className="h-3.5 w-3.5 mr-1.5" />
                                        {bundle.isGeneral ? 'Allgemein' : sourceLabels[bundle.sourceType]}
                                    </Badge>
                                </div>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm leading-tight line-clamp-2">{bundle.title}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="h-5 text-[9px] bg-muted/30 border-none px-1">
                                                <Clock className="h-2.5 w-2.5 mr-1 text-muted-foreground" />
                                                {format(getMillis(bundle.uploadedAt), 'dd.MM.yyyy', { locale: de })}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t flex flex-col gap-2">
                                        {bundle.relatedTitle && (
                                            <div className="flex items-start gap-2 text-[10px] bg-primary/5 p-1.5 rounded-lg border border-primary/10 hover:bg-primary/10 cursor-pointer transition-colors" onClick={(e) => { if (isSelectionMode) return; e.stopPropagation(); const url = getSourceUrl(bundle); if (url !== '#') router.push(url); }}>
                                                <LinkIcon className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-muted-foreground uppercase font-black tracking-widest text-[8px]">Verknüpft mit</p>
                                                    <p className="font-bold truncate text-primary">{bundle.relatedTitle}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(bundle.licensePlate || bundle.driverName || bundle.isGeneral) && (
                                        <div className="flex items-center justify-between text-[11px]">
                                            {bundle.isGeneral ? (<span className="text-muted-foreground flex items-center gap-1"><ClipboardList className="h-3 w-3" />Typ:</span>) : bundle.licensePlate ? (<span className="text-muted-foreground flex items-center gap-1"><Car className="h-3 w-3" />FZG:</span>) : (<span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Fahrer:</span>)}
                                            {bundle.isGeneral ? (<Badge variant="outline" className="h-5 text-[10px] font-bold">Allgemein</Badge>) : bundle.licensePlate ? (<Badge variant="secondary" className="h-5 text-[10px] font-black">{bundle.licensePlate}</Badge>) : (<span className="font-semibold text-right truncate max-w-[140px]">{bundle.driverName}</span>)}
                                        </div>
                                        )}
                                    </div>
                                    <div className="pt-2 flex items-center gap-1">
                                        <Button variant="ghost" size="sm" className="flex-1 h-8 text-[10px] uppercase tracking-wider font-bold hover:bg-primary/5 text-primary" asChild>
                                            <a href={firstFile.url} download onClick={(e) => e.stopPropagation()}><Download className="h-3 w-3 mr-1.5" />Download</a>
                                        </Button>
                                         <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => { e.stopPropagation(); handleArchive(bundle);}} title="Archivieren">
                                            <Archive className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                 <Card className="border-none shadow-sm overflow-hidden ring-1 ring-border">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                {isSelectionMode && <TableHead className="w-10 pl-4"></TableHead>}
                                <TableHead>Typ</TableHead>
                                <TableHead>Titel</TableHead>
                                <TableHead>Bezug</TableHead>
                                <TableHead>Datum</TableHead>
                                <TableHead>Hochgeladen von</TableHead>
                                <TableHead className="text-right pr-4">Aktionen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBundles.map((bundle) => {
                                const SourceIcon = sourceIcons[bundle.sourceType] || FileIcon;
                                const firstFile = bundle.files[0];
                                const isSelected = selectedBundleIds.includes(bundle.id);
                                const sourceUrl = getSourceUrl(bundle);
                                const canDelete = bundle.sourceType === 'manual' || bundle.sourceType === 'event';

                                return (
                                    <TableRow key={bundle.id} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isSelected && "bg-primary/5")} onClick={() => !isSelectionMode && router.push(sourceUrl)}>
                                        {isSelectionMode && (
                                            <TableCell onClick={(e) => e.stopPropagation()} className="pl-4">
                                                {canDelete && <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(bundle.id)} />}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <Badge className={cn("border-none", sourceColors[bundle.sourceType])}>
                                                <SourceIcon className="h-3 w-3 mr-1.5" />
                                                <span className="text-[9px] uppercase font-black">{bundle.isGeneral ? 'Allgemein' : sourceLabels[bundle.sourceType]}</span>
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {firstFile.fileType.includes('pdf') ? <FileText className="h-4 w-4 text-red-500" /> : <FileIcon className="h-4 w-4 text-blue-500" />}
                                                <span className="font-bold text-sm truncate max-w-[250px]">{bundle.title}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {bundle.isGeneral ? (<Badge variant="outline">Allgemein</Badge>) : bundle.licensePlate ? (<Badge variant="secondary">{bundle.licensePlate}</Badge>) : bundle.driverName ? (<span className="text-xs font-medium">{bundle.driverName}</span>) : null}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{format(getMillis(bundle.uploadedAt), 'dd.MM.yyyy', { locale: de })}</TableCell>
                                        <TableCell className="text-xs font-medium">{bundle.uploadedByName}</TableCell>
                                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                                                    <a href={firstFile.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" asChild>
                                                    <a href={firstFile.url} download><Download className="h-4 w-4" /></a>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </Card>
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Löschen bestätigen</AlertDialogTitle>
                        <AlertDialogDescription>
                            Diese Aktion entfernt {selectedBundleIds.length} Einträge unwiderruflich aus dem System.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive" disabled={isDeleting}>
                            {isDeleting ? "Wird gelöscht..." : "Jetzt löschen"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
