'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, deleteDoc, Timestamp, collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, AlertCircle, CheckCircle2, FileText, Download, ExternalLink, Trash2, Loader2, FolderOpen, Info, FileUp } from 'lucide-react';
import AuditLogDisplay from '@/components/history/audit-log-display';
import ReactMarkdown from 'react-markdown';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';
import { ContractFormSheet } from '@/components/contracts/contract-form-sheet';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DetailItem = ({ label, value }: { label: string; value?: React.ReactNode }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="text-sm font-bold text-right">{value}</div>
    </div>
  );
};

const formatDate = (ts: any) => {
    if (!ts) return null;
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(date, "dd. MMMM yyyy", { locale: de });
};

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return null;
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const contractTypeTranslations: Record<string, string> = { leasing: 'Leasingvertrag', financing: 'Finanzierungsvertrag', purchase: 'Kaufvertrag', warranty: 'Garantievertrag', maintenance: 'Wartungsvertrag', insurance: 'Versicherungspolice', other: 'Sonstiger Vertrag' };
const contractStatusColors: Record<string, string> = { active: 'bg-status-green', expiring_soon: 'bg-status-yellow text-black', expired: 'bg-status-red' };
const contractStatusTranslations: Record<string, string> = { active: 'Aktiv', expiring_soon: 'Läuft bald aus', expired: 'Abgelaufen' };
const matchStatusTranslations: Record<string, string> = { unverified: 'Ungeprüft', verified: 'Geprüft', corrected: 'Korrigiert' };
const matchStatusIcons = { unverified: <AlertCircle className="h-4 w-4 text-yellow-500" />, verified: <CheckCircle2 className="h-4 w-4 text-green-500" />, corrected: <Pencil className="h-4 w-4 text-blue-500" /> };

