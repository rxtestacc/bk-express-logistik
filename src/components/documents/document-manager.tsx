'use client';

import { useState, useEffect } from 'react';
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
    FileIcon,
    AlertTriangle
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

type UploadStatus = 'pending' | 'uploading' | 'processing' | 'success' | 'error';

interface MultiFileStatus {
    file: File;
    progress: number;
    status: UploadStatus;
    error?: string;
}

export function DocumentManager({ entityId, entityType, relatedEntityId, relatedEntityType, onClose }: DocumentManagerProps) {
    const firestore = useFirestore();
    const { session } = useSession();
    const { toast } = useToast();
    const { vehicles, drivers } = useDashboardData();

    // State for single file upload (existing logic)
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // State for multi-file upload
    const [multipleFiles, setMultipleFiles] = useState<MultiFileStatus[]>([]);
    const [isMultiUploading, setIsMultiUploading] = useState(false);

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<string>('sonstiges');
    const [targetType, setInternalTargetType] = useState<'vehicle' | 'driver' | 'general'>(entityType || 'vehicle');
    const [targetId, setInternalTargetId] = useState<string>(entityId || '');

    useEffect(() => {
        if (entityId) setInternalTargetId(entityId);
        if (entityType) setInternalTargetType(entityType);
    }, [entityId, entityType]);

    const resetSingleFileUploadState = () => {
        setSelectedFile(null);
        setUploadProgress(0);
        setIsProcessing(false);
        setTitle('');
        setCategory('sonstiges');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        resetSingleFileUploadState();
        setMultipleFiles([]);

        if (files.length === 1) {
            const file = files[0];
            setSelectedFile(file);
            setTitle(file.name.split('.').slice(0, -1).join('.'));
        } else {
            setMultipleFiles(Array.from(files).map(file => ({ file, progress: 0, status: 'pending' })));
        }
         e.target.value = ''; // Reset input to allow re-selecting same files
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
                if (CATEGORIES.some(c => c.value === result.category)) setCategory(result.category);
                
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
            console.warn("AI Analysis failed", e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Existing function for single file upload
    const handleUpload = async () => {
        if (!firestore || !session || !selectedFile) return;
        if (!title.trim()) {
            toast({ variant: 'destructive', title: 'Titel fehlt' });
            return;
        }

        setIsProcessing(true);
        setUploadProgress(1);

        await uploadFile(selectedFile, title, category, targetType, targetId, setUploadProgress, (error) => {
             if (error) {
                toast({ variant: 'destructive', title: 'Upload-Fehler', description: error });
             } else {
                toast({ title: 'Erfolgreich gespeichert' });
                onClose?.();
             }
             setIsProcessing(false);
        });
    };
    
    // New function for multi file upload
    const handleMultiUpload = async () => {
        if (!firestore || !session || isMultiUploading) return;
        if (targetType !== 'general' && !targetId) {
            toast({ variant: 'destructive', title: 'Zuordnung fehlt', description: 'Bitte wählen Sie eine Zuordnung aus.' });
            return;
        }

        setIsMultiUploading(true);

        for (let i = 0; i < multipleFiles.length; i++) {
            const currentFile = multipleFiles[i];
            
            const updateCurrentFileProgress = (progress: number) => {
                setMultipleFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress } : f));
            };

            const onUploadComplete = (error?: string) => {
                 setMultipleFiles(prev => prev.map((f, idx) => {
                    if (idx === i) {
                        return { ...f, status: error ? 'error' : 'success', error: error, progress: 100 };
                    }
                    return f;
                }));
            };
            
            setMultipleFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));
            
            await uploadFile(
                currentFile.file, 
                currentFile.file.name.split('.').slice(0, -1).join('.'), // Use filename as title
                category, // Use the globally selected category for all files
                targetType,
                targetId,
                updateCurrentFileProgress,
                onUploadComplete
            );
        }

        setIsMultiUploading(false);
        toast({ title: 'Alle Uploads abgeschlossen' });
    };
    
    // Generic file upload logic used by both single and multi-upload handlers
    const uploadFile = (
        file: File, 
        fileTitle: string, 
        fileCategory: string,
        fileTargetType: 'vehicle' | 'driver' | 'general',
        fileTargetId: string,
        progressUpdater: (progress: number) => void,
        finalizer: (error?: string) => void
    ) => {
        return new Promise<void>((resolve) => {
            if (!firestore || !session) {
                 finalizer('System nicht bereit');
                 resolve();
                 return;
            }

            const folder = fileTargetType === 'general' ? 'general' : `${fileTargetType}s/${fileTargetId || 'unassigned'}`;
            const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const storagePath = `uploads/${folder}/${fileCategory}/${safeFileName}`;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', storagePath);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    progressUpdater(Math.round((event.loaded / event.total) * 100));
                }
            };

            xhr.onload = async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            const docData = {
                                title: fileTitle.trim(),
                                category: fileCategory,
                                fileName: file.name,
                                fileType: file.type,
                                fileSize: file.size,
                                storagePath: response.path,
                                downloadUrl: response.downloadUrl,
                                uploaded_at: serverTimestamp(),
                                uploaded_by_name: session.name,
                                vehicleId: fileTargetType === 'vehicle' ? fileTargetId : null,
                                driverId: fileTargetType === 'driver' ? fileTargetId : null,
                                relatedEntityId: relatedEntityId || null,
                                relatedEntityType: relatedEntityType || null,
                            };
                            const collectionName = fileTargetType === 'general' ? 'general_documents' : fileTargetType === 'driver' ? 'driver_documents' : 'vehicle_documents';
                            await setDoc(doc(collection(firestore, collectionName)), docData);
                            finalizer();
                        } else {
                           finalizer(response.error || 'Upload-Fehler');
                        }
                    } catch (e) {
                        finalizer('Server-Antwort ungültig');
                    } finally { resolve(); }
                } else {
                    finalizer('Server-Fehler beim Upload');
                    resolve();
                }
            };

            xhr.onerror = () => {
                finalizer('Netzwerk-Fehler');
                resolve();
            };

            xhr.send(formData);
        });
    }

    const renderDropzone = () => (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-primary/20 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group">
            <UploadCloud className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform mb-4" />
            <div className="text-center px-6">
                <p className="font-bold text-base">Dateien auswählen</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Mehrfachauswahl möglich</p>
            </div>
            <input type="file" className="hidden" onChange={handleFileChange} multiple />
        </label>
    );

    const renderMultiFileView = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {!entityId && (
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Zuordnung für alle Dokumente</Label>
                         <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-xl">
                            <Button variant={targetType === 'vehicle' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'vehicle' && "bg-background shadow-sm")} onClick={() => setInternalTargetType('vehicle')} disabled={isMultiUploading}><Car className="h-3.5 w-3.5 mr-1" /> FZG</Button>
                            <Button variant={targetType === 'driver' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'driver' && "bg-background shadow-sm")} onClick={() => setInternalTargetType('driver')} disabled={isMultiUploading}><User className="h-3.5 w-3.5 mr-1" /> Fahrer</Button>
                            <Button variant={targetType === 'general' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'general' && "bg-background shadow-sm")} onClick={() => { setInternalTargetType('general'); setInternalTargetId(''); }} disabled={isMultiUploading}>Allgemein</Button>
                        </div>
                    </div>
                )}
                 <div className="space-y-1.5 flex-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Kategorie für alle Dokumente</Label>
                    <Select value={category} onValueChange={setCategory} disabled={isMultiUploading}>
                        <SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent position="popper" className="z-[200]">
                            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
             </div>
            {!entityId && targetType !== 'general' && (
                <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {targetType === 'vehicle' ? 'Fahrzeug auswählen *' : 'Fahrer auswählen *'}
                    </Label>
                    <Select value={targetId} onValueChange={setInternalTargetId} disabled={isMultiUploading}>
                        <SelectTrigger className="h-12 rounded-xl bg-background border-primary/20"><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
                        <SelectContent position="popper" className="z-[200]">
                            {targetType === 'vehicle' ? vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make})</SelectItem>) : drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.last_name}, {d.first_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="space-y-3 pt-4 max-h-64 overflow-y-auto">
                 {multipleFiles.map((item, index) => (
                    <div key={index} className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                            <p className="font-semibold truncate pr-4">{item.file.name}</p>
                            {item.status === 'success' && <CheckCircle2 className="h-5 w-5 text-status-green" />}
                            {item.status === 'error' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                            {(item.status === 'uploading' || item.status === 'processing') && <Loader2 className="h-5 w-5 animate-spin" />}
                        </div>
                        {(item.status === 'uploading' || item.status === 'processing') && <Progress value={item.progress} className="h-1.5 mt-2" />}
                        {item.status === 'error' && <p className="text-xs text-destructive mt-1">{item.error}</p>}
                    </div>
                ))}
            </div>
             <Button onClick={handleMultiUpload} disabled={isMultiUploading || multipleFiles.every(f => f.status === 'success')} className="w-full h-14 rounded-xl mt-4">
                {isMultiUploading ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <UploadCloud className="h-6 w-6 mr-3" />}
                {isMultiUploading ? 'Lädt hoch...' : `${multipleFiles.length} Dateien hochladen`}
            </Button>
        </div>
    );

    const renderSingleFileView = () => (
         <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        {selectedFile!.type.includes('pdf') ? <FileText className="h-6 w-6 text-red-500" /> : <FileIcon className="h-6 w-6 text-blue-500" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{selectedFile!.name}</p>
                        <p className="text-[10px] text-muted-foreground font-black uppercase">{(selectedFile!.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                </div>
                {!isProcessing && (
                    <Button variant="ghost" size="icon" onClick={resetSingleFileUploadState} className="rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                    <div className="flex-1 w-full space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Name des Dokuments *</Label>
                        <Input placeholder="z.B. Rechnung Inspektion" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isProcessing} className="h-12 rounded-xl bg-background border-primary/10" />
                    </div>
                    <Button type="button" variant="outline" className="w-full sm:w-auto h-12 border-primary/20 text-primary hover:bg-primary/5 rounded-xl shadow-sm" onClick={handleAIAnalyze} disabled={isProcessing || isAnalyzing}>
                        {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                        KI-Analyse
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!entityId && (
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Zuordnungstyp</Label>
                            <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-xl">
                                <Button variant={targetType === 'vehicle' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'vehicle' && "bg-background shadow-sm")} onClick={() => setInternalTargetType('vehicle')} disabled={isProcessing}><Car className="h-3.5 w-3.5 mr-1" /> FZG</Button>
                                <Button variant={targetType === 'driver' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'driver' && "bg-background shadow-sm")} onClick={() => setInternalTargetType('driver')} disabled={isProcessing}><User className="h-3.5 w-3.5 mr-1" /> Fahrer</Button>
                                <Button variant={targetType === 'general' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 text-[10px] font-bold rounded-lg", targetType === 'general' && "bg-background shadow-sm")} onClick={() => { setInternalTargetType('general'); setInternalTargetId(''); }} disabled={isProcessing}>Allgemein</Button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-1.5 flex-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Kategorie</Label>
                        <Select value={category} onValueChange={setCategory} disabled={isProcessing}>
                            <SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue /></SelectTrigger>
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
                            <SelectTrigger className="h-12 rounded-xl bg-background border-primary/20"><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
                            <SelectContent position="popper" className="z-[200]">
                                {targetType === 'vehicle' ? vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.license_plate} ({v.make})</SelectItem>) : drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.last_name}, {d.first_name}</SelectItem>)}
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

            <Button onClick={handleUpload} disabled={isProcessing || isAnalyzing || !title} className="w-full h-16 rounded-2xl shadow-xl text-lg font-black bg-primary hover:bg-primary/90">
                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <CheckCircle2 className="h-6 w-6 mr-3" />}
                {isProcessing ? 'Wird übertragen...' : 'Jetzt hochladen & speichern'}
            </Button>
        </div>
    );

    return (
        <div className="space-y-6 pb-10">
            {!selectedFile && multipleFiles.length === 0 ? renderDropzone() : null}
            {selectedFile ? renderSingleFileView() : null}
            {multipleFiles.length > 0 ? renderMultiFileView() : null}
        </div>
    );
}
