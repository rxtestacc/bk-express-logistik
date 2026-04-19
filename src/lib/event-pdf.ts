
'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface EventPdfData {
  id?: string;
  type: string;
  title: string;
  due_date: any;
  odometer_km: number;
  cost_eur?: number | null;
  status: string;
  vendor?: string;
  notes?: string;
  images?: string[];
  vehiclePlate: string;
  vehicleDetails: string;
  driverName: string;
  police_involved?: boolean;
  police_case_number?: string;
  fault?: string | null;
  accident_sketch_image?: string;
  third_party?: any;
}

const eventTypeTranslations: Record<string, string> = {
  inspection: 'Inspektion', repair: 'Reparatur', damage: 'Schaden', verkehrsunfall: 'Verkehrsunfall',
  tuv: 'TÜV (HU)', au: 'AU', uvv: 'UVV-Prüfung', tire_change: 'Reifenwechsel',
  service: 'Service', other: 'Sonstiges',
};

const statusTranslations: Record<string, string> = { open: 'Offen', in_progress: 'In Bearbeitung', done: 'Erledigt' };
const faultTranslations: Record<string, string> = { own: 'Eigenschuld', third_party: 'Fremdschuld', unknown: 'Unbekannt' };

/**
 * Generiert ein professionelles PDF-Dokument für ein Fahrzeug-Ereignis (Schaden/Unfall).
 */
export async function generateEventPdf(data: EventPdfData) {
  const doc = new jsPDF() as any;
  const timestamp = data.due_date?.toDate ? data.due_date.toDate() : new Date();
  const dateStr = format(timestamp, 'dd.MM.yyyy', { locale: de });
  const timeStr = format(timestamp, 'HH:mm', { locale: de });
  const eventId = data.id?.slice(0, 8).toUpperCase() || 'N/A';

  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - (margin * 2);

  // --- Header-Funktion für alle Seiten ---
  const drawHeader = (pageNum: number, total: number) => {
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, 15, contentWidth, 1.5, 'F');
    
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('BK-EXPRESS FUHRPARKMANAGEMENT', margin, 12);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.text(`${eventTypeTranslations[data.type] || 'Ereignis'}-Bericht`, margin, 28);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Protokoll-Nr: #${eventId}`, pageWidth - margin, 22, { align: 'right' });
    doc.text(`Seite ${pageNum} / ${total}`, pageWidth - margin, 28, { align: 'right' });
  };

  let y = 40;

  // 1. Basis-Informationen
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Basis-Informationen zum Fahrzeug & Fahrer', margin, y);
  y += 5;

  doc.autoTable({
    startY: y,
    head: [['Kategorie', 'Details']],
    body: [
      ['Kennzeichen', data.vehiclePlate],
      ['Fahrzeugmodell', data.vehicleDetails],
      ['Fahrer zum Zeitpunkt', data.driverName || 'Nicht angegeben'],
      ['Datum / Uhrzeit', `${dateStr} um ${timeStr} Uhr`],
      ['Kilometerstand', `${data.odometer_km?.toLocaleString('de-DE') || '-'} km`],
      ['Status des Falls', statusTranslations[data.status] || data.status],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 10, cellPadding: 3 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // 2. Fall-Details & Kosten
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Ereignisdetails & Kostenaufstellung', margin, y);
  y += 5;

  doc.autoTable({
    startY: y,
    body: [
      ['Betreff / Titel', data.title],
      ['Dienstleister / Werkstatt', data.vendor || 'Keine Angabe'],
      ['Voraussichtliche Kosten', data.cost_eur ? `${data.cost_eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : 'Noch nicht beziffert'],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // 3. Unfall-Informationen (nur falls relevant)
  if (data.type === 'verkehrsunfall' || data.police_involved || data.third_party) {
    if (y > pageHeight - 60) { doc.addPage(); y = 40; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Offizielle Angaben & Unfallgegner', margin, y);
    y += 5;

    const accidentBody = [
        ['Polizei involviert', data.police_involved ? 'Ja' : 'Nein'],
        ['Polizei-Aktenzeichen', data.police_case_number || 'Nicht vorhanden'],
        ['Schuldfrage (Selbsteinschätzung)', data.fault ? faultTranslations[data.fault] : 'Ungeklärt'],
    ];

    if (data.third_party) {
        const tp = data.third_party;
        accidentBody.push(['Unfallgegner', `${tp.first_name || ''} ${tp.last_name || ''}`.trim() || 'Unbekannt']);
        accidentBody.push(['Gegnerisches Kennzeichen', tp.license_plate || '-']);
        accidentBody.push(['Gegnerische Versicherung', tp.insurance_company || '-']);
    }

    doc.autoTable({
        startY: y,
        body: accidentBody,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // 4. Schadensanalyse & Notizen
  if (data.notes) {
    if (y > pageHeight - 40) { doc.addPage(); y = 40; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Detaillierte Beschreibung / Schadensanalyse', margin, y);
    y += 6;
    
    const splitNotes = doc.splitTextToSize(data.notes, contentWidth);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(splitNotes, margin, y);
    y += (splitNotes.length * 5) + 12;
  }

  // 5. Unfallskizze
  if (data.accident_sketch_image) {
    if (y > pageHeight - 100) { doc.addPage(); y = 40; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Grafische Darstellung (Unfallskizze)', margin, y);
    y += 5;
    try {
        const sketchH = (contentWidth * 10) / 16;
        doc.addImage(data.accident_sketch_image, 'PNG', margin, y, contentWidth, sketchH);
        y += sketchH + 15;
    } catch(e) { y += 5; }
  }

  // 6. Fotodokumentation (auf neuer Seite falls nötig)
  if (data.images && data.images.length > 0) {
    doc.addPage();
    y = 40;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('6. Fotodokumentation der Schäden', margin, y);
    y += 10;

    const imgW = (contentWidth - 10) / 2;
    const imgH = (imgW * 3) / 4;

    for (let i = 0; i < data.images.length; i++) {
        const px = (i % 2 === 0) ? margin : margin + imgW + 10;
        
        // Prüfen ob das Bild auf die Seite passt
        if (y + imgH > pageHeight - 30) {
            doc.addPage();
            y = 40;
        }

        try {
            doc.addImage(data.images[i], 'JPEG', px, y, imgW, imgH);
        } catch (e) {
            doc.rect(px, y, imgW, imgH);
            doc.text('Bild konnte nicht geladen werden', px + 5, y + imgH / 2);
        }
        
        if (i % 2 !== 0 || i === data.images.length - 1) {
            y += imgH + 10;
        }
    }
  }

  // --- Footer & Seitenzahlen auf allen Seiten ---
  const totalPages = doc.internal.getNumberOfPages();
  for(let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawHeader(i, totalPages);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generiert am ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })} | BK-Express Fuhrparkverwaltung`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`Schadenbericht_${data.vehiclePlate.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`);
}
