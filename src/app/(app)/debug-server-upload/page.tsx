'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Upload, Server, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Diagnose-Seite für serverseitige Uploads.
 * Umgeht den direkten Browser-zu-Bucket Datenstrom.
 */

export default function DebugServerUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'error' | 'success' | 'system' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' | 'system' = 'info') => {
    setLogs(prev => [{ msg: `${new Date().toLocaleTimeString()}: ${msg}`, type }, ...prev]);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);
    addLog(`Bereite Upload vor: ${file.name} (${file.size} Bytes)`, 'system');
    addLog(`Sende Datei an /api/debug-upload...`, 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/debug-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        addLog(`API ERFOLG: Datei serverseitig übertragen!`, 'success');
        addLog(`Pfad: ${data.path}`, 'info');
        addLog(`URL: ${data.downloadUrl.substring(0, 50)}...`, 'success');
      } else {
        addLog(`API FEHLER: ${data.error}`, 'error');
        if (data.code) addLog(`Fehler-Code: ${data.code}`, 'error');
      }
    } catch (error: any) {
      addLog(`NETZWERK FEHLER: Verbindung zur API fehlgeschlagen.`, 'error');
      addLog(error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg">
            <Server className="h-6 w-6" />
        </div>
        <div>
            <h1 className="text-2xl font-black italic">Server-Upload Diagnose</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Browser-zu-Storage Bypass Test</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
            <Card className="border-2 border-indigo-500/10">
                <CardHeader>
                <CardTitle className="text-base">1. Test-Datei wählen</CardTitle>
                <CardDescription>Die Datei wird an unseren Server gesendet, der sie dann an Firebase weiterreicht.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <Input 
                    type="file" 
                    onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        setFile(selected);
                        if (selected) addLog(`Datei ausgewählt: ${selected.name}`, 'info');
                    }}
                    disabled={isUploading}
                    className="h-12 border-dashed"
                />
                <Button 
                    onClick={handleUpload} 
                    disabled={!file || isUploading}
                    className="w-full h-14 text-lg font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl rounded-xl transition-all active:scale-95"
                >
                    {isUploading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Upload className="mr-2 h-6 w-6" />}
                    JETZT SERVER-UPLOAD STARTEN
                </Button>
                </CardContent>
            </Card>

            <Card className="bg-zinc-950 text-zinc-100 overflow-hidden border-none shadow-2xl ring-1 ring-white/10">
                <CardHeader className="border-b border-white/10 bg-zinc-900/50 py-3">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-zinc-400">
                        <Terminal className="h-3 w-3" /> Kommunikations-Protokoll
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[350px] p-4 font-mono text-[11px] leading-relaxed">
                        {logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                                <Server className="h-12 w-12 mb-2" />
                                <p className="italic">Warte auf Test-Start...</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {logs.map((log, i) => (
                                    <div key={i} className={cn(
                                        "border-l-2 pl-3 py-1 mb-1",
                                        log.type === 'error' ? "border-red-500 text-red-400 bg-red-500/10" :
                                        log.type === 'success' ? "border-green-500 text-green-400 bg-green-500/5" :
                                        log.type === 'system' ? "border-indigo-500 text-indigo-400 font-bold" :
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
        </div>

        <div className="space-y-6">
            <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Warum dieser Test?</CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] leading-relaxed text-indigo-900 dark:text-indigo-300 space-y-2">
                    <p>Wenn dieser Test **funktioniert**, liegt das Problem an der direkten Netzwerkverbindung deines Browsers zu den Firebase-Servern (z.B. Proxy oder Firewall in der Cloud-Workstation).</p>
                    <p>Wenn dieser Test **auch fehlschlägt**, liegt das Problem tiefer (z.B. falsche Bucket-Konfiguration oder generelle Firebase-Ablehnung).</p>
                </CardContent>
            </Card>

            {result && (
                <div className="animate-in slide-in-from-right-4">
                    <Card className={cn("border-2 shadow-lg", result.success ? "border-green-500/20" : "border-red-500/20")}>
                        <CardHeader className="py-3 border-b">
                            <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2">
                                {result.success ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
                                Server Rohdaten
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                            <pre className="text-[9px] font-mono bg-muted/50 p-2 rounded overflow-auto max-h-40">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
