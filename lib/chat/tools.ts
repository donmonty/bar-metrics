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
import { getSalesSummary, type SalesSummaryResult } from "@/lib/metrics/sales";
import { getStockValue, type StockValueResult } from "@/lib/metrics/stock-value";
import {
  getProductosSinRegistro,
  type ProductoSinRegistroItem,
} from "@/lib/metrics/productos-sin-registro";
import { runNubebarAgentQuery, type QueryResult } from "@/lib/db/nubebar-agent";

/**
 * Static, hand-written schema reference for the `runAnalyticalQuery` tool
 * (issue #51, PRD #48) — scoped to exactly the 19 tables `nubebar_agent` has
 * `SELECT` grants on per `scripts/nubebar-agent-rls.sql` (14 RLS-scoped +
 * 5 catalog). Hand-written rather than introspected so what the model is
 * told stays reviewable in the codebase (PRD #48, "Query target and schema
 * awareness") — if `nubebar-agent-rls.sql`'s grant list ever changes, this
 * must be updated to match, or the model will be told it can query tables
 * it can't.
 */
const NUBEBAR_AGENT_SCHEMA_REFERENCE = `
RLS-scoped tables (rows are automatically restricted to the user's Sucursal — no need to filter by sucursal_id yourself, but it's there if useful):
- core_sucursal(id, nombre, razon_social, rfc, direccion, ciudad, latitud, longitud, codigo_postal, cliente_id, slug)
- core_almacen(id, nombre, numero, sucursal_id, tipo) — tipo: 'B'=Barra, 'O'=Bodega (storage)
- core_botella(id, folio, tipo_marbete, fecha_elaboracion_marbete, lote_produccion_marbete, nombre_marca, tipo_producto, graduacion_alcoholica, capacidad, origen_del_producto, fecha_importacion, nombre_fabricante, rfc_fabricante, estado, fecha_registro, fecha_baja, peso_cristal, peso_inicial, precio_unitario, almacen_id, producto_id, proveedor_id, sucursal_id, categoria, ingrediente, peso_actual, fecha_envasado, lote_produccion, numero_pedimento, peso_nueva, sat_hash) — one physical tracked bottle
- core_inspeccion(id, fecha_alta, timestamp_alta, estado, almacen_id, sucursal_id, fecha_update, timestamp_update, tipo) — a stock-count event
- core_productosinregistro(id, sucursal_id, codigo_pos, caja, nombre, fecha, importe, unidades) — POS sales lines with no matching Receta
- core_receta(id, codigo_pos, nombre, sucursal_id) — a sellable recipe/drink
- core_traspaso(id, fecha, almacen_id, botella_id, sucursal_id, usuario_id) — a bottle transfer between Almacenes
- core_venta(id, fecha, unidades, importe, caja_id, receta_id, sucursal_id) — a sale of a Receta
- core_caja(id, numero, nombre, almacen_id) — a POS register, belongs to an Almacen
- core_iteminspeccion(id, peso_botella, timestamp_inspeccion, botella_id, inspeccion_id, inspeccionado) — one bottle's weighing within an Inspeccion
- core_reportemermas(id, fecha_registro, fecha_inicial, fecha_final, almacen_id, inspeccion_id) — a merma report generated from an Inspeccion
- core_mermaingrediente(id, fecha_inicial, fecha_final, consumo_ventas, consumo_real, merma, porcentaje, almacen_id, ingrediente_id, reporte_id) — merma = consumo_ventas - consumo_real, per Ingrediente
- core_ingredientereceta(id, volumen, ingrediente_id, receta_id) — how much (mL) of an Ingrediente a Receta uses
- core_consumorecetavendida(id, fecha, volumen, ingrediente_id, receta_id, venta_id) — theoretical Ingrediente consumption implied by a sold Receta

Catalog tables (ungated, no Sucursal dimension):
- core_categoria(id, nombre)
- core_ingrediente(id, codigo, nombre, factor_peso, categoria_id)
- core_producto(id, folio, tipo_marbete, fecha_elaboracion_marbete, lote_produccion_marbete, nombre_marca, tipo_producto, graduacion_alcoholica, capacidad, origen_del_producto, fecha_importacion, nombre_fabricante, rfc_fabricante, fecha_registro, peso_cristal, precio_unitario, ingrediente_id, fecha_envasado, lote_produccion, numero_pedimento, peso_nueva, codigo_barras)
- core_proveedor(id, nombre, razon_social, rfc, direccion, ciudad)
- core_cliente(id, nombre, razon_social, rfc, direccion, ciudad)

No other tables are reachable — Django's auth/session/user tables (core_user*, auth_*, django_session, authtoken_token) have zero grants regardless of what SQL you write.
`.trim();

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

