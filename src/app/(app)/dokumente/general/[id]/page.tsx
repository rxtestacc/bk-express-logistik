'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';

import { 
    FileText, 
    Download, 
    Save, 
    Loader2, 
    AlertTriangle, 
    CheckCircle, 
    ClipboardList, 
    Paperclip, 
    Calendar, 
    User, 
    HardDrive, 
    Tag, 
    ChevronLeft, 
    ArrowUpRightFromSquare, 
    Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_OPTIONS = {
    neu: 'Neu',
    in_pruefung: 'In Prüfung',
    erledigt: 'Erledigt',
    archiviert: 'Archiviert',
};

const CHECKLIST_ITEMS = {
    geprueft: 'Geprüft',
    weitergeleitet: 'Weitergeleitet',
    erledigt: 'Erledigt',
    archiviert: 'Archiviert',
};

interface GeneralDocument {
    id: string;
    title: string;
    category: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    downloadUrl: string;
    storagePath: string;
    uploaded_at: Timestamp;
    uploaded_by_name: string;
    notes?: string;
    status?: keyof typeof STATUS_OPTIONS;
    checklist?: {
        [key in keyof typeof CHECKLIST_ITEMS]?: boolean;
    };
}

function GeneralDocumentDetail() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const docId = params.id as string;
    const sourceCollection = searchParams.get('source') || 'general_documents';
    
    const firestore = useFirestore();
    const { session } = useSession();
    const { toast } = useToast();

    const docRef = useMemoFirebase(() => 
        firestore && docId ? doc(firestore, sourceCollection, docId) : null
    , [firestore, docId, sourceCollection]);

    const { data: document, isLoading, error } = useDoc<GeneralDocument>(docRef);

    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<keyof typeof STATUS_OPTIONS>('neu');
    const [checklist, setChecklist] = useState<{[key: string]: boolean}>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (document) {
            setNotes(document.notes || '');
            setStatus(document.status || 'neu');
            setChecklist(document.checklist || {});
        }
    }, [document]);

    const handleChecklistChange = (item: keyof typeof CHECKLIST_ITEMS) => {
        setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
    };

    const handleSave = async () => {
        if (!docRef || !session) return;
        setIsSaving(true);

        const updatedData = {
            notes,
            status,
            checklist,
        };

        try {
            await updateDoc(docRef, updatedData);
            await generateAuditLog(firestore, 'document', docId, {}, updatedData, session.name, 'update');
            toast({ title: "Erfolgreich gespeichert", description: "Die Änderungen wurden übernommen." });
        } catch (e) {
            console.error("Error saving document:", e);
            toast({ variant: 'destructive', title: "Fehler beim Speichern", description: "Die Änderungen konnten nicht gespeichert werden." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const isImage = document?.fileType.startsWith('image/');
    const isPDF = document?.fileType === 'application/pdf';

    if (isLoading) {
        return <Skeleton className="w-full h-screen" />;
    }

    if (error || !document) {
        return (
            <div className="text-center py-20">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="mt-4 text-2xl font-bold">Dokument nicht gefunden</h1>
                <p className="mt-2 text-muted-foreground">Das angeforderte Dokument konnte in der Sammlung `{sourceCollection}` nicht gefunden werden.</p>
                <Button onClick={() => router.push('/dokumente')} className="mt-6">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Zurück zum Archiv
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => router.push('/dokumente')} className="shadow-sm">
                     <ChevronLeft className="mr-2 h-4 w-4" />
                    Zurück zum Archiv
                </Button>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={isSaving} className="shadow-sm">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Speichern
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-6">
                     <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <FileText className="h-6 w-6 text-primary" />
                                {document.title}
                            </CardTitle>
                            <CardDescription>
                                Vorschau für {document.fileName}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isImage ? (
                                <img src={document.downloadUrl} alt={document.title} className="rounded-lg object-contain w-full h-full max-h-[70vh] bg-muted/30" />
                            ) : isPDF ? (
                                <iframe src={document.downloadUrl} className="w-full h-[70vh] rounded-lg border" title={document.title} />
                            ) : (
                                <div className="text-center py-20 bg-muted/30 rounded-lg flex flex-col items-center justify-center">
                                    <Paperclip className="h-12 w-12 text-muted-foreground" />
                                    <p className="mt-4 font-semibold">Keine Vorschau verfügbar</p>
                                    <p className="text-sm text-muted-foreground">Dateityp: {document.fileType}</p>
                                    <Button asChild className="mt-6">
                                        <a href={document.downloadUrl} target="_blank" rel="noopener noreferrer">Datei öffnen <ArrowUpRightFromSquare className="ml-2 h-4 w-4"/></a>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <ClipboardList className="h-5 w-5" />
                                Metadaten & Aktionen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <div className="space-y-2">
                               <Label>Status</Label>
                               <Select value={status} onValueChange={(v) => setStatus(v as keyof typeof STATUS_OPTIONS)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(STATUS_OPTIONS).map(([key, value]) => (
                                            <SelectItem key={key} value={key}>{value}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                           </div>
                           <div className="space-y-2">
                               <Label>Checkliste</Label>
                               <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                                 {Object.entries(CHECKLIST_ITEMS).map(([key, value]) => (
                                      <div key={key} className="flex items-center gap-2">
                                        <Checkbox 
                                            id={`check-${key}`} 
                                            checked={checklist[key] || false}
                                            onCheckedChange={() => handleChecklistChange(key as keyof typeof CHECKLIST_ITEMS)}
                                        />
                                        <Label htmlFor={`check-${key}`} className="font-normal">{value}</Label>
                                      </div>
                                  ))}
                               </div>
                           </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notizen</Label>
                                <Textarea 
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Hier können Sie Notizen zum Dokument hinzufügen..."
                                    rows={4}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="shadow-sm">
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Paperclip className="h-5 w-5" />
                                Datei-Informationen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Tag className="h-4 w-4"/>Kategorie</span>
                                <span className="font-semibold">{document.category}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4"/>Upload-Datum</span>
                                <span className="font-semibold">{format(document.uploaded_at.toDate(), 'dd.MM.yyyy, HH:mm', { locale: de })}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-4 w-4"/>Hochgeladen von</span>
                                <span className="font-semibold">{document.uploaded_by_name}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Archive className="h-4 w-4"/>Dateigröße</span>
                                <span className="font-semibold">{document.fileSize ? `${(document.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</span>
                            </div>
                             <div className="space-y-1.5 pt-2">
                                <span className="text-muted-foreground flex items-center gap-1.5 text-xs"><HardDrive className="h-4 w-4"/>Speicherpfad</span>
                                <p className="font-mono text-xs p-2 bg-muted rounded-md break-all">{document.storagePath}</p>
                            </div>
                            <Button asChild className="w-full mt-4">
                               <a href={document.downloadUrl} download><Download className="mr-2 h-4 w-4"/>Datei herunterladen</a>
                           </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Use Suspense to handle the initial rendering of useSearchParams
export default function GeneralDocumentPageWithSuspense() {
    return (
        <Suspense fallback={<Skeleton className="w-full h-screen" />}>
            <GeneralDocumentDetail />
        </Suspense>
    );
}
