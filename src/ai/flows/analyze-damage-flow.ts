'use server';
/**
 * @fileOverview A vehicle damage analysis AI agent.
 * Focused on technical precision and cost estimation logic.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AnalyzeDamageInputSchema = z.object({
  photoDataUris: z.array(z
    .string()
    .describe(
      "Photos of a vehicle's damage."
    )),
});
export type AnalyzeDamageInput = z.infer<typeof AnalyzeDamageInputSchema>;

const AnalyzeDamageOutputSchema = z.object({
  costEstimate: z.string().describe('Estimation of repair costs in EUR.'),
  damageAnalysis: z.string().describe('Structured markdown summary of damages.'),
});
export type AnalyzeDamageOutput = z.infer<typeof AnalyzeDamageOutputSchema>;

export async function analyzeDamage(input: AnalyzeDamageInput): Promise<AnalyzeDamageOutput> {
  return analyzeDamageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDamagePrompt',
  input: { schema: AnalyzeDamageInputSchema },
  output: { schema: AnalyzeDamageOutputSchema },
  prompt: `Du bist ein erfahrener KFZ-Sachverständiger. Deine Aufgabe ist die Erstbewertung von Unfall- oder Sachschäden anhand von Fotos für einen gewerblichen Fuhrpark.

Bilder zur Analyse:
{{#each photoDataUris}}
- Bild: {{media url=this}}
{{/each}}

ANALYSE-KRITERIEN:
1. **Schadensumfang:** Welche Bauteile sind betroffen? (z.B. Stoßfänger, Kotflügel, Scheinwerfer).
2. **Schadensart:** Dellen, tiefe Kratzer, Risse, Verformungen oder Lackschäden?
3. **Sicherheit:** Ist das Fahrzeug deiner Meinung nach noch verkehrssicher? (z.B. Beleuchtung defekt?).
4. **Kosten:** Gib eine realistische Kostenspanne für eine deutsche Vertragswerkstatt an.

Formatiere die 'damageAnalysis' professionell in Markdown mit Unterüberschriften. Sei sachlich und direkt.`,
});


const analyzeDamageFlow = ai.defineFlow(
  {
    name: 'analyzeDamageFlow',
    inputSchema: AnalyzeDamageInputSchema,
    outputSchema: AnalyzeDamageOutputSchema,
  },
  async (input) => {
    if (input.photoDataUris.length === 0) {
      throw new Error('Es wurden keine Bilder zur Analyse bereitgestellt.');
    }
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('KI konnte den Schaden nicht analysieren.');
    }
    return output;
  }
);
