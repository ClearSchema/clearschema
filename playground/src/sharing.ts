import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Format } from './output';

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
    const state = JSON.parse(json) as PlaygroundState;
    if (typeof state.code !== 'string' || typeof state.format !== 'string') return null;
    return state;
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
