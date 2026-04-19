'use server';
/**
 * @fileOverview Extrahiert strukturierte Daten aus deutschen Fahrzeugverträgen (Leasing, Versicherung, Garantie).
 * Optimiert für Gemini zur präzisen Analyse von Zahlen, Fakten und Klauseln.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractContractDataInputSchema = z.object({
  photoDataUris: z.array(z
    .string()
    .describe(
      "Ein foto oder PDF eines Vertrags als Data-URI (Base64)."
    )),
});
export type ExtractContractDataInput = z.infer<typeof ExtractContractDataInputSchema>;

const ExtractContractDataOutputSchema = z.object({
  vin: z.string().optional().describe('Die 17-stellige Fahrzeug-Identifizierungsnummer (FIN/VIN).'),
  licensePlate: z.string().optional().describe('Das amtliche Kennzeichen des Fahrzeugs.'),
  make: z.string().optional().describe('Der Hersteller des Fahrzeugs.'),
  model: z.string().optional().describe('Das Modell des Fahrzeugs.'),
  contractType: z.enum(['leasing', 'financing', 'purchase', 'warranty', 'maintenance', 'insurance', 'other']).describe('Die Art des Vertrags.'),
  providerName: z.string().optional().describe('Der Name des Vertragspartners (Leasinggeber, Versicherung, Bank, Verkäufer).'),
  contractNumber: z.string().optional().describe('Die Vertragsnummer oder Versicherungsscheinnummer.'),
  startDate: z.string().optional().describe('Das Startdatum (YYYY-MM-DD).'),
  endDate: z.string().optional().describe('Das Enddatum / Ablaufdatum (YYYY-MM-DD).'),
  cancellationDeadline: z.string().optional().describe('Die Kündigungsfrist oder das späteste Kündigungsdatum (YYYY-MM-DD).'),
  monthlyCostEur: z.number().optional().describe('Monatliche Rate oder Kosten.'),
  oneTimeCostEur: z.number().optional().describe('Einmalige Kosten oder Anschaffungspreis.'),
  yearlyCostEur: z.number().optional().describe('Jährliche Kosten.'),
  responsibleName: z.string().optional().describe('Zuständiger Sachbearbeiter, Berater oder Vermittler.'),
  summary: z.string().describe('Eine tiefgehende, professionelle Zusammenfassung des Vertragsinhalts in Markdown. Enthält Fakten, Klauseln und wichtige Grenzen.'),
});
export type ExtractContractDataOutput = z.infer<typeof ExtractContractDataOutputSchema>;

export type ContractExtractionResponse = {
  data?: ExtractContractDataOutput;
  error?: string;
};

export async function extractContractData(input: ExtractContractDataInput): Promise<ContractExtractionResponse> {
  try {
    const result = await extractContractDataFlow(input);
    return { data: result };
  } catch (e: any) {
    console.error('[SERVER ACTION ERROR] extractContractData:', e);
    return { error: e.message || 'Die KI-Analyse des Dokuments ist fehlgeschlagen.' };
  }
}

const prompt = ai.definePrompt({
  name: 'extractContractDataPrompt',
  input: { schema: ExtractContractDataInputSchema },
  output: { schema: ExtractContractDataOutputSchema },
  prompt: `Du bist ein hochqualifizierter Dokumenten-Analyst für BK-Express Fuhrparkmanagement. Deine Aufgabe ist es, deutsche Vertragsunterlagen (Leasingverträge, Garantieverlängerungen, Versicherungspolicen, Kaufverträge) bis ins kleinste Detail zu analysieren.

Analysiere die folgenden Dokumentenseiten:
{{#each photoDataUris}}
- Dokumentenseite: {{media url=this}}
{{/each}}

RICHTLINIEN FÜR DIE ANALYSE:
1. **Vertragspartner (providerName):** Wer ist der Aussteller des Vertrags? Suche nach "Leasinggeber", "Versicherer", "Bank" oder dem Firmenkopf des Dokuments. Das ist ein PFLICHTFELD für dich.
2. **Fahrzeugidentifikation:** Extrahiere VIN (17 Stellen) und Kennzeichen mit höchster Priorität.
3. **Finanzielle Fakten:** Finde alle Kosten (Raten, Netto/Brutto, Gebühren). Achte auf Einmalzahlungen vs. monatliche Belastungen.
4. **Zuständigkeit (responsibleName):** Steht irgendwo ein konkreter Sachbearbeiter, Berater oder Ansprechpartner mit Name im Dokument?
5. **Laufzeiten:** Wann beginnt der Vertrag, wann endet er fix, und bis wann muss spätestens gekündigt werden?
6. **Detail-Zusammenfassung (Markdown):** Erstelle eine strukturierte Übersicht mit folgenden Abschnitten:
   - **Vertragsgegenstand:** Was genau wird versichert/geleast? (z.B. "Anschlussgarantie 24 Monate")
   - **Leistungsumfang:** Was ist inklusive, was ist ausgeschlossen?
   - **Grenzen & Klauseln:** Kilometerlimits, Selbstbeteiligungen, Mehrkilometer-Kosten.
   - **Besonderheiten:** Automatische Verlängerungen, Sonderkündigungsrechte.

Sei extrem präzise mit Zahlen. Falls Daten fehlen, lass die Felder im JSON leer, aber erwähne die Lücken in der Zusammenfassung.`,
});

const extractContractDataFlow = ai.defineFlow(
  {
    name: 'extractContractDataFlow',
    inputSchema: ExtractContractDataInputSchema,
    outputSchema: ExtractContractDataOutputSchema,
  },
  async (input) => {
    if (input.photoDataUris.length === 0) {
        throw new Error('Es wurden keine Dokumente zur Analyse bereitgestellt.');
    }
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Die KI konnte keine strukturierten Daten aus diesem Dokument extrahieren.');
    }
    return output;
  }
);
