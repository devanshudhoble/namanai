// Thin client for the FastAPI backend.
// All third-party keys (Gemini, Sarvam) live ONLY on the server. The browser never sees them.

import type { Understanding } from './nlu';

const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// If the backend tells us a provider is not configured, stop asking for a while instead of paying
// a failed round trip on every turn (the rules engine / browser voice take over instantly).
const unavailableUntil: Record<string, number> = {};
const BACKOFF_MS = 60_000;

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T | null> {
  if ((unavailableUntil[path] ?? 0) > Date.now()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      if (res.status === 503 || res.status === 400 || res.status === 404) unavailableUntil[path] = Date.now() + BACKOFF_MS;
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface LlmUnderstandResponse {
  ok: boolean;
  understanding?: Understanding;
  model?: string;
  latency_ms?: number;
}

/** Ask Gemini (server-side) to turn one utterance into structured intent + slots. */
export function llmUnderstand(utterance: string, contextPrompt: string, todayISO: string) {
  return postJson<LlmUnderstandResponse>(
    '/api/agent/understand',
    { utterance, context: contextPrompt, today: todayISO },
    4500
  );
}

/** Sarvam Bulbul TTS proxied through the backend. Returns base64 WAV or null. */
export async function backendTts(text: string, languageCode: string): Promise<string | null> {
  const data = await postJson<{ success: boolean; audio_base64?: string }>(
    '/api/voice/sarvam-tts',
    { text, target_language_code: languageCode },
    8000
  );
  return data?.success && data.audio_base64 ? data.audio_base64 : null;
}
