
'use server';
/**
 * @fileOverview Extracts a list of drivers from a document (CSV, PDF, etc.).
 * Optimized for stable Next.js Server-Action responses.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const ExtractedDriverSchema = z.object({
    first_name: z.string().optional().describe("The driver's first name."),
    last_name: z.string().optional().describe("The driver's last name."),
    email: z.string().optional().describe("The driver's email address."),
    phone: z.string().optional().describe("The driver's phone number."),
    birth_date: z.string().optional().describe("The driver's date of birth in YYYY-MM-DD format."),
    employee_number: z.string().optional().describe("The driver's employee number, if available."),
    address_street: z.string().optional().describe("The street and house number of the driver's address."),
    address_zip: z.string().optional().describe("The ZIP code of the driver's address."),
    address_city: z.string().optional().describe("The city of the driver's address."),
    license_number: z.string().optional().describe("The driver's license number."),
    license_classes: z.string().optional().describe("A comma-separated string of driving license classes (e.g., 'B, C1, CE')."),
});

const DriverExtractionInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A document containing a list of drivers, as a data URI that must include a MIME type and use Base64 encoding."
    ),
});
export type DriverExtractionInput = z.infer<typeof DriverExtractionInputSchema>;

const DriverExtractionOutputSchema = z.object({
    drivers: z.array(ExtractedDriverSchema).describe("An array of extracted driver objects.")
});
export type DriverExtractionOutput = z.infer<typeof DriverExtractionOutputSchema>;

const PromptInputSchema = z.object({
  documentDataUri: z.string().optional(),
  textContent: z.string().optional(),
});

export type DriverExtractionResponse = {
  data?: DriverExtractionOutput;
  error?: string;
};

export async function extractDriversFromDocument(input: DriverExtractionInput): Promise<DriverExtractionResponse> {
  try {
    const result = await extractDriversFlow(input);
    return { data: result };
  } catch (e: any) {
    console.error('[SERVER ACTION ERROR] extractDriversFromDocument:', e);
    return { error: e.message || 'Die KI-Analyse des Fahrer-Dokuments ist fehlgeschlagen.' };
  }
}

const prompt = ai.definePrompt({
  name: 'extractDriversFromDocumentPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: DriverExtractionOutputSchema },
  prompt: `You are an expert data extraction assistant. Your task is to analyze the provided document (which could be a PDF, CSV, or an image of a table) and extract a list of all drivers found within it.

{{#if textContent}}
Analyze the following data extracted from a table:
{{{textContent}}}
{{else}}
Analyze the document provided via the data URI:
{{media url=documentDataUri}}
{{/if}}

For each driver found in the document, extract as much of the following information as possible. Pay close attention to the column headers.
- First Name (Look for 'Vorname', 'First Name')
- Last Name (Look for 'Nachname', 'Last Name', 'Name')
- Email Address
- Phone Number (Look for 'Telefon', 'Phone')
- Date of Birth (Return in YYYY-MM-DD format. Look for 'Geburtsdatum', 'DOB')
- Employee Number (Look for 'Mitarbeiternummer', 'Personalnummer', 'Employee ID')
- Street Address (Look for 'Straße', 'Address')
- ZIP Code (Look for 'PLZ', 'ZIP')
- City (Look for 'Ort', 'City')
- License Number (Look for 'Führerschein-Nr.', 'License No.')
- License Classes (Return as a single comma-separated string. Look for 'Klassen', 'Führerscheinklassen')

Return the results as a JSON object containing a "drivers" array. Each object in the array should represent one driver. If a piece of information for a driver is not found, omit the key. Do not invent data.`,
});

const extractDriversFlow = ai.defineFlow(
  {
    name: 'extractDriversFlow',
    inputSchema: DriverExtractionInputSchema,
    outputSchema: DriverExtractionOutputSchema,
  },
  async (input) => {
    let promptInput: z.infer<typeof PromptInputSchema> = {};

    const mimeMatch = input.documentDataUri.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : '';

    const isSpreadsheet = 
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        mimeType === 'application/vnd.ms-excel' || 
        mimeType === 'text/csv' ||
        mimeType === 'application/csv' ||
        mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12' ||
        mimeType === 'application/octet-stream';

    if (isSpreadsheet) {
      try {
        const base64 = input.documentDataUri.split(',')[1];
        const workbook = XLSX.read(base64, { type: 'base64' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        
        promptInput = { textContent: csv };
      } catch (e) {
        console.error('[AI FLOW ERROR] Failed to parse spreadsheet in driver flow:', e);
        // Fallback for generic binary types that might actually be images/PDFs
        if (mimeType === 'application/octet-stream') {
             promptInput = { documentDataUri: input.documentDataUri };
        } else {
            throw new Error('Die Tabellen-Datei konnte nicht gelesen werden.');
        }
      }
    } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        promptInput = { documentDataUri: input.documentDataUri };
    } else {
        // Last resort: pass to AI anyway
        promptInput = { documentDataUri: input.documentDataUri };
    }

    try {
        const { output } = await prompt(promptInput);
        if (!output || !output.drivers) {
          throw new Error('Die KI konnte keine Fahrerdaten im Dokument finden.');
        }
        return output;
    } catch (e: any) {
        console.error('[AI FLOW ERROR] Gemini driver extraction failed:', e);
        throw new Error(e.message || 'Die KI-Analyse des Fahrer-Dokuments ist fehlgeschlagen.');
    }
  }
);
