'use client';

import { useState, useRef, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
    UploadCloud, 
    FileText, 
    Loader2, 
    Wand2,
    CheckCircle2,
    X,
    Car,
    User,
    FileIcon
} from 'lucide-react';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { useDashboardData } from '@/components/dashboard/dashboard-data-provider';
import { analyzeDocumentInfo } from '@/ai/flows/extract-document-info-flow';
import { cn } from '@/lib/utils';

interface DocumentManagerProps {
    entityId?: string;
    entityType?: 'vehicle' | 'driver';
    relatedEntityId?: string;
    relatedEntityType?: 'contract' | 'task' | 'event' | 'handover';
    onClose?: () => void;
}

const CATEGORIES = [
    { value: 'rechnung', label: 'Rechnung' },
    { value: 'gutachten', label: 'Gutachten' },
    { value: 'fahrzeugschein', label: 'Fahrzeugschein' },
    { value: 'kauf', label: 'Kaufvertrag' },
    { value: 'leasing', label: 'Leasingvertrag' },
    { value: 'versicherung', label: 'Versicherung' },
    { value: 'fuehrerschein', label: 'Führerschein' },
    { value: 'ausweis', label: 'Ausweis' },
    { value: 'vertrag', label: 'Arbeitsvertrag' },
    { value: 'handbuch', label: 'Handbuch' },
    { value: 'sonstiges', label: 'Sonstiges' },
];

