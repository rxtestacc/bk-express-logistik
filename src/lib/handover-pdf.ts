'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface HandoverPdfData {
  id: string;
  vehicleLabel: string;
  handoverAt: any;
  fromDriverName: string | null;
  toDriverName: string;
  odometerKm?: number;
  status: string;
  existingDamageConfirmed: boolean;
  notes?: string;
  checklistEnabled: boolean;
  checklist?: any[];
  requiredPhotos?: any;
  additionalPhotos?: any[];
  damageSketchUrl?: string;
  damageLegend?: { title: string, color: string, date: string }[];
}

const statusTranslations: Record<string, string> = {
  draft: 'Entwurf',
  completed: 'Abgeschlossen',
  new_damage: 'Neuer Schaden erfasst',
  in_review: 'In Prüfung',
  closed: 'Archiviert'
};

const photoLabels: Record<string, string> = {
  front: 'Frontansicht',
  rear: 'Heckansicht',
  left: 'Fahrerseite',
  right: 'Beifahrerseite',
  mirror_left: 'Außenspiegel Links',
  mirror_right: 'Außenspiegel Rechts'
};

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

export async function generateHandoverPdf(data: HandoverPdfData) {
  const doc = new jsPDF() as any;
  const timestamp = data.handoverAt?.toDate ? data.handoverAt.toDate() : new Date();
  const dateStr = format(timestamp, 'dd.MM.yyyy', { locale: de });
  const timeStr = format(timestamp, 'HH:mm', { locale: de });
  const protocolId = data.id?.slice(0, 8).toUpperCase() || 'N/A';

  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - (margin * 2);

  // --- Hilfsfunktion für den Header (wird auf jeder Seite aufgerufen) ---
  const drawHeader = (pageNum: number, total: number) => {
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, 15, contentWidth, 1.5, 'F');
    
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('BK-EXPRESS FUHRPARKMANAGEMENT', margin, 12);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.text('Übergabeprotokoll', margin, 28);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const infoX = pageWidth - margin;
    doc.text(`Protokoll-ID: #${protocolId}`, infoX, 22, { align: 'right' });
    doc.text(`Seite ${pageNum} / ${total}`, infoX, 28, { align: 'right' });
  };

  // --- SEITE 1: 1-3 ---
  let y = 40;

  // 1. Basis-Informationen
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Basis-Informationen', margin, y);
  y += 5;

  doc.autoTable({
    startY: y,
    head: [['Kategorie', 'Details']],
    body: [
      ['Fahrzeug', data.vehicleLabel],
      ['Von Fahrer', data.fromDriverName || 'Unbekannt'],
      ['An Fahrer', data.toDriverName],
      ['Datum / Uhrzeit', `${dateStr} um ${timeStr} Uhr`],
      ['Kilometerstand', `${data.odometerKm?.toLocaleString('de-DE') || '-'} km`],
      ['Status', statusTranslations[data.status] || data.status],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 10, cellPadding: 2.5 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // 2. Schadensübersicht
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Schadensübersicht', margin, y);
  y += 6;

  if (data.damageLegend && data.damageLegend.length > 0) {
    doc.setFontSize(8);
    let lx = margin;
    data.damageLegend.forEach((item) => {
        const legendText = `${item.title} (${item.date})`;
        const textWidth = doc.getTextWidth(legendText);
        if (lx + textWidth + 15 > pageWidth - margin) { lx = margin; y += 5; }
        const colorMatch = item.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (colorMatch) {
            const [r, g, b] = hslToRgb(parseInt(colorMatch[1]), parseInt(colorMatch[2]), parseInt(colorMatch[3]));
            doc.setFillColor(r, g, b);
            doc.circle(lx + 2, y - 1, 1.2, 'F');
        }
        doc.text(legendText, lx + 5, y);
        lx += textWidth + 12;
    });
    y += 6;
  }

  if (data.damageSketchUrl) {
    try {
        const imgWidth = contentWidth;
        const imgHeight = (imgWidth * 9) / 16;
        // Check if it fits on page 1, if not, scale down slightly
        const availableHeight = pageHeight - y - 40; // 40 for status check and footer
        const finalImgHeight = Math.min(imgHeight, availableHeight);
        const finalImgWidth = (finalImgHeight * 16) / 9;
        doc.addImage(data.damageSketchUrl, 'PNG', margin + (contentWidth - finalImgWidth) / 2, y, finalImgWidth, finalImgHeight);
        y += finalImgHeight + 8;
    } catch (e) { 
        console.error("Error adding damage sketch to PDF:", e);
        y += 5; 
    }
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Keine Schäden zum Zeitpunkt der Übergabe dokumentiert.', margin, y);
    y += 10;
  }

  // 3. Zustandsprüfung
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Zustandsprüfung', margin, y);
  y += 5;

  doc.autoTable({
    startY: y,
    body: [
      ['Vorschäden bestätigt', data.existingDamageConfirmed ? 'Ja' : 'Abweichungen festgestellt'],
      ['Anmerkungen', data.notes || '-'],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: contentWidth - 50 } },
    margin: { left: margin, right: margin },
  });

  // --- SEITE 2: REST ---
  doc.addPage();
  y = 40;

  // 4. Checkliste (falls vorhanden)
  if (data.checklistEnabled && data.checklist && data.checklist.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Checkliste Fahrzeugausstattung', margin, y);
    y += 5;

    doc.autoTable({
      startY: y,
      head: [['Gegenstand', 'Zustand', 'Notiz']],
      body: data.checklist.map(item => [item.label, item.state.toUpperCase(), item.note || '-']),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8.5, cellPadding: 2 },
      margin: { left: margin, right: margin },
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Fotodokumentation
  const photoEntries = data.requiredPhotos ? Object.entries(data.requiredPhotos).filter(([_, p]: [string, any]) => p.status === 'added' && p.url) : [];
  const addPhotos = data.additionalPhotos || [];
  
  if (photoEntries.length > 0 || addPhotos.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Fotodokumentation', margin, y);
    y += 8;

    const imgW = (contentWidth - 10) / 2;
    const imgH = (imgW * 10) / 16; // Adjusted for the footer bar in the image

    // Pflichtfotos
    for (let i = 0; i < photoEntries.length; i++) {
      const [key, photo] = photoEntries[i];
      const px = (i % 2 === 0) ? margin : margin + imgW + 10;
      
      if (y + imgH > pageHeight - 50) { // Keep space for signatures if it's the last page
        doc.addPage();
        y = 40;
      }

      try {
        doc.addImage(photo.url, 'JPEG', px, y, imgW, imgH);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(photoLabels[key] || key, px, y + imgH + 4);
      } catch (e) {
        console.error("Error adding required photo to PDF:", e);
      }

      if (i % 2 !== 0) y += imgH + 12;
    }
    
    if (photoEntries.length % 2 !== 0) y += imgH + 12;

    // Zusatzfotos
    if (addPhotos.length > 0) {
        if (y > pageHeight - 60) { doc.addPage(); y = 40; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Zusätzliche Aufnahmen', margin, y);
        y += 6;

        for (let i = 0; i < addPhotos.length; i++) {
            const photo = addPhotos[i];
            const px = (i % 2 === 0) ? margin : margin + imgW + 10;
            
            if (y + imgH > pageHeight - 50) { 
                doc.addPage();
                y = 40;
            }

            try {
                doc.addImage(photo.url, 'JPEG', px, y, imgW, imgH);
            } catch (e) {
                console.error("Error adding additional photo to PDF:", e);
            }

            if (i % 2 !== 0) y += imgH + 10;
        }
    }
  }

  // --- UNTERSCHRIFTEN (Immer am Ende der letzten Seite) ---
  const finalY = pageHeight - 35;
  
  // Wenn y bereits zu nah am unteren Rand ist, neue Seite für Unterschriften
  if (y > finalY - 10) {
      doc.addPage();
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, finalY, margin + 75, finalY);
  doc.line(pageWidth - margin - 75, finalY, pageWidth - margin, finalY);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Unterschrift Abgebender Fahrer', margin, finalY + 5);
  doc.text('Unterschrift Übernehmender Fahrer', pageWidth - margin, finalY + 5, { align: 'right' });

  // --- Header und Footer auf allen Seiten nachziehen ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawHeader(i, totalPages);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`BK-Express Fuhrparkverwaltung | Protokoll #${protocolId} | Generiert am ${dateStr}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`Protokoll_${data.vehicleLabel.split(' ')[0]}_${dateStr}.pdf`);
}