export default function ContractDetailPage() {
  const { id } = useParams();
  const contractId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { session } = useSession();
  const { contracts, vehicles, isLoading: isDashboardLoading } = useDashboardData();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const contract = useMemo(() => contracts.find(c => c.id === contractId), [contracts, contractId]);
  const vehicle = useMemo(() => vehicles.find(v => v.id === contract?.vehicleId), [vehicles, contract?.vehicleId]);

  // Document counting logic
  const vDocsQ = useMemoFirebase(() => !firestore || !contractId ? null : query(collection(firestore, 'vehicle_documents'), where('relatedEntityId', '==', contractId)), [firestore, contractId]);
  const dDocsQ = useMemoFirebase(() => !firestore || !contractId ? null : query(collection(firestore, 'driver_documents'), where('relatedEntityId', '==', contractId)), [firestore, contractId]);
  const { data: vd, isLoading: isVL } = useCollection(vDocsQ);
  const { data: dd, isLoading: isDL } = useCollection(dDocsQ);
  const docCount = (vd?.length || 0) + (dd?.length || 0) + (contract?.documentRef ? 1 : 0);

  const isLoading = isDashboardLoading || isVL || isDL;

  const handleDeleteContract = async () => {
    if (!firestore || !contract || !session) return;
    setIsDeleting(true);

    try {
        if (contract.documentRef?.storagePath) {
            try {
                await fetch('/api/delete-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: contract.documentRef.storagePath })
                });
            } catch (e) {
                console.warn("Storage deletion for contract failed", e);
            }
        }

        await deleteDoc(doc(firestore, 'contracts', contract.id));
        await generateAuditLog(firestore, 'contract', contract.id, contract, {}, session.name, 'delete');

        toast({ title: 'Vertrag gelöscht', description: 'Der Vertrag wurde erfolgreich aus dem System entfernt.' });
        router.push('/vertraege');
    } catch (error) {
        console.error("Error deleting contract:", error);
        toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
        setIsDeleting(false);
    }
  };

  if (isLoading && !contract) {
    return (
      <div className="space-y-6"><Skeleton className="h-8 w-1/4" /><Skeleton className="h-6 w-1/2" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 space-y-6"><Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-2/3" /></CardContent></Card></div></div></div>
    );
  }

  if (!contract) return <div>Vertrag nicht gefunden.</div>;

  const daysUntilEnd = contract.endDate ? differenceInDays(contract.endDate.toDate ? contract.endDate.toDate() : new Date((contract.endDate as any).seconds * 1000), new Date()) : null;
  const daysUntilCancellation = contract.cancellationDeadline ? differenceInDays(contract.cancellationDeadline.toDate ? contract.cancellationDeadline.toDate() : new Date((contract.cancellationDeadline as any).seconds * 1000), new Date()) : null;

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
            <Button variant="outline" size="sm" onClick={() => router.push('/vertraege')} className="mb-4 rounded-full">
                <ArrowLeft className="mr-2 h-4 w-4" />Zurück
            </Button>
            <h1 className="text-3xl font-black tracking-tight">{contractTypeTranslations[contract.contractType] || 'Vertrag'}</h1>
            <p className="text-xl text-muted-foreground">{contract.providerName || 'Unbekannter Partner'}</p>
        </div>
         <div className="flex gap-2 flex-shrink-0">
             <Button variant="outline" className="rounded-xl" onClick={() => setIsEditSheetOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />Bearbeiten
             </Button>
             
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="rounded-xl">
                        <Trash2 className="mr-2 h-4 w-4" />Löschen
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Vertrag wirklich löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Diese Aktion entfernt den Vertrag und alle zugehörigen KI-Zusammenfassungen. Auch das hochgeladene Originaldokument wird gelöscht.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteContract} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Endgültig löschen
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
                <FolderOpen className="h-4 w-4 mr-2" /> Dokumente & Anhänge
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
                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30"><CardTitle className="text-sm font-black uppercase tracking-wider">Vertragsdaten</CardTitle></CardHeader>
                        <CardContent className="p-6">
                            <DetailItem label="Vertragsnummer" value={contract.contractNumber} />
                            <DetailItem label="Zuständiger" value={contract.responsibleName} />
                            <DetailItem label="Startdatum" value={formatDate(contract.startDate)} />
                            <DetailItem label="Enddatum" value={formatDate(contract.endDate)} />
                            <DetailItem label="Kündigungsfrist" value={formatDate(contract.cancellationDeadline)} />
                            <DetailItem label="Monatliche Kosten" value={formatCurrency(contract.monthlyCostEur)} />
                        </CardContent>
                    </Card>

                    {(contract.summary || contract.notes) && (
                        <Card className="border-primary/10 shadow-sm">
                            <CardHeader><CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />KI-Analyse & Zusammenfassung</CardTitle></CardHeader>
                            <CardContent className="prose prose-sm dark:prose-invert max-w-none bg-muted/20 p-6 rounded-b-lg">
                                <ReactMarkdown>{contract.summary || contract.notes}</ReactMarkdown>
                            </CardContent>
                        </Card>
                    )}

                    {contractId && <AuditLogDisplay entityId={contractId} entityType='contract' />}
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30"><CardTitle className="text-sm font-black uppercase tracking-wider">Status & Fristen</CardTitle></CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <Badge className={cn('text-sm py-1.5 w-full justify-center rounded-xl font-bold', contractStatusColors[contract.contractStatus])}>
                                {contractStatusTranslations[contract.contractStatus]}
                            </Badge>
                            <div className="space-y-1">
                                {daysUntilEnd !== null && (
                                    <DetailItem label="Laufzeitende" value={daysUntilEnd < 0 ? "Abgelaufen" : `in ${daysUntilEnd} Tagen`} />
                                )}
                                {daysUntilCancellation !== null && (
                                    <DetailItem label="Nächste Kündigung" value={daysUntilCancellation < 0 ? "Frist verpasst" : `in ${daysUntilCancellation} Tagen`} />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {contract.documentRef && (
                        <Card className="border-primary/20 shadow-lg ring-1 ring-primary/5">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><Download className="h-4 w-4 text-primary" />Original-Dokument</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0 space-y-4">
                                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl border-2 border-dashed">
                                    <div className="p-3 bg-background rounded-xl shadow-sm">
                                        <FileText className={cn("h-8 w-8", contract.documentRef.fileType === 'pdf' ? "text-red-500" : "text-blue-500")} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black truncate">{contract.documentRef.fileName}</p>
                                        <p className="text-[10px] uppercase font-black text-muted-foreground mt-0.5">{contract.documentRef.fileType}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" className="w-full h-10 rounded-xl font-bold text-xs" asChild>
                                        <a href={contract.documentRef.downloadUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-2 h-3.5 w-3.5" />Öffnen
                                        </a>
                                    </Button>
                                    <Button className="w-full h-10 rounded-xl font-bold text-xs" asChild>
                                        <a href={contract.documentRef.downloadUrl} download={contract.documentRef.fileName}>
                                            <Download className="mr-2 h-3.5 w-3.5" />Download
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-primary/10 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30"><CardTitle className="text-sm font-black uppercase tracking-wider">Zuordnung</CardTitle></CardHeader>
                        <CardContent className="p-6">
                            {vehicle ? (
                                <Link href={`/fahrzeuge/${vehicle.id}`}>
                                    <div className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-primary/5 hover:border-primary/30 transition-all bg-card shadow-sm group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><CheckCircle2 className="h-5 w-5" /></div>
                                            <div className="flex flex-col">
                                                <p className="font-black text-sm tracking-tight">{vehicle.license_plate}</p>
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">{vehicle.make} {vehicle.model}</p>
                                            </div>
                                        </div>
                                        <div className='flex items-center gap-2 mt-1 text-[10px] font-black uppercase tracking-widest text-primary/60'>
                                            {matchStatusIcons[contract.matchStatus]}
                                            <span>{matchStatusTranslations[contract.matchStatus]}</span>
                                        </div>
                                    </div>
                                </Link>
                            ) : (
                                <div className="text-center p-8 border-2 border-dashed rounded-2xl bg-muted/5">
                                    <p className="text-xs font-bold text-muted-foreground mb-4">Noch kein Fahrzeug zugeordnet.</p>
                                    <Button size="sm" className="rounded-full px-6" onClick={() => setIsEditSheetOpen(true)}>Fahrzeug zuordnen</Button>
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
                    <h3 className="font-bold text-sm">Zugehörige Dokumente</h3>
                    <p className="text-xs text-muted-foreground">Hier können Sie Rechnungen, Nachträge oder Korrespondenz zum Vertrag hinzufügen.</p>
                </div>
                <Button onClick={() => setIsUploadDialogOpen(true)} className="rounded-xl h-10">
                    <FileUp className="mr-2 h-4 w-4" /> Datei ergänzen
                </Button>
            </div>
            
            <UnifiedDocumentGrid relatedEntityId={contractId} />
        </TabsContent>
      </Tabs>
    </div>

    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Anhang für diesen Vertrag hochladen</DialogTitle></DialogHeader>
            <DocumentManager 
                entityId={contract?.vehicleId || undefined} 
                entityType="vehicle" 
                relatedEntityId={contractId}
                relatedEntityType="contract"
                onClose={() => setIsUploadDialogOpen(false)} 
            />
        </DialogContent>
    </Dialog>

    <ContractFormSheet 
        isOpen={isEditSheetOpen} 
        onOpenChange={setIsEditSheetOpen} 
        contractData={contract as any} 
    />
    </>
  );
}
