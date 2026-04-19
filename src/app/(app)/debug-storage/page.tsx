'use client';

import { useState, useRef } from 'react';
import { useStorage } from '@/firebase';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Upload, PlayCircle, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Erweiterte Diagnose-Seite für Firebase Storage Uploads.
 * Fokus: Detailliertes Monitoring von Hängern bei uploadBytes (Test B).
 */

export default function DebugStoragePage() {
  const storage = useStorage();
  const auth = getAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'error' | 'success' | 'system' | 'warning' }[]>([]);
  const [progress, setProgress] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' | 'system' | 'warning' = 'info') => {
    console.log(`[STORAGE-DEBUG] ${msg}`);
    setLogs(prev => [{ msg: `${new Date().toLocaleTimeString()}: ${msg}`, type }, ...prev]);
  };

  const logSystemState = (methodName: string) => {
    addLog(`--- Test Start: ${methodName} ---`, 'system');
    addLog(`Storage Instanz vorhanden: ${!!storage}`, storage ? 'success' : 'error');
    if (storage) {
        // @ts-ignore - access internal config for debug only
        addLog(`Bucket: ${storage.app.options.storageBucket}`, 'info');
    }
    
    const user = auth.currentUser;
    addLog(`Firebase Auth User (UID): ${user ? user.uid : 'null'}`, user ? 'info' : 'error');
    if (user) {
        addLog(`Auth Anonymous: ${user.isAnonymous}`, 'info');
    }

    if (!file) {
        addLog("FEHLER: Keine Datei ausgewählt!", "error");
        return false;
    }
    return true;
  };

  // TEST 1: uploadBytesResumable
  const runResumableTest = async () => {
    if (!logSystemState('uploadBytesResumable')) return;
    if (!storage || !file) return;

    setIsTesting(true);
    setProgress(0);
    const path = `test/resumable_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);

    addLog(`Initialisiere resumable upload nach: ${path}...`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(p);
        addLog(`Progress: ${p}% (${snapshot.bytesTransferred} / ${snapshot.totalBytes} Bytes) - Status: ${snapshot.state}`);
      }, 
      (error) => {
        addLog(`UPLOAD FEHLGESCHLAGEN! Code: ${error.code}`, 'error');
        addLog(`Message: ${error.message}`, 'error');
        console.error("Full Error Object:", error);
        setIsTesting(false);
      }, 
      async () => {
        addLog(`UPLOAD ERFOLGREICH!`, 'success');
        try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            addLog(`Download-URL erhalten: ${url.substring(0, 60)}...`, 'success');
        } catch (e: any) {
            addLog(`Fehler beim Holen der URL: ${e.message}`, 'error');
        }
        setIsTesting(false);
      }
    );
  };

  // TEST 2: uploadBytes (Der "einfache" Test mit Watchdog)
  const runSimpleTest = async () => {
    if (!logSystemState('uploadBytes')) return;
    if (!storage || !file) return;

    setIsTesting(true);
    setProgress(0);
    const path = `test/simple_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);

    addLog(`uploadBytes wird jetzt aufgerufen nach: ${path}`, 'system');

    // Watchdog Timer
    const timeout10 = setTimeout(() => {
        addLog("TIMEOUT (10s): uploadBytes hat nach 10 Sekunden weder Erfolg noch Fehler geliefert!", "warning");
    }, 10000);

    const timeout30 = setTimeout(() => {
        addLog("TIMEOUT (30s): uploadBytes hängt weiterhin ohne Rückgabe. Browser blockiert wahrscheinlich den Request.", "error");
    }, 30000);

    try {
        addLog("Sende Daten-Paket an Firebase Storage...", "info");
        const result = await uploadBytes(storageRef, file);
        
        // Timer löschen, wenn Ergebnis kommt
        clearTimeout(timeout10);
        clearTimeout(timeout30);
        
        setProgress(100);
        addLog(`uploadBytes erfolgreich beendet!`, 'success');
        addLog(`Finaler Pfad in Cloud: ${result.metadata.fullPath}`, 'info');
        
        addLog("Hole Download-URL...", "info");
        const url = await getDownloadURL(result.ref);
        addLog(`Download-URL erhalten: ${url}`, 'success');
    } catch (error: any) {
        clearTimeout(timeout10);
        clearTimeout(timeout30);
        
        addLog(`UPLOAD FEHLGESCHLAGEN! (Exception abgefangen)`, 'error');
        addLog(`Error-Code: ${error.code || 'kein code'}`, 'error');
        addLog(`Error-Message: ${error.message || 'keine message'}`, 'error');
        
        if (error.stack) {
            addLog(`Stack-Trace (Auszug): ${error.stack.substring(0, 150)}...`, 'error');
        }
        
        console.error("Full Error Object in Test B:", error);
    } finally {
        setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500 rounded-lg text-white">
            <Terminal className="h-6 w-6" />
        </div>
        <div>
            <h1 className="text-2xl font-black italic">Advanced Storage Debug</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Watchdog & Timeout Monitoring</p>
        </div>
      </div>

      <Card className="border-2 border-primary/10">
        <CardHeader>
          <CardTitle className="text-base">1. Test-Datei wählen</CardTitle>
          <CardDescription>Wählen Sie eine kleine Datei (z.B. &lt; 1 MB).</CardDescription>
        </CardHeader>
        <CardContent>
          <Input 
            type="file" 
            onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                    setFile(selected);
                    addLog(`Datei geladen: ${selected.name} (${selected.size} Bytes)`, 'system');
                }
            }} 
            ref={fileInputRef}
            disabled={isTesting}
            className="h-12 border-dashed"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={cn(isTesting ? "opacity-50" : "hover:border-primary/50 transition-colors shadow-sm")}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Upload className="h-4 w-4 text-blue-500" /> Test A: Resumable
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Button onClick={runResumableTest} disabled={isTesting || !file} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold">
                    Start Resumable
                </Button>
            </CardContent>
        </Card>

        <Card className={cn(isTesting ? "opacity-50" : "hover:border-primary/50 transition-colors shadow-sm")}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                    <PlayCircle className="h-4 w-4" /> Test B: Simple (Watchdog)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Button onClick={runSimpleTest} disabled={isTesting || !file} className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold">
                    Start Simple Test
                </Button>
            </CardContent>
        </Card>
      </div>

      {(isTesting || progress > 0) && (
          <div className="space-y-2 animate-in fade-in">
              <div className="flex justify-between text-xs font-black uppercase tracking-widest text-primary">
                  <span className="flex items-center gap-2"><Clock className="h-3 w-3 animate-spin" /> Übertragung läuft...</span>
                  <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-3 rounded-full" />
          </div>
      )}

      <Card className="border-none shadow-2xl bg-zinc-950 text-zinc-100 overflow-hidden ring-1 ring-white/10">
        <CardHeader className="border-b border-white/10 bg-zinc-900/50 py-3">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-zinc-400">
                <Terminal className="h-3 w-3" /> Echtzeit Diagnose Protokoll
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="h-[450px] p-4 font-mono text-[11px] leading-relaxed">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                        <Terminal className="h-12 w-12 mb-2" />
                        <p className="italic">Warte auf Test-Start...</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {logs.map((log, i) => (
                            <div key={i} className={cn(
                                "border-l-2 pl-3 py-1 mb-1",
                                log.type === 'error' ? "border-red-500 text-red-400 bg-red-500/10" :
                                log.type === 'warning' ? "border-amber-500 text-amber-400 bg-amber-500/10 font-bold" :
                                log.type === 'success' ? "border-green-500 text-green-400 bg-green-500/5" :
                                log.type === 'system' ? "border-blue-500 text-blue-400 bg-blue-500/5 font-bold" :
                                "border-zinc-700 text-zinc-300"
                            )}>
                                {log.msg}
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] uppercase tracking-wider font-bold text-muted-foreground p-4 bg-muted/30 rounded-xl border">
          <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
              <p>Wenn nach "uploadBytes wird jetzt aufgerufen" nichts passiert, liegt ein stiller Timeout vor.</p>
          </div>
          <div className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <p>Erfolg in Test B bestätigt die grundsätzliche Verbindung zum Bucket.</p>
          </div>
      </div>
    </div>
  );
}
