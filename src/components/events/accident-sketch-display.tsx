'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileDown, Edit3 } from 'lucide-react';
import Image from 'next/image';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AccidentSketchDisplayProps {
    imageUrl: string;
    eventTitle: string;
    vehiclePlate: string;
    onEdit?: () => void;
}

export function AccidentSketchDisplay({ imageUrl, eventTitle, vehiclePlate, onEdit }: AccidentSketchDisplayProps) {
    
    const downloadPNG = () => {
        const link = document.createElement('a');
        link.download = `unfallskizze-${vehiclePlate}-${format(new Date(), 'yyyy-MM-dd')}.png`;
        link.href = imageUrl;
        link.click();
    };

    const downloadPDF = () => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const now = format(new Date(), "dd.MM.yyyy HH:mm 'Uhr'", { locale: de });
        
        doc.setFontSize(20);
        doc.text('Verkehrsunfall - Skizze', 15, 20);
        
        doc.setFontSize(12);
        doc.text(`Ereignis: ${eventTitle}`, 15, 30);
        doc.text(`Fahrzeug: ${vehiclePlate}`, 15, 37);
        doc.text(`Erstellt am: ${now}`, 15, 44);

        // Add the image (Base64)
        doc.addImage(imageUrl, 'PNG', 15, 55, 260, 130);

        doc.setFontSize(8);
        doc.text('Dokument generiert durch BK-Express Fuhrparkverwaltung', 15, 195);

        doc.save(`Unfallskizze_${vehiclePlate}.pdf`);
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Unfallskizze</CardTitle>
                </div>
                {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <Edit3 className="mr-2 h-4 w-4" /> Skizze bearbeiten
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="relative w-full aspect-[16/10] bg-slate-50 border rounded-md overflow-hidden shadow-inner">
                    <Image 
                        src={imageUrl} 
                        alt="Unfallskizze" 
                        layout="fill" 
                        objectFit="contain"
                        className="p-2"
                    />
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 bg-muted/20 p-4">
                <Button variant="secondary" size="sm" onClick={downloadPNG}>
                    <Download className="mr-2 h-4 w-4" /> Als PNG
                </Button>
                <Button size="sm" onClick={downloadPDF}>
                    <FileDown className="mr-2 h-4 w-4" /> Als PDF exportieren
                </Button>
            </CardFooter>
        </Card>
    );
}