/**
 * One structured audit log line per `runAnalyticalQuery` execution (issue
 * #51, PRD #48's "Auditing" decision) — stdout only, no new database table,
 * so this doesn't reopen Chat Milestone A's "ephemeral chat" boundary. Takes
 * the already-computed outcome/rowCount rather than the raw seam result so
 * this function can't accidentally log something different from what the
 * tool actually returned to the model.
 */
function logAnalyticalQueryExecution(entry: {
  sucursalIds: number[];
  sql: string;
  outcome: "success" | "guardrail_rejected" | "db_error";
  rowCount: number;
}): void {
  console.log(
    JSON.stringify({
      event: "runAnalyticalQuery",
      timestamp: new Date().toISOString(),
      sucursalIds: entry.sucursalIds,
      query: entry.sql,
      outcome: entry.outcome,
      rowCount: entry.rowCount,
    }),
  );
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

    getSalesSummary: tool({
      description:
        "Returns the daily revenue trend and a top-Recetas-by-revenue " +
        "ranking (with units sold) for the user's Sucursal over a date " +
        "range. Omit from/to to use the dashboard's current date range.",
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
      }): Promise<SalesSummaryResult | ToolError> => {
        try {
          const dateRange = resolveToolDateRange(context.dateRange, {
            from,
            to,
          });
          return await getSalesSummary(context.sucursalId, dateRange);
        } catch (err) {
          return {
            error: "sales_summary_failed",
            message:
              err instanceof Error
                ? err.message
                : "No se pudo obtener el resumen de ventas.",
          };
        }
      },
    }),

    getStockValue: tool({
      description:
        "Returns the current total stock value (point-in-time snapshot, " +
        "not date-ranged) for the user's Sucursal, broken down by Almacén " +
        "(Barra vs. Bodega).",
      parameters: z.object({}),
      execute: async (): Promise<StockValueResult | ToolError> => {
        try {
          return await getStockValue(context.sucursalId);
        } catch (err) {
          return {
            error: "stock_value_failed",
            message:
              err instanceof Error
                ? err.message
                : "No se pudo obtener el valor de stock.",
          };
        }
      },
    }),

    getProductosSinRegistro: tool({
      description:
        "Returns the top unmatched POS sales lines (productos sin " +
        "registro) by revenue for the user's Sucursal over a date range — " +
        "a data-quality/leakage signal for POS products without a " +
        "matching Receta. Omit from/to to use the dashboard's current " +
        "date range.",
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
      }): Promise<ProductoSinRegistroItem[] | ToolError> => {
        try {
          const dateRange = resolveToolDateRange(context.dateRange, {
            from,
            to,
          });
          return await getProductosSinRegistro(context.sucursalId, dateRange);
        } catch (err) {
          return {
            error: "productos_sin_registro_failed",
            message:
              err instanceof Error
                ? err.message
                : "No se pudo obtener los productos sin registro.",
          };
        }
      },
    }),

    runAnalyticalQuery: tool({
      description:
        "Escape hatch for open-ended analytical questions the four tools " +
        "above cannot answer. Runs a single, read-only SQL SELECT against " +
        "the locked-down nubebar_agent database role, automatically scoped " +
        "to the user's Sucursal. PREFER the four tools above whenever they " +
        "can answer the question — they are faster, safer, and already " +
        "well-tested; only reach for this tool when none of them fit. " +
        "Only a single SELECT statement is allowed (no semicolons, no " +
        "writes/DDL, no set_config/current_setting calls); results are " +
        "capped at 100 rows. Available tables and columns:\n\n" +
        NUBEBAR_AGENT_SCHEMA_REFERENCE,
      parameters: z.object({
        sql: z
          .string()
          .describe(
            "A single read-only SQL SELECT statement against the tables " +
              "listed in the tool description. No semicolons, no writes.",
          ),
      }),
      execute: async ({ sql }): Promise<QueryResult | ToolError> => {
        const sucursalIds = [context.sucursalId];
        const result = await runNubebarAgentQuery(sucursalIds, sql);

        if ("error" in result) {
          logAnalyticalQueryExecution({
            sucursalIds,
            sql,
            outcome: result.error === "rejected" ? "guardrail_rejected" : "db_error",
            rowCount: 0,
          });
          return { error: result.error, message: result.message };
        }

        logAnalyticalQueryExecution({
          sucursalIds,
          sql,
          outcome: "success",
          rowCount: result.rows.length,
        });
        return result;
      },
    }),
  };
}
