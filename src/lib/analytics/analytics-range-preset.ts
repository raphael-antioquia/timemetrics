export const ANALYTICS_RANGE_PRESETS = [7, 30] as const;

export type AnalyticsRangePreset =
  (typeof ANALYTICS_RANGE_PRESETS)[number];

const DEFAULT_ANALYTICS_RANGE_PRESET: AnalyticsRangePreset = 7;

function isAnalyticsRangePreset(
  value: number,
): value is AnalyticsRangePreset {
  return ANALYTICS_RANGE_PRESETS.some(
    (preset) => preset === value,
  );
}

export function parseAnalyticsRangePreset(
  value: string | string[] | undefined,
): AnalyticsRangePreset {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === undefined) {
    return DEFAULT_ANALYTICS_RANGE_PRESET;
  }

  const parsed = Number(raw);

  return isAnalyticsRangePreset(parsed)
    ? parsed
    : DEFAULT_ANALYTICS_RANGE_PRESET;
}