'use server';
/**
 * @fileOverview Extracts driver data from images of a driver's license.
 *
 * - extractDriverData - A function that handles the data extraction.
 * - ExtractDriverDataInput - The input type for the extractDriverData function.
 * - ExtractDriverDataOutput - The return type for the extractDriverData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractDriverDataInputSchema = z.object({
  frontImageUri: z
    .string()
    .describe(
      "A photo of the front of a driver's license, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  backImageUri: z
    .string()
    .nullable()
    .describe(
      "A photo of the back of a driver's license, as a data URI. This is optional."
    ),
});
export type ExtractDriverDataInput = z.infer<typeof ExtractDriverDataInputSchema>;

const ExtractDriverDataOutputSchema = z.object({
  first_name: z.string().describe('The first name of the driver (e.g., field 2).'),
  last_name: z.string().describe('The last name of the driver (e.g., field 1).'),
  birth_date: z.string().describe('The date of birth in YYYY-MM-DD format (e.g., field 3).'),
  birth_place: z.string().optional().describe('The place of birth (e.g. field 3).'),
  nationality: z.string().optional().describe('The nationality of the driver.'),
  address: z.object({
    street: z.string().describe('Street and house number.'),
    zip: z.string().describe('ZIP code.'),
    city: z.string().describe('City.'),
  }).optional(),
  license_number: z.string().optional().describe('The driver\'s license number (e.g., field 5).'),
  license_issue_date: z.string().optional().describe('The issue date of the license in YYYY-MM-DD format (e.g., field 4a).'),
  license_expiry_date: z.string().optional().describe('The expiry date of the license in YYYY-MM-DD format (e.g., field 4b).'),
  license_issue_country: z.string().optional().describe('The country that issued the license (e.g., field 4d, or inferred from document type).'),
  license_classes: z.array(z.string()).optional().describe('A list of all driving license classes found on the document (e.g., AM, A1, A2, A, B, BE, C1, C1E, C, CE, D1, D1E, D, DE, L, T).'),
});
export type ExtractDriverDataOutput = z.infer<typeof ExtractDriverDataOutputSchema>;

export async function extractDriverData(input: ExtractDriverDataInput): Promise<ExtractDriverDataOutput> {
  return extractDriverDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDriverDataPrompt',
  input: { schema: ExtractDriverDataInputSchema },
  output: { schema: ExtractDriverDataOutputSchema },
  prompt: `You are an expert OCR assistant for a German fleet management company. Your task is to analyze the provided image(s) of a driver's license (front and optionally back side) and extract key information with very high accuracy. The license could be from any country, but it will often be a standard EU format.

Carefully examine the image(s) and identify the data corresponding to the requested fields in the output schema. Pay close attention to the standard field numbers on EU licenses (e.g., 1. Last Name, 2. First Name, 3. Date and Place of Birth, 4a. Issue Date, 4b. Expiry Date, 4d. Issuing Authority/Country, 5. License Number, 9. License Classes).

- Extract all personal details like first name, last name, date of birth, place of birth, and nationality.
- Extract all address details if present.
- Extract all license-specific details like number, issue date, expiry date, issuing country, and all vehicle classes.
- Dates must be returned in YYYY-MM-DD format.
- If a field is not clearly visible or does not exist on the document, omit it from the output.

Image of the front side:
{{media url=frontImageUri}}

{{#if backImageUri}}
Image of the back side:
{{media url=backImageUri}}
{{/if}}
`,
});


const extractDriverDataFlow = ai.defineFlow(
  {
    name: 'extractDriverDataFlow',
    inputSchema: ExtractDriverDataInputSchema,
    outputSchema: ExtractDriverDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI failed to extract data from the document.');
    }
    return output;
  }
);
