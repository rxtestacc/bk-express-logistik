'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, User, Sparkles, BrainCircuit, PlusCircle, CheckCircle2, Calendar, ClipboardList, RefreshCw } from 'lucide-react';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { askFleetAssistant, type PlannedAction } from '@/ai/flows/fleet-assistant-flow';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, Timestamp, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { generateAuditLog } from '@/lib/audit-log';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: PlannedAction[];
  executedActions?: Set<number>;
}

export function GlobalAIAssistant({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void; }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { vehicles, drivers, tasks, events, contracts } = useDashboardData();
  const router = useRouter();
  const firestore = useFirestore();
  const { session } = useSession();
  const { toast } = useToast();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active users (pins) for AI context
  const pinsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pins'), where('active', '==', true));
  }, [firestore]);
  const { data: systemUsers } = useCollection(pinsQuery);

  // Auto-scroll to bottom whenever messages or typing state changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const fleetContext = {
        v: vehicles.map(v => ({ i: v.id, kz: v.license_plate, m: `${v.make} ${v.model}`, s: v.status, km: v.mileage_km })),
        d: drivers.map(d => ({ i: d.id, n: `${d.first_name} ${d.last_name}` })),
        u: systemUsers?.map(u => ({ n: u.name, r: u.role })) || [], // System staff users
        t: tasks.map(t => ({ i: t.id, vi: t.vehicleId, ti: t.title, s: t.status, a: t.assignee_name })),
        e: events.map(e => ({ i: e.id, vi: e.vehicleId, ti: e.title, ty: e.type, s: e.status })),
        c: contracts.map(c => ({ i: c.id, vi: c.vehicleId, p: c.providerName, s: c.contractStatus }))
      };

      const result = await askFleetAssistant({
        question: userMsg,
        fleetContext: JSON.stringify(fleetContext)
      });

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.answer, 
        actions: result.actions,
        executedActions: new Set()
      }]);
    } catch (error: any) {
      console.error('Fleet Assistant Error:', error);
      let errorMsg = 'Entschuldigung, ich konnte die Flotten-Anfrage momentan nicht verarbeiten.';
      
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'Das KI-Limit wurde erreicht. Bitte warten Sie 60 Sekunden, bevor Sie die nächste Frage stellen.';
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  const executeAction = async (msgIdx: number, actionIdx: number) => {
    if (!firestore || !session) return;
    const message = messages[msgIdx];
    const action = message.actions?.[actionIdx];
    if (!action) return;

    try {
      const batch = writeBatch(firestore);
      let docId = "";
      let entityType: any = 'task';
      let finalPayload: any = {};
      let originalData: any = {};

      if (action.type === 'create_task') {
        entityType = 'task';
        const taskRef = doc(collection(firestore, 'tasks'));
        docId = taskRef.id;
        const dateParts = action.data.due_date.split('-').map(Number);
        const dueDate = Timestamp.fromDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0));
        
        finalPayload = {
          title: action.data.title,
          description: action.data.description || '',
          assignee_name: action.data.assignee_name,
          vehicleId: action.data.vehicleId || null,
          status: 'open',
          due_date: dueDate,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          created_by_name: session.name,
          created_via: 'ai_chat',
        };
        batch.set(taskRef, finalPayload);
      } 
      else if (action.type === 'create_event') {
        entityType = 'event';
        const eventRef = doc(collection(firestore, 'vehicle_events'));
        docId = eventRef.id;
        const dateParts = action.data.due_date.split('-').map(Number);
        const dueDate = Timestamp.fromDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0));

        finalPayload = {
          vehicleId: action.data.vehicleId,
          type: action.data.eventType,
          title: action.data.title,
          due_date: dueDate,
          status: action.data.status || 'open',
          odometer_km: 0,
          cost_eur: 0,
          notes: action.data.notes || '',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          created_by_name: session.name,
          created_via: 'ai_chat',
        };
        batch.set(eventRef, finalPayload);

        if (finalPayload.status === 'open') {
            const reminderRef = doc(collection(firestore, 'reminders'));
            batch.set(reminderRef, {
              vehicleId: action.data.vehicleId,
              kind: action.data.eventType,
              due_date: dueDate,
              status: 'open',
              sourceEventId: docId,
            });
        }
      }
      else if (action.type === 'update_vehicle') {
        entityType = 'vehicle';
        docId = action.data.vehicleId;
        const vehicleRef = doc(firestore, 'vehicles', docId);
        
        const updates: any = { ...action.data.updates, updated_at: serverTimestamp() };
        if (updates.tuv_due) {
            const dp = updates.tuv_due.split('-').map(Number);
            updates.tuv_due = Timestamp.fromDate(new Date(dp[0], dp[1] - 1, dp[2], 12, 0, 0));
            
            const remQ = query(collection(firestore, 'reminders'), where('vehicleId', '==', docId), where('kind', '==', 'tuv'));
            const remSnap = await getDocs(remQ);
            remSnap.forEach(d => batch.delete(d.ref));
            
            const newRemRef = doc(collection(firestore, 'reminders'));
            batch.set(newRemRef, {
                vehicleId: docId,
                kind: 'tuv',
                due_date: updates.tuv_due,
                status: 'open',
                sourceEventId: docId
            });
        }
        
        batch.update(vehicleRef, updates);
        finalPayload = updates;
      }

      await batch.commit();
      await generateAuditLog(firestore, entityType, docId, originalData, finalPayload, session.name, action.type === 'update_vehicle' ? 'update' : 'create');

      toast({ title: 'Erfolgreich ausgeführt', description: 'Die Änderungen wurden im System übernommen.' });
      
      setMessages(prev => {
        const next = [...prev];
        const newExecuted = new Set(next[msgIdx].executedActions);
        newExecuted.add(actionIdx);
        next[msgIdx] = { ...next[msgIdx], executedActions: newExecuted };
        return next;
      });

    } catch (error) {
      console.error("Action execution error:", error);
      toast({ variant: 'destructive', title: 'Fehler beim Ausführen' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary rounded-2xl text-primary-foreground">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">BK-Express Flotten-KI</DialogTitle>
              <DialogDescription className="text-sm">Fragen stellen, Daten aktualisieren oder Aufgaben planen.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.length === 0 && (
                <div className="text-center py-12 space-y-4 opacity-50">
                    <Sparkles className="h-12 w-12 mx-auto text-primary" />
                    <p className="text-lg font-medium">Wie kann ich Ihnen heute helfen?</p>
                    <div className="text-xs space-y-1">
                        <p>Tipp: "Erstelle eine Aufgabe für Bilal: Er soll den TÜV bei BK-2067 prüfen."</p>
                        <p>Tipp: "Wer ist für die Aufgabe 'Reifenwechsel' zuständig?"</p>
                        <p>Tipp: "Setze den Kilometerstand für BK-100 auf 120.000."</p>
                    </div>
                </div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={cn("flex flex-col gap-3", m.role === 'assistant' ? "items-start" : "items-end")}>
                <div className={cn("flex items-start gap-4", m.role === 'assistant' ? "" : "flex-row-reverse")}>
                    <div className={cn("p-2.5 rounded-xl shrink-0", m.role === 'assistant' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {m.role === 'assistant' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </div>
                    <div className={cn("max-w-[85%] p-5 rounded-2xl border shadow-sm", m.role === 'assistant' ? "bg-card" : "bg-primary text-primary-foreground")}>
                    <ReactMarkdown 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        components={{
                        a: ({ node, ...props }) => {
                            if (props.href?.startsWith('/')) {
                            return <button onClick={() => { onOpenChange(false); router.push(props.href!); }} className="text-primary hover:underline font-bold">{props.children}</button>;
                            }
                            return <a {...props} target="_blank" className="text-primary underline" />;
                        }
                        }}
                    >{m.content}</ReactMarkdown>
                    </div>
                </div>

                {m.actions && m.actions.length > 0 && (
                    <div className="ml-14 space-y-3 w-full max-w-[85%] animate-in fade-in slide-in-from-left-2">
                        {m.actions.map((action, aIdx) => {
                            const isExecuted = m.executedActions?.has(aIdx);
                            return (
                                <Card key={aIdx} className={cn("border-primary/20", isExecuted ? "bg-green-50 opacity-70" : "bg-primary/5")}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex gap-3">
                                                <div className="mt-1 p-2 bg-background rounded-lg border">
                                                    {action.type === 'create_task' && <ClipboardList className="h-4 w-4 text-primary" />}
                                                    {action.type === 'create_event' && <Calendar className="h-4 w-4 text-primary" />}
                                                    {action.type === 'update_vehicle' && <RefreshCw className="h-4 w-4 text-primary" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">
                                                        {action.type === 'create_task' && `Aufgabe für ${action.data.assignee_name}: ${action.data.title}`}
                                                        {action.type === 'create_event' && `Eintrag: ${action.data.title}`}
                                                        {action.type === 'update_vehicle' && `Update: ${action.data.reason}`}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                                                        {action.type === 'create_task' && `Fällig: ${new Date(action.data.due_date).toLocaleDateString('de-DE')}`}
                                                        {action.type === 'create_event' && `Datum: ${new Date(action.data.due_date).toLocaleDateString('de-DE')} • ${action.data.status === 'done' ? 'Historie' : 'Termin'}`}
                                                        {action.type === 'update_vehicle' && Object.entries(action.data.updates).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                            {isExecuted ? (
                                                <div className="text-green-600 flex items-center gap-1 text-[10px] font-black uppercase">
                                                    <CheckCircle2 className="h-4 w-4" /> Erledigt
                                                </div>
                                            ) : (
                                                <Button size="sm" onClick={() => executeAction(idx, aIdx)} className="h-8 text-xs font-bold px-3 rounded-full">
                                                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                                    Ausführen
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
              </div>
            ))}
            {isTyping && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> KI denkt nach...</div>}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 border-t">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex w-full gap-3 max-w-3xl mx-auto">
            <Input placeholder="z.B.: 'Erstelle Aufgabe für Bilal: TÜV-Prüfung BK-2067 bis Freitag.'" value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} className="flex-1 h-14 rounded-2xl shadow-inner" />
            <Button type="submit" size="icon" className="h-14 w-14 rounded-2xl shadow-lg" disabled={isTyping || !input.trim()}><Send className="h-6 w-6" /></Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
