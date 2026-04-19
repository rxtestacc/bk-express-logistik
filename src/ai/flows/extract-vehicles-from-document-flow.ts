'use server';
/**
 * @fileOverview Extrahiert eine Liste von Fahrzeugen aus einem Dokument (Excel, CSV, PDF).
 * Optimiert für stabile Next.js Server-Action Antworten.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const ExtractedVehicleSchema = z.object({
    vin: z.string().optional().describe("Fahrzeug-Identifizierungsnummer (FIN/VIN)."),
    license_plate: z.string().optional().describe("Amtliches Kennzeichen."),
    make: z.string().optional().describe("Hersteller (z.B. Mercedes, VW)."),
    model: z.string().optional().describe("Modell (z.B. Sprinter, Golf)."),
    mileage_km: z.number().optional().describe("Aktueller Kilometerstand."),
    first_registration: z.string().optional().describe("Datum der Erstzulassung (YYYY-MM-DD)."),
    tuv_due: z.string().optional().describe("Nächster TÜV-Termin (YYYY-MM-DD)."),
    carrier: z.string().optional().describe("Zusteller (GLS, Hermes oder Stadtbote)."),
    location: z.string().optional().describe("Aktueller Standort."),
    engine: z.string().optional().describe("Motorisierung."),
    fuel_type: z.string().optional().describe("Kraftstoffart."),
    power_kw: z.number().optional().describe("Leistung in kW."),
    color: z.string().optional().describe("Fahrzeugfarbe."),
});

const VehicleExtractionInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "Ein Dokument mit einer Fahrzeugliste als Data-URI (Base64)."
    ),
});
export type VehicleExtractionInput = z.infer<typeof VehicleExtractionInputSchema>;

const VehicleExtractionOutputSchema = z.object({
    vehicles: z.array(ExtractedVehicleSchema).describe("Array der extrahierten Fahrzeug-Objekte.")
});
export type VehicleExtractionOutput = z.infer<typeof VehicleExtractionOutputSchema>;

const PromptInputSchema = z.object({
  documentDataUri: z.string().optional(),
  textContent: z.string().optional(),
});

/**
 * Result wrapper for stable server action response.
 */
export type VehicleExtractionResponse = {
  data?: VehicleExtractionOutput;
  error?: string;
};

export async function extractVehiclesFromDocument(input: VehicleExtractionInput): Promise<VehicleExtractionResponse> {
  try {
    const result = await extractVehiclesFlow(input);
    return { data: result };
  } catch (e: any) {
    console.error('[SERVER ACTION ERROR] extractVehiclesFromDocument:', e);
    return { error: e.message || 'Die KI-Analyse des Dokuments ist fehlgeschlagen.' };
  }
}

const prompt = ai.definePrompt({
  name: 'extractVehiclesFromDocumentPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: VehicleExtractionOutputSchema },
  prompt: `Du bist ein Experte für Datenextraktion. Deine Aufgabe ist es, eine Liste von Fahrzeugen aus dem bereitgestellten Dokument (Excel-Tabelle, CSV oder PDF) zu extrahieren.

{{#if textContent}}
Analysiere die folgenden Daten, die aus einer Tabelle extrahiert wurden:
{{{textContent}}}
{{else}}
Analysiere das Dokument:
{{media url=documentDataUri}}
{{/if}}

Extrahiere für jedes gefundene Fahrzeug so viele Informationen wie möglich. Achte besonders auf:
- Fahrgestellnummer (VIN/FIN)
- Kennzeichen
- Hersteller & Modell
- Kilometerstand
- Erstzulassung (Format: YYYY-MM-DD)
- TÜV-Fälligkeit (Format: YYYY-MM-DD)
- Zusteller (Ordne zu: 'GLS', 'Hermes' oder 'Stadtbote')

Gib die Ergebnisse als JSON-Objekt mit einem "vehicles"-Array zurück. Wenn eine Information fehlt, lasse den Schlüssel weg. Erfinde keine Daten.`,
});

const extractVehiclesFlow = ai.defineFlow(
  {
    name: 'extractVehiclesFlow',
    inputSchema: VehicleExtractionInputSchema,
    outputSchema: VehicleExtractionOutputSchema,
  },
  async (input) => {
    let promptInput: z.infer<typeof PromptInputSchema> = {};

    // Safe MIME Type extraction
    const mimeMatch = input.documentDataUri.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : '';

    const isSpreadsheet = 
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        mimeType === 'application/vnd.ms-excel' || 
        mimeType === 'text/csv' ||
        mimeType === 'application/csv' ||
        mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12';

    if (isSpreadsheet) {
      try {
        const base64 = input.documentDataUri.split(',')[1];
        const workbook = XLSX.read(base64, { type: 'base64' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        
        promptInput = { textContent: csv };
      } catch (e) {
        console.error('[AI FLOW ERROR] Failed to parse spreadsheet:', e);
        throw new Error('Die Tabellen-Datei konnte nicht gelesen werden.');
      }
    } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        promptInput = { documentDataUri: input.documentDataUri };
    } else {
        throw new Error(`Das Dateiformat "${mimeType}" wird für die KI-Analyse nicht direkt unterstützt. Bitte nutzen Sie PDF, Bilder oder Excel.`);
    }

    try {
        const { output } = await prompt(promptInput);
        if (!output || !output.vehicles) {
          throw new Error('Die KI konnte keine strukturierten Fahrzeugdaten im Dokument finden.');
        }
        return output;
    } catch (e: any) {
        console.error('[AI FLOW ERROR] Gemini analysis failed:', e);
        throw new Error(e.message || 'Die KI-Analyse des Dokuments ist fehlgeschlagen.');
    }
  }
);
