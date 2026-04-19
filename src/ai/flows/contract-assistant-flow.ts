'use server';
/**
 * @fileOverview Ein intelligenter KI-Assistent für Fuhrparkverträge und Dokumenteninhalte.
 * Unterstützt DEUTSCH & TÜRKISCH.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ContractAssistantInputSchema = z.object({
  question: z.string().describe('Die Frage des Benutzers zu den Verträgen oder Dokumenteninhalten.'),
  contractsContext: z.string().describe('Ein JSON-String mit Vertragsdaten.'),
});
export type ContractAssistantInput = z.infer<typeof ContractAssistantInputSchema>;

const ContractAssistantOutputSchema = z.object({
  answer: z.string().describe('Die Antwort der KI im Markdown-Format.'),
});
export type ContractAssistantOutput = z.infer<typeof ContractAssistantOutputSchema>;

export async function askContractAssistant(input: ContractAssistantInput): Promise<ContractAssistantOutput> {
  return contractAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'contractAssistantPrompt',
  input: { schema: ContractAssistantInputSchema },
  output: { schema: ContractAssistantOutputSchema },
  prompt: `Du bist der hochintelligente Vertrags-Experte für BK-Express. Du beherrschst DEUTSCH und TÜRKISCH perfekt.

HEUTIGES DATUM: ${new Date().toLocaleDateString('de-DE')}

DIR LIEGEN FOLGENDE DATEN VOR (JSON-Format):
{{{contractsContext}}}

RICHTLINIEN FÜR DEINE ANTWORTEN:
1. **Sprachwahl:** Antworte in der Sprache, in der die Frage gestellt wurde (Deutsch oder Türkisch).
2. **Dokumentenbezug:** Nutze die "document_summary" Informationen, um Details aus den Originaldokumenten zu erläutern.
3. **Verlinkung:** Erstelle IMMER anklickbare Links für Verträge und Fahrzeuge [Text](/pfad/ID).
4. **Struktur:** Verwende Markdown für eine exzellente Lesbarkeit.

Beantworte nun die folgende Frage: {{{question}}}`,
});

const contractAssistantFlow = ai.defineFlow(
  {
    name: 'contractAssistantFlow',
    inputSchema: ContractAssistantInputSchema,
    outputSchema: ContractAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Die KI konnte die Vertragsfrage nicht beantworten.');
    }
    return output;
  }
);
