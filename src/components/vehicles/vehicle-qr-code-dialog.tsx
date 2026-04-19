'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Vehicle } from '@/lib/types';
import QRCode from "react-qr-code";
import { Button } from '../ui/button';
import { Download, FileDown, Camera, Smartphone, Maximize2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { useRef, useEffect, useState } from 'react';

interface VehicleQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | undefined;
  isTrigger?: boolean;
}

export default function VehicleQRCodeDialog({
  open,
  onOpenChange,
  vehicle,
  isTrigger = true,
}: VehicleQRCodeDialogProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (vehicle && typeof window !== 'undefined') {
      setQrUrl(`${window.location.origin}/scan/vehicle/${vehicle.id}`);
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const downloadPNG = () => {
    const svg = qrCodeRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-${vehicle.license_plate}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const downloadPDF = () => {
    const svg = qrCodeRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 512, 512);
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a6'
        });

        const margin = 10;
        const qrSize = 50;

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(vehicle.license_plate, margin, margin + 5);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`${vehicle.make} ${vehicle.model}`, margin, margin + 15);
        doc.text(`FIN: ${vehicle.vin}`, margin, margin + 22);

        doc.addImage(dataUrl, 'JPEG', margin, margin + 30, qrSize, qrSize);

        doc.setFontSize(8);
        const shortId = vehicle.id.slice(-6);
        doc.text(`ID: ${shortId}`, margin, margin + 30 + qrSize + 5);

        doc.save(`label-${vehicle.license_plate}.pdf`);
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  // Content for the inline mini-preview
  if (!isTrigger) {
    return (
      <div className="flex flex-col items-center">
        <div className="bg-white p-2 rounded-xl shadow-inner border border-primary/5">
          {qrUrl ? (
            <QRCode value={qrUrl} size={80} />
          ) : (
            <div className="w-[80px] h-[80px] bg-muted animate-pulse rounded-md" />
          )}
        </div>
      </div>
    );
  }

  // Full content for the Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fahrzeug-Identifikation</DialogTitle>
          <DialogDescription>
              Nutzen Sie diesen Code für {vehicle.license_plate}, um mobil Schäden zu melden oder Übergaben zu starten.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Smartphone className="h-4 w-4" />
                Einfach mit der Standard-Kamera scannen
            </p>
          </div>
          
          <div className="p-6 bg-white rounded-2xl shadow-inner border-2 border-primary/5" ref={qrCodeRef}>
              {qrUrl ? (
                <QRCode value={qrUrl} size={220} />
              ) : (
                <div className="w-[220px] h-[220px] bg-muted animate-pulse rounded-md" />
              )}
          </div>

          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 w-full">
            <p className="text-[10px] uppercase font-black tracking-widest text-primary mb-2 text-center">Kurzanleitung für Fahrer</p>
            <div className="grid grid-cols-2 gap-4 text-[11px] font-medium leading-tight">
                <div className="flex items-start gap-2">
                    <div className="bg-primary text-white h-4 w-4 rounded-full flex items-center justify-center shrink-0">1</div>
                    <p>Kamera-App öffnen & auf Code halten</p>
                </div>
                <div className="flex items-start gap-2">
                    <div className="bg-primary text-white h-4 w-4 rounded-full flex items-center justify-center shrink-0">2</div>
                    <p>Auf den erscheinenden Link tippen</p>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              <Button variant="outline" onClick={downloadPNG} disabled={!qrUrl} className="h-11 rounded-xl">
                <Download className="mr-2 h-4 w-4"/> PNG speichern
              </Button>
              <Button onClick={downloadPDF} disabled={!qrUrl} className="h-11 rounded-xl">
                <FileDown className="mr-2 h-4 w-4"/> PDF zum Drucken
              </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
