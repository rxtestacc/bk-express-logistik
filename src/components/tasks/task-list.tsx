'use client';

import { useMemo, useState, useEffect } from 'react';
import { Timestamp, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Eye, Mic, Calendar, User, UserCircle, Users, Clock, CheckCircle2, Trash2, ListChecks, X, Loader2, Car, ClipboardList, CalendarDays, LayoutGrid, List } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { format, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Task } from './task-form-sheet';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { useSession } from '@/hooks/use-session';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
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
} from "@/components/ui/alert-dialog";

interface TaskListProps {
    onEditTask: (task: Task) => void;
}

const statusTranslations: { [key: string]: string } = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
};

const statusColors: { [key: string]: string } = {
  open: 'bg-status-red hover:bg-status-red/80',
  in_progress: 'bg-status-yellow hover:bg-status-yellow/80 text-black',
  done: 'bg-status-green hover:bg-status-green/80',
};

const statusOrder: { [key: string]: number } = {
  open: 1,
  in_progress: 2,
  done: 3,
};

type ViewMode = 'grid' | 'list';

export function TaskList({ onEditTask }: TaskListProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  const { tasks, vehicles, isLoading } = useDashboardData();
  
  const [filterView, setFilterView] = useState<'mine' | 'all'>('mine');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Load saved view mode
  useEffect(() => {
    const savedMode = localStorage.getItem('bkexpress_task_view_mode') as ViewMode;
    if (savedMode && ['grid', 'list'].includes(savedMode)) {
        setViewMode(savedMode);
    }
  }, []);

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('bkexpress_task_view_mode', mode);
  };

  const vehiclesMap = useMemo(() => new Map(vehicles?.map(v => [v.id, v])), [vehicles]);

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    
    let list = [...tasks];
    
    if (filterView === 'mine' && session) {
        list = list.filter(t => t.assignee_name === session.name);
    }

    return list.sort((a, b) => {
      const statusA = statusOrder[a.status] || 99;
      const statusB = statusOrder[b.status] || 99;

      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      const dateA = a.due_date ? (a.due_date as Timestamp).toMillis() : 0;
      const dateB = b.due_date ? (b.due_date as Timestamp).toMillis() : 0;
      
      if (statusA === 3) { // 'done'
        return dateB - dateA;
      }
      return dateA - dateB;
    });
  }, [tasks, filterView, session]);


  const getVehicleName = (vehicleId: string | undefined) => {
      if (!vehicleId) return 'Allgemein';
      const vehicle = vehiclesMap.get(vehicleId);
      if (!vehicle) return vehicleId;
      return `${vehicle.license_plate}`;
  }

  const formatDate = (timestamp: Timestamp | Date | undefined, withTime: boolean = false) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return format(date, withTime ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy', { locale: de });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkStatusChange = async (newStatus: 'done' | 'open') => {
    if (!firestore || !session || selectedIds.length === 0) return;
    
    const batch = writeBatch(firestore);
    const now = serverTimestamp();
    const userName = session.name;

    try {
      for (const id of selectedIds) {
        const taskRef = doc(firestore, 'tasks', id);
        const originalDoc = await getDoc(taskRef);
        if (!originalDoc.exists()) continue;
        
        const originalData = originalDoc.data();
        const updateData: any = {
          status: newStatus,
          updated_at: now,
        };

        if (newStatus === 'done' && originalData.status !== 'done') {
          updateData.completed_by_name = userName;
          updateData.completed_at = now;
        } else if (newStatus === 'open' && originalData.status === 'done') {
          updateData.completed_by_name = null;
          updateData.completed_at = null;
        }

        batch.update(taskRef, updateData);
        await generateAuditLog(firestore, 'task', id, originalData, updateData, userName, 'update');
      }

      await batch.commit();
      toast({ title: 'Erfolg', description: `${selectedIds.length} Aufgaben aktualisiert.` });
      setSelectedIds([]);
      setIsSelectionMode(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Status konnte nicht aktualisiert werden.' });
    }
  };

  const handleBulkDelete = async () => {
    if (!firestore || !session || selectedIds.length === 0) return;
    
    setIsDeleting(true);
    const batch = writeBatch(firestore);
    const userName = session.name;

    try {
      for (const id of selectedIds) {
        const taskRef = doc(firestore, 'tasks', id);
        const originalDoc = await getDoc(taskRef);
        if (originalDoc.exists()) {
          await generateAuditLog(firestore, 'task', id, originalDoc.data(), {}, userName, 'delete');
          batch.delete(taskRef);
        }
      }

      await batch.commit();
      toast({ title: 'Erfolg', description: `${selectedIds.length} Aufgaben gelöscht.` });
      setSelectedIds([]);
      setIsSelectionMode(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Aufgaben konnten nicht gelöscht werden.' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleSingleStatusChange = async (taskId: string, newStatus: 'done' | 'open') => {
    if (!firestore || !session) return;
    
    const taskRef = doc(firestore, 'tasks', taskId);
    try {
      const originalDoc = await getDoc(taskRef);
      if (!originalDoc.exists()) return;
      
      const originalData = originalDoc.data();
      const updateData: any = {
        status: newStatus,
        updated_at: serverTimestamp(),
      };

      if (newStatus === 'done') {
        updateData.completed_by_name = session.name;
        updateData.completed_at = serverTimestamp();
      } else {
        updateData.completed_by_name = null;
        updateData.completed_at = null;
      }

      const batch = writeBatch(firestore);
      batch.update(taskRef, updateData);
      await batch.commit();
      await generateAuditLog(firestore, 'task', taskId, originalData, updateData, session.name, 'update');
      toast({ title: 'Aufgabe aktualisiert' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Fehler' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={filterView} onValueChange={(v) => setFilterView(v as 'mine' | 'all')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] h-12 bg-muted/50 p-1.5 rounded-2xl shadow-inner">
            <TabsTrigger 
                value="mine" 
                className={cn(
                    "flex items-center gap-2 rounded-xl transition-all duration-300",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
                )}
            >
                <UserCircle className="h-4 w-4" />
                <span className="font-bold">Meine Aufgaben</span>
            </TabsTrigger>
            <TabsTrigger 
                value="all" 
                className={cn(
                    "flex items-center gap-2 rounded-xl transition-all duration-300",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
                )}
            >
                <Users className="h-4 w-4" />
                <span className="font-bold">Alle Aufgaben</span>
            </TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher */}
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl shrink-0 mr-2">
                <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8 rounded-lg", viewMode === 'grid' && "bg-background shadow-sm")}
                    onClick={() => updateViewMode('grid')}
                    title="Rasteransicht"
                >
                    <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8 rounded-lg", viewMode === 'list' && "bg-background shadow-sm")}
                    onClick={() => updateViewMode('list')}
                    title="Listenansicht"
                >
                    <List className="h-4 w-4" />
                </Button>
            </div>

            {!isSelectionMode ? (
                <Button variant="outline" size="sm" onClick={() => setIsSelectionMode(true)} className="h-10 rounded-xl border-primary/20 hover:border-primary/40 bg-background shadow-sm">
                    <ListChecks className="h-4 w-4 mr-2 text-primary" /> Auswählen
                </Button>
            ) : (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                    {selectedIds.length > 0 && (
                        <>
                            <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleBulkStatusChange('done')}
                                className="h-10 rounded-xl bg-status-green hover:bg-status-green/90 shadow-lg"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Erledigt ({selectedIds.length})
                            </Button>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => { setTaskToDelete(null); setIsDeleteDialogOpen(true); }}
                                className="h-10 rounded-xl shadow-lg"
                            >
                                <Trash2 className="h-4 w-4 mr-2" /> Löschen
                            </Button>
                        </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="h-10 rounded-xl border">
                        <X className="h-4 w-4 mr-2" /> Abbrechen
                    </Button>
                </div>
            )}
        </div>
      </div>

      <Card className="border-none shadow-none md:border md:shadow-xl md:bg-card/50 md:backdrop-blur-sm overflow-hidden ring-1 ring-border/50">
        <CardHeader className="hidden md:block bg-muted/10 border-b">
          <CardTitle className="text-xl font-black uppercase tracking-tight">{filterView === 'mine' ? 'Meine Arbeitsliste' : 'Globale Aufgabenliste'}</CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            {filterView === 'mine' 
              ? 'Deine persönlichen Prioritäten für heute' 
              : 'Status aller offenen Arbeitsaufträge im System'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {viewMode === 'grid' ? (
              /* --- GRID VIEW --- */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1 md:px-0 py-2">
                  {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                          <Card key={i} className="p-4 space-y-3">
                              <Skeleton className="h-6 w-3/4" />
                              <Skeleton className="h-4 w-1/2" />
                              <Skeleton className="h-10 w-full" />
                          </Card>
                      ))
                  ) : sortedTasks.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed">
                          <p className="font-bold text-xs uppercase tracking-widest opacity-40">Keine Aufgaben gefunden</p>
                      </div>
                  ) : (
                      sortedTasks.map((task) => {
                          const isOverdue = task.due_date && isPast(task.due_date.toDate()) && task.status !== 'done';
                          return (
                            <Card 
                                key={task.id} 
                                className={cn(
                                    "overflow-hidden border-primary/10 active:scale-[0.98] transition-all relative rounded-2xl shadow-sm",
                                    task.status === 'done' && "opacity-60 grayscale-[0.5]",
                                    selectedIds.includes(task.id!) && "ring-2 ring-primary border-primary bg-primary/5",
                                    isOverdue && "border-destructive/30 bg-destructive/[0.01]"
                                )}
                                onClick={() => isSelectionMode ? toggleSelection(task.id!) : router.push(`/aufgaben/${task.id}`)}
                            >
                                {isSelectionMode && (
                                    <div className="absolute top-3 right-3 z-10 scale-125">
                                        <Checkbox checked={selectedIds.includes(task.id!)} onCheckedChange={() => toggleSelection(task.id!)} onClick={(e) => e.stopPropagation()} />
                                    </div>
                                )}
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 pr-8">
                                                <span className="text-base font-black tracking-tight leading-tight">{task.title}</span>
                                                {(task as any).created_via === 'voice' && <Mic className="h-3.5 w-3.5 text-primary animate-pulse" />}
                                            </div>
                                            <Badge className={cn('text-[9px] h-5 px-2 font-black uppercase tracking-wider', statusColors[task.status])}>
                                                {statusTranslations[task.status]}
                                            </Badge>
                                        </div>
                                        {!isSelectionMode && (
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Fällig</p>
                                                <p className={cn("text-xs font-black", isOverdue ? "text-destructive" : "text-foreground")}>{formatDate(task.due_date as any)}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-primary/5">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Zuständig</p>
                                            <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                                <div className="h-5 w-5 bg-primary/10 rounded-full flex items-center justify-center">
                                                    <User className="h-3 w-3 text-primary" />
                                                </div>
                                                {task.assignee_name}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Fahrzeug</p>
                                            <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                                <Car className="h-3 w-3 text-muted-foreground" />
                                                {getVehicleName(task.vehicleId)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex flex-col gap-1 border-t border-primary/5 opacity-70">
                                        <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                                            <User className="h-2.5 w-2.5" />
                                            <span>Zugewiesen von: {task.created_by_name || 'System'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                                                <CalendarDays className="h-2.5 w-2.5" />
                                                <span>Am: {formatDate(task.created_at as any, true)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                          )
                      })
                  )}
              </div>
          ) : (
              /* --- LIST VIEW --- */
              <div className="overflow-x-auto">
                  <Table>
                  <TableHeader className="bg-muted/30">
                      <TableRow className="border-b-2">
                      {isSelectionMode && (
                          <TableHead className="w-10 pl-6">
                              <Checkbox 
                                checked={selectedIds.length > 0 && selectedIds.length === sortedTasks.length} 
                                onCheckedChange={(checked) => setSelectedIds(checked ? sortedTasks.map(t => t.id!) : [])}
                              />
                          </TableHead>
                      )}
                      <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Fällig</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Titel / Betreff</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Zuständig</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Fahrzeug</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Status</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase tracking-widest py-4 pr-6">Aktionen</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoading ?
                      Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                              {isSelectionMode && <TableCell className="pl-6"><Skeleton className="h-4 w-4" /></TableCell>}
                              <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-[100px] rounded-full" /></TableCell>
                              <TableCell className="text-right pr-6"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                          </TableRow>
                      )) : sortedTasks.length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={isSelectionMode ? 8 : 7} className="h-32 text-center">
                            <div className="flex flex-col items-center justify-center opacity-40">
                                <ClipboardList className="h-10 w-10 mb-2" />
                                <p className="font-black text-xs uppercase tracking-widest">Keine Aufgaben vorhanden</p>
                            </div>
                          </TableCell>
                      </TableRow>
                      ) :
                      sortedTasks?.map((task) => {
                          const isOverdue = task.due_date && isPast(task.due_date.toDate()) && task.status !== 'done';
                          return (
                            <TableRow 
                            key={task.id} 
                            className={cn(
                                "cursor-pointer hover:bg-primary/[0.02] border-b transition-colors h-20",
                                task.status === 'done' && "opacity-50 grayscale-[0.3]",
                                selectedIds.includes(task.id!) && "bg-primary/[0.05]",
                                isOverdue && "bg-destructive/[0.01]"
                            )}
                            onClick={() => isSelectionMode ? toggleSelection(task.id!) : router.push(`/aufgaben/${task.id}`)}
                            >
                            {isSelectionMode && (
                                <TableCell onClick={(e) => e.stopPropagation()} className="pl-6">
                                    <Checkbox checked={selectedIds.includes(task.id!)} onCheckedChange={() => toggleSelection(task.id!)} />
                                </TableCell>
                            )}
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className={cn("font-bold text-sm", isOverdue ? "text-destructive" : "text-foreground")}>{formatDate(task.due_date as any)}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Deadline</span>
                                </div>
                            </TableCell>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg shrink-0", (task as any).created_via === 'voice' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                        {(task as any).created_via === 'voice' ? <Mic className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-black tracking-tight text-sm truncate">{task.title}</span>
                                        <span className="text-[9px] text-muted-foreground mt-0.5">Erstellt am {formatDate(task.created_at as any, true)}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2 font-bold text-xs">
                                        <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-black">
                                            {task.assignee_name.substring(0, 2).toUpperCase()}
                                        </div>
                                        {task.assignee_name}
                                    </div>
                                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground ml-8">Zuweiser: {task.created_by_name || 'System'}</span>
                                </div>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                {task.vehicleId ? (
                                <Link href={`/fahrzeuge/${task.vehicleId}`} className="hover:text-primary transition-colors flex items-center gap-2">
                                    <Badge variant="outline" className="font-black text-[10px] border-primary/20 py-0.5 px-2 bg-primary/5 text-primary">
                                        {getVehicleName(task.vehicleId)}
                                    </Badge>
                                </Link>
                                ) : (
                                <span className="text-muted-foreground text-xs font-bold uppercase italic opacity-40">Allgemein</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {task.status && (
                                <Badge className={cn('text-[10px] font-black uppercase tracking-wider px-3 py-1 text-white shadow-sm', statusColors[task.status])}>
                                    {statusTranslations[task.status]}
                                </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary">
                                    <span className="sr-only">Menü öffnen</span>
                                    <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl">
                                    <DropdownMenuItem onClick={() => router.push(`/aufgaben/${task.id}`)} className="rounded-lg h-10 font-bold">
                                        <Eye className="mr-2 h-4 w-4 text-primary" />
                                        Details anzeigen
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onEditTask(task as any)} className="rounded-lg h-10 font-bold">
                                        <Pencil className="mr-2 h-4 w-4 text-primary" />
                                        Bearbeiten
                                    </DropdownMenuItem>
                                    {task.status !== 'done' && (
                                        <DropdownMenuItem onClick={() => handleSingleStatusChange(task.id!, 'done')} className="text-status-green font-black rounded-lg h-10 bg-status-green/5 hover:bg-status-green/10">
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Als erledigt markieren
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive font-black rounded-lg h-10" onClick={() => { setTaskToDelete(task.id!); setIsDeleteDialogOpen(true); }}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Löschen
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                            </TableRow>
                          )
                      })}
                  </TableBody>
                  </Table>
              </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black">Aufgaben löschen?</AlertDialogTitle>
                <AlertDialogDescription className="font-medium">
                    {taskToDelete ? 'Diese Aufgabe wird unwiderruflich aus dem System gelöscht.' : `Es werden ${selectedIds.length} Aufgaben unwiderruflich gelöscht.`}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel disabled={isDeleting} className="rounded-xl font-bold">Abbrechen</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={taskToDelete ? async () => {
                        setSelectedIds([taskToDelete]);
                        await handleBulkDelete();
                    } : handleBulkDelete} 
                    className="bg-destructive hover:bg-destructive/90 rounded-xl font-black shadow-lg shadow-destructive/20" 
                    disabled={isDeleting}
                >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Jetzt löschen
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
