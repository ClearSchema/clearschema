import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Format } from './output';

const VALID_FORMATS = [
  'json-schema', 'typescript', 'pydantic', 'openapi', 'llm-schema', 'zod',
] as const;

function isValidFormat(value: string): value is Format {
  return (VALID_FORMATS as readonly string[]).includes(value);
}

interface PlaygroundState {
  code: string;
  format: Format;
}

export function encodeState(code: string, format: Format): string {
  const state: PlaygroundState = { code, format };
  return compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodeState(): PlaygroundState | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  try {
    const json = decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    const state = JSON.parse(json) as Record<string, unknown>;
    if (typeof state.code !== 'string' || typeof state.format !== 'string') return null;
    if (!isValidFormat(state.format)) return null;
    return { code: state.code, format: state.format };
  } catch {
    return null;
  }
}

export function updateHash(code: string, format: Format) {
  const encoded = encodeState(code, format);
  window.history.replaceState(null, '', '#' + encoded);
}

export async function copyShareUrl(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}
