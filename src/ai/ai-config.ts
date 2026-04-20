/**
 * @fileoverview Centralized AI model configuration for the application.
 * This file provides a single source of truth for which AI models to use,
 * allowing for easy updates and consistent behavior across all AI features.
 */
import 'server-only';

// The default model to use for standard tasks. Fast and cost-effective.
const AI_MODEL_DEFAULT = process.env.AI_MODEL || 'gemini-2.5-flash-lite';

// A more powerful model for complex tasks like detailed document analysis.
const AI_PRO_MODEL_DEFAULT = process.env.AI_PRO_MODEL || 'gemini-2.5 flash-lite';

// Fallback model in case the preferred ones are not available.
const AI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';

/**
 * Returns an ordered list of model candidates to try for a standard request.
 * This provides a fallback mechanism if the primary model is unavailable.
 * @returns An array of model name strings.
 */
export function getAIModelCandidates(): string[] {
  return [AI_MODEL_DEFAULT, AI_FALLBACK_MODEL];
}

/**
 * Returns an ordered list of model candidates for a "pro" request.
 * @returns An array of model name strings.
 */
export function getAIProModelCandidates(): string[] {
    return [AI_PRO_MODEL_DEFAULT, AI_FALLBACK_MODEL];
}


/**
 * Gets the primary AI model identifier.
 * @param preferPro - If true, returns the "pro" model.
 * @returns The string identifier for the AI model.
 */
export function getAIModel(preferPro: boolean = false): string {
  return preferPro ? AI_PRO_MODEL_DEFAULT : AI_MODEL_DEFAULT;
}

/**
 * Checks if the AI functionality is enabled by verifying the presence of an API key.
 * THIS IS A SERVER-ONLY FUNCTION.
 * @returns True if an API key is found in environment variables, false otherwise.
 */
export function isAIEnabled(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}
