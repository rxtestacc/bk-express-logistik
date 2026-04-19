'use server';
/**
 * @fileOverview Extrahiert hochgradig strukturierte Daten aus einer Audio-Aufnahme.
 * Optimiert für DEUTSCH & TÜRKISCH mit speziellem Fokus auf Logistik-Terminologie.
 * Nutzt Gemini 1.5 Pro für maximale Erkennungsgenauigkeit bei Dialekten.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProcessVoiceTaskInputSchema = z.object({
  audioDataUri: z.string().describe(
    "Die Audio-Aufnahme als Data-URI (Base64). Format: 'data:audio/webm;base64,...' oder ähnlich."
  ),
});
export type ProcessVoiceTaskInput = z.infer<typeof ProcessVoiceTaskInputSchema>;

const ProcessVoiceTaskOutputSchema = z.object({
  title: z.string().describe('Ein kurzer, hochprofessioneller Titel (max. 6 Wörter).'),
  description: z.string().describe('Eine detaillierte, präzise und professionell formulierte Beschreibung des Anliegens.'),
  licensePlateHint: z.string().optional().describe('Das erwähnte Kennzeichen Fragment.'),
  driverHint: z.string().optional().describe('Der erwähnte Name des Fahrers oder Mitarbeiters (z.B. "Bilal", "Ramazan", "Haldun").'),
  dateHint: z.string().optional().describe('Erkanntes Datum oder Zeitangabe in natürlicher Sprache.'),
  isoDate: z.string().optional().describe('Das erkannte Datum im ISO-Format (YYYY-MM-DD).'),
  isoTime: z.string().optional().describe('Die erkannte Uhrzeit im Format HH:mm.'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  category: z.enum(['task', 'maintenance', 'damage']).describe('Die erkannte Kategorie des Anliegens.'),
});
export type ProcessVoiceTaskOutput = z.infer<typeof ProcessVoiceTaskOutputSchema>;

export async function processVoiceTask(input: ProcessVoiceTaskInput): Promise<ProcessVoiceTaskOutput> {
  return processVoiceTaskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processVoiceTaskPrompt',
  input: { schema: ProcessVoiceTaskInputSchema },
  output: { schema: ProcessVoiceTaskOutputSchema },
  config: {
    // Wir nutzen hier explizit das Pro-Modell für bessere Audio-Genauigkeit bei Mehrsprachigkeit
    model: 'googleai/gemini-1.5-pro',
  },
  prompt: `Du bist der hochintelligente Fuhrpark-Assistent für BK-Express. Du bist ein Experte für DEUTSCH und TÜRKISCH (inklusive Dialekte und Logistik-Slang).

DEINE AUFGABE:
Analysiere die Audio-Nachricht und wandle sie in einen präzisen, deutschen Geschäftsvorgang um.

HEUTIGES DATUM: ${new Date().toISOString().split('T')[0]} (Wichtig für relative Zeitangaben wie "morgen" oder "nächste Woche").

ÜBERSETZUNGS- & LOGISTIK-LOGIK (Türkisch -> Deutsch):
- "Çizik / Çizmişim" -> Lackschaden / Kratzer erfassen
- "Vurdum / Kaza yaptım" -> Verkehrsunfall / Kollisionsschaden
- "Muayene / Tüv" -> Hauptuntersuchung / TÜV-Termin
- "Bakım / Servis" -> Wartung / Inspektion
- "Lastik" -> Reifenwechsel / Reifenkontrolle
- "Araba / Araç" -> Fahrzeug
- "Plaka" -> Kennzeichen (Achte auf Buchstaben wie B-K, H-H)

ERKENNUNGS-REGELN:
1. Höre genau hin, ob Namen (Ramazan, Bilal, Haldun, Murathan etc.) oder Kennzeichen (z.B. 2067, 236) genannt werden.
2. Wenn die Eingabe auf Türkisch ist: Verstehe den Inhalt perfekt, aber gib 'title' und 'description' IMMER in exzellentem, professionellem DEUTSCH aus.
3. Die 'description' muss wie ein formeller Arbeitsauftrag klingen (z.B. "Bitte prüfen Sie den Reifendruck..." statt "Reifen ist platt").
4. Wenn ein Datum genannt wird ("Pazartesi" -> Montag), berechne das ISO-Datum basierend auf dem heutigen Datum.

Höre die Nachricht: {{media url=audioDataUri}}

Erzeuge eine Antwort in perfektem deutschem Geschäftsdeutsch.`,
});

const processVoiceTaskFlow = ai.defineFlow(
  {
    name: 'processVoiceTaskFlow',
    inputSchema: ProcessVoiceTaskInputSchema,
    outputSchema: ProcessVoiceTaskOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        if (!output) {
          throw new Error('KI konnte das Audio nicht interpretieren.');
        }
        return output;
    } catch (e: any) {
        console.error("[AI VOICE ERROR]", e);
        throw new Error('Fehler bei der Audio-Analyse. Bitte deutlich sprechen oder manuell eingeben.');
    }
  }
);
