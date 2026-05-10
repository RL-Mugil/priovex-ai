import type { AIProvider as AIProviderType } from '@priovex/types';
import type { AIProvider } from './interface';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

// Fallback chain: if primary fails, try secondaries in order
const FALLBACK_CHAIN: AIProviderType[] = ['claude', 'openai', 'gemini'];

export function createAIProvider(provider: AIProviderType): AIProvider {
  switch (provider) {
    case 'claude': {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY is not configured');
      return new ClaudeProvider(key);
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY is not configured');
      return new OpenAIProvider(key);
    }
    case 'gemini': {
      const key = process.env.GOOGLE_GEMINI_API_KEY;
      if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
      return new GeminiProvider(key);
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export function getAvailableProviders(): AIProviderType[] {
  const available: AIProviderType[] = [];
  if (process.env.ANTHROPIC_API_KEY) available.push('claude');
  if (process.env.OPENAI_API_KEY) available.push('openai');
  if (process.env.GOOGLE_GEMINI_API_KEY) available.push('gemini');
  return available;
}

export async function createProviderWithFallback(
  preferred: AIProviderType
): Promise<AIProvider> {
  const available = getAvailableProviders();
  if (available.length === 0) throw new Error('No AI providers configured');

  // Try preferred first
  if (available.includes(preferred)) {
    try {
      return createAIProvider(preferred);
    } catch {
      console.warn(`[AI Factory] Preferred provider ${preferred} failed, trying fallbacks`);
    }
  }

  // Try fallback chain
  for (const fallback of FALLBACK_CHAIN) {
    if (fallback !== preferred && available.includes(fallback)) {
      try {
        const provider = createAIProvider(fallback);
        console.warn(`[AI Factory] Using fallback provider: ${fallback}`);
        return provider;
      } catch {
        continue;
      }
    }
  }

  throw new Error('All AI providers failed to initialize');
}
