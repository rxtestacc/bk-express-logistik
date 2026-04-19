
'use client';

import React, { useRef, useState, MouseEvent, useMemo } from 'react';
import { useDamageMarkers, type DamageMarker, type VehicleEventForMarker } from './use-damage-markers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

type DraftMarker = {
  xPct: number;
  yPct: number;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#EF4444',
  in_progress: '#F59E0B',
  done: '#10B981',
};

const DRAFT_MARKER_COLOR = '#3B82F6'; // Blue

export default function DamageMap({
  vehicleId,
  eventId,
  canEdit = true,
}: {
  vehicleId: string;
  eventId: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const { session } = useSession();
  const userName = session?.name || 'unbekannt';
  const { toast } = useToast();

  const [mode, setMode] = useState<'current' | 'history'>('current');
  const [draftMarkers, setDraftMarkers] = useState<DraftMarker[]>([]);
  const [draftNote, setDraftNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { firestore, currentMarkers: currentMarkersRaw, vehicleMarkers: vehicleMarkersRaw, vehicleEvents, isLoading: isLoadingMarkers, addMarker, removeMarker } = useDamageMarkers({ vehicleId, eventId });

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !eventId) return null;
    return doc(firestore, 'vehicle_events', eventId);
  }, [firestore, eventId]);

  const { data: eventData, isLoading: isLoadingEvent } = useDoc<{ due_date: Timestamp, title: string }>(eventRef);
  
  const eventsMap = useMemo(() => {
    if (!vehicleEvents) return new Map<string, VehicleEventForMarker>();
    return new Map(vehicleEvents.map(e => [e.id, e]));
  }, [vehicleEvents]);

  const isLoading = isLoadingMarkers || isLoadingEvent;

  const currentMarkers = useMemo(() => currentMarkersRaw || [], [currentMarkersRaw]);
  
  const historyMarkers = useMemo(() => {
    if (!vehicleMarkersRaw) return [];
    return vehicleMarkersRaw
        .filter(m => m.eventId !== eventId)
        .map(m => ({ ...m, event: eventsMap.get(m.eventId) })) // Attach event data
        .filter((m): m is DamageMarker & { event: VehicleEventForMarker } => !!m.event); // Type guard to ensure event is not undefined
  }, [vehicleMarkersRaw, eventId, eventsMap]);


  const imgRef = useRef<HTMLImageElement>(null);

  const isClickable = canEdit && mode === 'current';
  
  const handleMarkerClick = (e: MouseEvent, eventIdToNav: string) => {
    e.stopPropagation();
    if (eventIdToNav) {
      router.push(`/ereignisse/${eventIdToNav}`);
    }
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!isClickable) return;
    const imgEl = imgRef.current;
    if (!imgEl) return;

    const imgRect = imgEl.getBoundingClientRect();
    const x = e.clientX - imgRect.left;
    const y = e.clientY - imgRect.top;

    if (x < 0 || x > imgRect.width || y < 0 || y > imgRect.height) {
      return;
    }

    const xPct = Math.max(0, Math.min(100, (x / imgRect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (y / imgRect.height) * 100));

    setDraftMarkers(prev => [...prev, { xPct, yPct }]);
  };

  const handleMarkerContext = async (e: MouseEvent, id: string) => {
    e.preventDefault();
    if (!canEdit || mode !== 'current') return;
    if (confirm('Diesen Marker löschen?')) {
      await removeMarker(id, userName);
    }
  };

  const handleDraftMarkerContext = (e: MouseEvent, index: number) => {
    e.preventDefault();
    if (!isClickable) return;
    setDraftMarkers(prev => prev.filter((_, i) => i !== index));
  };
  
  const saveDraftMarkers = async () => {
    if (!draftMarkers?.length || isSaving) return;
    if (!vehicleId || !eventId) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Fehlende Fahrzeug- oder Ereignis-ID zum Speichern.' });
      return;
    }
    try {
      setIsSaving(true);
      await Promise.all(
        draftMarkers.map(dm =>
          addMarker(
            {
              vehicleId,
              eventId,
              xPct: dm.xPct,
              yPct: dm.yPct,
              status: 'open',
              note: draftNote,
            },
            userName
          )
        )
      );
      setDraftMarkers([]);
      setDraftNote('');
    } catch (err) {
      console.error('Speichern fehlgeschlagen – Drafts bleiben sichtbar:', err);
      toast({ variant: 'destructive', title: 'Fehler beim Speichern', description: 'Die Marker konnten nicht gespeichert werden.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardDrafts = () => {
    if (isSaving) return;
    setDraftMarkers([]);
    setDraftNote('');
  };

  const handleModeChange = (newMode: 'current' | 'history') => {
      setMode(newMode);
      if (newMode === 'current') {
          setShowHistory(false);
      }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <CardTitle>Schadenskizze</CardTitle>
         <div className="flex flex-wrap items-center gap-2">
          <div className="ml-auto flex gap-2">
            <Button
              variant={mode === 'current' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeChange('current')}
            >
              Dieser Schaden
            </Button>
            <Button
              variant={mode === 'history' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleModeChange('history')}
            >
              Vorschäden
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Legende:</span>
          <Badge className="bg-[#EF4444] hover:bg-[#EF4444]">Offen</Badge>
          <Badge className="bg-[#F59E0B] hover:bg-[#F59E0B]">In Bearbeitung</Badge>
          <Badge className="bg-[#10B981] hover:bg-[#10B981]">Erledigt</Badge>
          <Badge className="bg-[#3B82F6] hover:bg-[#3B82F6]">Neuer Marker (Entwurf)</Badge>
          {mode === 'history' && <span>(Vorschäden werden halbtransparent angezeigt)</span>}
        </div>
      </CardHeader>

      <CardContent>
        {isClickable && draftMarkers.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-end gap-2 mb-2">
            <Input 
              placeholder="Notiz für neue Marker (z.B. Kratzer)"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              className="flex-1"
              disabled={isSaving}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleDiscardDrafts} disabled={isSaving}>Verwerfen</Button>
              <Button size="sm" onClick={saveDraftMarkers} disabled={isSaving}>
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Speichere...</> : 'Speichern'}
              </Button>
            </div>
          </div>
        )}
        <div
          onClick={handleClick}
          className={cn(
            'relative w-full border rounded-md overflow-hidden bg-white',
            isClickable ? 'cursor-crosshair' : 'cursor-default'
          )}
          style={{ aspectRatio: '1280 / 720' }}
          title={isClickable ? 'Klicken um Marker zu setzen' : undefined}
        >
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/50">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <img
            ref={imgRef}
            src="/vehicle-views/transporter-sheet.png"
            alt="Fahrzeug Schadensübersicht"
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
          {/* Saved Markers for the current event */}
            {mode === 'current' && currentMarkers.map((m) => {
            const color = m.color || STATUS_COLORS[m.status] || '#808080';
            const style = {
              left: `${m.xPct}%`,
              top: `${m.yPct}%`,
            } as React.CSSProperties;
            const date = eventData?.due_date ? format(eventData.due_date.toDate(), 'dd.MM.yyyy') : '';
            const title = eventData?.title || 'Aktueller Schaden';

            return (
              <div key={`saved-${m.id}`} style={style} className="group absolute z-10 -translate-x-1/2 -translate-y-1/2">
                <div
                    onClick={(e) => handleMarkerClick(e, m.eventId)}
                    onContextMenu={(e) => handleMarkerContext(e, m.id)}
                    className="rounded-full shadow-md cursor-pointer"
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: color,
                      border: '2px solid white',
                    }}
                    title={`${title} - ${STATUS_LABELS[m.status] || m.status}${m.note ? ' • ' + m.note : ''} (Linksklick: Details, Rechtsklick: Löschen)`}
                />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-sm shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className='font-bold'>{title} ({date})</p>
                    {m.note && <p>{m.note}</p>}
                    <p>Status: {STATUS_LABELS[m.status]}</p>
                </div>
              </div>
            );
          })}

          {/* History Markers */}
           {mode === 'history' && historyMarkers.map((m) => {
            const color = m.color || STATUS_COLORS[m.status] || '#808080';
            const style = {
              left: `${m.xPct}%`,
              top: `${m.yPct}%`,
            } as React.CSSProperties;
            const date = m.event.due_date ? format(m.event.due_date.toDate(), 'dd.MM.yyyy') : '';
            const title = m.event.title || 'Vorschaden';

            return (
              <div key={`history-${m.id}`} style={style} className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 opacity-50">
                 <div
                    onClick={(e) => handleMarkerClick(e, m.eventId)}
                    className="rounded-full shadow-md cursor-pointer"
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: color,
                      border: '2px solid white',
                    }}
                    title={`${title} - ${STATUS_LABELS[m.status] || m.status}${m.note ? ' • ' + m.note : ''} (Vorschaden - Klicken für Details)`}
                  />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-sm shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {date && <p className='font-bold'>{title} ({date})</p>}
                    {m.note && <p>{m.note}</p>}
                    <p>Status: {STATUS_LABELS[m.status]}</p>
                 </div>
              </div>
            );
          })}

          {/* Draft Markers */}
          {isClickable && draftMarkers.map((draft, index) => (
             <div
                key={`draft-${index}-${draft.xPct}-${draft.yPct}`}
                onContextMenu={(e) => handleDraftMarkerContext(e, index)}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${draft.xPct}%`,
                  top: `${draft.yPct}%`,
                }}
              >
                 <div
                    className="rounded-full shadow-md"
                    style={{
                        width: 16,
                        height: 16,
                        backgroundColor: DRAFT_MARKER_COLOR,
                        border: '2px solid white',
                        cursor: 'pointer',
                    }}
                    title="Neuer Marker (Rechtsklick zum Entfernen)"
                 />
              </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isClickable ? 'Klicken um Marker zu setzen. Rechtsklick auf einen Marker löscht ihn.' : 'Klicken auf Marker öffnet den zugehörigen Schadensfall.'}
        </p>
      </CardContent>
    </Card>
  );
}
