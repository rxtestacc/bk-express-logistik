
'use server';
/**
 * @fileOverview Extracts vehicle data from a German vehicle registration document image.
 * Includes robust handling for quota/rate limit errors.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractVehicleDataInputSchema = z.object({
  photoDataUris: z.array(z
    .string()
    .describe(
      "A photo of a vehicle document (registration, contract, etc.), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    )),
});
export type ExtractVehicleDataInput = z.infer<typeof ExtractVehicleDataInputSchema>;

const ExtractVehicleDataOutputSchema = z.object({
  make: z.string().describe('Hersteller (Feld D.1)'),
  model: z.string().describe('Modell/Typ (Feld D.3 oder Handelsbezeichnung)'),
  vin: z.string().describe('Fahrzeug-Identifizierungsnummer (VIN) (Feld E)'),
  hsn: z.string().optional().describe('Herstellerschlüsselnummer (HSN) (Feld 2.1)'),
  tsn: z.string().optional().describe('Typschlüsselnummer (TSN) (Feld 2.2)'),
  first_registration: z.string().optional().describe('Datum der Erstzulassung (Feld B). Format: YYYY-MM-DD'),
  license_plate: z.string().optional().describe('Amtliches Kennzeichen (Feld A)'),
  year: z.number().optional().describe('Baujahr, oft aus der VIN oder anderen Dokumenten abgeleitet, nicht direkt im Schein.'),
  power_kw: z.number().optional().describe('Nennleistung in kW (Feld P.2)'),
  engine: z.string().optional().describe('Motor oder Hubraum in ccm (Feld P.1), z.B. 1995'),
  fuel_type: z.string().optional().describe('Kraftstoffart oder Energiequelle (Feld P.3 oder 10)'),
  tire_size: z.string().optional().describe('Zulässige Reifengröße (Feld 15.1, 15.2 oder 15.3), z.B. 225/55 R17 97W'),
  color: z.string().optional().describe('Farbe des Fahrzeugs (Feld R)'),
  variant: z.string().optional().describe('Variante/Version (Feld D.2)'),
  
  // Contract details
  acquisition_type: z.enum(['cash', 'leasing', 'financing']).optional().describe('Art des Erwerbs, abgeleitet aus den Dokumenten (Kaufvertrag -> cash, Leasingvertrag -> leasing, etc.).'),
  purchase_date: z.string().optional().describe('Kaufdatum aus einem Kaufvertrag. Format: YYYY-MM-DD'),
  purchase_price: z.number().optional().describe('Kaufpreis oder Gesamtpreis aus einem Vertrag.'),
  leasing_start: z.string().optional().describe('Beginn des Leasingvertrags. Format: YYYY-MM-DD'),
  leasing_end: z.string().optional().describe('Ende des Leasingvertrags. Format: YYYY-MM-DD'),
  leasing_rate_eur: z.number().optional().describe('Monatliche Leasingrate in EUR.'),
  leasing_annual_mileage: z.number().optional().describe('Jährliche Kilometerleistung laut Leasingvertrag.'),
  leasing_company: z.string().optional().describe('Name der Leasinggesellschaft.'),
  financing_bank: z.string().optional().describe('Name der finanzierenden Bank.'),
  tuv_due: z.string().optional().describe('Datum der nächsten Hauptuntersuchung (TÜV). Oft auf der Rückseite des Fahrzeugscheins oder einem separaten Bericht. Format: YYYY-MM-DD, nur Monat und Jahr sind auch ok.'),
});
export type ExtractVehicleDataOutput = z.infer<typeof ExtractVehicleDataOutputSchema>;

export type VehicleExtractionResponse = {
  data?: ExtractVehicleDataOutput;
  error?: string;
};

export async function extractVehicleData(input: ExtractVehicleDataInput): Promise<VehicleExtractionResponse> {
  try {
    const result = await extractVehicleDataFlow(input);
    return { data: result };
  } catch (e: any) {
    console.error('[SERVER ACTION ERROR] extractVehicleData:', e);
    if (e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      return { error: 'KI-Limit erreicht. Bitte in einer Minute erneut versuchen.' };
    }
    return { error: e.message || 'KI-Analyse des Fahrzeugdokuments fehlgeschlagen.' };
  }
}

const prompt = ai.definePrompt({
  name: 'extractVehicleDataPrompt',
  input: { schema: ExtractVehicleDataInputSchema },
  output: { schema: ExtractVehicleDataOutputSchema },
  prompt: `You are an expert assistant for a German fleet management company. Your task is to analyze the provided images of vehicle documents (e.g., German vehicle registration "Fahrzeugschein", purchase contract "Kaufvertrag", leasing contract "Leasingvertrag") and extract key information with very high accuracy.

Carefully examine all provided images and consolidate the information. If different documents contain conflicting information, prioritize the official registration document for vehicle specs.

Analyze the following documents:
{{#each photoDataUris}}
- Document Image: {{media url=this}}
{{/each}}

From all these documents, extract the following details:
- **Vehicle Specs:** Extract 'make', 'model', 'vin', 'hsn', 'tsn', 'first_registration' (YYYY-MM-DD), 'power_kw', 'engine', 'fuel_type', 'tire_size', 'color', 'license_plate', etc. Pay close attention to the field codes on the registration document (e.g., D.1, E, 2.1, 2.2, B, P.2, 15.1).
- **Contract Type:** Determine the 'acquisition_type' (cash, leasing, or financing) based on the document titles or content.
- **Purchase Details:** If it's a purchase, find the 'purchase_date' and 'purchase_price'.
- **Leasing Details:** If it's a leasing contract, find 'leasing_start', 'leasing_end', 'leasing_rate_eur', 'leasing_annual_mileage', and 'leasing_company'.
- **Financing Details:** If it's a financing contract, identify the 'financing_bank'. The rate and dates might be similar to leasing.
- **Inspection Dates:** Look for the 'tuv_due' date for the next main inspection (Hauptuntersuchung).

If a field is not clearly visible or does not exist on any document, omit it from the output. Ensure the data is clean and correctly formatted. Dates must always be in YYYY-MM-DD format if possible.`,
});


const extractVehicleDataFlow = ai.defineFlow(
  {
    name: 'extractVehicleDataFlow',
    inputSchema: ExtractVehicleDataInputSchema,
    outputSchema: ExtractVehicleDataOutputSchema,
  },
  async (input) => {
    if (input.photoDataUris.length === 0) {
        throw new Error('Es wurden keine Bilder zur Analyse bereitgestellt.');
    }
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI failed to extract data from the document.');
    }
    return output;
  }
);
