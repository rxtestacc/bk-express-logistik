import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getAIModel } from './ai-config';

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })],
  model: `googleai/${getAIModel()}`,
});
