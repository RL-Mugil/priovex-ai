// Gemini model pool — automatic failover across all available free-tier models
//
// If any model ID fails with "model not found", update it here or in env:
//   GEMINI_POOL_OVERRIDES (JSON array) e.g.:
//   [{"id":"gemma-4-27b-it","displayName":"Gemma 4 27B","tier":"fallback","rpm":15,"tpmK":null}]
//
// Free-tier quota snapshot (Google AI Studio — update as your limits change):
//   gemini-2.5-flash       5 RPM  250K TPM  500 RPD  ← quality reasoning
//   gemini-2.0-flash       15 RPM 1M TPM    1.5K RPD ← standard volume (confirmed working)
//   gemini-1.5-flash       15 RPM 1M TPM    1.5K RPD ← standard fallback
//   gemini-1.5-flash-8b    15 RPM 1M TPM    1.5K RPD ← micro tasks
//   gemma-3-27b-it         30 RPM 15K TPM   14.4K RPD ← large-prompt open model
//   gemma-3-12b-it         30 RPM 15K TPM   14.4K RPD ← medium open model

export type ModelTier = 'quality' | 'standard' | 'fallback' | 'micro';
export type ErrorKind = 'rate_limit' | 'quota_exceeded' | 'api_error' | 'json_parse' | 'unknown';

export interface PooledModel {
  id:              string;
  displayName:     string;
  rpm:             number;
  tpmK:            number;    // tokens/min in thousands; Infinity = unlimited
  tier:            ModelTier;
  maxInputChars?:  number;    // skip model if prompt exceeds this (Gemma 3: ~30K chars ≈ 7.5K tokens)
}

// Central catalog — confirmed Google AI free-tier model IDs (verified against API)
// Ordered: quality-first, fallback last
const DEFAULT_POOL: PooledModel[] = [
  { id: 'gemini-2.5-flash',    displayName: 'Gemini 2.5 Flash',    rpm: 5,  tpmK: 250,  tier: 'quality'  },
  { id: 'gemini-2.0-flash',    displayName: 'Gemini 2.0 Flash',    rpm: 15, tpmK: 1000, tier: 'standard' },
  { id: 'gemini-1.5-flash',    displayName: 'Gemini 1.5 Flash',    rpm: 15, tpmK: 1000, tier: 'standard' },
  { id: 'gemini-1.5-flash-8b', displayName: 'Gemini 1.5 Flash 8B', rpm: 15, tpmK: 1000, tier: 'fallback' },
  { id: 'gemma-3-27b-it',      displayName: 'Gemma 3 27B',         rpm: 30, tpmK: 15,   tier: 'micro',   maxInputChars: 28_000 },
  { id: 'gemma-3-12b-it',      displayName: 'Gemma 3 12B',         rpm: 30, tpmK: 15,   tier: 'micro',   maxInputChars: 28_000 },
];

// Tier ordering for fallback priority
const TIER_ORDER: ModelTier[] = ['quality', 'standard', 'fallback', 'micro'];

const RATE_LIMIT_COOLDOWN_MS  = 65_000;        // 429 → 65s cooldown
const QUOTA_COOLDOWN_MS       = 5 * 60_000;    // daily quota exhausted → 5 min pause
const API_ERROR_COOLDOWN_MS   = 30_000;        // 5xx transient → 30s cooldown

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
    // Allow env-level overrides for model IDs (e.g. when Google renames a model)
    let catalog = [...DEFAULT_POOL];
    if (overrides?.length) {
      for (const ov of overrides) {
        const idx = catalog.findIndex(m => m.id === ov.id);
        if (idx >= 0) Object.assign(catalog[idx], ov);
        else if (ov.id && ov.displayName && ov.tier) catalog.push(ov as PooledModel);
      }
    }
    // Parse GEMINI_POOL_OVERRIDES env var if present
    const envOverride = process.env.GEMINI_POOL_OVERRIDES;
    if (envOverride) {
      try {
        const parsed: Partial<PooledModel>[] = JSON.parse(envOverride);
        for (const ov of parsed) {
          const idx = catalog.findIndex(m => m.id === ov.id);
          if (idx >= 0) Object.assign(catalog[idx], ov);
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

  // Returns models ordered for the given tier, skipping locked/too-large ones
  getModelsForTier(preferredTier: ModelTier, promptLength = 0): PooledModel[] {
    const now       = Date.now();
    const prefIdx   = TIER_ORDER.indexOf(preferredTier);

    return this.models
      .filter(m => {
        const s = this.state.get(m.id)!;
        if (s.lockedUntil > now) return false;
        if (m.maxInputChars && promptLength > m.maxInputChars) return false;
        return true;
      })
      .sort((a, b) => {
        // 1. Prefer models closest to the requested tier
        const aDist = Math.abs(TIER_ORDER.indexOf(a.tier) - prefIdx);
        const bDist = Math.abs(TIER_ORDER.indexOf(b.tier) - prefIdx);
        if (aDist !== bDist) return aDist - bDist;
        // 2. Within same distance: higher RPM first (more headroom)
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

  // Human-readable session summary for logs and report
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
