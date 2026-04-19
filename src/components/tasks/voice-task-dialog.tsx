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
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, RefreshCw, ShieldAlert, Wrench, ClipboardList, User, Calendar, Search } from 'lucide-react';
import { processVoiceTask, type ProcessVoiceTaskOutput } from '@/ai/flows/process-voice-task-flow';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { generateAuditLog } from '@/lib/audit-log';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, setHours, setMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import DateInput from '../ui/DateInput';
import { ScrollArea } from '../ui/scroll-area';

interface VoiceTaskDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: () => void;
  mode?: 'task' | 'maintenance' | 'damage' | 'auto';
}

type ViewState = 'idle' | 'recording' | 'processing' | 'review' | 'saving';

export function VoiceTaskDialog({ isOpen, onOpenChange, onTaskCreated, mode = 'auto' }: VoiceTaskDialogProps) {
  const { toast } = useToast();
  const { session } = useSession();
  const firestore = useFirestore();
  
  const [viewState, setViewState] = useState<ViewState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [extractedData, setExtractedData] = useState<ProcessVoiceTaskOutput | null>(null);
  
  // Editable Fields
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [assigneeName, setAssigneeName] = useState<string>('');
  const [resolvedDate, setResolvedDate] = useState<Timestamp | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const vehiclesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'vehicles'), orderBy('license_plate')) : null, [firestore]);
  const { data: vehicles } = useCollection(vehiclesQuery);

  const driversQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'drivers'), orderBy('last_name')) : null, [firestore]);
  const { data: drivers } = useCollection(driversQuery);

  const pinsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'pins'), where('active', '==', true)) : null, [firestore]);
  const { data: systemUsers } = useCollection(pinsQuery);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setViewState('idle');
    setRecordingTime(0);
    setExtractedData(null);
    setEditedTitle('');
    setEditedDescription('');
    setSelectedVehicleId('');
    setSelectedDriverId('');
    setAssigneeName('');
    setResolvedDate(null);
    chunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setViewState('recording');
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing mic:", err);
      toast({ variant: 'destructive', title: 'Mikrofonfehler', description: 'Zugriff wurde verweigert.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && viewState === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const processAudio = async (blob: Blob) => {
    setViewState('processing');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
          const result = await processVoiceTask({ audioDataUri: base64Audio });
          setExtractedData(result);
          setEditedTitle(result.title);
          setEditedDescription(result.description);
          
          // 1. Vehicle Matching
          if (result.licensePlateHint && vehicles) {
            const hint = result.licensePlateHint.toLowerCase().replace(/[^a-z0-9]/g, '');
            const match = vehicles.find(v => {
                const plate = v.license_plate.toLowerCase().replace(/[^a-z0-9]/g, '');
                return plate.includes(hint) || hint.includes(plate);
            });
            if (match) {
                setSelectedVehicleId(match.id);
            }
          }

          // 2. Assignee/Staff Matching (Pins) - Priority!
          if (result.driverHint && systemUsers) {
            const hint = result.driverHint.toLowerCase();
            const staffMatch = systemUsers.find(u => u.name.toLowerCase().includes(hint));
            if (staffMatch) {
                setAssigneeName(staffMatch.name);
            }
          }

          // 3. Driver Matching (Driver list) - only if explicit or no staff match
          if (result.driverHint && drivers && !assigneeName) {
            const hint = result.driverHint.toLowerCase();
            const match = drivers.find(d => 
                d.first_name.toLowerCase().includes(hint) || 
                d.last_name.toLowerCase().includes(hint)
            );
            if (match) {
                setSelectedDriverId(match.id);
            }
          }
          
          // Default assignee to current user if none matched
          if (!assigneeName && session) {
              setAssigneeName(session.name);
          }

          // 4. Date Resolution
          if (result.isoDate) {
              let date = parseISO(result.isoDate);
              if (result.isoTime) {
                  const [hours, minutes] = result.isoTime.split(':').map(Number);
                  date = setHours(setMinutes(date, minutes), hours);
              }
              setResolvedDate(Timestamp.fromDate(date));
          } else {
              // Default to tomorrow
              setResolvedDate(Timestamp.fromDate(new Date(Date.now() + 86400000)));
          }
          
          setViewState('review');
        } catch (error) {
          console.error("AI Processing error:", error);
          toast({ variant: 'destructive', title: 'Verarbeitungsfehler', description: 'KI konnte Nachricht nicht interpretieren.' });
          setViewState('idle');
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Reader error:", error);
      setViewState('idle');
    }
  };

  const handleSave = async () => {
    if (!firestore || !session || !extractedData) return;
    setViewState('saving');
    
    const effectiveCategory = mode !== 'auto' ? mode : extractedData.category;
    const finalDate = resolvedDate || Timestamp.now();

    try {
      if (effectiveCategory === 'task') {
        const payload = {
          title: editedTitle,
          description: editedDescription,
          status: 'open',
          due_date: finalDate,
          assignee_name: assigneeName || session.name, // Assign to staff user
          vehicleId: selectedVehicleId || undefined,
          driverId: selectedDriverId || undefined,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          created_by_name: session.name,
          created_via: 'voice',
        };
        const docRef = await addDoc(collection(firestore, 'tasks'), payload);
        await generateAuditLog(firestore, 'task', docRef.id, {}, payload, session.name, 'create');
      } else {
        const type = effectiveCategory === 'damage' ? 'damage' : 'service';
        const payload = {
          vehicleId: selectedVehicleId || '',
          driverId: selectedDriverId || undefined,
          type: type,
          title: editedTitle,
          due_date: finalDate,
          odometer_km: 0, 
          cost_eur: 0,
          status: 'open',
          notes: editedDescription,
          created_by_name: session.name,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          created_via: 'voice',
        };
        const docRef = await addDoc(collection(firestore, 'vehicle_events'), payload);
        await generateAuditLog(firestore, 'event', docRef.id, {}, payload, session.name, 'create');
      }

      toast({ title: 'Eintrag erstellt', description: 'Erfolgreich gespeichert.' });
      if (onTaskCreated) onTaskCreated();
      onOpenChange(false);
    } catch (error) {
      console.error("Save error:", error);
      toast({ variant: 'destructive', title: 'Fehler beim Speichern' });
      setViewState('review');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryBadge = () => {
      const cat = mode !== 'auto' ? mode : extractedData?.category;
      switch(cat) {
          case 'damage': return <Badge className="bg-red-600"><ShieldAlert className="w-3 h-3 mr-1" /> Schaden</Badge>;
          case 'maintenance': return <Badge className="bg-blue-600"><Wrench className="w-3 h-3 mr-1" /> Wartung</Badge>;
          default: return <Badge className="bg-gray-600"><ClipboardList className="w-3 h-3 mr-1" /> Aufgabe</Badge>;
      }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Intelligente Spracherfassung</DialogTitle>
          <DialogDescription>
            Sprechen Sie Kennzeichen, Mitarbeiternamen oder Termine einfach aus.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            {viewState === 'idle' && (
              <Button size="lg" className="h-24 w-24 rounded-full shadow-lg" onClick={startRecording}>
                <Mic className="h-10 w-10" />
              </Button>
            )}

            {viewState === 'recording' && (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <Button variant="destructive" size="lg" className="h-24 w-24 rounded-full relative z-10" onClick={stopRecording}>
                    <Square className="h-10 w-10 fill-current" />
                  </Button>
                </div>
                <p className="text-2xl font-mono font-bold text-red-500">{formatTime(recordingTime)}</p>
                <p className="text-sm text-muted-foreground animate-pulse">Aufnahme läuft...</p>
              </div>
            )}

            {viewState === 'processing' && (
              <div className="flex flex-col items-center space-y-4 py-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="font-medium">KI analysiert jedes Detail...</p>
              </div>
            )}

            {viewState === 'review' && extractedData && (
              <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600 font-semibold">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Entwurf prüfen</span>
                  </div>
                  {getCategoryBadge()}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="voice-title">Betreff</Label>
                    <Input 
                      id="voice-title" 
                      value={editedTitle} 
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voice-desc">Details / Notizen</Label>
                    <Textarea 
                      id="voice-desc" 
                      value={editedDescription} 
                      onChange={(e) => setEditedDescription(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" /> 
                        Zuständiger Mitarbeiter *
                      </Label>
                      <Select 
                        value={assigneeName} 
                        onValueChange={setAssigneeName}
                      >
                        <SelectTrigger className={cn(!assigneeName && "border-amber-500 bg-amber-50 dark:bg-amber-950/20")}>
                          <SelectValue placeholder="Mitarbeiter wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {systemUsers?.map(u => (
                            <SelectItem key={u.id} value={u.name}>{u.name} ({u.role})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-primary" /> 
                        Fahrzeug
                      </Label>
                      <Select 
                        value={selectedVehicleId || "none"} 
                        onValueChange={(val) => setSelectedVehicleId(val === "none" ? "" : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Fahrzeug wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Kein Bezug</SelectItem>
                          {vehicles?.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" /> 
                      Fälligkeit
                    </Label>
                    <DateInput 
                      value={resolvedDate} 
                      onChange={setResolvedDate} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/20 flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-2">
          {viewState === 'review' && (
            <>
              <Button variant="ghost" onClick={resetState} className="w-full sm:w-auto">
                <RefreshCw className="mr-2 h-4 w-4" /> Neu aufnehmen
              </Button>
              <Button onClick={handleSave} disabled={viewState === 'saving' || !assigneeName || !editedTitle} className="w-full sm:w-auto">
                {viewState === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Speichern
              </Button>
            </>
          )}
          {viewState === 'idle' && (
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
