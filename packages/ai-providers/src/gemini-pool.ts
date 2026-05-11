// Gemini model pool — automatic failover across all available free-tier models
//
// If any model ID fails with "model not found" (404), update it here or in env:
//   GEMINI_POOL_OVERRIDES (JSON array) e.g.:
//   [{"id":"gemini-2.5-flash-lite","displayName":"Gemini 2.5 Flash Lite","tier":"fallback","rpm":30,"tpmK":1000}]
//
// Free-tier quota snapshot (Google AI Studio — confirmed working May 2026):
//   gemini-2.5-flash       5 RPM  250K TPM   500 RPD  ← quality reasoning
//   gemini-2.0-flash       15 RPM 1M TPM    1.5K RPD  ← standard volume
//   gemini-2.0-flash-lite  30 RPM 1M TPM    1.5K RPD  ← high-volume fallback
//
// Removed (404 Not Found as of May 2026):
//   gemini-1.5-flash, gemini-1.5-flash-8b, gemma-3-27b-it, gemma-3-12b-it

export type ModelTier = 'quality' | 'standard' | 'fallback' | 'micro';
export type ErrorKind = 'rate_limit' | 'quota_exceeded' | 'api_error' | 'not_found' | 'json_parse' | 'unknown';

export interface PooledModel {
  id:              string;
  displayName:     string;
  rpm:             number;
  tpmK:            number;    // tokens/min in thousands
  tier:            ModelTier;
  maxInputChars?:  number;
}

// Confirmed working Google AI free-tier model IDs (verified May 2026)
const DEFAULT_POOL: PooledModel[] = [
  { id: 'gemini-2.5-flash',      displayName: 'Gemini 2.5 Flash',      rpm: 5,  tpmK: 250,  tier: 'quality'  },
  { id: 'gemini-2.0-flash',      displayName: 'Gemini 2.0 Flash',      rpm: 15, tpmK: 1000, tier: 'standard' },
  { id: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash Lite', rpm: 30, tpmK: 1000, tier: 'fallback' },
];

const TIER_ORDER: ModelTier[] = ['quality', 'standard', 'fallback', 'micro'];

const RATE_LIMIT_COOLDOWN_MS  = 65_000;              // 429 → 65s cooldown
const QUOTA_COOLDOWN_MS       = 5 * 60_000;          // daily quota exhausted → 5 min pause
const API_ERROR_COOLDOWN_MS   = 30_000;              // 5xx transient → 30s cooldown
const NOT_FOUND_COOLDOWN_MS   = Number.MAX_SAFE_INTEGER; // 404 → disabled for entire session

export interface SwitchEvent {
  fromModel:  string;
  toModel:    string;
  reason:     ErrorKind | 'initial';
  task:       string;
  timestamp:  number;
}

interface ModelState {
  lockedUntil: number;
  callCount:   number;
  errorCount:  number;
}

export class GeminiModelPool {
  private models:  PooledModel[];
  private state:   Map<string, ModelState>;
  private history: SwitchEvent[] = [];
  private onSwitch?: (ev: SwitchEvent) => void;

  constructor(overrides?: Partial<PooledModel>[]) {
    let catalog = [...DEFAULT_POOL];
    if (overrides?.length) {
      for (const ov of overrides) {
        const idx = catalog.findIndex(m => m.id === ov.id);
        if (idx >= 0) Object.assign(catalog[idx], ov);
        else if (ov.id && ov.displayName && ov.tier) catalog.push(ov as PooledModel);
      }
    }
    const envOverride = process.env.GEMINI_POOL_OVERRIDES;
    if (envOverride) {
      try {
        const parsed: Partial<PooledModel>[] = JSON.parse(envOverride);
        for (const ov of parsed) {
          const idx = catalog.findIndex(m => m.id === ov.id);
          if (idx >= 0) Object.assign(catalog[idx], ov);
          else if (ov.id && ov.displayName && ov.tier) catalog.push(ov as PooledModel);
        }
      } catch {
        console.warn('[GeminiPool] GEMINI_POOL_OVERRIDES is invalid JSON — ignored');
      }
    }
    this.models = catalog;
    this.state  = new Map(catalog.map(m => [m.id, { lockedUntil: 0, callCount: 0, errorCount: 0 }]));
  }

  setOnSwitch(fn: (ev: SwitchEvent) => void) {
    this.onSwitch = fn;
  }

  getModelsForTier(preferredTier: ModelTier, promptLength = 0): PooledModel[] {
    const now     = Date.now();
    const prefIdx = TIER_ORDER.indexOf(preferredTier);

    return this.models
      .filter(m => {
        const s = this.state.get(m.id)!;
        if (s.lockedUntil > now) return false;
        if (m.maxInputChars && promptLength > m.maxInputChars) return false;
        return true;
      })
      .sort((a, b) => {
        const aDist = Math.abs(TIER_ORDER.indexOf(a.tier) - prefIdx);
        const bDist = Math.abs(TIER_ORDER.indexOf(b.tier) - prefIdx);
        if (aDist !== bDist) return aDist - bDist;
        return b.rpm - a.rpm;
      });
  }

  recordCall(modelId: string) {
    const s = this.state.get(modelId);
    if (s) s.callCount++;
  }

  markError(modelId: string, kind: ErrorKind) {
    const s = this.state.get(modelId);
    if (!s) return;
    s.errorCount++;
    switch (kind) {
      case 'rate_limit':     s.lockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;  break;
      case 'quota_exceeded': s.lockedUntil = Date.now() + QUOTA_COOLDOWN_MS;       break;
      case 'api_error':      s.lockedUntil = Date.now() + API_ERROR_COOLDOWN_MS;   break;
      case 'not_found':      s.lockedUntil = NOT_FOUND_COOLDOWN_MS;               break;
      default: break; // json_parse / unknown: don't lock — may be prompt-specific
    }
  }

  emitSwitch(fromId: string, toId: string, reason: ErrorKind | 'initial', task: string) {
    const from = this.displayName(fromId);
    const to   = this.displayName(toId);
    const ev: SwitchEvent = { fromModel: from, toModel: to, reason, task, timestamp: Date.now() };
    this.history.push(ev);
    this.onSwitch?.(ev);
  }

  getSummary(): string {
    const used = this.models.filter(m => (this.state.get(m.id)?.callCount ?? 0) > 0);
    if (!used.length) return 'no calls made';
    return used.map(m => `${m.displayName}: ${this.state.get(m.id)!.callCount} calls`).join(' | ');
  }

  getCallCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of this.models) {
      const c = this.state.get(m.id)?.callCount ?? 0;
      if (c > 0) out[m.displayName] = c;
    }
    return out;
  }

  getSwitchHistory(): SwitchEvent[] { return [...this.history]; }

  private displayName(id: string): string {
    return this.models.find(m => m.id === id)?.displayName ?? id;
  }
}

