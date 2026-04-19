'use server';
/**
 * @fileOverview Extrahiert detaillierte Rechnungs- und Werkstattdaten.
 * Fokus auf Einzelposten, Material vs. Arbeitszeit und technische Befunde.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractEventDataInputSchema = z.object({
  photoDataUris: z.array(z
    .string()
    .describe(
      "Bilder einer Rechnung oder eines Werkstattberichts."
    )),
});
export type ExtractEventDataInput = z.infer<typeof ExtractEventDataInputSchema>;

const ExtractEventDataOutputSchema = z.object({
  title: z.string().describe('Prägnanter Titel, z.B. "Große Inspektion inkl. Bremsen".'),
  due_date: z.string().describe('Rechnungs- oder Leistungsdatum (YYYY-MM-DD).'),
  cost_eur: z.number().optional().describe('Gesamtbetrag Brutto.'),
  odometer_km: z.number().optional().describe('Kilometerstand zum Zeitpunkt der Arbeit.'),
  vendor: z.string().optional().describe('Name der Werkstatt/Firma.'),
  notes: z.string().optional().describe('Detaillierte Aufschlüsselung der Arbeiten und Teile in Markdown.'),
  items: z.array(z.object({
    description: z.string(),
    amount: z.number().optional(),
    price: z.number().optional()
  })).optional().describe('Einzelne Rechnungsposten falls lesbar.'),
});
export type ExtractEventDataOutput = z.infer<typeof ExtractEventDataOutputSchema>;

export type EventExtractionResponse = {
  data?: ExtractEventDataOutput;
  error?: string;
};

export async function extractEventData(input: ExtractEventDataInput): Promise<EventExtractionResponse> {
  try {
    const result = await extractEventDataFlow(input);
    return { data: result };
  } catch (e: any) {
    console.error('[SERVER ACTION ERROR] extractEventData:', e);
    if (e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      return { error: 'KI-Limit erreicht. Bitte kurz warten.' };
    }
    return { error: e.message || 'KI-Analyse fehlgeschlagen.' };
  }
}

const prompt = ai.definePrompt({
  name: 'extractEventDataPrompt',
  input: { schema: ExtractEventDataInputSchema },
  output: { schema: ExtractEventDataOutputSchema },
  prompt: `Du bist ein Assistenzsystem für die Rechnungsprüfung im Fuhrparkmanagement. Deine Aufgabe ist es, Werkstattrechnungen und Serviceberichte präzise zu zerlegen.

Analysiere diese Bilder:
{{#each photoDataUris}}
- Bild: {{media url=this}}
{{/each}}

EXTRAKTIONS-LOGIK:
1. **Finanzen:** Suche den Brutto-Endbetrag. Ignoriere Zwischensummen.
2. **Leistung:** Was wurde gemacht? (z.B. Inspektion, Ölwechsel, Reifen, Reparatur).
3. **Einzelposten:** Erstelle in den 'notes' eine tabellarische oder gelistete Übersicht in Markdown:
   - **Arbeitsleistungen:** Welche Services wurden berechnet?
   - **Ersatzteile:** Welche Teile (mit Mengen/Preisen falls lesbar) wurden verbaut?
   - **Zusatzinfos:** Gibt es Hinweise der Werkstatt auf zukünftige Mängel? (z.B. "Bremsen bald fällig").

Antworte strukturiert und professionell auf Deutsch. Nutze für die 'notes' sauberes Markdown.`,
});

const extractEventDataFlow = ai.defineFlow(
  {
    name: 'extractEventDataFlow',
    inputSchema: ExtractEventDataInputSchema,
    outputSchema: ExtractEventDataOutputSchema,
  },
  async (input) => {
    if (input.photoDataUris.length === 0) throw new Error('Keine Bilder vorhanden.');
    const { output } = await prompt(input);
    if (!output) throw new Error('Extraktion fehlgeschlagen.');
    return output;
  }
);
