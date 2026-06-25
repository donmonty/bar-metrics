/**
 * Date-range filter control for the dashboard shell (issue #16). Reads/writes
 * the `range`/`from`/`to` URL search params directly — `lib/dashboard/filters`
 * owns the parsing rules so this component and every `/dashboard/*` page
 * agree on the same shape.
 */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  DATE_RANGE_PRESETS,
  type DateRangePresetKey,
  resolveDateRange,
} from "@/lib/dashboard/filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESET_LABELS: Record<DateRangePresetKey, string> = {
  last7: "Últimos 7 días",
  last30: "Últimos 30 días",
  last90: "Últimos 90 días",
};

export function DateRangeControl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = resolveDateRange({
    range: searchParams.get("range") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handlePresetChange(value: string | null) {
    if (!value) return;
    if (value === "custom") {
      updateParams({ range: "custom", from: range.from, to: range.to });
      return;
    }
    updateParams({ range: value, from: null, to: null });
  }

  const selectValue = range.kind === "custom" ? "custom" : range.preset;

  return (
    <div className="flex items-center gap-2">
      <Select value={selectValue} onValueChange={handlePresetChange}>
        <SelectTrigger aria-label="Rango de fechas">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(DATE_RANGE_PRESETS).map((key) => (
            <SelectItem key={key} value={key}>
              {PRESET_LABELS[key as DateRangePresetKey]}
            </SelectItem>
          ))}
          <SelectItem value="custom">Rango personalizado</SelectItem>
        </SelectContent>
      </Select>
      {range.kind === "custom" && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            aria-label="Desde"
            value={range.from}
            max={range.to}
            onChange={(e) =>
              updateParams({
                range: "custom",
                from: e.target.value,
                to: range.to,
              })
            }
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            aria-label="Hasta"
            value={range.to}
            min={range.from}
            onChange={(e) =>
              updateParams({
                range: "custom",
                from: range.from,
                to: e.target.value,
              })
            }
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
