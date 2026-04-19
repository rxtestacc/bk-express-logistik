'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, deleteDoc, Timestamp, collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TaskFormSheet, type Task } from '@/components/tasks/task-form-sheet';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Mic, AlertCircle, Info, FolderOpen, FileUp } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { generateAuditLog } from '@/lib/audit-log';
import { useSession } from '@/hooks/use-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedDocumentGrid } from '@/components/documents/unified-document-grid';
import { DocumentManager } from '@/components/documents/document-manager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DetailItem = ({ label, value }: { label: string; value?: React.ReactNode }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="text-base">{value}</div>
    </div>
  );
};

const formatDate = (ts: any, withTime: boolean = false) => {
  if (!ts) return '-';
  try {
    let date: Date;
    if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (ts?.seconds !== undefined) {
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(ts);
    }
    if (isNaN(date.getTime())) return '-';
    const formatString = withTime ? "dd. MMMM yyyy, HH:mm 'Uhr'" : 'dd. MMMM yyyy';
    return format(date, formatString, { locale: de });
  } catch (e) {
    return '-';
  }
};

const statusTranslations: Record<string, string> = { open: 'Offen', in_progress: 'In Bearbeitung', done: 'Erledigt' };
const statusColors: Record<string, string> = { open: 'bg-status-red', in_progress: 'bg-status-yellow text-black', done: 'bg-status-green' };

export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = Array.isArray(id) ? id[0] : id;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  
  const { tasks, vehicles, isLoading: isDashboardLoading } = useDashboardData();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const task = useMemo(() => tasks.find(t => t.id === taskId), [tasks, taskId]);
  const vehicle = useMemo(() => vehicles.find(v => v.id === task?.vehicleId), [vehicles, task?.vehicleId]);

  // Document counting logic
  const vDocsQ = useMemoFirebase(() => !firestore || !taskId ? null : query(collection(firestore, 'vehicle_documents'), where('relatedEntityId', '==', taskId)), [firestore, taskId]);
  const dDocsQ = useMemoFirebase(() => !firestore || !taskId ? null : query(collection(firestore, 'driver_documents'), where('relatedEntityId', '==', taskId)), [firestore, taskId]);
  const { data: vd, isLoading: isVL } = useCollection(vDocsQ);
  const { data: dd, isLoading: isDL } = useCollection(dDocsQ);
  const docCount = (vd?.length || 0) + (dd?.length || 0);

  const isLoading = isDashboardLoading || isVL || isDL;

  const handleDeleteTask = async () => {
    if (!firestore || !task || !session) return;
    setIsDeleting(true);
    try {
        await generateAuditLog(firestore, 'task', task.id, task, {}, session.name, 'delete');
        await deleteDoc(doc(firestore, 'tasks', task.id));
        toast({ title: 'Aufgabe gelöscht' });
        router.push('/aufgaben');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler beim Löschen' });
        setIsDeleting(false);
    }
  };

  if (isLoading && !task) {
    return (
      <div className="space-y-6"><Skeleton className="h-10 w-2/3" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 space-y-6"><Card><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-6 w-2/3" /></div>))}</CardContent></Card></div></div></div>
    );
  }

  if (!task) return <div>Aufgabe nicht gefunden.</div>;
  
  const isDone = task.status === 'done';
  const isVoiceCreated = (task as any).created_via === 'voice';

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">{task.title}{isVoiceCreated && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1"><Mic className="h-3 w-3" /> KI-Erfasst</Badge>}</h1>
        <p className="text-xl text-muted-foreground">Aufgabendetails</p>
      </div>

      {isVoiceCreated && <Alert className="bg-amber-50 border-amber-200 text-amber-800"><AlertCircle className="h-4 w-4" /><AlertTitle>KI-generierter Entwurf</AlertTitle><AlertDescription>Prüfen Sie alle Details auf Richtigkeit.</AlertDescription></Alert>}
      
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
                    <Card>
                        <CardHeader><CardTitle>Details zur Aufgabe</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                            <DetailItem label="Fällig bis" value={formatDate(task.due_date)} />
                            <DetailItem label="Status" value={<Badge className={cn('text-white', statusColors[task.status])}>{statusTranslations[task.status] || task.status}</Badge>} />
                            <DetailItem label="Zuständig" value={task.assignee_name} />
                            <DetailItem label="Erstellt von" value={task.created_by_name || '-'} />
                            {isDone && task.completed_by_name && <DetailItem label="Erledigt von" value={task.completed_by_name} />}
                            {isDone && task.completed_at && <DetailItem label="Erledigt am" value={formatDate(task.completed_at, true)} />}
                        </CardContent>
                    </Card>
                    {task.description && <Card><CardHeader><CardTitle>Beschreibung</CardTitle></CardHeader><CardContent><p className="text-base whitespace-pre-wrap">{task.description}</p></CardContent></Card>}
                    {taskId && <AuditLogDisplay entityId={taskId} entityType='task' />}
                </div>

                <div className="lg:col-span-1 space-y-6">
                    {vehicle && <Card><CardHeader><CardTitle>Zugehöriges Fahrzeug</CardTitle></CardHeader><CardContent><Link href={`/fahrzeuge/${vehicle.id}`}><div className="flex justify-between items-center p-3 rounded-md border hover:bg-accent transition-colors"><div><p className="font-semibold">{vehicle.make} {vehicle.model}</p><p className="text-sm text-muted-foreground">{vehicle.license_plate}</p></div></div></Link></CardContent></Card>}
                    <Card><CardHeader><CardTitle>Aktionen</CardTitle></CardHeader><CardContent className="space-y-2"><Button onClick={() => setIsSheetOpen(true)} className="w-full"><Pencil className="mr-2 h-4 w-4" />Aufgabe bearbeiten</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4" />Aufgabe löschen</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle><AlertDialogDescription>Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTask} disabled={isDeleting}>{isDeleting ? 'Lösche...' : 'Endgültig löschen'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-primary/10">
                <div>
                    <h3 className="font-bold text-sm">Anhänge zur Aufgabe</h3>
                    <p className="text-xs text-muted-foreground">Fügen Sie Fotos, Quittungen oder Infos zu dieser Aufgabe hinzu.</p>
                </div>
                <Button onClick={() => setIsUploadDialogOpen(true)} className="rounded-xl">
                    <FileUp className="mr-2 h-4 w-4" /> Anhang hinzufügen
                </Button>
            </div>
            
            <UnifiedDocumentGrid relatedEntityId={taskId} />
        </TabsContent>
      </Tabs>
    </div>

    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Anhang für diese Aufgabe hochladen</DialogTitle></DialogHeader>
            <DocumentManager 
                entityId={task?.vehicleId || undefined} 
                entityType="vehicle" 
                relatedEntityId={taskId}
                relatedEntityType="task"
                onClose={() => setIsUploadDialogOpen(false)} 
            />
        </DialogContent>
    </Dialog>

    <TaskFormSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} taskData={task as any} />
    </>
  );
}
