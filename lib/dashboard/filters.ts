/**
 * `lib/dashboard/filters` — pure URL-param <-> filter-value resolution for
 * the dashboard shell (issue #16). No data fetching, no Sucursal/Almacén
 * lookups — `lib/metrics/*` (later slices) takes the *resolved* values these
 * functions produce, never raw search params.
 *
 * Kept dependency-free and pure so it's trivially unit-testable and so the
 * URL-param shape (`sucursal`, `range`, `from`, `to`) is defined in exactly
 * one place for every `/dashboard/*` page to share.
 */

export const DATE_RANGE_PRESETS = {
  last7: 7,
  last30: 30,
  last90: 90,
} as const;

export type DateRangePresetKey = keyof typeof DATE_RANGE_PRESETS;

export const DEFAULT_DATE_RANGE_PRESET: DateRangePresetKey = "last30";

export function isDateRangePresetKey(
  value: string | undefined,
): value is DateRangePresetKey {
  return value !== undefined && value in DATE_RANGE_PRESETS;
}

export type ResolvedDateRange =
  | { kind: "preset"; preset: DateRangePresetKey; from: string; to: string }
  | { kind: "custom"; from: string; to: string };

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Resolves the `range`/`from`/`to` URL search params into a concrete date
 * range. An explicit, well-formed `from`+`to` pair wins (custom range);
 * otherwise a recognized `range` preset is used; otherwise the default
 * preset (Last 30 days) applies. `to` defaults to today when only `from` is
 * given as a preset fallback never happens — invalid/partial combinations
 * fall back to the default preset entirely, so the dashboard never renders a
 * malformed range.
 */
export function resolveDateRange(params: {
  range?: string;
  from?: string;
  to?: string;
  now?: Date;
}): ResolvedDateRange {
  const now = params.now ?? new Date();

  if (params.from && params.to) {
    if (
      isValidIsoDate(params.from) &&
      isValidIsoDate(params.to) &&
      params.from <= params.to
    ) {
      return { kind: "custom", from: params.from, to: params.to };
    }
  }

  const preset = isDateRangePresetKey(params.range)
    ? params.range
    : DEFAULT_DATE_RANGE_PRESET;

  const to = toIsoDate(now);
  const from = toIsoDate(
    new Date(now.getTime() - DATE_RANGE_PRESETS[preset] * 24 * 60 * 60 * 1000),
  );
  return { kind: "preset", preset, from, to };
}

/**
 * Validates a Sucursal ID supplied via the URL against the User's actual
 * session scope (ADR 0002) — the single most security-sensitive function in
 * this slice. Never trust `requested` on its own: it must appear in
 * `sucursalIds` (the session's authoritative list) to be returned. Falls
 * back to the User's first assigned Sucursal when `requested` is missing or
 * invalid/unauthorized; returns `null` for a zero-Sucursal User.
 */
export function resolveSucursalId(
  sucursalIds: number[],
  requested: string | undefined,
): number | null {
  if (sucursalIds.length === 0) return null;

  if (requested !== undefined) {
    const requestedId = Number(requested);
    if (Number.isInteger(requestedId) && sucursalIds.includes(requestedId)) {
      return requestedId;
    }
  }

  return sucursalIds[0]!;
}
