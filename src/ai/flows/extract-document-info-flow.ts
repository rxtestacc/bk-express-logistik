'use server';
/**
 * @fileOverview Universal AI agent for document analysis and classification.
 * Optimized for professional data depth and context detection.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const DocumentAnalysisInputSchema = z.object({
  fileDataUri: z.string().describe("The document as a data URI (Base64). Supports images and PDFs."),
});
export type DocumentAnalysisInput = z.infer<typeof DocumentAnalysisInputSchema>;

const DocumentAnalysisOutputSchema = z.object({
  title: z.string().describe('A concise, professional title for the document.'),
  category: z.string().describe('The identified category.'),
  description: z.string().describe('A professional summary of the document content including key facts.'),
  suggestedVehiclePlate: z.string().optional().describe('A license plate found in the document.'),
  suggestedDriverName: z.string().optional().describe('A driver name found in the document.'),
});
export type DocumentAnalysisOutput = z.infer<typeof DocumentAnalysisOutputSchema>;

export async function analyzeDocumentInfo(input: DocumentAnalysisInput): Promise<DocumentAnalysisOutput> {
  return analyzeDocumentInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDocumentInfoPrompt',
  input: { schema: DocumentAnalysisInputSchema },
  output: { schema: DocumentAnalysisOutputSchema },
  prompt: `Du bist ein Dokumenten-Experte für Fuhrparkmanagement. Analysiere das folgende Dokument und gib eine professionelle Einschätzung ab.

Dokument: {{media url=fileDataUri}}

DEINE AUFGABE:
1. **Identifikation:** Was genau ist das? (z.B. "Führerscheinkopie", "Schadenmeldung Versicherung", "TÜV-Bericht").
2. **Inhalts-Check:** Extrahiere alle harten Fakten: Namen, Kennzeichen, Fristen, Beträge oder Aktenzeichen.
3. **Zusammenfassung:** Schreibe eine kurze, sachliche Beschreibung (Markdown), die einem Flottenmanager sofort sagt, warum dieses Dokument wichtig ist.
4. **Klassifizierung:** Wähle die passende Kategorie: 'rechnung', 'gutachten', 'fahrzeugschein', 'kauf', 'leasing', 'versicherung', 'handbuch', 'fuehrerschein', 'ausweis', 'vertrag', 'schulung', 'sonstiges'.

Sei präzise und professionell.`,
});

const analyzeDocumentInfoFlow = ai.defineFlow(
  {
    name: 'analyzeDocumentInfoFlow',
    inputSchema: DocumentAnalysisInputSchema,
    outputSchema: DocumentAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Die KI konnte das Dokument nicht analysieren.');
    }
    return output;
  }
);
