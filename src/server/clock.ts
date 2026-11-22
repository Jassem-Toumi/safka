/** Injectable server clock. Tests call setClock(); production code always calls now(). */
let override: (() => Date) | null = null;

export function now(): Date {
  return override ? override() : new Date();
}

export function nowIso(): string {
  return now().toISOString();
}

export function setClock(fn: (() => Date) | null) {
  override = fn;
}

/** Fixed or advancing test clock helper. */
export function fixedClock(iso: string) {
  let t = new Date(iso).getTime();
  setClock(() => new Date(t));
  return {
    advance(ms: number) {
      t += ms;
    },
    set(next: string) {
      t = new Date(next).getTime();
    },
  };
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}
