'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdditionalPhotoCameraProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPhotoCaptured: (base64Image: string) => void;
}

export function AdditionalPhotoCamera({ isOpen, onOpenChange, onPhotoCaptured }: AdditionalPhotoCameraProps) {
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isFlashSupported, setIsFlashSupported] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getCameraPermission = useCallback(async () => {
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
  }, [toast]);
  
  useEffect(() => {
    if (isOpen) {
      getCameraPermission();
    } else {
      // Turn off camera when dialog closes
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        setHasCameraPermission(null);
        setIsFlashOn(false);
        setIsFlashSupported(false);
      }
    }
  }, [isOpen, getCameraPermission]);


  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsProcessing(true);
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas context not available');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const capturedImage = canvas.toDataURL('image/jpeg');
      
      onPhotoCaptured(capturedImage);
      onOpenChange(false);
    } catch (error) {
      console.error("Error capturing image:", error);
      toast({ variant: 'destructive', title: 'Fehler bei der Bildaufnahme' });
    } finally {
      setIsProcessing(false);
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Zusätzliches Foto aufnehmen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
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
          <Button onClick={handleCapture} disabled={hasCameraPermission !== true || isProcessing} className="w-full h-14 text-lg">
            <Camera className="mr-4 h-6 w-6" /> Foto aufnehmen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}