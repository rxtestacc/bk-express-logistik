'use client';

import React, { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';

// --- Types ---
type DamageMarker = {
  id: string;
  vehicleId: string;
  eventId: string;
  xPct: number;
  yPct: number;
  status: 'open' | 'in_progress' | 'done';
  note?: string;
  createdAt?: Timestamp;
};

type VehicleEvent = {
  id: string;
  due_date: Timestamp;
  title: string;
  driverId?: string;
};

type DamageGroup = {
  eventId: string;
  title: string;
  date: Date;
  color: string;
  driverName: string;
  markers: DamageMarker[];
};

// --- Helper Functions ---

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

const getMillis = (ts: any) => {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds !== undefined) return ts.seconds * 1000;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
};

// --- Main Component ---

interface HandoverDamageHistoryMapProps {
    vehicleId: string;
    handoverTimestamp: Timestamp;
}

export default function HandoverDamageHistoryMap({ vehicleId, handoverTimestamp }: HandoverDamageHistoryMapProps) {
  const firestore = useFirestore();
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const { drivers } = useDashboardData();

  const markersQuery = useMemoFirebase(() => {
    if (!firestore || !vehicleId) return null;
    return query(collection(firestore, 'damage_markers'), where('vehicleId', '==', vehicleId));
  }, [firestore, vehicleId]);
  
  const { data: markers, isLoading: isLoadingMarkers } = useCollection<DamageMarker>(markersQuery);

  const eventIds = useMemo(() => markers ? [...new Set(markers.map(m => m.eventId))] : [], [markers]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || eventIds.length === 0) return null;
    return query(collection(firestore, 'vehicle_events'), where('__name__', 'in', eventIds));
  }, [firestore, eventIds]);

  const { data: events, isLoading: isLoadingEvents } = useCollection<VehicleEvent>(eventsQuery);
  
  const isLoading = isLoadingMarkers || (eventIds.length > 0 && isLoadingEvents);
  
  const damageGroups = useMemo((): DamageGroup[] => {
    if (!markers || !events || !handoverTimestamp) return [];

    const handoverTime = getMillis(handoverTimestamp);
    const eventsMap = new Map(events.map(e => [e.id, e]));
    const driversMap = new Map(drivers.map(d => [d.id, `${d.first_name} ${d.last_name}`]));

    const groups: Record<string, Omit<DamageGroup, 'eventId'>> = {};

    markers.forEach(marker => {
      const event = eventsMap.get(marker.eventId);
      if (!event || !event.due_date) return;

      const eventTime = getMillis(event.due_date);
      if (eventTime > handoverTime) return;

      if (!groups[marker.eventId]) {
        groups[marker.eventId] = {
          title: event.title,
          date: new Date(eventTime),
          color: generateColorFromEventId(marker.eventId),
          driverName: event.driverId ? (driversMap.get(event.driverId) || 'Unbekannt') : 'Unbekannt',
          markers: [],
        };
      }
      groups[marker.eventId].markers.push(marker);
    });

    return Object.entries(groups)
      .map(([eventId, groupData]) => ({ eventId, ...groupData }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

  }, [markers, events, handoverTimestamp, drivers]);

  const displayedMarkers = useMemo(() => {
    if (activeEventId) {
      return damageGroups.find(g => g.eventId === activeEventId)?.markers || [];
    }
    return damageGroups.flatMap(g => g.markers.map(m => ({ ...m, color: g.color })));
  }, [damageGroups, activeEventId]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Vorschäden zum Zeitpunkt der Übergabe</CardTitle>
        <CardDescription>
          Alle am Fahrzeug erfassten Schäden, die vor oder zum Zeitpunkt dieser Übergabe dokumentiert wurden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {damageGroups.length > 0 && (
            <div className="mb-4 space-y-2">
                <h4 className="text-sm font-medium">Legende der Schadensfälle</h4>
                 <div className="flex flex-wrap gap-2">
                    <Badge 
                        onClick={() => setActiveEventId(null)}
                        className={cn('cursor-pointer', !activeEventId ? 'border-primary border-2' : 'border-transparent')}
                        variant={!activeEventId ? 'default' : 'secondary'}
                    >
                        Alle anzeigen
                    </Badge>
                    {damageGroups.map(group => (
                        <div 
                            key={group.eventId}
                            onClick={() => setActiveEventId(group.eventId)}
                            className={cn("flex items-center gap-2 p-1.5 rounded-md cursor-pointer border-2 transition-colors", 
                                activeEventId === group.eventId ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent'
                            )}
                        >
                            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }}></div>
                            <span className="text-xs font-medium">{group.title} ({group.driverName})</span>
                        </div>
                    ))}
                 </div>
            </div>
        )}

        <div
          className="relative w-full border rounded-md overflow-hidden bg-white"
          style={{ aspectRatio: '1280 / 720' }}
        >
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/50">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <img
            src="/vehicle-views/transporter-sheet.png"
            alt="Fahrzeug Schadensübersicht"
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
          {displayedMarkers.map((m) => {
            const group = damageGroups.find(g => g.eventId === m.eventId);
            const color = activeEventId ? group?.color : m.color;
            if (!color) return null;

            const style = {
              left: `${m.xPct}%`,
              top: `${m.yPct}%`,
            } as React.CSSProperties;

            const date = group ? format(group.date, 'dd.MM.yyyy') : '';
            const title = group ? group.title : '';

            return (
              <div key={m.id} style={style} className="group absolute z-10 -translate-x-1/2 -translate-y-1/2">
                <div
                  className="rounded-full shadow-md"
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: color,
                    border: '2px solid white',
                  }}
                  title={`${title} - ${STATUS_LABELS[m.status] || m.status}${m.note ? ' • ' + m.note : ''}`}
                />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-sm shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <p className='font-bold'>{title} ({date})</p>
                  {m.note && <p>{m.note}</p>}
                  <p>Status: {STATUS_LABELS[m.status]}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        {!isLoading && markers?.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
                Für dieses Fahrzeug sind keine Schäden erfasst.
            </div>
        )}
      </CardContent>
    </Card>
  );
}
