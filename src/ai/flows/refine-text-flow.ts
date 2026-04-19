'use server';
/**
 * @fileOverview Ein KI-Agent zur professionellen Veredelung von Texten.
 * Korrigiert Rechtschreibung, Grammatik und verbessert den Stil für das Fuhrparkmanagement.
 * Enthält Fallback-Logik für API-Überlastungen (503).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAIModelCandidates } from '@/ai/ai-config';

const RefineTextInputSchema = z.object({
  text: z.string().describe('Der zu verbessernde Text.'),
});
export type RefineTextInput = z.infer<typeof RefineTextInputSchema>;

const RefineTextOutputSchema = z.object({
  refinedText: z.string().describe('Der korrigierte und professionell formulierte Text.'),
});
export type RefineTextOutput = z.infer<typeof RefineTextOutputSchema>;

export async function refineText(input: RefineTextInput): Promise<RefineTextOutput> {
  return refineTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refineTextPrompt',
  input: { schema: RefineTextInputSchema },
  output: { schema: RefineTextOutputSchema },
  prompt: `Du bist ein professioneller Lektor für ein Logistikunternehmen (BK-Express).
Deine Aufgabe ist es, den folgenden Text zu verbessern.

AUFGABEN:
1. Korrigiere alle Rechtschreib- und Grammatikfehler.
2. Formuliere den Text professioneller, sachlicher und präziser.
3. Behalte die ursprüngliche Bedeutung und alle wichtigen Details (wie Kennzeichen oder Namen) bei.
4. Falls der Text auf Türkisch ist, verbessere ihn auf Türkisch. Falls er auf Deutsch ist, auf Deutsch. Mische die Sprachen nicht, außer es ist fachlich notwendig.

TEXT ZUM VERBESSERN:
"""
{{{text}}}
"""

Gib nur den verbesserten Text im Feld 'refinedText' zurück.`,
});

const refineTextFlow = ai.defineFlow(
  {
    name: 'refineTextFlow',
    inputSchema: RefineTextInputSchema,
    outputSchema: RefineTextOutputSchema,
  },
  async (input) => {
    if (!input.text.trim()) {
        return { refinedText: '' };
    }

    try {
        // Erster Versuch mit dem Standard-Prompt
        const { output } = await prompt(input);
        if (output) return output;
    } catch (e: any) {
        const errorMessage = e.message || '';
        const isUnavailable = errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('high demand');
        
        if (isUnavailable) {
            console.warn('[AI FALLBACK] Primary model busy, attempting fallback to stable model...');
            try {
                // Fallback auf Gemini 1.5 Flash (sehr stabil und hohe Verfügbarkeit)
                const { output } = await ai.generate({
                    model: 'googleai/gemini-1.5-flash',
                    prompt: `Du bist ein professioneller Lektor. Korrigiere Rechtschreibung und Grammatik und mache den Stil sachlicher für ein Fuhrparkunternehmen. Text: ${input.text}`,
                    output: { schema: RefineTextOutputSchema }
                });
                if (output) return output;
            } catch (fallbackError) {
                console.error('[AI CRITICAL] Fallback model also failed:', fallbackError);
            }
            throw new Error('Der KI-Dienst ist momentan überlastet. Bitte warten Sie kurz und versuchen Sie es dann erneut.');
        }
        
        console.error('[AI FLOW ERROR] refineTextFlow failed:', e);
        throw e;
    }
    
    throw new Error('Die KI konnte den Text nicht verbessern.');
  }
);
