/**
 * `lib/chat/tools.ts` — Chat Milestone A, Slice 1 (issue #42): the tool seam
 * between the chatbot and `lib/metrics/*`. Mirrors `resolveSucursalId`'s
 * security contract (ADR 0002, `lib/dashboard/filters.ts`): `sucursalId` is
 * captured in a closure from the session-derived value the route resolves —
 * the model's tool-call arguments never carry it, so the model cannot reach
 * data outside the User's Sucursal scope.
 *
 * Per the PRD's Decision 6, a failing metric call is caught here and returned
 * as a structured `{ error, message }` tool result rather than thrown — the
 * model composes the user-facing failure message from it instead of the
 * request failing outright.
 */
import { tool } from "ai";
import { z } from "zod";

import { getMermaOverview, type MermaOverviewResult } from "@/lib/metrics/merma";

export type DashboardContext = {
  sucursalId: number;
  dateRange: { from: string; to: string };
};

export type ToolError = { error: string; message: string };

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Resolves the model's optional `from`/`to` tool args against the dashboard's
 * active range (PRD: "model-omitted dates default to the dashboard range").
 * Malformed strings are ignored in favor of the default; a `to` beyond today
 * is clamped to today since the live data never has future Inspecciones.
 */
export function resolveToolDateRange(
  dashboardRange: { from: string; to: string },
  requested: { from?: string; to?: string },
  now: Date = new Date(),
): { from: string; to: string } {
  const today = now.toISOString().slice(0, 10);

  const from =
    requested.from && isValidIsoDate(requested.from)
      ? requested.from
      : dashboardRange.from;
  let to =
    requested.to && isValidIsoDate(requested.to) ? requested.to : dashboardRange.to;

  if (to > today) to = today;
  if (from > to) return { from: to, to };

  return { from, to };
}

export function createChatTools(context: DashboardContext) {
  return {
    getMermaOverview: tool({
      description:
        "Returns merma (shrinkage) percentage and absolute mL delta per " +
        "Ingrediente for the user's Sucursal over a date range. Merma = " +
        "consumo_ventas - consumo_real (theoretical consumption implied by " +
        "Ventas minus measured real consumption from Inspecciones). Omit " +
        "from/to to use the dashboard's current date range.",
      parameters: z.object({
        from: z
          .string()
          .optional()
          .describe(
            "Start date as YYYY-MM-DD. Defaults to the dashboard's active range.",
          ),
        to: z
          .string()
          .optional()
          .describe(
            "End date as YYYY-MM-DD. Defaults to the dashboard's active range.",
          ),
      }),
      execute: async ({
        from,
        to,
      }): Promise<MermaOverviewResult | ToolError> => {
        try {
          const dateRange = resolveToolDateRange(context.dateRange, {
            from,
            to,
          });
          return await getMermaOverview(context.sucursalId, dateRange);
        } catch (err) {
          return {
            error: "merma_overview_failed",
            message:
              err instanceof Error
                ? err.message
                : "No se pudo obtener el reporte de merma.",
          };
        }
      },
    }),
  };
}
