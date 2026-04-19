'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ScrollArea } from '../ui/scroll-area';
import { ArrowRight, History } from 'lucide-react';
import { translateFieldName, formatAuditValue, isServerTimestamp } from '@/lib/audit-log';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';

type ActionKind = 'create' | 'update' | 'delete';
type EntityType = 'task' | 'event' | 'vehicle' | 'driver' | 'damage_marker' | 'handover' | 'document' | 'contract';

interface AuditLogChange {
  field: string;
  oldValue: any;
  newValue: any;
}

interface AuditLogEntry {
  id: string;
  entity: EntityType;
  entityId: string;
  vehicleId?: string;
  timestamp: Timestamp;
  userName: string;
  action: ActionKind;
  changes: AuditLogChange[];
}

const getSafeDate = (ts: any): Date | null => {
    if (!ts) return null;
    try {
        if (ts instanceof Timestamp) return ts.toDate();
        if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
        if (typeof ts.seconds === 'number') return new Timestamp(ts.seconds, ts.nanoseconds || 0).toDate();
        const d = new Date(ts);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) { 
        console.error("Error parsing date in audit log:", e);
        return null; 
    }
};

const HIDDEN_FIELDS_EXACT = ['created_at', 'updated_at', 'color', 'open_tasks_count', 'total_costs_eur', 'next_due_events', 'mileage_updated_at'];

const isChangeRelevant = (change: AuditLogChange) => {
  const { field, oldValue, newValue } = change;
  if (HIDDEN_FIELDS_EXACT.includes(field)) return false;
  if (isServerTimestamp(oldValue) || isServerTimestamp(newValue)) return false;
  return formatAuditValue(field, oldValue) !== formatAuditValue(field, newValue);
};

const actionLabels: Record<ActionKind, string> = {
    create: 'erstellte',
    update: 'änderte',
    delete: 'löschte'
};

const ChangeItem = ({ change, action, driversMap, vehiclesMap }: { change: AuditLogChange; action: ActionKind, driversMap: Map<string, string>, vehiclesMap: Map<string, string> }) => {
  const fieldName = translateFieldName(change.field);
  
  const getFormattedValue = (val: any) => {
      if ((change.field === 'driverId' || change.field === 'fromDriverId' || change.field === 'toDriverId') && val) return driversMap.get(val) || val;
      if (change.field === 'vehicleId' && val) return vehiclesMap.get(val) || val;
      return formatAuditValue(change.field, val);
  };

  const before = getFormattedValue(change.oldValue);
  const after  = getFormattedValue(change.newValue);
  
  if (action === 'update' && before === after) return null;
  
  return (
    <div className="flex flex-wrap items-start text-[11px] sm:text-xs py-0.5">
      <span className="font-bold text-muted-foreground mr-1.5">{fieldName}:</span>
      {action !== 'create' && <span className="text-red-600 line-through mr-1.5 opacity-70">{before}</span>}
      {action === 'update' && <ArrowRight className="h-3 w-3 mr-1.5 mt-0.5 text-muted-foreground/50" />}
      {action !== 'delete' && <span className="text-green-700 font-medium">{after}</span>}
    </div>
  );
};

export default function AuditLogDisplay({ entityId, entityType }: { entityId: string, entityType: EntityType }) {
  const firestore = useFirestore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  const { drivers, vehicles } = useDashboardData();
  
  const driversMap = useMemo(() => new Map(drivers?.map(d => [d.id, `${d.first_name} ${d.last_name}`])), [drivers]);
  const vehiclesMap = useMemo(() => new Map(vehicles?.map(v => [v.id, v.license_plate])), [vehicles]);

  const fetchLogs = useCallback(async () => {
    if (!firestore || !entityId) return;
    setIsLoadingLogs(true);
    try {
      // Keine Index-Fehler riskieren: orderBy clientseitig
      const q = query(collection(firestore, 'audit_logs'), where('entityId', '==', entityId), limit(100));
      const snap = await getDocs(q);
      
      const fetchedLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
      
      const sortedLogs = fetchedLogs.sort((a, b) => {
          const dateA = getSafeDate(a.timestamp)?.getTime() || 0;
          const dateB = getSafeDate(b.timestamp)?.getTime() || 0;
          return dateB - dateA;
      });

      setLogs(sortedLogs);
      setHasFetched(true);
    } catch (error) { 
      console.error("Fehler beim Laden der Audit-Logs:", error); 
    } finally { 
      setIsLoadingLogs(false);
    }
  }, [firestore, entityId]);

  const processedLogs = useMemo(() => {
      return logs.map(log => ({ 
          ...log, 
          changes: log.changes.filter(isChangeRelevant) 
      })).filter(log => log.changes.length > 0 || log.action !== 'update');
  }, [logs]);

  return (
    <Card className="w-full border-primary/10 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 py-3 border-b">
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Änderungsprotokoll
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full" onValueChange={(v) => v === 'item-1' && !hasFetched && fetchLogs()}>
          <AccordionItem value="item-1" className="border-b-0">
            <AccordionTrigger className="px-6 h-12 text-xs font-bold hover:no-underline">
                {hasFetched ? `Historie (${processedLogs.length} Einträge)` : 'Historie laden...'}
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              {isLoadingLogs ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <ScrollArea className="h-80 pr-4">
                  <div className="space-y-6 pt-2">
                    {processedLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-8">Keine relevanten Änderungen protokolliert.</p>
                    ) : processedLogs.map(log => {
                      const date = getSafeDate(log.timestamp);
                      return (
                        <div key={log.id} className="relative pl-6 border-l-2 border-primary/20 pb-1">
                          <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary" />
                          <div className="flex flex-col gap-0.5 mb-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span className="text-primary">{log.userName}</span>
                                <span className="text-muted-foreground font-medium">{actionLabels[log.action] || 'bearbeitete'}</span>
                                <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">
                                    {date ? format(date, "dd.MM.yy, HH:mm", { locale: de }) : '-'}
                                </span>
                            </div>
                          </div>
                          <div className="bg-muted/40 p-2.5 rounded-xl border border-primary/5 space-y-0.5">
                            {log.changes.length > 0 ? (
                                log.changes.map((change, i) => (
                                    <ChangeItem key={i} change={change} action={log.action} driversMap={driversMap} vehiclesMap={vehiclesMap} />
                                ))
                            ) : (
                                <p className="text-[10px] text-muted-foreground italic">Datensatz wurde {actionLabels[log.action]}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
