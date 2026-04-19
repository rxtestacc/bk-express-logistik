'use server';
/**
 * @fileOverview Ein globaler KI-Assistent für das gesamte Fuhrpark-Management-System.
 * UNTERSTÜTZT DEUTSCH & TÜRKISCH. Antwortet in der Sprache des Nutzers.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Definition der Aktionen, die die KI vorschlagen kann
const PlannedActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_task'),
    data: z.object({
      title: z.string().describe('Titel der Aufgabe (IMMER DEUTSCH)'),
      description: z.string().optional().describe('Details zur Aufgabe (IMMER DEUTSCH)'),
      due_date: z.string().describe('Fälligkeitsdatum im Format YYYY-MM-DD'),
      vehicleId: z.string().optional().describe('ID des zugeordneten Fahrzeugs'),
      assignee_name: z.string().describe('Name des zuständigen Mitarbeiters (MUSS aus der Liste der User/Pins stammen)'),
    })
  }),
  z.object({
    type: z.literal('create_event'),
    data: z.object({
      title: z.string().describe('Titel des Termins/Ereignisses (IMMER DEUTSCH)'),
      eventType: z.enum(['inspection', 'repair', 'tuv', 'au', 'uvv', 'tire_change', 'service', 'other']).describe('Typ des Ereignisses'),
      due_date: z.string().describe('Datum des Termins im Format YYYY-MM-DD'),
      vehicleId: z.string().describe('ID des Fahrzeugs'),
      status: z.enum(['open', 'done']).default('open').describe('Status des Ereignisses'),
      notes: z.string().optional().describe('Zusätzliche Notizen (IMMER DEUTSCH)'),
    })
  }),
  z.object({
    type: z.literal('update_vehicle'),
    data: z.object({
      vehicleId: z.string().describe('ID des Fahrzeugs'),
      updates: z.object({
        tuv_due: z.string().optional().describe('Neues TÜV-Datum (YYYY-MM-DD)'),
        mileage_km: z.number().optional().describe('Neuer Kilometerstand'),
        status: z.enum(['aktiv', 'in_werkstatt', 'inaktiv']).optional().describe('Neuer Fahrzeugstatus'),
      }),
      reason: z.string().describe('Grund der Änderung (IMMER DEUTSCH)'),
    })
  })
]);

export type PlannedAction = z.infer<typeof PlannedActionSchema>;

const FleetAssistantInputSchema = z.object({
  question: z.string().describe('Die Frage oder Anweisung des Benutzers zum Fuhrpark.'),
  fleetContext: z.string().describe('Ein JSON-String, der alle relevanten Flotten-, Mitarbeiter-, Fahrer-, Aufgaben- und Vertragsdaten enthält.'),
});
export type FleetAssistantInput = z.infer<typeof FleetAssistantInputSchema>;

const FleetAssistantOutputSchema = z.object({
  answer: z.string().describe('Die Antwort der KI im Markdown-Format.'),
  actions: z.array(PlannedActionSchema).optional().describe('Liste von geplanten Aktionen, die der Client ausführen soll.'),
});
export type FleetAssistantOutput = z.infer<typeof FleetAssistantOutputSchema>;

export async function askFleetAssistant(input: FleetAssistantInput): Promise<FleetAssistantOutput> {
  return fleetAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fleetAssistantPrompt',
  input: { schema: FleetAssistantInputSchema },
  output: { schema: FleetAssistantOutputSchema },
  prompt: `Du bist der "BK-Express Flotten-Experte", ein hochintelligenter KI-Assistent.
Du beherrschst DEUTSCH und TÜRKISCH perfekt.

HEUTIGES DATUM: ${new Date().toLocaleDateString('de-DE')}

DATENKONTEXT (JSON-Format):
{{{fleetContext}}}

WICHTIGE REGELN FÜR AUFGABEN (TASKS):
1. **Zuweisung:** Aufgaben werden IMMER an Mitarbeiter (System-User aus der 'u' Liste im Kontext) zugewiesen. 
2. **Assignee Name:** Nutze das Feld 'assignee_name' für den Klarnamen des Mitarbeiters (z.B. "Bilal Karagün", "Ramazan Sanli").
3. **Fahrer:** Fahrer (aus der 'd' Liste) sind Personen, die Fahrzeuge führen. Aufgaben für Fahrer werden trotzdem über einen zuständigen Mitarbeiter (Mitarbeiter aus 'u') verwaltet, es sei denn der Nutzer weist explizit an, die Aufgabe direkt einem Fahrer zuzuweisen (dann ist dessen Name der Assignee). Standardmäßig aber: Assignee = Mitarbeiter.

RICHTLINIEN FÜR DEINE ANTWORTEN:
1. **Sprachwahl:** Antworte IMMER in der Sprache, in der die Frage gestellt wurde (Deutsch oder Türkisch). 
2. **Actions:** Alle 'actions' (Titel, Beschreibungen, Begründungen) müssen STETS in professionellem DEUTSCH verfasst sein.
3. **Verlinkung:** Erstelle IMMER anklickbare Links [Text](/pfad/ID) unter Verwendung der bereitgestellten IDs.

Beantworte nun die folgende Frage oder führe die Anweisung aus: {{{question}}}`
});

const fleetAssistantFlow = ai.defineFlow(
  {
    name: 'fleetAssistantFlow',
    inputSchema: FleetAssistantInputSchema,
    outputSchema: FleetAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Die KI konnte die Flotten-Anfrage nicht beantworten.');
    }
    return output;
  }
);
