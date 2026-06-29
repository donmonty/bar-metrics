/**
 * Chat Milestone A, Slice 1 (issue #42) — the chat API route. The Vercel AI
 * SDK's conventional `useChat` mount point, even though the panel UI (#44)
 * isn't built yet; this route is demoable via curl until then.
 *
 * `sucursalId` is resolved server-side from `session.user.sucursalIds`
 * (never the client-supplied `sucursalId` body field directly — that value
 * is only a *requested* override, validated the same way the dashboard
 * validates the `sucursal` URL param) before it's closed over by the chat
 * tools in `lib/chat/tools.ts`. This is the security boundary ADR 0002 and
 * the parent PRD (#41) call out explicitly.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, type CoreMessage } from "ai";

import { auth } from "@/lib/auth";
import { createChatTools } from "@/lib/chat/tools";
import { resolveDateRange, resolveSucursalId } from "@/lib/dashboard/filters";
import { findSucursalesByIds } from "@/lib/db/nubebar";

export const maxDuration = 60;

const CHAT_MODEL_ID = process.env.CHAT_MODEL_ID ?? "claude-sonnet-4-6";

type ChatRequestBody = {
  messages: CoreMessage[];
  sucursalId?: number;
  dateRange?: { from?: string; to?: string };
};

function buildSystemPrompt(sucursalNombre: string, dateRange: { from: string; to: string }): string {
  return `Eres el asistente de datos del dashboard de bar-metrics para nubebar, una plataforma de control de inventario para bares.

Sucursal activa: ${sucursalNombre}.
Rango de fechas activo en el dashboard: ${dateRange.from} a ${dateRange.to}. Usa este rango cuando el usuario no especifique fechas en su pregunta.

Glosario de dominio (usa esta terminología en español en tus respuestas):
- Sucursal: un bar / centro de consumo.
- Ingrediente: un destilado específico usado en recetas.
- Merma: variación/merma = consumo_ventas - consumo_real. Un % de merma alto indica sobreservido, robo, derrame o ventas no registradas. Es la métrica principal del producto.

Puedes ayudar con preguntas sobre:
- Merma por Ingrediente en un rango de fechas (herramienta getMermaOverview).

Si la pregunta está fuera de este alcance (clima, conocimiento general, etc.), decláralo amablemente y menciona qué sí puedes responder.

Si una herramienta no devuelve datos para el rango solicitado, dilo explícitamente — no inventes datos. Si una herramienta devuelve un error, explica el problema de forma clara y sugiere intentar de nuevo o ajustar el rango de fechas.

Responde en el mismo idioma en que el usuario escriba (español o inglés).`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as ChatRequestBody;
  const resolvedSucursalId = resolveSucursalId(
    session.user.sucursalIds,
    body.sucursalId !== undefined ? String(body.sucursalId) : undefined,
  );

  if (resolvedSucursalId === null) {
    return new Response("No Sucursal assigned to this user", { status: 403 });
  }

  const dateRange = resolveDateRange({
    from: body.dateRange?.from,
    to: body.dateRange?.to,
  });

  const [sucursal] = await findSucursalesByIds([resolvedSucursalId]);

  const tools = createChatTools({
    sucursalId: resolvedSucursalId,
    dateRange: { from: dateRange.from, to: dateRange.to },
  });

  const result = streamText({
    model: anthropic(CHAT_MODEL_ID),
    system: buildSystemPrompt(
      sucursal?.nombre ?? `Sucursal ${resolvedSucursalId}`,
      { from: dateRange.from, to: dateRange.to },
    ),
    messages: body.messages,
    tools,
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