// Classify Google AI SDK errors into our error kinds
export function classifyError(err: unknown): { kind: ErrorKind; userMessage: string } {
  const raw = err instanceof Error ? err.message : String(err);

  // Model does not exist — disable for entire session, no point retrying
  if (raw.includes('404') || raw.includes('[404') || raw.includes('is not found for API') ||
      raw.includes('not found for API version')) {
    return {
      kind: 'not_found',
      userMessage: `Model not found (404) — removing from pool for this session. (${raw.slice(0, 120)})`,
    };
  }
  // Auth failures — API key missing, invalid, or not enabled for Gemini API
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid') ||
      raw.includes('401') || raw.includes('[401') ||
      raw.includes('403') || raw.includes('[403') ||
      raw.includes('PERMISSION_DENIED') || raw.includes('invalid authentication') ||
      raw.toLowerCase().includes('api key')) {
    return {
      kind: 'api_error',
      userMessage: `Gemini API key invalid or not authorised — check GOOGLE_GEMINI_API_KEY in Railway env vars. (${raw.slice(0, 120)})`,
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.toLowerCase().includes('quota')) {
    return {
      kind: 'quota_exceeded',
      userMessage: `Daily quota exhausted. Will try alternate model. (${raw.slice(0, 120)})`,
    };
  }
  if (raw.includes('429') || raw.includes('[429') || raw.includes('Too Many Requests') ||
      raw.toLowerCase().includes('rate limit')) {
    return {
      kind: 'rate_limit',
      userMessage: `Rate limit hit (429). Switching model — will retry in 65s if no alternative. (${raw.slice(0, 80)})`,
    };
  }
  if (raw.includes('500') || raw.includes('503') ||
      raw.includes('Internal Server Error') || raw.includes('Service Unavailable')) {
    return {
      kind: 'api_error',
      userMessage: `Gemini API transient error. Switching model. (${raw.slice(0, 80)})`,
    };
  }
  if (raw.includes('JSON') || raw.includes('parse') || raw.includes('Unexpected token')) {
    return {
      kind: 'json_parse',
      userMessage: `Model returned malformed JSON. Switching model. (${raw.slice(0, 80)})`,
    };
  }
  return { kind: 'unknown', userMessage: raw.slice(0, 200) };
}
