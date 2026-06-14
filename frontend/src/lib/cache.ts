// Thin localStorage layer for stale-while-revalidate reads (see useCached). Render last-known data
// instantly, refresh from chain in the background. Every access is guarded: no window (SSR), quota
// overflow, or malformed JSON all degrade silently to "no cache" rather than throwing.
const PREFIX = "civicshield:v1:";

export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded / serialization failure — caching is best-effort, never fatal.
  }
}