export function DocumentManager({ entityId, entityType, relatedEntityId, relatedEntityType, onClose }: DocumentManagerProps) {
    const firestore = useFirestore();
    const { session } = useSession();
    const { toast } = useToast();
    const { vehicles, drivers } = useDashboardData();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<string>('sonstiges');
    const [targetType, setInternalTargetType] = useState<'vehicle' | 'driver' | 'general'>(entityType || 'vehicle');
    const [targetId, setInternalTargetId] = useState<string>(entityId || '');

    // Reset when props change
    useEffect(() => {
        if (entityId) setInternalTargetId(entityId);
        if (entityType) setInternalTargetType(entityType);
    }, [entityId, entityType]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setTitle(file.name.split('.')[0]);
        }
    };

    const handleAIAnalyze = async () => {
        if (!selectedFile) return;
        setIsAnalyzing(true);
        try {
            const dataUri = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(selectedFile);
            });

            const result = await analyzeDocumentInfo({ fileDataUri: dataUri });
            
            if (result) {
                if (result.title) setTitle(result.title);
                if (CATEGORIES.some(c => c.value === result.category)) {
                    setCategory(result.category);
                }
                
                // Automatisches Matching nur wenn nicht bereits eine ID fest vorgegeben ist
                if (!entityId) {
                    if (result.suggestedVehiclePlate) {
                        const plateClean = result.suggestedVehiclePlate.replace(/[^a-z0-9]/gi, '').toLowerCase();
                        const match = vehicles.find(v => v.license_plate.replace(/[^a-z0-9]/gi, '').toLowerCase().includes(plateClean));
                        if (match) {
                            setInternalTargetType('vehicle');
                            setInternalTargetId(match.id);
                            toast({ title: 'KI-Treffer: Fahrzeug', description: match.license_plate });
                        }
                    } else if (result.suggestedDriverName) {
                        const nameLower = result.suggestedDriverName.toLowerCase();
                        const match = drivers.find(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(nameLower));
                        if (match) {
                            setInternalTargetType('driver');
                            setInternalTargetId(match.id);
                            toast({ title: 'KI-Treffer: Fahrer', description: `${match.first_name} ${match.last_name}` });
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("AI Analysis failed, continuing manual", e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpload = async () => {
        if (!firestore || !session || !selectedFile) {
            toast({ variant: 'destructive', title: 'System nicht bereit', description: 'Bitte stellen Sie sicher, dass eine Datei ausgewählt ist.' });
            return;
        }
        
        if (!title.trim()) {
            toast({ variant: 'destructive', title: 'Titel fehlt', description: 'Geben Sie dem Dokument einen Namen.' });
            return;
        }

        setIsProcessing(true);
        setUploadProgress(1);

        try {
            const folder = targetType === 'general' ? 'general' : `${targetType}s/${targetId || 'unassigned'}`;
            const safeFileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const storagePath = `uploads/${folder}/${category}/${safeFileName}`;
            
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('path', storagePath);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(progress);
                }
            };

            xhr.onload = async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            const docData = {
                                title: title.trim(),
                                category,
                                fileName: selectedFile.name,
                                fileType: selectedFile.type,
                                fileSize: selectedFile.size,
                                storagePath: response.path,
                                downloadUrl: response.downloadUrl,
                                uploaded_at: serverTimestamp(),
                                uploaded_by_name: session.name,
                                vehicleId: targetType === 'vehicle' ? targetId : null,
                                driverId: targetType === 'driver' ? targetId : null,
                                // Neue Verknüpfungsfelder
                                relatedEntityId: relatedEntityId || null,
                                relatedEntityType: relatedEntityType || null,
                            };

                            const collectionName = targetType === 'driver' ? 'driver_documents' : 'vehicle_documents';
                            await setDoc(doc(collection(firestore, collectionName)), docData);

                            toast({ title: 'Erfolgreich gespeichert', description: `"${title}" ist nun im System.` });
                            setIsProcessing(false);
                            onClose?.();
                        } else {
                            toast({ variant: 'destructive', title: 'Upload-Fehler', description: response.error });
                            setIsProcessing(false);
                        }
                    } catch (e) {
                        toast({ variant: 'destructive', title: 'Server-Antwort ungültig' });
                        setIsProcessing(false);
                    }
                } else {
                    toast({ variant: 'destructive', title: 'Server-Fehler beim Upload' });
                    setIsProcessing(false);
                }
            };

            xhr.onerror = () => {
                toast({ variant: 'destructive', title: 'Netzwerk-Fehler' });
                setIsProcessing(false);
            };

            xhr.send(formData);

        } catch (err) {
            console.error("Critical Process Error:", err);
            toast({ variant: 'destructive', title: 'Fehler' });
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6 pb-10">
            {!selectedFile ? (
                <div className="space-y-4">
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-primary/20 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group">
                        <UploadCloud className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform mb-4" />
                        <div className="text-center px-6">
                            <p className="font-bold text-base">Datei auswählen</p>
                            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">PDF, Bilder, Dokumente</p>
                        </div>
                        <input type="file" className="hidden" onChange={handleFileChange} />
                    </label>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="p-3 bg-white rounded-xl shadow-sm">
                                {selectedFile.type.includes('pdf') ? <FileText className="h-6 w-6 text-red-500" /> : <FileIcon className="h-6 w-6 text-blue-500" />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{selectedFile.name}</p>
                                <p className="text-[10px] text-muted-foreground font-black uppercase">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        {!isProcessing && (
                            <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                            <div className="flex-1 w-full space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Name des Dokuments *</Label>
                                <Input 
                                    placeholder="z.B. Rechnung Inspektion" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)}
                                    disabled={isProcessing}
                                    className="h-12 rounded-xl bg-background border-primary/10"
                                />
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                className="w-full sm:w-auto h-12 border-primary/20 text-primary hover:bg-primary/5 rounded-xl shadow-sm"
                                onClick={handleAIAnalyze}
                                disabled={isProcessing || isAnalyzing}
                            >
                                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                                KI-Analyse
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {!entityId && (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Zuordnungstyp</Label>
                                    <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-xl">
                                        <Button 
                                            variant={targetType === 'vehicle' ? 'secondary' : 'ghost'} 
                                            size="sm" 
                                            className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'vehicle' && "bg-background shadow-sm")}
                                            onClick={() => setInternalTargetType('vehicle')}
                                            disabled={isProcessing}
                                        >
                                            <Car className="h-3.5 w-3.5 mr-1" /> FZG
                                        </Button>
                                        <Button 
                                            variant={targetType === 'driver' ? 'secondary' : 'ghost'} 
                                            size="sm" 
                                            className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'driver' && "bg-background shadow-sm")}
                                            onClick={() => setInternalTargetType('driver')}
                                            disabled={isProcessing}
                                        >
                                            <User className="h-3.5 w-3.5 mr-1" /> Fahrer
                                        </Button>
                                        <Button 
                                            variant={targetType === 'general' ? 'secondary' : 'ghost'} 
                                            size="sm" 
                                            className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'general' && "bg-background shadow-sm")}
                                            onClick={() => { setInternalTargetType('general'); setInternalTargetId(''); }}
                                            disabled={isProcessing}
                                        >
                                            Allgemein
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5 flex-1">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Kategorie</Label>
                                <Select value={category} onValueChange={setCategory} disabled={isProcessing}>
                                    <SelectTrigger className="h-12 rounded-xl bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[200]">
                                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {!entityId && targetType !== 'general' && (
                            <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                    {targetType === 'vehicle' ? 'Fahrzeug auswählen *' : 'Fahrer auswählen *'}
                                </Label>
                                <Select value={targetId} onValueChange={setInternalTargetId} disabled={isProcessing}>
                                    <SelectTrigger className="h-12 rounded-xl bg-background border-primary/20">
                                        <SelectValue placeholder="Bitte wählen..." />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[200]">
                                        {targetType === 'vehicle' 
                                            ? vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make})</SelectItem>)
                                            : drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.last_name}, {d.first_name}</SelectItem>)
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {uploadProgress > 0 && (
                        <div className="space-y-2 py-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                <span>{uploadProgress < 100 ? 'Übertragung...' : 'Finalisierung...'}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-2.5 rounded-full" />
                        </div>
                    )}

                    <Button 
                        onClick={handleUpload} 
                        disabled={isProcessing || isAnalyzing || !title} 
                        className="w-full h-16 rounded-2xl shadow-xl text-lg font-black bg-primary hover:bg-primary/90"
                    >
                        {isProcessing ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <CheckCircle2 className="h-6 w-6 mr-3" />}
                        {isProcessing ? 'Wird übertragen...' : 'Jetzt hochladen & speichern'}
                    </Button>
                </div>
            )}
        </div>
    );
}
