'use client';

import { useHandoverState } from '../handover-state-provider';
import { useState, useRef, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Camera, CheckCircle2, Loader2, SkipForward, X, RefreshCw, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';

type PhotoKey = 'front' | 'rear' | 'left' | 'right' | 'mirror_left' | 'mirror_right';

interface HandoverStepPhotoProps {
  photoKey: PhotoKey;
  title: string;
}

const photoLabels: Record<PhotoKey, string> = {
  front: 'Frontansicht',
  rear: 'Heckansicht',
  left: 'Fahrerseite',
  right: 'Beifahrerseite',
  mirror_left: 'Außenspiegel Links',
  mirror_right: 'Außenspiegel Rechts',
};

/**
 * Erstellt ein neues Bild mit einem Informations-Footer am unteren Rand.
 * Enthält Kennzeichen, Datum und Uhrzeit mit intelligenter Skalierung.
 */
async function stampImageWithMetadata(base64Image: string, text: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            // Berechne die Höhe für den Footer (ca. 15% der Bildhöhe für besseres Padding)
            const footerHeight = Math.max(80, Math.round(img.height * 0.15));
            canvas.width = img.width;
            canvas.height = img.height + footerHeight;

            // 1. Hintergrund für den gesamten Canvas (Schwarz für den Footer)
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Zeichne das Originalbild oben
            ctx.drawImage(img, 0, 0);

            // 3. Zeichne den Text im Footer-Bereich mit dynamischer Skalierung
            let fontSize = Math.round(footerHeight * 0.35);
            ctx.font = `bold ${fontSize}px "Inter", "Helvetica", sans-serif`;
            
            // Prüfe ob der Text passt, sonst verkleinere die Schrift
            let metrics = ctx.measureText(text);
            const maxTextWidth = canvas.width * 0.95;
            
            while (metrics.width > maxTextWidth && fontSize > 12) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px "Inter", "Helvetica", sans-serif`;
                metrics = ctx.measureText(text);
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Zentriere den Text im Footer
            ctx.fillText(text, canvas.width / 2, img.height + (footerHeight / 2));
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = (err) => reject(err);
        img.src = base64Image;
    });
}


export function HandoverStepPhoto({ photoKey, title }: HandoverStepPhotoProps) {
    const { handoverData, setHandoverData } = useHandoverState();
    const { session } = useSession();
    const { toast } = useToast();

    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [skipReason, setSkipReason] = useState('');
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [isFlashSupported, setIsFlashSupported] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const currentPhoto = handoverData.requiredPhotos[photoKey];

    useEffect(() => {
        if (currentPhoto.status !== 'missing') {
            return;
        }
        
        const getCameraPermission = async () => {
            if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
                setHasCameraPermission(false);
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                setHasCameraPermission(true);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                const [videoTrack] = stream.getVideoTracks();
                if (videoTrack) {
                    const capabilities = videoTrack.getCapabilities();
                    if (capabilities.torch) {
                        setIsFlashSupported(true);
                    }
                }

            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Kamerazugriff verweigert',
                    description: 'Bitte erlauben Sie den Kamerazugriff in Ihren Browsereinstellungen.',
                });
            }
        };

        getCameraPermission();
        
        return () => {
             if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }, [toast, currentPhoto.status]);

    const handleCapture = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !session) return;
        
        setIsProcessing(true);

        try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas context not available');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const capturedImage = canvas.toDataURL('image/jpeg');

            // Robuste Extraktion des Kennzeichens
            const getPlate = () => {
                const label = handoverData.vehicleLabel || '';
                if (!label) return 'Unbekannt';
                return label.includes('(') ? label.split('(')[0].trim() : label;
            };
            const plate = getPlate();
            
            const now = new Date();
            const dateStr = format(now, 'dd.MM.yyyy', { locale: de });
            const timeStr = format(now, 'HH:mm', { locale: de });
            
            const stampText = `${photoLabels[photoKey]} | KENZ: ${plate} | DATUM: ${dateStr} | UHR: ${timeStr} Uhr`;
            
            const stampedImage = await stampImageWithMetadata(capturedImage, stampText);

            setHandoverData(prev => ({
                ...prev,
                requiredPhotos: {
                    ...prev.requiredPhotos,
                    [photoKey]: {
                        status: 'added',
                        url: stampedImage,
                        metadataText: stampText,
                        placeholderNote: null
                    }
                }
            }));
        } catch (error) {
            console.error("Error processing image:", error);
            toast({ variant: 'destructive', title: 'Fehler bei der Bildverarbeitung' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSkip = () => {
        if (!skipReason) {
            toast({ variant: 'destructive', title: 'Grund erforderlich', description: 'Bitte geben Sie einen Grund an, warum Sie diesen Schritt überspringen.' });
            return;
        }
        setHandoverData(prev => ({
            ...prev,
            requiredPhotos: {
                ...prev.requiredPhotos,
                [photoKey]: {
                    status: 'skipped',
                    url: null,
                    metadataText: null,
                    placeholderNote: skipReason,
                }
            }
        }));
    }

    const resetPhoto = () => {
        setHandoverData(prev => ({
            ...prev,
            requiredPhotos: {
                ...prev.requiredPhotos,
                [photoKey]: { status: 'missing', url: null, metadataText: null, placeholderNote: null }
            }
        }));
    };
    
    const toggleFlash = async () => {
        if (!videoRef.current?.srcObject || !isFlashSupported) return;
        const stream = videoRef.current.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        try {
            await track.applyConstraints({
                advanced: [{ torch: !isFlashOn }]
            });
            setIsFlashOn(!isFlashOn);
        } catch (error) {
            console.error('Failed to toggle flash', error);
            toast({ variant: 'destructive', title: 'Blitzfehler', description: 'Der Blitz konnte nicht umgeschaltet werden.'});
        }
    };

    if (currentPhoto.status === 'added' && currentPhoto.url) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 text-center">
                 <h2 className="text-2xl font-semibold">{title}</h2>
                 <div className="flex items-center justify-center gap-2 text-xl font-bold text-green-600">
                    <CheckCircle2 className="h-8 w-8" />
                    <p>Foto erfasst!</p>
                 </div>
                 <div className="relative w-full max-w-lg mx-auto aspect-video rounded-lg overflow-hidden border bg-black shadow-inner">
                    <Image src={currentPhoto.url} alt={currentPhoto.metadataText || title} layout="fill" objectFit="contain" />
                 </div>
                 <p className="text-xs font-mono bg-muted p-3 rounded-lg border max-w-md mx-auto">{currentPhoto.metadataText}</p>
                 <Button variant="outline" onClick={resetPhoto}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Foto wiederholen
                 </Button>
            </div>
        );
    }
    
    if (currentPhoto.status === 'skipped') {
         return (
            <div className="max-w-2xl mx-auto space-y-6 text-center">
                 <h2 className="text-2xl font-semibold">{title}</h2>
                 <div className="flex items-center justify-center gap-2 text-xl font-bold text-amber-600">
                    <SkipForward className="h-8 w-8" />
                    <p>Schritt übersprungen</p>
                 </div>
                 <p className="text-muted-foreground">Grund: {currentPhoto.placeholderNote}</p>
                 <Button variant="outline" onClick={resetPhoto}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Zurücksetzen
                 </Button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-semibold">{title}</h2>
                <p className="text-muted-foreground">
                    Bitte fotografieren Sie die {title} des Fahrzeugs.
                </p>
            </div>
            
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                 {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex items-center justify-center text-center p-4">
                        <Alert variant="destructive">
                              <AlertTitle>Kamera nicht verfügbar</AlertTitle>
                              <AlertDescription>
                                Es konnte nicht auf die Kamera zugegriffen werden. Bitte prüfen Sie die Berechtigungen Ihres Browsers.
                              </AlertDescription>
                      </Alert>
                    </div>
                 )}
                 {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-10 w-10 text-white animate-spin" />
                      </div>
                 )}
                 {hasCameraPermission && isFlashSupported && (
                    <Button onClick={toggleFlash} variant="outline" className="absolute top-2 left-2 z-10 bg-black/30 text-white hover:bg-black/50 hover:text-white border-white/50">
                        <Zap className="mr-2 h-4 w-4" />
                        {isFlashOn ? 'Blitz aus' : 'Blitz an'}
                    </Button>
                 )}
            </div>

            <Button onClick={handleCapture} disabled={hasCameraPermission !== true || isProcessing} className="w-full h-16 text-xl rounded-xl shadow-xl">
                <Camera className="mr-4 h-8 w-8" /> Foto aufnehmen
            </Button>

            <div className="space-y-2 pt-4 border-t">
                <p className="text-sm text-center text-muted-foreground">Oder überspringen Sie diesen Schritt mit einer Begründung:</p>
                <div className="flex gap-2">
                    <Textarea placeholder="z.B. Fahrzeugseite blockiert, zu dunkel..." value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="resize-none" rows={2} />
                    <Button variant="secondary" onClick={handleSkip} disabled={!skipReason} className="h-auto">
                        <SkipForward className="mr-2 h-4 w-4"/>Überspringen
                    </Button>
                </div>
            </div>

        </div>
    );
}
